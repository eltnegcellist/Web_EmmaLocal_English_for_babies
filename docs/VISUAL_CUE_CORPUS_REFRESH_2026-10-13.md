# Visual Cue 再設計 — 最新914英文セット（2026-10-13）

状態: **企画・コーパス再調査（未実装、画像未制作）**。旧設計の203英文／41概念を置換する最新の判断資料。  
対象: 公開向けLite「呼びかけ」および「押して聞く」（Android / Web）。Full・自由生成文は当面対象外。

## 1. 参照した最新mainと正本

- Web main: 5dd233a1c17b39c53301102fa866dcd1e02d35f5
- Android main: e207d20ba797356ee5f48f3125235ca2ea895b7f
- Web: src/lite-response-engine.js、src/interaction/response.js、src/interaction/ruri-routing.js、src/interaction/supplemental-replies.js、src/interaction/frequent-replies.js、shared/play-topics.json
- Android: app/src/main/java/com/eltnegcellist/emma/ai/LiteResponseEngine.kt ほか、同等のInteraction/Composite bank
- 全件列挙手順の既存正本: Web scripts/export-phoneme-corpus.mjs
- 乳児英文の現行審査方針: docs/english/INFANT_ENGLISH_REVIEW_POLICY_20261013.md
- 元計画: docs/visual-cue-architecture.md、docs/VISUAL_CUE_HANDOFF_2026-10-10.md、PR #66

2026-10-13のmainの**固定英語候補を実際に抽出・突合**したスナップショットであり、旧計画の計測値を流用していない。数値は将来の英語修正で変わり得るため、実装時は同じ正本から再生成する。

| ソース | セット数 | 内容 |
| --- | ---: | --- |
| Topic | 197 | generic、育児scene、neutral drink |
| Interaction | 112 | 14分類 × 8セット |
| Topic × Interaction | 495 | 基本111組×3=333、追加24組×3=72、頻出18組×追加5=90 |
| 押して聞く | 110 | 22話題×5セット |
| **合計** | **914** | **914件の異なる全文文字列** |

- セット内の短い1文を分割・正規化して全ソースで重複除去すると、**1,597種類**（実行時の最終スタイル適用前）。
- 「押して聞く」は**110種類の3文セット**があり、現行の src/feature-screens.js の singleSentencePhrases と同じ分割・重複排除では**1文モードは173種類**。旧READMEの167種類など過去値で設計しない。
- **48セットに {name} プレースホルダー**がある。赤ちゃんの名前が入っても映像Cueは変わらない。
- これらは候補数・文字列の調査であり、乳児が914通りの動画を見る設計ではない。
- 914セット全件の英語の自然さ・TTS実聴に対する人手承認が完了したとはみなさない。

## 2. 旧計画との違い

旧調査は「通常会話161＋押して聞く110、重複除去後203英文→41 visual concept」という**2026-10-10時点の予備調査**。この数字も41概念も最終資産数として用いない。

変更点は以下。

1. Topic単独だけでなく、**Interaction単独・135組のTopic×Interaction**に対応する。意味が同じなのはTopicだけでなく働きかけ方まで見た場合に限る。
2. 褒める、達成、努力、励まし、誘い、開始、完了、完了確認、気遣い、問いかけ、安心、繰り返し、休止、愛情の14分類を画面表現で混同しない。
3. 全セットは原則3文だが、**押して聞くの1文モードは1文ごとのCue解決**が必要。3文全体の意味を1文モードへ流用すると、画面と声が食い違う。
4. 話題×Interactionの同じキーでも文面は多様。「milk|affection」というラベルだけで**常に哺乳瓶の絵を出すことは禁止**。実際に選ばれた完成英文の意味を開発時に審査する。
5. 最近の英文改善により、英文の配列順も文面も変わり得る。既存の一時ID「kind:scene:1」の末尾番号は**安定IDではない**。

## 3. Visual Cueの意味軸（旧5軸を拡張）

従来の複数軸方式は維持する。ただし914セットを扱うため次の分類を追加候補とする。Cue IDは名前空間付き文字列で、未登録値をCIで検知する。

| 名前空間 | 役割と候補 |
| --- | --- |
| subject.* | milk / bottle / bath / diaper / clothes / hands / feet / book / toy / sun / rain / food |
| action.* | sip / splash / wash / wipe / dress / cuddle / clap / wave / kick / turn-page / sing / sleep / wake / play |
| observed.*（追加案） | smile / tears / vocalizing / eyes-open / wiggling。**目に見える状態**であって内面の断定ではない |
| emotion.* | happy / calm / excited 等。英文で明確な場合に限定。泣く＝sad、笑う＝happyとはしない |
| social.* | greeting / affection / praise / success / effort / encouragement / reassurance / care |
| attention.* | look / listen / wonder / gentle / slow |
| dialogue.*（追加案） | invitation / start / finish / finish-check / inquiry / repeat / pause。**完了と完了を尋ねる**を区別 |

新namespaceは必要が確定した段階でschema/registryを更新する。初期は自由に新Cueを量産せず、既存Cueへの統合とレンダリング可能性を人手で判定する。

## 4. 最新英文に対する代表的割当案

下表は**設計例であって914件の承認済み割当ではない**。実際の文章を基に、1主役＋必要な補助Cueへ圧縮する。

| 実際の英文例／ソース | 主役Cue案 | 補助Cue案 | 表示の第一候補 |
| --- | --- | --- | --- |
| Milk time! Sip, sip! Little by little.／押して聞く | action.sip | subject.milk | 哺乳瓶の小さな飲む動き |
| You took little sips! Look at you go! Good job, baby!／milk×praise | action.sip | social.praise | 飲む動作＋Emmaのやさしいうなずき |
| I hear your tears. You're not alone. My arms are open.／cry×reassurance | social.reassurance | observed.tears | Emmaが穏やかに寄り添う。悲しみと決めつけない |
| Story time is over. We read together. What a lovely book.／book×finish | dialogue.finish | subject.book | 閉じた絵本、穏やかな終了表現 |
| Shall we have milk? Little sips are fine. I'm here with you.／milk×invitation | dialogue.invitation | subject.milk / action.sip | ミルクを差し出す。**飲み終わった絵にしない** |
| What a sweetheart! You're adorable. Such a lovely child.／Interaction affection | social.affection | — | 新規の物体絵よりEmmaの表情 |
| You did it! Look what happened! Hooray for you!／Interaction achievement | social.success | attention.look | Emmaの笑顔＋控えめなsparkle |
| One more try? I'm here too. You've got this!／Interaction encouragement | social.encouragement | — | Emmaの軽いうなずき。成功済みにはしない |
| Look at this picture! What can you see? Let's look together!／book Topic | attention.look | subject.book | 本の絵と視線の誘導。複数のカードは並べない |

**注意**: TopicやInteractionの分類器の推定は「返す英文」を選ぶ入力であって、絵の正解ラベルではない。描画は選ばれた**英文候補IDの事前レビュー済みCue**を採用し、日本語認識結果からイラストを別途判定しない。

## 5. 既存全分類を確認するためのマトリクス

### Topic 22群（genericを含む）

| 区分 | 映像の基礎単位 |
| --- | --- |
| generic | Emma／greeting／attention。抽象的愛情に特定の物体を割り当てない |
| bath, milk, drink, diaper, clothes | 水、哺乳瓶/カップ、おむつ、衣服を基本素材として、動作差分を作る |
| sleep, wake, tummy | ゆっくりした休息、目の開閉、体の輪郭。医学的な状態を断定しない |
| hug, hands, feet | 抱っこ／手・足素材を使い、hug/clap/wave/kick等で動き分ける |
| smile, cry, voice | observedとsocialを優先。泣く際は怖がらせる絵を避ける |
| play, outside, rain, sun | おもちゃ／空／雨／光を少数の素材＋簡単なmotionにする |
| food, book, music | 食器・スプーン／絵本／音・リズム。read/open/turn-page、sing/listenを区別 |

### Interaction 14群（すべて本文を照査）

| 分類 | Visual Cueへ反映する相違 |
| --- | --- |
| affection | Emmaの愛情表現。抽象的な「好き」を物体で描かない |
| praise | 褒める。successは実際に達成を表す英文だけ |
| achievement | できた／終えられた。派手な達成演出は避ける |
| effort | 頑張っている最中であること |
| encouragement | これから試すための励まし。effort/achievementと区別 |
| invitation | 一緒にしよう／誘い |
| start | 始める場面 |
| finish | 完了したと述べる |
| finish_check | 終わったか尋ねる。完了済みの確定画像にしない |
| care | やさしい世話・配慮 |
| inquiry | 問いかけ。確定的な動作・感情を描かない |
| reassurance | 安心させる。Emmaの穏やかな表情を基本とする |
| repeat | もう一回、の反復 |
| pause | 少し休む／待つ。再生停止と取り違えない |

Topic×Interactionは**135組全体**に一意の固定絵を作るのではなく、当該組の**実際の各英文**から意味Cueを作り、共通部品へ整理する。頻出18組の追加バリエーション90セットにも漏れなく適用する。

## 6. 表示単位・音声同期

- 通常の「呼びかけ」: 選択された**3文セットを1場面**として表示する主役Cueが基本。1セット内で物と働きかけが変わるときだけ、任意の段階Cue（sentence cue）を検討する。
- **1文ごとに大きく画面遷移しない**。必要なら同じ主素材の一部分だけ変化させ、TTSが主役であり続ける。
- 「押して聞く」1文: 分割後の**実際に読む1文**に対応したCueを出す。3文: その3文セットを主単位とする。単語一致だけでCueを決めず、同一文の重複統合時の意味衝突はレビューに回す。
- キャッシュされたTTS再生、途中停止、連打中止、履歴再生を想定し、Cueのライフサイクルを**実際の再生開始・中断・終了イベント**へ連動させる。返答生成時点で画面を確定表示しない。
- 名前差し込み48候補、表示用スタイル整形を通る場合も、元の文候補IDを保持する。実際の読み上げ文で意味が変わる変形がないことを検証する。
- TTS終了後の短い保持／フェードアウトは試作で調整。強制自動再生や赤ちゃんの画面注視を促す動線は追加しない。

## 7. phraseIdとデータ契約の移行

現行 scripts/export-phoneme-corpus.mjs の ID は「kind:scene:配列位置」の**監査用暫定ID**。配列の追加・削除でずれるため、そのまま永続資産IDとして使わない。

次段階で、正本の各固定英文に人手管理の**stablePhraseId**を付与して返答選択結果まで伝播させる。visual assignmentは文章テキストやTopicラベルで推定せずstablePhraseIdを参照。変更前後の内容はfingerprintで検知するが、fingerprintそのものを恒久IDにしない。

契約の追加検討項目:
- sourceType: topic / interaction / combined / press
- stablePhraseId、sourceRevision、英語文字列の確認用fingerprint
- primaryCue、secondaryCues、renderPreference、reviewStatus（旧schema互換の中心）
- optional sentenceCues（1〜3の各文、特に「押して聞く」1文再生用）
- Web/Android 同じassignmentsとCue registryを持ち、Webの共通データを正本としてAndroidへ同期

旧 shared/visual-cue-contract.schema.json は引き続き**設計draftのみ**。安定ID方針と1文モードの契約を決めてからversionを上げる。既存のtopic contractや英文選択の仕様を先に破壊しない。

## 8. 初期の素材・試作方針

**最終的な画像枚数はまだ決めない**。914件を素材単位に集約する見積もりを、人手レビュー後に初めて確定する。

優先順:
1. 既存Emmaの表情、口パク、まばたき、うなずきを活用（特にsocial/attention/observed）
2. 手・足・絵本・哺乳瓶・水・おむつ・服・スプーン・雨／日光・おもちゃ等、少数の共通SVG/Canvas描画素材を組み替える
3. clap、wave、sip、page-turn等はCSS/Compose/SVGの単純なmotionへ
4. 一般素材で意味が伝わらない場合のみ、ライセンス確認済み素材や専用イラスト

最初の試作候補12種類: milk+sip、bath+splash、hands+clap、hands+wave、feet+kick、book+turn-page、rain、sleep、smile、cry+reassurance、praise/achievement、finish-check。これは**12枚の画像が必要**という意味ではない。

## 9. 再開手順（旧「英文拡張まで保留」を更新）

英文拡張はmainへ反映されたため、**コーパス再分析は着手可能**。ただし本資料が済ませたのは914件の棚卸しと意味軸・例示方針まで。**914件すべてへのCue assignment、人間の全件視覚レビュー、素材制作、UI実装はまだ未実施**。

1. Webの scripts/export-phoneme-corpus.mjs を正本に**914セットのID・文面・source・scene**を固定スナップショット化。Androidと完全同期を検証。
2. stablePhraseId導入と、押して聞く173種類の1文候補の**文ごとの解決契約**を定義。
3. 914件すべてに多軸Cue案を自動提案し、出現数・未割当・解釈が曖昧な文を機械出力する。生成案を自動承認しない。
4. **全件人手レビュー**: 状態の断定、完了と確認、褒めと達成、文中の主役の矛盾、1文/3文表示を確認。
5. Cue重複を整理し、render registryと基本素材一覧を確定。未知Cue/未描画はEmma neutralに安全fallbackしつつCIは失敗する。
6. 約12種類でUI試作し、音声同期／停止／画面オフ／小画面／視覚刺激／低性能端末を確認。
7. 採用後に全対象へ展開し、WebとAndroidのassignment/parityをCIへ追加。

## 10. 受け入れ基準と保留

- corpus count、stablePhraseId、全文fingerprintで差分を検出する
- **914件のsource文からのCue未割当0、orphan0、unknownCue0**（対象数は変更時に更新）。press 1文経路の単独cue対象も未割当0
- トピックだけから意味に合わない物体絵を表示しない。未確定の「終わった？」を完了済みにしない
- 画像未ロードやunknownCueでも音声再生を妨げずEmma neutralへfallback
- TTS途中停止、音声キャッシュ、名前差し込み、1文/3文切替に同期する
- 機能はオフラインで完結、実行時の画像生成やLLM分類は不要
- 赤ちゃんに過度な視覚刺激を与えない。効果を研究で実証済みとは説明しない
- Full/Gemmaによる自由生成英文への画像割当は今回の対象外
