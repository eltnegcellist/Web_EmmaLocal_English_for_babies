#!/usr/bin/env python3
"""Build seven robot gestures using the established local Emma face geometry."""
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/emma-gestures';OUT.mkdir(exist_ok=True)
poses={
 'neutral':('待機','両腕を下ろし、わずかに首と腕を動かして待機する。',0,0,0),
 'smile':('にっこり','笑顔で小さくうなずき、両手を少し開く。',12,-12,0),
 'calm':('安心させる','両手を低く開き、ゆっくり手を下げる。',38,-38,-2),
 'celebrate':('ほめる','両腕を上げ、左右の手をゆっくり動かす。',100,-100,0),
 'listen':('聞く','右手を耳のそばへ寄せ、首を傾ける。',0,-100,5),
 'ask':('たずねる','両手を上向きに開き、首を傾ける。完了の印は出さない。',58,-58,-7),
 'invite':('誘う','右手を外へ開き、ゆっくり招く。',4,-68,0)}
def head(kind):
 name='idle-closed' if kind in ['smile','calm','celebrate'] else 'idle-open'
 svg=(ROOT/f'assets/emma-face/emma-face-{name}.svg').read_text();body=svg.split('>',1)[1].rsplit('</svg>',1)[0];body=body.split('<path fill="var(--accent, #e00000)" d="M418,852')[0]
 if kind=='ask':body=re.sub(r'<path fill="none" stroke="var\(--dark, #080808\)" stroke-width="15"[^>]+d="M447,655[^>]+/>','<ellipse cx="512" cy="663" rx="23" ry="27" fill="var(--dark, #080808)"/>',body)
 return body

def arm(side):
 left=side=='left';mirror='' if left else ' transform="translate(512 0) scale(-1 1)"'
 # All rotation pivots are in the full SVG coordinate system. No separate fingers.
 return f'''<g class="eg-arm eg-{side}"><g{mirror}>
 <path d="M187 312 Q157 325 150 352 Q143 367 146 383" fill="none" stroke="var(--dark,#080808)" stroke-opacity=".65" stroke-width="34" stroke-linecap="round"/>
 <path d="M187 312 Q157 325 150 352 Q143 367 146 383" fill="none" stroke="var(--face,#fff)" stroke-width="29" stroke-linecap="round"/>
 <circle cx="187" cy="312" r="16" fill="color-mix(in srgb,var(--accent,#e00000) 30%,white)" stroke="var(--dark,#080808)" stroke-opacity=".4" stroke-width="2"/>
 <rect x="130" y="375" width="32" height="16" rx="7" fill="var(--accent,#e00000)"/>
 <path d="M128 392 Q126 379 139 381 Q149 378 156 387 Q172 379 173 391 Q173 402 163 406 Q163 420 147 423 Q128 424 125 408 Z" fill="var(--face,#fff)" stroke="var(--dark,#080808)" stroke-opacity=".65" stroke-width="2.5"/>
 </g></g>'''
entries=[];sources={}
for key,(label,description,left,right,tilt) in poses.items():
 duration=4.8 if key in ['neutral','calm','listen'] else 3.6
 left2=left+(8 if key=='celebrate' else -4 if key=='calm' else 2)
 right2=right+(-8 if key=='celebrate' else 12 if key=='invite' else 5 if key=='calm' else -2)
 head2=tilt+(4 if key=='smile' else 2 if key in ['listen','ask'] else 1)
 css=f'''.eg-left{{transform-origin:187px 312px;transform:rotate({left}deg);animation:eg-left-{key} {duration}s ease-in-out infinite}}.eg-right{{transform-origin:325px 312px;transform:rotate({right}deg);animation:eg-right-{key} {duration}s ease-in-out infinite}}.eg-head{{transform-origin:256px 284px;transform:rotate({tilt}deg);animation:eg-head-{key} {duration}s ease-in-out infinite}}@keyframes eg-left-{key}{{50%{{transform:rotate({left2}deg)}}}}@keyframes eg-right-{key}{{50%{{transform:rotate({right2}deg)}}}}@keyframes eg-head-{key}{{50%{{transform:rotate({head2}deg)}}}}@media(prefers-reduced-motion:reduce){{.eg-arm,.eg-head{{animation:none!important}}}}[data-motion="off"] .eg-arm,[data-motion="off"] .eg-head{{animation:none!important}}'''
 for part in ['left','right','head']:css=css.replace('.eg-'+part+'{',f'[data-emma-gesture="{key}"] .eg-'+part+'{',1)
 scene=arm('left')+(arm('right') if key!='listen' else '')+'''<rect x="239" y="278" width="34" height="35" rx="12" fill="var(--accent,#e00000)"/><path d="M194 305 Q220 294 256 306 Q292 294 318 305 Q340 343 340 447 Q340 473 315 476 L197 476 Q172 473 172 447 Q172 343 194 305Z" fill="var(--face,#fff)" stroke="var(--dark,#080808)" stroke-opacity=".65" stroke-width="3"/><path d="M256 371 C225 344 204 379 226 399 L256 423 L286 399 C308 379 287 344 256 371Z" fill="var(--accent,#e00000)"/>'''+f'<g class="eg-head"><g transform="translate(92.16 0) scale(.32)">{head(key)}</g></g>'
 if key=='listen':scene+=arm('right')
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" data-emma-gesture="{key}" role="img" aria-label="Emma：{label}"><title>Emma：{label}</title><style>{css}</style>{scene}</svg>'
 poster=svg.replace(f'<style>{css}</style>',f'<style>.eg-left{{transform-origin:187px 312px;transform:rotate({left}deg)}}.eg-right{{transform-origin:325px 312px;transform:rotate({right}deg)}}.eg-head{{transform-origin:256px 284px;transform:rotate({tilt}deg)}}</style>')
 (OUT/f'{key}.svg').write_text(svg+'\n');(OUT/f'{key}-poster.svg').write_text(poster+'\n');sources[key]=svg
 entries.append(dict(id='emma.'+key,label=label,description=description,animation=f'assets/emma-gestures/{key}.svg',poster=f'assets/emma-gestures/{key}-poster.svg',status='needs-review',movingParts=['head','left arm at shoulder','right arm at shoulder'],durationMs=round(duration*1000)))
(OUT/'manifest.json').write_text(json.dumps(dict(schemaVersion=1,scope='New gesture candidates, using established Emma robot geometry. No adoption implied.',states=entries),ensure_ascii=False,indent=2)+'\n')
(ROOT/'src/emma-gestures.js').write_text('// Generated from local Emma SVG geometry by build_emma_gestures.py.\nexport const EMMA_GESTURES='+json.dumps(sources,ensure_ascii=False)+';\nexport function createEmmaGesture(state="neutral",document=globalThis.document){const template=document.createElement("template");template.innerHTML=EMMA_GESTURES[state]||EMMA_GESTURES.neutral;return template.content.firstElementChild;}\n')
print('Built seven Emma robot gesture candidates and seven static posters.')
