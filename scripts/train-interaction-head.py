#!/usr/bin/env python3
"""PR-B experiment: genuine Ruri embedding LR fit, family-aware synthetic evaluation.
WARNING: sources have provisional synthetic labels. NOT a real-world accuracy estimate.
"""
import json, pathlib, struct, hashlib, datetime
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix
root=pathlib.Path(__file__).resolve().parent.parent
data=json.loads((root/'.interaction-experiment/embeddings.json').read_text())
manifest=json.loads((root/'research/interaction-head/experimental-dataset.json').read_text())
assert data['model_sha256']=='bd500193003fdeaba8c5422a47b974b40b49a5e0c91285c76f6bd949d2205264'
labels=manifest['labels']
xs=np.array([row['embedding'] for row in data['items']],dtype=np.float64)
ys=np.array([labels.index(row['label']) for row in data['items']],dtype=np.int32)
splits=np.array([row['split'] for row in data['items']])
assert xs.shape==(len(ys),384) and np.isfinite(xs).all()
assert set(splits)=={'train','dev','test'}
train,dev,test=(splits==x for x in ['train','dev','test'])
assert len(set(data['items'][i]['family'] for i in np.where(train)[0]).intersection(set(data['items'][i]['family'] for i in np.where(test)[0])))==0
assert len(set(data['items'][i]['text'] for i in np.where(train)[0]).intersection(set(data['items'][i]['text'] for i in np.where(test)[0])))==0
none=labels.index('none')
def postprocess(probs,threshold,margin):
 idx=probs.argmax(axis=1)
 sorted_=np.sort(probs,axis=1)
 accept=(sorted_[:,-1]>=threshold)&((sorted_[:,-1]-sorted_[:,-2])>=margin)
 return np.where(accept,idx,none)
def scored(true,pred):
 positive=pred!=none
 tp=int(np.sum((pred==true)&positive))
 pp=int(positive.sum())
 actual=int((true!=none).sum())
 return {
  'accuracy':float(accuracy_score(true,pred)),
  'macro_f1_all_15':float(f1_score(true,pred,labels=list(range(len(labels))),average='macro',zero_division=0)),
  'macro_f1_interaction_14':float(f1_score(true,pred,labels=list(range(len(labels)-1)),average='macro',zero_division=0)),
  'accepted_interaction_precision':float(tp/pp if pp else 0),
  'accepted_interaction_recall':float(tp/actual if actual else 0),
  'accepted_interaction_count':pp,
  'legacy_none_false_alarms':int(((true==none)&(pred!=none)).sum()),
  'none_sample_count':int((true==none).sum()),
 }
best=None
for C in [0.03,0.1,0.3,1.0,3.0,10.0,30.0]:
 model=LogisticRegression(C=C,max_iter=1500,solver='lbfgs',class_weight='balanced',random_state=123,tol=1e-5)
 model.fit(xs[train],ys[train])
 assert len(model.classes_)==len(labels)
 prob=model.predict_proba(xs[dev])
 for threshold in [0,0.15,0.2,0.25,0.3,0.4,0.5,0.6]:
  for margin in [0,0.03,0.07,0.1,0.15,0.2]:
   s=scored(ys[dev],postprocess(prob,threshold,margin))
   # optimize dev macro F1 while penalizing misdirected childcare messages
   key=(round(s['macro_f1_interaction_14'],8)-max(0,0.8-s['accepted_interaction_precision'])*0.3,
        s['accepted_interaction_precision'],s['accepted_interaction_recall'])
   if best is None or key>best[0]:best=(key,C,threshold,margin,model,s)
_,C,threshold,margin,model,dev_metrics=best
# Freeze model chosen solely from training/development. Test has never been used for selection.
order=[int(np.where(model.classes_==k)[0][0]) for k in range(len(labels))]
coef=model.coef_[order]
intercept=model.intercept_[order]
matrix=np.column_stack([coef,intercept]).astype('<f4')
assert matrix.shape==(15,385)
outdir=root/'research/interaction-head/artifacts'
outdir.mkdir(parents=True,exist_ok=True)
raw=matrix.tobytes(order='C')
(outdir/'head-interaction.f32').write_bytes(raw)
probtest=model.predict_proba(xs[test])
test_predictions=postprocess(probtest,threshold,margin)
s_test=scored(ys[test],test_predictions)
per_class={}
for i,label in enumerate(labels):
 act=ys[test]==i
 hits=int(np.sum(act&(test_predictions==i)))
 assigned=int(np.sum(test_predictions==i))
 per_class[label]={'test_support':int(act.sum()),'test_recall':float(hits/max(1,int(act.sum()))),'precision':float(hits/max(1,assigned))}
wrong=[]
for j,idx in enumerate(np.where(test)[0]):
 if test_predictions[j]!=ys[idx]:
  wrong.append({'text':data['items'][idx]['text'],'expected':labels[int(ys[idx])],'predicted':labels[int(test_predictions[j])],'score':round(float(np.max(probtest[j])),5)})
report={
 'schema_version':1,
 'status':'EXPERIMENTAL_ONLY_NOT_PRODUCTION_READY',
 'model':'ruri-v3-70m INT8 fixed base plus linear head',
 'model_sha256':data['model_sha256'],
 'training_examples':int(train.sum()),'dev_examples':int(dev.sum()),'test_examples':int(test.sum()),
 'evaluation_warning':'Only synthetic seed/template labels; dev/test are distinct lexical seeds but not natural caregiver language; no human adjudication, no real ASR; never claim field accuracy.',
 'labels':labels,'head_shape':[len(labels),385],'head_sha256':hashlib.sha256(raw).hexdigest(),
 'fit':{'algorithm':'sklearn LogisticRegression multinomial softmax LBFGS','C':C,'max_iter':1500,'random_state':123,'class_weight':'balanced'},
 'calibrated_on_dev_only':{'threshold':threshold,'margin':margin,'dev_metrics':dev_metrics},
 'untouched_synthetic_test':s_test,
 'test_per_class':per_class,
 'test_misclassified':wrong[:120],
 'train_dataset_source':'research/interaction-head/experimental-dataset.json',
 'decision':'NOT DEPLOYED. Requires human-confirmed labels, hard-negative audit, larger independent families, and actual ASR tests before runtime integration.'
}
(outdir/'experiment-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
head_cfg={'name':'interaction','classes':labels,'filename':'head-interaction.f32','shape':[15,385],
 'dimensions':384,'dtype':'little-endian float32','layout':'row-major [class,385]; last column bias',
 'sha256':report['head_sha256'],'thresholds':{'threshold':threshold,'margin':margin},
 'runtime_included':False,'status':'experimental_provisional_not_calibrated_on_natural_speech'}
(outdir/'head-config.json').write_text(json.dumps(head_cfg,ensure_ascii=False,indent=2)+'\n')
print('REAL RURI 384D embeddings -> trained logistic head,',len(labels),'classes')
print('train/dev/test',train.sum(),dev.sum(),test.sum())
print('chosen on dev C/threshold/margin:',C,threshold,margin)
print('DEV METRICS',json.dumps(dev_metrics,ensure_ascii=False))
print('TEST METRICS',json.dumps(s_test,ensure_ascii=False))
print('TEST PER CLASS',json.dumps(per_class,ensure_ascii=False))
print('Saved artifact SHA256:',report['head_sha256'])
