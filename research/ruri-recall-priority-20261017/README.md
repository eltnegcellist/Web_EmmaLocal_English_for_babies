# 取りこぼしを優先した閾値再検証

2026-10-18、ユーザーが30%限定救済を採用し、[製品コードへの実装・検証](../../docs/interaction/RURI_TOPIC_RESCUE_POLICY_20261018.md)を追加した。以下は採用決定前の研究経緯。

追加の[30%・差10pt限定救済の追試](../../docs/research/RURI_GUARDED30_REEVALUATION_20261017.md)も参照。ユーザー提案を追加の試用候補として比較した。通常群で40%よりさらに拾えるが、主語違い等の追加リスクがあり、本番採用は未確定。

[日本語報告書](../../docs/research/RURI_RECALL_PRIORITY_REEVALUATION_20261017.md)
が最新の研究上の推奨。前回の「50%固定を維持」を見直し、
**通常は既存50%の判定を使い、両軸generic時だけTopic40%・差10ptで救済**を第一候補とした。
Interactionは50%を維持し、救済で付け足さない。本番コードには接続していない。

## 再実行（Web root）

```sh
node scripts/evaluate-ruri-recall-priority.mjs --refresh
node scripts/analyze-ruri-recall-tradeoffs.mjs
node scripts/evaluate-ruri-guarded30.mjs
node --test scripts/test-ruri-guarded30.mjs
node --test scripts/test-ruri-recall-priority.mjs
node --test scripts/test-ruri-reevaluation.mjs
npm test
```

Node26.0.0、実際に同梱されたRuri ONNX/ヘッド/WASMを使用。
新規202文は全件実推論。head再学習・productionの値の変更はしない。
実embeddingはgit対象外の`.semantic-research/recall-priority-cache.json`へ保存する。
モデル・tokenizer・runtime・分類/返答ソース・入力内容のハッシュで再利用を管理。
`--refresh`で再推論する。全スコアは非丸め値で保存。

レビュー用作業リストは`.semantic-research/recall-priority-review-template.json`。
保存した`english-review.json`は217組すべての実初回英文をCodexが読んだ暫定判定。
人手承認ではない。入力ID＋英文完全一致がないものは未レビューとして扱い、
損失を0に置き換えない。意味判定を変えたら両分析スクリプトを再実行する。

## データと重み

- 新規202文：通常170、予定/過去等12、自然な否定/未成立20。
- 前回67＋150文と前回実験171学習文との完全一致は0。
- 普通の観察への同じ話題の誘いや、否定された話題の採用自体を失敗扱いしない。
- Topic/Interactionのラベル一致と実英文の適切さは別集計。
- 既知131文は前回の非negativeカテゴリ/単一ラベル文を重複除去して参考再解析。
  作者が以前のスコアを知るため、新規の独立検証と混同しない。
- 参照131文は変わる英文34組を審査。変化しない英文の方式間差は0で、
  絶対的な英文適切率を推定したものではない。
- 否定頻度0/1/3/5/10/20%、予定等0/5/10/20%、誤応答コスト1/2/5/10、
  軽微ずれ0.25/0.5、通常群での参照セット比重0/25/50/75/100%。
  頻度・コストは仮定。ケース件数から実家庭の出現頻度を推定しない。

## Android / Mac JVM

JDK17・Gradle9.5.0と隣接するAndroidリポジトリを使用する。
前回の研究用ホストを拡張し、入力ファイルを第4引数で指定できるようにした。
Android本番ファイルは編集しない。実Android返答エンジンで50%/限定45%/
限定40%・差5pt/限定40%・差10ptを測定。

```sh
python3 scripts/prepare-ruri-android-host.py ../android
gradle -p .semantic-research/android-jvm --no-daemon test run --args="$PWD $PWD/research/ruri-recall-priority-20261017/android-two-axes.json ../android $PWD/.semantic-research/recall-priority-android-web-input.json"
node scripts/compare-ruri-recall-android.mjs
```

JDKを自動検出できない場合はGradleへ
`-Dorg.gradle.java.installations.paths=/path/to/jdk17/Contents/Home`を指定。
空白を含むパスは適切に引用する。Mac JVMの推論・実ソース44テストの結果であり、
Galaxy S25やAPK、ASR、実マイク経路の測定ではない。

## 成果物

|ファイル|内容|
|---|---|
|design.json|推論前に決めた文数・比較範囲・重みの仮定。外部事前登録ではない|
|natural-evaluation.json|202合成文、暫定ラベル、許容ラベル、3層の区分|
|raw-scores.json|実ONNX/既存ヘッドの全クラス確率・margin・資産ハッシュ|
|predictions.json|42方式の実初回英文。重複する出力をindexで共有|
|english-review.json|新規217入力/英文組の暫定意味判定、人手承認0|
|comparison.json / .csv|3層と全体のラベル指標・英文指標、margin/確率42方式|
|frequency-cost-scenarios.json|新規セットの頻度・損失192条件|
|reference-ordinary.json|既知131文の事後的な参考比較|
|reference-english-review.json|既知で変わる34入力/英文組の暫定判定|
|reference-paired-changes.json|既知131文について変わった英文・前後判定|
|sampling-cost-sensitivity.json|参考セット比重も変えた960条件の現行との差|
|additional-error-budget.json|未測定の追加誤応答率をどこまで許容できるかの境界|
|android-two-axes.json|202文のMac Native生確率と実Android返答・救済返答|
|android-comparison.json|現行・候補のWeb/Native差分|
|recommendation.json|最新の研究推奨。production変更/人手承認を意味しない|
|guarded30-comparison.json / .csv|ユーザー提案の30%限定救済と現行/40%の比較、追加81文の注意例|
|guarded30-stress-review.json|追加81文で変わった初回英文9組の暫定レビュー|
|guarded30-android-two-axes.json|30%限定救済も含む202文のMac Native実推論・Android実返答|

既存の否定反転を消したとは主張しない。50%でも起きる共通の誤りと、
今回の救済で新たに生じる誤りを分ける。「一件でも誤ったら50%」という拒否基準は使わない。
正しいTopicでも全英文バリエーションが安全という意味ではなく、今回の意味比較は初回英文。

人の実録音・人手審査の非公開メモ・端末ログはGitHub/CIへ送らない。
CIはここにある合成ファイルだけで実ONNX推論と両研究回帰を再実行する。
