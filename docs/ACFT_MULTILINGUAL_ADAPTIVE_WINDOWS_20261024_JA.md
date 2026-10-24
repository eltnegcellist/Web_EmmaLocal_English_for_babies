# 多言語ASRの5秒／10秒自動窓化（実験版・2026-10-24）

## 動作
- 日本語表示で利用するMoonshineは変更しない。
- 非日本語UIの保護者音声は、ACFT Small q8モデルが端末内に保存され、かつクロスオリジン分離が有効なら `whisper.cpp` WASM CPU（KVキャッシュ）で認識する。
- 音声が5秒以内なら `audio_ctx=250`、5～10秒なら `audio_ctx=500`。
- 10秒を超えたら7～9秒近辺で音量が小さい部分を境界候補にして分割し、0.25秒重ねて順次認識、テキストの完全一致・末尾/先頭重複を除去して統合。**切り捨てなし**。最大入力90秒。重複排除は暫定ヒューリスティックで、言語ごとに実録音検証が必要。
- 言語が `en`（多言語自動判定）なら、最初の音声で言語自動判定し、同じ音声の後続セグメントと次の発話は固定。設定の再判定ボタンで破棄可能。UIで英語固定の開発者設定も従来どおり。字幕や翻訳を変更しない。
- 旧Whisper Small ONNX/Transformers.js実装は**モデル未導入**もしくはブラウザ分離不可時に退避（既存言語処理を壊さない）。

## なぜモデルを一度インポートするか
FUTO公式 `small_acft_q8_0.bin` のダウンロード先はリダイレクト先を含め `Access-Control-Allow-Origin` ヘッダーが付いていないため、ブラウザから `fetch` で直接モデルを保存できない。第三者CORSプロキシは使わない。

端末で[公式ダウンロード](https://voiceinput.futo.org/VoiceInput/small_acft_q8_0.bin)を一度行い、開発者設定の「ACFT Smallモデル」から `.bin` ファイルを選択する。264,464,624 bytes / SHA-256 `15ef255465a6dc582ecf1ec651a4618c7ee2c18c05570bbe46493d248d465ac4` を照合してIndexedDBへ4MiB単位のチャンクで保存。各セッションで保存済みモデルを読み出し、ネイティブWorkerへ渡す。

**正式公開前の課題**: 一度ダウンロードして保存する一般向け配布方式を用意すること。実験版でいきなり本番のASRを置き換えない。

## 実装
- `src/multilingual/acft-window-policy.js`: 音声長に応じた窓選択・分割・文字統合
- `src/multilingual/acft-model-store.js`: モデルの完全性検証とローカル永続化
- `src/multilingual/acft-client.js`: Galaxy S25で起動実績のあるメインページ上のWASMランタイムに音声を渡す。推論自体はpthreadで動き、Workerを二重に作らない
- `src/multilingual/acft-client.js`: 連続認識・言語判定キャッシュ・計測・キャッシュ済みモデルの再利用
- `src/multilingual/client.js`, `worker.js`: 新ASR+E5モデルを選択し、旧ONNX経路の準備を省略
- `src/multilingual/performance-controls.js`: 開発者向けモデルのインポート画面
- `experimental/whisper-acft-wasm/emscripten.cpp`: GPU不要のCPU WASMネイティブ推論、言語ID取得
- `multilingual-assets/runtime/acft-whispercpp.js`: pinned `whisper.cpp` SIMD WASMランタイム
- `test-acft-multilingual.mjs`: 長文分割境界・末尾/先頭の重複排除・追加経路の静的回帰
- `scripts/browser-acft-adaptive-smoke.mjs`: クロスオリジン分離下でのWASMページ実行とネイティブAPI初期化（実モデル不使用）

## 確認の優先順
1. 同一Galaxy S25で5秒以内、6～10秒、11～20秒、21～30秒を測定。特に10秒を少し超える音声の境界欠落・重複を確認。
2. 各言語ごとに認識精度と従来Whisper Small比CER/WER、重要な否定・時制・育児語の意味変化を人手判定。
3. 5秒窓と10秒窓のEncoderと総ASR時間を計測。初回言語自動判定時と以降固定時の差分を確認。
4. 端末の空き容量が不足した際、保存したモデルが壊れた際、ブラウザ分離がない際の退避動作。
5. 本番へのマージ前にWeb/Android実機でE5話題分類と英語再生まで通しで確認すること。

今回変更したのは **別実験ブランチ** のみ。

## ブラウザ起動方式について（追記）
C++ネイティブ実行コードを別のclassic Workerへ入れる試作では、Chromium起動テスト時にWorker本体が初期化できなかったため、独立Worker方式は破棄。Galaxy S25で実際に動いたWhisper.cppベンチマークと同じ、ページでランタイムを初期化して内部pthreadを実行する構成へ変更した。これは非同期デコード可能だが、モデル初回ロードなど一部同期処理はUIスレッドを占有する。停止中に走っているネイティブ計算を直ちに中止できない点も残るので、デバイス実測前の正式公開は不可。
