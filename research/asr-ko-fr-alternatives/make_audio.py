#!/usr/bin/env python3
"""Prepare comparable Korean and French synthetic voice clips, one frozen set/language.
Do not claim new TTS audio matches historical ASR recordings acoustically.
"""
import argparse,base64,hashlib,json,os,tarfile,wave,zlib
from pathlib import Path
import numpy as np
from scipy.signal import resample_poly
from moonshine_voice import TextToSpeech
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
DATA=ROOT/'research/e5-locale-encoders/data/asr374.b85'
SHA=lambda b:hashlib.sha256(b).hexdigest()
EXPECTED='b3572ef5f290456c05f96a708117c9977d49ba88c022314bfd8549a7857bf410'
def main():
  ap=argparse.ArgumentParser()
  ap.add_argument('--lang',choices=['ko','fr'],required=True)
  ap.add_argument('--out',type=Path,default=HERE/'outputs')
  args=ap.parse_args()
  if SHA(DATA.read_bytes())!=EXPECTED:raise ValueError('Frozen foreign 22 meaning/oracle archive changed')
  obj=json.loads(zlib.decompress(base64.b85decode(''.join(DATA.read_text().split()))))
  rows=[{'id':str(row[0]),'language':row[1],'text':row[2],
         'topic':row[3],'interaction':row[4]} for row in obj['oracles'] if row[1]==args.lang]
  if len(rows)!=22:raise ValueError('Expected exactly 22 different meaning references')
  out=args.out/args.lang;out.mkdir(parents=True,exist_ok=True)
  synthesizer=TextToSpeech().language('ko-kr' if args.lang=='ko' else 'fr-fr')
  synthesizer.load()
  meta=[]
  for idx,row in enumerate(rows):
    samples,sample_rate=synthesizer.synthesize(row['text'])
    samples=np.asarray(samples,dtype=np.float32).reshape(-1)
    if np.any(~np.isfinite(samples)) or not len(samples):raise ValueError('Invalid TTS audio')
    if np.max(abs(samples))>1.0:samples/=32768.0
    from math import gcd
    g=gcd(sample_rate,16000)
    pcm=resample_poly(samples,16000//g,sample_rate//g).astype(np.float32)
    pcm=np.concatenate([pcm,np.zeros(4800,dtype=np.float32)])
    name=f"{idx:02d}-{row['id'].replace('/','_')}.wav"
    path=out/name
    with wave.open(str(path),'wb') as f:
      f.setnchannels(1);f.setsampwidth(2);f.setframerate(16000)
      f.writeframes((pcm.clip(-1,1)*32767).astype('<i2').tobytes())
    meta.append({**row,'audio_file':name,'wav_sha256':SHA(path.read_bytes()),
                 'duration_seconds':round(len(pcm)/16000,3)})
    print(f"{args.lang} TTS {idx+1}/22 {row['id']} {len(pcm)/16000:.2f}s",flush=True)
  (out/'manifest.json').write_text(json.dumps({'source':'Moonshine TTS research synthetic','human_spoken':False,
     'human_labels_verified':False,'language':args.lang,'examples':meta},ensure_ascii=False,indent=2)+'\n')
  print('SYNTHETIC_AUDIO_READY '+str(len(meta)),flush=True)
if __name__=='__main__':main()
