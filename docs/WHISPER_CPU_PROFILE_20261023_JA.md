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
