# Ruri閾値再検証（研究用・本番採用不可）

結論と全数値は [日本語最終報告](../../docs/research/RURI_THRESHOLD_REEVALUATION_20261017.md)。
全入力・教師ラベルは合成かつ人手未承認。実家庭の精度を表さない。

## 再実行

Webリポジトリrootで、同梱の固定ONNX/ランタイムを使用する。
Node 26.0.0、Python 3.14.4 + NumPy 2.5.1で実行した。

```sh
npm ci --ignore-scripts
npm test
node scripts/evaluate-ruri-two-axes.mjs
node scripts/experiment-ruri-generic-rescue.mjs
node scripts/reevaluate-ruri-thresholds.mjs --refresh
python3 -m venv .semantic-research/venv
.semantic-research/venv/bin/pip install -r research/ruri-reevaluation-20261017/requirements.txt
OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 .semantic-research/venv/bin/python scripts/experiment-ruri-heads.py
node scripts/evaluate-ruri-head-experiment.mjs
node scripts/trace-ruri-critical-replies.mjs
node --test scripts/test-ruri-reevaluation.mjs
```

最初の新規スクリプトは実推論を行い、全入力のembedding/token IDを
git対象外の`.semantic-research/reevaluation-cache.json`へ保存する。
モデル・tokenizer・runtime・分類器・入力内容のハッシュでキャッシュを検証する。
生スコアは丸めず`raw-scores.json`へ保存。ポリシー比較は同じ実測スコアを使用する。

英文意味レビューは`english-meaning-review.json`のID＋英文完全一致だけを参照する。
モデルや返答が変わって一致しなければ未検査へ戻る。未検査は矛盾0件ではない。
レビューを追加・変更した場合は閾値比較とヘッド評価を再実行する。
人手審査は行っていないので`human_approved=false`を維持している。

`legacy-rescue-reproduction.json`は過去の保存artifactとの比較結果を保管したもの。
過去artifactそのものは同梱していないので、再比較には元artifactが必要。
`adoption-decision.json`と報告書は判断時点の記録であり、自動で更新しない。

## Android / Mac JVM

JDK17、Gradle9.5.0、対象Androidリポジトリを用意する。
本番Androidリポジトリを編集せず、実AIソース・既存テストを隔離ホストへコピーする。
`SemanticTopicPrediction`のデータ定義だけを元ファイルから切り出す。
Android Contextを必要とする実アプリは起動しない。

```sh
python3 scripts/prepare-ruri-android-host.py ../android
gradle -p .semantic-research/android-jvm --no-daemon test
gradle -p .semantic-research/android-jvm --no-daemon run --args="$PWD $PWD/research/ruri-reevaluation-20261017/android-two-axes.json ../android"
node scripts/compare-ruri-android.mjs
```

JDK17を自動検出できなければGradleに
`-Dorg.gradle.java.installations.paths=/path/to/jdk17/Contents/Home`を指定する。
Gradleのホームへ書けない場合は`GRADLE_USER_HOME=/tmp/ruri-gradle`などを指定。
空白を含むパスの引数は環境に合わせて引用する。

既存Android parityホストも、新規スクリプトが作る
`.semantic-research/android-web-input.json`を`--web`へ渡せる。
同梱した`android-topic-parity.json`はその既存ホストの**失敗結果**。
コマンドは非ゼロ終了する。ゲートを緩和して合格にしていない。
これはMac Native Java ORTの測定であり、Galaxy S25・APK・Android SDKの測定ではない。

## ファイル

|ファイル|内容|
|---|---|
|evaluation.json|新規150文、暫定ラベル・曖昧性・family/split・既存重複|
|raw-scores.json|既存67＋新規150の全クラス生確率、margin、モデル/ソースハッシュ|
|comparison.json / comparison.csv|A〜E全34条件、分母・gain/loss・棄却理由、全22/15クラス集計|
|predictions.json|全条件の採用軸・ルート・実エンジン初回英文|
|critical-cases.json|重点6文（既存重複も明示）の全条件出力|
|critical-repeated-replies.json|6文×5方式×20回の実返答履歴|
|english-meaning-review.json|Codexが読んだ51入力/英文組。人手承認0|
|head-training.json|新たな178学習/開発文。67＋150文を学習に使用しない|
|head-training-result.json|138学習・40開発、prior正則化3条件、選択理由・支持数|
|experimental-head-*.f32|研究用線形ヘッド。本番ファイルに上書きしない|
|head-evaluation.json|選択済みヘッドの固定評価、元スコア・採用・英文・退行|
|legacy67-reproduction.json|既存67例・17保護ルートの再現結果|
|legacy-rescue-reproduction.json|旧100例・41条件の保存artifactとの照合|
|android-topic-parity.json|既存Native parityホストの150文に対する失敗記録|
|android-two-axes.json|追加Mac JVMホストの両軸実測と実Android返答|
|android-comparison.json|全34条件のWeb/Native差と英文差|
|android-source-hashes.json|コピーしたAndroidソース・テストのハッシュ|
|android-host/Main.kt|追加研究用Mac JVM推論・返答ホスト|
|adoption-decision.json|全候補不採用、現行維持の判断記録|
|validation-summary.json|テスト結果と未実施項目|

`independent_new_holdout`は学習/較正に不使用という意味に限定する。
実発話の独立goldではない。holdout124文のうち単一暫定ラベル55文、
残り69文は一致率の分母から除外するが、生スコア・generic率・英文検査に残す。
全150文では単一ラベル77文・未確定73文。

`English_review.contradictions`はレビュー済み部分の**暫定的な矛盾・意図/時系列反転候補**。
睡眠の疑問や誘いを現在の睡眠の断定とみなす等の一律判定はしていない。
表現の人手確認・録音の試聴・実機測定・Moonshine誤認識文字列の評価は未完了。
