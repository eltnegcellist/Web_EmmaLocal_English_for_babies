#!/usr/bin/env python3
from pathlib import Path
import json,collections,csv,math
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/visual-cue/artwork'
m=json.loads((OUT/'manifest.json').read_text());q=json.loads((OUT/'qa/validation.json').read_text());old=json.loads((OUT/'reference/manifest.json').read_text())
labels={'approved-design-direction':'承認済み（絵柄方向）','design-direction-accepted':'方向性承認済み','design-draft-needs-review':'未完成・候補','redesign-required':'再制作必要','rejected-color':'却下','experimental-not-approved':'未完成・試作'}
lines=['# Visual Cue 素材棚卸しと制作対応表','',f'基準main: `{m["baseCommit"]}`。ZIP SHA256: `{m["handoffSHA256"]}`。',m['approval'],'','## 既存19点','', '| 素材 | 分類 | 備考 |','| --- | --- | --- |']
for a in old['assets']:lines.append(f'| {a["path"]} | {labels[a["status"]]} | {a["note"]} |')
lines+=['','## 31コンセプト（14イラスト / 10動作 / 7 Emma状態）','','| Primitive | 状態 | 制作物・残課題 |','| --- | --- | --- |']
for c in m['concepts']:lines.append(f'| {c["primitive"]} | {c["readiness"]} | {", ".join(c["assetIds"])} {c["reason"]} |')
lines+=['','## 58 Cue の対応','','| Cue | Primitive | 状態 | 素材 / 理由 |','| --- | --- | --- | --- |']
for c in m['cueCoverage']:lines.append(f'| {c["cueId"]} | {", ".join(c["primitives"])} | {c["readiness"]} | {", ".join(c["assetIds"])} {c["reason"]} |')
lines+=['','## 実測（バイトは10進KB）','','| 素材 | 状態 | KB | フレーム | 秒 | 220px差分画素 | ループ継ぎ目/最大隣接差分 | 技術検査 |','| --- | --- | --- | --- | --- | --- | --- | --- |']
for a,r in zip(m['assets'],q['results']):lines.append(f'| {a["id"]} | {a["readiness"]} | {r["bytes"]/1000:.1f} | {r["frames"]} | {r.get("durationMs",0)/1000:.3f} | {r.get("changedPixelsAt220","—")} | {r.get("seamToMaxAdjacentRatio","—")} | {"PASS" if r["technicalPass"] else ", ".join(r["errors"])} |')
(OUT/'COVERAGE.md').write_text('\n'.join(lines)+'\n')
with (OUT/'inventory.csv').open('w') as f:
 w=csv.writer(f,lineterminator="\n");w.writerow(['path','classification','original_status','note']);w.writerows([a['path'],labels[a['status']],a['status'],a['note']] for a in old['assets'])
summary=dict(stills=sum(a['kind']=='illustration' for a in m['assets']),loops=sum(a['kind']=='animation' for a in m['assets']),readiness=dict(collections.Counter(a['readiness'] for a in m['assets'])),coveredIllustrationConcepts=sum(c['kind']=='illustration' and bool(c['assetIds']) for c in m['concepts']),animationConceptsWithArtifacts=sum(c['kind']=='animation' and bool(c['assetIds']) for c in m['concepts']),cueReadiness=dict(collections.Counter(c['readiness'] for c in m['cueCoverage'])),animationConceptsWithCandidates=sum(c['kind']=='animation' and c['readiness'] in ['candidate','accepted'] for c in m['concepts']),newAccepted=sum(a['status']=='accepted' for a in m['assets']),technicalPass=q['technicalPassCount'],technicalTotal=q['assetCount'],sizeExceptions=[r['id'] for r in q['results'] if r['bytes']>r['sizeTargetBytes']])
(OUT/'qa/summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False,indent=2))

for pass_id,filename in [(2,'additional-keyframes.jpg'),(3,'final-keyframes.jpg'),(4,'revision-keyframes-20261018.jpg'),(5,'review-r2-keyframes.jpg'),(6,'review-r3-keyframes.jpg'),(7,'cup-liquid-keyframes.jpg')]:
 if m.get('productionPass',0)>=5 and pass_id<m['productionPass']:continue # Keep prior review evidence historical.
 added=[a for a in m['assets'] if a.get('productionPass')==pass_id and a['animation']]
 if added:
  sheet=Image.new('RGB',(1100,len(added)*250),'#f6f3eb');draw=ImageDraw.Draw(sheet)
  for row,a in enumerate(added):
   for col,k in enumerate([0,5,13,18,27]):
    frame=Image.open(OUT/'qa/keyframes'/f'{a["id"]}-{k:02d}.png');frame.thumbnail((220,220))
    sheet.paste(frame,(col*220,row*250),frame);draw.text((col*220+3,row*250+222),f'{a["id"]} {k}',fill='black')
  sheet.save(OUT/'qa'/filename,quality=90)
  if pass_id>=5:
   allout=OUT/('qa/cup-liquid-allframes' if pass_id==7 else 'qa/r3-allframes' if pass_id==6 else 'qa/r2-allframes');allout.mkdir(exist_ok=True)
   for a in added:
    movie=Image.open(OUT/a['animation']);contact=Image.new('RGB',(1320,240*math.ceil(movie.n_frames/6)),'#f6f1e7');labels=ImageDraw.Draw(contact)
    for i in range(movie.n_frames):
     movie.seek(i);frame=movie.convert('RGBA');frame.thumbnail((220,220));x=i%6*220;y=i//6*240;contact.paste(frame,(x,y),frame);labels.text((x+5,y+220),f'{a["id"]} frame {i}',fill='black')
    contact.save(allout/f'{a["id"]}.jpg',quality=90)


lines=['# 2026-10-18 指摘された旧版と修正候補','', '旧版は不採用として保存し、現行候補には含めません。修正版も目視採用審査前です。','', '| 対象 | 旧版の問題 | 修正候補 |','| --- | --- | --- |']
for a in m['archivedAssets']:
 if a.get('reviewBatch')=='2026-10-18':lines.append(f'| {a["originalId"]} | {a["rejectionReason"]} | 同IDのproductionPass=4を審査。 |')
lines += ['', 'げっぷの構図は[NHSの背中へのケアと頭・首の支え](https://www.nhs.uk/best-start-in-life/baby/feeding-your-baby/bottle-feeding/bottle-feeding-your-baby/how-to-burp-your-baby/)を参照。腹部をさする旧版を撤回しました。図の自然さ・安全性・意味の採用を自動検査で承認するものではありません。', '', '[汎用性の再点検](USAGE_REVIEW_20261018.md) / [修正候補の5フェーズ](qa/revision-keyframes-20261018.jpg)']
(OUT/'REVISION_20261018.md').write_text('\n'.join(lines)+'\n')
