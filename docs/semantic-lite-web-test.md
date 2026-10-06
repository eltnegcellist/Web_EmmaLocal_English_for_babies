# みつことば Semantic Lite Webテスト版

2026-10-06。既存WebアプリにRuri v3 70M INT8の話題判定を追加したローカルテスト版です。追加の精度研究は中断し、現在のINT8候補を機能として組み込んでいます。公開サイトには反映していません。

## 使い方

実アプリは `http://127.0.0.1:8765/index.html`。設定の「Semantic Lite テスト」で「意味で話題を判定する」をオンにします。追加データ約93MBを準備すると、音声認識後の話題判定に利用できます。通常の音声会話には既存のMoonshineとKittenの準備も必要です。

初回画面の「Semantic Lite テスト版を文字で試す」、または `http://127.0.0.1:8765/semantic-test.html` から、音声モデルなしで話題と既存英文を試せます。文字テストで選んだ話題は通常アプリの会話文脈へ持ち越しません。判定方式の設定は同じブラウザに保存します。

- **意味で判定**: 70Mの話題判定を使う。候補差が小さければgenericへ戻す。有効時の既定方式。
- **既存ルールを優先**: 既存ルール／文脈の具体的話題を使い、不明な場合に70Mで補う。
- **従来Lite**: 従来の話題判定を使う。

モデルが取得できない場合、推論に失敗した場合、入力が128tokenを超える場合は、従来Liteから返答します。「モデルを準備・再試行」で再開できます。「中止」は機能をOFFにし、準備・判定を止めます。

機能の初期値はOFFです。有効にすると親の日本語→70Mの話題→既存Lite英文→既存TTSという実アプリの処理になります。英文は生成しません。intent/stateは比較画面の参考表示だけで、英文選択には使用しません。表示の分類スコアは正解を保証する確率ではありません。

## ローカル起動と同梱パッケージ

この資料が `TEST-README.md` として配布フォルダーにある場合は、同じフォルダーの `Start Test.command` を実行するとlocalhostサーバーが起動し、ブラウザが開きます。Python 3が必要です。終了はサーバーのターミナルでCtrl-Cです。

開発リポジトリでは次のコマンドで起動します。

```sh
npm run serve:semantic
```

資産・依存関係がすでに揃っているこのMacでは、そのまま起動できます。新しいチェックアウトから準備する開発者向けの手順は以下です。モデルの元パッケージは引数で指定できます。

```sh
npm ci --ignore-scripts
npm run prepare:semantic -- /path/to/ruri70-int8-browser-candidate
npm run package:semantic
```

同梱先は `dist/semantic-lite-test/`。モデル、tokenizer、head、WASM/JS実行資産、既存アプリ、ライセンスを含みます。Git管理外のモデル資産を含むため、Git checkoutだけでは実行資産は揃いません。prepareは元モデルのSHAを固定し、packageは全Semantic資産のサイズとSHAを確認してコピーします。公開は行いません。

## 実装と既存の測定結果

元モデル: `cl-nagoya/ruri-v3-70m`、revision `07a8b0aba47d29d2ca21f89b915c1efe2c23d1cc`。

モデルSHA256: `bd500193003fdeaba8c5422a47b974b40b49a5e0c91285c76f6bd949d2205264`。グラフ71,248,404 bytes。INT8 token行・INT8 MatMul重みを使用し、一部演算はFP32です。元検証のLR係数、prefixなし、topic threshold 0、margin 0.05を保持しています。

専用module Worker上でONNX Runtime Web 1.30.0のWASMを使用します。入力をクラウドへ送信しません。資産はSHA256で確認してブラウザ内へ保存します。tokenizerは `@huggingface/tokenizers` 0.2.0とUTF-8 byte fallbackを使います。

検証停止時の既存測定では、独立したtopic test198件でMac Semantic単独192件正解（97.0%）、Chrome WASM189件正解（95.5%）でした。モデル内の数値差は未解決です。Webで97.0%を再現したと説明しないでください。この実装工程では追加の精度比較・閾値調整・再学習を行っていません。

intent/stateはMacとWebで差があり、実用応答の条件には採用していません。ブラウザ・端末ごとの精度や実録音の性能は保証しません。

## 動作確認の範囲

実装の確認には既存CI相当のテストと少数の実画面操作だけを用います。新しい精度ベンチマークは行いません。文字入力の実WASM推論、固定英文への接続、設定切替、モデル欠落fallback、オフラインの保存済みモデル、スマホ幅を確認するスクリプトは `npm run test:semantic-browser` です。Chromeが必要です。

音声認識結果を扱う実アプリの経路には接続済みですが、この工程で実マイクの録音から発話までの実機テストは行っていません。既存ASR/TTSのテストと、新しい文字入力の接続確認を区別してください。

実装ブランチは `experiment/semantic-lite-web-test`。main merge、Release、push、外部公開は行っていません。ライセンス原文・帰属は `licenses/semantic/` と `THIRD_PARTY_NOTICES.md` に保存しています。

2026-10-06の機能確認は通過しました。実画面・3方式切替・中止／再試行・資産欠落時の復帰・保存済みモデルのオフライン実行・390px幅を確認済みです。既存npm test、shared contract、構文チェック、diffチェックも通過し、npm auditは0件でした。確認記録は `semantic-lite-web-functional-checks.json` です。
