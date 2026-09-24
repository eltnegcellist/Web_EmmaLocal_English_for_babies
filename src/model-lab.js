import { Transcriber, ModelArch, loadEmmaMoonshineModule } from './moonshine-module.js';
import { KittenTTS } from './vendor/kitten/index.js';

const $ = (id) => document.getElementById(id);
const ui = {
  referenceText: $('referenceText'),
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
};

const ASR_MODELS = {
  tiny_streaming: {
    label: 'Tiny Streaming',
    arch: ModelArch.TinyStreaming,
    note: 'Emma Web 現行',
    options: { max_tokens_per_second: '13.0' },
  },
  small_streaming: {
    label: 'Small Streaming',
    arch: ModelArch.SmallStreaming,
    note: '日本語Streaming大型側',
    options: { max_tokens_per_second: '13.0' },
  },
  tiny: {
    label: 'Tiny (non-streaming)',
    arch: ModelArch.Tiny,
    note: '旧アーキテクチャ',
    options: undefined,
  },
  base: {
    label: 'Base (non-streaming)',
    arch: ModelArch.Base,
    note: '旧アーキテクチャ大型側',
    options: undefined,
  },
};

const TTS_MODELS = {
  'KittenML/kitten-tts-nano-0.8-int8': { label: 'Nano INT8', note: 'Emma Web 現行' },
  'KittenML/kitten-tts-nano-0.8-fp32': { label: 'Nano FP32', note: 'Nano 非量子化' },
  'KittenML/kitten-tts-micro-0.8': { label: 'Micro 40M', note: '約40M parameters' },
  'KittenML/kitten-tts-mini-0.8': { label: 'Mini 80M', note: '0.8系最大' },
};

let capture = null;
let recorded16k = null;
let recordingObjectUrl = null;
let ttsObjectUrls = [];
let moonshineModulePromise = null;

ui.speedRange.addEventListener('input', () => {
  ui.speedValue.textContent = Number(ui.speedRange.value).toFixed(2);
});
ui.recordButton.addEventListener('click', startRecording);
ui.stopRecordButton.addEventListener('click', stopRecording);
ui.runAsrButton.addEventListener('click', runAsrComparison);
ui.runTtsButton.addEventListener('click', runTtsComparison);

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
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
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
    ui.recordStatus.textContent = '比較するMoonshineモデルを1つ以上選んでください。';
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

  try {
    if (!moonshineModulePromise) moonshineModulePromise = loadEmmaMoonshineModule();
    const module = await moonshineModulePromise;

    for (const key of selected) {
      const meta = ASR_MODELS[key];
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

        card.setStatus('同じ録音を認識しています…');
        card.setProgress(100);
        const inferStart = performance.now();
        const result = transcriber.transcribe(recorded16k, { sampleRate: 16000 });
        const inferMs = performance.now() - inferStart;
        const transcript = transcriptText(result);

        card.setTranscript(transcript || '（文字起こし結果なし）');
        card.addMetric(`準備 ${formatMs(initMs)}`);
        card.addMetric(`推論 ${formatMs(inferMs)}`);
        if (maxBytes > 0) card.addMetric(`モデル取得量 ${formatBytes(maxBytes)}`);
        if (reference) {
          const cer = characterErrorRate(reference, transcript);
          card.addMetric(`CER ${(cer * 100).toFixed(1)}%`);
        }
        card.setStatus('完了');
      } catch (error) {
        card.setStatus('エラー: ' + friendlyError(error));
        card.setTranscript('このモデルは現在の日本語Webランタイムでは読み込めない可能性があります。');
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

      const blob = float32ToWav(samples, sampleRate);
      const objectUrl = URL.createObjectURL(blob);
      ttsObjectUrls.push(objectUrl);
      card.setAudio(objectUrl);
      card.addMetric(`準備 ${formatMs(initMs)}`);
      card.addMetric(`生成 ${formatMs(genMs)}`);
      card.addMetric(`音声 ${(samples.length / sampleRate).toFixed(2)}秒`);
      card.addMetric(`speed ${speed.toFixed(2)}`);
      if (maxBytes > 0) card.addMetric(`モデル取得量 ${formatBytes(maxBytes)}`);
      card.setStatus('完了');
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
    setAudio(src) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = src;
      audioWrap.appendChild(audio);
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
