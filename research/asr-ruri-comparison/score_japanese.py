#!/usr/bin/env python3
"""Research comparison Japanese: pyopenjtalk synthesized speech -> Moonshine JA
Small Streaming -> frozen shipped Ruri v3 70M (quantized ONNX) -> Topic/Interaction.
ALSO evaluate original reference transcript (oracle) to isolate ASR degradation.
Not production: different TTS voice and CPU backend from Web/Android.
"""
import argparse, hashlib, json, re, sys, time, unicodedata
from pathlib import Path
import numpy as np
from scipy.signal import resample_poly
from tokenizers import Tokenizer
import onnxruntime as ort

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent/'outputs'
SOURCE=Path(__file__).resolve().parent/'ja22.json'
ASSET=ROOT/'semantic-assets/ruri70-int8-bd500193'
MANIFEST=ROOT/'src/semantic-assets-manifest.json'
INTERACTIONS=['affection','praise','achievement','effort','encouragement','invitation',
              'start','finish','finish_check','care','inquiry','reassurance','repeat',
              'pause','none']
def sha(b):return hashlib.sha256(b).hexdigest()
def normalize(s):return ''.join(c for c in unicodedata.normalize('NFKC',s).casefold() if c.isalnum())
def edit_distance(a,b):
    prev=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        nxt=[i]+[0]*len(b)
        for j,y in enumerate(b,1):nxt[j]=min(prev[j]+1,nxt[j-1]+1,prev[j-1]+(x!=y))
        prev=nxt
    return prev[-1]

class ShippedRuri:
    def __init__(self):
        m=json.loads(MANIFEST.read_text())
        def checked(name):
            file=ASSET/name
            if not file.is_file():raise FileNotFoundError(f'Repository Ruri asset absent: {file}')
            blob=file.read_bytes()
            if sha(blob)!=m['assets'][name]['sha256']:
                raise ValueError(f'Ruri {name} checksum mismatch; refusing benchmark')
            return blob
        self.config=json.loads(checked('heads-config.json'))
        self.tokenizer=Tokenizer.from_str(checked('tokenizer.json').decode('utf8'))
        for phrase in ('ミルクを飲もうね', '絵本を読もうか', 'おはよう'):
            encoded=self.tokenizer.encode(phrase,add_special_tokens=True)
            print('RURI TOKENIZER DIAGNOSTIC',repr(phrase),'ids=',encoded.ids,'tokens=',encoded.tokens,flush=True)
        self.model=ort.InferenceSession(str(ASSET/'model.onnx'),
             providers=['CPUExecutionProvider'])
        checked('model.onnx')
        self.topic_labels=self.config['heads']['topic']['classes']
        self.topic_head=np.frombuffer(checked('head-topic.f32'),dtype='<f4').reshape(22,385).copy()
        self.interaction_head=np.frombuffer(checked('head-interaction.f32'),dtype='<f4').reshape(15,385).copy()
        inputs={x.name for x in self.model.get_inputs()}
        if inputs!={'input_ids','attention_mask'}:raise ValueError(f'Unexpected Ruri inputs {inputs}')
        if set(INTERACTIONS)!=set(INTERACTIONS):raise ValueError('Interaction class definition error')
    def predict(self,text):
        ids=self.tokenizer.encode(text,add_special_tokens=True).ids
        if len(ids)>self.config['max_length']:
            return {'status':'too_long','tokens':len(ids)}
        feed={'input_ids':np.asarray([ids],dtype=np.int64),
              'attention_mask':np.ones((1,len(ids)),dtype=np.int64)}
        out=self.model.run(['sentence_embedding'],feed)[0]
        v=out.reshape(-1).astype(np.float32)
        if v.shape!=(384,):raise ValueError(f'Ruri embedding dimension {v.shape}')
        def classify(head,labels,threshold=None):
            logits=np.dot(head[:,:384],v)+head[:,384]
            p=np.exp(logits-np.max(logits));p/=p.sum()
            ix=int(p.argmax()); sorted_p=np.sort(p)
            margin=float(sorted_p[-1]-sorted_p[-2])
            label=labels[ix]
            if threshold and (p[ix]<threshold['threshold'] or margin<threshold['margin']):label='generic'
            return {'label':label,'raw_label':labels[ix],'probability':float(p[ix]),'margin':margin}
        return {'topic':classify(self.topic_head,self.topic_labels,self.config['topic_thresholds']),
                'interaction':classify(self.interaction_head,INTERACTIONS),
                'tokens':len(ids),'status':'ok'}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--no-asr',action='store_true',help='diagnose tokenizer/Ruri text route only')
    args=ap.parse_args()
    data=json.loads(SOURCE.read_text())
    rows=data['rows']
    if len(rows)!=22 or any(r['language']!='ja' for r in rows):raise ValueError('Japanese test set mismatch')
    model=ShippedRuri()
    OUT.mkdir(parents=True,exist_ok=True)
    if args.no_asr:
        transcripts=[r['text'] for r in rows]
        asr_status='NOT_RUN_ORACLE_ONLY'
        model_info={}
    else:
        import pyopenjtalk
        from moonshine_voice import Transcriber
        from moonshine_voice.download import get_model_for_language, ModelArch
        model_path,arch=get_model_for_language('ja',wanted_model_arch=ModelArch.SMALL_STREAMING)
        if arch!=ModelArch.SMALL_STREAMING:raise ValueError('Selected wrong Moonshine size for JA')
        model_info={'asr':'moonshine-ja-small-streaming','architecture':int(arch),'model_path':str(model_path),
                    'tts':'pyopenjtalk (synthetic, no infant speaker)'}
        transcripts=[]
        with Transcriber(model_path=model_path,model_arch=arch,
              options={'max_tokens_per_second':13.0}) as transcriber:
            for i,r in enumerate(rows,1):
                wav,sr=pyopenjtalk.tts(r['text'])
                wave=np.asarray(wav,dtype=np.float32)
                if np.max(np.abs(wave))>1.0:wave/=32768.0
                from math import gcd
                g=gcd(sr,16000)
                wave=resample_poly(wave,16000//g,sr//g).astype(np.float32)
                # Padding to prevent last words from being truncated.
                wave=np.concatenate([wave,np.zeros(16000,dtype=np.float32)])
                start=time.monotonic()
                transcript=transcriber.transcribe_without_streaming(wave.tolist(),sample_rate=16000)
                hypothesis=' '.join(line.text.strip() for line in transcript.lines if line.text).strip()
                if not hypothesis:raise ValueError(f'No ASR transcript produced for {r["id"]}')
                transcripts.append(hypothesis)
                print(f'MOONSHINE {i}/{len(rows)} {r["id"]} ASR={hypothesis} duration={len(wave)/16000:.2f}s time={time.monotonic()-start:.2f}s',flush=True)
        asr_status='COMPLETED_SYNTHETIC_AUDIO'
    scores=[]
    for r,t in zip(rows,transcripts):
        start=time.monotonic()
        asr_pred=model.predict(t)
        asr_ms=round((time.monotonic()-start)*1000,2)
        oracle=model.predict(r['text'])
        score=dict(r,asr_text=t,asr=asr_pred,oracle=oracle,ruri_elapsed_ms=asr_ms,
                   cer_num=edit_distance(normalize(r['text']),normalize(t)),
                   cer_den=len(normalize(r['text'])))
        scores.append(score)
    report={'status':'RESEARCH_SYNTHETIC_NOT_VERIFIED',
        'pipeline':'Moonshine JA Small Streaming -> Ruri 70M 22 Topic + 15 Interaction',
        'asr_status':asr_status,'model_details':model_info,
        'sample_count':len(scores),'normalization':'NFKC lowercase Unicode alphanumeric CER',
        'reference':{'source':'human-unreviewed translation of multilingual 22 meaning templates'},
        'platform':sys.platform,'onnxruntime_version':ort.__version__,
        'ruri_onnx_sha':json.loads(MANIFEST.read_text())['modelSha']}
    for name in ('oracle','asr'):
        report[name]={}
        for metric in ('topic','interaction','joint'):
            correct=sum((x[name]['topic']['label']==x['topic'] if metric=='topic'
                 else x[name]['interaction']['label']==x['interaction'] if metric=='interaction'
                 else x[name]['topic']['label']==x['topic'] and x[name]['interaction']['label']==x['interaction']) for x in scores)
            report[name][metric]={'correct':correct,'n':len(scores),'accuracy':round(correct/len(scores),4)}
    report['asr']['cer']=round(sum(r['cer_num'] for r in scores)/sum(r['cer_den'] for r in scores),4)
    (OUT/'japanese_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    (OUT/'japanese_predictions.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in scores),encoding='utf8')
    print('JAPANESE MOONSHINE + RURI RESULT\n'+json.dumps(report,ensure_ascii=False,indent=2),flush=True)

if __name__=='__main__':main()
