# 日常の呼びかけ理解 PR-A / PR-B 実装・実測レポート

更新：2026-10-12。**本番機能には未接続**。分類器の学習と検証までを完了した実験です。

## 開発対象とスコープ

- 新しい Interaction は14分類：`affection`, `praise`, `achievement`, `effort`, `encouragement`, `invitation`, `start`, `finish`, `finish_check`, `care`, `inquiry`, `reassurance`, `repeat`, `pause`
- 分類器には拒否用 `none` を含む15クラス。
- `sleep`, `wake`, `cry`, `smile` は現行Topic側で初回リリース対象とする。新ヘッドではこれらを `none` 側にし、**既存Topicで判定できなくする意味ではない**。
- 夜泣き・笑顔・起床等を後回しにするものではない。英語ライブラリを準備するPR-Cは別作業。
- 既存のTopic（21育児話題＋generic）、最大1ターン保持、Ruri ONNX、Silero、Moonshine、Kitten、Android Fullは変更しない。

## PR-A：分類データ整備（確定・未確定を区別）

- `shared/interaction-taxonomy-draft.json`: 14分類の意図・境界・日本語例、既存分類との違い、否定・疑問・衝突例。
- `scripts/build-interaction-experiment.mjs`: GitHub内の暫定分類と既存 `shared/lite-topic-contract.json` から再現可能な分類実験データを生成。
- `research/interaction-head/experimental-dataset.json`: **383件**を出力し、**train 250 / dev 70 / test 63**へ振り分け。各新カテゴリのtrainは8～9例、devとtestは各2例。既存Topicと無関係発話を `none` として追加。
- 分割時は文字列重複を避けたが、**同じ人が手作りした近い言い換えが複数分割にまたがる**。これを実家庭での一般化能力とはみなさない。
- 以前作成した日本語候補2,212件（Phase0 v3）は候補であり、正解ラベルの第三者審査は済んでいない。今回のGitHub実験は**その2,212件をそのまま学習したものではない**。少数の暫定例文と既存Topic契約で動く最初の実験である。
- したがってPR-Aの**分類仕様の暫定固定と実験用データ作成は完了**。**人手審査による正式な教師データ確定は未完了**。後続の本番採用前に必須。

## PR-B：実際のモデルによる学習

`scripts/extract-interaction-embeddings.mjs` はGitHub管理のRuri v3 70M INT8 ONNX (SHA256 `bd500193003fdeaba8c5422a47b974b40b49a5e0c91285c76f6bd949d2205264`) から **本物の384次元埋め込み**を推論します。Webと同じTokenizer、ONNX Runtime WASM経路を使用します。偽のEmbedding、別のモデル、Gemmaのオンライン呼出しはありません。

`scripts/train-interaction-head.py` では384次元×15クラスのLogisticRegressionを学習。trainのみで係数を推定し、devのみで正則化係数と棄却閾値を選び、**testは最後の評価時まで使用しません**。生成した15×385 FP32の係数を `research/interaction-head/artifacts/head-interaction.f32` に保存します。実行時に必要なヘッドのサイズは**23,100 bytes**（Ruri既存モデルは除く）。

### 実測値（実験用に作成した日本語テキストのみ）

| 指標 | test結果 |
| --- | ---: |
| test件数 | **63件** |
| 全15クラスの予測正解 | **57/63 = 90.48%** |
| 14種類のInteraction macro F1 | **0.8762** |
| Interactionとして採用した予測の正解率 | **24/26 = 92.31%** |
| Interaction予測の正解再現率 | **24/28 = 85.71%** |
| 既存Topic等のnoneサンプルからの誤発火 | **2/35件** |

採用パラメータ：`C=30`、`threshold=0.40`、`margin=0`。この値は**devの小さな候補群にのみ最適化した暫定値**で、運用上の信頼度・精度保証ではありません。クラスごとのtestは2件しかないため統計的な誤差が非常に大きいことを必ず併記してください。

### 実測で判明した誤分類・見逃し（分類定義の再確認後）

- `できるところまでね`（encouragement）→ none
- `準備はいいかな`（start）→ none
- `頑張ったんだね`（care）→ none
- `なにかあったの`（inquiry）→ none
- `ぎゅっと抱きしめよう`（既存hug）→ affection
- `いっしょに遊びましょうね`（既存play）→ invitation

別の31例の**参考用**否定・疑問・話題混合確認は30/31一致。ただしこれらは一部学習例を含むため独立テスト精度に算入しない。

- `大丈夫？`（inquiry）→ inquiry。問いかけと安心の違いを学習例で補強して改善した。ただし学習例が含まれる診断のため独立成果ではない。
- `寝返りできたね`（achievement想定）→ none（低優先の発達段階特有例）

現行テストでは `寝返りできたね` のみ未一致。31例の全結果は `research/interaction-head/artifacts/contrast-report.json`。

## 本番へ直接入れてはいけない理由

1. 新Interactionクラスにはtrain8件、test2件しかない。前回の2,212件の全例を人手で正解確認したデータではない。
2. 文字起こし結果の誤り、ノイズ・中断・断片、短い発話、方言・発話者差は今回未測定。
3. タスクは「話題Topic」と「呼びかけInteraction」の二軸だが、独立ヘッド同士のsoftmaxスコアを直接大小比較してはいけない。
4. `ミルク飲もうか`、`おむつ終わったね`、`絵本を読もうか`等、**明示的な既存Topicを先に保護**する応答調停が未実装。
5. 賞賛・愛情等の分類結果は、直前Topicが1ターン残っていても明示的な現在の言葉を優先する必要がある。
6. `finish_check` の「終わったかな」を完了と断定した英語にするのは禁止。否定、疑問、未達成のハードネガティブを追加する。
7. 既存intent/stateの研究用headに代わる本番採用を決めるには、再学習後の独立比較が必要。
8. **誤った感情・健康の断定や泣き止ませる命令**が新しい英文に含まれないことのPR-Cによる別検証が必要。

## ファイルと再実行方法

```sh
npm ci --ignore-scripts
node scripts/build-interaction-experiment.mjs
node scripts/extract-interaction-embeddings.mjs
python3 -m pip install 'numpy>=1.24,<3' 'scikit-learn>=1.5,<2'
python3 scripts/train-interaction-head.py
node scripts/evaluate-interaction-contrasts.mjs
```

CIは `.github/workflows/interaction-experiment.yml`。再現性はRuriモデルSHA、入力データ、コードとCI結果から追跡する。自動で本番資産マニフェスト `src/semantic-assets-manifest.json` に新headを追加**しない**。既存の英文やUIもこのPRでは変更しない。

**現段階の結論**：実ONNXによる訓練と小規模な独立テキスト評価のパイプラインは動作。閾値込み実験headを作成済み。新分類が既存Topicを上書きしないようにするPR-D/Eは、正式ラベルと独立評価の強化後に行う。PR-CのGemma英文作業は本工程と並行して継続可能。
