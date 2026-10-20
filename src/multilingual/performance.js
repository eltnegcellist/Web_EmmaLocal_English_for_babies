// Shared pure ASR performance policy. Never silently select WebGPU or
// change the pinned Whisper Small model.
export const WHISPER_THREAD_KEY='mitsukotoba_whisper_threads_v1';
export const WHISPER_LANGUAGE_MODE_KEY='mitsukotoba_whisper_language_mode_v1';
export const THREAD_OPTIONS=['auto','1','2','4'];
export const LANGUAGE_DETECTION_OPTIONS=['once','every','fixed'];

export function normalizeThreads(value){
  return THREAD_OPTIONS.includes(String(value))?String(value):'auto';
}
export function normalizeLanguageDetection(value){
  return LANGUAGE_DETECTION_OPTIONS.includes(String(value))?String(value):'once';
}
export function resolveWhisperThreads(preference='auto',{
  hardwareConcurrency=1,crossOriginIsolated=false,sharedArrayBuffer=false
}={}){
  const cores=Math.max(1,Number(hardwareConcurrency)||1);
  const preferred=normalizeThreads(preference);
  const requested=preferred==='auto'?Math.min(4,Math.max(1,Math.ceil(cores/2))):Number(preferred);
  // Never allocate more threads than reported CPU cores.
  const cap=Math.min(4,cores,requested);
  return crossOriginIsolated&&sharedArrayBuffer?Math.max(1,cap):1;
}
