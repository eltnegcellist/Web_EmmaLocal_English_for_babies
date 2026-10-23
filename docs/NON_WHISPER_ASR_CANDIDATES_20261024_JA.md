# Whisper以外の高速ASR調査 — みつことば6言語（2026-10-24）

**目的**：Web版Galaxy S25／CPU WASM／端末内／短文呼びかけのストリーミングASR。ユーザーによるMoonshine短文処理の実測（0.1～0.2秒付近の例あり）と比較するため、Whisper ACFT Small 5秒窓の実音声ASR約2.81秒（2.34秒録音・日本語固定・前処理別）は現時点で遅延上の課題。**2.81秒はすべての音声に対しての最低時間ではない。** Moonshineの処理時間とWhisper実験のASR総時間は計測定義が異なるため、絶対時間の直接比較はしない。

## 本アプリで必要な言語をソースで確認

`src/multilingual/core.js`: `LANGUAGES=['ja','de','fr','ko','th','en']`。
- 日本語 `ja` はすでにMoonshineとRuriを使う。
- `de/fr/ko/th` と、言語自動判定を行う `en` のルートには現行Whisper Small / E5を使用。`speechLanguage(en)` がnullになるのは「英語を必ず認識する」という意味ではなく、**多言語自動判定**が要求されているため。
- **現行仕様での英語UIは多言語自動判定の入口**。英語専用Moonshineモデルへの置換は、自動判定機能の喪失につながる。言語検出器か手動/再判定UXが必要。

## 優先候補と公開状態

| 対象 | 候補 | 対応 | サイズ / アーキテクチャ | ライセンス評価 | WASM/実機状態 |
|---|---|---|---|---|---|
| ja | Moonshine Tiny/Small Streaming | 日本語のみ | 34M / 123Mパラメータ。ストリーミング | 新モデル MIT | Galaxy S25の新Streaming版は**未実測**。従来Moonshine使用中 |
| de | Moonshine Tiny/Small Streaming | ドイツ語のみ | 34M / 123M、ストリーミング | MIT | **最優先実測** |
| en | Moonshine Tiny/Small Streaming | 英語のみ | 34M / 123M、ストリーミング | MIT | 英語固定時に実測。自動言語判定なし |
| fr | shaojieli streaming Zipformer `fr-2023-04-14` | フランス語のみ | INT8 Encoder約121 MB（動的batch） / 約107MB（固定batch） | モデルHF配布にApache-2.0の表記あり。関連するファイル・学習データの条件を統合前に確認 | 公式sherpa-onnx WASM対応。ただし当モデルのGalaxy実機は未測定 |
| ko | sherpa-onnx Streaming Zipformer `korean-2024-06-16` | 韓国語のみ | INT8と非量子化あり。モデル実サイズ要調査 | 学習チェックポイント・KSponSpeechの利用条件を別途確認 | WASM個別実機未測定 |
| th | sherpa-onnx Offline Zipformer `thai-2024-06-20` | タイ語のみ | INT8 Encoder約148MB。**非ストリーミング** | 学習モデル・GigaSpeech2の利用条件を別途確認 | WASM個別実機未測定 |
| fr/de/en/ja | IBM Granite Speech 5.0 TurboCTC | **fr,de,en,ja**（ko/thなし） | 470M、非自己回帰CTC | Apache-2.0 | **2026-10-21公開**。Web用量子化＋推論実装およびGalaxy速度は未確認。比較候補のみ |
| ko/en/ja | SenseVoice Small via sherpa-onnx | ko/en/ja/zh/yue | 234M、非自己回帰 | 原モデル条件を要確認 | WASM公式対応。今回の6言語を網羅できない |
| th/ja/ko/en（fr,deは非対応） | Fun-ASR-MLT-Nano | 31言語 | 800M、LLM系 | 個別チェック必要 | ブラウザCPUでの低遅延化に不利。今回は見送り |

**除外**：旧Moonshine `ja Base/Tiny` 等の非英語・非StreamingはMoonshine Community License（非商用）。MITが必要な用途へ誤採用しない。新Moonshine StreamingはMIT。

### 速度・品質のエビデンス制約
- Moonshine提供ベンチマークの日本語Small StreamingはCER 17.2%、Tiny Streamingは19.7%（別評価環境での公式値）。ドイツ語Small 7.5% WER、Tiny 12.0%。英語Small 7.84% WER、Tiny 12.0%。**同一コーパス・同一評価方法ではなく、Whisper Smallと直接同一軸で比較しない**。
- 2026-10-24のGalaxy S25での新候補のWASM速度・RAM・熱・品質は**未実測**。公称「高速」「リアルタイム」「WASM対応」は実機で100msを保証しない。
- Moonshineは音声を話している間にストリーミング解析できる。発話完了後の`lastTranscriptionLatencyMs`と、発話長・モデル初回取得時間は別指標。比較時は録音終了から分類結果までのE2E時間を統一。
- 6言語全体で一つの小さい公開ASRモデルを用い、CPUだけで短文を常時100msで処理できるという根拠は現時点でない。

## 今回実装した独立試験

`moonshine-streaming-benchmark.html`:
- `experimental/asr-alternatives/moonshine-live.js` は公式`@moonshine-ai/moonshine-wasm@0.1.5`の`MicTranscriber`を利用。言語`ja/de/en`、Tiny/Small Streamingを選択。
- ブラウザの`crossOriginIsolated`を確認後、端末でモデルを読み込み、発話途中の仮結果と確定文、`lastTranscriptionLatencyMs`を表示。任意の正解文に対し句読点無視CERを計算。診断をJSON形式でコピー可能。
- 音声はサーバーへアップロードせず、録音PCMは端末側WASMのみ。言語モデルが未ロードのまま速度評価したり、異なる計測定義の遅延を比較することを防ぐ表示あり。
- 試験のためのページで、本番ルートの認識モデル／E5／Moonshine／ダウンロード先を変更していない。Chrome・Galaxy S25での**認識成功は未検証**。

## 次に確認する順序

1. **日本語・ドイツ語・英語**：Galaxy S25のMoonshine Tiny/Small Streamingで短文と5秒超の呼びかけを実機測定。録音終了後の最終結果レイテンシ、CER/WER、メモリを記録。既存日本語Moonshineとの比較も必須。
2. **フランス語**：sherpa-onnx French Streaming Zipformer INT8をWASMで起動、音声精度・体感遅延を測る。公開済みのWebAssembly実装はあるが、資産の配置・ビルド・CORSを検証する必要あり。
3. **韓国語**：Streaming Zipformerの学習データ利用権とモデルライセンスを確認してから同じ測定を行う。旧Moonshine韓国語TinyはCommunity非商用なので候補から外す。
4. **タイ語**：Zipformer Offline INT8とTyphoon ASR ONNXの権利/CPU速度を比較。ストリーミングがない場合はVAD後処理＋高速一括ASR。
5. 自動言語判定を独立部品にするか、初回発話のみ言語検出→以降は選択された個別ASRを固定する方式を評価。誤判定・言語切替時のUIを残す。
6. 同じ実録音20～50件（長い発話/否定/育児用語/各言語）で文字誤り率だけでなくE5によるTopic・Interaction一致率、初回モデルロード、p50/p95/RTF、端末発熱を比較。最も速いだけでは採用せず意味保持を優先。

## 一次情報
- Moonshine最新モデル一覧・MIT/Community差: https://moonshine-voice.readthedocs.io/en/latest/models/available-models/
- Moonshineライセンス: https://moonshine-voice.readthedocs.io/en/stable/license/
- Moonshine Web WASMとStreaming API: https://moonshine-voice.readthedocs.io/en/latest/quickstart/ および https://github.com/moonshine-ai/moonshine/blob/main/language-bindings/wasm/src/mic-transcriber.ts
- sherpa-onnx French streaming: https://huggingface.co/shaojieli/sherpa-onnx-streaming-zipformer-fr-2023-04-14
- sherpa-onnx Korean streaming: https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html
- sherpa-onnx Thai offline: https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html
- Granite Speech 5.0 TurboCTC: https://huggingface.co/ibm-granite/granite-speech-5.0-470m-turboctc
- SenseVoice: https://k2-fsa.github.io/sherpa/onnx/sense-voice/
