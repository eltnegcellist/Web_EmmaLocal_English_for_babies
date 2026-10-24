#!/usr/bin/env python3
"""Frozen foreign ASR transcripts (374) -> E5 (common encoder) + shared/localized
Interaction heads, while retaining production Topic. No ASR inference rerun here.
Japanese speech and foreign speech synthesis sources differ; interpret carefully.
"""
import argparse,base64,collections,hashlib,json,sys,time,unicodedata,zlib
from pathlib import Path
import numpy as np
REPO=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(REPO/'research/e5-interaction-v3/scripts'))
from train_interaction import FrozenE5,fetch_prod_heads
H=lambda b:hashlib.sha256(b).hexdigest()
LANGS=('en','de','fr','ko','th','zh','hi')
INPUT_SHA='b3572ef5f290456c05f96a708117c9977d49ba88c022314bfd8549a7857bf410'
def read_data():
    path=REPO/'research/e5-locale-encoders/data/asr374.b85'
    if H(path.read_bytes())!=INPUT_SHA:raise ValueError('Frozen ASR data SHA mismatch')
    obj=json.loads(zlib.decompress(base64.b85decode(''.join(path.read_text().split()))))
    if len(obj['oracles'])!=154 or len(obj['asr'])!=374:raise ValueError('Input count changed')
    oracle={o[0]:dict(id=o[0],lang=o[1],text=o[2],topic=o[3],interaction=o[4]) for o in obj['oracles']}
    asr=[dict(id=x[0],lang=x[1],asr_model=x[2],text=x[3],
              topic=oracle[x[0]]['topic'],interaction=oracle[x[0]]['interaction'],
              gold_text=oracle[x[0]]['text']) for x in obj['asr']]
    assert set(r['lang'] for r in asr)==set(LANGS)
    return list(oracle.values()),asr
def load_models(path,classes):
    meta=json.loads((path/'candidate_manifest.json').read_text())
    if set(meta)!={'shared',*LANGS}:raise ValueError('Unexpected candidate language set')
    heads={}
    for lang in ('shared',*LANGS):
        d=meta[lang]['interaction'];blob=(path/d['file']).read_bytes()
        if H(blob)!=d['sha256'] or d['shape']!=[15,385] or d['classes']!=classes:
            raise ValueError(f'Candidate interaction head invalid {lang}')
        heads[lang]=np.frombuffer(blob,dtype='<f4').reshape(15,385).copy()
    return heads
def pred(w,e,classes):
    z=w[:,:384]@e+w[:,384];return classes[int(z.argmax())]
def norm(t):return ''.join(c for c in unicodedata.normalize('NFKC',t).casefold() if c.isalnum())
def edit_distance(a,b):
    d=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        n=[i]+[0]*len(b)
        for j,y in enumerate(b,1):n[j]=min(d[j]+1,n[j-1]+1,d[j-1]+(x!=y))
        d=n
    return d[-1]
def scores(subset,variant):
    n=len(subset)
    def metrics(axis):
        c=sum(r['predictions'][variant][axis]==r[axis] for r in subset)
        return {'correct':c,'n':n,'accuracy':round(c/n,4)}
    both=sum(r['predictions'][variant]['topic']==r['topic'] and
             r['predictions'][variant]['interaction']==r['interaction'] for r in subset)
    return {'n':n,'topic':metrics('topic'),'interaction':metrics('interaction'),
            'joint':{'correct':both,'n':n,'accuracy':round(both/n,4)}}
def main():
    p=argparse.ArgumentParser()
    p.add_argument('--candidates',type=Path,required=True)
    args=p.parse_args()
    c,old=fetch_prod_heads(REPO/'multilingual-assets/heads',offline=True)
    labels={axis:c['heads'][axis]['classes'] for axis in ('topic','interaction')}
    heads=load_models(args.candidates,labels['interaction'])
    oracle,asr=read_data()
    e5=FrozenE5(threads=2)
    alltexts=list(dict.fromkeys(r['text'] for r in oracle+asr))
    embeddings={}
    for k,text in enumerate(alltexts,1):
        embeddings[text]=e5.embed(text)
        if k%100==0:print(f'Embedded foreign {k}/{len(alltexts)}',flush=True)
    for r in oracle+asr:
        e=embeddings[r['text']]
        topic=pred(old['topic'],e,labels['topic'])
        r['predictions']={}
        for name,w in (('v2',old['interaction']),
                       ('shared',heads['shared']),('local',heads[r['lang']])):
            r['predictions'][name]={'topic':topic,'interaction':pred(w,e,labels['interaction'])}
        if 'asr_model' in r:
            r['cer_edits']=edit_distance(norm(r['text']),norm(r['gold_text']))
            r['cer_ref_characters']=len(norm(r['gold_text']))
    variants=['v2','shared','local']
    summary={}
    for lang in LANGS:
        summary[lang]={}
        oracle_lang=[r for r in oracle if r['lang']==lang]
        for model in sorted(set(r['asr_model'] for r in asr if r['lang']==lang)):
            grp=[r for r in asr if r['lang']==lang and r['asr_model']==model]
            summary[lang][model]={
                'score':{v:scores(grp,v) for v in variants},
                'cer':round(sum(r['cer_edits'] for r in grp)/sum(r['cer_ref_characters'] for r in grp),4),
                'oracle_22':{v:scores(oracle_lang,v) for v in variants}}
    total={v:scores(asr,v) for v in variants}
    out=HERE/'outputs';out.mkdir(parents=True,exist_ok=True)
    result={'data':'374 ASR transcriptions from synthetic audio; 154 oracle; 22 meaning families per language',
           'status':'NATIVE_LINUX_SYNTHETIC_NOT_DEPLOYABLE',
           'asr_inference':'NOT_REPEATED; frozen recognized text from earlier ASR benchmark',
           'meanings_per_language':22,
           'model':'Pinned Xenova multilingual E5 small quantized ONNX; v2 Topic and frozen shared/per-language Interaction heads',
           'runtime':'Linux native CPU, not the Web WASM runtime',
           'source_asr_sha256':INPUT_SHA,'candidate_source_actions_run':40073281853,
           'per_language_asr':summary,'all_asr_374':total}
    (out/'foreign_asr_comparison.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    (out/'foreign_asr_predictions.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in asr),encoding='utf8')
    print('FOREIGN ASR+E5 RESULTS '+json.dumps({l:{m:{'topic':v['score']['local']['topic'],'interaction':v['score']['local']['interaction'],
                 'joint':v['score']['local']['joint'],'cer':v['cer']} for m,v in values.items()}
                  for l,values in summary.items()},ensure_ascii=False,indent=2),flush=True)
if __name__=='__main__':main()
