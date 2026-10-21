#!/usr/bin/env python3
"""Compile a traceable exact-text conversion ledger; no playback-time guessing."""
from pathlib import Path
import json,re,collections
R=Path(__file__).resolve().parents[2]
base=json.loads((R/'shared/visual-cue-animation-baseline-20261020.json').read_text())
def match(pattern,text):return bool(re.search(pattern,text,re.I))
def decide(row):
 t=row['text'].lower();old=row['assetId']
 if match(r"\b(pause|can wait|take a break|stop|don't|do not|no more)\b",t):return old,'中断・待機・否定。動作中の動画を流さない。'
 if match(r'\b(finished|all done|all finished|is over|is done|changed|done changing|put things away|shirt is on|clothes are on|is on now)\b',t):return old,'完了した場面。交換・入浴・着衣等をループで再開しない。'
 if old=='rain':return 'water-rain','雨の場面を、雲から雨粒が落ちる既存動画で示す。会話の疑問符で観察中の雨を止めない。'
 if old=='sun':return 'sun-rays','太陽の中心を保ち、光の筋だけが明るくなる動作候補。'
 if old=='outdoor':return 'outdoor-leaves','木・幹・地面を保ち、葉が風で舞う場面候補。歩行を実行済みとは表さない。'
 if old=='sleep':return 'sleep-stars','寝床を動かさず、外側の星だけがまたたく休息の場面候補。'
 if old=='cup':return old,'コップ動画の液面はユーザー再確認待ち。保留を自動解除しない。'
 if old=='toy':
  if match(r'peek|where (did i go|am i)',t):return 'peekaboo','いないいないばあへの誘い・質問と、隠して見せる動作を対応。'
  if match(r'\b(roll|ball|round)\b',t):return 'toy-roll','転がす・ボールの明示。ボールが床を移動し、回転も追従する候補。'
  return 'toy-rattle','おもちゃの場面。既存ガラガラの輪と柄を固定し、中の鈴を動かす候補。'
 if old=='diaper-v2':
  if match(r'\b(change|changing|off comes)\b',t):return 'change-diaper-exchange','交換する・外す・交換への誘いを、外す→新しいおむつ→留める既存動画へ。'
  return 'change-diaper-v2','新しいおむつ・おむつの準備を、留め具の開閉で示す。交換全体の指定文とは分ける。'
 if old=='clothes':
  if match(r'change (your |these |the )?clothes',t):return 'change-clothes','別の服へ着替える明示。上半身を保った服交換の既存動画へ。'
  if match(r'\b(arm|shirt|dress|dressed)\b',t):return 'dress-sleeves','袖へ腕を入れる・服を着る場面を、袖から腕が出る既存動画へ。'
  if match(r'\b(clothes time|here come your clothes|outfit)\b',t):return 'change-zipper','一般的な服の準備を前開き服の留め具の動きで示す。腕の挿入や服の交換の明示文とは分ける。'
  return old,'暖かさ・柔らかさの話で、着替える動作の指定がない。'
 if old=='bath':
  if match(r'splash|splish',t):return 'water-splash','水しぶきを明示しており、浴槽の水しぶき動画へ。'
  return 'water-shower','入浴・温かい水の場面を、水が浴槽へ流れる既存動画で示す。'
 if old=='milk':return 'sip','ミルクの場面を、哺乳瓶内の液体と傾きが連動する既存動画で示す。哺乳の実行認定ではない。'
 if old=='book':return 'page','絵本・読み聞かせの場面をページがめくれる既存動画へ。質問文を含んでもページへの誘いを妨げない。'
 if old=='music':return 'notes','歌・音楽の場面を音符が動く既存動画へ。'
 if old=='meal':return 'spoon','食事・ひとくちの場面を、おかゆをすくうスプーンの既存動画へ。'
 if old=='hands-open-v2':
  if match(r'\b(wash|clean)\b',t):return 'hand-wash','洗う手を明示。完全な手は変形せず、水滴と泡だけを動かす候補。'
  if match(r'clap',t):return 'hand-clap','拍手への誘いを明示。疑問文でも既存の両手の接触・離れる動作へ。'
  if match(r'open|close|wiggle|squeeze|finger|reach|found|high five',t):return old,'指の開閉・握る・指を持つ・指の細かな動作は既存動画と異なる。撤回した手を復活させない。'
  return 'hand-wave','手の一般的な呼びかけ・手が動く場面。採用済みの手首を支点に振る動画へ。'
 if old=='feet':
  if match(r'\b(toe|toes|stretch|one|two|three)\b',t):return old,'足の指・伸ばす・数える表現はキックと異なる。'
  return 'kick','足の一般的な呼びかけ・キックへの誘いを、採用済みの交互キックで示す。'
 if old in ['tummy','family-care']:
  if match(r'pat your back',t):return 'care-burp','背中への手の動きを明示。腹部をさする旧案ではなく、縦抱きと背中の既存動画へ。'
  if match(r'\b(cuddle|hug|hold you close|arms open)\b',t):return 'hug-arms','抱っこへの誘い・抱く表現を、つながった人物の腕を寄せる既存動画へ。'
  return old,'腹部への質問・慰めを、根拠なく背中のケアや手拭きの動作へ変えない。'
 return old,'対応する動画の動作と本文が一致しない。'
rows=[]
for r in base['staticRows']:
 target,reason=decide(r)
 rows.append(dict(**r,afterAssetId=target,changed=target!=r['assetId'],reason=reason,reviewStatus='implementation-reviewed; user-semantic-review-pending'))
output=dict(schemaVersion=1,baselineCommit=base['sourceCommit'],scope='Only the 520 previously static exact-text bindings. Existing animation/Emma assignments remain unchanged.',rows=rows)
(R/'shared/visual-cue-static-animation-overrides.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print('changed',sum(r['changed'] for r in rows),'remaining',sum(not r['changed'] for r in rows))
print(collections.Counter(r['afterAssetId'] for r in rows))
