# 追加機能仕様

更新日：2026-10-05。AndroidとWebで共有する追加機能の仕様・検証範囲です。最新mainの配色と既存の話題判定を保持します。

## 画面オフ会話（Android）

初期設定はオフ。未設定の既存端末もオフにし、明示的に選んだオン／オフは保持します。オフの場合は画面オフ・他アプリへの移動で会話を停止します。オンの場合は周囲の会話に応答することがある旨を設定に説明し、開始したセッションだけをForeground Serviceが所有します。Lite/Fullとも同じController・マイク・TTS経路です。アプリの画面から開始し、通知から停止できます。Android 13以降は通知の許可なしでも開始できます。会話中に画面オフ設定をオンにした場合も、既存セッションをForeground Serviceへ移し、音声認識を重複起動しません。サービス通知は遅延させず、通知許可の取得後も表示を更新します。

画面オフ会話をオンにすると、必要な場合だけ「通知から会話を停止できるようにしますか？」と尋ねます。「はい」の場合だけ通知許可またはAndroidの通知設定へ進み、「いいえ」・拒否でも会話の継続を妨げません。アプリ内の「通知から会話を止める」スイッチで停止ボタンをオン・オフでき、Androidの許可状態とは別に管理します。未許可・チャンネル無効なら「表示できません」、会話開始前は「待機中」と表示します。サービス動作中の設定変更・許可取得は通知へ即時反映します。この設定をオフにしても、Androidが要求するForeground Serviceの動作中通知・表示は残る場合があります。画面オフ会話自体をオフにすると、実行中のバックグラウンド会話も停止します。

音声フォーカスを失うと停止します。再起動・強制停止後には自動で復帰しません。オフを選んだ設定は保持します。

Webの画面ロック中の継続は保証しません。

## 端末内会話履歴

保存は初期設定オン。実際に音声出力を開始した応答の日本語と最終英語、日時、話題、Lite/Full、セッションIDを保存します。生成だけで再生前に停止した応答は保存しません。録音・生成音声は保存しません。音声が途中で停止されても再生開始済みの履歴は残り、完了したことを意味しません。

最大1,000件、古いものから削除。履歴画面は端末のタイムゾーンに変換して日付ごとにまとめ、時刻をHH:mmで表示します。日本語は音声認識結果（誤認識を含む場合あり）、英語は再生した文章として区別します。設定から一覧、再生、個別削除、確認付き全件削除。保存オフは今後の保存を止め、既存履歴は残します。再生では新しい履歴を作らず、保存当時の文章と名前を現在のTTSで読みます。履歴閲覧時に通常会話を停止し、戻った際に自動再開しません。AndroidはSQLite、WebはIndexedDB。Androidの履歴はクラウドバックアップ・端末移行から除外します。保存失敗で会話は止めません。

## 押して聞く

主役は下部の横長「会話を始める／会話を止める」。同じ行の左側に小さい丸形の「☝ 押して聞く」、右側に幅を広く取った会話ボタンを配置します。文字拡大時は高さと折り返しで文字を表示し、補助ボタン専用の行は設けません。補助ボタンから会話を停止し、初期状態は「すべての話題」で広い再生画面を直接開きます。共通の全話題の文章を重複なしで混ぜ、話題選択を挟まず遊べます。「話題を変更」から特定の話題へ絞ったり「すべての話題」に戻せます。通常会話と同じKittenのモデル・実行エンジンを使い、遊び画面を開くたびの全文章のまとめ生成を行いません。初めての文章だけタップ後に合成し、キャッシュが残っている文章はその音声を再利用します。白い背景と枠線の広い再生ボタンを使い、アバターは幅を抑え、余白を付けて比率を保って表示します。連打しても音声を重ねたり、後から連打の分を再生したりしません。直前と同じ文章を避け、止まった後で次のタップを待ちます。マイクは使わず、遊びの発話は履歴に保存しません。戻る際におとな向け確認を表示し、通常会話は自動再開しません。

標準は1回に1文です。既存の短い文のまとまりを文単位へ分け、短い一言も含めて1つだけ再生します。設定の「押して聞く」で「3文」を選ぶと、これまでのまとまりをそのまま再生します。1文モードは長い英文を強制せず、短い自然な表現も候補に残します。設定はブラウザ内に保存します。\n\n親・赤ちゃん・AIで一緒に聞く、まねする、交互に押す遊びです。押すのは親でも赤ちゃんでも構いません。親の介在を前提にします。既存の挨拶を残したうえでLiteの20育児話題と「飲む」を取り込み、22話題・110フレーズへ拡張します。Liteの返答をそのまま長く流すのではなく、8語以内の短い表現に整え、名前差し込み用テンプレートは除外します。乳児同士の社会的なインタラクションを扱った研究から着想を得ていますが、このAIやボタン機能の学習効果が実証されたとは説明しません。専用外部ボタン、BLE、画面ロック中の外部入力は実装しません。

| 話題 | 共通の英語例 |
| --- | --- |
| こんにちは | Hello, hello! / Hi there! / Hello, little one! / Let's say hello! / Good morning, little one! |
| お風呂 | Bath time! Splash, splash! Here we go! / Warm bath! Splash, splash! Nice and easy. / Bath time! Wash, wash! All clean. / Splash, splash! Warm water. Nice and gentle. / Wash, wash! Little toes. All clean. |
| ミルク・授乳 | Milk time! Sip, sip! Nice and slow. / Yummy milk! Sip, sip! Mmm, yummy! / Milk, milk! Little sips. Nice and easy. / Time for milk! Sip, sip! All done. / Little sips. Milk time! Nice and slow. |
| ねんね | So sleepy. Night-night. Rest, little one. / Sleepy time. Nice and quiet. Night-night. / Time to sleep. Rest, rest. Nice and cozy. / Sleepy eyes. Night-night. Rest, rest. / Good night, little one. Nice and cozy. |
| おはよう・起きる | Good morning! Eyes open. Hello, hello! / Morning, little one! Hello, hello! / Wake up! Hello, hello! Here we go! / Good morning! Bright eyes. Hello there! / Hello there! Morning time. Eyes open. |
| おむつ | Diaper time! Nice and easy. Here we go! / Fresh diaper! Here we go! Nice and easy. / Diaper change! Wipe, wipe! All clean. / Clean and fresh! Diaper time. All done. / Wipe, wipe! Fresh and clean. Here we go! |
| 着替え | Clothes on! Here we go! Nice and easy. / Dress time! One little arm. Here we go! / Getting dressed! Nice and easy. All ready. / Clothes time! Here we go! All cozy. / One arm, one leg. All ready! |
| 抱っこ・ぎゅー | Big cuddle! Up, up! Nice and close. / Cuddle time! Nice and close. Here we go! / Up we go! Big hug. So cozy. / Big hug! Nice and close. Right here. / Cuddle, cuddle! Warm and cozy. |
| て・おてて | Tiny hands! Squeeze, squeeze! Wiggle, wiggle! / Little hands! Open, close. Wiggle, wiggle! / Tiny fingers! Squeeze, squeeze! Little hands! / Hands, hands! Open and close. Wiggle, wiggle! / Clap, clap! Wave, wave! Little hands! |
| あし・あんよ | Little feet! Kick, kick! Wiggle, wiggle! / Tiny feet! Kick, kick! Little toes! / Feet, feet! Up and down. Kick, kick! / Little toes! Wiggle, wiggle! Kick, kick! / Tap, tap! Little feet. Kick, kick! |
| 笑顔 | Big smile! Smile, smile! Hello, little one! / What a smile! Hello, hello! Smile, smile! / Smile, smile! There it is! Hello there! / Happy smile! Hello, little one! So sweet. / Smile for me! Big, big smile! |
| 泣く・ぐずぐず | I hear you. Right here. Nice and gentle. / I hear you. Right here. Nice and close. / Hello, little one. I hear you. Right here. / I hear your voice. Nice and gentle. / Easy, easy. Right here with you. |
| こえ・おしゃべり | I hear you! Hello, hello! I'm listening. / What a voice! Ooh, ahh! I hear you. / Hello, little one! Ooh, ahh! I hear you. / Talk, talk! Ooh, ahh! I'm listening. / Little voice! Hello, hello! Sing with me. |
| げっぷ・おなか | Little tummy. Nice and easy. Take your time. / Little tummy. Nice and gentle. Here we go. / Nice and slow. Little tummy. Take your time. / Easy, easy. Little tummy. Right here. / Burp, burp! Little tummy. Nice and easy. |
| いっしょにあそぼう | Play time! Look, look! Here we go! / Let's play! Look with me. Here we go! / Play, play! Look, look! So much fun! / Time to play! Hello, hello! Let's play! / Peek-a-boo! One, two, three! Let's play! |
| お散歩・外 | Outside time! Look around! Here we go! / Out we go! Look, look! Listen with me. / Outside, outside! Look around! Here we go! / Time outside! Look with me. Listen, listen! / Fresh air! Look around. Listen with me. |
| 雨 | Rain, rain! Pitter-patter! Listen, listen! / Rain outside! Drip, drop! Listen with me. / Pitter-patter! Rain, rain! Drip, drop! / Listen, listen! Rain outside! Pitter-patter! / Drip, drop! Rainy day. Listen closely. |
| 晴れ・お日様 | Bright day! Hello, sunshine! Look, look! / Sunshine! Bright, bright! Look with me. / Hello, sunshine! Bright day! Look, look! / Bright, bright! Sunshine! Here we go! / Sunny day! Warm and bright. Look around! |
| ごはん・離乳食 | Food time! Yum, yum! Nice and slow. / Yummy food! Little bite. Nice and easy. / Time to eat! Yum, yum! Here we go! / Food, food! Little bite. Yum, yum! / Little bite. Chew, chew! Nice and slow. |
| 絵本 | Book time! Look, look! Turn the page. / Let's read! Look with me. Turn the page. / Book, book! Look, look! Here we go! / Story time! Turn the page. Let's see! / Open the book. Look, look! What's next? |
| うた・リズム | Music time! La-la-la! Listen, listen! / Let's sing! La-la-la! Listen with me. / Music, music! Tap, tap! Here we go! / Song time! La-la-la! Listen, listen! / Clap, clap! Tap, tap! Sing with me. |
| 飲む | Little sips. Sip, sip! Nice and slow. / Let's drink. Little sips. Nice and slow. / Sip, sip! Take your time. Little sips. / Small sips. Nice and easy. Take your time. / Drink, drink! Little sips. Nice and slow. |

共通データはWebの`shared/play-topics.json`とAndroidの`app/src/main/assets/play-topics.json`。`scripts/verify-play-topics.py`で同じSHA-256と説明の一致を確認します。話題判定用の既存共通データには変更しません。

## 新しい挙動の検証

自動検証：既存の共通話題判定244例・24系列、ガイド45例、アバターと配色、新しい保存・上限・削除・保存オフ・連打・終了・再生前取り消し。

新しい実機確認だけを残します：Android Lite/Fullで画面オフとホーム移動、通知停止、通話による音声フォーカス喪失、画面復帰、保存オフの再起動後保持、連打と離脱、履歴のTTS再生。Webは狭い画面・文字拡大時の操作配置、音声解錠、履歴保存と再生。実音声までの約0.5秒の目標はモデル準備後の端末で計測が必要です。以前の通常会話の実機テストを再実施の条件にはしません。

## チュートリアルの中断と枠

3段階目は「聞いています」の状態表示をスクロールで画面内に出し、その表示自体の座標をハイライトします。画面を閉じたり別アプリへ移った場合はチュートリアルとその会話を終了し、通常の開始ボタンを使える状態に戻します。中断したチュートリアルは自動再表示せず、設定からやり直せます。
