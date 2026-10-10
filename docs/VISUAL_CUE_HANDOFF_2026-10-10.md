# みつことば Lite Visual Cue / 画像表現機能 引継ぎ資料

作成日: 2026-10-10  
対象: Lite版（Web / Android 共通方針）  
状態: **設計・事前準備まで。英文拡張が完了するまで本実装・画像制作は開始しない。**

関連:
- [Visual Cue 拡張設計](./visual-cue-architecture.md)
- [Visual Cue contract schema](../shared/visual-cue-contract.schema.json)
- PR #66 `Prepare extensible visual cue architecture`

---

## 1. この資料の目的

みつことば Lite で、AI が赤ちゃんへ話す英語に合わせて、画像・簡単なアニメーション・Emma の表情を表示する機能を将来実装する。

例:

- `Milk time! Sip, sip!` → ミルクを飲む視覚表現
- `Turn the page.` → 絵本のページをめくる視覚表現
- `Clap, clap!` → 拍手の視覚表現
- `You did it!` → 成功・褒める表現
- `You're crying. I'm right here.` → 泣く＋寄り添う表現

目的は、英文を「飾る」ことではない。

**赤ちゃんが英語の音声と、目の前の物・動き・感情・社会的な働きかけを結び付けやすくするための視覚的な手掛かりを追加すること**が目的である。

一方で、Lite の英文は今後さらに増える予定であり、特に次が追加・強化される見込み。

- 泣く
- 笑う
- うれしい
- 悲しい
- できた
- すごい
- 上手
- がんばった
- かわいい
- 安心
- その他、赤ちゃんの日常的な状態・感情・親からの褒め言葉

そのため、**現在の英文だけを前提に画像一覧を固定してはいけない。**

この資料は、英文拡張後に別の担当者・別スレッド・Codex が読んでも、そのまま再開して実装できるよう、これまでの検討・分析・判断理由・実装手順を残す。

---

## 2. 現在の結論

最重要結論は次の3点。

### 2.1 「1話題 = 1画像」にはしない

当初は `milk`、`sleep`、`book` などの scene/topic ごとに1枚の画像を割り当てる案を検討した。

しかし、これは粗すぎる。

例:

`hands` には以下が存在する。

- Tiny hands
- Squeeze, squeeze
- Open, close
- Clap, clap
- Wave, wave

これらを全部「手」の1枚にすると、英語の意味を視覚化しているのではなく、単に「handsという話題」のラベルを表示しているだけになる。

同様に `book` でも、

- 本を見る・読む
- 本を開く
- ページをめくる

は視覚的に区別すべき。

したがって topic は Visual Cue の入力情報の1つではあるが、Visual Cue そのものではない。

### 2.2 「1英文 = 1画像」にもしない

逆に、英文ごとに個別画像を作ると数百枚になり、英文追加のたびに制作コストが増える。

同じ意味を持つ文は視覚表現を共有できる。

例:

- `Milk time! Sip, sip!`
- `Little sips. Milk time!`
- `Time for milk! Sip, sip!`

は同じ `subject.milk + action.sip` で表現できる。

### 2.3 「意味の部品」を組み合わせる

最終方針は、

**英文 → Visual Cue（意味の部品） → 描画**

とする。

Visual Cue は固定の1本の enum ではなく、複数軸を組み合わせる。

主な意味軸:

- `subject.*` : 物・場面
- `action.*` : 動作
- `emotion.*` : 感情・状態
- `social.*` : 褒める・励ます・寄り添うなど
- `attention.*` : 見る・聞く・ゆっくりなど

これにより、今後英文が増えても画像体系全体を作り直さず、必要な Cue だけ追加できる。

---

## 3. 現行 Lite で行った予備分析

### 3.1 分析対象

英文拡張前の基準として、以下を分析した。

Android:
- `app/src/main/java/com/eltnegcellist/emma/ai/LiteResponseEngine.kt`
  - blob SHA: `cae955f608bb6a91bc530c71c8b58a495b4a7fdb`
- `app/src/main/assets/play-topics.json`
  - blob SHA: `06630654bf851f7ea983ed0a8223279598a565f2`

Android main はこの資料作成時点で:
- `390b2db45ada7a0de631249f928ae605e8bcc0f2`

Web main はこの設計ブランチ作成時点で:
- `b57db1169a94f0dd44f6a90e9d8f447e9cbfd533`

注意:
**この数値は英文拡張前のスナップショットであり、最終実装時には必ず最新 main から取り直す。**

### 3.2 当時の文数

予備分析時点:

- 会話 scene: 20話題 × 5文 = 100文
- neutral drink: 5文
- generic: 56文
- 会話側合計: 161文
- 「押して聞く」: 22話題 × 5文 = 110文
- 会話側と「押して聞く」の完全一致重複: 68文
- 両者を合わせた重複除去後: **203英文**

重要:

203英文があるからといって、203画像が必要なわけではない。

---

## 4. 21画像案を却下した理由

一度、21の主要育児 scene に1つずつ画像を付ければ簡単ではないかという案を検討した。

例:

- milk → 哺乳瓶
- sleep → 月
- book → 本
- hands → 手
- feet → 足

実装は非常に簡単。

しかし目的とのズレが大きい。

### 4.1 hands の問題

以下がすべて同じ「手」の絵になる。

- Squeeze, squeeze!
- Open and close.
- Clap, clap!
- Wave, wave!

赤ちゃんに提示する視覚情報としては意味の差が消える。

### 4.2 book の問題

以下がすべて同じ「本」の絵になる。

- Book, book!
- Open the book.
- Turn the page.

特に `open` や `turn` は動作として視覚化する価値が高い。

### 4.3 music の問題

- sing
- clap
- tap
- listen

をすべて音符の画像にすると、音声と動作の対応を失う。

### 4.4 結論

**topic image は fallback としては使えるが、主設計にしてはいけない。**

---

## 5. 203英文を41概念へ圧縮した予備結果

次に、現行203英文を「その英文を赤ちゃんへ1つの視覚表現で見せるなら何を見せるか」という観点で分類した。

結果、未分類0で **41 visual concept** へ圧縮できた。

ただし重要:

**この41個は最終仕様ではない。**

これは「203英文すべてを個別画像にしなくても、40前後の意味単位まで圧縮できる」という feasibility study である。

英文拡張後はこの41一覧をそのまま使わず、multi-axis Cue へ分解して再分析する。

### 5.1 当時の41分類

| concept | 当時の意図 |
| --- | --- |
| bath_splash | お風呂・水しぶき |
| bath_wash | 体を洗う |
| milk_sip | ミルクを飲む |
| sleep_rest | 寝る・休む |
| sleepy_eyes | 眠そうな目 |
| wake_morning | 朝・起きる |
| wake_eyes_open | 目を開く |
| diaper_change | おむつ交換 |
| diaper_wipe | 拭く |
| get_dressed | 着替える |
| dress_arm_leg | 腕・脚を服へ通す |
| hug_cuddle | 抱っこ・ハグ |
| hands_squeeze_wiggle | 握る・指を動かす |
| hands_open_close | グー・パー |
| hands_clap_wave | 拍手・手を振る |
| feet_kick_wiggle | 足を蹴る・バタバタ |
| feet_tap_kick | 足でトントン・キック |
| smile | 笑顔 |
| comfort_presence | そばにいる・安心させる |
| generic_listen | 聞く |
| voice_babble | あー・うー・喃語 |
| tummy | おなか |
| burp | げっぷ |
| play | 遊ぶ |
| peekaboo | いないいないばあ |
| outside | 外・散歩 |
| rain | 雨 |
| sunshine | 太陽・晴れ |
| eat_food | 食べる |
| chew | もぐもぐ・噛む |
| book_read | 本を見る・読む |
| open_book | 本を開く |
| turn_page | ページをめくる |
| music_sing | 歌う |
| music_clap_tap | リズム・拍手 |
| drink_sip | 飲む |
| hello | あいさつ |
| hello_wave | 手を振ってあいさつ |
| generic_look | 見る |
| generic_wonder | 不思議・考える |
| generic_slow | ゆっくり |

### 5.2 41分類から得た教訓

良かった点:

- 203文 → 41表現まで減らせる
- topicより細かく、文単位より粗い粒度が実用的
- 手・本・足などの素材を再利用できる
- generic は物体画像より Emma 表現が向く

問題点:

- `bath_splash` のように「場面」と「動作」が1つの ID に混ざる
- `comfort_presence` のような社会的意味を topic と同じ平面に置いている
- 感情・褒め言葉が増えると新しい複合 ID が爆発する

例:

`milk_success_happy_praise`

のような ID を作り始めると、組み合わせ数が急増する。

そこで41個を固定 taxonomy にする案は採用しない。

---

## 6. 最終採用方針: multi-axis Visual Cue

### 6.1 subject.*

「何について」の軸。

例:

- `subject.milk`
- `subject.bath`
- `subject.diaper`
- `subject.clothes`
- `subject.hands`
- `subject.feet`
- `subject.tummy`
- `subject.book`
- `subject.food`
- `subject.rain`
- `subject.sun`

将来、必要に応じて以下も追加可能。

- `subject.toy`
- `subject.blanket`
- `subject.stroller`
- `subject.bottle`

閉じた enum と考えない。

### 6.2 action.*

「何をしている」の軸。

例:

- `action.sip`
- `action.splash`
- `action.wash`
- `action.sleep`
- `action.wake`
- `action.wipe`
- `action.dress`
- `action.hug`
- `action.squeeze`
- `action.open-close`
- `action.clap`
- `action.wave`
- `action.kick`
- `action.tap`
- `action.burp`
- `action.peekaboo`
- `action.eat`
- `action.chew`
- `action.read`
- `action.open-book`
- `action.turn-page`
- `action.sing`

将来、英文追加で必要なら追加する。

### 6.3 emotion.*

赤ちゃんの感情・状態。

英文拡張を見越した重要軸。

初期候補:

- `emotion.happy`
- `emotion.smile`
- `emotion.crying`
- `emotion.sad`
- `emotion.excited`
- `emotion.sleepy`
- `emotion.calm`
- `emotion.proud`

ここは今後増える可能性が高い。

### 6.4 social.*

親 / AI が赤ちゃんへ行う社会的な働きかけ。

褒め言葉追加で特に重要。

初期候補:

- `social.greeting`
- `social.praise`
- `social.success`
- `social.encouragement`
- `social.comfort`
- `social.affection`

例:

`You did it!`
→ primary: `social.success`
→ secondary: `emotion.happy`, `social.praise`

`Great job!`
→ `social.praise`

`You can do it!`
→ `social.encouragement`

`I'm right here.`
→ `social.comfort`

### 6.5 attention.*

共同注意やテンポ。

- `attention.look`
- `attention.listen`
- `attention.wonder`
- `attention.slow`

generic 系で重要。

---

## 7. 感情・褒め言葉追加後も成立する例

### 7.1 泣いている

想定英文:

`You're crying. I'm right here.`

Cue:

- primary: `emotion.crying`
- secondary:
  - `social.comfort`

描画候補:

- Emma を不安そうな顔にはしすぎない
- 穏やかな Emma
- 小さな涙モチーフ
- ゆっくり寄り添う動き

注意:
泣いている赤ちゃんへ「悲しい顔のキャラクター」を大きく出す必要はない。comfort を優先する可能性がある。

### 7.2 笑った

`What a smile!`

- primary: `emotion.smile`
- secondary:
  - `emotion.happy`
  - `social.praise`

Emma の既存の笑顔表現を再利用できる。

### 7.3 できたね

`You did it!`

- primary: `social.success`
- secondary:
  - `emotion.happy`
  - `social.praise`

特定の物体を描かなくても、Emma の大きな笑顔＋小さなキラキラで成立する。

### 7.4 ミルクを飲めたね

`You drank your milk! Great job!`

- primary: `action.sip`
- secondary:
  - `subject.milk`
  - `social.success`
  - `social.praise`
  - `emotion.happy`

描画:

- 主表示: ミルクを飲む
- 補助: 小さな成功キラキラ

### 7.5 がんばって

`You can do it!`

- primary: `social.encouragement`

必要なら:

- `emotion.calm`

Emma 表現だけで十分な可能性が高い。

---

## 8. primaryCue / secondaryCues

1英文に Cue は1つだけではない。

推奨データ構造:

```json
{
  "phraseId": "success-001",
  "text": "You did it! Great job!",
  "primaryCue": "social.success",
  "secondaryCues": [
    "emotion.happy",
    "social.praise"
  ],
  "renderPreference": "emma",
  "reviewStatus": "reviewed"
}
```

別例:

```json
{
  "phraseId": "milk-success-001",
  "text": "You drank your milk! Great job!",
  "topic": "milk",
  "primaryCue": "action.sip",
  "secondaryCues": [
    "subject.milk",
    "social.success",
    "social.praise"
  ],
  "renderPreference": "composite",
  "reviewStatus": "reviewed"
}
```

### 8.1 primaryCue の意味

画面で一番強く伝える意味。

### 8.2 secondaryCues の意味

次のために使う。

- 補助アニメーション
- Emma の表情
- 小さな効果
- composite の組み合わせ

secondary を全部同じ強さで画面に出してはいけない。

赤ちゃん向けUIなので**主役は常に1つ**。

---

## 9. 描画方式は4系統

`renderPreference` では以下を想定。

### 9.1 illustration

大きな静止イラスト。

向いている例:

- sleep
- morning
- diaper
- clothes
- hug
- tummy
- play/toy
- outside
- sun
- food
- book

### 9.2 motion

単純な動きが意味理解に効くもの。

向いている例:

- splash
- wash
- sip
- eyes open
- wipe
- arm/leg dressing
- open-close
- clap
- wave
- kick
- tap
- burp
- peekaboo
- rain
- chew
- open book
- turn page

重要:
動画/GIFを大量に作らなくてよい。

Compose/CSS で、

- translate
- rotate
- scale
- alpha
- 2〜3フレーム切替

を使えばよい。

### 9.3 emma

Emma 自身の表情・動き。

向いているもの:

- greeting
- praise
- success
- encouragement
- comfort
- affection
- happy
- smile
- crying に対する寄り添い
- look
- listen
- wonder
- slow
- vocal/babble

### 9.4 composite

基本素材＋Emma表現＋小さな効果。

例:

`subject.milk + action.sip + social.success`

→ 哺乳瓶を飲む絵  
＋ Emma の笑顔  
＋ 小さなキラキラ

画面に3つの独立画像を並べるのではない。

**1つの主表現に補助効果を足す**。

---

## 10. 既存 Emma 実装で再利用できるもの

Android の既存実装を確認済み。

対象:

- `app/src/main/java/com/eltnegcellist/emma/ui/EmmaAvatar.kt`
  - blob SHA: `96136f285b67c580465dc1dd65353c4a737f15d6`
- `CompactEmmaAvatar.kt`
  - blob SHA: `cd621cddd791f86d2139ec8f334554b9409734d9`

既に存在する主な機能:

- まばたき
- half blink
- closed eye
- 上下のゆらぎ
- pulse
- 発話時の口パク
- 音量に応じた口の大きさ
- LISTENING 表情
- THINKING 表情
- UNDERSTOOD の笑顔
- UNDERSTOOD 時のうなずき
- pupil shift
- 頬の表現
- listening の波紋

CompactEmmaAvatar には事前描画された:

- idle open / half / closed
- talk small / medium / large
- 各 talk サイズの half / closed

がある。

Web 側にも:

`assets/emma-face/`

として同系統の face SVG がある。

### 10.1 将来の拡張案

新しく必要になりそうなもの:

- success: 笑顔を少し強く＋小さな sparkle
- praise: gentle nod
- encouragement: 小さく前向きな bounce
- comfort: bobを遅く、穏やかな顔
- look: pupil shift 左右
- wonder: THINKING + `?`
- slow: bob 周期を遅くする

**emotion/social 系のために大量の画像を作らず、Emma を活用する。**

---

## 11. 基本素材の考え方

最終的な画像枚数は英文拡張後に再計算する。

現時点では、41表現が必要でも41枚の完成イラストは不要と考えている。

例:

### 手

1つの基本スタイルを使い、

- squeeze
- open
- close
- clap
- wave

へ展開。

### 本

同じ本素材を使い、

- read
- open
- turn page

へ展開。

### 足

同じ足素材を使い、

- wiggle
- kick
- tap

へ展開。

### Emma

既存描画を利用し、

- greeting
- praise
- success
- comfort
- listen
- wonder
- happy

へ展開。

したがって、

**Visual Cue 数 ≠ 画像ファイル数**

である。

---

## 12. 素材調達方針

当初の検討では、全画像を生成AIで作る案は却下方向。

理由:

- 枚数が増える
- スタイル統一が難しい
- 将来の再生成コスト
- 微修正しにくい
- 動作差分に弱い

推奨優先順位:

1. Compose / CSS の単純描画で表現できるもの
2. 再利用可能なベクター基本素材
3. ライセンス確認済みのオープン素材
4. それでも不足するものだけ専用イラストを制作
5. 生成AIは限定的な素材制作補助として検討

既存オープン素材の候補としては Noto Emoji / Material Symbols / Twemoji 等を検討したが、**採用前にその時点のライセンス・帰属表示・再配布条件を再確認すること。**

特に「抱っこ」「おむつ」「授乳」「赤ちゃんのおなか」などは一般アイコンだと意味が弱い可能性があるため、専用イラスト候補。

---

## 13. 乳児向け視覚表現としての設計原則

### 13.1 一画面一主役

複数の意味があっても、一番重要なものを大きく出す。

### 13.2 細かい背景を作らない

意味に関係しない物を増やさない。

### 13.3 高い視認性

- 大きな形
- 輪郭を明確に
- 背景とのコントラスト
- 小さな文字を画像へ含めない

### 13.4 動きは短く単純

長いアニメーションにしない。

例:

- clap: 2〜3回
- page turn: 1回
- wave: 2〜3往復
- sip: 1〜2回
- sparkle: 短く

### 13.5 音声を邪魔しない

Visual Cue は TTS より主張しすぎない。

### 13.6 画面全体を頻繁に切り替えない

毎文で派手に遷移すると、会話より視覚刺激が主役になる。

---

## 14. phraseId が必要な理由

Visual Cue assignment を配列 index に結び付けてはいけない。

悪い例:

`replies[3] -> bath_splash`

英文追加・並べ替えで壊れる。

### 14.1 推奨

将来的に固定英文へ stable `phraseId` を持たせる。

例:

- `bath-splash-001`
- `milk-sip-003`
- `success-praise-002`

### 14.2 移行時

現在のデータ形式を英文拡張中に変更すると競合しやすい。

そのため今は導入しない。

英文拡張完了後に、

1. stable phraseId を authoring source へ付与
2. それまでの移行用に normalized text fingerprint を生成

を検討する。

fingerprint は恒久IDにしない。

英文修正で変わったときは、CIで未割当として検出する方が安全。

---

## 15. Web / Android の正本関係

現在、共通の Lite topic contract は Web 側が編集元で、Android は同期コピーを持つ。

Android の `shared/README.md` にこの方針が明記されている。

したがって Visual Cue も将来的には、

**Web 側 shared を正本 → Androidへ固定コミットを同期**

の方式に寄せるのが自然。

ただし実装時に既存 topic contract と無理に1ファイルへ統合する必要はない。

推奨:

- topic detection contract
- play topics
- visual cue assignments

を責務ごとに分ける。

---

## 16. 現在追加済みの schema

PR #66 で、

`shared/visual-cue-contract.schema.json`

を追加済み。

これは**将来用の非runtime draft**。

主な項目:

- `phraseId`
- `text`
- `topic`
- `primaryCue`
- `secondaryCues`
- `renderPreference`
- `reviewStatus`

Cue ID は:

`namespace.name`

形式。

例:

- `subject.milk`
- `action.sip`
- `emotion.happy`
- `emotion.crying`
- `social.praise`
- `social.success`
- `attention.listen`

schema は Cue 一覧を固定していない。

これは意図的。

英文拡張に伴い Cue を追加できるようにするため。

---

## 17. renderer の fallback

Visual Cue が欠落してもアプリ自体は壊さない。

推奨順:

1. phrase-specific assignment
2. primaryCue renderer
3. secondary を含む composite renderer
4. primary namespace fallback
5. topic/scene default
6. Emma neutral

例:

新しい `emotion.surprised` が assignment に来たが専用 renderer がまだない場合:

- emotion namespace fallback
- Emma neutral / generic emotional response

へ落とす。

ただし、本番品質として未割当を放置してよいという意味ではない。

CIで検出する。

---

## 18. CI で必ず確認するもの

英文拡張後の本実装では最低限以下を追加。

### assignment integrity

- 全 phraseId が unique
- 固定英文数と assignment 数
- Cue 未割当
- 存在しない phraseId
- 削除済み英文を指す orphan assignment
- primaryCue 欠落
- primary と secondary の重複

### Cue registry / renderer

- 使用されている Cue の一覧
- renderer 未対応 Cue
- namespace 別数
- fallback に落ちる文数

### parity

- Web / Android の phraseId
- Web / Android の Cue assignment
- Web / Android の renderer 対応表

### review

- `reviewStatus=generated` のまま残っている文数
- release 時は原則 reviewed のみ

目標:

**未割当 0  
unknown cue 0  
orphan 0**

---

## 19. 英文追加時の運用

最終的には、英文を1つ追加したら Visual Cue も同時に追加するのが理想。

例:

```text
新しい英文
↓
phraseId
↓
primaryCue
↓
secondaryCues
↓
renderPreference
↓
CI
```

LLMで Cue 候補を自動生成することは可能だが、自動確定にはしない。

理由:

- どの意味を主役にするかはUI判断が必要
- 1つの文に複数の意味がある
- 赤ちゃん向けでは細かい意味より視認性を優先する場合がある

推奨:

**自動提案 → human review → reviewed**

---

## 20. runtime でAI分類しない理由

Lite は固定英文。

したがって再生のたびに、

`英文 → embedding/LLM → visual cue`

を行う必要はない。

欠点:

- 遅い
- バッテリー
- 実装複雑化
- 同じ文なのに結果が変わる可能性
- オフライン性を損なう

Cue は開発時に確定してアプリへ同梱する。

これは Ruri などの親発話 topic 判定とは別問題。

---

## 21. 最終実装時のデータフロー案

### 会話モード

```text
親の日本語
  ↓
ASR
  ↓
Lite topic / semantic
  ↓
LiteResponseEngine
  ↓
phraseId + English + scene
  ↓
VisualCueResolver
  ↓
VisualCuePlan
  ↓
Renderer
  ├─ Emma
  ├─ Illustration
  ├─ Motion
  └─ Composite
```

### 押して聞く

```text
play topic
  ↓
phraseId
  ↓
English
  ↓
VisualCueResolver
  ↓
Renderer
```

重要:

**返答生成処理に画像判定ロジックを埋め込まない。**

Visual Cue は独立レイヤーにする。

---

## 22. VisualCuePlan の実装イメージ

将来の内部型例。

### Android

```kotlin
data class VisualCuePlan(
    val primary: String,
    val secondary: List<String>,
    val renderer: VisualRendererType,
)

enum class VisualRendererType {
    ILLUSTRATION,
    MOTION,
    EMMA,
    COMPOSITE,
}
```

### Web

```js
{
  primary: 'action.turn-page',
  secondary: ['subject.book'],
  renderer: 'motion'
}
```

Cue ID 自体を Kotlin enum に完全固定しない方が拡張しやすい。

registry + validated string を検討。

---

## 23. renderer registry の例

概念例:

```text
action.turn-page
  -> BookTurnPageRenderer

action.clap
  -> HandClapRenderer

social.success
  -> EmmaSuccessRenderer

social.comfort
  -> EmmaComfortRenderer

emotion.smile
  -> EmmaSmileRenderer
```

subject は単独 renderer だけでなく、action renderer の asset parameter にできる。

例:

`action.sip + subject.milk`

→ SipRenderer(asset = milk bottle)

---

## 24. animation の方針

GIF / MP4を大量作成しない。

Android:
- Compose animation
- Canvas
- transform

Web:
- CSS transform
- SVG
- requestAnimationFrame は必要な場合のみ

### 24.1 例

clap:
- 左右の手を中央へ
- 少し戻す
- 2回

wave:
- wrist相当を中心に rotation

kick:
- 足の角度を少し変える

turn page:
- 右ページを scaleX / rotateY 的に見せる

rain:
- 数本の線 / drop を下へ

sparkle:
- opacity + scale

---

## 25. 画像表示タイミング

本実装時に要実機検証。

基本案:

- TTS開始直前〜開始と同時に Cue を出す
- TTS中は表示
- TTS終了後に短時間保持
- 次の listening 状態へ戻るとフェードアウト

長く残しすぎると次の会話と意味が混ざる。

短すぎると乳児が見られない。

固定時間を理屈だけで決めず、実機で調整する。

---

## 26. UI配置についての考え方

現在の会話画面には Emma と英文表示がある。

Visual Cue は Emma を押しのけて別画面へ遷移するより、

- Emma周辺
- Emmaの下
- 英文カード付近

など、会話の流れを維持できる位置が望ましい。

ただし最終配置は実機サイズで確認。

特に小さいAndroid端末で:

- Emma
- 英文
- 日本語認識結果
- Visual Cue

が詰まりすぎないようにする。

---

## 27. これから追加される感情表現で注意すること

### 27.1 crying と sad を同一視しない

泣いている = 悲しい、とは限らない。

赤ちゃんは眠い・空腹・不快でも泣く。

したがって:

- `emotion.crying`
- `emotion.sad`

を分ける。

### 27.2 smile と happy を同一視しない

笑顔という観察と、嬉しいという感情評価は別。

- `emotion.smile`
- `emotion.happy`

### 27.3 success と praise を分ける

`できたね` は出来事。

`すごいね` は親からの評価。

- `social.success`
- `social.praise`

両方出る文もある。

### 27.4 encouragement と praise を分ける

`がんばって` は未来へ向けた励まし。

`がんばったね` は過去の行動への評価。

同じ Cue にしない可能性が高い。

英文拡張後に最終 taxonomy をレビューする。

---

## 28. 今は絶対にやらないこと

英文拡張と並行して次を始めない。

- 現在203文への最終 Cue assignment
- 41個を正式 enum 化
- 画像41枚の制作
- 既存 reply list の型変更
- phraseId の強制導入
- runtime renderer の本実装
- Android/Webへの大量asset追加

理由:

英文拡張が完了すると分類一覧が変わるため。

今やるべきだったのは、**変化しても壊れない設計の準備**。

それは PR #66 で実施済み。

---

## 29. 英文拡張完了後の再開手順

この順序を守る。

### Phase 1: corpus snapshot

最新 main から全固定英文を抽出。

対象:

- Lite scene replies
- drink
- generic
- play-topics
- 新しい emotion / praise / state responses
- その他固定TTS対象

出力:

- 総文数
- 重複除去文数
- topic別文数
- source別文数

### Phase 2: stable phraseId

各文へ stable ID。

既存文にも付与。

### Phase 3: automatic Cue proposal

LLM / script で全英文へ:

- primaryCue
- secondaryCues
- renderPreference

を一括提案。

### Phase 4: taxonomy extraction

候補Cueを集計。

特に:

- emotion.*
- social.*
- action.*

の新規概念を確認。

似すぎたCueを統合。

### Phase 5: human review

203文時のように、全文を漏れなく確認。

確認点:

- 一番伝えたい意味が primary か
- topicだけに引っ張られていないか
- 感情を勝手に推測していないか
- 褒め言葉と成功を分けたか
- 画像化不能な抽象概念を無理に絵にしていないか

### Phase 6: rendering plan

Cue ごとに:

- illustration
- motion
- Emma
- composite

へ分類。

### Phase 7: asset inventory

必要な基本素材を抽出。

この時点で初めて「何枚必要か」を決める。

### Phase 8: prototype

最初から全種類を作らない。

代表10〜15 Cue程度で試作。

推奨:

- milk sip
- clap
- wave
- turn page
- rain
- sleep
- smile
- crying/comfort
- success/praise
- listen
- wonder

### Phase 9: real-device test

確認:

- 赤ちゃん向けとして見やすい
- TTSと同期している
- 画面が忙しすぎない
- Emmaとの競合がない
- 低スペック端末で重くない

### Phase 10: full implementation

prototype 合格後に全 Cue へ展開。

---

## 30. acceptance criteria

実装完了と判断する最低条件。

### データ

- Lite 固定英文の Cue 未割当 0
- phraseId 重複 0
- orphan assignment 0
- Web / Android parity OK

### UI

- 具体的意味を持つ主要文で適切な Cue が出る
- generic/抽象文で不自然な物体画像を出さない
- 褒め・成功・感情で Emma 表現を利用できる
- 表示が英文/TTSと同期

### 性能

- Visual Cue追加でASR/TTSをブロックしない
- ネット接続不要
- 実行時画像生成不要
- 実行時LLM分類不要

### 保守性

- 新しい英文追加時に1つの assignment 追加で対応可能
- 新しい Cue 追加で既存 schema 全体を書き換えない
- 未対応 Cue があってもクラッシュしない

---

## 31. この機能で避けたい失敗

### 31.1 topic icon 化

milkなら常に哺乳瓶、bookなら常に本、で終わること。

### 31.2 画像辞書の巨大化

1英文1画像。

### 31.3 Cue の複合ID爆発

`milk-happy-success-praise` のようなIDを増やすこと。

### 31.4 感情の決めつけ

泣いている = sad  
笑っている = happy

と必ず決めること。

### 31.5 Visual Cue のために英文を変える

英文が主、Visual Cue が従。

画像に合わせて英語を変更しない。

### 31.6 派手な演出

乳児向けだからと画面全体を常に動かさない。

### 31.7 runtime AI依存

固定英文なのに毎回意味判定を行わない。

---

## 32. 実装担当者への最初の指示

英文拡張が完了した後、この作業を再開するときは最初に次を行う。

> 最新 main の Lite 固定英文を Web / Android からすべて抽出し、重複を除いた corpus を作る。現在の41分類を正解として使わず、各文へ subject/action/emotion/social/attention の multi-axis Visual Cue を自動提案する。primaryCue と secondaryCues を分け、全件を一覧化する。まだ画像生成・UI実装は行わない。新規 Cue の一覧、各 Cue の利用文数、未分類文、曖昧文をレポートする。

そのレビュー後:

> reviewed Cue assignment を stable phraseId へ紐付け、rendererを illustration / motion / emma / composite に分類する。既存 EmmaAvatar / CompactEmmaAvatar のアニメーションを最大限再利用し、必要な基本素材数を再計算する。代表10〜15 Cueのprototypeを作って実機確認してから全展開する。

---

## 33. 現在の作業状態

完了:

- 現行英文数の調査
- 203英文の重複除去
- 21画像案の評価・却下
- 203英文 → 41概念の予備分類
- 41概念を固定仕様にしない判断
- multi-axis Visual Cue設計
- subject/action/emotion/social/attention の軸定義
- primary/secondary Cue 方針
- renderPreference 方針
- fallback 方針
- phraseId 方針
- CI方針
- Android既存Emma表現の確認
- Web既存Emma face asset確認
- draft JSON Schema追加
- 設計資料追加

未実施・意図的保留:

- 英文拡張後の全件再分析
- stable phraseId 実装
- Cue assignment 本体
- renderer registry
- Android renderer
- Web renderer
- 画像素材制作
- motion prototype
- UI配置確定
- 実機テスト
- CI実装

保留理由:

**別作業で Lite 英文・話題・感情・褒め表現を拡張中だから。**

---

## 34. 最終原則

この機能の本質は「英文に画像を付ける」ことではない。

**英語音声と、赤ちゃんの日常の物・動き・感情・人とのやり取りを、シンプルな視覚表現で結び付けること。**

そのため、

- topicだけに縛らない
- 英文数だけ画像を増やさない
- 画像一覧を先に固定しない
- 感情と社会的意味を別軸で持つ
- Emma自身を表現資産として活用する
- 固定英文なので実行時AIは使わない
- 新しい英文が増えても部品追加で拡張する

という設計を維持する。

**英文拡張が完了するまでは実装を急がず、完了後に最新コーパスから再分析すること。**
