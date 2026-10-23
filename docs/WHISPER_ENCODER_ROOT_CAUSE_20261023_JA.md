# Whisper Small q8 / Galaxy S25: Encoder遅延の原因分析 (2026-10-23)

> **精度優先の判断修正（2026-10-23、GitHub既存検証と日本語公開評価を再確認）:** 以下の本文にある「ACFT Base 5s/10sを第一候補／実音声試験を最優先」は、速度実測後の暫定案であり、**現時点での採用推奨ではない**。現行Smallを精度ベースラインに保ち、Small ACFTのKVキャッシュ付きDecoderやwhisper.cpp等の高速化を優先研究する。Base ACFTは比較用の実験条件として残すが、精度確認前に既定化しない。詳細は文末の「精度を踏まえた改訂方針」を参照。


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

## 2026-10-23 Galaxy S25: ACFT Base 5秒のEncoder＋Decoder実測と意思決定

追加実測 `build=20261023-acft-decoder-mask4d-v5`、Galaxy S25 Chrome、LiteRT.js 2.5.3 WASM CPU、合成mel＋固定トークン、モデル `base5`:
- Encoder: `sampleMs=[176,173.99,174.26,175.45,175.92]`; 中央値 **175 ms**
- Decoder: `sampleMs=[236.82,234.61,238.78]`; 1回のフルシーケンス再推論中央値 **237 ms**
- Decoder signature: mask float32 `[1,1,128,128]`、encoder hidden float32 `[1,250,512]`、token IDs int32 `[1,128]`、logits float32 `[1,128,51865]`
- `loadingMs=12462` は今回のモデル取得・コンパイル時間。**既存のモデルキャッシュ再利用を保証する値ではない**。

同一ブラウザ・Galaxy S25の `small5` 追加実測は Encoder **760 ms**、Decoder **736 ms/回**。Baseは Encoder約4.3倍、Decoder約3.1倍高速（ただし音声・トークンに依存するため、実際のASR速度比ではない）。

| Decoderステップ数（仮定） | Base 5s (0.175+0.237n) | Small 5s (0.760+0.736n) |
|---:|---:|---:|
| 5 | 1.36秒 | 4.44秒 |
| 10 | 2.55秒 | 8.12秒 |
| 15 | 3.73秒 | 11.80秒 |
| 20 | 4.92秒 | 15.48秒 |

上記は合成固定テンソルによる単純加算の**参考試算**。実音声ではトークン数、言語検出（追加decode）、前処理、IPC、推論再初期化、モデル常駐、正答の有無が異なる。Decoder出力はトークンごとの full 128 token グラフで、現行TFLiteにはKV cacheが無い。

### 実装方針の変更
**ACFT Base 5s/10sの実音声ベンチマークを最優先**。特に普段の短い日本語呼びかけのCER、否定/時系列、話題判定に影響する語、誤認識と繰り返しを測り、現行Whisper Smallの同じ録音と同時比較する。多言語仕様により外国語音声にも対応する必要があるため、日本語だけに固定しない。5秒を超える音声を切り捨てないよう10秒版を併用する。

- Baseが十分な精度なら、通常LiteRT CPUでは短文5～10生成トークンで2～3秒前後のASRが成立する**可能性**がある。
- Baseの精度が足りなければ、Small ACFT重み＋KV cacheのあるwhisper.cpp/WASMあるいはdecoder-with-past ONNXを検証。Decoder 1回736msの現行Smallフル再実行をそのまま実用配布しない。
- 認識精度と総ASR速度を実測するまで、音声認識の既定モデルは変更せず、本番版も変更しない。
- 実装候補: ブラウザファイル音声→WebAudio 16kHz PCM→Whisper 80帯log-mel（窓500/1000フレーム）→ LiteRT encode→mask [1,1,128,128]を使うgreedy autoregressive decode→multilingual Whisper tokenizer。実音声の文字起こしと各段階の時間を保存しない診断に表示する。Whisperの音声前処理はTransformers.js `AutoProcessor` の出力と一致を検証する。

裏付け: https://huggingface.co/litert-community/whisper-acft (モデルとdecoder構造)、https://huggingface.co/docs/transformers.js/en/api/processors (実音声前処理)。

## 精度を踏まえた改訂方針（2026-10-23、今回の最終判断）

### 再確認した過去のGitHub記録
- `research/voice-content-26-review-20261015.json`: 事前録音の**英語**音声をWhisper Small/Baseで照合し、両エンジンと表示原稿に差異のある26例を集めた選別済みデータ。無作為抽出ではないので、単純なBase/Small全体CER・WER比較の母集団ではない。
- 例 No.11（現在の英文は2回反復）ではSmallは `Sip, sip`、Baseは `Sips, zip`。No.22はSmallの `Little sips add up` に対しBaseは `Little sips that up`。部分的にはBaseの方が近いケースもある。
- `research/voice-content-26-human-verdicts-20261018.json`: 26音源を人手確認した21 match/5 misreadは**収録英文と音声の一致検証**であり、Whisper BaseのASR正解率21/26等ではない。
- `docs/voice-content-26-fix-guide.md`: No.11のBase誤転写とSmallとの違いを具体的に記録。これは話題・Interaction判定に影響する短い育児表現での危険を示す質的証拠。
- `issues/101`: 日本語保護者録音によるMoonshine評価と26英語音源レビューが独立した課題。**Whisper Baseの日本語CER/WERをアプリ独自に確定した記録は、この資料群からは見つからない。**

### 外部の同データセット比較に基づく精度上の懸念
通常Whisper（**ACFTではない**）の日本語CER、低いほど良い。

| データセット | Whisper Base | Whisper Small |
|---|---:|---:|
| CommonVoice 8 Japanese | 28.6% | 15.1% |
| JSUT Basic 5000 | 24.9% | 14.2% |
| ReazonSpeech held-out | 70.4% | 41.5% |

出典 `japanese-asr` 日本語比較: https://huggingface.co/japanese-asr 。別のWASM CPU比較では日本語CER Base 26.0%、Small 13.4%、英語WER Base 10.6%、Small 6.8%（https://bytescope.dev/ja/speech-models/）。
異なるデータセット同士の値は横断比較しない。データ収集・前処理も異なるためこれらの絶対値を**みつことばの実録音の予想CER**として使わない。
FUTO ACFTは音声コンテキストを短くしても元モデルの挙動を保つための追加学習で、BaseをSmall同等の認識精度へ改善したとは実証していない。https://github.com/futo-org/whisper-acft

### 採用の意思決定（速度より精度）
1. 現行Whisper Smallは精度ベースライン（現時点で一般公開を置き換えない）。モデルを小さくするだけでは日本語・他言語の認識誤りが増え、誤Topic・Interactionに波及しうる。
2. **第一研究候補は短窓ACFT Small＋KVキャッシュを活用できるDecoder**（whisper.cpp WASMの動的audio context / KV、またはSmall ACFTのwith-past ONNX）。この構成の実機速度・メモリ・CERは未測定。CPU優先、WebGPUを前提にしない。
3. **ACFT Baseは速度比較・品質評価用の比較条件**。合成入力ではEncoder 175ms/Decoder 237msだが、*認識結果*がSmallと比べて許容できない場合、速度が高くても採用しない。
4. 専用の**同一録音を使ったA/B**で、現行Whisper Small、ACFT Base 5/10s、ACFT Small 5/10s＋最適化Decoder（完成時）、日本語版Moonshine（別条件）を比較。言語ごとに分けて報告する。5秒超音声は切り捨てず10秒窓か分割を使う。
5. 全体CER/WERだけでなく、短文の否定/時制（「飲む／飲まない」「寝た／寝る」）、反復、育児語、初回言語判定、話題/Interaction誤りを人手レビューする。実機の中央値・p95、初回DL、再利用、RAMも併記。
6. **品質の非劣性確認を満たさなければBaseを実装既定にしない。** 速度だけでのモデル移行は禁止。多言語UIの音声入力を単純に日本語固定にせず、現在の言語認識機能を保持する。

この段落が本文中の旧「ACFT Base最優先」の暫定方針より優先される。

## 2026-10-23: whisper.cpp WASM実音声（ACFT Small Q8）のボトルネック発見と修正

Galaxy S25 Chrome 155提供ログ `build=20261023-whispercpp-acft-kv-v1`:
- `audioSeconds=3.84`, `audioContext=250` (5秒窓), `nthreads=4`, `crossOriginIsolated=true`
- `asrTotalMs=49882`, `nativeTimings.encodeMs=24371.66`, `decodeMs=30.84`, `batchdMs=16.66`, `sampleMs=4.71`
- 正解「こんにちは」 vs ASR「こんにちは。」。正規化（空白・句読点を無視）ならCER **0%**。旧 `cer=0.2` はJS regex `/[\\p{P}\\p{S}\\s]/gu` とエスケープを重複した結果、句点「。」を除外できていないバグ。2026-10-23 v2で `/[\p{P}\p{S}\s]/gu` に修正し単体回帰テストを追加。
- **重要な誤認:** `whisper_get_timings` の `encode_ms` は *Encoder処理の累計ではなく回あたり平均* (`t_encode_us/n_encode`)。現行 `language=auto` の `whisper_full_with_state()` は言語判定で `whisper_lang_auto_detect_internal()`→Encoder一回、通常認識のメインループでEncoder一回、合計2回。したがって旧ログのEncoder累計推定は `24371.66 × 2 ≈ 48743.32ms`、その他は差引約 `1138.68ms` であり、旧ログの約25秒の「不明時間」はほぼ二重Encoder実行で説明可能。
- ネイティブv2では `encoder_begin_callback` により実際のEncoder呼出回数を記録し、`encodeRuns`、`encodeTotalMs`（平均×実回数）を別々に公開。JSも `encoderTotalMs` と `nonEncoderMs` を区別。言語自動判定時の遅延を隠さない。
- 5秒音声で `ja` 固定したときの推定総時間は **約25秒**（1回Encoder分削除）。実測ではなく、実機で同一音声を再実行して確認が必要。
- LiteRT ACFT Small/5秒の合成melでEncoder **約760ms** に対しwhisper.cpp WASMの音声Encoderは平均 **約24秒**。モデルとランタイムが異なり単純倍率ではないが、WASM推論エンジンが大きな律速。2026-10-23 CMakeログ `CMAKE_SYSTEM_PROCESSOR=x86`, `GGML_SYSTEM_ARCH=UNKNOWN` のため汎用量子化CPUカーネルへフォールバックしていた。v2ビルドではCMakeに `-DCMAKE_SYSTEM_PROCESSOR=wasm32` を追加し、`ggml-cpu/arch/wasm/quants.c` のWASM SIMD量子化ルートを選択してから再実機計測する。CMake自体の一部に `-msimd128` は元から存在しており、単に「SIMD全体が無効だった」とは断定しない。
- 性能改善は未確認。トレードオフ: Browser whisper.cppは公称でモバイル性能が弱い (https://github.com/ggml-org/whisper.cpp/blob/master/examples/whisper.wasm/README.md )。WASM用量子化ルートでも遅い場合は、**高速LiteRT 5秒EncoderとKVキャッシュ付きDecoderを同じランタイムで結ぶ必要**がある。現行のLiteRT DecoderはKVキャッシュなし、同等性能にできるか不明。
- 独立デプロイ環境 `whisper-acft-cached-benchmark.html` のみ更新。本番みつことばのASRは不変更。

上流根拠:
- https://github.com/ggml-org/whisper.cpp/blob/master/src/whisper.cpp (`whisper_get_timings`, `whisper_full_with_state`, `whisper_lang_auto_detect_internal`)
- https://github.com/ggml-org/whisper.cpp/issues/3954 (2026-07-25: 言語自動判定がEncoderを再実行する実測)
- https://github.com/ggml-org/whisper.cpp/blob/master/ggml/src/ggml-cpu/CMakeLists.txt (wasm特殊量子化ルート)
