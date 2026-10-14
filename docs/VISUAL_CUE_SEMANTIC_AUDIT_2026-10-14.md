# みつことば：Visual Cue意味監査・共通素材設計（2026-10-14）

## 結論と作業範囲

2026-10-14のmain英語bank **914セット**（Topic 197／Interaction 112／組み合わせ495／押して聞く110）に対して、**914件のCue案とPress全110セット×3文のCue案**を再生成・全件自動監査した。英語bank・Ruri・ASR・TTS・表示UI・Androidコードは変更していない。名前プレースホルダーの利用・再導入はしない。

| 観点 | 実測・状態 |
| --- | --- |
| 英文914セットに固定IDがある | 914/914（既存ID再利用） |
| 個別の英文と意味を確認して登録した修正 | **21件**、`reviewed` |
| 未レビューの機械提案 | **893件**、`generated` |
| 明確な意味混同を検出する自動検査 | **重大違反0件** |
| 意味の追加確認候補 | **76件**（質問＋動作72、複数動作3、比喩1） |
| 「押して聞く」1文モード | 110セットの3文別Cue。異なる文文字列178種類 |
| 実装前のVisual Cue概念 | **58個**（フォールバックを含む） |
| 計画上の共通表現パーツ | **31種類**。実際の画像・動作素材は**0件制作済み** |

**「重大違反0件」は自動検査で捕捉できる特定パターンに限る。914英文全件の人手意味レビューや、Kiki実聴を済ませたという意味ではない。** 76件は `shared/visual-cue-semantic-audit.json` の `reviewQueue` に英文と理由を保存している。

## 今回確認した典型的な修正

| phraseId | 原文の要点 | 旧分類 | 修正・設計判断 |
| --- | --- | --- | --- |
| `vc_000020` | Let's say good morning | `action.wake` | 挨拶であり起床の観察ではない → `social.greeting` |
| `vc_000039` | Ready for a sip? | `action.sip` | 質問は飲む動作の確定ではない → `subject.milk` |
| `vc_000040` | A little milk. Yummy! | `action.eat` | 固形物を食べたとは言わない → `subject.milk` |
| `vc_000058` | Did you rest well? You're awake | `action.sleep` | 過去の睡眠と現在の起床を区別 → `action.wake` |
| `vc_000112` | Are you feeling upset? | `observed.cry` | 泣いていると断定しない → `social.reassurance` |
| `vc_000130` | Is that a burp? | `action.burp` | ゲップをしたと断定しない → `subject.tummy` |
| `vc_000153` | Rain on the window. Tap, tap | `action.tap` | 雨音であり赤ちゃんの指ではない → `subject.rain` |
| `vc_000368` | Diaper check / take a peek | 補助 `action.peekaboo` | 確認行為は「いないいないばあ」ではない |
| `vc_000690` | I'll stay close | `action.open-close` | closeは距離の意味 → `subject.hands` |

特に `cry` に分類された会話で、赤ちゃんの泣いている画像を無条件に描かず、優しいEmmaの安心表現を主役に変更。質問に含まれた `done?` は完了済みのチェックマークと区別する。

## 押して聞く・1文モード

`shared/visual-cue-assignments.draft.json` の各Pressセットに sentenceIndex 0/1/2 のCueを保持する。さらに **1文だけ取り出したとき、文自体に具体的な手掛かりがなければ元トピック画像を表示しない**。例：

- `Little tummy.` → `subject.tummy`（tummyと明示）
- `Turn the page.` → `action.turn-page`（動作と明示）
- `Look, look!` → `attention.look`
- `Warm and cozy.` → `emma.neutral`（抱っこを断定しない）
- 泣く話題の `Nice and gentle.` → `social.reassurance`（泣き顔を出さない）

**まだアプリの1文選択・画面描画は変更していない。** 将来の実装では選択した`phraseId`と`sentenceIndex`の両方を描画側へ渡すこと。

## 制作すべき素材を共通化

`shared/visual-cue-asset-plan.json` の候補は **14基本イラスト、10種類の小アニメーション、7種類のEmma表現（計31表現パーツ）**。パーツは「画像ファイル31個」という意味ではなく、描画コンポーネントや状態を数える設計上の単位。

- 基本イラスト：bath / milk / care / hands / feet / book / toy / outdoor / weather / meal / tummy / music / sleep / family
- アニメーション：sip / water / hand / kick / page / change / hug / peekaboo / spoon / notes
- Emma表現：neutral / smile / calm / celebrate / listen / ask / invite

同じ手の形を clap / wave / open-close / squeeze で再利用し、同じ本を read / turn-page で再利用する。泣き顔や「完了した」チェックマークは安易に割り当てない。

### 先に試作する12パターン

`action.sip`, `action.splash`, `action.clap`, `action.wave`, `action.kick`, `action.turn-page`, `subject.rain`, `action.sleep`, `observed.smile`, `social.reassurance`, `social.praise`, `dialogue.finish-check`。

仮に12パターンを試作しても全914英文対応や育児上の効果が実証されたわけではない。画像・動きの品質、端末の負荷、TTSと表示の同期は別途確認する。

## 継続的な品質担保

```bash
node scripts/build-visual-cue-data.mjs --check
node scripts/build-visual-cue-assets.mjs --check
node scripts/audit-visual-cue-semantics.mjs --check
node scripts/test-visual-cue-data.mjs
node scripts/test-visual-cue-semantics.mjs
node scripts/validate-visual-cue-data.mjs
```

`shared/visual-cue-reviewed-overrides.json` に21件の**英文原文を固定した**個別修正を保持し、今後の再生成でも保持する。原文が修正された場合は上書きして黙認するのではなく、再確認が必要として停止する。

自動のsemantic監査には新たに問題が見つかったとき失敗させる条件を含む。質問＋動作などの **76件の注意候補はCIの成功をもって人手承認済みにはしない**。全件人手確認を経た公開前ゲートは未達。

## 次の実作業

1. `reviewQueue` の76候補を、音声の印象と意味に合わせ個別に承認または修正。残りの未レビュー分にも順次確認を拡張。
2. 12パターンのイラスト・SVGや低刺激アニメーションを試作し、既存Emmaと表示位置・大きさ・表現統一を確認。
3. Webで音声イベントとVisual Cueを同期、停止・途中キャンセル・1文選択を正しく扱う。
4. Androidの同じ英文ID・素材との整合性をテストし、通信不要で動くよう配布する。

現段階では画像を生成していないため、31パーツがすでに存在するかのように表示しないこと。
