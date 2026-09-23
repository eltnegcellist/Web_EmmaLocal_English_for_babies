# Emma Web ― Local English for Babies

Emma Web is the APK-free browser/PWA edition of Emma.

親が普段どおり日本語で赤ちゃんへ話しかけると、Emmaがその場面に合った短い英語で赤ちゃんへ参加することを目指します。単純な日本語→英語翻訳ではありません。

## Current scope

現在の初版は **Lite / Baby mode** です。

```text
Microphone
↓
AudioWorklet + adaptive endpoint detection
↓
Web Speech API on-device ASR（端末内処理を強制）
↓
LiteResponseEngine
↓
Supertonic 3 / F3 (browser-local CPU/WASM TTS)
↓
Emma avatar + PCM-linked lip sync
```

- 日本語ASRは `SpeechRecognition.processLocally = true` を必須にし、クラウドASRへフォールバックしません
- 初回はブラウザの日本語オンデバイス音声認識データとTTSモデルの取得に通信を使う場合があります
- 標準TTSはSupertonic 3 / F3をCPU/WASMで実行します
- 速度比較用にKitten Nano（WebGPU）を一時的に選択でき、同じ例文で生成速度を比較できます
- Android版Emmaとは別repositoryとして開発します
- Full Gemma modeは今後追加予定です

## Local development

HTTPSまたはlocalhostで開いてください。

```bash
python3 -m http.server 8080
```

その後、`http://localhost:8080` を開きます。

開発用テキスト入力は `?debug=1` をURL末尾へ付けると表示されます。

## Deployment

`main` への更新は GitHub Actions でテスト後、GitHub Pages へ公開する構成です。

GitHub Pages source: **Deploy from a branch** (`chore/trigger-pages`, root)

## Android edition

Android版:
https://github.com/eltnegcellist/Android_English_character_for_baby


## 完全ローカルASRの対応について

Web版はOSのネイティブ音声認識APIを直接呼び出すのではなく、ブラウザのWeb Speech APIを使用します。
`processLocally=true` を設定でき、かつ日本語のオンデバイス認識データを利用できるブラウザだけで会話機能を有効にします。
非対応ブラウザではクラウド音声認識へ切り替えず、利用不可として案内します。
