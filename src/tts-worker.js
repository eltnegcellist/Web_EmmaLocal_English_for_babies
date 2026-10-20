// Production voice playback is exclusively the fixed-seed Qwen3 recorded bank.
// Never silently synthesize missing or stale English with another voice.
import { PrerecordedVoiceBank } from './prerecorded-voice.js?v=20261020-progressive-voice-v1';
const bank = new PrerecordedVoiceBank();

self.onmessage = async event => {
  const data = event.data || {};
  try {
    if (data.type === 'init') {
      if (data.engine && data.engine !== 'qwen3-prerecorded') {
        throw Error('実行時の音声合成は廃止しました。事前収録音源を準備してください。');
      }
      await bank.init(); // Manifest only; clips are fetched as needed.
      self.postMessage({
        type:'ready', device:'prerecorded-local', engine:'qwen3-prerecorded',
        model:'Qwen3-TTS-1.7B-Base-8bit', voice:'Mitsukotoba-1202',
        generationSeed:1202, license:'Apache-2.0'
      });
      return;
    }
    if (data.type === 'prefetch') {
      // Cache filling must not block playback or turn into a fatal voice error.
      void bank.prefetchAll(status => self.postMessage({type:'prefetch-status', ...status}))
        .catch(error => self.postMessage({type:'prefetch-status', stage:'paused',
          message:error?.message || String(error)}));
      return;
    }
    if (data.type === 'speak') {
      if (data.engine && data.engine !== 'qwen3-prerecorded') {
        throw Error('実行時の音声合成は廃止しました。');
      }
      const text = String(data.text || (Array.isArray(data.sentences) ? data.sentences.join(' ') : '')).trim();
      if (!text) throw Error('再生する英文がありません。');
      const audio = await bank.audioFor(text);
      if (!audio) throw Error('この英文に対応する事前収録音源がありません。音声を再準備してください。');
      self.postMessage({type:'audio',requestId:data.requestId,index:0,sentence:text,
        blob:audio,engine:'qwen3-prerecorded',voice:'Mitsukotoba-1202'});
      self.postMessage({type:'complete',requestId:data.requestId,total:1,
        engine:'qwen3-prerecorded',voice:'Mitsukotoba-1202'});
    }
  } catch (error) {
    self.postMessage({type:'error',requestId:data.requestId,message:error?.message || String(error)});
  }
};
