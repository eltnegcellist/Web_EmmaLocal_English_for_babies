#!/usr/bin/env python3
"""Encode browser-rendered PNG frames without editing pixels; validate motion."""
from pathlib import Path
from PIL import Image
import json,hashlib,numpy as np
R=Path(__file__).resolve().parents[2];P=R/'assets/visual-cue/prototypes/hug-face';O=R/'assets/visual-cue/motion-variants'
frames=[Image.open(p).convert('RGBA') for p in sorted((P/'frames').glob('*.png'))];assert len(frames)==40
qa=P/'qa';qa.mkdir(exist_ok=True)
a=np.array(frames[0]).astype(int);b=np.array(frames[17]).astype(int);d=np.abs(a-b)
# A complete band above the arms includes both faces. It must be pixel-identical.
assert d[:280].max()==0,'Heads/faces moved'
assert d[300:470,240:460].max()>0,'No arm motion'
assert np.count_nonzero(np.any(d>8,axis=2))>800,'Arm action is too small'
assert np.array_equal(np.array(frames[0]),np.array(frames[-1])),'Loop does not return to the poster'
for im in frames:
 assert all(im.getpixel(p)[3]==0 for p in [(0,0),(511,0),(0,511),(511,511)])
frames[0].save(O/'hug-face-cuddle-poster.webp',format='WEBP',lossless=True)
frames[0].save(O/'hug-face-cuddle.webp',format='WEBP',save_all=True,append_images=frames[1:],duration=80,loop=0,lossless=True,quality=100,method=6,minimize_size=True)
im=Image.open(O/'hug-face-cuddle.webp');assert im.is_animated and im.n_frames>1
# Decode delivery bytes to check animation, alpha and duration as actually served.
count=im.n_frames;duration=0;decoded=[]
for f in range(count):
 im.seek(f);im.load();duration+=im.info.get('duration',0);decoded.append(np.array(im.convert('RGBA')).astype(int))
assert duration==3200,duration
visible=lambda x:np.concatenate([x[:280,:,:3]*x[:280,:,3:4],x[:280,:,3:4]*255],axis=2)
encoded_delta=max(int(np.abs(visible(x)-visible(decoded[0])).max()) for x in decoded)
assert encoded_delta==0,'Compression introduced face flicker'
assert all(np.all(x[[0,0,511,511],[0,511,0,511],3]==0) for x in decoded)
report=dict(passed=True,frameCount=40,encodedFrames=count,durationMs=duration,format='lossless animated WebP RGBA',size=[512,512],bytes=(O/'hug-face-cuddle.webp').stat().st_size,posterBytes=(O/'hug-face-cuddle-poster.webp').stat().st_size,sourceFaceMaxDelta=int(d[:280].max()),encodedVisibleFaceMaxDelta=encoded_delta,movingPixels=int(np.count_nonzero(np.any(d>8,axis=2))),loopEndpointsIdentical=True,transparentCorners=True,animationSHA256=hashlib.sha256((O/'hug-face-cuddle.webp').read_bytes()).hexdigest(),animationApproval='candidate; user approval pending')
(qa/'motion-validation.json').write_text(json.dumps(report,indent=2)+'\n')
# Preserve comparison keyframes directly from the browser output; no artwork edits.
for n in [0,9,17,27,39]:frames[n].save(qa/f'motion-{n:02}.png')
print(json.dumps(report,indent=2))
