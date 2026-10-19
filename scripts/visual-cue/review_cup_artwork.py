"""Cup-only correction: rim-limited surface, visible outflow and one-way volume loss."""
import copy,shutil
old=next(a for a in assets if a['id']=='cup-sip')
if old.get('productionPass',0)<7 and not any(a['id']=='rejected-cup-liquid-r3' for a in archived):
 row=copy.deepcopy(old);row.update(id='rejected-cup-liquid-r3',originalId='cup-sip',status='rejected',readiness='rejected',reviewBatch='2026-10-19-cup',rejectionReason='液面が低い側の縁を超えるのに流出しない。水量を戻す旧ループも撤回。')
 for field in ['animation','poster']:
  rel=Path('archive/2026-10-19-cup')/row[field];target=OUT/rel;target.parent.mkdir(parents=True,exist_ok=True)
  if not target.exists():shutil.copyfile(OUT/row[field],target)
  row[field]=str(rel)
 archived.append(row)
assets[:]=[a for a in assets if a['id']!='cup-sip']
cup=read(OUT/'parts/r3-cup-empty.png');cavity=read(OUT/'parts/r3-cup-cavity-mask.png').getchannel('R')
# Geometry is an illustrative 2-D vessel section. World y points down.
pivot=(256,285);section=[(164,200),(348,200),(326,375),(186,375)]
def transformed(pt,deg):
 theta=math.radians(deg);x,y=pt[0]-pivot[0],pt[1]-pivot[1]
 return (pivot[0]+x*math.cos(theta)-y*math.sin(theta),pivot[1]+x*math.sin(theta)+y*math.cos(theta))
def area(poly):return abs(sum(x*y2-x2*y for (x,y),(x2,y2) in zip(poly,poly[1:]+poly[:1])))/2 if poly else 0

def below(poly,line):
 result=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  ina=a[1]>=line;inb=b[1]>=line
  if ina:result.append(a)
  if ina!=inb:
   f=(line-a[1])/(b[1]-a[1]);result.append((a[0]+f*(b[0]-a[0]),line))
 return result

def smooth(v):v=max(0,min(1,v));return v*v*(3-2*v)
count=48;states=[];volume=area(section)*.95
for i in range(count):
 t=i/count
 rise=smooth((t-.18)/.27);fall=smooth((t-.60)/.20);angle=38*(rise-fall)
 poly=[transformed(p,angle) for p in section];lip=transformed((348,200),angle)
 capacity=area(below(poly,lip[1]));outflow=max(0,volume-capacity);volume=min(volume,capacity)
 lo=min(p[1] for p in poly);hi=max(p[1] for p in poly)
 for _ in range(30):
  mid=(lo+hi)/2
  if area(below(poly,mid))>volume:lo=mid
  else:hi=mid
 line=(lo+hi)/2
 opacity=smooth(t/.10)*(1-smooth((t-.86)/.12))
 states.append(dict(cupAngle=-angle,clockwiseAngle=angle,liquidSurfaceY=line,lowRimY=lip[1],liquidSurfaceAngle=0,remainingVolume=volume,spilledVolume=outflow,rim=transformed((360,200),angle),alpha=opacity,transition=opacity<.99))

water_color=(76,190,223,255)
def sipping_cup(t):
 i=min(count-1,round(t*count));state=states[i];im=rotate(cup,state['cupAngle'],pivot);mask=rotate(cavity,state['cupAngle'],pivot)
 lower=Image.new('L',(512,512));ImageDraw.Draw(lower).rectangle((0,math.ceil(state['liquidSurfaceY']),511,511),fill=255)
 liquid=ImageChops.multiply(mask,lower);paint=Image.new('RGBA',(512,512),water_color);paint.putalpha(liquid);im.alpha_composite(paint)
 stripe=Image.new('L',(512,512));ImageDraw.Draw(stripe).rectangle((0,math.ceil(state['liquidSurfaceY']),511,math.ceil(state['liquidSurfaceY'])+2),fill=180)
 shine=Image.new('RGBA',(512,512),(180,232,246,255));shine.putalpha(ImageChops.multiply(liquid,stripe));im.alpha_composite(shine)
 # Each discharged parcel travels outward and down under gravity. Old parcels detach
 # after the pour stops; nothing flows back into the cup on the return stroke.
 stream=Image.new('RGBA',(1024,1024));draw=ImageDraw.Draw(stream);particles=0
 if state['spilledVolume']>2:
  inner=transformed((345,201),state['clockwiseAngle']);outer=state['rim']
  draw.line([(inner[0]*2,inner[1]*2),(outer[0]*2,outer[1]*2)],fill=water_color,width=16,joint='curve')
 for emitted in range(max(0,i-10),i+1):
  parcel=states[emitted]
  if parcel['spilledVolume']<2:continue
  sx,sy=parcel['rim'];age=(i-emitted)*.083;vx=65;vy=18;gravity=600
  points=[]
  for k in range(5):
   a=age+k*.083/4;x=sx+vx*a;y=sy+vy*a+.5*gravity*a*a
   points.append((x*2,y*2))
  y=points[-1][1]/2;fade=max(0,min(1,(478-y)/38));width=5+min(5,math.sqrt(parcel['spilledVolume'])/5)
  if fade<=0:continue
  color=water_color[:3]+(round(240*fade),)
  draw.line(points,fill=color,width=round(width*2),joint='curve');r=width
  for x,y2 in [points[0],points[-1]]:draw.ellipse((x-r,y2-r,x+r,y2+r),fill=color)
  particles+=1
 stream=stream.resize((512,512),Image.Resampling.LANCZOS);im.alpha_composite(stream)
 im.putalpha(im.getchannel('A').point(lambda a:round(a*state['alpha'])))
 trace=dict(state);trace.update(streamParcels=particles,independentLiquid=True,resetOnlyWhileInvisible=True)
 return im,trace
animate('cup-sip','motion.sip','コップを傾ける：縁から水が流れ、水量が減る',sipping_cup,'sources/generated/cup-empty-r3.png',['cup tilt','rim-limited horizontal surface','water flowing down from lower rim'],frame_count=count,note='液面が低い側の縁に達すると水が流れ出し、その量だけ残量が減る。傾きを戻しても水は増えない。末尾のフェードで次の一杯に切り替える3.984秒ループ。口は描かないため「飲む」の意味の適合も再確認待ち。液面の指摘を受け、この1点だけ採用保留。')
if not SAMPLE_ONLY:
 row=next(a for a in assets if a['id']=='cup-sip');row.update(loopTransition='fade-between-servings',posterFrame=7,humanReview='user-approval-held',approvalState='held')
if not SAMPLE_ONLY:
 poster,_=sipping_cup(7/count);poster.save(OUT/'posters/cup-sip.webp',quality=86,method=6);poster.save(OUT/'sources/normalized/cup-sip-poster.png')
feedback_path=OUT/'qa/revision-feedback.json';feedback=json.loads(feedback_path.read_text())
if feedback.get('followUp',{}).get('documentation')!='assets/visual-cue/artwork/CUP_LIQUID_REVIEW_20261019.md':feedback['previousFollowUpR3']=feedback.get('followUp')
feedback['followUp']=dict(date='2026-10-19',documentation='assets/visual-cue/artwork/CUP_LIQUID_REVIEW_20261019.md',decision='Cup-only correction; 42 other assets remain accepted',items=[dict(assetId='cup-sip',problem='傾けたコップの水が縁を超えるのに流出しない。',status='修正候補・採用保留。利用者の再確認待ち。')]);feedback_path.write_text(json.dumps(feedback,ensure_ascii=False,indent=2)+'\n')
