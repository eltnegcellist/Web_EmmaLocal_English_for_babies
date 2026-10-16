#!/usr/bin/env python3
from pathlib import Path
import json,collections,csv
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/visual-cue/artwork'
m=json.loads((OUT/'manifest.json').read_text());q=json.loads((OUT/'qa/validation.json').read_text());old=json.loads((OUT/'reference/manifest.json').read_text())
labels={'approved-design-direction':'承認済み（絵柄方向）','design-direction-accepted':'方向性承認済み','design-draft-needs-review':'未完成・候補','redesign-required':'再制作必要','rejected-color':'却下','experimental-not-approved':'未完成・試作'}
lines=['# Visual Cue 素材棚卸しと制作対応表','',f'基準main: `{m["baseCommit"]}`。ZIP SHA256: `{m["handoffSHA256"]}`。','新規採用承認は0件。候補と未完成を区別し、914英文の意味品質・割当を保証しない。','','## 既存19点','', '| 素材 | 分類 | 備考 |','| --- | --- | --- |']
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
summary=dict(stills=sum(a['kind']=='illustration' for a in m['assets']),loops=sum(a['kind']=='animation' for a in m['assets']),readiness=dict(collections.Counter(a['readiness'] for a in m['assets'])),coveredIllustrationConcepts=sum(c['kind']=='illustration' and bool(c['assetIds']) for c in m['concepts']),animationConceptsWithArtifacts=sum(c['kind']=='animation' and bool(c['assetIds']) for c in m['concepts']),cueReadiness=dict(collections.Counter(c['readiness'] for c in m['cueCoverage'])),animationConceptsWithCandidates=sum(c['kind']=='animation' and c['readiness']=='candidate' for c in m['concepts']),newAccepted=0,technicalPass=q['technicalPassCount'],technicalTotal=q['assetCount'],sizeExceptions=[r['id'] for r in q['results'] if r['bytes']>r['sizeTargetBytes']])
(OUT/'qa/summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False,indent=2))
