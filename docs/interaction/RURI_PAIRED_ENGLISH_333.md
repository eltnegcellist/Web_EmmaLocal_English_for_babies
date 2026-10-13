# Topic × Interaction — 英文333セット（全件レビュー用）

> **更新案内（2026-10-13）**：このファイルは旧来の111組・333セットの記録です。現在のコードは追加24組・72セットを含む **135組・405セット** に拡張されています。追加英文と診断仕様は [RURI_PAIRED_ENGLISH_405_ADDENDUM.md](RURI_PAIRED_ENGLISH_405_ADDENDUM.md) を参照してください。以下の公開前メモは当時の履歴です。


2026-10-13更新（音素監査・26セット自然な文へ最小修正）。みつことばLiteの**Ruriのみ**による2軸分類に対応する固定英文候補です。

- Topic：21種類（22クラスのRuri Topic headのうち generic を除く）。
- Interaction：14種類（15クラスのRuri Interaction headのうち none を除く）。
- 意味が自然に成立する **111組**、各組 **3セット**、合計 **333セット＝999文**。
- CMUdictによる全英語音素・定型句反復の監査に基づき、自然さと意味を維持した26セットを修正（Web/Android完全同期）。音素は**均等頻度を目指さず**、自然な英語の多様性を優先します。
- すべて3文、英単語6〜12語、1文4語以内の機械チェック対象。Kikiで実際に聴いて審査済みという意味ではありません。
- 生成方式：ChatGPTによる文章草案・推敲。**Mac上のGemma生成ではありません。** 実行時に文を組み合わせて生成するのではなく、完成した固定英文から1セットを選びます。
- 21×14=294の全組を機械的に作ったわけではありません。不自然な183組には組み合わせ英文を用意せず、Ruri Topic単独の英文に戻します。
- どちらか片方しか信頼できない場合は、その片方の固定英文。どちらも採用できないときは汎用英文。
- 日本語のキーワード、正規表現、否定規則、音声認識の文字列補正による**Topic／Interaction選択は行いません**（開発用の旧方式診断は別）。
- 旧通常会話197セット、新Interaction単独112セット、「押して聞く」別ライブラリは維持。追加333セットは開発PRのみで公開Web版へ未統合。
- 動作確認：Web PR #73／Android PR #38。両版の英文内容を一致させたソースを保持します。新Interaction利用は開発者トグルを初期オフとしています。
- **未確認**：異なる話者の日本語ASR、乳児向け表現の第三者英語レビュー、Kikiの実音声・疑問文抑揚、Android実機での会話。これらの結果により文言変更の可能性あり。

---

## milk — ミルク（10組）

### ミルク × 提案 (`milk|invitation`)

1. Shall we have milk? Little sips are fine. I'm here with you.
2. Milk is ready now! Shall we try together? Take your time.
3. A little milk now. Would you like some? Take your time.

### ミルク × 褒める (`milk|praise`)

1. You drank some milk! Well done, little one. I'm proud of you.
2. Look at those sips! That was lovely! Well done, sweetheart.
3. You're drinking your milk! You're doing so well. I'm proud of you.

### ミルク × 達成 (`milk|achievement`)

1. You drank your milk! You did it! Well done, sweetheart.
2. You finished that milk! You did it! How wonderful is that!
3. You took your milk! That worked out! Hooray, little one!

### ミルク × 完了 (`milk|finish`)

1. Milk is all done! You're finished now. Let's rest together.
2. Milk time is over! All finished now! Let's get cozy.
3. We're all done drinking! That's all done. We can rest now.

### ミルク × 完了確認 (`milk|finish_check`)

1. Finished your milk? Shall we check? What do you think?
2. Is milk time over? Shall we check? All done now?
3. Finished your milk yet? Let's check together. Are we finished?

### ミルク × 励ます (`milk|encouragement`)

1. Try a little sip. There's no hurry. I'm right here.
2. Here's your milk. Give it a try! I'm right here.
3. Milk time together. Try when you're ready. We can take time.

### ミルク × 労い (`milk|care`)

1. That was milk time. You did a lot. Let's rest together.
2. Milk time was busy. That took some effort. Let's rest together.
3. Milk time is over. I'll stay with you. Let's rest together.

### ミルク × 安心させる (`milk|reassurance`)

1. Here comes your milk. I'll stay close. We can go slowly.
2. It's milk time, sweetheart. I'll stay close. You're not alone.
3. Here's a little milk. We have time. I'm here with you.

### ミルク × 一時停止 (`milk|pause`)

1. Let's pause feeding. We can wait now. I'll stay with you.
2. Milk time can wait. There's no hurry. I'm right here.
3. Another sip can wait. Let's take a break. I'll be close.

### ミルク × 頑張りを認める (`milk|effort`)

1. You're trying to drink. I see your effort. We'll go gently.
2. Little sips take practice. I see you trying. I'm right here.
3. You're practicing little sips. I see your effort. We'll go gently.

## diaper — おむつ（6組）

### おむつ × 提案 (`diaper|invitation`)

1. Shall we change diapers? I'll be gentle. Let's get comfy.
2. Fresh diaper coming up! Shall we get ready? I'll be gentle.
3. Let's change your diaper. I'll go very slowly. Are you ready?

### おむつ × 完了 (`diaper|finish`)

1. All done changing! Nice and fresh. Here we are.
2. That diaper is changed! All finished now! Let's get cozy.
3. Diaper change is finished! That's all done. We can rest now.

### おむつ × 完了確認 (`diaper|finish_check`)

1. Diaper all done? Let's have a look. All clean now?
2. Diaper change finished yet? Shall we check? All done now?
3. Finished changing your diaper? Let's check together. Are we finished?

### おむつ × 安心させる (`diaper|reassurance`)

1. It's diaper time. I'll be gentle. I'm here with you.
2. Here's your diaper. I'll stay close. You're not alone.
3. A little diaper change. We have time. I'm here with you.

### おむつ × 労い (`diaper|care`)

1. That change is over. Let's get cozy. I'm with you.
2. Diaper time is over. Let's get cozy. I'm here with you.
3. A fresh diaper now. We can get cozy. I'll stay with you.

### おむつ × 一時停止 (`diaper|pause`)

1. Let's pause changing. We have time. I'm right here.
2. Diaper time can wait. No need to rush. I'll stay beside you.
3. A moment during changing. We'll take it slowly. I'm here, sweetheart.

## bath — お風呂（7組）

### お風呂 × 提案 (`bath|invitation`)

1. Shall we bathe? Let's get ready. I'll be gentle.
2. Shall we bathe now? First, let's feel comfortable. I'm beside you.
3. Here comes warm water. Let's take it gently. Shall we start?

### お風呂 × 始める (`bath|start`)

1. Here comes bath time! Let's begin gently. I'm with you.
2. Bath time begins! Here we go! Let's begin gently.
3. Ready to start bathing? Let's get started. I'm right beside you.

### お風呂 × 完了 (`bath|finish`)

1. Bath time is finished! All done now. Let's get dry.
2. Bath time is over! All finished now! Let's get cozy.
3. All done with baths! That's all done. We can rest now.

### お風呂 × 完了確認 (`bath|finish_check`)

1. Bath time all done? Shall we get out? Let's check together.
2. Are we finished bathing? Shall we check? All done now?
3. Shall we finish bathing? Let's check together. Are we finished?

### お風呂 × 安心させる (`bath|reassurance`)

1. I'm right here, sweetheart. Let's bathe gently. I'll stay close.
2. Bath time with me. I'll stay close. You're not alone.
3. In the bath together. We have time. I'm here with you.

### お風呂 × 労い (`bath|care`)

1. That was a bath! Now we can rest. I'm right here.
2. All done with baths. That was a lot. Let's rest together.
3. Your bath is finished. Let's get cozy now. I'll stay with you.

### お風呂 × 一時停止 (`bath|pause`)

1. Let's pause bath time. No need to rush. I'll stay close.
2. Bath time can wait. We'll go gently. I'm here with you.
3. Let's slow down now. We have time. I'll stay with you.

## hug — 抱っこ（5組）

### 抱っこ × 提案 (`hug|invitation`)

1. Want a little cuddle? Come here, sweetheart. I'm right here.
2. Shall we have cuddles? Come into my arms. I'll hold you.
3. A gentle little hug. Would you like one? Come close, sweetheart.

### 抱っこ × 安心させる (`hug|reassurance`)

1. Come for a cuddle. I'm right here. I've got you.
2. Time for a cuddle. I'll stay close. You're not alone.
3. Here comes a hug. We have time. I'm here with you.

### 抱っこ × 愛情 (`hug|affection`)

1. I love this cuddle. You're my treasure. Stay close, little one.
2. A cuddle for you! I love being together. You're so precious.
3. Hugs together, sweetheart! I love you, sweetheart. I'm right here.

### 抱っこ × 労い (`hug|care`)

1. You've done a lot. Come for a cuddle. I'll hold you close.
2. Come for a cuddle. That took some effort. Let's rest together.
3. A gentle little cuddle. You did a lot. I'll stay with you.

### 抱っこ × 褒める (`hug|praise`)

1. You reached for hugs! How lovely, little one. Well done.
2. What a sweet cuddle! That was lovely! Well done, sweetheart.
3. Look at your cuddle! You're doing so well. I'm proud of you.

## cry — 泣く（5組）

### 泣く × 安心させる (`cry|reassurance`)

1. I hear you crying. I'm right here. Come for a cuddle.
2. I hear you crying. I'll stay close. You're not alone.
3. I hear those tears. We have time. I'm here with you.

### 泣く × 問いかけ (`cry|inquiry`)

1. I hear you crying. What's the matter? I'm listening, sweetheart.
2. I hear you crying. What's bothering you? I'm here to listen.
3. I hear those tears. Let's take a look. I'm listening, sweetheart.

### 泣く × 労い (`cry|care`)

1. I hear you crying. That was a lot. I'm here with you.
2. I hear you crying. We can rest now. I'll stay beside you.
3. Those tears are real. I'll stay with you. Let's rest together.

### 泣く × 愛情 (`cry|affection`)

1. I hear you crying. I love you, sweetheart. I'm right here.
2. I hear your tears. I love being together. You're so precious.
3. You're crying, little one. I love you, sweetheart. I'm right here.

### 泣く × 一時停止 (`cry|pause`)

1. We can pause now. I hear you crying. I'm here with you.
2. Let's rest a moment. I hear your cries. I'll stay close.
3. No need to rush. I hear you crying. We're here together.

## sleep — 睡眠（3組）

### 睡眠 × 提案 (`sleep|invitation`)

1. Shall we rest now? Let's get cozy. I'll stay close.
2. Shall we rest now? Here's a cozy spot. I'll stay close.
3. Feel like resting now? Let's get comfortable. I'll stay with you.

### 睡眠 × 安心させる (`sleep|reassurance`)

1. Ready for a rest? I'm right here. We have time.
2. Time for a rest. I'll stay close. You're not alone.
3. Let's rest a little. We have time. I'm here with you.

### 睡眠 × 完了確認 (`sleep|finish_check`)

1. Is nap time finished? Shall we get up? I'm right here.
2. All done resting? Shall we check? All done now?
3. Is your rest finished? Let's check together. Are we finished?

## wake — 起床（3組）

### 起床 × 愛情 (`wake|affection`)

1. Hello, my treasure! You're awake now. I love seeing you.
2. You're awake, sweetheart! What a lovely surprise. I love you.
3. Hello, little one! I love you, sweetheart. I'm right here.

### 起床 × 問いかけ (`wake|inquiry`)

1. You're awake now! How do you feel? Hello, sweetheart.
2. Hello, little one! What do you notice? Let's find out together.
3. Awake already, sweetheart? Let's take a look. I'm listening, sweetheart.

### 起床 × 始める (`wake|start`)

1. You're awake now! Here we go again. Hello, little one.
2. Look who's awake! Here we go! Let's begin gently.
3. It's awake time! Let's get started. I'm right beside you.

## book — 絵本（7組）

### 絵本 × 提案 (`book|invitation`)

1. Shall we read together? Here's our book. Let's look inside.
2. Here is our book. Shall we read together? Turn a page.
3. A story for you! Look at these pictures. Shall we start?

### 絵本 × 繰り返す (`book|repeat`)

1. One more page? Let's read again. Turn the page.
2. Let's open our book. Let's try once more. Ready when you are?
3. Look at this book. Shall we go again? I'll stay close.

### 絵本 × 始める (`book|start`)

1. Here comes our book. Let's begin reading. What comes next?
2. Let's open our book. See the first page? Shall we read?
3. Look at this book. Let's get started. I'm right beside you.

### 絵本 × 問いかけ (`book|inquiry`)

1. What's in the book? Let's turn a page. What do you see?
2. See the book? What do you notice? Let's find out together.
3. Look at this picture! Let's take a look. I'm listening, sweetheart.

### 絵本 × 褒める (`book|praise`)

1. You looked at pictures! That's lovely, sweetheart. Well done.
2. Look at your book! That was lovely! Well done, sweetheart.
3. You're looking at pictures! You're doing so well. I'm proud of you.

### 絵本 × 一時停止 (`book|pause`)

1. Let's pause reading. We can read later. I'm right here.
2. A pause in reading. Let's rest a moment. We'll return soon.
3. Let's stop this page. No need to rush. I'll stay with you.

### 絵本 × 完了 (`book|finish`)

1. Our book is finished! That's the last page. Well done, sweetheart.
2. Story time is over. We read together. What a lovely book.
3. All done reading now! Let's close the book. We can rest.

## smile — 笑顔（3組）

### 笑顔 × 愛情 (`smile|affection`)

1. What a lovely smile! You're so sweet. I love you.
2. What a lovely smile! Your face lights up. I love you.
3. Look at your smile! I love you, sweetheart. I'm right here.

### 笑顔 × 褒める (`smile|praise`)

1. What a sweet smile! So lovely to see. Hello, little one.
2. What a lovely smile! That was lovely! Well done, sweetheart.
3. Look at your smile! You're doing so well. I'm proud of you.

### 笑顔 × 繰り返す (`smile|repeat`)

1. Another little smile? I'll smile at you. Your turn again.
2. Want to smile together? Here's a smile. I'll smile with you.
3. Shall we smile together? Look at my face. I'll smile too.

## play — 遊び（9組）

### 遊び × 提案 (`play|invitation`)

1. Shall we play together? Let's try something. This could be fun.
2. Let's start a game. Can you see this? It looks fun.
3. Shall we play together? Here's our little toy. Let's have fun.

### 遊び × 繰り返す (`play|repeat`)

1. Let's play again! One more time? Ready when you are.
2. Here's our little game. Let's try once more. Ready when you are?
3. Let's play together. Shall we go again? I'll stay close.

### 遊び × 始める (`play|start`)

1. Ready to play? Let's get started. Here we go.
2. Look at this toy! Ready for a game? Let's begin together.
3. Let's play together. Let's get started. I'm right beside you.

### 遊び × 褒める (`play|praise`)

1. Look at you playing! You're doing great. Well done, sweetheart.
2. What lovely playing! That was lovely! Well done, sweetheart.
3. You're playing right now! You're doing so well. I'm proud of you.

### 遊び × 達成 (`play|achievement`)

1. You got the toy! You did it! What a moment.
2. Look at that play! You did it! How wonderful is that!
3. Your game worked out! That worked out! Hooray, little one!

### 遊び × 頑張りを認める (`play|effort`)

1. You're working on this! I see you trying. No need to hurry.
2. You're trying this game. I see your effort. I'm here with you.
3. You're trying this game. You're working so hard. I'll stay beside you.

### 遊び × 一時停止 (`play|pause`)

1. Let's pause our game. We can rest now. I'm right here.
2. Playtime can wait. Let's take a break. I'll stay beside you.
3. Shall we stop playing? We can rest together. I'm here, sweetheart.

### 遊び × 励ます (`play|encouragement`)

1. Try the game again. You can do this. I'm here with you.
2. Let's try that toy. Go at your pace. I'll stay close.
3. Playing takes practice. Give it a try. I'm right here.

### 遊び × 完了 (`play|finish`)

1. Our game is finished! All done playing now. Well done, sweetheart.
2. Playtime is over now. Let's take a break. That was lovely.
3. That's the last game. We're all finished. Time for a rest.

## food — 食事（6組）

### 食事 × 提案 (`food|invitation`)

1. Shall we eat? One little bite. I'll stay close.
2. Ready for some food? Here's a little bite. We can go slowly.
3. Would you like food? One little bite now. I'll stay near.

### 食事 × 褒める (`food|praise`)

1. You took a bite! Good job, little one. That was lovely.
2. Look at your food! You're doing so well. Well done, sweetheart.
3. Look at that bite! You're doing so well. I'm proud of you.

### 食事 × 完了確認 (`food|finish_check`)

1. Are we done eating? Shall we wipe up? Let's check together.
2. Finished eating yet? Shall we check? All done now?
3. Are we done eating? Let's check together. Are we finished?

### 食事 × 安心させる (`food|reassurance`)

1. It's food time, sweetheart. I'll stay beside you. We can go slowly.
2. Food time together. I'll stay close. You're not alone.
3. Here's a little bite. We have time. I'm here with you.

### 食事 × 一時停止 (`food|pause`)

1. Let's pause eating now. We can wait. I'm beside you.
2. Food time can wait. No need to hurry. I'm right here.
3. Another bite can wait. Let's take a break. I'll stay close.

### 食事 × 頑張りを認める (`food|effort`)

1. You're trying that food. I see you trying. I'll stay close.
2. A new little bite. You're working on it. I'm right here.
3. You're trying new food. I can see that. We'll go slowly.

## outside — 外出（5組）

### 外出 × 提案 (`outside|invitation`)

1. Shall we go outside? Let's look around. What do you see?
2. Shall we go outside? Let's look all around. I'll stay close.
3. Want some fresh air? We can go together. Let's look around.

### 外出 × 始める (`outside|start`)

1. Outside we go! Let's look around. What can you see?
2. We're going outside. Here we go! Let's begin gently.
3. Let's look outside. Let's get started. I'm right beside you.

### 外出 × 安心させる (`outside|reassurance`)

1. We're going outside together. I'll stay close. I've got you.
2. Out here with me. I'll stay close. You're not alone.
3. We're outside together. We have time. I'm here with you.

### 外出 × 一時停止 (`outside|pause`)

1. Let's stop a moment. Our walk can wait. I'll stay near.
2. Pause our little walk. Let's look around. We have time.
3. A break while outside. We can wait here. I'm with you.

### 外出 × 完了 (`outside|finish`)

1. Our walk is over! Here we are. Let's get cozy.
2. Outside time is over. We're back together. I'm right here.
3. Our outing is finished. Let's take a rest. Here we are.

## music — 音楽（6組）

### 音楽 × 提案 (`music|invitation`)

1. Shall we sing? La, la, la! Let's try together.
2. Shall we sing now? Listen to this tune. La, la, la!
3. Can you hear that? Shall we sing together? La, la, la!

### 音楽 × 始める (`music|start`)

1. Let's sing together! Here we go. La, la, la!
2. Here's a little song. Here we go! Let's begin gently.
3. Listen to our music. Let's get started. I'm right beside you.

### 音楽 × 繰り返す (`music|repeat`)

1. One more song? Let's sing again. La, la, la!
2. Here's a little song. Let's try once more. Ready when you are?
3. Listen to our music. Shall we go again? I'll stay close.

### 音楽 × 褒める (`music|praise`)

1. You made a sound! Well done, little one. Let's sing together.
2. What a lovely tune! That was lovely! Well done, sweetheart.
3. I heard your music! You're doing so well. I'm proud of you.

### 音楽 × 一時停止 (`music|pause`)

1. Let's pause our song. We can listen later. I'll stay close.
2. A little music break. We have time. I'm here with you.
3. Let's stop the music. We'll sing again later. I'm right here.

### 音楽 × 完了 (`music|finish`)

1. Our song is finished! All done singing. Let's rest together.
2. Music time is over. That was lovely. I'm right here.
3. That's the last note! We finished our song. Hooray for us.

## drink — 飲む（5組）

### 飲む × 提案 (`drink|invitation`)

1. Want a little sip? Here is your drink. Sip if you like.
2. Shall we try drinking? Just a little sip. I'll stay nearby.
3. Here's a little drink. Take it slowly now. I'm here, sweetheart.

### 飲む × 完了確認 (`drink|finish_check`)

1. All done drinking? Want another sip? Let's see together.
2. Finished your drink? Shall we check? All done now?
3. Had enough to drink? Let's check together. Are we finished?

### 飲む × 褒める (`drink|praise`)

1. You took a sip! Well done, little one. That's lovely.
2. Look at that sip! That was lovely! Well done, sweetheart.
3. You had your drink! You're doing so well. I'm proud of you.

### 飲む × 一時停止 (`drink|pause`)

1. Let's pause drinking. More sips can wait. I'm right here.
2. No more sips yet. We can wait. I'll stay with you.
3. Your drink can wait. Let's rest a little. I'm right here.

### 飲む × 完了 (`drink|finish`)

1. All done drinking now! You're finished here. Let's rest together.
2. Drinking time is over. We can pause now. I'm right here.
3. No more sips now. Drinking time is done. Let's relax together.

## hands — 手（5組）

### 手 × 褒める (`hands|praise`)

1. Look at those hands! You're doing great. Well done, little one.
2. Look at those hands! That was lovely! Well done, sweetheart.
3. Your little hands move. You're doing so well. I'm proud of you.

### 手 × 提案 (`hands|invitation`)

1. Shall we hold hands? Give me your hand. I'm right here.
2. Want to touch hands? Let's do it together. Ready when you are?
3. Let's play with fingers! Come try with me. What do you think?

### 手 × 頑張りを認める (`hands|effort`)

1. Your hands are moving. You're trying so hard. I see you.
2. Look at your hands! I see you trying. I'm here with you.
3. See your little fingers? You're working so hard. I'll stay beside you.

### 手 × 達成 (`hands|achievement`)

1. Your fingers found it! Hooray, little one! You did that.
2. Look at those hands! You did it! How wonderful is that!
3. Your fingers did it! That worked out! Hooray, little one!

### 手 × 励ます (`hands|encouragement`)

1. Try reaching your hand. I'm right here. You can go slowly.
2. Those hands can try. Just one little reach. I'll stay close.
3. Give your hand time. You can try again. I'm cheering you on.

## feet — 足（5組）

### 足 × 褒める (`feet|praise`)

1. Look at those feet! You're doing great. Well done, little one.
2. Look at those toes! That was lovely! Well done, sweetheart.
3. Look at your feet! You're doing so well. I'm proud of you.

### 足 × 提案 (`feet|invitation`)

1. Shall we move toes? Let's kick together. One, two, three!
2. Want to wiggle toes? Let's do it together. Ready when you are?
3. Shall we kick together? Come try with me. What do you think?

### 足 × 頑張りを認める (`feet|effort`)

1. Your feet are moving. I see you trying. That's hard work.
2. Look at those feet! I see you trying. I'm here with you.
3. Your little feet move! You're working so hard. I'll stay beside you.

### 足 × 達成 (`feet|achievement`)

1. You gave a kick! You did it! Hooray for you.
2. Look at your feet! You did it! How wonderful is that!
3. Those little toes moved! That worked out! Hooray, little one!

### 足 × 励ます (`feet|encouragement`)

1. Try kicking those feet! I'm right here. You can try again.
2. One little kick? Give it a try! I'll stay close.
3. Those little toes! Try moving them. I'm cheering you on.

## clothes — 着替え（5組）

### 着替え × 提案 (`clothes|invitation`)

1. Shall we get dressed? Here comes your shirt. One arm first.
2. Ready for some clothes? Let's do it together. Ready when you are?
3. Shall we dress together? Come try with me. What do you think?

### 着替え × 始める (`clothes|start`)

1. Time to get dressed! Let's start here. One arm first.
2. Here come your clothes! Here we go! Let's begin gently.
3. Dressing time starts now! Let's get started. I'm right beside you.

### 着替え × 完了 (`clothes|finish`)

1. All dressed now! Look at your outfit. Nice and cozy.
2. You're all dressed! All finished now! Let's get cozy.
3. Your clothes are on! That's all done. We can rest now.

### 着替え × 完了確認 (`clothes|finish_check`)

1. Are we all dressed? Let's have a look. One more sleeve?
2. Are your clothes on? Shall we check? All done now?
3. Dressing finished now? Let's check together. Are we finished?

### 着替え × 褒める (`clothes|praise`)

1. Look at you helping! Your shirt is on. Good job, little one.
2. You're helping with dressing! That was lovely! Well done, sweetheart.
3. Look at your clothes! You're doing so well. I'm proud of you.

## voice — 声（5組）

### 声 × 愛情 (`voice|affection`)

1. I love your voice! Such a sweet sound. I'm listening, sweetheart.
2. What a little voice! I love being together. You're so precious.
3. Listen to those sounds! I love you, sweetheart. I'm right here.

### 声 × 褒める (`voice|praise`)

1. What a lovely sound! You're doing so well. I'm listening, sweetheart.
2. That's your little voice! That was lovely! Well done, sweetheart.
3. You're making sweet sounds! You're doing so well. I'm proud of you.

### 声 × 繰り返す (`voice|repeat`)

1. Another little sound? Let's try again. I'll listen closely.
2. One more little sound? Let's try once more. Ready when you are?
3. Shall we make sounds? Shall we go again? I'll stay close.

### 声 × 始める (`voice|start`)

1. Let's make some sounds! I'll listen first. Now it's your turn.
2. Let's start making sounds! Here we go! Let's begin gently.
3. Ready for little noises? Let's get started. I'm right beside you.

### 声 × 励ます (`voice|encouragement`)

1. Want to make sounds? Give it a try. I'll listen closely.
2. Make a little sound. I'm listening, sweetheart. You can try again.
3. Another little sound? You can try. I'm right here.

## tummy — お腹（3組）

### お腹 × 問いかけ (`tummy|inquiry`)

1. How's your tummy? Are you comfortable? I'm listening, sweetheart.
2. Is your tummy okay? What do you notice? Let's find out together.
3. What about your tummy? Let's take a look. I'm listening, sweetheart.

### お腹 × 安心させる (`tummy|reassurance`)

1. Let's rest a little. I'll hold you close. You're not alone.
2. I'm here, sweetheart. I'll stay close. You're not alone.
3. Let's rest your tummy. We have time. I'm here with you.

### お腹 × 労い (`tummy|care`)

1. That was a lot. Let's rest your tummy. I'm right here.
2. Let's rest your tummy. We can rest together. I'll stay with you.
3. Your tummy can rest. I'm here with you. Let's take time.

## rain — 雨（4組）

### 雨 × 問いかけ (`rain|inquiry`)

1. Can you hear rain? What's that sound? Let's listen together.
2. Hear the rain outside? What do you notice? Let's find out together.
3. Can you hear raindrops? Let's take a look. I'm listening, sweetheart.

### 雨 × 愛情 (`rain|affection`)

1. Rain is falling outside. I'm here with you. I love these moments.
2. Listen to the rain! I love being together. You're so precious.
3. Rain sounds so gentle. I love you, sweetheart. I'm right here.

### 雨 × 提案 (`rain|invitation`)

1. Shall we watch rain? Look at the window. Listen with me.
2. Shall we hear rain? Let's do it together. Ready when you are?
3. Want to watch raindrops? Come try with me. What do you think?

### 雨 × 始める (`rain|start`)

1. Rain is starting now. Can you hear it? Let's listen together.
2. Here comes the rain! Drip, drop, drip. Let's listen together.
3. The first raindrops fall. Can you hear them? Come listen with me.

## sun — 日光（4組）

### 日光 × 提案 (`sun|invitation`)

1. Shall we see sunshine? Let's look outside. So bright today!
2. Want to see sunshine? Let's do it together. Ready when you are?
3. Shall we watch sunlight? Come try with me. What do you think?

### 日光 × 愛情 (`sun|affection`)

1. Sunshine is so bright! I'm here with you. I love this moment.
2. Look at the sunshine! I love being together. You're so precious.
3. Sunny light is lovely! I love you, sweetheart. I'm right here.

### 日光 × 問いかけ (`sun|inquiry`)

1. Can you see sunshine? Look at the light. Isn't it bright?
2. Where is the sunshine? What do you notice? Let's find out together.
3. Can you see sunlight? Let's take a look. I'm listening, sweetheart.

### 日光 × 始める (`sun|start`)

1. Here comes the sunshine! Look at that light. Let's look together.
2. The sunshine is coming. Shall we look outside? Look at that glow.
3. Sunlight is showing now. Look at the sky. Here it comes.

