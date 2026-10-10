# みつことば Lite Visual Cue 拡張設計

作成日: 2026-10-10

## 目的

Lite の英文を画像・簡単なアニメーション・Emma の表情で補助する。ただし、現在進行中の英文・話題拡張によって画像一覧を作り直す設計にはしない。

この設計では「話題 = 1画像」「英文 = 1画像」を避け、英文と描画の間に **Visual Cue** という意味層を置く。

## なぜ固定 visualKey を使わないか

現在の Lite だけを見ると bath / milk / book などから 40 前後の表現を作れるが、今後は次のような文が追加される予定である。

- 泣いているね
- 笑ったね
- うれしいね
- できたね
- すごいね
- がんばったね
- 上手だね

これらは従来の scene/topic だけでは表しにくい。また、褒め言葉や感情は milk / bath / book のような育児場面と同時に成立する。

例:

- 「ミルク飲めたね、すごいね」 = subject.milk + action.sip + social.praise + social.success
- 「泣いてるね、大丈夫だよ」 = emotion.crying + social.comfort
- 「笑ったね、うれしいね」 = emotion.happy + social.praise
- 「できたね！」 = social.success + emotion.happy

そのため Visual Cue は 1 本の固定 enum ではなく、複数の意味軸を組み合わせる。

## 意味軸

Cue ID は namespace 付き文字列とする。namespace 自体も将来追加可能とする。

### subject.*

物・場面。

例:

- subject.milk
- subject.bath
- subject.diaper
- subject.clothes
- subject.hands
- subject.feet
- subject.tummy
- subject.book
- subject.food
- subject.rain
- subject.sun

### action.*

動作。

例:

- action.sip
- action.splash
- action.wash
- action.sleep
- action.wake
- action.wipe
- action.dress
- action.hug
- action.squeeze
- action.open-close
- action.clap
- action.wave
- action.kick
- action.tap
- action.burp
- action.peekaboo
- action.eat
- action.chew
- action.read
- action.open-book
- action.turn-page
- action.sing

### emotion.*

赤ちゃんや場面の感情・状態。

初期想定:

- emotion.happy
- emotion.smile
- emotion.crying
- emotion.sad
- emotion.excited
- emotion.sleepy
- emotion.calm
- emotion.proud

これは閉じた一覧ではない。英文拡張後に必要なものを追加する。

### social.*

親・AIから赤ちゃんへの社会的な働きかけ。

初期想定:

- social.greeting
- social.praise
- social.success
- social.encouragement
- social.comfort
- social.affection

「できたね」「すごいね」「がんばったね」を object/topic に押し込まないことが重要。

### attention.*

注意・共同注意・テンポ。

例:

- attention.look
- attention.listen
- attention.wonder
- attention.slow

## 1文に複数 Cue を持てる

1 文につき次を持てる。

- primaryCue: 画面で最優先する意味
- secondaryCues: 補助的な意味
- renderPreference: auto / illustration / motion / emma / composite

例:

```json
{
  "phraseId": "praise-success-001",
  "primaryCue": "social.success",
  "secondaryCues": ["emotion.happy", "social.praise"],
  "renderPreference": "emma"
}
```

```json
{
  "phraseId": "milk-success-001",
  "primaryCue": "action.sip",
  "secondaryCues": ["subject.milk", "social.success", "social.praise"],
  "renderPreference": "composite"
}
```

## 描画側は Cue の組み合わせを解釈する

英文を実行時に再分類しない。

Lite は固定文なので、Visual Cue はビルド前に付与する。

描画側の優先順位:

1. primaryCue に専用表現があれば使う
2. secondaryCues と組み合わせ可能なら composite
3. primaryCue の namespace fallback
4. topic/scene の default cue
5. Emma neutral

例:

- social.success + emotion.happy -> Emma の大きな笑顔 + 小さなキラキラ
- emotion.crying + social.comfort -> Emma の穏やかな表情 + ゆっくり寄り添う演出
- subject.book + action.turn-page -> 本素材 + ページめくり
- subject.milk + action.sip -> 哺乳瓶 + 飲む動き

## 既存 Emma を優先利用する

Android にはすでにまばたき、上下動、口パク、LISTENING、THINKING、UNDERSTOOD の笑顔・うなずきがある。Web にも Emma face のフレームがある。

emotion / social / attention 系は、新規イラストを大量に増やすより Emma の表情・動きへ寄せる。

特に以下は Emma 表現を第一候補とする。

- social.greeting
- social.praise
- social.success
- social.encouragement
- social.comfort
- social.affection
- emotion.happy
- emotion.smile
- emotion.crying
- emotion.proud
- attention.look
- attention.listen
- attention.wonder
- attention.slow

## phraseId

配列 index を Visual Cue のキーにしてはいけない。英文追加でずれるため。

最終的には各固定文に stable phraseId を持たせるのが望ましい。

英文拡張中は無理に既存構造を変更しない。拡張完了後に次のどちらかへ移行する。

優先:

1. authoring source で stable phraseId を持つ
2. 移行期間だけ normalized text fingerprint を使う

fingerprint は移行用であり、英文変更時には CI で未割当として検出する。

## Fallback

新しい英文に Cue が未付与でもアプリを壊さない。

推奨 fallback:

1. phrase assignment
2. topic/scene default cue
3. generic Emma neutral

ただし CI では「fallback で動くから未割当のままでよい」としない。新規固定文は原則としてレビュー済み Cue を持つ。

## CI / 検証

英文拡張完了後に Visual Cue を実装するときは、次を自動検証する。

- 固定英文の総数
- stable phraseId の重複
- Cue 未割当数
- 未登録 Cue ID
- 削除された英文への orphan assignment
- Android / Web の assignment parity
- subject/action/emotion/social/attention の利用数
- topic だけに過度依存していないか

目標は Cue 未割当 0。

## 現在の 41 分類について

既存 203 文から作った 41 概念は、完成版の固定一覧として扱わない。

あれは「現行英文をどの程度圧縮できるか」の検証結果であり、今後はこの multi-axis Cue へ分解する。

例:

- bath_splash -> subject.bath + action.splash
- milk_sip -> subject.milk + action.sip
- hands_clap_wave -> subject.hands + action.clap + action.wave
- music_sing -> action.sing
- comfort_presence -> social.comfort
- generic_wonder -> attention.wonder

この変換により、感情・褒め言葉が増えても既存体系を捨てる必要がない。

## 英文拡張が終わるまでやらないこと

現在は別作業で英文・話題・感情表現を増やしているため、まだ次は行わない。

- 現行全英文への Cue 割当
- 画像素材の最終枚数確定
- 画像生成
- runtime renderer 実装
- current phrase bank の型変更
- current shared topic contract の破壊的変更

今行うのは意味契約と schema の準備のみ。

## 再開手順

英文拡張が main に入ったら:

1. 最新 Lite 全固定文を Android / Web から抽出
2. 重複除去
3. 各文に primaryCue / secondaryCues を一括付与
4. emotion / social の追加 Cue を抽出
5. 既存 cue と統合し taxonomy を確定
6. 画像・motion・Emma の 3 系統へ render plan を割当
7. 必要な基本素材数を再計算
8. Android / Web 共通 assignment contract を生成
9. CI で未割当 0 を確認
10. その後に素材制作と UI 実装へ進む

## 最重要原則

**英文数や話題数を Visual Cue の数と一致させない。**

Visual Cue は「何について話しているか」だけでなく、「何をしているか」「どう感じているか」「どのような社会的働きかけか」を分離して表す。

これにより、今後 Lite の英文が数百文からさらに増えても、画像・アニメーション体系は部品追加で拡張できる。
