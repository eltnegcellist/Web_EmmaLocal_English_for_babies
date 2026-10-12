#!/usr/bin/env python3
"""Experimental polarity/negated-fact Ruri head; NOT a deployed safety filter.

Uses hand-authored minimal contrast pairs with family-isolated split. The 67
previously discussed QA texts are a frozen exploratory comparison only, not
independent parental speech nor candidates for fitting/calibration.
"""
import hashlib,json,pathlib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score,precision_recall_fscore_support
root=pathlib.Path(__file__).resolve().parent.parent
items=json.loads((root/'.ruri-polarity/embeddings.json').read_text())['items']
labels=['affirmative','negated']
train_items=[x for x in items if x['partition']=='dataset']
qa_items=[x for x in items if x['partition']=='qa']
hard_items=[x for x in items if x['partition']=='hard']
families={z for z in (x['family'] for x in train_items)}
assert len(train_items)==114 and len(qa_items)==67 and len(hard_items)==51 and len(families)==57
for p in ['train','dev','test']:
 assert len({x['family'] for x in train_items if x['split']==p})>=8
for family in families:
 assert len({x['split'] for x in train_items if x['family']==family})==1,'family split leakage'
assert not {x['text'] for x in train_items}.intersection(x['text'] for x in qa_items+hard_items)
vectors=np.asarray([x['embedding'] for x in train_items],dtype=np.float64)
y=np.array([labels.index(x['label']) for x in train_items])
splits=np.array([x['split'] for x in train_items])
assert vectors.shape==(114,384) and np.isfinite(vectors).all()
def measure(y,pred):
 precision,recall,f1,_=precision_recall_fscore_support(y,pred,labels=[1],zero_division=0)
 return dict(accuracy=float(accuracy_score(y,pred)),negated_precision=float(precision[0]),
    negated_recall=float(recall[0]),negated_f1=float(f1[0]),positives=int(sum(pred)),
    false_negative_count=int(sum((y==1)&(pred==0))),
    false_positive_count=int(sum((y==0)&(pred==1))),n=len(y))
def predict(p,threshold):
 return (p[:,1]>=threshold).astype(np.int32)
train=splits=='train';dev=splits=='dev';test=splits=='test'
best=None
for C in [0.03,0.1,0.3,1.,3.,10.,30.]:
 model=LogisticRegression(C=C,max_iter=1200,solver='lbfgs',class_weight='balanced',random_state=123)
 model.fit(vectors[train],y[train])
 for t in [.35,.4,.45,.5,.55,.6,.65,.7,.75,.8]:
  metric=measure(y[dev],predict(model.predict_proba(vectors[dev]),t))
  # Select by dev only, prioritize negation recall without excessive positive rejection.
  key=(round(metric['negated_f1']-0.05*metric['false_positive_count'],6),
       metric['negated_precision'],metric['negated_recall'])
  if best is None or key>best[0]:best=(key,C,t,model,metric)
_,C,threshold,model,dev_metric=best
test_p=model.predict_proba(vectors[test])
test_pred=predict(test_p,threshold)
test_metric=measure(y[test],test_pred)
coef=np.asarray(model.coef_[0],dtype=np.float64)
intercept=float(model.intercept_[0])
# Binary LR sklearn stores positive class logit only. Produce 2-class softmax
# logits [0,coef*x+intercept] for affirmative / negated.
head=np.zeros((2,385),dtype='<f4')
head[1,:384]=coef
head[1,384]=intercept
raw=head.tobytes()
assert len(raw)==3080
test_rows=[]
for k,i in enumerate(np.where(test)[0]):
 test_rows.append(dict(text=train_items[i]['text'],family=train_items[i]['family'],
 expected=labels[y[i]],predicted=labels[test_pred[k]],probability=round(float(test_p[k,1]),5)))
qa_x=np.asarray([x['embedding'] for x in qa_items],dtype=np.float64)
qa_prob=model.predict_proba(qa_x)
qa_y=np.array([labels.index(x['label']) for x in qa_items])
qa_pred=predict(qa_prob,threshold)
qa_metric=measure(qa_y,qa_pred)
qa_rows=[]
for i,x in enumerate(qa_items):
 qa_rows.append(dict(id=x['qa_id'],category=x['category'],text=x['text'],expected=x['label'],
 predicted=labels[qa_pred[i]],probability_negated=round(float(qa_prob[i,1]),5),
 match=bool(qa_pred[i]==qa_y[i])))
hard_x=np.asarray([x['embedding'] for x in hard_items],dtype=np.float64)
hard_prob=model.predict_proba(hard_x)
hard_y=np.array([labels.index(x['label']) for x in hard_items])
hard_pred=predict(hard_prob,threshold)
hard_metric=measure(hard_y,hard_pred)
hard_rows=[]
for i,x in enumerate(hard_items):
 hard_rows.append(dict(id=x['qa_id'],phenomenon=x['category'],text=x['text'],
 expected=x['label'],predicted=labels[hard_pred[i]],
 probability_negated=round(float(hard_prob[i,1]),5),match=bool(hard_pred[i]==hard_y[i])))
out=root/'research/ruri-polarity/artifacts'
out.mkdir(parents=True,exist_ok=True)
(out/'head-polarity.f32').write_bytes(raw)
report=dict(status='EXPERIMENTAL_SYNTHETIC_NOT_RELEASE_SAFE',
 model='ruri-v3-70m INT8 fixed base + 384D two-class LR head',head_sha256=hashlib.sha256(raw).hexdigest(),
 labels=labels,counts=dict(train=int(train.sum()),dev=int(dev.sum()),test=int(test.sum()),qa=len(qa_items)),
 selection=dict(C=C,threshold=threshold,selection_basis='train+dev ONLY',dev=dev_metric),
 family_held_out_test=test_metric,held_out_test_rows=test_rows,
 frozen_qa_exploratory=dict(metrics=qa_metric,rows=qa_rows),
 hard_out_of_training_challenges=dict(metrics=hard_metric,rows=hard_rows),
 warnings=['No real ASR or caregiver audio in this experiment.',
 'The QA set was previously inspected; not an independent unbiased performance estimate.',
 'This gate alone cannot establish whether reassurance in a negated statement should be kept.',
 'Threshold calibration and production activation require human gold and richer negative controls.'])
(out/'experiment-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(out/'head-config.json').write_text(json.dumps(dict(labels=labels,shape=[2,385],threshold=threshold,
 sha256=report['head_sha256'],runtime_included=False),indent=2)+'\n')
print('POLARITY_DEV',json.dumps(dev_metric))
print('POLARITY_TEST',json.dumps(test_metric))
print('POLARITY_QA',json.dumps(qa_metric))
print('POLARITY_HARD_CHALLENGES',json.dumps(hard_metric))
print('POLARITY_HARD_ERRORS',json.dumps([x for x in hard_rows if not x['match']],ensure_ascii=False))
print('POLARITY_ERRORS',json.dumps([x for x in qa_rows if not x['match']],ensure_ascii=False))
print('POLARITY_HEAD_SHA',report['head_sha256'])
