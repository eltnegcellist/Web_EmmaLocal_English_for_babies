"""Focused R2 replacements. Preserves all non-target deliverables byte for byte."""
import copy, shutil

r2problems={
 'hold-hands':'大人の指が途中で消える印象。指先を握りの先へ見せ、単一の整合する原画へ。',
 'hold-hands-squeeze':'握る手の前後関係と、大人の指の連続性を原画から修正。',
 'hands-open-v2':'別部品の親指を貼った継ぎ目。母指球・掌・親指を一体の原画へ。',
 'hand-open-close':'共通の掌と親指の継ぎ目を撤回。',
 'hand-count':'共通の掌と親指の継ぎ目を撤回。',
 'hand-wiggle':'共通の掌と親指の継ぎ目を撤回。',
 'hand-tap':'共通の掌と親指の継ぎ目を撤回。指差す手全体を再制作。',
 'sleep':'乳児の寝床に枕・掛け布団を置いた旧原画を撤回。',
 'wake-bed':'乳児の寝床に枕・掛け布団を置いた旧原画を撤回。',
 'wake-quilt':'掛け布団をめくる起床演出は撤回。',
 'kick':'足の向きは維持し、片足ずつの振り幅とテンポを明確に。'}

for old in list(assets):
 if old['id'] in r2problems:
  if old.get('productionPass',0)<5:
   archive_id='rejected-r2-'+old['id']
   if not any(a['id']==archive_id for a in archived):
    row=copy.deepcopy(old);row.update(id=archive_id,originalId=old['id'],status='rejected',readiness='rejected',reviewBatch='2026-10-18-R2',rejectionReason=r2problems[old['id']])
    for field in ['illustration','animation','poster']:
     if row.get(field):
      rel=Path('archive/2026-10-18-r2')/row[field];target=OUT/rel;target.parent.mkdir(parents=True,exist_ok=True)
      if not target.exists():shutil.copyfile(OUT/row[field],target)
      row[field]=str(rel)
    archived.append(row)
  assets.remove(old)
assets[:]=[a for a in assets if a['id']!='wake-daylight']
rigs.pop('wake-quilt',None)

def source_r2(name,wh=(420,420),center=(256,256)):
 im=read(GEN/f'{name}-r2.png');alpha=im.getchannel('A')
 mask=alpha.point(lambda a:255 if a>24 else 0);arr=np.asarray(mask);ys,xs=np.where(arr)
 # Remove only isolated alpha crumbs, never draw or repair anatomy with code.
 seed=(int(xs[len(xs)//2]),int(ys[len(ys)//2]));ImageDraw.floodfill(mask,seed,128)
 connected=Image.fromarray(((np.asarray(mask)==128)*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
 im.putalpha(ImageChops.multiply(alpha,connected));return centered(im,wh,center)

def local_r2(im,fields):
 mesh=[]
 def point(x,y):
  dx=dy=0
  for cx,cy,r,ax,ay in fields:
   w=max(0,1-((x-cx)**2+(y-cy)**2)/r**2)**2;dx+=ax*w;dy+=ay*w
  return x-dx,y-dy
 for y in range(0,512,16):
  for x in range(0,512,16):
   quad=[]
   for px,py in [(x,y),(x,y+16),(x+16,y+16),(x+16,y)]:quad.extend(point(px,py))
   mesh.append(((x,y,x+16,y+16),tuple(quad)))
 return im.transform((512,512),Image.Transform.MESH,mesh,Image.Resampling.BICUBIC)

# Adult index is deliberately visible before AND after the child's grip.
hold_r2=part('r2-hold-whole-scene',source_r2('hold'))
still('hold-hands','scene.hands','手をつなぐ：握りの先に大人の指先が見える',hold_r2,'sources/generated/hold-r2.png',note='大人の指の付け根・握られる部分・指先を同じ軸で描き直した単一原画。子の指による遮蔽を目視審査。')
def holding_r2(t):
 p=q(t);return local_r2(hold_r2,[(318,183,48,-3*p,3*p)]),dict(childGrip=3*p,adultIndexContinuous=True,sourceRedrawn=True)
animate('hold-hands-squeeze','motion.hand','手をつなぐ：つながった指をやさしく握る',holding_r2,'sources/generated/hold-r2.png',['child curled fingers at grip'],stationary=[180,340,220,370],note='原画の指の連続性を修正後、子の握り周辺だけを小さく動かす。大人の掌・手首・指の両端は固定。')

# A coherent hand contains the thumb, thenar, palm and cuff in ONE painted layer.
# Four existing isolated finger paintings are reused above natural knuckles.
master=source_r2('hand',(390,430),center=(256,260));part('r2-hand-whole-master',master)
root_x=[215,274,326,374];root_y=[249,227,241,267]
boxes=[(175,68,246,257),(245,42,304,235),(304,70,366,249),(366,119,421,275)]
base=master.copy();base_a=np.asarray(base.getchannel('A')).copy();digit_r2=[]
for j,(x0,y0,x1,y1) in enumerate(boxes):
 # Existing isolated finger paintings are retained; the defect was the separate thumb.
 # Their straight axes keep a bent little finger from projecting off the side of the palm.
 piece=read(OUT/'parts'/f'v2-finger-{j}.png').resize((52 if j==0 else 54 if j==1 else 50 if j==2 else 43,[189,193,179,156][j]),Image.Resampling.LANCZOS);digit_r2.append(piece)
 base_a[:root_y[j],x0:x1]=0
 part(f'r2-finger-{j}',piece)
base.putalpha(Image.fromarray(base_a));part('r2-palm-thumb-one-piece',base)

def span_r2(canvas,piece,cx,root,tip):
 h=max(3,round(abs(tip-root))+3);p=piece.resize((piece.width,h),Image.Resampling.LANCZOS)
 if tip>root:p=ImageOps.flip(p)
 place(canvas,p,(cx-piece.width/2,min(root,tip)-1))

def hand_r2(values):
 im=base.copy();trace=[]
 for j,(piece,o) in enumerate(zip(digit_r2,values)):
  length=piece.height;alpha=math.radians(76*(1-o));beta=math.radians(104*(1-o))
  root=root_y[j]+8;joint=root-length*.52*math.cos(alpha);tip=joint-length*.48*math.cos(alpha+beta)
  mid=round(piece.height*.48);prox=piece.crop((0,mid,piece.width,piece.height));dist=piece.crop((0,0,piece.width,mid+2))
  pa=np.asarray(prox).copy();fade=np.minimum(1,np.arange(prox.height-1,-1,-1)/9);pa[:,:,3]=(pa[:,:,3]*fade[:,None]).astype(np.uint8)
  span_r2(im,Image.fromarray(pa),root_x[j],root,joint);span_r2(im,dist,root_x[j],joint,tip)
  if o<.88:
   cap=piece.crop((0,0,piece.width,min(piece.height,piece.width))).resize((piece.width,42),Image.Resampling.LANCZOS)
   cap.putalpha(cap.getchannel('A').point(lambda a:round(a*min(1,(.88-o)/.18))))
   place(im,cap,(root_x[j]-piece.width/2,joint-20))
  trace.append(dict(root=[root_x[j],root],knuckle=[root_x[j],joint],tip=[root_x[j],tip],open=o))
 return im,dict(fingers=trace,thumbAndThenar='one-painted-layer',palmAnchor=[256,420])

opened,_=hand_r2([1]*4)
hand_sources=['sources/generated/hand-r2.png','sources/generated/hand-rig-v2.png']
still('hands-open-v2','scene.hands','手：母指球から掌まで一体の原画',master,'sources/generated/hand-r2.png',note='親指を別部品で貼らない。親指・母指球・掌・手首・袖口は一枚の原画。静止画は手全体の一枚絵。動作では既存の4本の指の原画を関節位置で再利用。')
def opening_r2(t):return hand_r2([1-q(t)]*4)
animate('hand-open-close','motion.hand','手：指を曲げて開く',opening_r2,hand_sources,['four fingers bend at their joints'],stationary=[220,405,290,440],note='親指・母指球・掌を固定して4本の指を曲げる。親指だけを貼る旧リグは使用しない。')
def counting_r2(t):
 phase=t*7;extended=min(4,phase/.9) if phase<4.5 else max(0,4-(phase-4.5)*4/2.5)
 values=[max(0,min(1,extended-j)) for j in range(4)];values=[v*v*(3-2*v) for v in values]
 im,tr=hand_r2(values);tr['extendedFingers']=1+sum(v>.95 for v in values);return im,tr
animate('hand-count','motion.hand','指を数える：親指から1本→5本',counting_r2,hand_sources,['index','middle','ring','little'],frame_count=48,stationary=[220,405,290,440],note='親指を1本目にして、残る4本を順に伸ばす。母指球と掌は一体のまま。0本の握り拳とは表示しない。')
def wiggling_r2(t):return hand_r2([.64+.32*math.sin(2*math.pi*t+j*math.pi/2) for j in range(4)])
animate('hand-wiggle','motion.hand','手：掌を保ち、指を1本ずつ動かす',wiggling_r2,hand_sources,['four independent fingers'],stationary=[220,405,290,440],note='親指・母指球・掌は一体の原画。4本の指の関節だけを動かす。')

# Pointing gesture is its own whole-hand edit, not a thumb pasted on the rig.
tap_sprite=fit(read(GEN/'tap-r2.png').rotate(180),(165,245));tap_layer=place(blank(),tap_sprite,(256-tap_sprite.width/2,65));part('r2-tap-whole-hand',tap_layer)
target=part('v2-tap-target',read(OUT/'parts/v2-tap-target.png'));aa=np.asarray(tap_layer)[:,:,3];tip_y=int(np.where(aa>100)[0].max());tip_x=int(np.median(np.where(aa[tip_y]>100)[0]));target_y=int(np.where(np.asarray(target)[:,tip_x,3]>100)[0].min())
def tapping_r2(t):
 lift=45*max(0,math.cos(4*math.pi*t));dy=target_y-tip_y+2-lift
 im=target.copy();im.alpha_composite(slide(tap_layer,0,dy));return im,dict(indexTip=[tip_x,tip_y+dy],targetY=target_y,gap=lift-2)
animate('hand-tap','motion.hand','指差す手：ブロックに触れて離れる',tapping_r2,['sources/generated/tap-r2.png','sources/generated/squeeze-block-v2.png'],['whole pointing hand approaching block'],stationary=[200,410,300,440],note='親指を含む指差し姿勢の手全体を原画から再制作。指先を切らず、ブロックへ接触させる。')

# Clear cot, a flat taut fitted sheet only. No baby, pillow, duvet or loose textile.
crib=part('r2-clear-cot',source_r2('crib',(405,350),center=(244,282)))
sun=fit(read(GEN/'sun.png'),(65,65));sun_layer=place(blank(),sun,(405,55))
still('sleep','scene.sleep','眠る場所：空のベビーベッド',crib,'sources/generated/crib-r2.png',note='枕・掛け布団・玩具のない、空のベビーベッドと平らなマットレス／フィットシーツ。赤ちゃんは描かない。')
morning=crib.copy();morning.alpha_composite(sun_layer)
still('wake-bed','scene.sleep','朝の寝床：空のベビーベッドと外側の日差し',morning,['sources/generated/crib-r2.png','sources/generated/sun.png'],note='寝床内は平らなフィットシーツだけ。朝日の記号は寝床の外。本人が起きたことを直接示す絵ではない。')
def daylight_r2(t):
 # Only the symbol OUTSIDE the cot moves. Mattress and cot are unchanged.
 im=crib.copy();sy=28*(1-q(t));im.alpha_composite(slide(sun_layer,0,sy));return im,dict(cotStationary=True,onlyOutsideSunMoves=True,sunY=55+sy,noBeddingMotion=True)
animate('wake-daylight','motion.change','起床の代案：寝床は動かさず、外側に朝日',daylight_r2,['sources/generated/crib-r2.png','sources/generated/sun.png'],['sun symbol outside the empty cot'],stationary=[180,250,250,285],lossless=True,note='wake-quiltを撤回した別案。枕・掛け布団なし。空の寝床と朝の記号だけで、実際に起きる動作は表さない。action.wakeへの採用は保留。')

# The prior opposite-angle sine moved both feet in mirror synchrony.
# Half cycles now alternate: one ankle moves while the other is at rest.
foot=fit(read(GEN/'foot.png'),(130,250));fw,fh=foot.size
left=read(OUT/'parts/kick-left.png');right=read(OUT/'parts/kick-right.png')
def kicking_r2(t):
 s=math.sin(2*math.pi*t);la=26*max(0,s);ra=-26*max(0,-s)
 im=rotate(left,la,(140,380));im.alpha_composite(rotate(right,ra,(372,380)))
 return im,dict(leftAngle=la,rightAngle=ra,leftAnchor=[140,380],rightAnchor=[372,380],bigToes='inward',oneFootAtATime=True)
animate('kick','motion.kick','キック：片足ずつ、大きく交互に動かす',kicking_r2,'sources/generated/foot.png',['left foot about fixed ankle','right foot about fixed ankle'],frame_count=42,note='内向きの親指を維持。26度・42フレーム・3.486秒。半周期ごとに片足だけ動き、左右同時の鏡像運動をやめた。220px実再生で目視審査。')

for a in assets:
 if a.get('productionPass')==5:a['humanReview']='R2-candidate-not-approved'
# Preserve the submitted R2 review instead of overwriting it with R1's generator.
feedback_path=OUT/'qa/revision-feedback.json';feedback=json.loads(feedback_path.read_text())
follow=feedback.get('followUp',{})
follow.update(date='2026-10-18',documentation='assets/visual-cue/artwork/REVIEW_REQUEST_20261018_R2.md',decision='Focused replacements produced; no adoption approval',items=[dict(assetId=k,problem=v,status='withdrawn-replaced-by-wake-daylight-proposal' if k=='wake-quilt' else 'replacement-candidate-human-review-pending') for k,v in r2problems.items()],sleepReference='https://www.nhs.uk/baby/caring-for-a-newborn/sudden-infant-death-syndrome-sids/')
feedback['followUp']=follow;feedback_path.write_text(json.dumps(feedback,ensure_ascii=False,indent=2)+'\n')
