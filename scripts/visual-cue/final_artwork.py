"""Final production pass. Isolated original raster parts; no runtime integration."""
def clean(im):
    im=largest(im);a=im.getchannel('A');im.putalpha(a.point(lambda v: v if v>12 else 0));return trim(im)
def cell(name,box=None):
    im=read(GEN/f'{name}-v3.png');return clean(im.crop(box) if box else im)
def ease(v):
    v=max(0,min(1,v));return v*v*(3-2*v)
def tween(a,b,u):return a+(b-a)*u
# Both hands close around cloth. No infant, teddy, heart or person silhouette.
hs=read(GEN/'hug-kit-v3.png');hw,hh=hs.size
bundle=part('v3-hug-blanket',fit(clean(hs.crop((0,0,hw//2,hh))),(176,285)))
harm=part('v3-hug-arm',fit(clean(hs.crop((hw//2,0,hw,hh))),(205,270)))
blanketLayer=place(blank(),bundle,(256-bundle.width/2,104))
rightArm=place(blank(),harm,(251,146));leftArm=slide(ImageOps.mirror(rightArm),0,25)
def hug3(t):
    pressure=q(t);im=blanketLayer.copy();angle=35+10*pressure
    im.alpha_composite(rotate(leftArm,-angle,(118,407)));im.alpha_composite(rotate(rightArm,angle,(394,382)))
    return im,dict(leftCuff=[118,407],rightCuff=[394,382],armAngle=angle,blanketStationary=True)
still('family-care','scene.family','養育者の手で毛布を包む',hug3(.5)[0],'sources/generated/hug-kit-v3.png',note='毛布だけを包む動作見本。赤ちゃん・家族の人数や関係性は描かない。抱っこの意味の採用は要目視審査。')
animate('hug-arms','motion.hug','両腕を寄せて毛布をぎゅっと包む',hug3,'sources/generated/hug-kit-v3.png',['left forearm and hand','right forearm and hand'],stationary=[230,125,280,166],note='両袖口を支点に腕を寄せる。抱き寄せる動作の候補であり、赤ちゃんを抱く場面の採用承認ではない。')

belly=cell('tummy');tummyLayer=centered(belly,(305,330),center=(256,280));part('v3-tummy',tummyLayer)
still('tummy','scene.tummy','おなか：へそ・衣服の境界',tummyLayer,'sources/generated/tummy-v3.png',note='年齢を特定しない身体部位。顔・全身は描かない。')
# A supported grasp: palm below, four fingers above, real ball between them.
gs=read(GEN/'grip-kit-v3.png');gw,gh=gs.size
ball=part('v3-grip-ball',fit(clean(gs.crop((0,0,560,gh))),(155,155)))
gpalm=part('v3-grip-palm',fit(clean(gs.crop((570,0,1275,gh))),(285,205)))
gfingers=part('v3-grip-fingers',fit(clean(gs.crop((1275,0,gw,gh))),(193,193)))
palm3=place(blank(),gpalm,(157,256));finger3=place(blank(),gfingers,(185,160))
def squeeze3(t):
    pressure=q(t);im=palm3.copy();w=round(155+10*pressure);h=round(155-24*pressure)
    obj=ball.resize((w,h),Image.Resampling.LANCZOS);place(im,obj,(251-w/2,290-h/2))
    angle=12*pressure;im.alpha_composite(rotate(finger3,angle,(355,333)))
    return im,dict(ballWidth=w,ballHeight=h,fingerAngle=angle,wrist=[410,370])
animate('hand-squeeze-v3','motion.hand','手のひらと指でボールを握る',squeeze3,'sources/generated/grip-kit-v3.png',['four curved fingers','soft ball compression'],stationary=[398,355,416,380],note='親指と掌で下を支え、上の4本の指を曲げて押す。旧ブロック試作を置換。')

# Garment exchange on a stationary cropped torso; no head or full body.
ds=read(GEN/'dress-kit-v3.png');dw,dh=ds.size
shirts=[part('v3-shirt-'+n,clean(ds.crop(box))) for n,box in [('yellow',(0,0,dw//2,dh)),('teal',(dw//2,0,dw,dh))]]
bb=trim(belly);torso=bb.crop((0,round(bb.height*.27),bb.width,bb.height));body3=centered(torso,(252,210),center=(256,349));part('v3-dressing-torso',body3)
def shirt_at(im,which,center,width):
    p=fit(shirts[which],(round(width),round(width)));place(im,p,(center[0]-p.width/2,center[1]-p.height/2))
def dress3(t):
    # Reverse the physical exchange for a seamless educational loop, with endpoint holds.
    phase=q(t);remove=ease(phase/.43);puton=ease((phase-.52)/.43);im=body3.copy()
    oldcenter=(tween(256,89,remove),tween(275,128,remove));newcenter=(tween(423,256,puton),tween(128,275,puton))
    shirt_at(im,1,newcenter,tween(125,350,puton));shirt_at(im,0,oldcenter,tween(350,125,remove))
    return im,dict(oldShirt=list(oldcenter),newShirt=list(newcenter),remove=remove,putOn=puton,torsoStationary=True)
animate('change-clothes','motion.change','服を脱ぐ→別の服に着替える',dress3,['sources/generated/dress-kit-v3.png','sources/generated/tummy-v3.png'],['yellow shirt removed','teal shirt put on'],stationary=[230,418,280,421],frame_count=48,note='身体はおなかの一部だけ。服を順に移す説明図の候補。逆順で元に戻るループ。')
# One arm, then the other passes through a real sleeve, with the shoulder hidden behind cloth.
arm=part('v3-bare-arm',fit(cell('dressing-arm'),(183,198)))
armleft=place(blank(),arm,(42,188));armright=ImageOps.mirror(armleft)
shirtfront=blank();shirt_at(shirtfront,0,(256,267),350)
def sleeves3(t):
    phase=q(t);left=ease(phase/.43);right=ease((phase-.52)/.43)
    im=body3.copy()
    # Shorten to the sleeve opening; the upper forearm is occluded by the garment.
    for layer,p in [(armleft,left),(armright,right)]:
        shifted=slide(layer,0,-112*(1-p));mask=Image.new('L',(512,512));ImageDraw.Draw(mask).rectangle((0,238,511,511),fill=255)
        shifted.putalpha(ImageChops.multiply(shifted.getchannel('A'),mask));im.alpha_composite(shifted)
    im.alpha_composite(shirtfront)
    return im,dict(leftSleeveProgress=left,rightSleeveProgress=right,shouldersOccluded=True)
animate('dress-sleeves','motion.change','片腕ずつ袖を通す',sleeves3,['sources/generated/dressing-arm-v3.png','sources/generated/dress-kit-v3.png','sources/generated/tummy-v3.png'],['left hand and forearm','right hand and forearm'],stationary=[230,185,280,200],frame_count=48,note='袖の後ろから片腕ずつ手を出す部分図。顔・全身・赤ちゃんは描かない。')

# Full object exchange: open old tabs, remove old diaper, introduce clean one, close tabs.
di3base=read(OUT/'parts/v2-diaper-intact-body.png');di3l=read(OUT/'parts/v2-diaper-left-open.png');di3r=read(OUT/'parts/v2-diaper-right-open.png')
def diaper_pose3(closed):
    c=math.cos(math.pi*closed);im=di3base.copy()
    if abs(c)>.02:
        for layer,pivot in [(di3l,122),(di3r,390)]:im.alpha_composite(layer.transform((512,512),Image.Transform.AFFINE,(1/c,0,pivot-pivot/c,0,1,0),Image.Resampling.BICUBIC))
    return im
mat=fit(read(GEN/'cloth.png'),(280,240));matLayer=place(blank(),mat,(256-mat.width/2,350-mat.height/2));part('v3-changing-mat',matLayer)
def diaper_at(im,closed,center,scale,old=False):
    pose=diaper_pose3(closed)
    if old:
        ar=np.asarray(pose).copy();blue=(ar[:,:,2].astype(int)>ar[:,:,0].astype(int)+20)&(ar[:,:,3]>12)
        # Different trim identifies the previous clean diaper, with no stains or gross details.
        ar[blue,0]=245;ar[blue,1]=184;ar[blue,2]=100;pose=Image.fromarray(ar)
    p=fit(pose,(round(380*scale),round(380*scale)));place(im,p,(center[0]-p.width/2,center[1]-p.height/2))
def exchange3(t):
    phase=q(t);opened=ease(phase/.18);removed=ease((phase-.20)/.25);introduced=ease((phase-.50)/.26);fastened=ease((phase-.79)/.18)
    im=matLayer.copy();oldcenter=[tween(256,88,removed),tween(269,100,removed)];newcenter=[tween(424,256,introduced),tween(100,269,introduced)]
    diaper_at(im,fastened,newcenter,tween(.30,.87,introduced));diaper_at(im,1-opened,oldcenter,tween(.87,.30,removed),old=True)
    return im,dict(oldCenter=oldcenter,newCenter=newcenter,open=opened,remove=removed,introduce=introduced,fasten=fastened)
animate('change-diaper-exchange','motion.change','おむつを外す→新しいおむつを置き留める',exchange3,['sources/generated/diaper-body-v2.png','sources/generated/diaper.png','sources/generated/cloth.png'],['old diaper tabs','old diaper','clean diaper','clean diaper tabs'],stationary=[252,420,268,432],frame_count=48,note='同時に2枚を重ねず、旧→新の順で交換。身体を描かない物体操作の説明図。逆順で戻す。')

# Wake: quilt folds towards the foot while mattress/pillow remain fixed.
ws=read(GEN/'wake-kit-v3.png');ww,wh=ws.size
bed3=fit(clean(ws.crop((0,0,ww//2,wh))),(345,340));quilt3=fit(clean(ws.crop((ww//2,0,ww,wh))),(307,235))
bedLayer=part('v3-wake-bed',place(blank(),bed3,(256-bed3.width/2,150)))
part('v3-wake-quilt',quilt3);sun3=fit(read(GEN/'sun.png'),(96,96))
def wake3(t):
    opening=q(t);im=blank();place(im,sun3,(363,147-98*opening));im.alpha_composite(bedLayer)
    height=round(quilt3.height*(1-.45*opening));quilt=quilt3.resize((quilt3.width,height),Image.Resampling.LANCZOS)
    place(im,quilt,(256-quilt.width/2+16,416-height))
    return im,dict(quiltTop=416-height,quiltFoot=416,sunY=147-98*opening,mattressStationary=True)
still('wake-bed','scene.sleep','起床：掛け物を開いたベッド',wake3(.5)[0],['sources/generated/wake-kit-v3.png','sources/generated/sun.png'])
animate('wake-quilt','motion.change','起床：掛け物を足元へ折り、朝日が昇る',wake3,['sources/generated/wake-kit-v3.png','sources/generated/sun.png'],['quilt folding to bed foot','morning sun'],stationary=[194,191,245,213],note='就寝素材と分けた起床場面の候補。寝ている本人は描かない。')

# Gentle tummy pat: physical hand contact, no claim that an infant actually burps.
patArm=fit(cell('dressing-arm'),(193,210));patLayer=place(blank(),patArm,(218,191))
def burp3(t):
    pressure=(1-math.cos(4*math.pi*t))/2;im=tummyLayer.copy();angle=12*pressure
    im.alpha_composite(rotate(patLayer,angle,(383,211)))
    return im,dict(handAngle=angle,forearmRoot=[383,211],tummyStationary=True)
animate('care-burp','motion.change','げっぷを促す、おなかへのやさしい手の動き',burp3,['sources/generated/tummy-v3.png','sources/generated/dressing-arm-v3.png'],['hand rests and pats tummy'],stationary=[148,383,189,400],note='「Burp, burp! Little tummy. Nice and easy.」向けケア候補。げっぷが出た事実や背中を叩く動作を意味しない。意味適合は要審査。')
