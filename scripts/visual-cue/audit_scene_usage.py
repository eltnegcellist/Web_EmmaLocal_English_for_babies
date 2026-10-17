#!/usr/bin/env python3
"""Describe real corpus usage without equating keywords/draft labels with semantic approval."""
from pathlib import Path
from collections import Counter
import json,re,hashlib
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/visual-cue/artwork'
source=ROOT/'shared/visual-cue-phrases.json';rows=json.loads(source.read_text())['rows']
counts=Counter(r['sourceKey'].split('|')[0] for r in rows)
names={'milk':'ミルク','diaper':'おむつ','play':'遊び','bath':'お風呂','book':'絵本','music':'音楽','sleep':'就寝','drink':'飲み物','food':'食事','wake':'起床','cry':'泣く・慰め','clothes':'衣服','generic':'一般会話','hug':'抱っこ','hands':'手','feet':'足','voice':'声','outside':'外','smile':'笑顔','rain':'雨','sun':'日差し','tummy':'おなか'}
asset_map={'milk':['milk','sip'],'diaper':['diaper-v2','change-diaper-exchange'],'play':['toy'],'bath':['bath','water-shower'],'book':['book','page'],'music':['music','notes'],'sleep':['sleep'],'drink':['cup'],'food':['meal','spoon'],'wake':['wake-bed','wake-quilt'],'clothes':['clothes','change-clothes','dress-sleeves'],'hug':['family-care','hug-arms'],'hands':['hands-open-v2','hand-wave','hold-hands'],'feet':['feet','kick'],'outside':['outdoor'],'rain':['rain','water-rain'],'sun':['sun'],'tummy':['tummy']}
patterns={'burp':r'\bburp\b','count':r'\b(count|counting)\b','squeeze':r'\bsqueeze\b','ball':r'\bball\b','rattle':r'\brattle\b','hold-hand':r'\b(hold my hand|give me your hand)\b','listen-hear-voice':r'\b(listen|hear|sound|voice)\b','cup':r'\bcup\b'}
mentions=[]
for key,pattern in patterns.items():
 found=[r for r in rows if re.search(pattern,r['text'],re.I)]
 mentions.append(dict(key=key,definition='本文への明示的言及。素材適合数ではない。',count=len(found),phrases=[dict(phraseId=r['phraseId'],sourceKey=r['sourceKey'],text=r['text']) for r in found]))
scenes=[]
for key,n in counts.most_common():
 if key not in names:continue
 rs=[r for r in rows if r['sourceKey'].split('|')[0]==key]
 scenes.append(dict(topic=key,label=names[key],setCount=n,assetIds=asset_map.get(key,[]),examples=[dict(phraseId=r['phraseId'],text=r['text']) for r in rs[:3]],scope='話題に含まれるセット数。全件に同じ画像を使える数ではない。'))
proposals=[
 dict(priority=1,scene='飲み物のコップ',action='new-artwork',assetIds=['cup'],reason='drinkは38セット。ミルクの哺乳瓶を飲み物全般へ流用しない。'),
 dict(priority=1,scene='自然な養育者と子の抱っこ',action='redraw',assetIds=['family-care','hug-arms'],reason='hug28セットと愛情・慰めの関連場面。毛布だけでは意味が伝わらず、人物のつながった場面へ。関連会話を一律に抱っこへ割り当てるものではない。'),
 dict(priority=1,scene='枕・ベッド・掛け物',action='redraw',assetIds=['sleep','wake-bed','wake-quilt'],reason='就寝38／起床33セット。整合する投影で共通部品を作り直す。'),
 dict(priority=1,scene='頭・肩・胴のある着替え',action='redraw',assetIds=['change-clothes','dress-sleeves'],reason='衣服31セット。腹部だけへの服の貼り付けを廃止。'),
 dict(priority=2,scene='手をつなぐ',action='new-artwork',assetIds=['hold-hands','hold-hands-squeeze'],reason='Hold my hand / Give me your handという明示文が2件。ボールより意味が合う。手の話題28セット全体への適合数とはしない。'),
 dict(priority=2,scene='遊びのおもちゃ',action='reuse-existing',assetIds=['toy'],reason='遊び51セットのため基本物体を優先。ballの明示は1件、rattleの明示も1件なので、球専用の握りを遊び全般に割り当てない。'),
 dict(priority=3,scene='会話・聞く・笑顔・安心',action='emma-review-separate',assetIds=[],reason='listen/hear/sound/voiceの明示言及は106件だが、対象は声・水・音楽など複数。1物体へ統合せず、場面の静止絵＋Emma表情を検討。専用Emma状態の制作とアプリ統合は別工程。')]
limits=[dict(assetId='hand-squeeze-v3',scope='ボールを握る限定variant。本文にボールを握る指示は見つからない。設計サンプルとして保持し、汎用・自動割当の適合数には含めない。'),dict(assetId='hand-count',scope='count言及2件のうち1件は足の指。手を数える絵への適合候補はgenericの1件のみ。'),dict(assetId='care-burp',scope='burpへの明示言及3件。基本場面より低優先。腹部ケアを撤回し、背中への手の動きに修正。')]
report=dict(date='2026-10-18',totalSets=len(rows),uniqueTexts=len({r['text'] for r in rows}),sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),method='sourceKeyの先頭話題を集計。生成済みprimaryCueによる頻度を採用数として扱わない。本文への明示言及は別集計し、候補例を提示。確率・利用ログ・意味適合の測定ではない。',scenes=scenes,mentions=mentions,priorities=proposals,limitedVariants=limits,runtimeChanged=False)
(OUT/'qa/usage-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
lines=['# 実際の英文から見直した汎用場面','',f'{len(rows)}セット／{report["uniqueTexts"]}種類の本文。入力SHA256 `{report["sourceSHA256"]}`。',report['method'],'','## 話題別の件数（素材適合数ではない）','','| 話題 | セット数 | 候補 | 本文例 |','| --- | --- | --- | --- |']
for s in scenes:lines.append(f'| {s["label"]} | {s["setCount"]} | {", ".join(s["assetIds"]) or "Emma等を別途審査"} | {s["examples"][0]["text"]} |')
lines+=['','## 制作優先順位','']
for p in proposals:lines.append(f'- 優先{p["priority"]} **{p["scene"]}**：{p["reason"]}')
lines+=['','## 明示的な語の出現','','| 対象 | 件数 | 判定上の限界 |','| --- | --- | --- |']
for m in mentions:lines.append(f'| {m["key"]} | {m["count"]} | {m["definition"]} |')
lines+=['','## 限定variant','']+[f'- `{x["assetId"]}`：{x["scope"]}' for x in limits]
lines+=['','## 結論','','細かな動作を増やす方針を改め、日常の物体と場面を先に揃える。コップと手をつなぐ場面を追加し、抱っこ・就寝／起床・衣服の基本場面を再制作する。質問、誘い、安心、応援の英文を無理に「実行済み動作」へ変換しない。914英文の最終割当やEmmaの本体実装は変更しない。']
(OUT/'USAGE_REVIEW_20261018.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'totalSets':len(rows),'priorities':[(p['priority'],p['scene']) for p in proposals]},ensure_ascii=False))
