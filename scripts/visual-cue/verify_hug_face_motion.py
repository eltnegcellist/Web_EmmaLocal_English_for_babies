#!/usr/bin/env python3
"""Check the actual delivered animated WebP, independently of rendered sources."""
from pathlib import Path
from PIL import Image
import hashlib,json,numpy as np
R=Path(__file__).resolve().parents[2];P=R/'assets/visual-cue/prototypes/hug-face'
m=json.loads((P/'manifest.json').read_text());a=m['motion'];assert m['humanApproval'] and m['status']=='accepted-still' and a['status']=='motion-candidate'
p=R/a['animation'];im=Image.open(p);assert im.is_animated and im.size==(512,512) and im.info['loop']==0
frames=[];duration=0
for f in range(im.n_frames):im.seek(f);im.load();duration+=im.info.get('duration',0);frames.append(np.array(im.convert('RGBA')).astype(int))
assert duration==a['loopMs']==3200
visible=lambda x:np.concatenate([x[:,:,:3]*x[:,:,3:4],x[:,:,3:4]*255],axis=2)
shown=[visible(x) for x in frames]
assert max(int(np.abs(x[:280]-shown[0][:280]).max()) for x in shown)==0
assert np.array_equal(shown[0],shown[-1])
assert max(np.count_nonzero(np.any(np.abs(x-shown[0])>8*255,axis=2)) for x in shown)>800
assert all(np.all(x[[0,0,511,511],[0,511,0,511],3]==0) for x in frames)
poster=np.array(Image.open(R/a['poster']).convert('RGBA')).astype(int);assert np.array_equal(visible(poster),shown[0])
assert hashlib.sha256((R/m['illustration']).read_bytes()).hexdigest()==m['sha256']==a['sourceSHA256']
record=json.loads((R/a['verification']).read_text());assert record['passed'] and record['animationSHA256']==hashlib.sha256(p.read_bytes()).hexdigest()
result=dict(passed=True,encodedFrames=len(frames),durationMs=duration,visibleFaceMaxDelta=0,firstLastVisiblePixelsIdentical=True,posterMatchesFirstFrame=True,transparentCorners=True,originalPNGUnchanged=True,animationBytes=p.stat().st_size)
(P/'qa/motion-delivery-validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
