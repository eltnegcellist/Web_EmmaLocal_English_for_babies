#!/usr/bin/env python3
"""Strict Korean/French ASR->E5 end-to-end research.
Same archived audio across all candidates per language; unreviewed synthetic.
"""
import argparse,hashlib,json,re,sys,time,unicodedata,wave
from pathlib import Path
import numpy as np
import torch
from transformers import AutoModelForSpeechSeq2Seq,AutoProcessor
from huggingface_hub import HfApi
REPO=Path(__file__).resolve().parents[2]
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(REPO/'research/e5-interaction-v3/scripts'))
from train_interaction import FrozenE5,fetch_prod_heads
sys.path.insert(0,str(REPO/'research/asr-ruri-comparison'))
from score_foreign import load_models,pred,edit_distance,norm
SHA=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
CANDIDATES={
 'baseline-ko':('ko','openai/whisper-small','apache-2.0'),
 'ko-specialist':('ko','kimthegarden/whisper-small-ko-new','mit'),
 'baseline-fr':('fr','openai/whisper-small','apache-2.0'),
 'fr-specialist-small':('fr','bofenghuang/whisper-small-cv11-french','apache-2.0'),
 'fr-specialist-medium':('fr','bofenghuang/whisper-medium-french','apache-2.0'),
}
def audio(path):
 with wave.open(str(path),'rb') as f:
  if (f.getnchannels(),f.getsampwidth(),f.getframerate())!=(1,2,16000):
   raise ValueError('Invalid audio format (expected 16k mono PCM16)')
  raw=f.readframes(f.getnframes())
 return np.frombuffer(raw,dtype='<i2').astype(np.float32)/32768.0
def main():
 p=argparse.ArgumentParser()
 p.add_argument('--model',choices=CANDIDATES,required=True)
 p.add_argument('--audio-dir',type=Path,required=True)
 p.add_argument('--candidate-heads',type=Path,required=True)
 p.add_argument('--out',type=Path,default=ROOT/'outputs')
 p.add_argument('--max-clips',type=int,default=22)
 args=p.parse_args()
 lang,model_id,license_expected=CANDIDATES[args.model]
 manifest=json.loads((args.audio_dir/'manifest.json').read_text())
 if manifest['language']!=lang or len(manifest['examples'])!=22 or manifest['human_spoken']:
  raise ValueError('Unexpected speech set')
 if not 1<=args.max_clips<=22:raise ValueError('Invalid clip limit')
 from huggingface_hub import HfApi
 info=HfApi().model_info(model_id)
 license_name=str(info.card_data.license if info.card_data else '').lower()
 if license_name!=license_expected or not info.sha or len(info.sha)!=40:
  raise ValueError(f'License or fixed checkpoint invalid {model_id} {license_name} {info.sha}')
 torch.set_num_threads(2)
 print(f"Loading {model_id} sha={info.sha} license={license_name}",flush=True)
 proc=AutoProcessor.from_pretrained(model_id,revision=info.sha,trust_remote_code=False)
 asr=AutoModelForSpeechSeq2Seq.from_pretrained(model_id,revision=info.sha,
                torch_dtype=torch.float32,low_cpu_mem_usage=True,trust_remote_code=False)
 asr.eval()
 c,heads_v2=fetch_prod_heads(REPO/'multilingual-assets/heads',offline=True)
 labels={a:c['heads'][a]['classes'] for a in ('topic','interaction')}
 candidates=load_models(args.candidate_heads,labels['interaction'])
 e5=FrozenE5(threads=2)
 results=[]
 for i,r in enumerate(manifest['examples'][:args.max_clips],1):
  path=args.audio_dir/r['audio_file']
  if SHA(path)!=r['wav_sha256']:raise ValueError('Audio checksum mismatch '+str(path))
  wave16=audio(path)
  feats=proc(wave16,sampling_rate=16000,return_tensors='pt')
  start=time.monotonic()
  with torch.inference_mode():
   ids=asr.generate(feats.input_features,
     language='korean' if lang=='ko' else 'french',task='transcribe',
     max_new_tokens=100,do_sample=False,num_beams=1)
  decoded=proc.batch_decode(ids,skip_special_tokens=True)[0].strip()
  asr_ms=round((time.monotonic()-start)*1000,2)
  if not decoded:decoded=''
  emb=e5.embed(decoded if decoded else ' ')
  predictions={}
  for variant,head in [('old_v2',heads_v2['interaction']),('new_shared',candidates['shared']),
                       ('new_locale',candidates[lang])]:
   predictions[variant]={
    'topic':pred(heads_v2['topic'],emb,labels['topic']),
    'interaction':pred(head,emb,labels['interaction'])}
  item={**r,'recognized_text':decoded,'asr_inference_ms':asr_ms,
        'cer_edits':edit_distance(norm(r['text']),norm(decoded)),
        'cer_ref_chars':len(norm(r['text'])),
        'predictions':predictions}
  results.append(item)
  print(f"ASR {args.model} {i}/{args.max_clips} CER={item['cer_edits']}/{item['cer_ref_chars']} latency={asr_ms}ms recognized={decoded}",flush=True)
 dest=args.out/args.model;dest.mkdir(parents=True,exist_ok=True)
 aggregates={}
 for variant in ('old_v2','new_shared','new_locale'):
  n=len(results)
  t=sum(x['predictions'][variant]['topic']==x['topic'] for x in results)
  it=sum(x['predictions'][variant]['interaction']==x['interaction'] for x in results)
  both=sum(x['predictions'][variant]['topic']==x['topic'] and x['predictions'][variant]['interaction']==x['interaction'] for x in results)
  aggregates[variant]={'topic_correct':t,'interaction_correct':it,'joint_correct':both,'n':n,
          'topic_rate':round(t/n,4),'interaction_rate':round(it/n,4),'joint_rate':round(both/n,4)}
 summary={'status':'RESEARCH_SYNTHETIC_HUMAN_UNREVIEWED',
  'language':lang,'asr_model':model_id,'asr_revision':info.sha,'license':license_name,
  'audio_source':'fixed Moonshine TTS synthetic, identical within locale',
  'dataset_size':len(results),'audio_not_real_people':True,
  'model_size_large_warning':'Whisper model CPU speed is not browser WASM speed',
  'summary':aggregates,
  'cer':round(sum(x['cer_edits'] for x in results)/sum(x['cer_ref_chars'] for x in results),5),
  'median_asr_inference_ms':float(np.median([r['asr_inference_ms'] for r in results])),
  'p95_asr_inference_ms':float(np.percentile([r['asr_inference_ms'] for r in results],95)),
  'limitations':['22 caregiver meaning templates not independent native caregiver audio',
                 'labels unreviewed and class confusion can be labeling ambiguity',
                 'CPU Linux inference is not Galaxy S25 WASM latency']}
 (dest/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 (dest/'predictions.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in results),encoding='utf8')
 print('END_TO_END_RESEARCH_RESULTS '+json.dumps(summary,ensure_ascii=False,indent=2),flush=True)
if __name__=='__main__':main()
