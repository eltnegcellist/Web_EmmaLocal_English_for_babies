# 2026-10-24 みつことば：Whisper以外のCPU/WASM低遅延ASR候補

## 背景・結論
- Galaxy S25 のACFT Small＋whisper.cpp WASMは、5秒窓・言語 ja 固定・2.34秒発話で、ASR本体 **2.811秒**、音声前処理込み **3.245秒**。2–3秒の後処理はMoonshine日本語のユーザー実測（約0.1–0.2秒）より遅い。
- 音声窓の切替だけでは待ち時間の根本改善にならない。短文/長文とも**話している間に部分認識を進めるストリーミングASR**を優先し、短文での精度、発話確定後の遅延、長文（5秒超）を同時に評価する。
- 実装の要点：**UIの言語選択が ja/de/fr/ko/th/en であること**（`src/multilingual/core.js`で確認）。日本語 Moonshine 以外は Whisper Small に接続している。English UI は多言語自動判定扱いで、単に英語モデルへ固定すると仕様を損なう。

## 言語別モデル候補と入手根拠

| UI言語 | モデル候補 | 状態・根拠 | 利用条件の注意 |
|---|---|---|---|
| ja | Moonshine Tiny/Small Streaming (34M/123M) | 実験ページ実装、既存Moonshine日本語と比較 | **Streaming はMIT**。旧Tiny/Base日本語はCommunity非商用 |
| de | Moonshine Tiny/Small Streaming (34M/123M) | 実験ページ実装 | MIT |
| en | Moonshine Tiny/Small Streaming (34M/123M) | 実験ページ実装。ただし英語UIの自動言語判定は未対応 | MIT |
| fr | shaojieli/sherpa-onnx-streaming-zipformer-fr-2023-04-14 | 配布Hugging Face、**Streaming** / 約127MB INT8 encoder | 公開モデルカードApache-2.0。モデル動作/製品利用は要再確認 |
| ko | k2-fsa/sherpa-onnx-streaming-zipformer-korean-2024-06-16 | **Streaming** / INT8 encoder約127MB | 元チェックポイントはApache-2.0表記。ただしGitHub issue #2886（2025-12-10）の空結果報告がある。まず動作を検証 |
| th | sherpa-onnx-zipformer-thai-2024-06-20 | **非Streaming** / INT8 encoder約148MB | 元モデルはApache-2.0。別候補としてタイ語入りStreaming多言語Zipformer `ar_en_id_ja_ru_th_vi_zh-2025-02-10`（INT8 encoder約297MB）も存在するが、資産が大きい。 |

参考としてスペイン語 Moonshine Tiny/Small Streaming（MIT）は実験で検証するが、2026-10-24現在のUI6言語には含まれない。スペイン語を正式追加するときの選択肢。

### 正式モデル・ライセンス参照
- Moonshine Streamingモデルと各言語WER/CER: https://moonshine-voice.readthedocs.io/en/stable/models/available-models/。異なる言語・データセットでスコアを横断比較しない。
- Moonshine MIT/非商用旧モデル: https://moonshine-voice.readthedocs.io/en/stable/license/
- Moonshine WASM SDK / API: https://www.npmjs.com/package/@moonshine-ai/moonshine-wasm
- Zipformer対応言語/WASMランタイム: https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/index.html
- フランス語モデル: https://huggingface.co/shaojieli/sherpa-onnx-streaming-zipformer-fr-2023-04-14
- 韓国語モデル: https://huggingface.co/k2-fsa/sherpa-onnx-streaming-zipformer-korean-2024-06-16
- 韓国語Streaming既報不具合: https://github.com/k2-fsa/sherpa-onnx/issues/2886
- タイ語: https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html
- タイ語入り多言語Streaming: https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-ar_en_id_ja_ru_th_vi_zh-2025-02-10

## 実装した独立テスト
- `asr-alternatives-benchmark.html`、`moonshine-alternative-benchmark.js`。
- 既に利用中のMoonshine WASM v0.1.5（`src/vendor/moonshine/`）と、署名済み `src/moonshine-module.js` を再利用しており、**本番用 `src/multilingual/worker.js` は触れない**。
- 選択可能：ja/de/en/es × Tiny/Small Streaming (MIT)。フランス語/韓国語/タイ語はまだページから直接推論できず、調査中。モデルはユーザー側で必要な言語をダウンロードし、Cache Storageで再利用。
- 同一ファイル高速リプレイ方式（500msずつストリーミング取り込み）で **ASR計算時間、音声長、RTF、CER、モデルロード、前処理**を記録。**高速リプレイの推論時間を「発話後確定遅延」と呼ばない。**
- ライブマイク方式では **発話中の部分文字列と最後の確定結果（イベントの`lastTranscriptionLatencyMs`）**を記録。音声アップロードなし。
- 日本語で`max_tokens_per_second=13.0`を使い、非ラテン文字の正しい発話の途中切り捨てを避ける（Moonshineモデル一覧の注意）。

## 厳密な採用ゲート
1. Galaxy S25 Chrome CPU **同一実録音（2秒、5秒、8秒、12秒、15秒）**を各3回、TinyとSmall、現行日本語Moonshine、Whisper Small基準で測定。**中央値・p95**を出す。
2. ストリーミングモデルは録音終了から確定テキスト表示までを別途測り、**確定後p95を500ms以内**を目安にする。録音中のCPU占有率、RAM、発熱も確認。
3. 児童向け短文の否定（飲む/飲まない、寝ている/寝ていない）、類似音、Topic/Interactionの両軸一致を文字誤り率と並べて比較。短文の認識精度をSmallと近づけられるかを最重視。ユーザー実測CERの数例だけでは採用しない。
4. **英語UI=多言語自動判定**は維持する。言語別モデルを選ぶ場合は別途軽量言語識別器が必要。自動判定の初回/再判定、誤判定時の復旧も測定。言語固定に変えて改善値だけを報告しない。
5. 旧Moonshine非商用モデルを商用版に混ぜない。導入時はモデル重み、コード、第三者ライブラリごとに再確認。
6. 本番への切り替えを行わず、まず実験ページで適合性を確認する。GitHub Pagesのみの隔離配布。

## リスク
- Moonshine Tinyはパラメータが小さく高速候補だが、Short utterance / 日本語音韻・育児語での精度は未実測。
- v0.1.5 WASMで公式「最新モデルのネイティブ依存マニフェスト」が利用できるかは実装・CIで検証が必要。モデル一覧は流動的なため実データ取得・推論完了を伴わず採用可と断定しない。
- 韓国語Zipformerには空出力報告があり、まず検証する。
- タイ語単言語モデルは非Streaming。5秒超対応していても発話終了後の待ち時間が大きい可能性がある。
