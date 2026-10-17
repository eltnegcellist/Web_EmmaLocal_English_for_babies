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
  sampleFrames=[min(len(frames)-1,int(np.searchsorted(np.cumsum(dur),ms))) for ms in [500,1000,1500,2000,2500]] if row['id']=='hand-count' else [0,len(frames)//6,len(frames)//3,len(frames)//2,len(frames)*5//6]
  for j,k in enumerate(sampleFrames):
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
# New articulated-hand and care rigs: inspect decoded foreground connectivity and contact.
if any(a.get('productionPass')==2 for a in m['assets']):
 def flood_connected(mask,seed):
  f=Image.fromarray((mask.astype(np.uint8)*255)).copy();ImageDraw.floodfill(f,seed,128);return np.asarray(f)==128
 hand=Image.open(OUT/'animations/hand-open-close.webp');detached=[];indexTops=[]
 for i in range(hand.n_frames):
  hand.seek(i);a=np.asarray(hand.convert('RGBA'))[:,:,3]>100;connected=flood_connected(a,(256,430));detached.append(int((a&~connected).sum()))
  ys=np.where(a[:,179:194])[0];indexTops.append(int(ys.min()))
 invariants.append(dict(name='open-close-fingers-connected-to-palm',pass_=max(detached)<45,maxDetachedPixels=max(detached)))
 invariants.append(dict(name='index-finger-visible-joint-travel',pass_=max(indexTops)-min(indexTops)>70,travelPixels=max(indexTops)-min(indexTops)))
 counting=Image.open(OUT/'animations/hand-count.webp');counts=set()
 for i in range(counting.n_frames):
  counting.seek(i);alpha=np.asarray(counting.convert('RGBA'))[:,:,3]>100
  counts.add(sum(bool(alpha[:215,x-6:x+6].any()) for x in [186,236,286,333]))
 invariants.append(dict(name='count-visible-zero-to-four-upright-fingers',pass_=counts==set(range(5)),observedCounts=sorted(counts)))
 tapping=Image.open(OUT/'animations/hand-tap.webp');connectedFrames=0;separatedFrames=0
 for i in range(tapping.n_frames):
  tapping.seek(i);a=np.asarray(tapping.convert('RGBA'))[:,:,3]>100;connected=flood_connected(a,(256,420))
  if connected[170,256]:connectedFrames+=1
  else:separatedFrames+=1
 invariants.append(dict(name='tap-hand-contacts-and-leaves-target',pass_=connectedFrames>0 and separatedFrames>0,contactFrames=connectedFrames,separatedFrames=separatedFrames))
 intact=np.asarray(Image.open(OUT/'parts/v2-diaper-intact-body.png'))[:,:,3]>100
 diaper=Image.open(OUT/'animations/change-diaper-v2.webp');missing=[];loose=[]
 for i in range(diaper.n_frames):
  diaper.seek(i);a=np.asarray(diaper.convert('RGBA'))[:,:,3]>100
  missing.append(int((intact&~a).sum()));conn=flood_connected(a,(256,320));loose.append(int((a&~conn).sum()))
 invariants.append(dict(name='diaper-v2-no-missing-body-or-floating-tabs',pass_=max(missing)<30 and max(loose)<80,maxMissingBodyPixels=max(missing),maxDetachedTabPixels=max(loose)))
 z=Image.open(OUT/'animations/change-zipper.webp');gapWidths=[]
 for i in range(z.n_frames):
  z.seek(i);a=np.asarray(z.convert('RGBA'));lining=(a[260,:,0]>190)&(a[260,:,1]>175)&(a[260,:,3]>100)
  gapWidths.append(int(lining[205:307].sum()))
 invariants.append(dict(name='zipper-closes-visible-lining-gap',pass_=max(gapWidths)-min(gapWidths)>35,liningWidthRange=[min(gapWidths),max(gapWidths)]))

# Human-feedback regressions: decoded content and connectivity, not approval of anatomy/meaning.
if m.get('productionPass',0)>=4:
 def decoded4(key):
  im=Image.open(OUT/'animations'/f'{key}.webp');fs=[]
  for i in range(im.n_frames):im.seek(i);fs.append(np.asarray(im.convert('RGBA')).astype(int))
  return fs
 def peach4(a):return (a[:,:,0]>170)&(a[:,:,0]-a[:,:,2]>30)&(a[:,:,1]>100)&(a[:,:,3]>100)
 k=decoded4('kick')[0];toeMeans=[]
 for x1,x2 in [(75,205),(307,437)]:
  mask=k[:,:,3]>100;roi=mask[:,x1:x2];top=int(np.where(roi)[0].min());ys,xs=np.where(roi[top:top+17]);toeMeans.append(float(xs.mean()+x1))
 invariants.append(dict(name='kick-big-toes-face-the-center',pass_=toeMeans[0]>145 and toeMeans[1]<367,highestToeMeanX=toeMeans))
 oldHand=np.asarray(Image.open(OUT/'archive/2026-10-18/stills/hands-open-v2.webp').convert('RGBA')).astype(int)
 newHand=np.asarray(Image.open(OUT/'stills/hands-open-v2.webp').convert('RGBA')).astype(int)
 centroids=[]
 for a in [oldHand,newHand]:
  mask=peach4(a);mask[:,:116]=False;mask[:,151:]=False;centroids.append(float(np.where(mask)[0].mean()))
 invariants.append(dict(name='thumb-protrusion-raised-away-from-wrist',pass_=centroids[0]-centroids[1]>30,oldY=round(centroids[0],2),newY=round(centroids[1],2)))
 pages=decoded4('page');pear=[];fish=[]
 for a in pages:
  c=a[225:345,90:215];pear.append(int(((c[:,:,1]>c[:,:,0]+15)&(c[:,:,1]>c[:,:,2]+25)&(c[:,:,3]>100)).sum()))
  c=a[165:310,290:430];fish.append(int(((c[:,:,0]>210)&(c[:,:,1]>80)&(c[:,:,1]<205)&(c[:,:,2]<115)&(c[:,:,3]>100)).sum()))
 invariants.append(dict(name='page-reveals-different-left-and-right-art',pass_=max(pear)>5000 and min(pear)<300 and max(fish)-min(fish)>8000,pearPixelsRange=[min(pear),max(pear)],fishPixelsRange=[min(fish),max(fish)]))
 grip=decoded4('hand-squeeze-v3');palmCounts=[]
 for a in grip:
  mask=peach4(a);palmCounts.append(int(mask[290:365,150:300].sum()))
 invariants.append(dict(name='grip-lower-palm-remains-visible',pass_=min(palmCounts)>5000,lowerPalmPixelsRange=[min(palmCounts),max(palmCounts)]))
 for key in ['hug-arms','care-burp']:
  fs=decoded4(key);heads=[]
  for a in fs:
   c=a[70:260,170:370];heads.append(int(((c[:,:,0]<160)&(c[:,:,1]<120)&(c[:,:,2]<100)&(c[:,:,3]>100)).sum()))
  invariants.append(dict(name=key+'-retains-caregiver-and-child-context',pass_=min(heads)>10000,darkHairContextPixelsRange=[min(heads),max(heads)],scope='文脈の退行検出。首の支えや医学的適否の自動承認ではない。'))
 sleeves=decoded4('dress-sleeves');detached=[];areas=[]
 for a in sleeves:
  solid=a[:,:,3]>100;conn=flood_connected(solid,(256,360));detached.append(int((solid&~conn).sum()))
  skin=peach4(a);areas.append([int(skin[270:333,45:165].sum()),int(skin[270:333,347:467].sum())])
 areas=np.array(areas)
 invariants.append(dict(name='sleeves-no-detached-fingers-or-neck-fragments',pass_=max(detached)<50,maxDetachedPixels=max(detached)))
 invariants.append(dict(name='sleeves-left-arm-emerges-before-right',pass_=bool(((areas[:,0]>2500)&(areas[:,1]<300)).any()) and bool((areas>2500).all(axis=1).any()),leftRange=[int(areas[:,0].min()),int(areas[:,0].max())],rightRange=[int(areas[:,1].min()),int(areas[:,1].max())]))
 dress=decoded4('change-clothes');heads=[];undershirt=[];teal=[];headRetained=[]
 reference=np.asarray(Image.open(OUT/'parts/v4-dressing-body.png').convert('RGBA'))[:,:,3]>100
 reference[:90]=False;reference[250:]=False;reference[:,:165]=False;reference[:,345:]=False
 for a in dress:
  headRetained.append(float(((a[:,:,3]>100)&reference).sum()/reference.sum()))
  c=a[95:245,175:337];heads.append(int(((c[:,:,0]<155)&(c[:,:,1]<115)&(c[:,:,2]<95)&(c[:,:,3]>100)).sum()))
  c=a[320:390,220:290];undershirt.append(int(((c[:,:,0]>205)&(abs(c[:,:,0]-c[:,:,2])<18)&(c[:,:,3]>100)).sum()));teal.append(int(((c[:,:,1]>100)&(c[:,:,0]<120)&(c[:,:,2]>130)&(c[:,:,3]>100)).sum()))
 invariants.append(dict(name='dressing-head-and-covered-torso-remain',pass_=min(headRetained)>.99 and min(heads)>2000 and max(undershirt)>3500 and max(teal)>3500,headRange=[min(heads),max(heads)],headSilhouetteRetained=min(headRetained),undershirtRange=[min(undershirt),max(undershirt)],tealRange=[min(teal),max(teal)]))
 wake=decoded4('wake-quilt');outside=[];tops=[]
 for a in wake:
  blue=(a[:,:,2]>a[:,:,0]+35)&(a[:,:,3]>100);roi=np.zeros_like(blue);roi[184:423,140:372]=True;outside.append(int((blue&~roi).sum()));tops.append(int(np.where(blue)[0].min()))
 invariants.append(dict(name='quilt-stays-on-mattress-inside-wood-frame',pass_=max(outside)<30 and max(tops)-min(tops)>85,maxBluePixelsOutsideMattress=max(outside),blueTopRange=[min(tops),max(tops)]))
 for kind,total in [('illustration',14),('animation',10)]:
  cs=[c for c in m['concepts'] if c['kind']==kind];invariants.append(dict(name=f'all-{total}-{kind}-concepts-have-candidates',pass_=len(cs)==total and all(c['readiness']=='candidate' for c in cs)))
 invariants.append(dict(name='rejected-user-review-versions-excluded-from-active-gallery',pass_=sum(a.get('reviewBatch')=='2026-10-18' and a['status']=='rejected' for a in m['archivedAssets'])==17 and not any(a['status']=='rejected' for a in m['assets'])))
 invariants.append(dict(name='corpus-scene-review-covers-all-914-sets',pass_=json.loads((OUT/'qa/usage-audit.json').read_text())['totalSets']==914 and len(m['commonAssetIds'])>15))

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
