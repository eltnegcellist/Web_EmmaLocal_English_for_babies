# Emma Web ― Local English for Babies

Emma Web is the APK-free browser/PWA edition of Emma.

親が普段どおり日本語で赤ちゃんへ話しかけると、Emmaがその場面に合った短い英語で赤ちゃんへ参加することを目指します。単純な日本語→英語翻訳ではありません。

## Current scope

現在の初版は **Lite / Baby mode** です。

```text
Microphone
↓
Moonshine Japanese Small Streaming (browser-local WASM)
↓
LiteResponseEngine
↓
Supertonic 3 / F3 (browser-local CPU/WASM TTS)
↓
Emma avatar + PCM-linked lip sync
```

- 音声認識は全環境でMITライセンスのMoonshine Japanese Small Streaming（123M）のブラウザ内WASMを使用します
- ブラウザ標準のWeb Speech / SpeechRecognition APIは使用しません
- 初回はMoonshine（量子化モデル約121.8MB）、Supertonic 3等のモデル取得に通信を使う場合があります
- 認識・返答選択・音声生成の推論は端末内で実行します
- 標準TTSはSupertonic 3 / F3をCPU/WASMで実行します
- Android版Emmaとは別repositoryとして開発します
- Full Gemma modeは今後追加予定です

## Local development

HTTPSまたはlocalhostで開いてください。Moonshine WASMはSharedArrayBufferを使うため、GitHub PagesではService WorkerがCOOP/COEPを付与して初回に自動再読み込みします。

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
