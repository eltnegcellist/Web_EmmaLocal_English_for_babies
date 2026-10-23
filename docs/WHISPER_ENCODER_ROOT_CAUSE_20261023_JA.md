# Whisper Small q8 / Galaxy S25: Encoder遅延の原因分析 (2026-10-23)

## 目的・固定条件
Web版 English · Multilingual、Whisper Small q8 CPU/WASM、端末実測に基づいて性能を判断する。発話言語はモデル選択の理由にしない。3スレッドか4スレッドかの設定追跡は優先しない。

### 実測値（ユーザー提供・2026-10-23T03:18Z診断）
単位ms。言語判定有無が異なるため、文字起こし時間と全ASR時間を分ける。

| 入力秒 | 初回言語判定ms | 文字起こしms | 内Encoder ms | 内Decoder ms | 他ms | 総ASR ms |
|--:|--:|--:|--:|--:|--:|--:|
|4.72|7866|9127|7669|1312|146|16994|
|7.46|10571|10484|8731|1529|224|21055|
|9.72|10252|10610|8979|1445|186|20862|
|2.64|0|7454|5842|1432|180|7454|
|3.86|0|7869|6371|1157|341|7869|
|6.53|0|11122|8823|2140|159|11122|

- `medianTranscribeMs=9806`、`medianEncoderMs=8200`、`medianDecoderMs=1439`。
- 合計時間として記録された最終発話の `multilingual.asrElapsedMs=13705` に対しWorker内部の `totalMs=11122` は **2583ms差**。キュー待機/通信/初期化/メイン側待機等の分解がまだ必要で、原因未特定。
- `languageMs` が有る3回は最初の数回の言語判定と文字起こしでEncoderが二重実行。現行Workerの `detectLanguage()` が最初の `model({...features,decoder_input_ids})` を実行し、その後 `recognizer(audio,...)` が `model.generate()` を行うため。6回すべて同じ会話だったかは不明、会話終了時に言語判定キャッシュをリセットする仕様。
- `whisperDecoderRuns` は5～14回。モデル推論時間の大半は **1回のエンコーダー呼び出し**。token cap 80→24やスレッド微変更だけでは解決困難。

## コード・モデルの根拠
- Worker: `src/multilingual/worker.js`。初回に `detectLanguage(audio)`、直後に通常の `recognizer(audio)`。
- Model assets: `src/multilingual/assets.json` の `Xenova/whisper-small` q8 (encoder ~92.3MB / decoder ~156.8MB)。
- 事前処理設定に `n_samples=480000`, `nb_max_frames=3000`, `chunk_length=30`。16kHz × 30秒。2～10秒の短文でもEncoderへ30秒分のmel特徴を入力する（通常経路）。
- Transformers.js 3.8.1 `AutomaticSpeechRecognitionPipeline._call_whisper` がprocessor→model.generateを実行。
- 型の仕様上、単に前処理の無音を削除して既存ONNXに入力する対応は危険。固定テンソルshapeだけでなく、非標準の短い窓でモデル精度が大幅に落ちる例がある。

Sources:
- https://huggingface.co/Xenova/whisper-small/blob/main/preprocessor_config.json
- https://github.com/huggingface/transformers.js/blob/v3.8.1/src/pipelines.js
- https://github.com/huggingface/transformers.js/blob/v3.8.1/src/models.js
- https://github.com/futo-org/whisper-acft
- https://huggingface.co/litert-community/whisper-acft
- https://github.com/google-ai-edge/LiteRT/blob/main/litert/js/README.md

## 効果の概算（実測ではなく推定）
- 最短実測でもEncoder 5.84秒+Decoder 1.43秒。他の全処理が0msになってもEncoderが残る。
- 理想的に3→4スレッドへ完全線形に伸びても、中央値8.2秒のEncoderは最低6.15秒。現実にその伸び率は保証されない。
- 初回言語判定と文字起こしの**Encoder結果共有**で約6～10秒の重複計算を節約できる余地（初回のみ）。毎回の認識8秒以上の問題は残る。
- 3秒以内で返答するには、従来のDecoder+その他が約1.5秒とすればEncoderを1.5秒以下にする必要がある。中央値8.2秒から**約5.5倍**の削減が必要。
- 2秒以内を目標にするなら、さらに厳しい。速度の余裕を確保するため、原則としてモデルアーキテクチャも候補にする。

## 主な方策と優先順位
1. **30秒固定Encoderの短窓化（最優先）**。FUTO ACFTは5/10秒のaudio contextを想定して訓練されたWhisperで、6言語共通モデルという性質を保持。LiteRT communityは固定5秒/10秒/30秒のTFLiteを公開。現行Whisperの重みとそのまま交換できず、TensorFlow Lite / LiteRT.js のWASM CPU実装、Mel前処理、Tokenizer、言語トークン、長音声の窓選択・結合が必要。
2. **Encoder結果共有（初回）**。1回のEncoder演算から言語判定用Decoderと文字起こしDecoderを呼び、重複計算を防止。Transformers.jsの `model.forward_params` に `encoder_outputs` が含まれていないことに注意し、実験用Workerで独立したONNX経路を検証してから採用。処理後にTensorを解放、テキスト同等性・言語判定を確認。
3. **モデルサイズ比較**。ACFT small/10s, ACFT small/5s, ACFT base/10s, ACFT base/5s を候補にする。5秒を超える発話は10秒モデルへ切替。各窓の音声切り捨てと精度悪化が起きないことを確認。
4. **既存WASM vs ネイティブ**。Web互換を重視しLiteRT.js CPUで実測。AndroidネイティブLiteRT等との速度差も参考値として測る。
5. **他構造**。SenseVoice Smallは高速だが、対象6言語のすべてはサポートしない。Whisper Base通常版に下げるだけでは30秒窓問題は残り、精度悪化の可能性もある。新しい大型モデルは速度とRAMが不透明。
6. **付帯する待機時間**。Worker内部とmain-thread `asrElapsedMs` の差を計測し、ASR受付/キュー/IPCを切り分ける。背景音声DLの有無と温度も比較。

## 合格条件（提案であり保証値ではない）
- Galaxy S25 Chrome上で3～5秒発話の認識中央値3秒未満（理想2秒以下）、初回の言語判定込みでも短い会話として成立すること。
- 「ミルク飲もうね」など同一発話10回＋別の20種類以上の短文で誤認識/幻覚を記録。短窓やbaseへの変更は精度が悪化する恐れがあるので、単なる速さで採用しない。
- 発話6～10秒は10秒窓やチャンク結合で内容が欠落しない。必要な全言語で自動言語判定を維持。
- 初回モデルDL・ディスク容量・ピークRAM・温度も比較。テスト版のみで実施し、production mainに反映しない。

## 現段階の判断
現行Whisper Small q8・30秒入力のWeb CPUは、10秒前後の文字起こしという実測のため、実用候補としての優先度が低い。単なるスレッド数変更より**短窓対応モデル＋専用高速CPUランタイム**のA/Bを優先する。GPU/WebGPUは今回の主計画に入れない。実機実測前に倍速や精度を約束しない。

## 2026-10-23 ACFT専用CPU Encoder実測ページ
- `whisper-acft-benchmark.html` を実験ブランチの独立ページとして追加。LiteRT.js 2.5.3 CPU/WASM、GPUなしで `litert-community/whisper-acft` Base 5/10秒とSmall 5/10秒の4構成を測る。
- Modelを直接Hugging Faceから読み込む。CORS等で取得できない場合は選択モデルと同じファイル名のローカル `.tflite` をアップロードして計測できる。モデル取得には100～275 MB程度が必要。
- Encode signatureをモデルから確認し `[1,80,500]` または `[1,80,1000]` の合成（非音声）log-mel特徴を投入。ウォームアップ1回＋5回実測の中央値のみ表示。Decoder/音声認識/言語自動判定/総ASRはこのページでは一切測らず、旧Encoder中央値8200msはモデル・ランタイムの違う参考値であると明記。
- `test-acft-encoder.mjs` はモデルURL選択、テンソルshape、計測値の中央値、WASM-onlyルーティングをテストする。**実機のLiteRTモデル推論成功や精度を証明するものではない。**
- 推論の実機成功が確認できた後、次段階として `decode` signature、log-mel抽出、トークナイザー、言語自動判定を実装し、実音声を使って認識速度・文字起こしの正確性を比較する。

## 2026-10-23 LiteRT.jsブラウザ動作の修正（v3）
Galaxy S25のBase/5秒実機テストで、(1) Module WorkerでEmscripten `importScripts` 非対応（v2でClassic Worker化して解消）、(2) `WebAssembly.instantiate` で `expected magic 00 61 73 6d, found 3c 21 44 4f`（`<!DO`、HTMLの先頭）が出た。v3ではWASMのバイナリ取得先を単にSDKへ渡すだけでなく、`self.Module.locateFile` をCDN配布ディレクトリへ明示して、Worker URL（Pages内）基準の誤った相対解決を避ける。さらに `litert_wasm_internal.wasm` と `litert_wasm_compat_internal.wasm` に Range要求を送り先頭4byteのmagicを検証、jsDelivrが無効ならunpkgを検証して代替する。

`scripts/browser-acft-classic-smoke.mjs` は本物のChromium Workerで`runtime-smoke`を実行する（モデル取得不要のWASM初期化まで）。UI本体は異常時に`stage`と具体的なURL/バイナリ先頭文字を表示する。WASM起動成功≠ACFTモデル実機推論成功である点は引き続き注意。

検証根拠: LiteRT.js `load.ts` は`createWasmLib`にJSパスを渡し、`wasm-utils/wasm_loader.ts`の`createWasmLib` は`self.Module`を`ModuleFactory`に渡す仕様。
- https://github.com/google-ai-edge/LiteRT/blob/main/litert/js/packages/core/src/load.ts
- https://github.com/google-ai-edge/LiteRT/blob/main/litert/js/packages/wasm_utils/src/wasm_loader.ts

## Galaxy S25実機のACFT Encoder速度（2026-10-23 JST）
ユーザー提供の実測。Chrome 155、LiteRT.js 2.5.3 WASM CPU、合成log-mel、各5サンプル。**文字起こし精度やDecoderは未測定**。

| Model | 5サンプル (ms) | Median (ms) | モデル取得・準備 (ms) |
|---|---|---:|---:|
| ACFT Base 5秒 | 174.21, 174.64, 174.53, 175.41, 178.87 | 175 | 33457 |
| ACFT Small 5秒 | 898.62, 897.80, 897.58, 897.41, 897.55 | 898 | 25316 |
| ACFT Small 10秒 | 1635.26, 1640.89, 1656.56, 1679.02, 1678.79 | 1657 | 27575 |
| 従来 Xenova Whisper Small 30秒 | 旧診断における実音声のEncoder計測 | 8200 | モデル準備は別 |

短い発話ではACFT Small 5秒でもEncoder中央値が旧方式の約1/9.1である。ただし**モデルの重み、時間窓、ランタイム、特徴量入力が異なるため、厳密な同条件速度比ではない**。ACFT Small 10秒は5秒に比べ約1.85倍のEncoder時間。6秒以上の発話を5秒窓で単純に切り捨てると認識内容が欠けるため、音声長に応じて別窓またはオーバーラップチャンクを使う必要がある。

### 新しい優先課題：Decoder
litert-community/whisper-acft配布モデルのDecoderは **KV cacheなし、最大128トークンのフルシーケンスを毎トークン実行する**。従来Whisper SmallのDecoder時間（中央値1439ms）をACFTへ直接適用することはできない。Encoderの高速化だけでは総ASRが高速とは限らない。

独立ページの任意チェック「Decoderの入力構造と処理時間も測定」は合成melと固定Whisperプロンプトでdecode signatureを実行し、ウォームアップ1回＋3回の1ステップ相当の時間を計測する。音声内容や精度は評価しない。実Decoderが高速でも、言語判定・STFT/mel・Tokenizer・連続トークン生成を含む完成ASRの計測が次に必要。

参照: https://huggingface.co/litert-community/whisper-acft

## Galaxy S25 ACFT Small 5s Decoder診断の形状修正
実機の2026-10-23測定: `build=20261023-acft-decoder-probe-v4`, Small/5s Encoder `sampleMs=[766.11,766.88,770.02,780.59,784.28]`, 中央値 `770ms`, モデル準備 `40181ms`。

Decoder probe は計算前に `Unrecognized decoder signature` を返しており、Decoder性能の不良は示さない。実際に返却された入力メタデータ:
- `args_2`: float32 `[1,1,128,128]`（自己回帰マスク）
- `args_0`: float32 `[1,250,768]`（Encoder出力）
- `args_1`: int32 `[1,128]`（トークンID）

旧検証コードがマスクを `[1,128,128]` の3次元形状に限定していた。v5では `[1,1,L,L]` の4次元に加え、旧3次元もサポート。メモリ上の要素数はどちらも `L*L`。実機と同じ入力メタデータを使った回帰テストを追加。さらに失敗時のstack全文を診断に含める。

**未確認**: 現物TFLiteのDecoder実行時間、Decoder出力のshape、実音声の精度/総レイテンシ。Encoder中央値770msと合成Decoder計測を含む別測定であることに注意。

## Galaxy S25 ACFT Small 5秒: Decoderが律速 (2026-10-23 JST)
ユーザー実機のLiteRT.js 2.5.3 CPU/WASM benchmark `build=20261023-acft-decoder-mask4d-v5`:
- Encoder (合成mel) `sampleMs=[749.47,752.00,759.85,765.62,774.19]`, 中央値 **760ms**
- Decoder固定プロンプト・フル128トークン幅グラフで `sampleMs=[735.17,735.58,735.87]`, 中央値 **736ms/呼び出し**
- Decoder signature: `args_2` float32 `[1,1,128,128]`, `args_0` float32 `[1,250,768]`, `args_1` int32 `[1,128]`; `output_0` float32 `[1,128,51865]`
- モデル取得・準備 `loadingMs=27481`。3-step Decoder計測は同じEncoder出力を再利用、実音声・実トークン列ではない。Decoder loop では256? ではなく固定128 token全処理。配布仕様によると **KV cacheなしで毎トークンfull sequence re-run**。1回のDecoder呼び出しから実際に1トークンを選択し、ループして文字列を生成する必要がある。
- **条件付き試算**: Encoder 0.760s + Decoder 0.736s×10ステップ＝**8.12s**、20ステップなら **15.48s**（前処理/言語判定/IPC/音声再生は含まず）。実際の音声認識時間でも将来実装の確定値でもない。仮に短文が5トークンでも約4.44s。2–3秒目標のSmall LiteRT現行フル再実行Decoderは厳しい。

### 更新後の技術方針
1. **短窓Encoderの成果を生かすにはキャッシュ付きDecoderが必要**。候補は (a) FUTO ACFT GGML重みを`whisper.cpp`のWASMで実行して動的`audio_ctx`とKV cacheを活用する、(b) FUTO ACFTチェックポイントから`decoder_with_past`/KV入出力を持つONNXグラフを再エクスポートする方式。ただしどちらもブラウザCPU上での速度と精度は要実測で、移植コストやフォーマット/メモリの検証が必要。
2. **現行LiteRTモデルのままでできる低コスト比較**として、既存Pages実験の `ACFT Base 5s` + `Decoderの入力構造と処理時間も測定` を実行してDecoder単位コストを把握する。短窓Baseは多言語対応を維持するが認識精度悪化の可能性がある。
3. 現行のDecoderを小さなマスクやパディングにするだけでは固定グラフのサイズやKV再計算を回避できない。過剰なトークン上限調整は途中打ち切りとなりうる。
4. **候補決定後**、実音声で5～10秒短文と日本語以外も含む対象言語の認識内容、言語自動判定、応答遅延（中央値とp95）を確認。

根拠:
- https://huggingface.co/litert-community/whisper-acft (KV-cacheなしfull re-run)
- https://github.com/ggml-org/whisper.cpp/blob/master/src/whisper.cpp (self/cross-attention KV cache)
- https://github.com/futo-org/whisper-acft (whisper.cpp audio_ctxに対応したACFT学習済み重み)
