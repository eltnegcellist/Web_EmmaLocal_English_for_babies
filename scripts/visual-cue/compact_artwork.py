#!/usr/bin/env python3
"""Reduce redundant alpha precision on oversized loops; retain 512px, timing and motion.
RGBA PNG originals and deterministic part rigs remain the editable source of truth.
"""
from pathlib import Path
import json,hashlib,io
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/visual-cue/artwork';m=json.loads((OUT/'manifest.json').read_text());report=[]
def composite(im,bg):
 b=Image.new('RGBA',im.size,bg+(255,));b.alpha_composite(im);return np.asarray(b.convert('RGB').resize((220,220),Image.Resampling.LANCZOS)).astype(int)
for a in m['assets']:
 if not a['animation']:continue
 p=OUT/a['animation'];original=p.read_bytes()
 if len(original)<=400000:continue
 if a.get('lossless'):raise RuntimeError('Keep lossless static-scene encoding; optimize its keyframes instead: '+a['id'])
 im=Image.open(io.BytesIO(original));fs=[];dur=[]
 for i in range(im.n_frames):im.seek(i);fs.append(im.convert('RGBA'));dur.append(im.info['duration'])
 for alpha in [90,80,70,60]:
  encoded=io.BytesIO();fs[0].save(encoded,format="WEBP",save_all=True,append_images=fs[1:],duration=dur,loop=0,quality=64,alpha_quality=alpha,method=4)
  data=encoded.getvalue()
  if len(data)>400000:continue
  check=Image.open(io.BytesIO(data));errors=[]
  assert check.n_frames==len(fs)
  for i in range(check.n_frames):
   check.seek(i);frame=check.convert('RGBA')
   for bg in [(246,243,235),(35,55,60)]:errors.append(np.abs(composite(fs[i],bg)-composite(frame,bg)))
  mean=float(np.mean([e.mean() for e in errors]));percentile=float(np.percentile(np.concatenate([e.flatten() for e in errors]),95))
  if mean>3 or percentile>10:continue
  p.write_bytes(data);report.append(dict(id=a['id'],beforeBytes=len(original),afterBytes=len(data),alphaQuality=alpha,meanRGBErrorAt220=round(mean,3),p95RGBErrorAt220=percentile,beforeSHA256=hashlib.sha256(original).hexdigest(),afterSHA256=hashlib.sha256(data).hexdigest(),timingAndDimensionsPreserved=True));break
 else:raise RuntimeError('No acceptable encoding below 400KB: '+a['id'])
if report:(OUT/'qa/encoding-improvements.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
