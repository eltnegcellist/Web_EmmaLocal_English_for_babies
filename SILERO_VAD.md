# Sileroによる発話開始・終了検出

設定の「話し終わりの判定」で「声で判定（Silero）」と「音量で判定（従来）」を切り替えます。初期値はSileroです。選択は端末内に保存し、次の会話から適用します。Androidでは会話を止めてから切り替え、Webでは切替時に会話を停止します。

Moonshine Japanese Smallのモデル・推論設定を変更せず、VADの開始・終了判定を追加します。Sileroの入力は推論専用のコピーです。録音へノイズ除去・音量補正・AGC/AECを追加せず、既存のASR向け音声変換を維持します。従来RMS VADの閾値・計算は変更していません。

## モデルと終了方針

- 公式Silero ONNX、MIT、2,327,524 bytes（約2.33 MB / 2.22 MiB）。
- 固定リビジョン `1e261b036686cd0017d500ee96acd1c4ba572a9d`。
- SHA-256 `1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3`。
- 16 kHz、512 samples/frame（32 ms）、64 samples context、recurrent stateを継続。
- 開始確率0.5、発話中0.35、開始確認160 ms、最小有声450 ms。
- 終了待ち1,100 ms。32 ms単位なのでモデル上の確定は最短1,120 ms。実際の返答には録音ブロック・推論・既存の約140 msの後続取得時間が加わります。
- 短い暫定発声は700 msで取り消し。音量低下だけで終了させません。
- 約0.55秒の開始前音声を保持します。発話中の確率判定が遅ければ、冒頭を取りこぼす可能性は残ります。

モデル準備時にSHA-256を検証します。準備できなければ従来RMSへ戻して通知します。推論途中でエラーになった場合は会話を停止し、設定から従来方式で再開できます。Sileroは話者識別ではないため、周囲の人の声やアナウンスも音声として検出することがあります。

## 検証範囲

提供された浴室10発話・静音10発話・背景音のみ2区間を、実ONNXモデルで再生しました。Web WASMとAndroid相当のJava ONNX Runtimeの双方で各発話の開始・終了を検出し、背景音2区間では開始しませんでした。Webで切り出したPCMは元波形の対応区間と一致し、Javaでも入力PCMが変更されないことを確認しました。これらは同じ録音に対する実装確認で、会話成功率・CERの改善率を測り直したものではありません。

発話境界は以前のベンチマークでモデルと波形から推定したものです。正確な聴取注釈ではなく、Silero由来の評価バイアスがあります。浴室の一部では推定開始より後から音声を保持するため、開始・終了イベントが出たことを全文認識の保証として扱いません。静音でのASR非劣性や全話者・全環境の安全性は未証明です。

既存ベンチマークでは同一PCMでもMoonshineの結果が変動しました。単回CERの僅差は採用根拠にしません。1.1秒は待ち時間比較から選んだ候補で、アプリ実装でCERが改善したと断定しません。Android実機のマイク・CPU負荷・画面オフ会話と、Safari/iOSなど各ブラウザでの確認は別途必要です。

個人の録音・分割WAV・モデル実行結果に含まれる会話音声はGitへ追加しません。ライセンスと固定モデルの由来はモデル横の `model-provenance.json` に保持しています。

## Web実装と実行

専用Module WorkerがローカルのONNX Runtime Web 1.30.0（既存Semantic用配布物）で推論します。主画面でモデル推論しません。モデルは `assets/vad/` に同梱し、初回のSilero会話で取得します。Cache StorageへSHA-256付きキーで保存し、読み出すときも検証します。別CDNへの依存を追加しません。

追加モデルは約2.33 MBですが、Semantic用runtimeを未取得の場合は、その既存JS/WASM配布物も約14 MB読み込みます。「Silero導入の初回通信が必ず2.33 MBだけ」とは扱いません。従来方式を選ぶとSilero Workerを起動しません。

録音のAudioContext sample rateからVAD解析用16 kHzへの変換は連続した位相で行い、ASRへは元の波形区間を既存のresamplerで渡します。workerの古い応答はepochで捨て、TTS/ASR処理中の音声を次の発話に混ぜません。停止時はWorker・MediaStream・AudioContextを片付けます。設定はLocal Storageの `emma_endpoint_mode` に保存します。

```sh
npm ci --ignore-scripts
python3 scripts/verify-silero-assets.py
npm test
npx playwright install chromium
VAD_BROWSER_CHANNEL=chromium npm run test:vad-browser
```

Nodeテストは終了方針、16/44.1/48 kHzの分割入力resampling、未加工PCM、遅延返信の破棄、後続取得、初期化中の停止、従来方式を検証します。ブラウザテストは本物のWASMモデルによる無音推論、モデル404時の従来fallback、設定保持、Small維持を確認します。

非公開ベンチマークのmanifestを指定すると分割WAVを同じWASMへ適用します。入力は16 kHz mono PCM16です。生成物はGit管理外の `tests/generated/silero/` に保存します。

```sh
VAD_TEST_MANIFESTS=/absolute/benchmark/expected/bathroom.json,/absolute/benchmark/expected/clean.json npm run test:vad-browser
```

本番公開は既存のmain CI → `chore/trigger-pages` 同期で行います。作業ブランチからPagesを直接公開しません。
