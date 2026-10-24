/**
 * Research-only routing contract. Not imported by the production app.
 * Selection intent != a passed Android Chrome QA gate or a deployed model.
 *
 * UI 'en' means multilingual auto-detect until speech language is known.
 * Whisper 5s refers to short-context ACFT Small, NOT the current standard
 * Xenova Whisper Small ONNX which encodes a 30-second feature context.
 */
export const WHISPER_CONTEXT_SECONDS = 5;
export const WHISPER_OVERLAP_SECONDS = 0.25;
export const WHISPER_5S = 'whisper-acft-small-5s';
export const LANGUAGE_UI = Object.freeze(['ja', 'de', 'fr', 'ko', 'th', 'en']);

export const ROUTES = Object.freeze({
  ja: Object.freeze({
    asr: 'moonshine-small-streaming-ja', family: 'moonshine',
    evidence: 'existing-app', rollout: 'existing',
    semantic: 'ruri-70m-existing', semanticSelection: 'existing'
  }),
  de: Object.freeze({
    asr: 'moonshine-small-streaming-de', family: 'moonshine',
    evidence: 'MIT-model-and-manifest', rollout: 'selected-unverified-device',
    semantic: 'e5-multilingual-small', semanticSelection: 'locale-interaction-candidate'
  }),
  fr: Object.freeze({
    asr: 'vosk-small-fr', family: 'vosk',
    evidence: '22-synthetic-utterances-CER-5.90-percent-linux', rollout: 'selected-unverified-device',
    semantic: 'e5-multilingual-small', semanticSelection: 'shared-retrained-interaction-preferred'
  }),
  ko: Object.freeze({
    asr: WHISPER_5S, family: 'whisper',
    evidence: 'vosk-ko-rejected-81.71-percent-CER', rollout: 'short-context-whisper-research',
    semantic: 'e5-multilingual-small', semanticSelection: 'locale-interaction-candidate'
  }),
  th: Object.freeze({
    asr: 'sherpa-onnx-zipformer-thai-2024-06-20', family: 'sherpa-onnx',
    evidence: 'thai-offline-model-listed-no-S25-benchmark', rollout: 'selected-unverified-device',
    semantic: 'e5-multilingual-small', semanticSelection: 'shared-retrained-interaction-preferred'
  }),
  en: Object.freeze({
    asr: 'moonshine-small-streaming-en', family: 'moonshine',
    evidence: 'five-S25-same-audio-runs-p50-1061.07-ms', rollout: 'selected-tested-one-S25-clip',
    semantic: 'e5-multilingual-small', semanticSelection: 'locale-interaction-candidate'
  })
});

/**
 * UI language and detected spoken language are independent. The en UI retains
 * multilingual auto-identification. A validated detector / fallback is needed
 * before switching dynamically to a specialist.
 */
export function proposedRoute(uiLocale, detectedSpeechLocale = null) {
  if (!LANGUAGE_UI.includes(uiLocale)) throw new Error('Unsupported UI locale');
  if (uiLocale === 'en' && detectedSpeechLocale == null) {
    return Object.freeze({
      uiLocale, speechLocale: null, autoDetectLanguage: true,
      asr: WHISPER_5S, family: 'whisper', rollout: 'short-context-whisper-research',
      semantic: 'e5-multilingual-small', semanticSelection: 'shared-until-language-known'
    });
  }
  const locale = uiLocale === 'en' ? detectedSpeechLocale : uiLocale;
  if (!LANGUAGE_UI.includes(locale)) {
    return Object.freeze({
      uiLocale, speechLocale: locale, autoDetectLanguage: true,
      asr: WHISPER_5S, family: 'whisper', rollout: 'short-context-whisper-research',
      semantic: 'e5-multilingual-small', semanticSelection: 'shared-until-language-known'
    });
  }
  return Object.freeze({
    uiLocale, speechLocale: locale, autoDetectLanguage: false, ...ROUTES[locale]
  });
}

/** Plan contiguous, overlapping Whisper windows without truncating >5s speech. */
export function whisperWindows(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
    throw new Error('Audio duration must be a positive finite number');
  const result = [];
  const hop = WHISPER_CONTEXT_SECONDS - WHISPER_OVERLAP_SECONDS;
  for (let start = 0; start < durationSeconds; start += hop) {
    const end = Math.min(durationSeconds, start + WHISPER_CONTEXT_SECONDS);
    result.push({ startSeconds: Number(start.toFixed(6)), endSeconds: Number(end.toFixed(6)) });
    if (end >= durationSeconds) break;
  }
  return result;
}

/** The experimental route is never permission to silently deploy unverified models. */
export function mayDeployModel(locale) {
  if (!LANGUAGE_UI.includes(locale)) return false;
  return ROUTES[locale].rollout === 'existing';
}
