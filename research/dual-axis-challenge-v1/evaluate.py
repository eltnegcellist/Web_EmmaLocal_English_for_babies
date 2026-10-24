#!/usr/bin/env python3
"""Fixed-head, unseen synthetic challenge. Never train or tune with these rows."""
import argparse, collections, csv, hashlib, json, sys, unicodedata
from pathlib import Path
import numpy as np

REPO=Path(__file__).resolve().parents[2]
BASE=Path(__file__).resolve().parent
sys.path.insert(0,str(REPO/'research/e5-interaction-v3/scripts'))
from train_interaction import FrozenE5, fetch_prod_heads

LANGS=('en','de','fr','ko','th','zh','hi')
SHA=lambda blob:hashlib.sha256(blob).hexdigest()
NORM=lambda s:''.join(c for c in unicodedata.normalize('NFKC',s).casefold() if c.isalnum())
# Pinned from the completed 2026-10-24 Actions run 40073281853
EXPECTED_HEADS={
'shared':'d2ebc327c052b487c84ad92eac8bef767186c694a0d16d8b4df72f367688c160',
'en':'21e6d43cbef28d5384876a7b8f01ae8526ad7d2c30021bc30960df8a598c0f70',
'de':'51af39d0893165fba086535707b3d3ae612175052d36935a212dc6095f0fa062',
'fr':'8bb8881bfaedcaae988601246ba6d191e44c6f999dd2ad7585bece12ed3b40f2',
'ko':'f12b5f6fb85c2c93619b15a59e2517106af4538bcf12e0f12b5ad97a65b61bf5',
'th':'0ab604ec67fa59872feac510b152eda6f7df022f5163d293a331bd71288aefdf',
'zh':'d3e127bc76977cd953fbd552ef3b319b4b6b6532ca6b6f7aa02d45ec1dba5031',
'hi':'72ec14faf48598c2d1bec3b4d6753731f033c3db9a100c919b16d6ef02e138a1'
}

def read_challenge(path,expected_topics,expected_intents):
    payload=json.loads(path.read_text(encoding='utf-8'))
    if payload.get('schema')!=1 or not payload.get('training_excluded'):
        raise ValueError('Unexpected challenge schema or training flag')
    rows=payload['rows']
    if len(rows)!=154:raise ValueError('Exactly 154 challenge rows required')
    if len({r['id'] for r in rows})!=154:raise ValueError('Duplicate challenge IDs')
    if len({r['language'] for r in rows})!=7:raise ValueError('Missing locale')
    for lang in LANGS:
        loc=[r for r in rows if r['language']==lang]
        if len(loc)!=22:raise ValueError('Expected 22 rows per locale')
        if set(r['topic'] for r in loc)!=set(expected_topics):
            raise ValueError('Challenge missing a Topic label for '+lang)
        if set(r['interaction'] for r in loc)!=set(expected_intents):
            raise ValueError('Challenge missing an Interaction label for '+lang)
    if any(r.get('reviewed') or r.get('native_speaker_reviewed') for r in rows):
        raise ValueError('Human review claim not validated')
    return rows

def verify_overlap(rows,existing):
    old=[json.loads(x) for x in existing.read_text(encoding='utf-8').splitlines() if x.strip()]
    old_keys={(r['language'],NORM(r['text'])) for r in old}
    current={(r['language'],NORM(r['text'])) for r in rows}
    if len(current)!=len(rows):raise ValueError('Duplicate challenge normalized texts')
    overlap=current&old_keys
    if overlap:raise ValueError(f'Challenge literal collision with research corpus: {len(overlap)}')
    return {'same_normalized_text_collision':0,
            'warning':'Exact-text check only; semantic paraphrases and templated translations are not independently decontaminated'}

def load_candidates(folder,classes):
    manifest=json.loads((folder/'candidate_manifest.json').read_text(encoding='utf-8'))
    if set(manifest)!=set(EXPECTED_HEADS):
        raise ValueError('Incorrect head artifact keys')
    heads={}
    for locale,expected_hash in EXPECTED_HEADS.items():
        head=manifest[locale]['interaction']
        if head['sha256']!=expected_hash or head['shape']!=[15,385] or head['classes']!=classes['interaction']:
            raise ValueError('Candidate interaction head manifest differs from frozen candidate')
        path=folder/head['file']
        blob=path.read_bytes()
        if SHA(blob)!=expected_hash:raise ValueError('Candidate model binary integrity mismatch')
        value=np.frombuffer(blob,dtype='<f4').reshape(15,385).copy()
        if not np.isfinite(value).all():raise ValueError('Non-finite weight')
        heads[locale]=value
    return heads

def pred(W,emb,classes):
    scores=emb@W[:,:-1].T + W[:,-1]
    return classes[int(np.argmax(scores))]

def summary(rows,model):
    aggregate={}
    for group,rs in [('all',rows)]+[(l,[r for r in rows if r['language']==l]) for l in LANGS]:
        item={'n':len(rs)}
        for axis in ['topic','interaction']:
            num=sum(r[axis]==r['predictions'][model][axis] for r in rs)
            item[axis]={'correct':num,'n':len(rs),'accuracy':round(num/len(rs),5)}
        num=sum(all(r[a]==r['predictions'][model][a] for a in ('topic','interaction')) for r in rs)
        item['joint']={'correct':num,'n':len(rs),'accuracy':round(num/len(rs),5)}
        aggregate[group]=item
    return aggregate

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--challenge',type=Path,default=BASE/'data/fresh154.json')
    p.add_argument('--candidates',type=Path,required=True)
    p.add_argument('--train-corpus',type=Path,default=REPO/'research/dual-axis-v1/outputs/starter_corpus.jsonl')
    p.add_argument('--output',type=Path,default=BASE/'outputs')
    a=p.parse_args()
    conf,old=fetch_prod_heads(REPO/'multilingual-assets/heads',offline=True)
    classes={axis:conf['heads'][axis]['classes'] for axis in ('topic','interaction')}
    rows=read_challenge(a.challenge,classes['topic'],classes['interaction'])
    leakage=verify_overlap(rows,a.train_corpus)
    heads=load_candidates(a.candidates,classes)
    frozen=FrozenE5(threads=2)
    cache={}
    for i,r in enumerate(rows,1):
        cache[r['id']]=frozen.embed(r['text'])
        if i%25==0:print(f'FROZEN CHALLENGE EMBED {i}/{len(rows)}',flush=True)
    arms=('v2','v2topic_newshared','v2topic_newlocale')
    for r in rows:
        e=cache[r['id']]
        tp=pred(old['topic'],e,classes['topic'])
        its={'v2':old['interaction'],
             'v2topic_newshared':heads['shared'],
             'v2topic_newlocale':heads[r['language']]}
        r['predictions']={name:{'topic':tp,'interaction':pred(w,e,classes['interaction'])}
                          for name,w in its.items()}
    results={m:summary(rows,m) for m in arms}
    # Paired comparisons, without statistical claims on dependent translations.
    changes={}
    for m in arms[1:]:
        wins=losses=0
        for r in rows:
            a0=all(r[x]==r['predictions']['v2'][x] for x in ('topic','interaction'))
            a1=all(r[x]==r['predictions'][m][x] for x in ('topic','interaction'))
            wins+=bool(a1 and not a0)
            losses+=bool(a0 and not a1)
        changes[m]={'new_correct_old_incorrect':wins,
                    'new_incorrect_old_correct':losses,'net':wins-losses}
    a.output.mkdir(parents=True,exist_ok=True)
    out={
        'status':'RESEARCH_SYNTHETIC_UNREVIEWED_NOT_DEPLOYABLE',
        'source_commit_for_weights':'bb5ddf5ab8f3c65c7d27f1eeff82cbeddc06516e',
        'candidate_actions_run':40073281853,
        'dataset_sha256':SHA(a.challenge.read_bytes()),
        'encoder_sha256':frozen.model_sha,
        'candidate_interaction_hashes':EXPECTED_HEADS,
        'leakage':leakage,
        'evaluation':'fixed prior trained weights; no training/tuning on challenge',
        'limitations':[
          'New examples authored by AI and never reviewed by native speakers',
          'Cross-language versions share 22 meaning families; do not treat 154 as independent',
          'No human speech/audio or ASR error measured',
          'Labels reflect provisional intent policy and may be ambiguous',
          'No new unseen-test results should be used to tune a new candidate and then called independent'],
        'summary':results,'paired_joints':changes}
    (a.output/'comparison.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    with (a.output/'predictions.jsonl').open('w',encoding='utf-8') as f:
        for r in rows:f.write(json.dumps(r,ensure_ascii=False)+'\n')
    print('FROZEN FRESH CHALLENGE RESULTS\n'+json.dumps(
       {'summary':{m:results[m]['all'] for m in arms},'paired':changes},ensure_ascii=False,indent=2),flush=True)

if __name__=='__main__':main()
