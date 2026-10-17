"""2026-10-18: human-review corrections. Executed in build_artwork.py's raster workspace."""
import shutil,copy

def clean4(im,cut=True):
    a=np.asarray(im.getchannel('A'));mask=Image.fromarray(((a>24)*255).astype(np.uint8)).copy()
    pts=np.argwhere(a>180);sy,sx=pts[len(pts)//2];ImageDraw.floodfill(mask,(int(sx),int(sy)),128)
    connected=Image.fromarray(((np.asarray(mask)==128)*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
    im=im.copy();im.putalpha(ImageChops.multiply(im.getchannel('A'),connected));return trim(im) if cut else im
def src4(name):return clean4(read(GEN/f'{name}-v4.png'))
def ease4(v):v=max(0,min(1,v));return v*v*(3-2*v)

feedback4={
'kick':'親指が外側。左右を修正し、親指が中央を向くようにする。',
'feet':'静止画と動画で足の向きをそろえる。',
'page':'めくった後も同じ図、裏面が白紙。新しい左右の絵柄を用意。',
'hands-open-v2':'親指の付け根が手首側へ下がり、不自然。',
'hand-open-close':'共通の親指の付け根を掌の側面へ修正。',
'hand-count':'共通の親指の付け根を掌の側面へ修正。',
'hand-wiggle':'共通の親指の付け根を掌の側面へ修正。',
'hand-tap':'共通の親指の付け根を掌の側面へ修正。',
'family-care':'毛布と手では意味不明瞭。養育者と子の抱っこを全再制作。',
'hug-arms':'毛布と手では意味不明瞭。養育者と子の抱っこを全再制作。',
'hand-squeeze-v3':'下の掌が隠れ、握っていると分からない。手全体を再制作。',
'change-clothes':'腹部しかなく不自然。頭・首・肩・上半身・腕をつなげる。',
'dress-sleeves':'袖の出口と腕が一致せず、指先も切れる。袖の形で遮蔽する。',
'wake-bed':'掛け物の位置とベッドの透視が不一致。真上からの整合する原画に再制作。',
'wake-quilt':'掛け物がマットレスへめり込む。上面に置き、端を折る。',
'sleep':'就寝・起床で整合した寝具を使う。',
'care-burp':'腹部への動きは誤り。縦抱きで背中に手を添える構図へ全再制作。'}
# Preserve the exact rejected WebPs before replacing any path, including sample runs.
for a in archived:
    if not str(a['poster']).startswith('archive/'):
        for field in ['poster','illustration','animation']:
            if a.get(field):
                rel=Path('archive/pre-review')/a[field];target=OUT/rel;target.parent.mkdir(parents=True,exist_ok=True)
                if not target.exists():shutil.copyfile(OUT/a[field],target)
                a[field]=str(rel)
for key in list(feedback4)+['cup','hold-hands','hold-hands-squeeze']:
    old=next((a for a in assets if a['id']==key),None)
    if old and key in feedback4 and old.get('productionPass',1)<4:
        archive_id='rejected-20261018-'+key
        if not any(a['id']==archive_id for a in archived):
            row=copy.deepcopy(old);row.update(id=archive_id,originalId=key,status='rejected',readiness='rejected',reviewBatch='2026-10-18',rejectionReason=feedback4[key])
            for field in ['poster','illustration','animation']:
                if row.get(field):
                    rel=Path('archive/2026-10-18')/row[field];target=OUT/rel;target.parent.mkdir(parents=True,exist_ok=True)
                    if not target.exists():shutil.copyfile(OUT/row[field],target)
                    row[field]=str(rel)
            archived.append(row)
    assets[:]=[a for a in assets if a['id']!=key]

# Correct each foot in its own space, preserving ankle anchors and alternating kicks.
foot4=fit(read(GEN/'foot.png'),(130,250));fw,fh=foot4.size
fl4=part('kick-left',place(blank(),ImageOps.mirror(foot4),(140-fw/2,414-fh)))
fr4=part('kick-right',place(blank(),foot4,(372-fw/2,414-fh)))
def kick4(t):
    angle=12*math.sin(2*math.pi*t);im=rotate(fl4,angle,(140,380));im.alpha_composite(rotate(fr4,-angle,(372,380)))
    return im,dict(leftAngle=angle,rightAngle=-angle,leftAnchor=[140,380],rightAnchor=[372,380],bigToes='inward')
still('feet','scene.feet','足：親指が中央を向く左右',kick4(0)[0],'sources/generated/foot.png',note='左右の親指が内側に来るように、静止画と動画を統一。')
animate('kick','motion.kick','キック：親指を内側に、足首で左右交互',kick4,'sources/generated/foot.png',['left foot at ankle','right foot at ankle'],note='左右を逆に配置していた旧版を撤回。親指の向きを画素と目視で確認。')

# Reuse the articulated rig with its thumb root moved from wrist to mid-palm.
hand_code=(ROOT/'scripts/visual-cue/additional_artwork.py').read_text()
exec(compile(hand_code.split('block=fit')[0],'<review-hand-rig>','exec'),globals())
block=fit(read(GEN/'squeeze-block-v2.png'),(145,96))
exec(compile(hand_code[hand_code.index('# Index tap:'):hand_code.index('# A cloth passes')],'<review-hand-tap>','exec'),globals())
for a in assets:
    if a['id'] in ['hands-open-v2','hand-open-close','hand-count','hand-wiggle','hand-tap']:
        a['note']='2026-10-18修正：親指の付け根を42px上げ、掌の側面に連続させる。手首に親指を付けない。'

# Book: printed front and back of the actual leaf, revealing a different illustrated spread.
book4=read(OUT/'sources/normalized/book.png');bs=read(GEN/'book-v4.png');bw,bh=bs.size
pear=clean4(bs.crop((0,0,bw//2,bh))).resize((512,512),Image.Resampling.LANCZOS)
fish=clean4(bs.crop((bw//2,0,bw,bh))).resize((512,512),Image.Resampling.LANCZOS)
R=np.array([(233,170),(418,115),(463,345),(268,386)],float)
L=np.array([(55,128),(233,170),(268,386),(77,352)],float)
flat=np.array([(0,0),(511,0),(511,511),(0,511)],float)
def map4(im,source,dest):
    A=[];B=[]
    for (x,y),(u,v) in zip(dest,source):
        A += [[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]];B += [u,v]
    coeff=np.linalg.solve(np.array(A),np.array(B));return im.transform((512,512),Image.Transform.PERSPECTIVE,coeff,Image.Resampling.BICUBIC)
mask=Image.new('L',(512,512));ImageDraw.Draw(mask).polygon([tuple(v) for v in R],fill=255)
front=book4.copy();front.putalpha(ImageChops.multiply(front.getchannel('A'),mask));part('v4-book-leaf-sun',front)
rightFish=part('v4-book-revealed-fish',map4(fish,flat,R))
leftPear=part('v4-book-back-pear',map4(pear,flat,L))
# Mapping order on the back is hinge-top, outer-top, outer-bottom, hinge-bottom.
backSource=L[[1,0,3,2]]
def bookturn4(t):
    if t<.10:progress=0
    elif t<.42:progress=ease4((t-.10)/.32)
    elif t<.58:progress=1
    elif t<.90:progress=1-ease4((t-.58)/.32)
    else:progress=0
    theta=math.pi*progress;c=math.cos(theta);s=math.sin(theta)
    dest=R.copy()
    for outer,hinge,leftIndex in [(1,0,0),(2,3,3)]:
        target=R[outer] if c>=0 else L[leftIndex]
        dest[outer]=R[hinge]+(target-R[hinge])*abs(c)+np.array([0,-38*s])
    im=book4.copy();im.alpha_composite(rightFish)
    if abs(c)>.025:
        im.alpha_composite(map4(front,R,dest) if c>=0 else map4(leftPear,backSource,dest))
    return im,dict(pageAngle=theta*180/math.pi,progress=progress,spineTop=R[0].tolist(),spineBottom=R[3].tolist(),frontPrint='sun',backPrint='pear',revealedRight='fish')
animate('page','motion.page','絵本：りんご・太陽から、洋なし・魚へ',bookturn4,['reference/artwork/approved/picture_book.webp','sources/generated/book-v4.png'],['printed leaf around spine'],stationary=[150,380,170,384],frame_count=48,note='めくる紙の表は太陽、裏は洋なし。下から魚のページが現れる。新しい見開きを保持してから逆に戻す。白紙の裏面や同じ見開きへの差し替えを廃止。')

# Smooth local deformation on coherent paintings: joints and skin remain connected.
def deform4(im,fields):
    def point(x,y):
        dx=dy=0
        for cx,cy,r,ax,ay in fields:
            ds=((x-cx)**2+(y-cy)**2)/r**2
            w=max(0,1-ds)**2;dx+=ax*w;dy+=ay*w
        return (x-dx,y-dy)
    mesh=[];step=16
    for y in range(0,512,step):
        for x in range(0,512,step):
            quad=[]
            for px,py in [(x,y),(x,y+step),(x+step,y+step),(x+step,y)]:quad.extend(point(px,py))
            mesh.append(((x,y,x+step,y+step),tuple(quad)))
    return im.transform((512,512),Image.Transform.MESH,mesh,Image.Resampling.BICUBIC)
hugBase=part('v4-hug-connected-scene',centered(src4('hug'),(410,410)))
def hug4(t):
    p=q(t);return deform4(hugBase,[(290,323,67,-13*p,-8*p),(215,355,60,-5*p,-5*p),(281,405,48,-3*p,-6*p)]),dict(handOnBack=[290-13*p,323-8*p],supportingArm=[281-3*p,405-6*p],headStationary=True)
still('family-care','scene.family','抱っこ：養育者と子どもの上半身',hugBase,'sources/generated/hug-v4.png',note='毛布の記号を撤回。頭・首・肩・胴と支える両腕がつながった抱っこを再制作。顔は見せない。')
animate('hug-arms','motion.hug','抱っこ：支えたまま腕を寄せる',hug4,'sources/generated/hug-v4.png',['forearm and hand across child back','lower supporting forearm'],stationary=[220,100,250,150],note='頭と胴を保ち、前腕・掌の周囲だけを局所的に動かす。毛布や画像全体の上下揺れは使わない。')

gripBase=part('v4-grip-connected-hand',centered(src4('grip'),(370,420)))
def grip4(t):
    p=q(t);fields=[(258,145,65,-5*p,12*p),(291,205,65,-9*p,5*p),(195,245,55,8*p,-4*p),(235,205,70,0,6*p)]
    return deform4(gripBase,fields),dict(fingerPress=12*p,thumbPress=8*p,palmStationary=True)
animate('hand-squeeze-v3','motion.hand','ボールを握る：下の掌と親指も見せる',grip4,'sources/generated/grip-v4.png',['four fingers curl against ball','thumb supports ball'],stationary=[210,350,250,370],note='手全体が連続する新原画。球の下と右に掌を広く残す。球はこの物体専用variantで、Hold my handには手をつなぐ別素材を使う。')

# Dressing: a connected head, neck, shoulders, torso and arms, not an isolated abdomen.
child=centered(src4('dress'),(430,400),center=(256,261));part('v4-dressing-whole-upper-body',child)
# Arm/body boundaries are under the clothing, never a horizontal cut through the fingers.
cm=np.asarray(child);yy,xx=np.indices((512,512))
skin4=(cm[:,:,0].astype(int)>140)&(cm[:,:,0].astype(int)-cm[:,:,2].astype(int)>15)&(cm[:,:,3]>8)
leftMask=Image.fromarray(((skin4&(xx<214)&(yy>257))*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
rightMask=Image.fromarray(((skin4&(xx>300)&(yy>257))*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
leftArm4=child.copy();leftArm4.putalpha(ImageChops.multiply(child.getchannel('A'),leftMask))
rightArm4=child.copy();rightArm4.putalpha(ImageChops.multiply(child.getchannel('A'),rightMask))
body4=child.copy();body4.putalpha(ImageChops.subtract(child.getchannel('A'),ImageChops.lighter(leftArm4.getchannel('A'),rightArm4.getchannel('A'))))
part('v4-dressing-body',body4);part('v4-dressing-left-arm',leftArm4);part('v4-dressing-right-arm',rightArm4)
# Derive the garment from an actually worn T-shirt with matching horizontal sleeves.
originalRaw=clean4(read(GEN/'dress-v4.png'),False);rb=bbox(originalRaw)
referenceSprite=fit(trim(originalRaw),(430,400));edited=read(GEN/'shirt-v4.png')
if edited.size!=originalRaw.size:edited=edited.resize(originalRaw.size,Image.Resampling.LANCZOS)
editedSprite=edited.crop(rb).resize(referenceSprite.size,Image.Resampling.LANCZOS)
editedLayer=place(blank(),editedSprite,(256-editedSprite.width/2,261-editedSprite.height/2))
ar=np.asarray(editedLayer).astype(int);Rr,Gg,Bb=ar[:,:,0],ar[:,:,1],ar[:,:,2]
yellowMask=(Rr>165)&(Gg>135)&(Gg-Bb>.59*(Rr-Bb))&(Rr>=Gg-10)&(ar[:,:,3]>12)&(yy>245)
yellowAlpha=Image.fromarray((yellowMask*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
yellowLayer=editedLayer.copy();yellowLayer.putalpha(ImageChops.multiply(editedLayer.getchannel('A'),yellowAlpha))
# Exact same pattern and silhouette for the new color; keep the painted cloth texture.
tealArray=np.asarray(yellowLayer).copy();rgb=tealArray[:,:,:3].astype(float)
tealArray[:,:,0]=np.clip(rgb[:,:,0]*.20,0,255);tealArray[:,:,1]=np.clip(rgb[:,:,1]*.85,0,255);tealArray[:,:,2]=np.clip((rgb[:,:,0]+rgb[:,:,1])*.42,0,255)
tealLayer=Image.fromarray(tealArray);gb=bbox(yellowLayer);shirts4=[trim(yellowLayer),trim(tealLayer)]
baseWidth4=shirts4[0].width;baseTop4=gb[1]
part('v4-worn-yellow-shirt',yellowLayer);part('v4-worn-teal-shirt',tealLayer)
def garment4(which,width=None):
    width=baseWidth4 if width is None else width
    return shirts4[which].resize((round(width),round(shirts4[which].height*width/baseWidth4)),Image.Resampling.LANCZOS)
def addShirt4(im,which,cx=256,top=None,width=None):
    top=baseTop4 if top is None else top;sh=garment4(which,width);place(im,sh,(cx-sh.width/2,top));return im
# Insertion follows the horizontal sleeve axis. The complete hand slides behind the garment.
def sleeves4(t):
    phase=q(t);le=ease4(phase/.44);ri=ease4((phase-.50)/.44);im=body4.copy()
    la=slide(leftArm4,180*(1-le),0);ra=slide(rightArm4,-180*(1-ri),0)
    # Only the proximal endpoint is hidden under the garment; no clipping line crosses fingertips.
    lm=Image.fromarray(((xx<=213)*255).astype(np.uint8));rm=Image.fromarray(((xx>=301)*255).astype(np.uint8))
    la.putalpha(ImageChops.multiply(la.getchannel('A'),lm));ra.putalpha(ImageChops.multiply(ra.getchannel('A'),rm))
    im.alpha_composite(la);im.alpha_composite(ra)
    addShirt4(im,0)
    return im,dict(leftSleeveProgress=le,rightSleeveProgress=ri,leftShoulder=[213,274],rightShoulder=[301,274],handsNeverClipped=True)
animate('dress-sleeves','motion.change','着替え：袖の出口から片腕ずつ',sleeves4,['sources/generated/dress-v4.png','sources/generated/shirt-v4.png'],['left complete arm through sleeve','right complete arm through sleeve'],stationary=[230,115,280,160],frame_count=48,note='頭・首・肩・胴を含む上半身。手全体を衣服の後ろから袖の軸に沿って出し、指を水平マスクで切断しない。')
# Physical garment removal/replacement, with arms lifting at shoulders and a continuous torso.
def dress4(t):
    phase=q(t);remove=ease4(phase/.43);put=ease4((phase-.52)/.43)
    lift=math.sin(math.pi*remove) if remove<1 else math.sin(math.pi*put)
    im=body4.copy();im.alpha_composite(rotate(leftArm4,-48*lift,(211,283)));im.alpha_composite(rotate(rightArm4,48*lift,(301,283)))
    # Up over the shoulders, then to a staging position. The whole upper body stays present.
    oldx=256-168*ease4((remove-.55)/.45);oldtop=baseTop4-175*ease4(remove/.65);oldw=baseWidth4-(baseWidth4-109)*ease4((remove-.48)/.52)
    newx=424-168*ease4(put/.45);newtop=baseTop4-175+175*ease4((put-.35)/.65);neww=109+(baseWidth4-109)*ease4(put/.52)
    addShirt4(im,1,newx,newtop,neww);addShirt4(im,0,oldx,oldtop,oldw)
    return im,dict(oldShirt=[oldx,oldtop],newShirt=[newx,newtop],remove=remove,putOn=put,armLift=48*lift,headAndTorsoPresent=True)
animate('change-clothes','motion.change','着替え：上半身を保って別の服へ',dress4,['sources/generated/dress-v4.png','sources/generated/shirt-v4.png'],['shoulder-connected arms lift','old shirt over shoulders','new shirt onto torso'],stationary=[230,418,280,421],frame_count=48,note='裸の腹部への服の貼り付けを撤回。顔の見えない後ろ姿で、頭・首・肩・肌着・腕を連続させ、服を替える。')

# Bed: common top-down projection. Quilt is composited above the mattress, inside its bounds.
bd=read(GEN/'bed-v4.png');bdw,bdh=bd.size
bed4=fit(clean4(bd.crop((0,0,bdw//2,bdh))),(285,400));bedLayer4=place(blank(),bed4,(256-bed4.width/2,60))
quilt4=clean4(bd.crop((bdw//2,0,bdw,bdh))).resize((224,255),Image.Resampling.LANCZOS)
part('v4-bed-base',bedLayer4);part('v4-quilt',quilt4)
sun4=fit(read(GEN/'sun.png'),(70,70))
def bedPose4(opening,sun=False):
    im=blank()
    if sun:place(im,sun4,(399,90-45*opening))
    im.alpha_composite(bedLayer4)
    # The foot edge is fixed. An actual folded textile band moves down on the mattress.
    top=194+130*opening;h=round(420-top)
    cover=quilt4.resize((224,h),Image.Resampling.LANCZOS);place(im,cover,(144,top))
    return im,dict(quiltTop=top,quiltFoot=420,quiltLeft=144,quiltRight=368,projection='shared-top-down')
def wake4(t):return bedPose4(q(t),True)
still('sleep','scene.sleep','就寝：枕と掛け物があるベッド',bedPose4(0)[0],'sources/generated/bed-v4.png',note='マットレスと掛け物を同じ真上からの投影に統一。')
still('wake-bed','scene.sleep','起床：掛け物を足元に折ったベッド',bedPose4(1,True)[0],'sources/generated/bed-v4.png',note='掛け物はマットレスの上面に置き、木枠・枕・足元と整合させる。')
animate('wake-quilt','motion.change','起床：掛け物を上面で足元へ折る',wake4,'sources/generated/bed-v4.png',['quilt top edge folds down mattress'],stationary=[210,100,290,145],note='斜めのベッドに別の透視の掛け物を重ねていた旧版を撤回。枕と木枠を固定し、掛け物だけが上面で折れる。')

burpBase=part('v4-burp-connected-scene',centered(src4('burp'),(410,410)))
def burp4(t):
    p=math.sin(2*math.pi*t);im=deform4(burpBase,[(293,300,63,0,-15*p),(242,350,53,0,-5*p)])
    return im,dict(handOn='back',backHandCenter=[293,300-15*p],abdominalContact=False,bodySupported=True)
animate('care-burp','motion.change','縦抱き：背中に手を添えてやさしく動かす',burp4,'sources/generated/burp-v4.png',['hand gently rubs child back','connected forearm'],stationary=[220,115,250,155],note='腹部をさする旧版を却下。肩に頭を預けた縦抱きで背中に手を添える場面。NHSの頭・首を支える／背中への動作を参照。実際のげっぷの発生は描写しない。')

still('cup','scene.drink','飲み物：コップ',centered(src4('cup'),(375,375)),'sources/generated/cup-v4.png',note='drink話題38セットのための物体候補。哺乳瓶と区別し、飲みたいかの質問には静止画を使う設計候補。割当は未実装。')
holdBase=part('v4-hold-connected-hands',centered(src4('hold'),(420,420)))
still('hold-hands','scene.hands','手をつなぐ：大人の指を小さな手で握る',holdBase,'sources/generated/hold-v4.png',note='Hold my hand / Give me your handに沿う汎用場面。ボール専用の握りをこれらの英文に流用しない。')
def hold4(t):
    p=q(t);return deform4(holdBase,[(310,180,70,-8*p,5*p)]),dict(childGrip=[310-8*p,180+5*p],adultPalmStationary=True)
animate('hold-hands-squeeze','motion.hand','手をつなぐ：指をやさしく握る',hold4,'sources/generated/hold-v4.png',['child fingers gently close around adult index'],stationary=[170,330,200,360],note='手をつなぐ英文向け。大人の掌と手首は固定し、握る部分だけを局所的に動かす。')

for a in assets:
    if a.get('productionPass')==4:a['humanReview']='revision-candidate-not-approved'
(OUT/'qa/revision-feedback.json').write_text(json.dumps(dict(date='2026-10-18',scope='ユーザー指摘の旧版は撤回。修正版も採用承認前。',items=[dict(assetId=k,problem=v,replacementStatus='candidate-for-human-review') for k,v in feedback4.items()],careReference='https://www.nhs.uk/best-start-in-life/baby/feeding-your-baby/bottle-feeding/bottle-feeding-your-baby/how-to-burp-your-baby/'),ensure_ascii=False,indent=2)+'\n')
