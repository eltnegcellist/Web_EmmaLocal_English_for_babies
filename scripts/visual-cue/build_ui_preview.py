#!/usr/bin/env python3
from pathlib import Path
import json
R=Path(__file__).resolve().parents[2]
rows=json.loads((R/'shared/visual-cue-runtime-review.json').read_text())['rows']
voice=json.loads((R/'assets/voice-1202/manifest.json').read_text())['entries']
norm=lambda s:' '.join(s.replace('’',"'").lower().split())
voices={norm(e['text']):e for e in voice}
targets=[('emma',s) for s in ['neutral','smile','calm','celebrate','listen','ask','invite']]+[('asset',s) for s in ['milk','kick','page','hand-wave','book','cup','sleep','toy','diaper-v2']]
examples=[]
for kind,key in targets:
 candidates=[r for r in rows if r['binding']['type']==kind and r['binding'].get('state' if kind=='emma' else 'assetId')==key and norm(r['text']) in voices]
 if not candidates:continue
 r=min(candidates,key=lambda r:len(r['text']));v=voices[norm(r['text'])]
 examples.append(dict(label=('Emma / ' if kind=='emma' else '')+key,text=r['text'],audio='assets/voice-1202/'+v['file'],phraseId=r['phraseId']))
(R/'shared/visual-cue-ui-examples.json').write_text(json.dumps(examples,ensure_ascii=False,indent=2)+'\n')
print('Voice-backed examples:',len(examples))
