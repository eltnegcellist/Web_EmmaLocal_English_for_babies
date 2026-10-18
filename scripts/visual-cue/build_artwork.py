#!/usr/bin/env python3
"""Rebuild non-runtime Visual Cue candidates from preserved raster sources. No AI/network calls."""
from pathlib import Path
import hashlib, json, math, zipfile, os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageChops, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/visual-cue/artwork'
REF = OUT / 'reference/artwork'
GEN = OUT / 'sources/generated'
SIZE, FRAMES, MS = 512, 36, 83
EXPECTED = '73f04e328dc5aed60f810d6a3b4fcfa93f79e65030db2fb3c3b0c90165c6a700'
for d in ['stills','animations','posters','sources/normalized','parts','qa/keyframes']:
    (OUT/d).mkdir(parents=True,exist_ok=True)
archive = ROOT/'assets/visual-cue/handoff/visual-cue-artwork-v1.zip'
assert hashlib.sha256(archive.read_bytes()).hexdigest() == EXPECTED
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    # Original ZIP is the immutable backup; never overwrite extracted edits.
    for n in z.namelist():
        target = OUT/'reference'/n
        assert not Path(n).is_absolute() and '..' not in Path(n).parts
        if not target.exists():
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(z.read(n))


def blank(): return Image.new('RGBA',(SIZE,SIZE))
def read(p): return Image.open(p).convert('RGBA')
def bbox(im): return im.getchannel('A').point(lambda p:255 if p>12 else 0).getbbox()
def trim(im): return im.crop(bbox(im))
def fit(im,wh=(400,400)):
    im=trim(im); im.thumbnail(wh,Image.Resampling.LANCZOS);return im

def place(canvas,im,xy):
    canvas.alpha_composite(im,(round(xy[0]),round(xy[1])));return canvas

def centered(im,wh=(400,400),center=(256,256)):
    im=fit(im,wh);return place(blank(),im,(center[0]-im.width/2,center[1]-im.height/2))

def part(name,im):
    im.save(OUT/'parts'/f'{name}.png');return im

def components(im):
    a=np.asarray(im.getchannel('A'))>32;seen=np.zeros(a.shape,bool); result=[]
    for y,x in zip(*np.where(a)):
        if seen[y,x]:continue
        q=deque([(int(x),int(y))]);seen[y,x]=True;pts=[]
        while q:
            px,py=q.popleft();pts.append((px,py))
            for nx,ny in [(px-1,py),(px+1,py),(px,py-1),(px,py+1)]:
                if 0<=nx<a.shape[1] and 0<=ny<a.shape[0] and a[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;q.append((nx,ny))
        if len(pts)<30:continue
        mask=Image.new('L',im.size);p=np.array(pts);ar=np.zeros(a.shape,np.uint8);ar[p[:,1],p[:,0]]=255
        # Preserve antialiased fringes without any rectangular crop edges.
        mask=Image.fromarray(ar).filter(ImageFilter.MaxFilter(3)); c=im.copy();c.putalpha(ImageChops.multiply(im.getchannel('A'),mask));result.append((len(pts),c))
    return [v for _,v in sorted(result,key=lambda v:-v[0])]

def largest(im):return components(im)[0]

def rotate(layer,angle,pivot):return layer.rotate(angle,Image.Resampling.BICUBIC,center=pivot)
def slide(layer,x=0,y=0):return layer.transform(layer.size,Image.Transform.AFFINE,(1,0,-x,0,1,-y),Image.Resampling.BICUBIC)
def q(t):return (1-math.cos(2*math.pi*t))/2

ONLY_R3='--only-r3' in sys.argv
ONLY_R2='--only-r2' in sys.argv or ONLY_R3
ONLY_REVIEW='--only-review' in sys.argv or ONLY_R2
ONLY_FINAL='--only-final' in sys.argv or ONLY_REVIEW
ONLY_NEW='--only-new' in sys.argv or ONLY_FINAL
SAMPLE_ONLY=os.getenv('VISUAL_CUE_SAMPLE_ONLY')=='1'
currentPass=1
history=json.loads((OUT/'manifest.json').read_text()) if (OUT/'manifest.json').exists() else {}
previous=history if ONLY_NEW else None
archived=history.get('archivedAssets',[])
assets=([dict(a) for a in previous['assets']] if ONLY_REVIEW else [a for a in previous['assets'] if a.get('productionPass',1)<(3 if ONLY_FINAL else 2)]) if previous else []
rigs=json.loads((OUT/'qa/motion-traces.json').read_text()) if ONLY_NEW else {}
rigs={k:v for k,v in rigs.items() if any(a['id']==k for a in assets)}
def still(key,primitive,label,im,source,cues=None,origin='generated',note=''):
    im.save(OUT/'sources/normalized'/f'{key}.png')
    im.save(OUT/'stills'/f'{key}.webp',quality=86,method=6)
    row=dict(id=key,primitive=primitive,topic=label,kind='illustration',illustration=f'stills/{key}.webp',animation=None,poster=f'stills/{key}.webp',loopMs=0,source=source,origin=origin,status='needs-review',readiness='candidate',productionPass=currentPass,note=note,verification='qa/validation.json')
    assets.append(row);return im

# All animation rigs keep complete source layers, and never warp a whole scene to imply action.
def animate(key,primitive,label,render,source,moving,stationary=None,note='',readiness='candidate',frame_count=FRAMES,lossless=False):
    if SAMPLE_ONLY:
        for i in sorted(set([0,5,13,18,27,frame_count//2])):
            im,_=render(i/frame_count);assert im.size==(512,512)
            im.save(OUT/'qa/keyframes'/f'{key}-{i:02d}.png')
        return
    frames=[];traces=[]
    for i in range(frame_count):
        im,trace=render(i/frame_count);assert im.size==(512,512);frames.append(im);traces.append(trace)
    path=OUT/'animations'/f'{key}.webp'
    if not SAMPLE_ONLY:frames[0].save(path,save_all=True,append_images=frames[1:],duration=MS,loop=0,quality=64,method=6 if lossless else 4,minimize_size=lossless,allow_mixed=False,lossless=lossless)
    frames[0].save(OUT/'posters'/f'{key}.webp',quality=86,method=6)
    frames[0].save(OUT/'sources/normalized'/f'{key}-poster.png')
    # Keyframes are pixel evidence, not substitute animation deliverables.
    for i in [0,5,13,18,27]:frames[i].save(OUT/'qa/keyframes'/f'{key}-{i:02d}.png')
    rigs[key]=dict(movingParts=moving,stationaryRegion=stationary,traces=traces)
    assets.append(dict(id=key,primitive=primitive,topic=label,kind='animation',illustration=None,animation=f'animations/{key}.webp',poster=f'posters/{key}.webp',loopMs=frame_count*MS,source=source,status='needs-review',readiness=readiness,productionPass=currentPass,note=note,movingParts=moving,lossless=lossless,verification='qa/validation.json'))


if not ONLY_NEW:
    milkraw=read(REF/'approved/milk_bottle.webp').resize((512,512),Image.Resampling.LANCZOS)
    milk=largest(milkraw)
    still('milk','scene.milk','ミルク・哺乳瓶',milk,'reference/artwork/approved/milk_bottle.webp',origin='approved-design-direction')
    book=read(REF/'approved/picture_book.webp').resize((512,512),Image.Resampling.LANCZOS)
    still('book','scene.book','絵本',book,'reference/artwork/approved/picture_book.webp',origin='approved-design-direction')
    still('hands','scene.hands','手・拍手',centered(read(REF/'approved/clapping_hands.webp')),'reference/artwork/approved/clapping_hands.webp',origin='approved-design-direction')
    still('feet','scene.feet','足',centered(read(REF/'approved/kicking_feet.webp')),'reference/artwork/approved/kicking_feet.webp',origin='approved-design-direction',note='既存の絵柄方向承認。今回の足首付き動画とは原画が異なる。')
    for key,primitive,label,source in [('bath','scene.bath','浴槽','bath'),('diaper','scene.care','おむつ','diaper'),('toy','scene.toy','おもちゃ','toy'),('outdoor','scene.outdoor','外・木','outdoor'),('sun','scene.weather','日差し','sun')]:
        still(key,primitive,label,centered(read(GEN/f'{source}.png')),f'sources/generated/{source}.png')
    for key,primitive,label,src in [('clothes','scene.care','服','clothes'),('rain','scene.weather','雨','rain'),('sleep','scene.sleep','眠る・ベッド','sleep')]:
        still(key,primitive,label,centered(read(REF/f'candidates/{src}.webp')),f'reference/artwork/candidates/{src}.webp',origin='handoff-candidate',note='睡眠は就寝の物体表現。起床と同一素材で合格とはしない。' if key=='sleep' else '')
    meal=still('meal','scene.meal','白いおかゆ',centered(read(REF/'approved-style/meal_porridge.webp')),'reference/artwork/approved-style/meal_porridge.webp',origin='design-direction-accepted')
    music=still('music','scene.music','音楽・タンバリン',centered(read(GEN/'music.png')), 'sources/generated/music.png')

    hand=fit(read(GEN/'hand-wave.png'),(270,330)); handlayer=part('wave-whole-hand',place(blank(),hand,(256-hand.width/2,390-hand.height)))
    def wave(t):
        a=23*math.sin(4*math.pi*t);return rotate(handlayer,a,(256,360)),dict(angle=a,anchor=[256,360])
    animate('hand-wave','motion.hand','手を振る',wave,'sources/generated/hand-wave.png',['hand: wrist rotation'])

    profile=fit(read(GEN/'hand-clap.png'),(160,285));w,h=profile.size
    left=part('clap-left',place(blank(),profile,(256-w,125)))
    right=part('clap-right',place(blank(),ImageOps.mirror(profile),(256,125)))
    def clap(t):
        # A dwell at contact makes palm meeting visible, followed by clear separation.
        gap=72*max(0,(math.cos(4*math.pi*t)+.25)/1.25)
        im=slide(left,-gap,0);im.alpha_composite(slide(right,gap,0));return im,dict(palmGap=2*gap,left=[256-gap,250],right=[256+gap,250])
    animate('hand-clap','motion.hand','拍手：両手が接触・離れる',clap,'sources/generated/hand-clap.png',['left palm','right palm'],note='接触位置と手の見え方は採用審査待ち。')

    foot=fit(read(GEN/'foot.png'),(130,250));fw,fh=foot.size
    fl=part('kick-left',place(blank(),foot,(140-fw/2,414-fh)))
    fr=part('kick-right',place(blank(),ImageOps.mirror(foot),(372-fw/2,414-fh)))
    def kick(t):
        al=12*math.sin(2*math.pi*t);ar=-12*math.sin(2*math.pi*t)
        im=rotate(fl,al,(140,380));im.alpha_composite(rotate(fr,ar,(372,380)))
        return im,dict(leftAngle=al,rightAngle=ar,leftAnchor=[140,380],rightAnchor=[372,380])
    animate('kick','motion.kick','キック：足首を支点に左右交互',kick,'sources/generated/foot.png',['left foot at ankle','right foot at ankle'])

    # Bottle liquid: body interior mask is rotated with bottle, fill boundary stays level in world space.
    interior=Image.new('L',(512,512));d=ImageDraw.Draw(interior)
    d.polygon([(134,240),(292,286),(253,398),(190,415),(98,364)],fill=255)
    # Keep blue measurement marks on top of liquid, no clipping of shoulder/cap.
    a=np.asarray(milk);blue=(a[:,:,2]>a[:,:,0]+15)&(a[:,:,2]>140)&(a[:,:,0]<150)
    interior=ImageChops.multiply(interior,milk.getchannel('A')); part('bottle-interior-mask',interior)
    base=milk.copy();base.paste((250,246,236,255),(0,0,512,512),interior)
    marks=milk.copy();marks.putalpha(Image.fromarray((blue*255).astype(np.uint8)));part('bottle-base',base);part('bottle-marks',marks)
    def sip(t):
        angle=-94*q(t);b=rotate(base,angle,(256,256));mask=rotate(interior,angle,(256,256))
        ma=np.asarray(mask); mass=ma.sum(axis=1);cum=np.cumsum(mass); waterline=int(np.searchsorted(cum,cum[-1]*.30))
        liquid=Image.new('L',(512,512));ImageDraw.Draw(liquid).rectangle((0,waterline,511,511),fill=255)
        liquid=ImageChops.multiply(mask,liquid);b.paste((255,238,192,255),(0,0,512,512),liquid);b.alpha_composite(rotate(marks,angle,(256,256)))
        return b,dict(bottleAngle=angle,liquidSurfaceY=waterline,liquidSurfaceAngle=0)
    animate('sip','motion.sip','飲む：哺乳瓶を傾ける',sip,'reference/artwork/approved/milk_bottle.webp',['bottle tilt','horizontal milk surface'],note='乳首と液面の自然さは人の確認が必要。')

    # Inverse perspective mapping: the actual printed right page hinges on the spine.
    src=np.array([(328,235),(600,156),(654,502),(373,551)],float)*512/720
    pageMask=Image.new('L',(512,512));ImageDraw.Draw(pageMask).polygon([tuple(v) for v in src],fill=255)
    page=book.copy();page.putalpha(ImageChops.multiply(page.getchannel('A'),pageMask));part('book-right-page',page)
    def perspective(im,dst):
        A=[];B=[]
        for (x,y),(u,v) in zip(dst,src):
            A += [[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]];B += [u,v]
        c=np.linalg.solve(np.array(A),np.array(B));return im.transform((512,512),Image.Transform.PERSPECTIVE,c,Image.Resampling.BICUBIC)
    def turn(t):
        theta=math.pi*.98*q(t);c=math.cos(theta);s=math.sin(theta)
        dst=src.copy()
        for outer,hinge in [(1,0),(2,3)]:dst[outer]=src[hinge]+np.array([(src[outer,0]-src[hinge,0])*c,(src[outer,1]-src[hinge,1])*abs(c)-35*s])
        im=book.copy()
        if abs(c)>.015:
            leaf=perspective(page,dst)
            if c<0:
                back=Image.new('RGBA',(512,512),(250,241,214,255));back.putalpha(leaf.getchannel('A'));leaf=back
            im.alpha_composite(leaf)
        return im,dict(pageAngle=theta*180/math.pi,spineTop=src[0].tolist(),outerTop=dst[1].tolist())
    animate('page','motion.page','絵本：綴じ目を中心にページがめくれる',turn,'reference/artwork/approved/picture_book.webp',['right page'],stationary=[268,394,280,399],note='1枚を往復させるループ。背面はクリーム色。')

    # Rain drops use isolated raster components, cloud stays still.
    rainSrc=read(REF/'candidates/rain.webp');pcs=components(rainSrc);cloud=fit(pcs[0],(310,205));drop=fit(pcs[-1],(24,40));part('rain-drop',drop)
    cloudLayer=part('rain-cloud',place(blank(),cloud,(256-cloud.width/2,75)))
    def rainloop(t):
        im=blank();positions=[]
        for j,x in enumerate([157,221,285,349]):
            phase=(t+j*.24)%1;y=220+phase*190;alpha=math.sin(math.pi*phase)**.7
            dro=drop.copy();dro.putalpha(dro.getchannel('A').point(lambda a:round(a*alpha)));place(im,dro,(x,y));positions.append([x,y,alpha])
        im.alpha_composite(cloudLayer);return im,dict(drops=positions)
    animate('water-rain','motion.water','雨粒が雲から落ちる',rainloop,'reference/artwork/candidates/rain.webp',['rain drops'],stationary=[175,110,300,180])

    # Shower head is separated from the original shower/duck scene. Tub is a new complete source.
    bathSrc=read(REF/'candidates/bath.webp');head=largest(bathSrc.crop((0,0,235,285)));head=fit(head,(100,135));headLayer=part('shower-head',place(blank(),head,(110,48)))
    tub=fit(read(GEN/'bath.png'),(375,240));tubLayer=part('bath-tub',place(blank(),tub,(256-tub.width/2,250)))
    def shower(t):
        im=blank();pos=[]
        for j in range(6):
            phase=(t*2+j/6)%1;x=184+(j%3)*32;y=150+phase*165
            dro=drop.resize((16,26),Image.Resampling.LANCZOS);dro.putalpha(dro.getchannel('A').point(lambda a:round(a*math.sin(math.pi*phase))))
            place(im,dro,(x,y));pos.append([x,y])
        im.alpha_composite(headLayer);im.alpha_composite(tubLayer);return im,dict(waterDrops=pos)
    animate('water-shower','motion.water','シャワー：水が浴槽へ落ちる',shower,['sources/generated/bath.png','reference/artwork/candidates/bath.webp'],['shower drops'],stationary=[140,390,350,430])

    # Splash moves water itself above a fixed complete tub, not the tub or a duck.
    def splash(t):
        im=tubLayer.copy();positions=[]
        for j,x in enumerate([170,235,300]):
            phase=(t+j/3)%1; lift=math.sin(math.pi*phase)**2
            dro=drop.resize((22,34),Image.Resampling.LANCZOS);dro.putalpha(dro.getchannel('A').point(lambda a:round(a*math.sin(math.pi*phase))))
            y=285-105*lift;place(im,dro,(x,y));positions.append([x,y])
        return im,dict(splashes=positions)
    animate('water-splash','motion.water','浴槽から水しぶき',splash,'sources/generated/bath.png',['water splashes'],stationary=[140,390,350,430])

    # Real bowl, contents and spoon are complete independent original raster components.
    ml=read(GEN/'meal-layers.png');mw,mh=ml.size
    bowl=fit(ml.crop((0,0,mw//2,mh)),(330,265));spoon=fit(ml.crop((mw//2,0,mw,mh)),(188,188))
    bowlLayer=part('meal-bowl',place(blank(),bowl,(256-bowl.width/2,230)))
    part('meal-spoon-loaded',spoon)
    sp=np.asarray(spoon);sy,sx=np.indices(sp.shape[:2]);food=(sp[:,:,0]>225)&(sp[:,:,1]>205)&(sp[:,:,2]>150)&(sp[:,:,3]>80)&(sy>spoon.height*.45)&(sx<spoon.width*.65)
    foodmask=Image.fromarray(food.astype(np.uint8)*255).filter(ImageFilter.GaussianBlur(.7))
    emptyspoon=spoon.copy();emptyspoon.paste((255,194,67,255),(0,0,spoon.width,spoon.height),foodmask);part('meal-spoon-empty',emptyspoon)
    # Front wall occludes spoon below the bowl rim to imply dipping, with no holes in bowl.
    front=bowlLayer.copy();mask=Image.new('L',(512,512));ImageDraw.Draw(mask).rectangle((0,355,511,511),fill=255);front.putalpha(ImageChops.multiply(front.getchannel('A'),mask));part('meal-front-wall',front)
    def scoop(t):
        lift=q(t);im=bowlLayer.copy();x=223+38*lift;y=243-122*lift
        scoopspoon=Image.blend(emptyspoon,spoon,min(1,lift*8));place(im,scoopspoon,(x,y));im.alpha_composite(front)
        return im,dict(spoon=[x,y],bowl=[256,350],liftPx=122*lift)
    animate('spoon','motion.spoon','白いおかゆ：すくう・上げる・戻す',scoop,'sources/generated/meal-layers.png',['loaded spoon'],stationary=[160,395,330,435],note='空のスプーンを器に沈め、白いおかゆを載せて持ち上げる。器の手前壁で自然に隠す。')

    # Notes move smoothly with a beat; instrument stays completely stationary.
    mu=read(GEN/'music.png');ww,hh=mu.size
    inst=fit(mu.crop((0,round(hh*.40),ww,hh)),(310,260));instrument=part('music-instrument',place(blank(),inst,(256-inst.width/2,245)))
    notes=[]
    noteParts=sorted(components(mu.crop((0,0,ww,round(hh*.4))))[:3],key=lambda im:bbox(im)[0])
    for j,npiece in enumerate(noteParts):
        n=fit(npiece,(65,85));notes.append(part(f'music-note-{j}',n))
    def notesloop(t):
        im=instrument.copy();pos=[]
        for j,n in enumerate(notes):
            theta=2*math.pi*t+j*2*math.pi/3;x=130+j*95+10*math.sin(theta);y=110+28*math.sin(theta)
            place(im,n,(x,y));pos.append([x,y])
        return im,dict(notes=pos)
    animate('notes','motion.notes','音楽：拍に合わせて音符が動く',notesloop,'sources/generated/music.png',['three notes'],stationary=[160,320,300,400])

    # Hide/reveal a familiar toy with an opaque handkerchief. Nothing fades into existence.
    toy=fit(read(GEN/'toy.png'),(100,150));toyLayer=part('peekaboo-toy',place(blank(),toy,(256-toy.width/2,350-toy.height/2)))
    cloth=fit(read(GEN/'cloth.png'),(220,220));clothLayer=part('peekaboo-cloth',place(blank(),cloth,(256-cloth.width/2,350-cloth.height/2)))
    def peek(t):
        lift=220*q(t);im=toyLayer.copy();im.alpha_composite(slide(clothLayer,0,-lift));return im,dict(clothOffsetY=-lift,toyCenter=[256,350])
    animate('peekaboo','motion.peekaboo','いないいないばあ：布で隠す・見せる',peek,['sources/generated/toy.png','sources/generated/cloth.png'],['handkerchief'],note='scene.familyの代替承認ではなく、玩具を隠す独立variant。')

    # Diaper tabs hinge at their roots, the padded body remains stationary.
    di=read(OUT/'sources/normalized/diaper.png');a=np.asarray(di);yy,xx=np.indices(a.shape[:2]);blue=(a[:,:,0]<90)&(a[:,:,1]<190)&(a[:,:,2]>150)&(a[:,:,3]>30)
    leftMask=Image.fromarray((blue&(xx<190)&(yy<260)).astype(np.uint8)*255).filter(ImageFilter.MaxFilter(3))
    rightMask=Image.fromarray((blue&(xx>322)&(yy<260)).astype(np.uint8)*255).filter(ImageFilter.MaxFilter(3))
    tabL=di.copy();tabL.putalpha(ImageChops.multiply(di.getchannel('A'),leftMask));tabR=di.copy();tabR.putalpha(ImageChops.multiply(di.getchannel('A'),rightMask))
    body=di.copy();body.putalpha(ImageChops.subtract(di.getchannel('A'),ImageChops.lighter(leftMask,rightMask)))
    part('diaper-body',body);part('diaper-tab-left',tabL);part('diaper-tab-right',tabR)
    lbox=bbox(tabL);rbox=bbox(tabR);lh=lbox[2]-4;rh=rbox[0]+4;cy=(lbox[1]+lbox[3])/2
    # Keep a narrow root patch under each tab; no detached or missing joint.
    def fold(layer,pivot,sx):
        if abs(sx)<.03:sx=.03
        return layer.transform((512,512),Image.Transform.AFFINE,(1/sx,0,pivot-pivot/sx,0,1,0),Image.Resampling.BICUBIC)
    def change(t):
        angle=math.pi*.84*q(t);sx=math.cos(angle);im=body.copy();im.alpha_composite(fold(tabL,lh,sx));im.alpha_composite(fold(tabR,rh,sx));return im,dict(tabFoldAngle=angle*180/math.pi,leftHinge=[lh,cy],rightHinge=[rh,cy])
    animate('change-diaper','motion.change','おむつ：留め具を開閉',change,'sources/generated/diaper.png',['left fastening tab','right fastening tab'],stationary=[210,255,300,340],note='交換全体ではなく留め具の開閉。着替え・拭く・げっぷは未制作。',readiness='draft')


currentPass=2
if not ONLY_FINAL:exec(compile((ROOT/'scripts/visual-cue/additional_artwork.py').read_text(),str(ROOT/'scripts/visual-cue/additional_artwork.py'),'exec'),globals())
currentPass=3
if not ONLY_REVIEW:exec(compile((ROOT/'scripts/visual-cue/final_artwork.py').read_text(),str(ROOT/'scripts/visual-cue/final_artwork.py'),'exec'),globals())
archived=archived+[a for a in assets if a['id'] in ['hand-squeeze','change-diaper']]
archived=list({a['id']:a for a in archived}.values())
assets=[a for a in assets if a['id'] not in ['hand-squeeze','change-diaper']]
currentPass=4
if not ONLY_R2:exec(compile((ROOT/'scripts/visual-cue/revision_artwork.py').read_text(),str(ROOT/'scripts/visual-cue/revision_artwork.py'),'exec'),globals())
currentPass=5
if not ONLY_R3:exec(compile((ROOT/'scripts/visual-cue/review_r2_artwork.py').read_text(),str(ROOT/'scripts/visual-cue/review_r2_artwork.py'),'exec'),globals())
currentPass=6
exec(compile((ROOT/'scripts/visual-cue/review_r3_artwork.py').read_text(),str(ROOT/'scripts/visual-cue/review_r3_artwork.py'),'exec'),globals())
for a in assets:
    if a['id']=='hands-open-v2':a['note']='親指・母指球・掌・手首・袖口がつながる一枚の原画。静止画として保持。指を分割して曲げる旧動画はR3で撤回し、手振りは手全体の原画を使用。'
    if a['id']=='change-diaper-v2':a['note']='留め具の開閉variant。交換の全過程はchange-diaper-exchangeで別候補。'
    if a['id']=='change-zipper':a['note']='留め具操作variant。服の交換と袖通しはchange-clothes / dress-sleevesで別候補。'
if SAMPLE_ONLY:
    print('Sample keyframes saved; manifest and videos unchanged.');raise SystemExit(0)

# All 31 concepts and all 58 Cue IDs are represented, without fictitious assets.
plan=json.loads((ROOT/'shared/visual-cue-asset-plan.json').read_text())
missing={
 'scene.tummy':'年齢を特定しないおなかの部分図。採用審査待ち。',
 'scene.family':'養育者と子の頭・肩・胴・両腕がつながる抱っこへ再制作。採用審査待ち。',
 'motion.hand':'拍手・手振りを候補として維持。握る・開閉・数える・指の独立動作・ブロックタップはR3で撤回。',
 'motion.change':'上半身が連続する着替え、整合する寝具、背中へのケアへ修正。採用審査待ち。',
 'motion.hug':'養育者が子を支える場面の前腕と掌を動かす。旧毛布表現は撤回。'}
concepts=[]
for p in plan['primitives']:
    ids=[x['id'] for x in assets if x['primitive']==p['id']]
    if p['kind']=='avatar-state':
        reuse={'emma.neutral':('assets/emma-face/emma-face-idle-open.svg','待機表情は再利用候補。'), 'emma.calm':('assets/emma-face/emma-face-idle-closed.svg','目閉じは既存。安心・落ち着きの意味一致は要審査。')}
        f,reason=reuse.get(p['id'],(None,'既存の待機・発話・まばたきSVGのみでは状態固有の意味を保証できない。専用表情が必要で、今回の流用評価では不可（新表情制作は対象外）。'))
        concepts.append(dict(primitive=p['id'],kind=p['kind'],assetIds=[],status='needs-review',readiness='evaluation-complete',reuseAssessment='conditional' if f else 'unavailable',existingFile=f,reason=reason))
    else:concepts.append(dict(primitive=p['id'],kind=p['kind'],assetIds=ids,status='needs-review',readiness=('candidate' if any(a['id'] in ids and a['readiness']=='candidate' for a in assets) else 'draft') if ids else 'missing',reason=missing.get(p['id'],'採用審査前。詳細と意味の審査範囲はcueCoverageを参照。')))

cueFiles={
'action.open-close':[],'action.count':[],'action.wiggle':[],'action.squeeze':[],'action.tap':[],'action.wipe':['care-wipe'],'action.dress':['change-clothes','dress-sleeves','change-zipper'],'action.clap':['hand-clap'],'action.wave':['hand-wave'],'action.kick':['kick'],'action.read':['page'],'action.turn-page':['page'],
'action.sip':['sip','cup-sip'],'action.eat':['spoon'],'action.sing':['notes'],'action.peekaboo':['peekaboo'],'action.splash':['water-splash'],'action.wash':['water-shower'],
'action.burp':['care-burp'],'action.wake':['wake-daylight'],'action.hug':['hug-arms'],'subject.tummy':['tummy'],'action.sleep':['sleep'],'subject.bath':['bath'],'subject.book':['book'],'subject.clothes':['clothes'],'subject.diaper':['diaper'],'subject.drink':['cup'],'subject.feet':['feet'],
'subject.food':['meal'],'subject.hands':['hands'],'subject.milk':['milk'],'subject.music':['music'],'subject.outside':['outdoor'],'subject.rain':['rain','water-rain'],'subject.sun':['sun'],'subject.toy':['toy']}
unmade={
'action.burp':'げっぷ動作は未制作。おむつの動きを流用不可。','action.dress':'服は静止のみ。着替え動作未制作。','action.wipe':'拭く部品と接触対象が未確定。',
'action.count':'指を順に伸ばす連続姿勢未制作。','action.open-close':'指の開閉姿勢未制作。','action.squeeze':'握る姿勢と対象未制作。','action.tap':'タップ接触動作未制作。雨と混同しない。','action.wiggle':'指の独立した動き未制作。','action.wake':'眠るベッドを起床の動作として流用不可。',
'action.hug':missing['motion.hug'],'subject.tummy':missing['scene.tummy']}
coverage=[]
for b in plan['bindings']:
    ids=cueFiles.get(b['cueId'],[])
    ready='candidate' if ids and all(next(x for x in assets if x['id']==i)['readiness']=='candidate' for i in ids) else 'draft' if ids else 'missing'
    reason=unmade.get(b['cueId'],'Emma状態の評価のみ。アプリ統合・意味承認は未実施。' if not ids else '素材候補の審査待ち。914英文の割当品質を保証しない。')
    if ids and b['cueId'] in unmade:reason=next(a for a in assets if a['id']==ids[0]).get('note') or '追加制作した動作variant。採用審査待ち。'
    if not ids and all(p.startswith('emma.') for p in b['primitives']):ready='evaluation-complete';reason='既存Emma表情の流用可否を評価済み。新表情の制作・統合は対象外。意味の採用承認は別工程。'
    if b['cueId'] in ['action.open-close','action.count','action.wiggle','action.squeeze','action.tap']:reason='R3評価で旧動画を撤回。手振りは動作の意味が異なるため代用せず、専用素材は未制作。'
    if b['cueId']=='subject.drink':reason='飲み物のコップを追加。scene.drinkという追加コンセプト案であり、哺乳瓶を飲み物全般に流用しない。原計画・runtimeは未変更。'
    if b['cueId']=='action.peekaboo':reason='玩具を布で隠すvariant。人物のいない部分図として採用審査待ち。'
    if b['cueId']=='action.wake':ready='draft';reason='掛け布団を動かす旧案は撤回。wake-daylightは空の寝床と外側の朝日による代案で、起きた本人や動作を描かないため意味の採用は保留。'
    coverage.append(dict(cueId=b['cueId'],primitives=b['primitives'],assetIds=ids,status='needs-review',readiness=ready,reason=reason))
commonIds=['cup-sip','milk','cup','diaper-v2','clothes','family-care','sleep','wake-bed','book','toy','bath','hands-open-v2','feet','outdoor','rain','sun','music','hold-hands','hand-wave','kick','page','hug-arms','change-clothes']
usage=json.loads((OUT/'qa/usage-audit.json').read_text())
feedback=json.loads((OUT/'qa/revision-feedback.json').read_text())
manifest=dict(schemaVersion=1,nonRuntime=True,baseCommit='03a5bcc',latestMainInspected='b2536ab',productionPass=6,proposedConcepts=[dict(primitive='scene.drink',kind='illustration',assetIds=['cup'],readiness='proposal',reason='飲み物を哺乳瓶と区別する追加設計案。元計画31コンセプトは変更しない。')],commonAssetIds=commonIds,scenePriorities=usage['scenes'],usageMethod=usage['method'],limitedVariants=[r for r in usage['limitedVariants'] if r['assetId'] in {a['id'] for a in assets}],reviewFeedback=feedback,archivedAssets=archived,approval='採用候補の審査用。新規acceptedは0件。914英文割当とは別工程。',handoffSHA256=EXPECTED,assets=assets,concepts=concepts,cueCoverage=coverage)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(OUT/'qa/motion-traces.json').write_text(json.dumps(rigs,ensure_ascii=False,indent=2)+'\n')
print(f'Built {sum(x["kind"]=="illustration" for x in assets)} stills, {sum(x["kind"]=="animation" for x in assets)} loops; {len(concepts)} concepts / {len(coverage)} Cues. Approval remains pending.')
