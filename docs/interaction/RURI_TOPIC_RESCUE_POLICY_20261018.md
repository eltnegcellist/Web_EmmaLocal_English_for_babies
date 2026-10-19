# 両軸generic時のTopic限定救済：採用実装

2026年10月18日、ユーザーが次の方式を採用した。Web/Androidの実装とテストをPRへ反映する。mainへのマージ・公開は未実施。

|段階|Topic|Interaction|
|---|---|---|
|通常の採否|確率50%以上、候補差5pt以上|確率50%以上|
|通常判定で両軸とも不採用の時だけ|**確率30%以上、候補差10pt以上ならTopicを採用**|救済しない|

最上位がgenericなら救済しない。Interactionが欠落・無効化された場合も救済しない。採用済みの軸は維持する。2分類器の確率の大小を比較せず、日本語キーワード・正規表現・単純否定ルールは導入しない。モデル・ヘッド・22/15分類、生確率、914英文・音源、Moonshine ASRは変えない。

実装はWeb `selectRuriAxes`、Android `LiteResponseEngine.respondRuri`。通常判定の後にだけ救済を行う。診断の採用理由は `topic_rescued_both_generic`、Web Topic statusは `rescued`。スコアを1や30%へ書き換えることはなく、実際の確率とmarginを保持する。

## 受け入れ根拠と残る誤り

通常170文の合成評価では、正しいTopic採用125→128、誤Topic4のまま。40%限定救済より新規/参考の3表現を追加回収できる。詳細は[30%追試](../research/RURI_GUARDED30_REEVALUATION_20261017.md)。

今回のユーザーによる方式採用は、全評価文の人手意味審査を完了したという意味ではない。暫定期待ラベルと意味レビューは人手未承認。「ママが寝不足だね」→cry、「笑っていないみたいだね」→smileなどの既知の誤りは残る。誤りを修正した、または本番の精度を測定したとは扱わない。

## 採用実装の検証

- Webで414種類を実ONNX再推論し、承認した研究規則との一致を全件確認。以前の実モデル生スコアとの差は0。
- Androidの変更した実返答エンジンも、Mac Nativeの実ONNX414文で同じ研究規則に全件一致。
- Web既存 `npm test`、研究回帰31件合格。Android由来Mac JVMテストは既存44＋新規5の49件合格。
- 既存の実ONNX99文の診断も完了し、採用経路18件の回帰を確認。「眠くないね」はsleep40.8%・差31.4ptで今回の救済対象となるため旧generic固定の検査を更新した。この経路の再現は意味の正しさの承認を意味しない。
- Web/Nativeでtoken列は414/414一致。新規202文のTopicは全件一致。既知例も含めると414文のTopic4件、初回英文6件が相違。通常50%時点のTopic差は1件で、救済対象となる数値境界で差が広がる。両プラットフォームの実装規則は同一だが、生推論の結果が全件同一になるとは保証しない。
- 「あんよをばたばたさせてるね」はWebのmargin10.3016ptで救済されるが、Nativeでは救済に必要な差を満たさずgeneric。`validation-summary.json`にスコアと差分を保存。
- Galaxy S25、保護者実録音、ASR誤認識後の文字列、連続応答の全英文バリエーションは未測定。

## 再実行と成果物

Web rootで `node scripts/validate-ruri-adoption.mjs` を実行すると、モデル/ヘッドのハッシュを照合し、保存済みの414種類を**新しく実ONNX推論**して製品コードを通す。結果は `research/ruri-adoption-20261018/web-validation.json`。学習や閾値探索は行わない。

Androidは `python3 scripts/prepare-ruri-android-host.py ../android research/ruri-adoption-20261018/android-source-hashes.json` で、変更した製品ソースと全AI単体テストをMac JVM用ホストへコピーする。JDK17でtest/runし、Web root・`android-validation.json` 出力先・Android root・`.semantic-research/adoption-android-web-input.json` を絶対パス4個として渡す。

最後に `node scripts/compare-ruri-adoption.mjs` で両環境の差分を再集計する。`validation-summary.json`は実装一致と実行環境の差を分離して記録する。従来の研究ファイルは、50%を当時の比較基準として保持している。

Web: https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/109

Android: https://github.com/eltnegcellist/Android_English_character_for_baby/pull/65
