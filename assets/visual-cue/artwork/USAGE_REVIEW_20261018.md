# 実際の英文から見直した汎用場面

914セット／913種類の本文。入力SHA256 `cfff4385abaa6c67c4a86d96a7f3996ea2532313ab26a518157ffaa87c006807`。
sourceKeyの先頭話題を集計。生成済みprimaryCueによる頻度を採用数として扱わない。本文への明示言及は別集計し、候補例を提示。確率・利用ログ・意味適合の測定ではない。

## 話題別の件数（素材適合数ではない）

| 話題 | セット数 | 候補 | 本文例 |
| --- | --- | --- | --- |
| ミルク | 80 | milk, sip | Here's your milk! Ready for a sip? Here you go! |
| おむつ | 55 | diaper-v2, change-diaper-exchange | Time for a change. Let's get you dry. All fresh! |
| 遊び | 51 | toy | Let's play together! What should we try? Peekaboo! |
| お風呂 | 45 | bath, water-shower | Bath time is here! Is the water warm? Splash, splash! |
| 絵本 | 45 | book, page | Let's read a book! Look at the pictures. What's that? |
| 音楽 | 42 | music, notes | Let's sing together! La, la, la! Your turn! |
| 就寝 | 38 | sleep | Are you sleepy? Let's get cozy. Night-night! |
| 飲み物 | 38 | cup | Would you like some? Here's a little sip. There you go! |
| 食事 | 37 | meal, spoon | Time for a bite! Here's your spoon. Open wide! |
| 起床 | 33 | wake-bed, wake-daylight | You're awake! Hello, little one. It's nice seeing you! |
| 泣く・慰め | 33 | Emma等を別途審査 | I hear you crying. I'm right here. You're not alone. |
| 衣服 | 31 | clothes, change-clothes, dress-sleeves | Let's put clothes on. One arm first. Other arm next! |
| 一般会話 | 30 | Emma等を別途審査 | Hello, sweet baby! You're so loved. I'm right here. |
| 抱っこ | 28 | family-care, hug-arms | Come here, baby. Let's have a cuddle. Big hugs! |
| 手 | 28 | hands-open-v2, hand-wave, hold-hands | Look at your hands! Ten tiny fingers. Wiggle, wiggle! |
| 足 | 28 | feet, kick | Look at your feet! Ten tiny toes. Wiggle, wiggle! |
| 声 | 28 | Emma等を別途審査 | I hear your voice! Tell me more. I'm listening! |
| 外 | 28 | outdoor | Let's go outside! Look at the sky. What do you see? |
| 笑顔 | 27 | Emma等を別途審査 | What a smile! I love seeing it. You're so sweet! |
| 雨 | 25 | rain, water-rain | Rain is falling! Can you hear it? Pitter-patter! |
| 日差し | 25 | sun | The sun is shining! What a bright day. Hello, sunshine! |
| おなか | 22 | tummy | How's your tummy? Do you feel full? I'm here! |

## 制作優先順位

- 優先1 **飲み物のコップ**：drinkは38セット。ミルクの哺乳瓶を飲み物全般へ流用しない。
- 優先1 **自然な養育者と子の抱っこ**：hug28セットと愛情・慰めの関連場面。毛布だけでは意味が伝わらず、人物のつながった場面へ。関連会話を一律に抱っこへ割り当てるものではない。
- 優先1 **空のベビーベッドと平らなマットレス**：就寝38／起床33セット。R2で枕・掛け布団を撤回。空の寝床を基本とし、朝日の代案は起床動作そのものの承認とはしない。
- 優先1 **頭・肩・胴のある着替え**：衣服31セット。腹部だけへの服の貼り付けを廃止。
- 優先2 **手をつなぐ**：Hold my hand / Give me your handという明示文が2件。ボールより意味が合う。手の話題28セット全体への適合数とはしない。
- 優先2 **遊びのおもちゃ**：遊び51セットのため基本物体を優先。ballの明示は1件、rattleの明示も1件なので、球専用の握りを遊び全般に割り当てない。
- 優先3 **会話・聞く・笑顔・安心**：listen/hear/sound/voiceの明示言及は106件だが、対象は声・水・音楽など複数。1物体へ統合せず、場面の静止絵＋Emma表情を検討。専用Emma状態の制作とアプリ統合は別工程。

## 明示的な語の出現

| 対象 | 件数 | 判定上の限界 |
| --- | --- | --- |
| burp | 3 | 本文への明示的言及。素材適合数ではない。 |
| count | 2 | 本文への明示的言及。素材適合数ではない。 |
| squeeze | 4 | 本文への明示的言及。素材適合数ではない。 |
| ball | 1 | 本文への明示的言及。素材適合数ではない。 |
| rattle | 1 | 本文への明示的言及。素材適合数ではない。 |
| hold-hand | 2 | 本文への明示的言及。素材適合数ではない。 |
| listen-hear-voice | 106 | 本文への明示的言及。素材適合数ではない。 |
| cup | 1 | 本文への明示的言及。素材適合数ではない。 |

## 限定variant

- `hand-squeeze-v3`：ボールを握る限定variant。本文にボールを握る指示は見つからない。設計サンプルとして保持し、汎用・自動割当の適合数には含めない。
- `hand-count`：count言及2件のうち1件は足の指。手を数える絵への適合候補はgenericの1件のみ。
- `care-burp`：burpへの明示言及3件。基本場面より低優先。腹部ケアを撤回し、背中への手の動きに修正。

## 結論

細かな動作を増やす方針を改め、日常の物体と場面を先に揃える。コップと手をつなぐ場面を追加し、抱っこ・就寝／起床・衣服の基本場面を再制作する。質問、誘い、安心、応援の英文を無理に「実行済み動作」へ変換しない。914英文の最終割当やEmmaの本体実装は変更しない。
