#!/usr/bin/env python3
"""Build bust-up gestures without changing the established Emma camera/framing."""
from pathlib import Path
import json,re
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/emma-gestures';OUT.mkdir(exist_ok=True)
poses={
 'neutral':('待機','普段と同じバストアップで、小さくうなずいて待機する。',0,0,1),
 'smile':('にっこり','顔の大きさを保ち、笑顔で小さくうなずく。',6,-6,1.5),
 'calm':('安心させる','胸元の左右で手を低く開き、ゆっくり下げる。',25,-25,-1),
 'celebrate':('ほめる','顔の横へ両手を上げ、小さく動かしてほめる。',60,-60,1),
 'listen':('聞く','右手を耳の下へ寄せ、わずかに首を傾ける。',0,-55,2),
 'ask':('たずねる','顔の下の左右で手を開き、わずかに首を傾ける。',32,-32,-2),
 'invite':('誘う','右手を顔の横へ上げ、手首の向きをゆっくり変えて招く。',0,-32,1)}

def face_parts(kind):
 name='idle-closed' if kind in ['smile','calm','celebrate'] else 'idle-open'
 svg=(ROOT/f'assets/emma-face/emma-face-{name}.svg').read_text()
 content=svg.split('>',1)[1].rsplit('</svg>',1)[0]
 split=content.index('<path fill="var(--accent, #e00000)" d="M418,852')
 head,bust=content[:split],content[split:]
 if kind=='ask':head=re.sub(r'<path fill="none" stroke="var\(--dark, #080808\)" stroke-width="15"[^>]+d="M447,655[^>]+/>','<ellipse cx="512" cy="663" rx="23" ry="27" fill="var(--dark, #080808)"/>',head)
 return head,bust

def arm(side):
 mirror='' if side=='left' else ' transform="translate(512 0) scale(-1 1)"'
 # Entire mitt/forearm stays connected and rotates at the shoulder. No human fingers.
 return f'''<g class="eg-arm eg-{side}"><g{mirror}>
 <path d="M172 454 Q130 463 107 469 Q82 473 59 475" fill="none" stroke="var(--dark,#080808)" stroke-opacity=".65" stroke-width="24" stroke-linecap="round"/>
 <path d="M172 454 Q130 463 107 469 Q82 473 59 475" fill="none" stroke="var(--face,#fff)" stroke-width="20" stroke-linecap="round"/>
 <circle cx="172" cy="454" r="12" fill="color-mix(in srgb,var(--accent,#e00000) 30%,white)" stroke="var(--dark,#080808)" stroke-opacity=".4" stroke-width="2"/>
 <rect x="54" y="463" width="15" height="25" rx="6" fill="var(--accent,#e00000)"/>
 <path d="M58 466 Q51 456 38 458 Q22 457 21 470 Q16 480 25 488 Q34 498 48 491 L59 486Z" fill="var(--face,#fff)" stroke="var(--dark,#080808)" stroke-opacity=".65" stroke-width="2.5"/>
 </g></g>'''

entries=[];sources={}
for key,(label,description,left,right,tilt) in poses.items():
 duration=4.8 if key in ['neutral','calm','listen'] else 3.6
 left2=left+(5 if key=='celebrate' else -4 if key=='calm' else 1)
 right2=right+(-5 if key=='celebrate' else -8 if key=='invite' else 4 if key=='calm' else -1)
 prefix=f'[data-emma-gesture="{key}"]'
 css=''
 for part,pivot,target,peak in [('left','172px 454px',left,left2),('right','340px 454px',right,right2),('head','256px 436px',0,tilt)]:
  visible=part=='head' or key not in ['neutral','smile'] and (part=='right' or key not in ['listen','invite'])
  restingOpacity=1 if visible else 0
  startOpacity=1 if part=='head' else 0
  css+=f'{prefix} .eg-{part}{{transform-origin:{pivot};transform:rotate({target}deg);opacity:{restingOpacity};animation:eg-{part}-{key} {duration}s ease-in-out infinite}}'
  css+=f'@keyframes eg-{part}-{key}{{0%,100%{{transform:rotate(0deg);opacity:{startOpacity}}}20%,80%{{transform:rotate({target}deg);opacity:{restingOpacity}}}50%{{transform:rotate({peak}deg);opacity:{restingOpacity}}}}}'
 css+='@media(prefers-reduced-motion:reduce){.eg-arm,.eg-head{animation:none!important}}[data-motion="off"] .eg-arm,[data-motion="off"] .eg-head{animation:none!important}'
 head,bust=face_parts(key)
 # Both groups use exactly half of the original 1024px coordinates. The head,
 # neck, chest and viewport match the idle/talking avatar; no whole-body zoom.
 scene=f'<g class="eg-head"><g data-emma-head-geometry="true" transform="scale(.5)">{head}</g></g><g class="eg-bust" transform="scale(.5)">{bust}</g>'+arm('left')+arm('right')
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" data-emma-framing="bust" data-emma-gesture="{key}" role="img" aria-label="Emma：{label}"><title>Emma：{label}</title><style>{css}</style>{scene}</svg>'
 static=f'{prefix} .eg-left{{transform-origin:172px 454px;transform:rotate({left}deg)}}{prefix} .eg-right{{transform-origin:340px 454px;transform:rotate({right}deg)}}'
 
 for side in ['left','right']:
  active=key not in ['neutral','smile'] and (side=='right' or key not in ['listen','invite'])
  static+=f'{prefix} .eg-{side}{{opacity:{1 if active else 0}}}'
 poster=svg.replace(f'<style>{css}</style>',f'<style>{static}</style>')
 ET.fromstring(svg);ET.fromstring(poster)
 (OUT/f'{key}.svg').write_text(svg+'\n');(OUT/f'{key}-poster.svg').write_text(poster+'\n');sources[key]=svg
 entries.append(dict(id='emma.'+key,label=label,description=description,framing='bust-up, identical head scale and anchor to the existing avatar',animation=f'assets/emma-gestures/{key}.svg',poster=f'assets/emma-gestures/{key}-poster.svg',status='needs-review',movingParts=['head at neck']+(['right arm at shoulder'] if key in ['listen','invite'] else [] if key in ['neutral','smile'] else ['left arm at shoulder','right arm at shoulder']),durationMs=round(duration*1000)))
(OUT/'manifest.json').write_text(json.dumps(dict(schemaVersion=1,scope='Bust-up gesture candidates; original Emma head/neck/chest geometry. No adoption implied.',states=entries),ensure_ascii=False,indent=2)+'\n')
(ROOT/'src/emma-gestures.js').write_text('// Generated from local Emma SVG geometry by build_emma_gestures.py.\nexport const EMMA_GESTURES='+json.dumps(sources,ensure_ascii=False)+';\nexport function createEmmaGesture(state="neutral",document=globalThis.document){const template=document.createElement("template");template.innerHTML=EMMA_GESTURES[state]||EMMA_GESTURES.neutral;return template.content.firstElementChild;}\n')
print('Built seven bust-up Emma gesture candidates with unchanged head framing.')
