# Topic × Interaction — 追加72セット（全405セットへの増補）

2026-10-13。Web・Androidの同一固定英文バンクに、自然な24組×3セット＝72セットを追加。既存の111組・333セットと合わせて**135組・405セット（1,215文）**。

- 独立したRuri Topic / Interactionヘッド、採用閾値（Topic 0.50＋差0.05、Interaction 0.50）、ASR、Kikiの速度、既定ON設定は変更しません。
- すべての英文は短い独立した3文。英単語6～12語、1文4語以内のテスト対象です。
- 分類の正しさは英語バンクの存在だけでは保証されません。組み合わせがない場合は既存通りTopicを優先します。
- Web：直近20ターン分の判定（Topic/Interaction生ラベル・確率・採用結果・欠落理由）を**ページのメモリ上のみ**に保持。診断TXTに出力し、日本語本文・赤ちゃんの名前・英文本文は含みません。
- Android：既存診断TXTの`phase=ruri_route`に同様の判定・経路を残します。発話本文は記録しません。
- Ruriヘッドの再学習や、日本語のキーワード判定による補正は今回行いません。

## 追加した24組

### ミルク × 愛情表現 (`milk|affection`)

1. Milk time, sweetheart! You're so lovely. I love you.
2. Milk time with you. My sweet little one. I love you.
3. Your milk is here. You're so precious. I'm right beside you.

### ミルク × 開始 (`milk|start`)

1. Here comes your milk. Let's get comfy. Ready for a sip?
2. Milk time starts now. You're all cozy. Here we go!
3. Time for your milk! Let's sit together. Here it comes.

### ミルク × 問いかけ (`milk|inquiry`)

1. Want some more milk? Are you still hungry? Let's check together.
2. How is your milk? Is it yummy? I'm listening, sweetheart.
3. Need another little sip? Shall we try? Take your time.

### ミルク × 繰り返し (`milk|repeat`)

1. Want another sip? We can try. No need to hurry.
2. More milk, little one? Only if you like. I'm right here.
3. Another little sip? Let's see together. You can decide.

### 飲み物 × 愛情表現 (`drink|affection`)

1. A drink with you. My sweet little one. I love you.
2. Here is your drink. You're so precious. I love you.
3. A little drink together. You're my sweetheart. I'm right here.

### 飲み物 × 問いかけ (`drink|inquiry`)

1. Would you like water? Are you thirsty? Let's find out.
2. Another sip for you? Do you want more? It's up to you.
3. How is your drink? Is that enough? I'm here with you.

### おむつ × 愛情表現 (`diaper|affection`)

1. Fresh and cozy now. My sweet little one. I love you.
2. A gentle diaper change. You're so precious. I'm right here.
3. Your little diaper, sweetheart. I'm here with you. I love you.

### おむつ × 褒める (`diaper|praise`)

1. Diaper change, all done! We did it! Well done, sweetheart.
2. Look at you! All clean now. You did great!
3. A fresh diaper now. We did that. Good job, little one!

### おむつ × 開始 (`diaper|start`)

1. Let's change your diaper. We'll be gentle. Here we go!
2. Time for a change. I'll be gentle. Ready, little one?
3. A fresh diaper now. Let's get ready. I'm right here.

### 睡眠 × 愛情表現 (`sleep|affection`)

1. Sleepy little sweetheart. I love you. I'm right here.
2. Time for cozy rest. You're so precious. I love you.
3. Sweet dreams, little one. You're so loved. I'm beside you.

### 睡眠 × いたわり (`sleep|care`)

1. You look sleepy. Let's rest now. I'll stay close.
2. Rest your little eyes. We have time. I'm right here.
3. Time for a break. Let's get cozy. I'll stay nearby.

### 起床 × 褒める (`wake|praise`)

1. You're awake now! Look at you! What a lovely day.
2. You opened your eyes! Hello, little one. What a lovely sight.
3. Here you are! You're awake now. So good to see!

### 起床 × 安心させる (`wake|reassurance`)

1. You're awake now. I'm right here. You're safe with me.
2. Hello, little one. I'll stay close. We're together now.
3. You woke up. Take your time. I'm beside you.

### お風呂 × 愛情表現 (`bath|affection`)

1. Warm water together. My sweet little one. I love you.
2. Bath time, sweetheart! You're so lovely. I'm right here.
3. Little splashes together. You're so precious. I love you.

### お風呂 × 褒める (`bath|praise`)

1. You're splashing water! That's so lovely. Well done, sweetheart.
2. Look at you! What lovely splashes! You're doing great.
3. You're enjoying bath time! That's so lovely. Well done, sweetheart.

### 食事 × 愛情表現 (`food|affection`)

1. Snack time with you. My sweet little one. I love you.
2. Little bites together. You're so precious. I'm right here.
3. A meal together. My darling little one. I love you.

### 食事 × 終了 (`food|finish`)

1. Mealtime is all done. Let's wipe up. Time to rest.
2. You've finished your food. Well done, sweetheart. Let's rest now.
3. Those bites are finished. We are done. Let's clean up.

### 絵本 × 愛情表現 (`book|affection`)

1. Story time with you. My sweet little one. I love you.
2. A book together. You're so precious. Let's turn pages.
3. This story is ours. I love you. Stay close, sweetheart.

### 絵本 × 完了確認 (`book|finish_check`)

1. Is our story done? One more page? Let's check together.
2. Last page already? Are we finished? Let's look together.
3. Is that the end? Shall we check? One last look.

### 音楽 × 愛情表現 (`music|affection`)

1. A song for you. My sweet little one. I love you.
2. Music time together. You're so precious. I'm right here.
3. This song is yours. I love you. Let's listen together.

### 音楽 × 完了確認 (`music|finish_check`)

1. Is our song done? Shall we listen? One more note?
2. Song finished already? Let's check together. Is that all?
3. Is that the end? One more sound? Let's listen together.

### 遊び × 愛情表現 (`play|affection`)

1. Playtime with you. You're so precious. I love you.
2. My little playmate. This is lovely. I'm right here.
3. We play together. You're my sweetheart. What lovely fun!

### 遊び × 完了確認 (`play|finish_check`)

1. Are we done playing? One more game? Let's decide together.
2. Is playtime over? Shall we stop? We can choose.
3. All finished playing? One last turn? What do you think?

### 服 × 愛情表現 (`clothes|affection`)

1. Your cozy little clothes. You're so precious. I love you.
2. All snug and warm. My sweet little one. I'm right here.
3. A little outfit today. You're so lovely. I love you.

## 検証・運用

Web：`node test-interaction.mjs`、`node scripts/check-kitten-phonemes.mjs`（CMUdict用辞書指定）、`python3 scripts/audit-phonemes.py`。

Android：`:app:testDebugUnitTest`、`:app:assembleDebug`。

初回ログが`semantic.ready=false`ならその時点で準備していないことを示すだけで、過去の会話の判定失敗を証明しません。診断には会話後・同一ページ内の`routing.turns`が必要です。
