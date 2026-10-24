#!/usr/bin/env python3
"""Compare matched synthetic Korean input under Vosk vs previously measured Whisper.
Published values are native Linux CPU runner measurements, not matched hardware IDs.
"""
import argparse,json
from pathlib import Path
def main():
 p=argparse.ArgumentParser()
 p.add_argument('--vosk-summary',type=Path,required=True)
 p.add_argument('--whisper-summary',type=Path,required=True)
 p.add_argument('--output',type=Path,required=True)
 a=p.parse_args()
 v=json.loads(a.vosk_summary.read_text(encoding='utf8'))
 w=json.loads(a.whisper_summary.read_text(encoding='utf8'))
 if v['language']!='ko' or w['language']!='ko' or w['dataset_size']!=22 or v['scores']['local']['n']!=22:
  raise ValueError('Korean experiment mismatch')
 if w['asr_model']!='openai/whisper-small' or w['audio_source']!='fixed Moonshine TTS synthetic, identical within locale':
  raise ValueError('Unexpected archived Whisper model or audio provenance')
 vmed=v['speed']['asr_ms']['median'];v95=v['speed']['asr_ms']['p95']
 wmed=w['median_asr_inference_ms'];w95=w['p95_asr_inference_ms']
 score={
  'language':'ko','sample_count':22,
  'compared_models':['vosk-model-small-ko-0.22','openai/whisper-small'],
  'input_audio':'same 22 immutable Moonshine TTS-generated WAV clips in Korean; compared on separate GitHub Actions Linux x86_64 runners',
  'asr_latency_definition':'wall-clock time after ASR model load, including generation/decoding or KaldiRecognizer creation and finalization; no audio capture or TTS',
  'vosk':{'median_ms':vmed,'p95_ms':v95,
          'median_rtf':v['speed']['realtime_factor']['median'],
          'p95_rtf':v['speed']['realtime_factor']['p95'],
          'cer':v['cer'],'both_correct_22':v['scores']['local']['joint_correct'],
          'end_to_end_e5_median_ms':v['speed']['asr_plus_e5_and_heads_ms']['median'],
          'end_to_end_e5_p95_ms':v['speed']['asr_plus_e5_and_heads_ms']['p95'],
          'cold_asr_model_load_ms':v['speed']['asr_model_load_ms']},
  'whisper':{'median_ms':wmed,'p95_ms':w95,
             'cer':w['cer'],'both_correct_22':w['summary']['new_locale']['joint_correct']},
  'whisper_divided_by_vosk_median_speed_ratio':round(wmed/vmed,3) if vmed else None,
  'whisper_divided_by_vosk_p95_ratio':round(w95/v95,3) if v95 else None,
  'limitations':['Different GitHub runners; comparison is approximate despite same audio bytes',
                 'Whisper speed is PyTorch native CPU; Vosk speed is Kaldi native CPU, not mobile WASM',
                 'Whisper report did not include E5 end-to-end latency, so do not impute it',
                 'Unreviewed translated synthetic caregiver utterances; not device-ready']}
 a.output.parent.mkdir(parents=True,exist_ok=True)
 a.output.write_text(json.dumps(score,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('KOREAN MATCHED INPUT ASR SPEED COMPARISON\n'+json.dumps(score,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
