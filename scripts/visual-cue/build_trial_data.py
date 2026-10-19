#!/usr/bin/env python3
"""Audit real exact-text assignments, including zero-use approved movies.

A unit is a unique recorded reply, not every sentence inside a three-sentence clip.
No new assignments or semantic approvals are made by this report.
"""
from pathlib import Path
from collections import Counter
import csv, hashlib, io, json

ROOT = Path(__file__).resolve().parents[2]
read = lambda p: json.loads((ROOT / p).read_text())
norm = lambda s: ' '.join(s.replace('’', "'").lower().split())
review = read('shared/visual-cue-runtime-review.json')
phrases = read('shared/visual-cue-phrases.json')['rows']
art = read('assets/visual-cue/artwork/manifest.json')['assets']
motions = read('assets/visual-cue/motion-variants/manifest.json')['assets']
hug = read('assets/visual-cue/prototypes/hug-face/manifest.json')
art=art+[dict(id=hug['id'],topic='抱っこ：顔が見える採用済み静止原画',kind='illustration',status='accepted')]
motions=motions+[hug['motion']]
face_by_text={norm(r['text']):r for r in read('shared/visual-cue-hug-face-overrides.json')['rows']}
conversions = read('shared/visual-cue-static-animation-overrides.json')['rows']
conversion_by_text = {norm(r['text']):r for r in conversions}
catalog = json.loads((ROOT / 'src/visual-cue-catalog.js').read_text().split('export const VISUAL_CUE_CATALOG=', 1)[1].rstrip(';\n'))
voice = {norm(e['text']): e for e in read('assets/voice-1202/manifest.json')['entries']}
art_by_id = {a['id']: a for a in art}
art_by_id.update({a['id']:a for a in motions})
source_by_id = {p['phraseId']: p for p in phrases}
backgrounds = {'calm': '安心：ハート（確認候補）', 'celebrate': 'ほめる：星（確認候補）'}
rows = {}
for r in review['rows'] + review['singleSentences']:
    key = norm(r['text'])
    binding = catalog['bindings'].get(key)
    assert binding == r['binding'], r['text']
    v = voice[key]
    if binding['type'] == 'asset':
        a = art_by_id[binding['assetId']]
        assert a['status'] in ['accepted','motion-candidate'] and a['id'] != 'wake-daylight'
        category = 'motionCandidate' if a['status']=='motion-candidate' else 'animation' if a['kind'] == 'animation' else 'still'
        target, label = a['id'], a['topic']
    elif binding['state'] in backgrounds:
        category, target, label = 'background', binding['state'], backgrounds[binding['state']]
    else:
        category, target, label = 'baseline', binding['state'], '通常のEmma（追加アニメーションなし）'
    if key not in rows:
        rows[key] = dict(id=v['id'], text=r['text'], category=category, target=target,
                         label=label, audio='assets/voice-1202/' + v['file'],
                         audioSHA256=v['sha256'], sources=[], approval='英文と素材の意味対応は確認候補')
        if key in conversion_by_text:
            c=conversion_by_text[key]
            rows[key].update(previousTarget=c['assetId'],staticConverted=c['changed'],changeReason=c['reason'])
        if key in face_by_text:
            f=face_by_text[key]
            rows[key].update(faceReplaced=True,facePreviousTarget=f['before']['assetId'],changeReason=rows[key].get('changeReason','')+' '+f['reason'])
    p = source_by_id.get(r.get('phraseId'))
    rows[key]['sources'].append(dict(kind=p['sourceKind'] if p else 'single',
                                    key=p['sourceKey'] if p else 'press-single',
                                    phraseId=r.get('phraseId')))
assert set(rows) == set(catalog['bindings'])
items = list(rows.values())
n = len(items)
counts = Counter(r['category'] for r in items)
percent = lambda count: round(count / n * 100, 2)
metrics = {k: dict(count=counts[k], percent=percent(counts[k]))
           for k in ['animation', 'motionCandidate', 'background', 'still', 'baseline']}
movies = []
for a in art + motions:
    if a['kind'] != 'animation':
        continue
    count = sum(r['category'] in ['animation','motionCandidate'] and r['target'] == a['id'] for r in items)
    movies.append(dict(id=a['id'], label=a['topic'], count=count, percent=percent(count),
                       status=a['status'], runtimeEligible=a['id'] in catalog['assets'],
                       image=a['animation'] if a['status']=='motion-candidate' else 'assets/visual-cue/artwork/' + a['animation'],
                       poster=a['poster'] if a['status']=='motion-candidate' else 'assets/visual-cue/artwork/' + a['poster'],
                       baseAssetId=a.get('baseAssetId'),baseImage=a.get('baseImage','assets/visual-cue/artwork/stills/'+str(a.get('baseAssetId'))+'.webp'),runtimeExclusionReason='replaced-by-hug-face' if a['id']=='hug-arms' else None))
movies.sort(key=lambda a: (-a['count'], a['id']))
report = dict(schemaVersion=1, unit='重複を除いた録音原文。3文応答も再生1回＝1件。文中の個別文への割当ではない。',
              total=n, replySets=len(review['rows']), uniqueReplySets=len({norm(r['text']) for r in review['rows']}),
              singleSentences=len(review['singleSentences']), duplicateReplySets=len(review['rows'])-len({norm(r['text']) for r in review['rows']}),
              metrics=metrics,
              noObjectAnimation=dict(count=n-counts['animation'], percent=percent(n-counts['animation'])),
              noAddedAnimation=dict(count=counts['still']+counts['baseline'], percent=percent(counts['still']+counts['baseline'])),
              withCandidateBackground=dict(count=counts['animation']+counts['motionCandidate']+counts['background'], percent=percent(counts['animation']+counts['motionCandidate']+counts['background'])),
              missingBinding=sum(norm(r['text']) not in catalog['bindings'] for r in items),
              approvedMovies=sum(a['status']=='accepted' for a in movies),
              usedApprovedMovies=sum(a['status']=='accepted' and a['count']>0 for a in movies),
              motionCandidateCount=len(motions),
              staticConversion=dict(before=len(conversions),converted=sum(r['changed'] for r in conversions),remaining=sum(not r['changed'] for r in conversions),baselineAnimationCount=174,baselineNoAddedAnimation=794),
              backgrounds=[dict(id=k, label=v, count=sum(r['category']=='background' and r['target']==k for r in items), status='candidate') for k,v in backgrounds.items()],
              animations=movies,
              faceReplacement=dict(animation=sum(r.get('faceReplaced',False) and r['category']=='motionCandidate' for r in items),still=sum(r.get('faceReplaced',False) and r['category']=='still' for r in items)),
              sourceSHA256={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['shared/visual-cue-phrases.json','shared/visual-cue-runtime-review.json','src/visual-cue-catalog.js','assets/visual-cue/motion-variants/manifest.json','shared/visual-cue-static-animation-overrides.json','assets/visual-cue/prototypes/hug-face/manifest.json','shared/visual-cue-hug-face-overrides.json']},
              voiceBankReference=dict(total=len(voice),outsideResponseCorpus=[dict(text=e['text'],sources=e['sources']) for key,e in voice.items() if key not in rows],
                                      noAddedAnimation=len(voice)-counts['animation']-counts['motionCandidate']-counts['background'],
                                      noAddedAnimationPercent=round((len(voice)-counts['animation']-counts['motionCandidate']-counts['background'])/len(voice)*100,2)),
              limitations=['割当件数であり、意味の適合率・利用頻度ではない。',
                           '意味確認済みは元の21セット。新規割当や背景2案を承認済みと扱わない。',
                           '通常Emmaのまばたき・口パクは追加アニメーションの網羅数に含めない。',
                           '候補背景を含める場合と、採用済み物体動画だけの場合を別集計。',
                           '承認済み静止原画から作ったSVG動作6種と顔あり抱っこ動画1種は新規候補であり、採用済み動画20点に加算しない。顔あり静止原画を加え、採用済み素材は43点。',
                           'コップ動画は再確認待ち、起床動画は意味対応未完成のため実行時対象外。'])
assert sum(x['count'] for x in metrics.values()) == n
assert sum(a['count'] for a in movies) == counts['animation']+counts['motionCandidate']
(ROOT/'shared/visual-cue-coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(ROOT/'shared/visual-cue-trial-data.json').write_text(json.dumps(dict(schemaVersion=1,report=report,rows=items),ensure_ascii=False,indent=2)+'\n')
csv_out = io.StringIO(newline='')
writer = csv.writer(csv_out, lineterminator='\n')
writer.writerow(['id','英文（録音単位）','表示区分','割当先','採用済み物体動画なし','追加アニメーションなし','意味対応','変更前の静止素材','変更理由'])
for r in items:
    writer.writerow([r['id'],r['text'],r['category'],r['target'],r['category']!='animation',r['category'] in ['still','baseline'],r['approval'],r.get('previousTarget',''),r.get('changeReason','')])
(ROOT/'shared/visual-cue-coverage.csv').write_text('\ufeff'+csv_out.getvalue())
lines=['# Visual Cueの英文割当数（テスト版）','',report['unit'],'',
       f'対象は **{n}件＝3文応答{report["uniqueReplySets"]}種類＋単文{report["singleSentences"]}種類**。元の914セットには同一原文1件の重複があります。','',
       '| 表示 | 原文数 | 全体比 |','| --- | ---: | ---: |']
for key,label in [('animation','採用済み物体動画'),('motionCandidate','新しい動作7候補（顔あり抱っこを含む）'),('background','背景2候補'),('still','静止画'),('baseline','通常Emma')]:
    m=metrics[key];lines.append(f'| {label} | {m["count"]} | {m["percent"]:.2f}% |')
lines += ['',f'以前の静止520件のうち**{report["staticConversion"]["converted"]}件を動作へ切替**。{report["staticConversion"]["remaining"]}件は終了・中断・保留・動作不一致等の理由付きで静止表示を維持。',
          '',f'採用済み物体動画が未割当：**{report["noObjectAnimation"]["count"]}件（{report["noObjectAnimation"]["percent"]:.2f}%）**。',
          f'背景候補も含めて追加アニメーションが未割当：**{report["noAddedAnimation"]["count"]}件（{report["noAddedAnimation"]["percent"]:.2f}%）**。','',
          f'採用済み動画{report["approvedMovies"]}種類中、英文割当あり{report["usedApprovedMovies"]}種類。','',
          '| アニメーション | 原文数 | 全体比 | 状態 |','| --- | ---: | ---: | --- |']
for a in movies:
    status='顔ありへ差替済み・比較用' if a.get('runtimeExclusionReason') else '新規動作・確認候補' if a['status']=='motion-candidate' else '保留' if a['status']!='accepted' else '意味対応未完成・実行時対象外' if not a['runtimeEligible'] else '割当あり' if a['count'] else '採用済み・英文割当なし'
    lines.append(f'| {a["label"]} | {a["count"]} | {a["percent"]:.2f}% | {status} |')
lines += ['','## 集計上の注意','']+['- '+s for s in report['limitations']]
lines += ['',f'参考：音声バンク全体は{len(voice)}件。上の応答コーパス外にAndroid用・自己紹介・旧原文等14件があり、追加動画割当はありません。これらも含めると追加アニメーション未割当は{report["voiceBankReference"]["noAddedAnimation"]}件（{report["voiceBankReference"]["noAddedAnimationPercent"]:.2f}%）です。']
lines += ['','対応先は1091件すべてにありますが、静止画や通常Emmaも含むため、アニメーション100%対応ではありません。',
          '終了・待機・否定に動作をループさせず、保留コップと撤回済みの指の動作を自動採用しません。','',
          '[CSV全件](../shared/visual-cue-coverage.csv) / [JSON集計](../shared/visual-cue-coverage.json)']
(ROOT/'docs/VISUAL_CUE_COVERAGE_2026-10-20.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({k:report[k] for k in ['total','metrics','noObjectAnimation','noAddedAnimation','approvedMovies','usedApprovedMovies']},ensure_ascii=False,indent=2))
