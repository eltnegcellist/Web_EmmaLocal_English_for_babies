# みつことば多言語版・実装と検証

2026-10-19 16:15以降に着手。Webは`b2536ab`、Androidは`2358f5f`のmainから作業ブランチ`feat/multilingual-20261019`を作成。自動マージ・本番公開・リリースはしていない。研究報告はWeb Issue #115。

## 言語とモデルの動作

|表示・モード|音声入力|話題・働きかけ|
|---|---|---|
|日本語|既存Moonshine日本語|既存Ruri。元の係数・受理条件を維持|
|Deutsch / Français / 한국어 / ไทย|選択言語を指定したWhisper Small|固定多言語E5＋共有Topic/Interaction分類器|
|English · Multilingual|Whisper Smallが発話ごとに言語を自動検出し、原言語のまま文字起こし|同じ多言語E5分類器|

初回候補はブラウザ／OSの言語設定から決める。追加のIP照会、GPS、位置情報の許可要求は行わない。静的なWeb配信から利用者の国を確定する仕組みはない。候補が得られない場合も初回のSelect languageを常時表示し、選択前には準備を開始できない。保存済み選択が最優先。トップ・設定・初回画面から変更でき、選択は端末に保存する。英語のUIを選んでも入力を英語固定にしない。

初回はStart時に必要な経路だけを準備する。初回の言語選択だけではモデルを取得しない。設定やホームで変更した場合は必要なモデルをその時点で準備する。外国語間では同じモデルとキャッシュを再利用する。日本語経路へ戻る際には外国語Workerを閉じ、端末内の取得済みデータは残す。切替時に会話を停止し、世代番号・request IDで古い初期化や返答を棄却する。

日本語・ドイツ語・フランス語・韓国語・タイ語・英語の共通UIカタログをWeb/Androidで共有する。説明、初回準備、基本設定、チュートリアル、会話状態、履歴・遊びの主要操作を対象とする。既存の録音英文や実際の入力履歴をUI翻訳で書き換えない。日本語版の研究解説は保持し、外国語にはアプリの目的・端末内処理・履歴についての説明を表示する。開発者向けの既存研究診断には日本語の技術情報が残る。

## モデル・容量・取得

- Whisper：`Xenova/whisper-small` revision `2d67713f236afa48a18992566e7647f6ca848e13`。多言語モデル。taskは`transcribe`で、英語への翻訳にはしない。
- E5：`Xenova/multilingual-e5-small` revision `761b726dd34fb83930e26aab4e9ac3899aa1fa78`。研究と同じ量子化ONNX SHA256 `f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193`。
- モデル・tokenizer・設定13ファイル合計 **387,269,693 bytes（約387MB）**。言語ごとに複製しない。実行ランタイム、既存の録音音声、日本語経路、推論RAMはこの値に含めない。
- `src/multilingual/assets.json`でURL・revision・サイズ・SHA256を固定。取得後とキャッシュ再利用時に検証する。壊れたキャッシュは取り直す。進捗・準備失敗・再試行を表示する。任意の未固定モデルファイルを自動取得する経路は無効化している。
- モデル本体はGitやAPKへ同梱しない。Webの生成済みWASMランタイムと小さいFP32分類ヘッドは配布ソースに含める。
- E5は`query: `、最大512トークン、mean pooling、L2正規化。TopicはC10固定比較runの`expanded_c10`、Interactionは保存済みv2共有head。クラス順はheads/config.jsonに保存。日本語Ruriの50%等の条件をE5へ流用せず、E5だけ研究のargmax条件を明示的に適用する。新たな閾値調整や再学習はしていない。

ライセンスはE5元モデルMIT、Whisper元モデルMIT／Xenova変換モデルApache-2.0、Transformers.js Apache-2.0、ONNX Runtime MIT。帰属・ライセンスは`licenses/multilingual/`とランタイムのLICENSEへ保存。外部推論APIは使用しない。

## 実装上の重要点

Transformers.js 3.8.1は言語未指定を英語へフォールバックする実装を含むため、単にlanguageを省略して自動検出と呼ぶことはしない。Whisperの開始トークンで一度推論し、言語トークン候補のlogitから言語を選び、その言語を明示して文字起こしする。英語UIでドイツ語を与え、`de`を検出したことを実WASMで確認した。

Androidの外国語経路は、同梱したローカルWebViewの専用WASM Workerを使う。Webと同じコード・モデル・tokenizer・分類ヘッドを実行し、PCMをアプリ内ブリッジで渡す。クラウドへ送らない。日本語の既存native経路は維持。モデル準備は既存のWorkManagerへ統合し、初期化・推論をメインスレッドで待たない。WebView描画プロセスの終了を捕捉して失敗を返し、再試行できるようにする。

## 検証結果

- Web：既存`npm test`成功。追加の`test-multilingual.mjs`も成功。保存選択優先・不明言語の初回選択・6言語の表示切替・履歴原文保持・短い外国語・モデル経路・破損キャッシュ修復・再利用・古いWorker結果の棄却を確認。
- ブラウザ：実際のWhisper SmallとE5をWASMで実行。英語UIの自動検出でドイツ語合成音声を`de`と判定し、原言語の文を文字起こしした。その文をE5へ渡しmilk/inquiryと分類、既存の英語応答選択まで実行した。検証済みモデルキャッシュからWorkerの再起動も成功。英語テキストのmilk / diaper / wakeの少数動作例も実行。合成例であり自然会話の精度とは呼ばない。
- E5：同じ固定係数でもnative CPUとブラウザWASMの数値は完全一致しない。プローブのtoken IDは一致するが埋め込みに差があり、既知450文ではTopic23件・Interaction55件の判定差があった。研究のCPU表をそのままブラウザの精度として転記しない。

同じ既知v3集合・外国語5言語の実行環境比較：

|環境|Topic全体一致|具体Topic一致|generic誤付与↓|Interaction一致|両軸同時一致|
|---|---:|---:|---:|---:|---:|
|研究のnative CPU C10|76.8%|76.5%|22.2%|84.0%|57.3%|
|今回のブラウザWASM|77.9%|77.5%|21.1%|82.7%|58.7%|

ブラウザの母数はTopic375、具体285、generic90、両軸75。WASMの正答数は292、221、generic誤付与19、Interaction62、同時44。これは既知・合成・人手未審査ラベルへの一致。実行環境による差の診断で、新たな性能向上・独立test・本番品質の保証ではない。この結果を使って分類器や閾値を変更していない。

AndroidはDebug APKのビルドとJVM単体テストを実行（108件中107件成功・既存の1件スキップ、失敗0）。opt-in実機テストのKotlinコンパイルも成功。実機WebViewでの大量モデル準備・音声認識、Galaxy S25の速度・RAM・発熱、実マイクから音声再生までの評価は**この作業では未実施**。端末内WebView経路を実行するopt-inの`MultilingualRuntimeTest`を用意した。実機確認前のためレビュー用実装として扱う。

## 再現

Web：

```sh
npm ci
npm test
node scripts/build-multilingual-runtime.mjs
# 開発PCでモデルも取得する場合のみ（約387MB）
python3 scripts/prepare-multilingual.py --download
python3 scripts/serve-semantic-test.py --port 8879
```

`index.html`でUI、`multilingual-test.html`で開発用検証を確認する。後者のローカル研究用fixtureは`.multilingual-test-results/`に別管理し、GitやAPKへ入れない。ブラウザ実測の元JSONは作業workspaceの`outputs/multilingual-browser-*.json`に保存。

研究データを保持する環境では、numpyの入ったPythonで次を実行して既知450文と少数プローブを書き出せる（再学習・外部推論なし）。token IDの参照値は任意で、出力される実token IDを確認できる。

```sh
python3 scripts/export-multilingual-check-fixtures.py /path/to/outputs/multilingual-next
```

Whisper確認には`.multilingual-test-results/german.wav`に16kHzのドイツ語音声を用意する。今回使った合成文は`Die Milch ist bereit. Möchtest du etwas trinken?`。Macでは`say -v Anna -r 150 -o .multilingual-test-results/german.wav --file-format=WAVE --data-format=LEI16@16000`にこの文を渡して生成できる。録音音声をGitへ含めない。英語の分類は3例の動作確認にとどまり、英語を含む全言語の独立精度評価・人手レビューは未実施（0件）。英語UIの画像はWeb側の`docs/screenshots/multilingual-onboarding-en.png`。

Web側変更をAndroidへ同期：

```sh
node scripts/package-multilingual-android.mjs ../android-multilingual/app/src/main/assets/multilingual
```

Android：既存のAndroid SDK・JDKを設定し、`gradle :app:assembleDebug :app:testDebugUnitTest :app:compileDebugAndroidTestKotlin`を実行。実機のopt-inテストは`multilingualModels=true`をinstrumentation引数に渡す（初回約387MBの取得を伴う）。公開APKや既存署名鍵は変更しない。

依存監査では新規導入したNode用sharpを0.35.5に固定してhighを解消。Node側の間接依存にmoderateが5件残る。これらのNode用ダウンローダ／ロガーは静的なブラウザ配布バンドルに含めない。未検証の大規模SDK更新で解消済みとは扱わない。

旧研究353ファイルと保護対象PCM482件をSHA256で再点検し、変更0件。日本語モデル・録音英文や収録音声に差分はない。検証集計はworkspaceの`outputs/multilingual-implementation-validation.json`。Android実機のモデル取得・キャッシュとマイク処理の確認を、製品リリース前に残る作業として扱う。
