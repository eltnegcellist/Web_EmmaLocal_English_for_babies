#!/usr/bin/env python3
"""Decode every delivered WebP; measure technical quality, never semantic approval."""
from pathlib import Path
import json, hashlib, statistics
import numpy as np
from PIL import Image, ImageChops, ImageDraw
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/visual-cue/artwork'
m=json.loads((OUT/'manifest.json').read_text());rigs=json.loads((OUT/'qa/motion-traces.json').read_text())
results=[];failures=[]
def composited(im,bg=(246,243,235)):
 b=Image.new('RGBA',im.size,bg+(255,));b.alpha_composite(im);return np.asarray(b.convert('RGB')).astype(np.int16)
def diff(a,b):return float(np.abs(a-b).mean())
for row in m['assets']:
 path=OUT/(row['animation'] or row['illustration']);im=Image.open(path);frames=[];dur=[]
 for i in range(getattr(im,'n_frames',1)):
  im.seek(i);frames.append(im.convert('RGBA'));dur.append(im.info.get('duration',0))
 errors=[];warn=[]
 if im.size!=(512,512):errors.append('not-512-square')
 for f in frames:
  a=np.asarray(f)[:,:,3]
  if a.min()!=0 or a.max()<240:errors.append('invalid-alpha')
  if max(a[:4].max(),a[-4:].max(),a[:,:4].max(),a[:,-4:].max())>12:errors.append('clipped-at-border')
  if (a>32).mean()>.85:errors.append('possible-baked-background')
 r=dict(id=row['id'],file=str(path.relative_to(OUT)),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),bytes=path.stat().st_size,frames=len(frames),alphaRange=list(frames[0].getchannel('A').getextrema()),errors=errors,warnings=warn)
 r['sizeTargetBytes']=400_000 if row['animation'] else 150_000
 if r['bytes']>r['sizeTargetBytes']:warn.append('size-target-exceeded-preserve-visual-quality')
 # Check poster separately, including actual RGBA alpha and dimensions.
 poster=Image.open(OUT/row['poster']).convert('RGBA')
 if poster.size!=(512,512) or poster.getchannel('A').getextrema()[0]!=0:errors.append('invalid-poster')
 if row['animation']:
  r['durationMs']=sum(dur);r['loop']=im.info.get('loop');r['renderFps']=1000/83;r['decodedFramesPerSecond']=len(frames)/(sum(dur)/1000)
  if not 2500<=sum(dur)<=4000:errors.append('duration-out-of-range')
  if len(frames)<3:errors.append('not-animated')
  if im.info.get('loop')!=0:errors.append('not-looping')
  arrays=[composited(f) for f in frames];deltas=[diff(a,b) for a,b in zip(arrays,arrays[1:])];seam=diff(arrays[-1],arrays[0]);r['seamMeanRGBDelta']=round(seam,4);r['maxAdjacentMeanRGBDelta']=round(max(deltas),4)
  r['seamToMaxAdjacentRatio']=round(seam/max(max(deltas),.001),4)
  if seam>max(deltas)*1.8+.08:errors.append('loop-discontinuity')
  low=[composited(f.resize((220,220),Image.Resampling.LANCZOS)) for f in frames]
  union=np.zeros((220,220),bool)
  for a in low[1:]:union|=np.max(np.abs(a-low[0]),axis=2)>18
  r['changedPixelsAt220']=int(union.sum());r['changedFractionAt220']=round(float(union.mean()),4)
  if union.sum()<150:errors.append('imperceptible-motion-at-220')
  r['maxFrameMeanLuminanceStep']=round(max(abs(float(a.mean())-float(b.mean())) for a,b in zip(arrays,arrays[1:])),4)
  if r['maxFrameMeanLuminanceStep']>20:errors.append('large-luminance-jump')
  region=rigs[row['id']]['stationaryRegion']
  if region:
   x1,y1,x2,y2=region;areas=[a[y1:y2,x1:x2] for a in arrays];motion=max(diff(areas[0],v) for v in areas)
   r['stationaryRegionMaxRGBDelta']=round(motion,4)
   r['stationaryRegionOpaquePixels']=int((np.asarray(frames[0])[:,:,3][y1:y2,x1:x2]>32).sum())
   if motion>6:errors.append('stationary-part-moved-or-occluded')
   if r['stationaryRegionOpaquePixels']<20:errors.append('empty-stationary-test-region')
  # Extraction of actual decoded frames at five phases, for alpha/ghosting visual inspection.
  sheet=Image.new('RGB',(1100,260),'#eae5d9');d=ImageDraw.Draw(sheet)
  for j,k in enumerate([0,len(frames)//6,len(frames)//3,len(frames)//2,len(frames)*5//6]):
   f=frames[k].resize((220,220),Image.Resampling.LANCZOS);sheet.paste(f,(j*220,20),f);d.text((j*220+8,240),f'frame {k}',fill='black')
  sheet.save(OUT/'qa'/f'{row["id"]}-filmstrip.jpg',quality=88)
 r['errors']=sorted(set(errors));r['technicalPass']=not errors;results.append(r)
 if errors:failures.append(dict(id=row['id'],errors=r['errors']))
# Verify action-specific visible pixels, independently of the animation parameter traces.
invariants=[]
clap=Image.open(OUT/'animations/hand-clap.webp');contactRows=[];openFrames=0
for i in range(clap.n_frames):
 clap.seek(i);a=np.asarray(clap.convert('RGBA'))[:,:,3]
 contactRows.append(int(((a[195:300,255]>100)&(a[195:300,256]>100)).sum()))
 if not (a[195:300,250:262]>100).any():openFrames+=1
invariants.append(dict(name='clap-palms-contact-and-separate',pass_=max(contactRows)>40 and openFrames>2,maxContactRows=max(contactRows),separatedFrames=openFrames))
toy=np.asarray(Image.open(OUT/'parts/peekaboo-toy.png'))[:,:,3]>100
cloth=Image.open(OUT/'parts/peekaboo-cloth.png');hide=np.asarray(cloth)[:,:,3]>100
reveal=np.asarray(cloth.transform((512,512),Image.Transform.AFFINE,(1,0,0,0,1,220)))[:,:,3]>100
covered=float((toy&hide).sum()/toy.sum());uncovered=float((toy&~reveal).sum()/toy.sum())
invariants.append(dict(name='peekaboo-hidden-and-revealed',pass_=covered>.99 and uncovered>.99,hiddenFraction=covered,revealedFraction=uncovered))
left=Image.open(OUT/'parts/kick-left.png');right=Image.open(OUT/'parts/kick-right.png');overlap=[]
for i in range(36):
 import math
 angle=12*math.sin(2*math.pi*i/36)
 la=np.asarray(left.rotate(angle,Image.Resampling.BICUBIC,center=(140,380)))[:,:,3]>100
 ra=np.asarray(right.rotate(-angle,Image.Resampling.BICUBIC,center=(372,380)))[:,:,3]>100
 overlap.append(int((la&ra).sum()))
invariants.append(dict(name='kick-feet-do-not-collide',pass_=max(overlap)==0,maxOverlapPixels=max(overlap)))
for item in invariants:
 if not item['pass_']:failures.append(dict(id=item['name'],errors=['action-specific-pixel-check-failed']))

# Structural checks from source of truth, full Cue inventory and status integrity.
plan=json.loads((ROOT/'shared/visual-cue-asset-plan.json').read_text())
assert {r['primitive'] for r in m['concepts']}=={r['id'] for r in plan['primitives']}
assert {r['cueId'] for r in m['cueCoverage']}=={r['cueId'] for r in plan['bindings']}
assert len(m['concepts'])==31 and len(m['cueCoverage'])==58
assert not any(r['status']=='accepted' for r in m['assets'])
assert all('superseded' not in str(r['source']) and 'motion-drafts' not in str(r['source']) for r in m['assets'])
# Compare masked cream pixels in bowl and loaded spoon; validate source color, not thumbnail background.
meal=np.asarray(Image.open(OUT/'sources/generated/meal-layers.png').convert('RGBA'));h,w=meal.shape[:2]
cream=(meal[:,:,0]>210)&(meal[:,:,1]>195)&(meal[:,:,2]>150)&(meal[:,:,3]>200)&(meal[:,:,0]>=meal[:,:,1])
colors=[]
for mask in [cream&(np.indices(cream.shape)[1]<w//2),cream&(np.indices(cream.shape)[1]>w//2)]:colors.append(np.median(meal[:,:,:3][mask],axis=0).tolist())
colorGap=float(np.linalg.norm(np.array(colors[0])-np.array(colors[1])))
report=dict(scope='技術検査のみ。意味・人体・輪郭の自然さ・採用承認・914英文は保証しない。',passed=not failures,actionPixelChecks=invariants,assetCount=len(results),technicalPassCount=sum(r['technicalPass'] for r in results),failures=failures,creamPorridge=dict(bowlMedianRGB=colors[0],spoonMedianRGB=colors[1],distance=colorGap,pass_=colorGap<30),results=results)
(OUT/'qa/validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='results'},ensure_ascii=False,indent=2))
raise SystemExit(0 if report['passed'] else 1)
