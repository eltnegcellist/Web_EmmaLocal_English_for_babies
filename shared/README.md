# Web・Android共通の話題判定データ

`lite-topic-contract.json`が唯一の編集元です。Androidリポジトリの同名ファイルは、Webのコミットを固定して取り込むコピーです。

## データの内容

- `cases`：単発発話、期待する話題、返答対象かどうか。期待値は仕様として記入し、判定コードから自動算出しません。
- `sequences`：話題の切り替え・引き継ぎ・失効・リセット。`description`を付けた列はガイドの引き継ぎ例にも表示します。
- `topics`：話題名・手がかり・呼びかけ例。すべての表示例は、同じ話題・返答対象の`cases`に登録します。
- `guide`：両版の説明。処理する場所などプラットフォーム固有の表現だけを生成時に切り替えます。
- `rules.contextFollowupTurns`：説明の保持回数。失効の会話列と両版の実装をテストで照合します。

ガイドの話題数はデータから計算します。`topics`には20の育児の話題と、飲む物を限定しない`drink`を含み、`generic`は含めません。単語の手がかりは部分的なヒントであり、単独入力すべての検出を保証するリストではありません。

## 更新手順

1. このJSONの例文・期待値・説明を編集し、`revision`を更新します。
2. `python3 scripts/generate-lite-topic-contract.py --target web`で説明ページを生成します。ページの外観は`topic-guide.template.html`を編集します。
3. `python3 scripts/test-lite-topic-contract.py`、`node test-topic-detection.mjs`、`node test-lite.mjs`を実行します。生成物の更新漏れはCIの`--check`で失敗します。
4. Webへ反映したコミットの完全なSHAを使い、Androidで`python3 scripts/sync-lite-topic-contract.py --ref <SHA>`を実行します。
5. Androidのテストを実行し、コピー・出典マニフェスト・生成されたガイドとテストデータを同じコミットで反映します。

WebのJSONや生成スクリプトだけを更新してAndroidが追随しない場合、Androidの日次CIがずれを検出します。自動で期待値を書き換えてテストを通すことはしません。

## 検証の範囲

両版は同じケースと会話列に対して、話題と返答対象判定を検証します。ガイドの全文生成チェックと表示例の判定チェックも行います。JavaScriptとKotlinの内部処理、返答の完全一致、実際の音声認識精度まで保証するテストではありません。

## English

This JSON is the canonical specification for both Web and Android topic/gate tests and bundled guides. Android vendors an immutable Web commit and verifies its contents against source hashes. Edit expected results deliberately; do not derive them from a detector to hide regressions. Generate Web help, run tests, then sync the same commit into Android and run its tests. Daily Android CI detects upstream drift. These fixtures verify text classification and context behavior, not real-world ASR accuracy or byte-identical English replies.
