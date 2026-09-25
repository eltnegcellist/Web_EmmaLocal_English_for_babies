import { Transcriber, ModelArch, loadEmmaMoonshineModule } from './moonshine-module.js';
import { KittenTTS } from './vendor/kitten/index.js';

const $ = (id) => document.getElementById(id);
const ui = {
  referenceText: $('referenceText'),
  asrKeyterms: $('asrKeyterms'),
  recordButton: $('recordButton'),
  stopRecordButton: $('stopRecordButton'),
  runAsrButton: $('runAsrButton'),
  recordStatus: $('recordStatus'),
  recordingPreview: $('recordingPreview'),
  asrResults: $('asrResults'),
  ttsText: $('ttsText'),
  speedRange: $('speedRange'),
  speedValue: $('speedValue'),
  runTtsButton: $('runTtsButton'),
  ttsStatus: $('ttsStatus'),
  ttsResults: $('ttsResults'),
  runAltTtsButton: $('runAltTtsButton'),
  altTtsStatus: $('altTtsStatus'),
  altTtsResults: $('altTtsResults'),
};

const ASR_MODELS = {
  tiny_batch: {
    label: 'Tiny Streaming / 現状方式',
    arch: ModelArch.TinyStreaming,
    note: '発話終了後に一括認識。現在のEmma Webと同じ方式。',
    mode: 'batch',
    options: { max_tokens_per_second: '13.0' },
  },
  tiny_live: {
    label: 'Tiny Streaming / 真のStreaming',
    arch: ModelArch.TinyStreaming,
    note: '0.5秒ごとに逐次処理。追加モデルなし。',
    mode: 'stream',
    options: { max_tokens_per_second: '13.0' },
  },
  tiny_live_keyterms: {
    label: 'Tiny Streaming + 育児語彙',
    arch: ModelArch.TinyStreaming,
    note: '真のStreaming + 育児語彙バイアス。追加DLなし。',
    mode: 'stream',
    keyterms: true,
    options: { max_tokens_per_second: '13.0' },
  },
  small_live: {
    label: 'Small Streaming / 真のStreaming',
    arch: ModelArch.SmallStreaming,
    note: '高精度候補。モデル容量と端末負荷を比較。',
    mode: 'stream',
    options: { max_tokens_per_second: '13.0' },
  },
};

const TTS_MODELS = {
  'KittenML/kitten-tts-nano-0.8-int8': { label: 'Nano INT8', note: '旧Emma Web' },
  'KittenML/kitten-tts-nano-0.8-fp32': { label: 'Nano FP32', note: 'Emma Web 現行・非量子化' },
  'KittenML/kitten-tts-micro-0.8': { label: 'Micro 40M', note: '約40M parameters' },
  'KittenML/kitten-tts-mini-0.8': { label: 'Mini 80M', note: '0.8系最大' },
};

const ALT_TTS_MODELS = {
  'kokoro:af_heart': { engine: 'kokoro', voice: 'af_heart', label: 'Kokoro · af_heart', note: '82M / q8 / 女性' },
  'kokoro:af_bella': { engine: 'kokoro', voice: 'af_bella', label: 'Kokoro · af_bella', note: '82M / q8 / 女性' },
  'kokoro:af_nova': { engine: 'kokoro', voice: 'af_nova', label: 'Kokoro · af_nova', note: '82M / q8 / 女性' },
  'supertonic:F1': { engine: 'supertonic', voice: 'F1', label: 'Supertonic · Mina (F1)', note: '44.1kHz / 女性 / 重量級' },
  'supertonic:F2': { engine: 'supertonic', voice: 'F2', label: 'Supertonic · Sora (F2)', note: '44.1kHz / 女性 / 重量級' },
  'supertonic:F3': { engine: 'supertonic', voice: 'F3', label: 'Supertonic · Yuna (F3)', note: '44.1kHz / 女性 / 重量級' },
  'piper:en_US-hfc_female-medium': { engine: 'piper', voice: 'en_US-hfc_female-medium', label: 'Piper · HFC Female Medium', note: '軽量ローカルTTS' },
};

const KOKORO_MODULE_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
const PIPER_MODULE_URL = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm';
const ORT_MODULE_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/+esm';
const ORT_WASM_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/';
const SUPERTONIC_HELPER_URL = 'https://cdn.jsdelivr.net/gh/cskwork/supertonic-tts@d62ef527733bf0b692f92c8cb376452a62a1eec7/app/helper.js';
const SUPERTONIC_ASSET_BASE = 'https://huggingface.co/Supertone/supertonic-3/resolve/main';

let capture = null;
let recorded16k = null;
let recordingObjectUrl = null;
let ttsObjectUrls = [];
let altTtsObjectUrls = [];
let moonshineModulePromise = null;
let kokoroTtsPromise = null;
let piperModulePromise = null;
let supertonicRuntimePromise = null;

ui.speedRange.addEventListener('input', () => {
  ui.speedValue.textContent = Number(ui.speedRange.value).toFixed(2);
});
ui.recordButton.addEventListener('click', startRecording);
ui.stopRecordButton.addEventListener('click', stopRecording);
ui.runAsrButton.addEventListener('click', runAsrComparison);
ui.runTtsButton.addEventListener('click', runTtsComparison);
ui.runAltTtsButton?.addEventListener('click', runAltTtsComparison);

boot();

async function boot() {
  ui.speedValue.textContent = Number(ui.speedRange.value).toFixed(2);
  try {
    const ready = await ensureMoonshineIsolation();
    if (ready) {
      ui.recordStatus.textContent = '準備完了。録音して比較できます。';
    }
  } catch (error) {
    ui.recordStatus.textContent = 'Moonshine準備エラー: ' + friendlyError(error);
  }
}

async function ensureMoonshineIsolation() {
  if (window.crossOriginIsolated && typeof SharedArrayBuffer === 'function') {
    sessionStorage.removeItem('emma_model_lab_coi_reload_count');
    return true;
  }
  if (!('serviceWorker' in navigator)) {
    throw new Error('このブラウザではMoonshineに必要なService Workerを利用できません。');
  }

  const registration = await navigator.serviceWorker.register(
    './service-worker.js?v=20260924-model-lab',
    { updateViaCache: 'none' }
  );
  await registration.update().catch(() => {});

  const candidate = registration.installing || registration.waiting;
  if (candidate && candidate.state !== 'activated') {
    await Promise.race([
      new Promise((resolve) => {
        const onState = () => {
          if (candidate.state === 'activated' || candidate.state === 'redundant') {
            candidate.removeEventListener('statechange', onState);
            resolve();
          }
        };
        candidate.addEventListener('statechange', onState);
        onState();
      }),
      delay(5000),
    ]);
  }

  const reloadCount = Number(sessionStorage.getItem('emma_model_lab_coi_reload_count') || '0');
  if (reloadCount < 2) {
    sessionStorage.setItem('emma_model_lab_coi_reload_count', String(reloadCount + 1));
    location.reload();
    return false;
  }
  throw new Error('Moonshineに必要なブラウザ分離を有効にできませんでした。通常のブラウザタブで開き直してください。');
}

async function startRecording() {
  if (capture) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    const context = new AudioContext({ latencyHint: 'interactive' });
    if (context.state === 'suspended') await context.resume();
    await context.audioWorklet.addModule(
      new URL('../worklets/pcm-capture-worklet.js', import.meta.url)
    );

    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, 'emma-pcm-capture');
    const silent = context.createGain();
    silent.gain.value = 0;
    const frames = [];

    source.connect(node).connect(silent).connect(context.destination);
    node.port.onmessage = (event) => {
      const frame = event.data;
      if (frame?.length) frames.push(frame);
    };

    capture = {
      stream,
      context,
      source,
      node,
      silent,
      frames,
      startedAt: performance.now(),
    };
    recorded16k = null;
    ui.runAsrButton.disabled = true;
    ui.recordButton.disabled = true;
    ui.stopRecordButton.disabled = false;
    ui.recordStatus.textContent = '録音中… 普段Emmaに話しかけるのと同じように日本語で話してください。';
  } catch (error) {
    ui.recordStatus.textContent = '録音開始エラー: ' + friendlyError(error);
  }
}

async function stopRecording() {
  if (!capture) return;
  const current = capture;
  capture = null;

  try {
    current.node.port.onmessage = null;
    current.node.disconnect();
    current.source.disconnect();
    current.silent.disconnect();
  } catch {}
  current.stream.getTracks().forEach((track) => track.stop());

  const sourceRate = current.context.sampleRate;
  if (current.context.state !== 'closed') await current.context.close();

  const joined = concatFloat32(current.frames);
  recorded16k = resampleLinear(joined, sourceRate, 16000);
  const seconds = recorded16k.length / 16000;

  if (recordingObjectUrl) URL.revokeObjectURL(recordingObjectUrl);
  recordingObjectUrl = URL.createObjectURL(float32ToWav(recorded16k, 16000));
  ui.recordingPreview.src = recordingObjectUrl;
  ui.recordingPreview.hidden = false;

  ui.recordButton.disabled = false;
  ui.stopRecordButton.disabled = true;
  ui.runAsrButton.disabled = recorded16k.length < 1600;
  ui.recordStatus.textContent = seconds >= 0.1
    ? `録音完了: ${seconds.toFixed(1)}秒。同じ音声を全モデルへ入力します。`
    : '録音が短すぎます。もう一度録音してください。';
}

async function runAsrComparison() {
  if (!recorded16k?.length) return;
  const selected = [...document.querySelectorAll('.asr-model:checked')].map((el) => el.value);
  if (!selected.length) {
    ui.recordStatus.textContent = '比較するASR方式を1つ以上選んでください。';
    return;
  }
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer !== 'function') {
    ui.recordStatus.textContent = 'Moonshine実行環境を準備するためページを再読み込みします。';
    await ensureMoonshineIsolation();
    return;
  }

  ui.runAsrButton.disabled = true;
  ui.recordButton.disabled = true;
  ui.asrResults.textContent = '';
  const reference = ui.referenceText.value.trim();
  const keyterms = parseKeyterms(ui.asrKeyterms?.value || '');
  const audioSeconds = recorded16k.length / 16000;

  try {
    if (!moonshineModulePromise) moonshineModulePromise = loadEmmaMoonshineModule();
    const module = await moonshineModulePromise;

    for (const key of selected) {
      const meta = ASR_MODELS[key];
      if (!meta) continue;
      const card = createResultCard(meta.label, meta.note);
      ui.asrResults.appendChild(card.root);
      let transcriber = null;
      let maxBytes = 0;
      let latestLoaded = 0;

      try {
        card.setStatus('モデルを準備しています…');
        const initStart = performance.now();
        transcriber = await Transcriber.load({
          module,
          language: 'ja',
          modelArch: meta.arch,
          options: meta.options,
          onProgress: (loaded, total, file) => {
            latestLoaded = Math.max(latestLoaded, Number(loaded) || 0);
            maxBytes = Math.max(maxBytes, Number(total) || 0, latestLoaded);
            const percent = total > 0 ? Math.min(100, loaded / total * 100) : 0;
            card.setProgress(percent);
            const size = total > 0
              ? `${formatBytes(loaded)} / ${formatBytes(total)}`
              : formatBytes(loaded);
            card.setStatus(`取得中: ${size}${file ? ' · ' + file : ''}`);
          },
        });
        const initMs = performance.now() - initStart;

        if (meta.keyterms && keyterms.length) {
          transcriber.setKeyterms(keyterms);
        }

        card.setProgress(100);
        let result;
        if (meta.mode === 'stream') {
          card.setStatus('実時間Streamingを再現しています…');
          result = await runStreamingReplay(transcriber, recorded16k, 16000, (snapshot, progress) => {
            card.setTranscript(transcriptText(snapshot) || '（認識中…）');
            card.setProgress(progress * 100);
          });
          card.addMetric(`発話 ${audioSeconds.toFixed(2)}秒`);
          card.addMetric(`Streaming計算 ${formatMs(result.computeMs)}`);
          card.addMetric(`処理負荷 ${(result.computeMs / (audioSeconds * 1000)).toFixed(2)}x`);
          card.addMetric(`発話終了→確定 ${formatMs(result.postSpeechMs)}`);
          if (result.firstTextMs != null) card.addMetric(`最初の文字 ${formatMs(result.firstTextMs)}`);
          if (meta.keyterms) card.addMetric(`育児語彙 ${keyterms.length}語`);
        } else {
          card.setStatus('発話終了後に一括認識しています…');
          const inferStart = performance.now();
          const snapshot = transcriber.transcribe(recorded16k, { sampleRate: 16000 });
          const inferMs = performance.now() - inferStart;
          result = {
            transcript: transcriptText(snapshot),
            computeMs: inferMs,
            postSpeechMs: inferMs,
          };
          card.addMetric(`発話 ${audioSeconds.toFixed(2)}秒`);
          card.addMetric(`一括推論 ${formatMs(inferMs)}`);
          card.addMetric(`処理負荷 ${(inferMs / (audioSeconds * 1000)).toFixed(2)}x`);
          card.addMetric(`発話終了→確定 ${formatMs(inferMs)}`);
        }

        card.setTranscript(result.transcript || '（文字起こし結果なし）');
        card.addMetric(`準備 ${formatMs(initMs)}`);
        if (maxBytes > 0) card.addMetric(`モデル取得量 ${formatBytes(maxBytes)}`);
        if (reference) {
          const cer = characterErrorRate(reference, result.transcript);
          card.addMetric(`CER ${(cer * 100).toFixed(1)}%`);
        }
        card.setStatus('完了');
      } catch (error) {
        card.setStatus('エラー: ' + friendlyError(error));
        card.setTranscript('この方式は現在のブラウザ／Moonshineランタイムでは実行できない可能性があります。');
      } finally {
        try { transcriber?.close(); } catch {}
      }
      await delay(80);
    }
  } catch (error) {
    ui.recordStatus.textContent = 'Moonshine実行エラー: ' + friendlyError(error);
  } finally {
    ui.runAsrButton.disabled = false;
    ui.recordButton.disabled = false;
  }
}

async function runStreamingReplay(transcriber, audio, sampleRate, onUpdate) {
  const stream = transcriber.createStream({ updateInterval: 0.5 });
  const chunkSamples = Math.max(1, Math.round(sampleRate * 0.5));
  const started = performance.now();
  let computeMs = 0;
  let firstTextMs = null;
  let snapshot = { lines: [] };
  stream.start();

  try {
    let offset = 0;
    while (offset < audio.length) {
      const end = Math.min(audio.length, offset + chunkSamples);
      const chunk = audio.subarray(offset, end);
      stream.addAudio(chunk, sampleRate);

      const passStart = performance.now();
      snapshot = stream.transcribe();
      computeMs += performance.now() - passStart;

      const text = transcriptText(snapshot);
      if (firstTextMs == null && text) firstTextMs = performance.now() - started;
      offset = end;
      onUpdate?.(snapshot, offset / audio.length);

      const targetTime = started + (offset / sampleRate) * 1000;
      const remaining = targetTime - performance.now();
      if (remaining > 0) await delay(remaining);
    }

    const speechEndAt = started + (audio.length / sampleRate) * 1000;
    const flushStart = performance.now();
    stream.stop();
    computeMs += performance.now() - flushStart;
    snapshot = stream.latest || snapshot;
    const postSpeechMs = Math.max(0, performance.now() - speechEndAt);

    return {
      transcript: transcriptText(snapshot),
      computeMs,
      firstTextMs,
      postSpeechMs,
    };
  } finally {
    try { stream.close(); } catch {}
  }
}

function parseKeyterms(value) {
  return [...new Set(
    String(value || '')
      .split(/[、,\n]/)
      .map((term) => term.trim())
      .filter(Boolean)
  )].slice(0, 80);
}

async function runTtsComparison() {
  const selected = [...document.querySelectorAll('.tts-model:checked')].map((el) => el.value);
  const text = ui.ttsText.value.trim();
  if (!selected.length) {
    ui.ttsStatus.textContent = '比較するKittenモデルを1つ以上選んでください。';
    return;
  }
  if (!text) {
    ui.ttsStatus.textContent = '読み上げる英文を入力してください。';
    return;
  }

  const speed = Number(ui.speedRange.value);
  ui.runTtsButton.disabled = true;
  ui.ttsResults.textContent = '';
  ui.ttsStatus.textContent = `${selected.length}モデルを順番に生成します。速度係数 ${speed.toFixed(2)}`;
  for (const url of ttsObjectUrls) URL.revokeObjectURL(url);
  ttsObjectUrls = [];

  for (const modelId of selected) {
    const meta = TTS_MODELS[modelId] || { label: modelId, note: '' };
    const card = createResultCard(meta.label, meta.note);
    ui.ttsResults.appendChild(card.root);
    let tts = null;
    let maxBytes = 0;

    try {
      card.setStatus('モデルを準備しています…');
      const initStart = performance.now();
      tts = await KittenTTS.from_pretrained(modelId, {
        onStage: (stage) => card.setStatus(stageLabel(stage)),
        onProgress: (info) => {
          const loaded = Number(info.modelLoaded || 0) + Number(info.voicesLoaded || 0);
          const total = Number(info.modelTotal || 0) + Number(info.voicesTotal || 0);
          maxBytes = Math.max(maxBytes, total || loaded);
          card.setProgress(total > 0 ? Math.min(100, loaded / total * 100) : 0);
          card.setStatus(total > 0
            ? `取得中: ${formatBytes(loaded)} / ${formatBytes(total)}`
            : `取得中: ${formatBytes(loaded)}`);
        },
      });
      const initMs = performance.now() - initStart;

      const voices = tts.list_voices?.() || [];
      if (voices.length && !voices.includes('Kiki')) {
        throw new Error('Kiki音声がこのモデルにありません。');
      }

      card.setStatus(`Kiki / speed ${speed.toFixed(2)} で生成中…`);
      card.setProgress(100);
      const genStart = performance.now();
      const audio = await tts.generate(text, { voice: 'Kiki', speed, clean: true });
      const genMs = performance.now() - genStart;
      const samples = audio?.data;
      const sampleRate = audio?.sampling_rate || audio?.sampleRate || 24000;
      if (!samples?.length) throw new Error('音声データが生成されませんでした。');

      const stats = analyzeAudio(samples);
      const pcm16Blob = float32ToWav(samples, sampleRate);
      const float32Blob = float32ToFloatWav(samples, sampleRate);
      const pcm16Url = URL.createObjectURL(pcm16Blob);
      const float32Url = URL.createObjectURL(float32Blob);
      ttsObjectUrls.push(pcm16Url, float32Url);

      card.setAudio(pcm16Url, 'A：16bit PCM WAV（現在のWeb Emmaと同系統の変換）');
      card.setAudio(float32Url, 'B：32bit Float WAV（16bit量子化をしない）');
      card.setDirectAudio(
        samples instanceof Float32Array ? samples.slice() : new Float32Array(samples),
        sampleRate,
        'C：Float32をAudioBufferへ直接再生（WAV化を完全に通さない）'
      );

      card.addMetric(`準備 ${formatMs(initMs)}`);
      card.addMetric(`生成 ${formatMs(genMs)}`);
      card.addMetric(`音声 ${(samples.length / sampleRate).toFixed(2)}秒`);
      card.addMetric(`sample rate ${sampleRate} Hz`);
      card.addMetric(`speed ${speed.toFixed(2)}`);
      card.addMetric(`peak ${stats.peak.toFixed(4)}`);
      card.addMetric(`RMS ${stats.rms.toFixed(4)}`);
      card.addMetric(`±1超過 ${stats.clippedSamples} sample`);
      card.addMetric(`clip率 ${(stats.clipRate * 100).toFixed(5)}%`);
      if (maxBytes > 0) card.addMetric(`モデル取得量 ${formatBytes(maxBytes)}`);
      card.setStatus('完了 · A/B/Cを同じ音源で比較');
    } catch (error) {
      card.setStatus('エラー: ' + friendlyError(error));
    } finally {
      try { await tts?.release?.(); } catch {}
    }
    await delay(100);
  }

  ui.ttsStatus.textContent = '比較生成が完了しました。各モデルを再生して聴き比べてください。';
  ui.runTtsButton.disabled = false;
}


async function runAltTtsComparison() {
  const selected = [...document.querySelectorAll('.alt-tts-model:checked')].map((el) => el.value);
  const text = ui.ttsText.value.trim();

  if (!selected.length) {
    ui.altTtsStatus.textContent = '比較する他TTSを1つ以上選んでください。';
    return;
  }
  if (!text) {
    ui.altTtsStatus.textContent = '上の「読み上げる英文」に比較用の英文を入力してください。';
    return;
  }

  ui.runAltTtsButton.disabled = true;
  ui.altTtsResults.textContent = '';
  ui.altTtsStatus.textContent = selected.length + '件を順番に生成します。初回はモデル取得に時間がかかります。';

  for (const url of altTtsObjectUrls) URL.revokeObjectURL(url);
  altTtsObjectUrls = [];

  try {
    for (const key of selected) {
      const meta = ALT_TTS_MODELS[key];
      if (!meta) continue;
      const card = createResultCard(meta.label, meta.note);
      ui.altTtsResults.appendChild(card.root);

      try {
        card.setStatus('準備しています…');
        const started = performance.now();
        let output;

        if (meta.engine === 'kokoro') {
          output = await generateKokoro(text, meta.voice, card);
        } else if (meta.engine === 'supertonic') {
          output = await generateSupertonic(text, meta.voice, card);
        } else if (meta.engine === 'piper') {
          output = await generatePiper(text, meta.voice, card);
        } else {
          throw new Error('未対応のTTSエンジンです。');
        }

        const totalMs = performance.now() - started;
        const url = URL.createObjectURL(output.blob);
        altTtsObjectUrls.push(url);
        card.setAudio(url, output.audioLabel || '生成音声');
        card.addMetric('生成+準備 ' + formatMs(totalMs));
        if (output.generationMs != null) card.addMetric('生成 ' + formatMs(output.generationMs));
        if (output.duration != null) card.addMetric('音声 ' + output.duration.toFixed(2) + '秒');
        if (output.sampleRate) card.addMetric('sample rate ' + output.sampleRate + ' Hz');
        if (output.backend) card.addMetric(output.backend);
        if (output.extra) card.addMetric(output.extra);
        card.setStatus('完了');
      } catch (error) {
        card.setStatus('エラー: ' + friendlyError(error));
        card.setTranscript('このエンジンは現在のブラウザまたは端末で読み込めない可能性があります。');
      }

      await delay(120);
    }
  } finally {
    ui.runAltTtsButton.disabled = false;
    ui.altTtsStatus.textContent = '生成処理が完了しました。各音声を同じ文章で聴き比べてください。';
  }
}

async function getKokoroTts() {
  if (!kokoroTtsPromise) {
    kokoroTtsPromise = (async () => {
      const mod = await import(KOKORO_MODULE_URL);
      if (!mod?.KokoroTTS) throw new Error('kokoro-jsを読み込めませんでした。');
      return mod.KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: 'wasm',
      });
    })().catch((error) => {
      kokoroTtsPromise = null;
      throw error;
    });
  }
  return kokoroTtsPromise;
}

async function generateKokoro(text, voice, card) {
  card.setStatus('Kokoro 82M q8を準備しています…');
  const tts = await getKokoroTts();
  card.setProgress(70);

  const generationStart = performance.now();
  const audio = await tts.generate(text, { voice });
  const generationMs = performance.now() - generationStart;
  if (!audio?.toBlob) throw new Error('Kokoroが音声Blobを返しませんでした。');

  const blob = audio.toBlob();
  const decoded = await inspectAudioBlob(blob);
  card.setProgress(100);
  return {
    blob,
    generationMs,
    duration: decoded.duration,
    sampleRate: decoded.sampleRate,
    backend: 'Kokoro q8 / WASM',
    audioLabel: voice + ' · Kokoro 82M',
  };
}

async function getPiperModule() {
  if (!piperModulePromise) {
    piperModulePromise = import(PIPER_MODULE_URL).catch((error) => {
      piperModulePromise = null;
      throw error;
    });
  }
  return piperModulePromise;
}

async function generatePiper(text, voice, card) {
  card.setStatus('Piperモデルを準備しています…');
  const piper = await getPiperModule();

  const generationStart = performance.now();
  const blob = await piper.predict(
    { text, voiceId: voice },
    (progress) => {
      const total = Number(progress?.total) || 0;
      const loaded = Number(progress?.loaded) || 0;
      if (total > 0) card.setProgress(Math.min(95, loaded / total * 95));
      if (progress?.url) card.setStatus('Piper取得中: ' + String(progress.url).split('/').pop());
    }
  );
  const generationMs = performance.now() - generationStart;
  if (!(blob instanceof Blob)) throw new Error('Piperが音声Blobを返しませんでした。');

  const decoded = await inspectAudioBlob(blob);
  card.setProgress(100);
  return {
    blob,
    generationMs,
    duration: decoded.duration,
    sampleRate: decoded.sampleRate,
    backend: 'Piper / browser WASM',
    audioLabel: voice,
  };
}

async function getSupertonicRuntime(card) {
  if (!supertonicRuntimePromise) {
    supertonicRuntimePromise = (async () => {
      card?.setStatus('Supertonic用ONNX Runtimeを準備しています…');
      const [ort, helper] = await Promise.all([
        import(ORT_MODULE_URL),
        import(SUPERTONIC_HELPER_URL),
      ]);

      const runtime = ort.default || ort;
      if (runtime?.env?.wasm) runtime.env.wasm.wasmPaths = ORT_WASM_BASE;
      helper.configureOrt(runtime);

      card?.setStatus('Supertonic 3モデルを読み込んでいます（約380MB）…');
      const result = await helper.loadTextToSpeech(
        SUPERTONIC_ASSET_BASE + '/onnx',
        { executionProviders: ['wasm'], graphOptimizationLevel: 'all' },
        (name, current, total) => {
          const fraction = total > 0 ? current / total : 0;
          card?.setProgress(Math.min(80, fraction * 80));
          card?.setStatus('Supertonicモデル ' + current + '/' + total + ': ' + name);
        }
      );

      return { helper, tts: result.textToSpeech, styles: new Map() };
    })().catch((error) => {
      supertonicRuntimePromise = null;
      throw error;
    });
  }
  return supertonicRuntimePromise;
}

async function generateSupertonic(text, voice, card) {
  const runtime = await getSupertonicRuntime(card);
  let style = runtime.styles.get(voice);
  if (!style) {
    card.setStatus('Supertonic ' + voice + ' 音声スタイルを読み込んでいます…');
    style = await runtime.helper.loadVoiceStyle([
      SUPERTONIC_ASSET_BASE + '/voice_styles/' + voice + '.json'
    ], false);
    runtime.styles.set(voice, style);
  }

  card.setStatus('Supertonic 3で生成しています…');
  const generationStart = performance.now();
  const result = await runtime.tts.call(
    text,
    'en',
    style,
    8,
    1.0,
    0.3,
    (step, total) => {
      card.setProgress(80 + (step / Math.max(1, total)) * 20);
      card.setStatus('Supertonic生成中 ' + step + '/' + total);
    }
  );
  const generationMs = performance.now() - generationStart;
  const wavLen = Math.floor(runtime.tts.sampleRate * result.duration[0]);
  const wav = result.wav.slice(0, wavLen);
  const wavBuffer = runtime.helper.writeWavFile(wav, runtime.tts.sampleRate);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  card.setProgress(100);

  return {
    blob,
    generationMs,
    duration: Number(result.duration?.[0]) || null,
    sampleRate: runtime.tts.sampleRate,
    backend: 'Supertonic 3 / WASM',
    extra: '8 steps',
    audioLabel: 'Supertonic ' + voice,
  };
}

async function inspectAudioBlob(blob) {
  let context = null;
  try {
    context = new AudioContext({ latencyHint: 'interactive' });
    const bytes = await blob.arrayBuffer();
    const decoded = await context.decodeAudioData(bytes.slice(0));
    return { duration: decoded.duration, sampleRate: decoded.sampleRate };
  } finally {
    try { await context?.close(); } catch {}
  }
}

function createResultCard(title, note) {
  const root = document.createElement('article');
  root.className = 'result';

  const head = document.createElement('div');
  head.className = 'result-head';
  const titleWrap = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = title;
  const small = document.createElement('span');
  small.className = 'small';
  small.textContent = note ? ' · ' + note : '';
  titleWrap.append(strong, small);
  const status = document.createElement('span');
  status.className = 'pill';
  status.textContent = '待機';
  head.append(titleWrap, status);

  const progress = document.createElement('div');
  progress.className = 'bar';
  const progressInner = document.createElement('span');
  progress.appendChild(progressInner);

  const metrics = document.createElement('div');
  const transcript = document.createElement('div');
  transcript.className = 'transcript';
  const audioWrap = document.createElement('div');

  root.append(head, progress, metrics, transcript, audioWrap);

  return {
    root,
    setStatus(text) { status.textContent = text; },
    setProgress(value) { progressInner.style.width = `${Math.max(0, Math.min(100, value || 0))}%`; },
    addMetric(text) {
      const el = document.createElement('span');
      el.className = 'metric';
      el.textContent = text;
      metrics.appendChild(el);
    },
    setTranscript(text) { transcript.textContent = text; },
    setAudio(src, label = '') {
      const row = document.createElement('div');
      row.style.marginTop = '10px';
      if (label) {
        const caption = document.createElement('div');
        caption.className = 'small';
        caption.textContent = label;
        caption.style.marginBottom = '4px';
        row.appendChild(caption);
      }
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = src;
      row.appendChild(audio);
      audioWrap.appendChild(row);
    },
    setDirectAudio(samples, sampleRate, label = '') {
      const row = document.createElement('div');
      row.style.marginTop = '10px';
      if (label) {
        const caption = document.createElement('div');
        caption.className = 'small';
        caption.textContent = label;
        caption.style.marginBottom = '4px';
        row.appendChild(caption);
      }
      const button = document.createElement('button');
      button.className = 'secondary';
      button.type = 'button';
      button.textContent = 'Cを直接再生';
      const statusText = document.createElement('span');
      statusText.className = 'small';
      statusText.style.marginLeft = '8px';
      button.addEventListener('click', async () => {
        button.disabled = true;
        statusText.textContent = '再生中…';
        let context = null;
        try {
          context = new AudioContext({ sampleRate, latencyHint: 'interactive' });
          if (context.state === 'suspended') await context.resume();
          const buffer = context.createBuffer(1, samples.length, sampleRate);
          buffer.copyToChannel(samples, 0);
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          source.start();
          await new Promise((resolve) => { source.onended = resolve; });
          statusText.textContent = '再生完了';
        } catch (error) {
          statusText.textContent = '再生エラー: ' + friendlyError(error);
        } finally {
          try { await context?.close(); } catch {}
          button.disabled = false;
        }
      });
      row.append(button, statusText);
      audioWrap.appendChild(row);
    },
  };
}

function stageLabel(stage) {
  const labels = {
    config: '設定を確認しています…',
    download: 'モデルをダウンロードしています…',
    'download-complete': 'ダウンロード完了',
    runtime: 'ONNX Runtimeを準備しています…',
    'onnx-session': 'モデルを初期化しています…',
    voices: 'Kiki音声を読み込んでいます…',
    ready: 'モデル準備完了',
  };
  return labels[stage] || String(stage || '準備中…');
}

function transcriptText(result) {
  if (!Array.isArray(result?.lines)) return '';
  return result.lines
    .map((line) => String(line?.text || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForCer(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function characterErrorRate(reference, hypothesis) {
  const a = [...normalizeForCer(reference)];
  const b = [...normalizeForCer(hypothesis)];
  if (!a.length) return b.length ? 1 : 0;
  return levenshtein(a, b) / a.length;
}

function levenshtein(a, b) {
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function concatFloat32(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function resampleLinear(input, sourceRate, targetRate) {
  if (!input.length || sourceRate === targetRate) return input.slice();
  const ratio = sourceRate / targetRate;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = position - left;
    output[i] = input[left] * (1 - fraction) + input[right] * fraction;
  }
  return output;
}

function analyzeAudio(samples) {
  const input = samples instanceof Float32Array ? samples : new Float32Array(samples);
  let peak = 0;
  let sumSquares = 0;
  let clippedSamples = 0;
  for (let i = 0; i < input.length; i++) {
    const value = Number(input[i]) || 0;
    const abs = Math.abs(value);
    peak = Math.max(peak, abs);
    sumSquares += value * value;
    if (abs > 1) clippedSamples++;
  }
  return {
    peak,
    rms: input.length ? Math.sqrt(sumSquares / input.length) : 0,
    clippedSamples,
    clipRate: input.length ? clippedSamples / input.length : 0,
  };
}

function float32ToFloatWav(samples, sampleRate) {
  const input = samples instanceof Float32Array ? samples : new Float32Array(samples);
  const bytesPerSample = 4;
  const buffer = new ArrayBuffer(44 + input.length * bytesPerSample);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + input.length * bytesPerSample, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true); // IEEE float
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 32, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, input.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < input.length; i++, offset += bytesPerSample) {
    view.setFloat32(offset, Number(input[i]) || 0, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function float32ToWav(samples, sampleRate) {
  const input = samples instanceof Float32Array ? samples : new Float32Array(samples);
  const buffer = new ArrayBuffer(44 + input.length * 2);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + input.length * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, input.length * 2, true);

  let offset = 44;
  for (let i = 0; i < input.length; i++, offset += 2) {
    const value = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1e9) return (value / 1e9).toFixed(2) + ' GB';
  if (value >= 1e6) return (value / 1e6).toFixed(1) + ' MB';
  if (value >= 1e3) return (value / 1e3).toFixed(1) + ' KB';
  return value + ' B';
}

function formatMs(ms) {
  return ms >= 1000 ? (ms / 1000).toFixed(2) + '秒' : Math.round(ms) + 'ms';
}

function friendlyError(error) {
  const message = error?.message || String(error);
  if (/memory|out of memory|allocation/i.test(message)) {
    return 'メモリ不足の可能性があります。ほかのタブを閉じるか、比較するモデルを減らしてください。(' + message + ')';
  }
  return message;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
