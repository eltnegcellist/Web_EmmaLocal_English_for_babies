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
端末内Web Speech ASR（対応時） / Whisper tiny（完全ローカルFallback）
↓
LiteResponseEngine
↓
Supertonic 3 / F3 (browser-local CPU/WASM TTS)
↓
Emma avatar + PCM-linked lip sync
```

- 日本語ASRは端末内処理のみ。対応ブラウザでは `SpeechRecognition.processLocally = true` を優先し、非対応環境だけWhisperをブラウザ内で使います
- 初回はオンデバイス音声認識データ、またはFallback用WhisperとTTSモデルの取得に通信を使う場合があります
- 標準TTSはSupertonic 3 / F3をCPU/WASMで実行します
- 速度比較用にKitten Nano INT8（CPU/WASM）を一時的に選択でき、同じ例文で生成速度を比較できます
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


## ASRの方針

Web版は完全ローカルを維持します。

1. ブラウザがオンデバイスWeb Speech APIに対応し、日本語を端末内で認識できる場合はそれを優先します。
2. 対応しないブラウザ（Safari / iOS Safariなど）では、Whisper tinyをブラウザ内で実行します。
3. クラウド音声認識にはフォールバックしません。

WebページからiOS / macOS / Windows / AndroidのネイティブOS音声認識APIを直接呼ぶことはできないため、この構成でクロスプラットフォーム性と完全ローカルを両立します。
