#!/usr/bin/env python3
"""Apply explicit human approval only to the exact reviewed media bytes."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/visual-cue/artwork'

def apply_approval(manifest,out=OUT):
 path=out/'approval-20261019.json'
 if not path.exists():return
 record=json.loads(path.read_text());accepted=[]
 for asset in manifest['assets']:
  approved=next((a for a in record['assets'] if a['id']==asset['id']),None)
  matches=approved and all(asset.get(field)==f['path'] and (out/f['path']).exists() and hashlib.sha256((out/f['path']).read_bytes()).hexdigest()==f['sha256'] for field,f in approved['files'].items())
  if matches:
   asset.update(status='accepted',readiness='accepted',humanReview='user-approved',approvedDate=record['date'],approvalRecord='approval-20261019.json');accepted.append(asset['id'])
  elif asset.get('status')=='accepted':
   asset.update(status='needs-review',readiness='candidate',humanReview='changed-since-user-approval')
   for key in ['approvedDate','approvalRecord']:asset.pop(key,None)
 for concept in manifest['concepts']:
  if concept.get('assetIds') and all(i in accepted for i in concept['assetIds']):
   concept.update(status='accepted',readiness='accepted')
   concept['reason']=concept['reason'].replace('採用審査待ち','素材は利用者が採用済み').replace('採用審査前','素材は利用者が採用済み')
  elif concept.get('status')=='accepted':
   concept.update(status='needs-review',readiness='candidate')
 for cue in manifest['cueCoverage']:
  if cue.get('assetIds') and all(i in accepted for i in cue['assetIds']) and cue['readiness']=='candidate':
   cue['reason']=cue['reason'].replace('素材候補の審査待ち。','素材は利用者が採用済み。').replace('採用審査待ち。','素材は利用者が採用済み。')
 manifest['userApproval']=dict(date=record['date'],quote=record['quote'],scope=record['scope'],record='approval-20261019.json',acceptedAssetIds=accepted)
 manifest['legacyStyleApprovals']=[a for a in record['legacyStyleApprovals'] if (out/'reference'/a['path']).exists() and hashlib.sha256((out/'reference'/a['path']).read_bytes()).hexdigest()==a['sha256']]
 manifest['approval']=f"2026-10-19 利用者が現行{len(accepted)}素材を採用。撤回済み旧版・未制作Cue・アプリ統合・914英文割当は別管理。"
 if len(accepted)==len(record['assets']):
  for item in manifest.get('reviewFeedback',{}).get('followUp',{}).get('items',[]):item['status']='2026-10-19 素材採用済み。未制作Cueは別管理。'

if __name__=='__main__':
 path=OUT/'manifest.json';manifest=json.loads(path.read_text());apply_approval(manifest);path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(manifest.get('approval','No explicit user approval record.'))
