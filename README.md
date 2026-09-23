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
Whisper tiny (browser-local ASR)
↓
LiteResponseEngine
↓
Supertonic 3 / F3 (browser-local CPU/WASM TTS)
↓
Emma avatar + PCM-linked lip sync
```

- 会話処理はブラウザ内ローカル実行を基本とします
- 初回はWhisper/Supertonic 3等のモデル取得に通信を使います
- TTSはSupertonic 3に一本化し、CPU/WASMで実行します（WebGPUはTTSでは使用しません）
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
