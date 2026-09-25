# Emma Web ― Local English for Babies

Emma Web is the APK-free browser/PWA edition of **Emma Lite**.

親が普段どおり日本語で赤ちゃんへ話しかけると、Emmaがその場面に合った短い英語で赤ちゃんへ参加することを目指します。単純な日本語→英語翻訳ではありません。

## Current scope

Web版は **Emma Liteのみ** です。

エディション構成は次のとおりです。

- **Android版:** Lite / Full
- **Web版:** Lite

```text
Microphone
↓
Moonshine Japanese Tiny Streaming (default) / Small Streaming (optional, browser-local WASM)
↓
LiteResponseEngine
↓
Kitten TTS Nano 0.8 FP32 / Kiki (browser-local WASM TTS)
↓
Emma avatar + PCM-linked lip sync
```

- 音声認識はMITライセンスのMoonshineをブラウザ内WASMで使用します。標準はJapanese Tiny Streaming（約32.3MB）で、設定からSmall Streamingを高精度オプションとして追加できます。Web版そのものはLiteのみです
- Moonshine 0.1.5の公式リリースアーカイブのJSとWASMを`src/vendor/moonshine/`に固定しています。WASMはgzipで配信し、ブラウザで展開後にSHA-256を照合して読み込みます。同じ0.1.5のnpm版WASMにはStreaming版のsplit frontend対応が欠けています
- ブラウザ標準のWeb Speech / SpeechRecognition APIは使用しません
- 初回は標準のMoonshine Tiny Streaming（約32.3MB）とKitten TTS Nano FP32（モデル・音声データ約60MB）、合計約90〜95MBの取得に通信を使います。Smallは初回には取得せず、設定で選んだ場合だけ追加取得します。推論用WASM本体（Moonshine圧縮時約6.4MB）とKittenのブラウザ用実行コードも別途取得します
- 認識・返答選択・音声生成の推論は端末内で実行します
- 標準TTSはKitten TTS Nano 0.8 FP32 / KikiをWASMで実行します
- Kittenのブラウザ実行コードはEmma側に固定したブラウザ専用ランタイムを使用し、Node.js用の`fs`処理は含みません
- 標準TTSはFP32モデルを固定使用し、INT8へ自動フォールバックしません
- Android版Emmaとは別repositoryとして開発します
- Web版はLiteのみです。FullはAndroid版で提供します

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
