#!/usr/bin/env python3
import json, hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'outputs/research-only'
manifest=json.loads((out/'candidate_manifest.json').read_text())
report=json.loads((out/'comparison.json').read_text())
head=(out/'interaction.candidate.f32').read_bytes()
assert manifest['artifact_status']=='RESEARCH_ONLY_NOT_APPROVED'
assert manifest['trained_encoder'] is False and manifest['topic_head_changed'] is False
assert manifest['heldout_154_used_for_training'] is False
assert manifest['head_shape']==[15,385]
assert manifest['head_sha256']==hashlib.sha256(head).hexdigest()
assert len(head)==15*385*4 and np.isfinite(np.frombuffer(head,dtype='<f4')).all()
assert report['validation']['candidate']['n']==135
assert report['locked154_unreviewed_diagnostic']['candidate']['n']==154
assert set(report)=={'train','validation','locked154_unreviewed_diagnostic'}
summary={k: {'current':v['baseline']['accuracy'],'candidate':v['candidate']['accuracy'],'n':v['candidate']['n']} for k,v in report.items()}
(out/'score_summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,indent=2))
print('PASS: research output only. No main branch / production head writes.')
