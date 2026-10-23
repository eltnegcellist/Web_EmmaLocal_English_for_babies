# Whisper Small CPU/WASM の診断実験（2026-10-23）

## 対象
Galaxy S25、Whisper Small q8、Web/WASM CPU、英語マルチリンガルモード。3.79秒の音声を12.035秒で認識（RTF 3.17）した実測の分解が目的。発話言語によるモデル切替は検証しない。

## 計測対象
Transformers.js 3.8.1 の `recognizer.model.sessions.model.run`（エンコーダー）と `decoder_model_merged.run`（デコーダー）の呼び出しと経過時間を実測。`whisperOtherMs` は推論時間から二つのセッション経過を除いた時間（前処理、生成管理、テキスト整形、計測誤差などの合算）。`whisperDecoderRuns` はONNX runの回数であり実トークン数とは限らない。計測できない場合は `whisperProfileAvailable=false` としてunknownを出す。発話本文は診断ログに含めない。

## A/Bテスト
1. Chromeの通常タブ、録音音声の事前ダウンロード完了後に試す。端末発熱・バッテリー・ブラウザを揃える。
2. 英語マルチリンガル、初回言語判定、最大トークン数80（従来どおり）を固定。
3. 同じ短文で 1・2・4スレッドを比較する。各設定はウォームアップ1回の後3回以上計測する。
4. 同じスレッド数でトークン上限80、40、24を比較。文の欠落を必ず検査。これは**実験**で、通常値は80のまま。
5. `transcribeMs`、`whisperEncoderMs`、`whisperDecoderMs`、`whisperOtherMs`、`whisperDecoderRuns`、`effectiveThreads`、`realTimeFactor`、履歴の「聞き取った言葉」を比較する。

## 技術的な判断
- エンコーダー支配ならWhisperの30秒固定長実行の再設計や可変長モデルを優先。
- デコーダー支配なら逐次生成が律速。スレッドを増やすだけでは解決しにくく、モデル/実行方式変更を検討。
- 目標は3～5秒発話の認識後処理を数秒以内に収めること。2秒を理想、3秒程度を暫定許容とするのは**製品要件案**であって、実測成功値ではない。
- 同一端末で実測するまで、Whisper Smallの速度改善や別モデルの高速性を断定しない。

## 2026年10月時点の代替候補（実測前の技術評価）

| 候補 | 同一モデルで6言語と自動判定 | モバイル速度の見通し | 制限 |
| --- | --- | --- | --- |
| 現行 Whisper Small q8 / Transformers.js WASM | 対応 | Galaxy S25の既存実測は3.17 RTF | 30秒入力と自己回帰デコーダー。4スレッドへの変更だけで約6倍の高速化は期待しづらい |
| Whisper Base / Tiny (量子化) | 対応 | パラメータ数が小さくなるためA/B候補 | 短文でも30秒入力、精度の低下。既定置換しない |
| SenseVoice Small / sherpa-onnx | **非対応**（英語、日本語、韓国語など5言語） | 非自己回帰で高い高速化余地 | ドイツ語・フランス語・タイ語が欠ける。モデル重みの独自利用条件要確認 |
| Moonshine各言語モデル | **非対応**（単一の自動多言語モデルではない） | 一部言語で高速 | 言語別モデルの管理が必要。フランス語・タイ語が欠け、韓国語既存モデルはCommunityライセンス |
| Qwen3-ASR-0.6B / sherpa-onnx | 対応 | **Galaxy S25 Web/WASMでは未測定** | 約6億パラメータ、モデル容量・RAM・実行負荷が大きい可能性。単純な高速化目的には不確実 |
| Nemotron-3.5 ASR Streaming 0.6B | **現状では非対応**（タイ語は追加学習が必要） | ストリーミング向け | 大容量、タイ語が使用可能な完成チェックポイントではない |
| Whisper Small / Android native optimized runtime | モデル仕様上は対応 | WASMのオーバーヘッドを減らせる可能性 | Androidネイティブ版のみの候補。Web同等動作と実測速度は未確認 |

参照:
- https://huggingface.co/docs/transformers/en/model_doc/whisper
- https://k2-fsa.github.io/sherpa/onnx/sense-voice/index.html
- https://moonshine-voice.readthedocs.io/en/latest/models/available-models/
- https://github.com/QwenLM/Qwen3-ASR
- https://k2-fsa.github.io/sherpa/onnx/nemo/nemotron-streaming.html
- https://github.com/ggml-org/whisper.cpp/blob/master/examples/whisper.wasm/README.md

### 推奨の段取り
1. **現行のWASMの限界を計測**：1/2/4スレッドとONNX encoder/decoder内訳、直近に取得していた1105件の録音音声ダウンロードを完了させて再測定。
2. **Whisperの小型モデル / ネイティブ実装を研究専用として比較**：6言語維持、出力精度/幻覚/全体応答時間/温度/電池消費を同条件で評価する。安易な自動置換はしない。
3. 3～5秒発話でRTFが約0.5以下（認識2秒程度）の要件を満たさない場合、Whisper Smallを実用経路に採用する方針を再検討。軽量単言語モデル＋言語判定器との組合せも検証するが、合計モデルサイズを必ず報告する。
4. **CIのみではS25の実測を代替できない**。PRのマージは端末測定と文字起こし精度を確認した後。

## A/Bの記録方法
Whisperの各発話が完了すると音声長、言語判定、推論時間、実効スレッド数、ONNX session.run回数だけをメモリへ最大30件保持する。発話音声・文字起こし文はこの診断列へ保存しない。`診断情報をコピー`に `multilingual.benchmarkSample=` とスレッド別 `multilingual.benchmark.<N>threads.medianTranscribeMs=` 等を出力。1/2/4スレッドをそれぞれ3回以上測り、**1回のコピー**で比較可能。端末・タブを再読み込みするとメモリ上の比較値は消える。

Whisper実行中は録音音声の**バックグラウンド取得のみ**を一時保留し、終了時に再開する。必要な録音音声のオンデマンド取得は継続。次のバックグラウンドファイルへの着手を止める方式であり、すでに通信中の最大2ファイルは完了する。推論速度改善は実機で未確認。
