"""Second production pass: new isolated raster parts and locally articulated rigs.
Executed by build_artwork.py, sharing its output registry and image helpers.
"""
sheet=read(GEN/'hand-rig-v2.png');sw,sh=sheet.size
cells=[trim(sheet.crop((round(x*sw/3),round(y*sh/2),round((x+1)*sw/3),round((y+1)*sh/2)))) for y in range(2) for x in range(3)]
palm=fit(cells[0],(215,222));palmLayer=part('v2-hand-palm',place(blank(),palm,(154,246)))
# The four finger roots follow the scalloped upper edge of the complete palm.
rootX=[186,236,286,333];rootY=[274,265,268,283];widths=[43,46,43,36];lengths=[126,145,128,99]
fingers=[]
for j,cell in enumerate([cells[1],cells[2],cells[3],cells[4]]):
    f=trim(cell).resize((widths[j],lengths[j]),Image.Resampling.LANCZOS)
    part(f'v2-finger-{j}',f);fingers.append(f)
thumb=fit(cells[5],(99,113));thumbLayer=part('v2-thumb',place(blank(),thumb,(117,249)))


def paste_span(canvas,segment,x,y0,y1):
    """Project a phalanx to a signed span; a curled fingertip may point down onto palm."""
    height=max(3,math.ceil(abs(y1-y0))+3);piece=segment.resize((segment.width,height),Image.Resampling.LANCZOS)
    # Input segment is stored root at bottom, tip at top.
    if y1>y0:piece=ImageOps.flip(piece)
    place(canvas,piece,(x-piece.width/2,math.floor(min(y0,y1))-1))


def hand_pose(openness,thumb_open=1,record=False):
    im=palmLayer.copy();joints=[]
    for j,(f,o) in enumerate(zip(fingers,openness)):
        # Two actual raster phalanges rotate around fixed roots and knuckles.
        alpha=math.radians(73*(1-o));beta=math.radians(102*(1-o));L=f.height
        root=rootY[j];joint=root-L*.50*math.cos(alpha);tip=joint-L*.50*math.cos(alpha+beta)
        split=f.height//2
        proximal=f.crop((0,split,f.width,f.height));distal=f.crop((0,0,f.width,split+1))
        # Soften the straight root seam without changing silhouette or motion.
        pa=np.asarray(proximal).copy();fade=np.minimum(1,np.arange(proximal.height-1,-1,-1)/8)
        pa[:,:,3]=(pa[:,:,3]*fade[:,None]).astype(np.uint8);proximal=Image.fromarray(pa)
        paste_span(im,proximal,rootX[j],root,joint)
        paste_span(im,distal,rootX[j],joint,tip)
        if o<.88:
            # The same generated fingertip texture caps the turning knuckle.
            # Full-width proximal sides continue beneath it, avoiding mushroom-shaped joints.
            cap=f.crop((0,0,f.width,min(f.height,f.width))).resize((f.width,22),Image.Resampling.LANCZOS)
            cap.putalpha(cap.getchannel('A').point(lambda a:round(a*min(1,(.88-o)/.18))))
            place(im,cap,(rootX[j]-f.width/2,joint-10))
        joints.append(dict(root=[rootX[j],root],knuckle=[rootX[j],joint],tip=[rootX[j],tip],open=o))
    angle=-42*(1-thumb_open);im.alpha_composite(rotate(thumbLayer,angle,(209,332)))
    return im,dict(fingers=joints,thumbAngle=angle,palmAnchor=[256,398])

openHand,_=hand_pose([1]*4)
still('hands-open-v2','scene.hands','手：5本の指・部品別原画',openHand,'sources/generated/hand-rig-v2.png',note='掌・指・親指を独立した原画から組み立て。人体の見え方は採用審査対象。')


def openclose(t):
    o=1-q(t);return hand_pose([o]*4,o)
animate('hand-open-close','motion.hand','手を開く・閉じる：指の関節を動かす',openclose,'sources/generated/hand-rig-v2.png',['four fingers: two phalanges each','thumb'],stationary=[220,410,300,440],note='掌と袖口は静止。指の付け根と関節を支点に開閉。')


def count(t):
    # One, two, three, four, then five digits; unwind smoothly before the loop repeats.
    phase=t*8
    extended=min(4,max(0,phase)) if phase<5.2 else max(0,4-(phase-5.2)*4/2.8)
    values=[]
    for j in range(4):
        u=max(0,min(1,extended-j));values.append(u*u*(3-2*u))
    thumb_o=max(0,min(1,(phase-4)/.7)) if phase<5.2 else max(0,1-(phase-5.2)/.7)
    im,trace=hand_pose(values,thumb_o);trace['extendedFingers']=sum(v>.95 for v in values)+(thumb_o>.95)
    return im,trace
animate('hand-count','motion.hand','指を順に伸ばして数える',count,'sources/generated/hand-rig-v2.png',['index','middle','ring','little','thumb'],stationary=[220,410,300,440],note='0→1→2→3→4→5本を示して戻す。数字ラベルを画像に焼き込まない。',frame_count=48)


def wiggle(t):
    vals=[.60+.36*math.sin(2*math.pi*t+j*math.pi/2) for j in range(4)]
    return hand_pose(vals,.7)
animate('hand-wiggle','motion.hand','指を1本ずつ動かす',wiggle,'sources/generated/hand-rig-v2.png',['four independent fingers'],stationary=[220,410,300,440])

block=fit(read(GEN/'squeeze-block-v2.png'),(145,96));part('v2-soft-block',block)
def squeeze(t):
    pressure=q(t);im,trace=hand_pose([1-pressure*.9]*4,1-pressure*.85)
    # The object is compressed with the same grip phase; palm and cuff never bob.
    squashed=block.resize((round(145-35*pressure),round(96+12*pressure)),Image.Resampling.LANCZOS)
    place(im,squashed,(255-squashed.width/2,307-squashed.height/2))
    # Curl the two central fingertip pads OVER the block, establishing actual occlusion.
    for j in [1,2]:
        finger=trace['fingers'][j];joint=finger['knuckle'][1];tip=finger['tip'][1]
        if tip>joint:
            f=fingers[j];distal=f.crop((0,0,f.width,f.height//2+1));paste_span(im,distal,rootX[j],joint,tip)
    trace.update(blockWidth=squashed.width,blockHeight=squashed.height)
    return im,trace
animate('hand-squeeze','motion.hand','柔らかいブロックを握る',squeeze,['sources/generated/hand-rig-v2.png','sources/generated/squeeze-block-v2.png'],['fingers','thumb','compressible block'],stationary=[220,410,300,440],note='柔らかい物体を握るvariant。握り込みの遮蔽と接触を審査。',readiness='draft')

# Index tap: the fingertip and a stationary block make visible physical contact.
indexHand,_=hand_pose([1,0,0,0],0)
# Fit the entire pose once; the index is then pointed down and the wrist stays above.
tapping=fit(indexHand.rotate(180), (155,245));tapH=place(blank(),tapping,(256-tapping.width/2,72))
part('v2-tap-hand',tapH)
target=block.resize((175,112),Image.Resampling.LANCZOS);targetLayer=part('v2-tap-target',place(blank(),target,(168,349)))
# Downward-facing index tip is derived from alpha near its column, not canvas bounds.
arr=np.asarray(tapH)[:,:,3];ys,xs=np.where((arr>100)&(np.indices(arr.shape)[1]>250)&(np.indices(arr.shape)[1]<315));tipY=int(np.where(arr>100)[0].max());tipX=int(np.median(np.where(arr[tipY]>100)[0]));targetY=int(np.where(np.asarray(targetLayer)[:,tipX,3]>100)[0].min())
def tap(t):
    # Explicit 45px travel, with a hold at contact.
    lift=45*max(0,math.cos(4*math.pi*t));dy=targetY-tipY+2-lift
    im=targetLayer.copy();im.alpha_composite(slide(tapH,0,dy))
    return im,dict(indexTip=[tipX,tipY+dy],targetY=targetY,gap=lift-2)
animate('hand-tap','motion.hand','人差し指でブロックをトントン',tap,['sources/generated/hand-rig-v2.png','sources/generated/squeeze-block-v2.png'],['index hand contacts block'],stationary=[200,410,300,440],note='雨ではなく、指と物体の接触を示すvariant。接触位置は画素で確認。')

# A cloth passes across a stationary, complete open hand. No baby face/torso needed.
wipehand=fit(read(GEN/'hand-wave.png'),(250,320));wipeHand=part('v2-wipe-hand',place(blank(),wipehand,(256-wipehand.width/2,118)))
wipecloth=fit(read(GEN/'cloth.png'),(126,126));part('v2-wipe-cloth',wipecloth)
def wipe(t):
    x=167+100*q(t);y=272+10*math.sin(2*math.pi*t);im=wipeHand.copy();place(im,wipecloth,(x-63,y-63))
    return im,dict(clothCenter=[x,y],handStationary=True)
animate('care-wipe','motion.change','手を布で拭く',wipe,['sources/generated/hand-wave.png','sources/generated/cloth.png'],['cloth across palm'],stationary=[223,390,280,418],note='手を拭くvariant。口や顔を拭く英文への割当は別途審査。')

# Clean diaper base is a new intact image, so removal masks cannot leave holes or ghosts.
dibase=centered(read(GEN/'diaper-body-v2.png'),(300,280),center=(256,260));part('v2-diaper-intact-body',dibase)
# Complete, rounded tabs are cropped outside the old body; no threshold color mask.
old=read(OUT/'sources/normalized/diaper.png');tab=trim(old.crop((50,166,130,230))).resize((85,61),Image.Resampling.LANCZOS)
part('v2-diaper-tab',tab)
leftHinge=122;rightHinge=390;hingeY=206
# A short overlap with the intact body hides each attachment root at every phase.
leftOpen=place(blank(),tab,(leftHinge-tab.width+9,hingeY-tab.height/2));rightOpen=place(blank(),ImageOps.mirror(tab),(rightHinge-9,hingeY-tab.height/2))
part('v2-diaper-left-open',leftOpen);part('v2-diaper-right-open',rightOpen)
def diaper2(t):
    theta=math.pi*q(t);c=math.cos(theta)
    def hinged(layer,pivot):
        if abs(c)<.02:return blank()
        return layer.transform((512,512),Image.Transform.AFFINE,(1/c,0,pivot-pivot/c,0,1,0),Image.Resampling.BICUBIC)
    im=dibase.copy();im.alpha_composite(hinged(leftOpen,leftHinge));im.alpha_composite(hinged(rightOpen,rightHinge))
    return im,dict(tabAngle=theta*180/math.pi,leftHinge=[leftHinge,hingeY],rightHinge=[rightHinge,hingeY])
diaperPoster,_=diaper2(0)
still('diaper-v2','scene.care','おむつ：欠けのない本体と留め具',diaperPoster,['sources/generated/diaper-body-v2.png','sources/generated/diaper.png'])
animate('change-diaper-v2','motion.change','おむつ：留め具の接合部を改善',diaper2,['sources/generated/diaper-body-v2.png','sources/generated/diaper.png'],['two hinged tabs'],stationary=[190,300,320,350],note='留め具の開閉候補。取り外し→交換の全過程ではないため、交換全体は未完。')

# Front panels close below a moving zipper pull. Sleeves, legs and collar stay still.
garment=centered(read(GEN/'clothes-zipper-v2.png'),(400,400));part('v2-open-garment',garment)
still('clothes-open-v2','scene.care','前開き服：着替えの準備',garment,'sources/generated/clothes-zipper-v2.png')
ga=np.asarray(garment);Y,X=np.indices((512,512));cream=(ga[:,:,0]>180)&(ga[:,:,1]>165)&(ga[:,:,3]>100)
# Find the cream lining on each body row, then project each front panel toward the zipper.
gaps={}
for y in range(145,361):
    ix=np.where(cream[y]&(np.arange(512)>180)&(np.arange(512)<331))[0]
    if len(ix)>8:gaps[y]=(int(ix.min()),int(ix.max()))
part('v2-lining-mask',Image.fromarray((cream.astype(np.uint8)*255)))
pull=Image.new('RGBA',(19,30));pd=ImageDraw.Draw(pull);pd.rounded_rectangle((3,0,15,12),radius=4,fill=(248,236,208));pd.rounded_rectangle((3,8,15,28),radius=5,fill=(255,205,72));pd.rounded_rectangle((6,12,12,23),radius=3,fill=(0,0,0,0));part('v2-zipper-pull',pull)
def zipper(t):
    progress=q(t);pullY=357-211*progress;im=garment.copy()
    for y,(le,re) in gaps.items():
        v=max(0,min(1,(y-pullY+12)/24));v=v*v*(3-2*v)
        if v<=0:continue
        for side in [-1,1]:
            if side<0:
                outer=146;edge=le;dest=round(edge+(256-edge)*v)
                if edge<=outer:continue
                strip=garment.crop((outer,y,edge+1,y+1)).resize((dest-outer+1,1),Image.Resampling.BICUBIC);place(im,strip,(outer,y))
            else:
                outer=366;edge=re;dest=round(edge+(256-edge)*v)
                if edge>=outer:continue
                strip=garment.crop((edge,y,outer+1,y+1)).resize((outer-dest+1,1),Image.Resampling.BICUBIC);place(im,strip,(dest,y))
    place(im,pull,(247,pullY-10))
    return im,dict(zipperY=pullY,progress=progress,panelClosingBelow=pullY)
animate('change-zipper','motion.change','前開き服：ファスナーを上げる・下げる',zipper,'sources/generated/clothes-zipper-v2.png',['zipper pull','front fabric panels'],stationary=[90,218,115,235],note='着替えの準備として留め具を操作する候補。服を身体に着せる全過程は未制作。')
