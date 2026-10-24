#!/usr/bin/env python3
"""EXPERIMENTAL retraining of the 15-class CooTrio Interaction FP32 LR head.

- Does not train E5's encoder or Topic head.
- Uses NEW 360-sentence provisional corpus only for train/validation.
- Loads old production head for read-only baseline comparisons.
- Locked 154 evaluation examples are inference-only diagnostics; never fit/tune on them.
- Writes an isolated research artifact; never overwrites production files.
"""
import argparse, csv, hashlib, json, sys, time
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
REV='761b726dd34fb83930e26aab4e9ac3899aa1fa78'
MODEL_ID='Xenova/multilingual-e5-small'
MODEL_SHA='f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193'
PROD_HEAD_BASE=None  # Use immutable checked-out production assets, not mutable main URL


def load_rows(path):
    with open(path,encoding='utf-8') as f:return [json.loads(line) for line in f if line.strip()]

def sha(b): return hashlib.sha256(b).hexdigest()

def fetch_prod_heads(folder,offline=False):
    # Baseline is read-only and pinned by the workflow's checkout commit.
    # Never download a mutable baseline or overwrite production heads.
    def get(name):
        p=folder/name
        if not p.is_file():
            raise FileNotFoundError(f'Checked-out production head asset missing: {p}')
        return p.read_bytes()
    conf=json.loads(get('config.json'))
    if conf.get('encoder_revision')!=REV or conf.get('prefix')!='query: ' or conf.get('max_length')!=512:
        raise ValueError('Production E5 configuration/revision mismatch')
    if conf['heads']['interaction']['shape'] != [15,385]: raise ValueError('Unexpected production head shape')
    heads={}
    for axis,item in conf['heads'].items():
        blob=get(item['file'])
        if sha(blob)!=item['sha256']:raise ValueError(f'SHA256 mismatch for {axis} head')
        heads[axis]=np.frombuffer(blob,dtype='<f4').reshape(item['shape']).copy()
    return conf,heads

class FrozenE5:
    def __init__(self,threads=4,offline=False):
        import onnxruntime as ort
        from transformers import AutoTokenizer
        from huggingface_hub import hf_hub_download
        self.tokenizer=AutoTokenizer.from_pretrained(MODEL_ID,revision=REV,local_files_only=offline)
        path=hf_hub_download(repo_id=MODEL_ID,filename='onnx/model_quantized.onnx',revision=REV,local_files_only=offline)
        self.model_sha=sha(Path(path).read_bytes())
        if self.model_sha!=MODEL_SHA:raise ValueError('Frozen E5 ONNX checksum mismatch')
        opt=ort.SessionOptions();opt.intra_op_num_threads=threads
        self.session=ort.InferenceSession(path,sess_options=opt,providers=['CPUExecutionProvider'])
    def embed(self,text):
        tok=self.tokenizer('query: '+text,return_tensors='np',truncation=True,max_length=512)
        feed={i.name:tok[i.name].astype(np.int64) for i in self.session.get_inputs()}
        arr=self.session.run(None,feed)[0]
        if arr.ndim!=3 or arr.shape[-1]!=384:raise ValueError(f'Unexpected E5 output {arr.shape}')
        mask=tok['attention_mask'][...,None].astype(np.float32)
        emb=((arr*mask).sum(axis=1)/np.maximum(mask.sum(axis=1),1))[0]
        emb=emb/max(float(np.linalg.norm(emb)),1e-12)
        return emb.astype(np.float32)


def evaluate(x,rows,weights,classes,subset):
    logits=x@weights[:,:384].T + weights[:,384]
    preds=[classes[int(i)] for i in logits.argmax(axis=1)]
    result={'n':len(rows),'accuracy':round(sum(preds[i]==r['interaction'] for i,r in enumerate(rows))/max(1,len(rows)),4),'by_language':{},'confusions':{}}
    for lang in sorted(set(r['language'] for r in rows)):
        ids=[i for i,r in enumerate(rows) if r['language']==lang]
        result['by_language'][lang]={'n':len(ids),'correct':sum(preds[i]==rows[i]['interaction'] for i in ids),'accuracy':round(sum(preds[i]==rows[i]['interaction'] for i in ids)/len(ids),4)}
    conf={}
    for r,pred in zip(rows,preds):
        if pred!=r['interaction']:
            key=f"{r['interaction']} -> {pred}";conf[key]=conf.get(key,0)+1
    result['confusions']=dict(sorted(conf.items(),key=lambda x:-x[1])[:15])
    result['examples']=[{'id':r['id'],'language':r['language'],'text':r['text'],'gold':r['interaction'],'predicted':p} for r,p in zip(rows,preds) if p!=r['interaction']][:25]
    result['name']=subset
    return result


def read_external_eval(path):
    with open(path,encoding='utf-8-sig',newline='') as f:
        data=list(csv.DictReader(f))
    rows=[]
    for row in data:
        rows.append({'id':row['id'],'language':row['language'],'text':row['reference_text'],
          'interaction':row['gold_interaction'],'label_source':'unreviewed_original_154'})
    if len(rows)!=154:raise ValueError(f'Locked external evaluation expected 154, got {len(rows)}')
    return rows


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--allow-unreviewed',action='store_true',help='Explicitly allow this RESEARCH-ONLY experiment on provisional labels.')
    ap.add_argument('--offline',action='store_true')
    ap.add_argument('--threads',type=int,default=4)
    ap.add_argument('--corpus',type=Path,default=ROOT/'data/interaction_v3_training.jsonl')
    ap.add_argument('--locked-test',type=Path,default=ROOT/'data/locked_154.csv')
    ap.add_argument('--head-cache',type=Path,default=ROOT.parent.parent/'multilingual-assets/heads')
    ap.add_argument('--out',type=Path,default=ROOT/'outputs/research-only')
    args=ap.parse_args()
    if not args.allow_unreviewed:
        raise SystemExit('Refusing to train on provisional multilingual labels without --allow-unreviewed. No production artifacts modified.')
    rows=load_rows(args.corpus)
    if len(rows)!=360:raise ValueError('Unexpected training corpus size')
    classes=sorted(set(r['interaction'] for r in rows))
    conf,baseline_heads=fetch_prod_heads(args.head_cache,args.offline)
    prod_classes=conf['heads']['interaction']['classes']
    if set(classes)!=set(prod_classes):raise ValueError('Class-order mismatch with production')
    train=[r for r in rows if r['split']=='train'];val=[r for r in rows if r['split']=='validation']
    if len(train)!=225 or len(val)!=135:raise ValueError('Unexpected train/validation counts')
    if {r['family_id'] for r in train} & {r['family_id'] for r in val}:
        raise ValueError('Semantic family leaked from training into validation')
    external=read_external_eval(args.locked_test)
    import unicodedata,re
    def norm(x):return re.sub(r'[^\w]+','',unicodedata.normalize('NFKC',x).casefold())
    train_strings={(r['language'],norm(r['text'])) for r in train}
    if any((r['language'],norm(r['text'])) in train_strings for r in external):raise ValueError('Evaluation text leaked into training')
    e5=FrozenE5(args.threads,args.offline)
    all_rows=train+val+external
    t=time.time();embeddings=[]
    for i,r in enumerate(all_rows,1):
        embeddings.append(e5.embed(r['text']))
        if i % 50==0:print(f'Embedded {i}/{len(all_rows)} utterances',flush=True)
    embeddings=np.stack(embeddings)
    x_train=embeddings[:len(train)]; x_val=embeddings[len(train):len(train)+len(val)];x_external=embeddings[len(train)+len(val):]
    from sklearn.linear_model import LogisticRegression
    clf=LogisticRegression(C=1.0,max_iter=4000,solver='lbfgs',random_state=20261024)
    clf.fit(x_train,np.array([r['interaction'] for r in train]))
    if set(clf.classes_)!=set(prod_classes):raise ValueError('Training did not cover all 15 classes')
    ordering=[list(clf.classes_).index(c) for c in prod_classes]
    weights=np.concatenate([clf.coef_[ordering],clf.intercept_[ordering,None]],axis=1).astype('<f4')
    if weights.shape!=(15,385):raise ValueError('Exported head shape wrong')
    old=baseline_heads['interaction']
    reports={
      'train':{'baseline':evaluate(x_train,train,old,prod_classes,'train'),'candidate':evaluate(x_train,train,weights,prod_classes,'train')},
      'validation':{'baseline':evaluate(x_val,val,old,prod_classes,'validation'),'candidate':evaluate(x_val,val,weights,prod_classes,'validation')},
      'locked154_unreviewed_diagnostic':{'baseline':evaluate(x_external,external,old,prod_classes,'locked154'),'candidate':evaluate(x_external,external,weights,prod_classes,'locked154')}
    }
    args.out.mkdir(parents=True,exist_ok=True)
    blob=weights.tobytes();(args.out/'interaction.candidate.f32').write_bytes(blob)
    manifest={'artifact_status':'RESEARCH_ONLY_NOT_APPROVED','trained_encoder':False,'source_model':MODEL_ID,'encoder_revision':REV,'encoder_model_sha256':MODEL_SHA,'training_examples':len(train),'validation_examples':len(val),'external_locked154_examples':len(external),'class_order':prod_classes,'class_count':15,'head_shape':[15,385],'head_sha256':sha(blob),'topic_head_changed':False,'model_family':'multinomial LogisticRegression lr head','regularization_C':1.0,'train_source':'new_author_generated_unreviewed','language_scope':sorted(set(r['language'] for r in all_rows)),'heldout_154_used_for_training':False,'feature_prefix':'query: ','pooling':'mean','normalize':True,'backend':'native ONNX Runtime CPU','elapsed_seconds':round(time.time()-t,2)}
    (args.out/'candidate_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (args.out/'comparison.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'manifest':manifest,'score_summary':{k:{who:round(block['accuracy']*100,1) for who,block in pair.items()} for k,pair in reports.items()}},ensure_ascii=False,indent=2))
    print('RESEARCH ONLY: DO NOT DEPLOY. Review native translations, interaction labels, and Web WASM equivalence.')
if __name__=='__main__':main()
