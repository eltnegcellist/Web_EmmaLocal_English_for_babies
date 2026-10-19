#!/usr/bin/env python3
"""Compile exact-text bindings for the opt-in UI; never classify at playback time.
Original draft assignments retain their review status. New UI bindings are candidates.
"""
from pathlib import Path
import json,hashlib,collections
R=Path(__file__).resolve().parents[2]
read=lambda p:json.loads((R/p).read_text())
art=read('assets/visual-cue/artwork/manifest.json')['assets']
# Approval holds and semantic withdrawals are authoritative even if a file exists.
assets={a['id']:{'id':a['id'],'kind':a['kind'],'image':'assets/visual-cue/artwork/'+(a['animation'] or a['illustration']),'poster':'assets/visual-cue/artwork/'+a['poster']} for a in art if a['status']=='accepted' and a['id'] not in ['wake-daylight']}
hug=read('assets/visual-cue/prototypes/hug-face/manifest.json')
assert hug['status']=='accepted-still' and hug['humanApproval']
assert read(hug['motion']['verification'])['passed']
assert read(hug['motion']['verification'])['animationSHA256']==hashlib.sha256((R/hug['motion']['animation']).read_bytes()).hexdigest()
art.append(dict(id=hug['id'],status='accepted',kind='illustration'))
assets[hug['id']]=dict(id=hug['id'],kind='illustration',image=hug['motion']['poster'],poster=hug['motion']['poster'])
motions=read('assets/visual-cue/motion-variants/manifest.json')['assets']
motions=motions+[hug['motion']]
for a in motions:
 assert a['status']=='motion-candidate' and any(x['id']==a['baseAssetId'] and x['status']=='accepted' and x['kind']=='illustration' for x in art)
 assets[a['id']]={'id':a['id'],'kind':'animation','image':a['animation'],'poster':a['poster'],'approvalStatus':'motion-candidate','baseAssetId':a['baseAssetId']}
subjects={'milk':'milk','diaper':'diaper-v2','toy':'toy','outside':'outdoor','rain':'rain','sun':'sun','bath':'bath','book':'book','music':'music','clothes':'clothes','drink':'cup','tummy':'tummy','hands':'hands-open-v2','food':'meal','feet':'feet'}
actions={'sleep':'sleep','sip':'milk','hug':'hug-arms','eat':'spoon','kick':'kick','sing':'notes','splash':'water-splash','dress':'dress-sleeves','turn-page':'page','read':'book','peekaboo':'peekaboo','wipe':'care-wipe','clap':'hand-clap','wave':'hand-wave','wash':'water-shower','burp':'care-burp'}
gestures={'social.greeting':'smile','social.reassurance':'calm','social.affection':'smile','social.praise':'celebrate','social.achievement':'celebrate','social.effort':'celebrate','social.encouragement':'invite','social.care':'calm','dialogue.invitation':'invite','dialogue.start':'invite','dialogue.finish':'calm','dialogue.finish-check':'ask','dialogue.inquiry':'ask','dialogue.repeat':'invite','dialogue.pause':'calm','observed.voice':'listen','observed.smile':'smile','attention.look':'invite','attention.listen':'listen','action.wake':'smile'}
withdrawn={'action.'+x for x in ['open-close','count','wiggle','squeeze','tap']}
audit={a['phraseId'] for a in read('shared/visual-cue-semantic-audit.json')['reviewQueue']}
def norm(s):return ' '.join(s.replace('’',"'").lower().split())
def emma(state):return {'type':'emma','state':state}
def plan(a):
 cue=a['primaryCue'];t=a['text'].lower();topic=a['sourceKey'].split('|')[0]
 if cue in withdrawn:return {'type':'asset','assetId':'hands-open-v2'} if topic=='hands' else emma('invite')
 if cue in gestures:return emma(gestures[cue])
 aid=subjects.get(cue.removeprefix('subject.')) if cue.startswith('subject.') else actions.get(cue.removeprefix('action.'))
 if not aid:return emma('neutral')
 # Cup motion remains on hold. Bottle sipping only for explicit milk, and no question.
 if cue=='action.wash':aid='hands-open-v2' if any(w in t for w in ['hand','finger']) else 'feet' if any(w in t for w in ['feet','foot','toe']) else 'bath'
 if cue=='action.sip':aid='sip' if topic=='milk' and '?' not in t else 'milk' if topic=='milk' else 'cup'
 if assets[aid]['kind']=='animation':
  # Generated action+question and multi-action assignments are not treated as observed actions.
  if '?' in t or a['phraseId'] in audit:
   still={'hug-arms':'family-care','spoon':'meal','kick':'feet','notes':'music','water-splash':'bath','dress-sleeves':'clothes','page':'book','peekaboo':'toy','care-wipe':'family-care','hand-clap':'hands-open-v2','hand-wave':'hands-open-v2','water-shower':'bath','care-burp':'family-care','sip':'milk'}
   aid=still[aid]
  if aid=='care-burp' and 'back' not in t:aid='family-care'
 return {'type':'asset','assetId':aid}
rows=read('shared/visual-cue-assignments.draft.json')['assignments'];bindings={};review=[]
ledger={r['phraseId']:r['text'] for r in read('shared/visual-cue-phrases.json')['rows']}
assert {r['phraseId']:r['text'] for r in rows}==ledger,'Regenerate draft assignments after corpus edits'
for a in rows:
 p=plan(a);key=norm(a['text'])
 if key in bindings and bindings[key]!=p:p=emma('neutral')
 bindings[key]=p
 review.append({'phraseId':a['phraseId'],'text':a['text'],'sourceAssignmentReview':a['reviewStatus'],'binding':p,'reviewStatus':'candidate'})
# Explicit literal bindings for the 178 press-single recordings. Ambiguous actions
# (wiggle/squeeze/tap/count) use Emma, never a misleading substitute animation.
voice={norm(e['text']):e for e in read('assets/voice-1202/manifest.json')['entries']}
single_groups={
 'asset:milk':'Milk time!|Milk, milk!|Yummy milk!|Time for milk!',
 'asset:cup':"Let's drink.|Drink, drink!",
 'asset:book':"Book time!|Book, book!|Let's read!|Story time!|Open the book.",
 'asset:page':'Turn the page.|Flip that page!',
 'asset:hands-open-v2':'Tiny hands!|Hands, hands!|Little hands!|Tiny fingers!|Open, close.|Open and close.',
 'asset:feet':'Tiny feet!|Feet, feet!|Little feet!|Little feet.|Little toes!|Little toes.',
 'asset:kick':'Kick, kick!', 'asset:hand-clap':'Clap, clap!', 'asset:hand-wave':'Wave hello!|Wave, wave!',
 'asset:bath':'Bath time!|Warm bath!|Warm water.|Wash, wash!',
 'asset:water-splash':'Splash, splash!',
 'asset:clothes':'Clothes on!|Dress time!|Clothes time!|Getting dressed!|One little arm.|One arm, one leg.|Arm goes in!',
 'asset:diaper-v2':'Diaper time!|Diaper time.|Fresh diaper!|Diaper change!',
 'asset:toy':"Play time!|Let's play!|Play, play!|Time to play!",
 'asset:peekaboo':'Peek-a-boo!',
 'asset:meal':'Food time!|Chew, chew!|Food, food!|Yummy food!|Little bite.|Time to eat!|Tiny little bites.',
 'asset:music':"Song time!|Let's sing!|Music time!|Music, music!|Sing with me!|Sing with me.|La-la-la!",
 'asset:outdoor':'Fresh air!|Out we go!|Outside time!|Time outside!|Outside, outside!',
 'asset:rain':'Rainy day.|Drip, drop!|Rain, rain!|Rain outside!|Pitter-patter!',
 'asset:sun':'Sunshine!|Sunny day!|Bright day!|Warm and bright.|Bright, bright!',
 'asset:tummy':'Happy tummy.|Little tummy.',
 'asset:sleep':'So sleepy.|Night-night.|Sleepy eyes.|Sleepy time.|Time to sleep.|Rest, little one.|Good night, little one.',
 'emma:smile':"Hi there!|So sweet!|So sweet.|Wake up!|Eyes open.|Big smile!|Bright eyes.|Happy smile!|Hello again!|Hello there!|Good morning!|Hello, hello!|Smile for me!|Smile, smile!|What a smile!|Big, big smile!|Hello, sunshine!|Let's say hello!|Hello, little one!|Hello, little one.|Morning, little one!|Good morning, little one!|Morning time.",
 'emma:calm':"Rest.|Big hug!|Big hug.|So cozy.|All cozy.|All done.|Big cuddle!|Easy, easy.|Rest, rest.|Right here.|Small sips.|Cuddle time!|Little sips.|Nice and cozy.|Nice and easy.|Nice and slow.|Warm and cozy.|Cuddle, cuddle!|Nice and close.|Nice and quiet.|Take your time.|Nice and gentle.|Little by little.|Sip, sip!|One at a time.|Burp, burp!|Wipe, wipe!",
 'emma:celebrate':'All clean!|All clean.|All ready!|All ready.|So much fun!|Clean and fresh!|Fresh and clean.|There you go!',
 'emma:listen':"I hear you!|I hear you.|Talk, talk!|Little voice!|What a voice!|I'm listening.|Listen closely.|Listen with me.|Listen, listen!|Your little voice.",
 'emma:ask':"What's next?",
 'emma:invite':"Ready!|Up, up!|Up we go!|Let's see!|Here we go!|Here we go.|Look, look!|Here you go.|Look around!|Look around.|Up and down.|There it is!|Look with me.|Tap, tap!|Wiggle, wiggle!|One, two, three!|Squeeze, squeeze!",
 'emma:neutral':'Ooh, ahh!|Yum, yum!|Mmm, yummy!|Birds up high!'
}
single_bindings={}
for target,texts in single_groups.items():
 kind,key=target.split(':')
 for text in texts.split('|'):
  n=norm(text);assert n in voice,text;assert n not in single_bindings,text
  single_bindings[n]={'type':'asset','assetId':key} if kind=='asset' else emma(key)
press_single={norm(e['text']) for e in voice.values() if any(x.startswith('web:press-single:') for x in e['sources'])}
assert set(single_bindings)==press_single,sorted(press_single-set(single_bindings))
bindings.update(single_bindings)
# Explicit offline-reviewed static-to-animation decisions. Questions inside a
# reply do not cancel an observed/illustrative action in another sentence.
# Completion, pauses, held cups and withdrawn hand movements retain a still.
motion_review=read('shared/visual-cue-static-animation-overrides.json')['rows']
for r in motion_review:
 key=norm(r['text']);assert bindings[key]=={'type':'asset','assetId':r['assetId']},r['text']
 assert r['afterAssetId'] in assets
 if r['changed']:
  assert assets[r['afterAssetId']]['kind']=='animation'
  bindings[key]={'type':'asset','assetId':r['afterAssetId']}
# Replace only existing hugging displays, after the face-visible movie passes QA.
# The accepted static composition does not imply approval of the new animation.
face_review=[]
for key,p in list(bindings.items()):
 if p['type']=='asset' and p['assetId'] in ['hug-arms','family-care']:
  replacement='hug-face-cuddle' if p['assetId']=='hug-arms' else 'hug-face-v1'
  bindings[key]={'type':'asset','assetId':replacement}
  face_review.append(dict(text=voice[key]['text'],before=p,after=bindings[key],reason='顔あり抱っこへ差し替え。元が静止表示なら顔あり静止、元が動作なら検証済みの顔あり動画候補。'))
assert sum(r['after']['assetId']=='hug-face-cuddle' for r in face_review)==42
del assets['hug-arms'];del assets['family-care']
single_bindings={key:bindings[key] for key in single_bindings}
for row in review:row['binding']=bindings[norm(row['text'])]
assert 'cup-sip' not in assets
assert all(p['type']=='emma' or p['assetId'] in assets for p in bindings.values())
output={'schemaVersion':1,'status':'opt-in implementation candidate; semantic approval is not implied','assets':assets,'bindings':bindings}
(R/'src/visual-cue-catalog.js').write_text('// Generated by build_runtime_catalog.py. Exact text only; unknown text falls back.\nexport const VISUAL_CUE_CATALOG='+json.dumps(output,ensure_ascii=False,separators=(',',':'))+';\n')
report={'schemaVersion':1,'status':'candidate','sourcePhraseSets':len(rows),'uniqueBindings':len(bindings),'pressSingleBindings':len(single_bindings),'sourceReviewed':sum(a['reviewStatus']!='generated' for a in rows),'bindingsByType':dict(collections.Counter(p['type'] for p in bindings.values())),'heldAssets':['cup-sip'],'withdrawnCues':sorted(withdrawn),'sentenceTiming':'One visual per recorded clip; no fabricated sentence boundaries.','rows':review,'singleSentences':[{'text':voice[k]['text'],'binding':v,'reviewStatus':'implementation-reviewed; user review pending'} for k,v in sorted(single_bindings.items())]}
(R/'shared/visual-cue-runtime-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(R/'shared/visual-cue-hug-face-overrides.json').write_text(json.dumps(dict(schemaVersion=1,status='static-approved; motion-candidate',baselineCommit='2faff558c71665872808cacf74361c8d3367b54b',rows=face_review),ensure_ascii=False,indent=2)+'\n')
print({k:v for k,v in report.items() if k not in ['rows','singleSentences']})
