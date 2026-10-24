#!/usr/bin/env python3
"""Research-only training of TWO independent CooTrio classification heads.

Explicitly provisional synthetic labels, no native-human reviews.
Frozen 154+374 benchmarks are neither used for training nor for selection.
Native Linux measurements MUST NOT be described as Mac/Web/mobile performance.
"""
import argparse, collections, hashlib, json, platform, sys, time
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression
import onnxruntime, sklearn

REPO=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(REPO/'research/e5-interaction-v3/scripts'))
from train_interaction import FrozenE5, fetch_prod_heads

LANGUAGES=('en','de','fr','ko','th','zh','hi')
AXES=('topic','interaction')
SHA=lambda b:hashlib.sha256(b).hexdigest()

def load_corpus(file):
    rows=[json.loads(x) for x in file.read_text(encoding='utf-8').splitlines() if x.strip()]
    if len(rows)<1750 or len(rows)>1816:raise ValueError(f'Unexpected provisional corpus rows: {len(rows)}')
    if len({r['id'] for r in rows})!=len(rows):raise ValueError('Duplicate row ID')
    if any(r['language'] not in LANGUAGES or r['split'] not in ('train','validation') for r in rows):
        raise ValueError('Unknown locale or split')
    if any(r.get('label_reviewed') or r.get('native_speaker_reviewed') for r in rows):
        raise ValueError('This research experiment explicitly expects unreviewed seeds only')
    splits={}
    for r in rows:
        group=r.get('contrast_group') or r['semantic_family']
        splits.setdefault(group,set()).add(r['split'])
    leaked=[g for g,v in splits.items() if len(v)!=1]
    if leaked:raise ValueError('Leakage in semantic family: '+str(leaked[:10]))
    paired=[r for r in rows if r['topic'] is not None and r['interaction'] is not None]
    if len(paired)<900:raise ValueError('Missing joint labeled examples')
    return rows

def fit(rows,features,classes,axis,weights=None):
    if not rows:raise ValueError('Empty fit')
    y=np.array([r[axis] for r in rows])
    if set(y)!=set(classes):
        raise ValueError(f'Missing {axis} classes: {sorted(set(classes)-set(y))}')
    x=np.stack([features[r['text']] for r in rows]).astype(np.float32)
    lr=LogisticRegression(C=1.0,solver='lbfgs',max_iter=1600,random_state=20261024)
    lr.fit(x,y,sample_weight=weights)
    order=[list(lr.classes_).index(cls) for cls in classes]
    head=np.concatenate([lr.coef_[order],lr.intercept_[order,None]],axis=1).astype('<f4')
    if head.shape!=(len(classes),385) or not np.isfinite(head).all():
        raise ValueError('Invalid trained E5 head')
    return head

def predict(head,features,rows,classes):
    if not rows:return []
    x=np.stack([features[r['text']] for r in rows]).astype(np.float32)
    scores=x@head[:,:384].T + head[:,384]
    return [classes[int(v)] for v in np.argmax(scores,axis=1)]

def fraction(n,d):
    return round(n/d,5) if d else None

def evaluate(rows,heads,features,labels):
    ans={}
    for axis in AXES:
        labeled=[r for r in rows if r[axis] is not None]
        pp=predict(heads[axis],features,labeled,labels[axis])
        correct=sum(r[axis]==p for r,p in zip(labeled,pp))
        ans[axis]={'n':len(labeled),'correct':correct,'accuracy':fraction(correct,len(labeled))}
    joint=[r for r in rows if r['topic'] is not None and r['interaction'] is not None]
    tp=predict(heads['topic'],features,joint,labels['topic'])
    it=predict(heads['interaction'],features,joint,labels['interaction'])
    correct=sum(r['topic']==a and r['interaction']==b for r,a,b in zip(joint,tp,it))
    ans['joint']={'n':len(joint),'correct':correct,'accuracy':fraction(correct,len(joint))}
    return ans

def weights_per_language_class(rows,axis,classes,within_locale):
    """Keep class weights equal; global model also balances all 7 locales.

    Applies no heldout-derived hyperparameter fitting.
    """
    counts=collections.Counter((r['language'],r[axis]) for r in rows)
    if within_locale:
        keys={(r['language'],r[axis]) for r in rows}
        expected=len(classes)
    else:
        keys={(lang,cls) for lang in LANGUAGES for cls in classes}
        expected=len(classes)*len(LANGUAGES)
    if len(keys)!=expected or any(counts[key]==0 for key in keys):
        raise ValueError(f'Not all {axis} language-class pairs present in training')
    out=np.array([len(rows)/(expected*counts[(r['language'],r[axis])])
                  for r in rows],dtype=np.float64)
    if abs(float(out.sum())-len(rows))>0.0001:
        raise ValueError('Unexpected sample-weight normalization')
    return out

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--allow-unreviewed',action='store_true')
    p.add_argument('--corpus',type=Path,default=HERE/'outputs/starter_corpus.jsonl')
    p.add_argument('--out',type=Path,default=HERE/'outputs/provisional_heads')
    args=p.parse_args()
    if not args.allow_unreviewed:
        raise SystemExit('Refusing synthetic model training without --allow-unreviewed')
    rows=load_corpus(args.corpus)
    conf,base=fetch_prod_heads(REPO/'multilingual-assets/heads',offline=True)
    labels={k:conf['heads'][k]['classes'] for k in AXES}
    if len(labels['topic'])!=22 or len(labels['interaction'])!=15:
        raise ValueError('Unexpected production labels')
    for axis in AXES:
        for r in rows:
            if r[axis] is not None and r[axis] not in labels[axis]:
                raise ValueError('Invalid '+axis+' label')
    train=[r for r in rows if r['split']=='train']
    validation=[r for r in rows if r['split']=='validation']
    if not validation:raise ValueError('No held-out scenes for diagnostic')
    # No locked 154/374 is loaded here at all. Research training uses only
    # project-generated provisional examples and existing read-only head.
    t=time.monotonic()
    encoder=FrozenE5(threads=2)
    distinct=list(dict.fromkeys(r['text'] for r in rows))
    features={}
    for n,word in enumerate(distinct,1):
        features[word]=encoder.embed(word)
        if n%200==0:print(f'E5 embedded {n}/{len(distinct)}',flush=True)
    print(f'E5 embedding completed {len(distinct)} unique texts in {time.monotonic()-t:.1f}s',flush=True)
    learned={}
    for axis in AXES:
        subset=[r for r in train if r[axis] is not None]
        # Balance both language and class. This particularly protects Topic
        # classes that have only the two original seed examples during the
        # held-out-scene synthetic test.
        sw=weights_per_language_class(subset,axis,labels[axis],within_locale=False)
        learned[axis]=fit(subset,features,labels[axis],axis,sw)
        print(f'Fitted globally balanced {axis}: {len(subset)} rows',flush=True)
    locale_heads={}
    for lang in LANGUAGES:
        locale_heads[lang]={}
        for axis in AXES:
            subset=[r for r in train if r['language']==lang and r[axis] is not None]
            w=weights_per_language_class(subset,axis,labels[axis],within_locale=True)
            locale_heads[lang][axis]=fit(subset,features,labels[axis],axis,w)
        print(f'Fitted local heads {lang}',flush=True)

    by_locale={};all_preds=[]
    arm_names=('baseline_v2','retrained_shared','retrained_locale',
               'hybrid_v2topic_shared_interaction','hybrid_v2topic_locale_interaction')
    global_counts={name:collections.defaultdict(lambda:dict(n=0,correct=0))
                   for name in arm_names}
    for lang in LANGUAGES:
        val=[r for r in validation if r['language']==lang]
        if not val:raise ValueError(f'No validation samples for {lang}')
        models={'baseline_v2':base,'retrained_shared':learned,'retrained_locale':locale_heads[lang],
                'hybrid_v2topic_shared_interaction':{
                    'topic':base['topic'],'interaction':learned['interaction']},
                'hybrid_v2topic_locale_interaction':{
                    'topic':base['topic'],'interaction':locale_heads[lang]['interaction']}}
        by_locale[lang]={name:evaluate(val,h,features,labels) for name,h in models.items()}
        for name,metrics in by_locale[lang].items():
            for axis,score in metrics.items():
                global_counts[name][axis]['n']+=score['n']
                global_counts[name][axis]['correct']+=score['correct']
        for name,heads in models.items():
            for r in val:
                pred_t=predict(heads['topic'],features,[r],labels['topic']) if r['topic'] is not None else [None]
                pred_i=predict(heads['interaction'],features,[r],labels['interaction']) if r['interaction'] is not None else [None]
                all_preds.append({'id':r['id'],'language':lang,'model':name,
                    'gold_topic':r['topic'],'pred_topic':pred_t[0],
                    'gold_interaction':r['interaction'],'pred_interaction':pred_i[0],
                    'source':r['source'],'split':r['split'],
                    'semantic_family':r['semantic_family'],'contrast_group':r.get('contrast_group')})
    aggregate={}
    for name,metrics in global_counts.items():
        aggregate[name]={axis:{**counts,'accuracy':fraction(counts['correct'],counts['n'])}
                         for axis,counts in metrics.items()}
    args.out.mkdir(parents=True,exist_ok=True)
    head_manifest={}
    for name,model in [('shared',learned)]+[(l,locale_heads[l]) for l in LANGUAGES]:
        head_manifest[name]={}
        for axis in AXES:
            value=model[axis]
            blob=value.astype('<f4').tobytes()
            fname=f'{name}-{axis}.candidate.f32'
            (args.out/fname).write_bytes(blob)
            head_manifest[name][axis]={
                'file':fname,'sha256':SHA(blob),'shape':list(value.shape),
                'classes':labels[axis]}
    (args.out/'candidate_manifest.json').write_text(
        json.dumps(head_manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    manifest={'status':'EXPERIMENTAL_SYNTHETIC_NOT_PRODUCTION',
        'native_reviewed_rows':0,'training_data_provisional':True,
        'heldout_new_examples_used_for_training':False,
        'locked154_374_used_for_training_or_selection':False,
        'no_new_encoder_training':True,
        'sha256_input_corpus':SHA(args.corpus.read_bytes()),
        'e5_model_sha256':encoder.model_sha,
        'onnxruntime_version':onnxruntime.__version__,
        'scikit_learn_version':sklearn.__version__,
        'python_version':platform.python_version(),
        'platform':sys.platform,
        'new_heads_sha256':head_manifest,
        'same_runtime_all_arms':True,
        'evaluation_scope':'synthetic scene holdout; human labels not reviewed; not a deployment test',
        'warning':'Synthetic scene and translated-family holdouts are not an independent blind human test; validation examined after first training run so these comparisons are exploratory and not unbiased estimates.',
        'balancing':'inverse locale/class frequency calculated on TRAIN only (no val/test fitting)',
        'hybrid_arms_evaluated_after_observing_topic_regression':True,
        'train_rows':len(train),'validation_rows':len(validation)}
    (args.out/'run_manifest.json').write_text(
        json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    outcome={'manifest_summary':{k:v for k,v in manifest.items() if k!='new_heads_sha256'},
        'aggregate':aggregate,'by_language':by_locale}
    (args.out/'comparison.json').write_text(
        json.dumps(outcome,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    with (args.out/'validation_predictions.jsonl').open('w',encoding='utf-8') as f:
        for item in all_preds:f.write(json.dumps(item,ensure_ascii=False)+'\n')
    print('PROVISIONAL DUAL AXIS RESULTS\n'+json.dumps(aggregate,ensure_ascii=False,indent=2),flush=True)
    print('EXPERIMENTAL SYNTHETIC ONLY; DO NOT DEPLOY.',flush=True)
if __name__=='__main__':main()
