"""R3: coherent static grip, whole-hand wave, drink instead of unsupported block tap."""
import copy, shutil
retired=['hold-hands-squeeze','hand-open-close','hand-count','hand-wiggle','hand-squeeze-v3','hand-tap']
problems={key:'握る・指を曲げる動作の不自然さが残るため撤回。手振りを別の意味の候補として制作。' for key in retired}
problems['hold-hands']='大人の人差し指が長すぎ、子の手が指へめり込む。通常の指の長さに子の手を近づける構図へ再制作。'
problems['hand-tap']='実英文のtap12行は雨4・音楽7・足1。ブロック接触を指示する行がなく、汎用動作として撤回。'
for old in list(assets):
 if old['id'] in problems or old['id'] in ['hand-wave','cup-sip']:
  if old['id'] in problems and old.get('productionPass',0)<6:
   archive_id='rejected-r3-'+old['id']
   if not any(a['id']==archive_id for a in archived):
    row=copy.deepcopy(old);row.update(id=archive_id,originalId=old['id'],status='rejected',readiness='rejected',reviewBatch='2026-10-19-R3',rejectionReason=problems[old['id']])
    for field in ['illustration','animation','poster']:
     if row.get(field):
      rel=Path('archive/2026-10-19-r3')/row[field];target=OUT/rel;target.parent.mkdir(parents=True,exist_ok=True)
      if not target.exists():shutil.copyfile(OUT/row[field],target)
      row[field]=str(rel)
    archived.append(row)
  assets.remove(old);rigs.pop(old['id'],None)

# Keep withdrawn movies only under their explicit archive paths.
for row in archived:
 if row.get('reviewBatch')=='2026-10-19-R3' and row['kind']=='animation':
  for field,directory in [('animation','animations'),('poster','posters')]:
   current=OUT/directory/(row['originalId']+'.webp')
   if current.exists():
    assert hashlib.sha256(current.read_bytes()).digest()==hashlib.sha256((OUT/row[field]).read_bytes()).digest()
    current.unlink()

def source_r3(name,wh=(420,420),center=(256,256)):
 im=read(GEN/f'{name}.png');alpha=im.getchannel('A');mask=alpha.point(lambda a:255 if a>24 else 0)
 arr=np.asarray(mask);ys,xs=np.where(arr);seed=(int(xs[len(xs)//2]),int(ys[len(ys)//2]));ImageDraw.floodfill(mask,seed,128)
 connected=Image.fromarray(((np.asarray(mask)==128)*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
 im.putalpha(ImageChops.multiply(alpha,connected));return centered(im,wh,center)

hold=part('r3-hold-whole-scene',source_r3('hold-r3'))
still('hold-hands','scene.hands','手をつなぐ：自然な長さの指に子の手を近づける',hold,'sources/generated/hold-r3.png',note='大人の中指が最も長い通常の開いた手を基準に再制作。子の手は左から近づき、人差し指を外側から包む。無理に指先を突き出さない静止画。人体・接触の自然さは目視採用審査待ち。')
whole=part('r3-wave-whole-hand',source_r3('hand-r2',(290,350),(256,247)))
def waving_r3(t):
 angle=22*math.sin(2*math.pi*t)
 return rotate(whole,angle,(256,397)),dict(angle=angle,anchor=[256,397],singlePaintedHand=True,noFingerDeformation=True)
animate('hand-wave','motion.hand','手を振る：手首を支点に左右へ',waving_r3,'sources/generated/hand-r2.png',['one coherent hand rotating about wrist'],frame_count=42,note='親指・4本の指・掌・手首がつながる一枚の原画を、手首を支点に左右22度振る。指を分割・屈伸しない。握る・数える・タップへの意味の流用はしない。')

cup=part('r3-cup-empty',source_r3('cup-empty-r3',(370,345),(256,280)))
# Liquid is an independent layer clipped to the visible cavity, behind the intact painted rim.
cavity=Image.new('L',(512,512));ImageDraw.Draw(cavity).ellipse((163,159,348,240),fill=255)
cavity=ImageChops.multiply(cavity,cup.getchannel('A'));part('r3-cup-cavity-mask',cavity)
def sipping_r3(t):
 p=q(t);angle=-38*p;pivot=(256,285);im=rotate(cup,angle,pivot);mask=rotate(cavity,angle,pivot)
 mass=np.asarray(mask).sum(axis=1);cum=np.cumsum(mass);fraction=.78-.5*p
 line=int(np.searchsorted(cum,cum[-1]*(1-fraction)))
 lower=Image.new('L',(512,512));ImageDraw.Draw(lower).rectangle((0,line,511,511),fill=255)
 liquid=ImageChops.multiply(mask,lower);paint=Image.new('RGBA',(512,512),(88,195,226,255));paint.putalpha(liquid);im.alpha_composite(paint)
 # Small world-horizontal highlight follows the changing liquid level inside the mask.
 stripe=Image.new('L',(512,512));ImageDraw.Draw(stripe).rectangle((0,line,511,line+2),fill=180);stripe=ImageChops.multiply(stripe,liquid)
 shine=Image.new('RGBA',(512,512),(190,235,245,255));shine.putalpha(stripe);im.alpha_composite(shine)
 return im,dict(cupAngle=angle,liquidSurfaceAngle=0,liquidSurfaceY=line,visibleFillFraction=fraction,liquidPixels=int((np.asarray(liquid)>100).sum()),independentLiquid=True)
animate('cup-sip','motion.sip','コップで飲む：傾きと液面が変わる',sipping_r3,'sources/generated/cup-empty-r3.png',['cup tilt','independent horizontal liquid surface inside cavity'],frame_count=42,note='drinkの38行を参考に、哺乳瓶とは別の飲み方の候補を追加。コップが傾く間も液面は水平、見える液体量を減らして戻すループ。口・人物は描かない。飲み終えた結果の再現ではなく繰り返し用。')
for a in assets:
 if a.get('productionPass')==6:a['humanReview']='R3-candidate-not-approved'
feedback_path=OUT/'qa/revision-feedback.json';feedback=json.loads(feedback_path.read_text())
feedback['previousFollowUpR2']=feedback.get('previousFollowUpR2',feedback.get('followUp'))
feedback['followUp']=dict(date='2026-10-19',documentation='assets/visual-cue/artwork/REVIEW_R3_RESULT.md',decision='Three focused candidates; six loops withdrawn, no adoption approval',items=[dict(assetId='hold-hands',problem=problems['hold-hands'],status='再制作候補・目視確認待ち'),dict(assetId='hand-wave',problem='握る・開閉・数える・指を動かす6動画を撤回。指を分割しない手振りへ。',status='手振り候補・別の動作Cueは未制作'),dict(assetId='cup-sip',problem=problems['hand-tap'],status='コップで飲む候補を追加・目視確認待ち')])
feedback_path.write_text(json.dumps(feedback,ensure_ascii=False,indent=2)+'\n')
