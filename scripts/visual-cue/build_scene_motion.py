#!/usr/bin/env python3
"""Native SVG motion layers over unchanged approved raster originals.
No raster redraw, whole-scene shaking, new face, or user-approval promotion.
"""
from pathlib import Path
import base64,json,hashlib,subprocess,math,xml.etree.ElementTree as ET
R=Path(__file__).resolve().parents[2];O=R/'assets/visual-cue/motion-variants';O.mkdir(exist_ok=True)
def raw(path):return subprocess.check_output(['git','show','HEAD:'+path],cwd=R)
def data(path):
 b=raw(path);return 'data:'+('image/png' if path.endswith('.png') else 'image/webp')+';base64,'+base64.b64encode(b).decode()
def image(path,attrs=''):return f'<image href="{data(path)}" width="512" height="512" {attrs}/>'
def star(x,y,r=9):
 pts=[]
 for i in range(10):
  a=-math.pi/2+i*math.pi/5;rad=r if i%2==0 else r*.44;pts.append(f'{x+math.cos(a)*rad:.2f},{y+math.sin(a)*rad:.2f}')
 return '<polygon points="'+' '.join(pts)+'" fill="url(#gold)"/>'
common='<defs><linearGradient id="gold" x2=".8" y2="1"><stop stop-color="#ffe677"/><stop offset="1" stop-color="#f3b331"/></linearGradient><linearGradient id="leaf" x2="1" y2="1"><stop stop-color="#b9d55a"/><stop offset="1" stop-color="#50974a"/></linearGradient></defs>'
assets=[]
def save(key,label,base,body,css,moving,stationary,loop=4):
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" data-motion-variant="{key}" role="img" aria-label="{label}"><style>{css}@media(prefers-reduced-motion:reduce){{*{{animation:none!important}}}}</style>{common}{body}</svg>'
 ET.fromstring(svg);(O/(key+'.svg')).write_text(svg+'\n')
 (O/(key+'-poster.svg')).write_text(svg.replace('<style>','<style>*{animation:none!important}')+'\n')
 raster_sources=['assets/visual-cue/artwork/parts/v3-grip-ball.png'] if key=='toy-roll' else [f'assets/visual-cue/artwork/stills/{base}.webp']
 assets.append(dict(rasterSources=[dict(path=p,sha256=hashlib.sha256(raw(p)).hexdigest()) for p in raster_sources],id=key,topic=label,kind='animation',status='motion-candidate',readiness='user-review-pending',baseAssetId=base,animation=f'assets/visual-cue/motion-variants/{key}.svg',poster=f'assets/visual-cue/motion-variants/{key}-poster.svg',movingParts=moving,stationaryRegion=stationary,loopMs=round(loop*1000),sourceSHA256=hashlib.sha256(raw(f'assets/visual-cue/artwork/stills/{base}.webp')).hexdigest()))
# The sun centre stays fixed. Only the eight separate rays brighten in sequence.
sun='assets/visual-cue/artwork/stills/sun.webp'
def wedge(i):
 a=math.radians(-90+45*i);da=math.radians(20)
 pts=[(256,256)]+[(256+240*math.cos(a-da+2*da*j/12),256+240*math.sin(a-da+2*da*j/12)) for j in range(13)]
 return 'M'+' L'.join(f'{x:.2f},{y:.2f}' for x,y in pts)+' Z'
defs='<defs><image id="source" href="'+data(sun)+'" width="512" height="512"/><clipPath id="centre"><circle cx="256" cy="257" r="110"/></clipPath><mask id="rays"><rect width="512" height="512" fill="white"/><circle cx="256" cy="257" r="110" fill="black"/></mask>'
for i in range(8):defs+=f'<clipPath id="ray{i}"><path d="{wedge(i)}"/></clipPath>'
defs+='</defs>'
body=defs+'<use href="#source" clip-path="url(#centre)"/>'
for i in range(8):body+=f'<g clip-path="url(#ray{i})" mask="url(#rays)" class="ray" style="animation-delay:-{i*.35:.2f}s"><use href="#source"/></g>'
save('sun-rays','太陽：中心を保ち、光の筋が順に明るくなる','sun',body,'.ray{opacity:.48;animation:glow 3.6s ease-in-out infinite}@keyframes glow{0%,100%{opacity:.48}45%,65%{opacity:1}}',['eight sun rays: independent opacity'],[205,205,305,305],3.6)
# Tree/trunk/ground are untouched; two small leaves descend at the canopy edges.
body=image('assets/visual-cue/artwork/stills/outdoor.webp')
for i,(x,y) in enumerate([(390,245),(105,210)]):
 body+=f'<g transform="translate({x} {y})"><g class="fall leaf{i}"><path d="M0 0 Q24 -24 35 -6 Q28 20 0 0Z" fill="url(#leaf)"/><path d="M3 0 L29 -6" stroke="#6b9e45" stroke-width="2"/></g></g>'
save('outdoor-leaves','外の木：幹は静止し、葉が風で舞う','outdoor',body,'.fall{opacity:0;animation:fall 5s ease-in-out infinite}.leaf1{animation-delay:-2.5s}@keyframes fall{0%{opacity:0;transform:translate(0,-15px) rotate(-15deg)}15%{opacity:1}70%{opacity:1}100%{opacity:0;transform:translate(18px,110px) rotate(65deg)}}',['two falling leaves outside the tree'],[240,350,275,405],5)
# No bedding or cot motion. Night/rest symbols stay outside the empty cot.
body='<path d="M390 25 A38 38 0 1 0 433 77 A29 29 0 0 1 390 25Z" fill="url(#gold)"/>'
for i,(x,y,r) in enumerate([(110,65,10),(220,42,8),(315,85,8)]):body+=f'<g class="star s{i}">'+star(x,y,r)+'</g>'
body+=image('assets/visual-cue/artwork/stills/sleep.webp')
save('sleep-stars','ねんね：寝床は静止し、外側の星がまたたく','sleep',body,'.star{opacity:.3;transform:scale(.8);animation:twinkle 4.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.s1{animation-delay:-1.6s}.s2{animation-delay:-3.2s}@keyframes twinkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}',['three stars outside the empty cot'],[100,220,350,390],4.8)
# The rattle handle/ring stay still; the clapper moves inside the ring, with sound arcs.
toy='assets/visual-cue/artwork/stills/toy.webp'
body='<defs><mask id="rattle-body"><rect width="512" height="512" fill="white"/><circle cx="272" cy="177" r="64" fill="black"/></mask><clipPath id="bell"><circle cx="272" cy="177" r="64"/></clipPath></defs>'
body+=image(toy,'mask="url(#rattle-body)"')+'<g class="bell">'+image(toy,'clip-path="url(#bell)"')+'</g>'
body+='<g class="sound" fill="none" stroke="#54b5d1" stroke-width="7" stroke-linecap="round"><path d="M128 145 Q108 174 128 204"/><path d="M409 140 Q433 172 409 207"/></g>'
save('toy-rattle','ガラガラ：輪と柄は静止し、中の鈴が動く','toy',body,'.bell{transform:rotate(-6deg);transform-origin:272px 125px;animation:bell 1.6s ease-in-out infinite}.sound{opacity:.1;animation:sound 1.6s ease-in-out infinite}@keyframes bell{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}@keyframes sound{0%,50%,100%{opacity:.1}25%,75%{opacity:.9}}',['inner bell rotates about its top attachment','sound arcs'],[130,335,170,400],1.6)
# Isolated ball from the preserved rig: rolling is an object action, not a scene wobble.
ball=data('assets/visual-cue/artwork/parts/v3-grip-ball.png')
body='<ellipse cx="256" cy="371" rx="150" ry="9" fill="#ad905b" opacity=".10"/><g class="roll"><g class="spin"><image href="'+ball+'" x="-65" y="-65" width="130" height="130"/></g></g>'
save('toy-roll','ボール：床の上を左右に転がる','toy',body,'.roll{transform:translate(145px,306px);animation:roll 4s ease-in-out infinite}.spin{transform:rotate(0deg);animation:spin 4s ease-in-out infinite}@keyframes roll{0%,100%{transform:translate(145px,306px)}50%{transform:translate(367px,306px)}}@keyframes spin{0%,100%{transform:rotate(0deg)}50%{transform:rotate(195deg)}}',['ball translation along a fixed floor','ball rotation follows travel'],[240,374,270,378],4)
# Water and bubbles cross a complete, unchanged approved hand. No finger bending.
body=image('assets/visual-cue/artwork/stills/hands-open-v2.webp')
for i,x in enumerate([205,240,278,310]):body+=f'<g class="water" style="animation-delay:-{i*.3}s"><path d="M{x} 130 Q{x-9} 145 {x} 151 Q{x+9} 145 {x} 130Z" fill="#60c6ed" opacity=".8"/></g>'
for i,(x,y) in enumerate([(213,275),(280,310),(320,280)]):body+=f'<circle class="bubble" style="animation-delay:-{i*.6}s" cx="{x}" cy="{y}" r="10" fill="#d8f3fc" fill-opacity=".5" stroke="#8cd4e7" stroke-width="2"/>'
save('hand-wash','手洗い：手はそのまま、水滴と泡が流れる','hands-open-v2',body,'.water{opacity:0;transform:translateY(-60px);animation:water 1.8s linear infinite}.bubble{opacity:.2;animation:bubble 2.8s ease-in-out infinite}@keyframes water{0%{transform:translateY(-60px);opacity:0}15%,70%{opacity:1}100%{transform:translateY(175px);opacity:0}}@keyframes bubble{0%,100%{opacity:.2}50%{opacity:.8}}',['water drops descend over the intact hand','three soap bubbles'],[230,390,275,420],2.8)
(O/'manifest.json').write_text(json.dumps(dict(schemaVersion=1,status='candidate-motion-over-approved-illustrations',approval='Original illustrations remain approved; new motion is user-review-pending.',assets=assets),ensure_ascii=False,indent=2)+'\n')
print('Native motion candidates:',len(assets))
