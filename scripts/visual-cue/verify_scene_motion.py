#!/usr/bin/env python3
"""Pixel QA of browser-rendered part animations; never edits illustration sources."""
from pathlib import Path
import json,numpy as np
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[2];O=R/'assets/visual-cue/motion-variants/qa'
m=json.loads((O.parent/'manifest.json').read_text());checks=[]
grid=Image.new('RGB',(1024,len(m['assets'])*540),'#f7f6ef');draw=ImageDraw.Draw(grid)
for i,a in enumerate(m['assets']):
 ims=[Image.open(O/(a['id']+'-'+p+'.png')).convert('RGBA') for p in ['before','after']]
 aa,bb=[np.array(im).astype(int) for im in ims];diff=np.abs(aa-bb);x0,y0,x1,y1=a['stationaryRegion'];stable=diff[y0:y1,x0:x1]
 assert stable.max()==0,(a['id'],'stationary part moved')
 changed=int(np.count_nonzero(diff.max(2)>8));assert changed>25,(a['id'],'no visible local movement')
 assert np.all(aa[:20,:20,3]==0) and np.all(bb[:20,:20,3]==0),(a['id'],'opaque corner')
 checks.append(dict(id=a['id'],changedPixels=changed,stationaryMaxDelta=int(stable.max()),transparentCorners=True))
 for j,im in enumerate(ims):grid.paste(im,(j*512,i*540+24),im)
 draw.text((10,i*540+5),a['id'],fill='#333333')
(O/'pixel-report.json').write_text(json.dumps(dict(passed=True,checks=checks),indent=2)+'\n');grid.save(O/'six-motion-comparison.png')
print('Scene motion pixels: 6 local changes, fixed subjects and transparent corners PASS')
