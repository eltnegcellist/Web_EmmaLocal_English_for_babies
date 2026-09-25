# Emma Web — 赤ちゃん向けローカル英語コンパニオン
# Emma Web — Local English for Babies

Emma Webは、APKをインストールせずブラウザやPWAで使える **Emma Lite** です。  
Emma Web is the browser/PWA edition of **Emma Lite** and runs without installing an APK.

**Web版を開く / Open Emma Web**  
https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/

親が普段どおり日本語で赤ちゃんに話しかけると、Emmaがその場面に合った短くやさしい英語で赤ちゃんに参加します。単純な日本語→英語翻訳ではありません。  
Parents can speak naturally in Japanese, and Emma responds to the baby in short, simple English that fits the current situation. It is not intended to be a literal Japanese-to-English translator.

## 安定版の位置づけ / Stable Project Baseline

現在のWeb版 `main` は、**Emma Android v1.5.0** と対応するブラウザ版の安定基準です。  
The current Web `main` is the browser-side stable companion to **Emma Android v1.5.0**.

- Webアプリ / Web app: https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/
- Android安定版 / Android stable release: https://github.com/eltnegcellist/Android_English_character_for_baby/releases/tag/emma-v1.5.0
- Androidリポジトリ / Android repository: https://github.com/eltnegcellist/Android_English_character_for_baby

Web版は **Liteのみ** です。  
The Web edition is **Lite-only**.

| プラットフォーム / Platform | エディション / Editions |
| --- | --- |
| **Web** | Lite |
| **Android** | Lite / Full |

## 構成 / Architecture

```text
マイク / Microphone
↓
Moonshine Japanese Tiny Streaming
  └─ Small Streamingは任意 / optional
↓
LiteResponseEngine
↓
Kitten TTS Nano 0.8 / Kiki
↓
Emmaアバター + PCM連動口パク
Emma avatar + PCM-linked lip sync
```

## 音声認識 / ASR

- Moonshineをブラウザ内WASMでローカル実行します。  
  Moonshine runs locally in browser WASM.
- 既定はJapanese Tiny Streamingです。  
  Japanese Tiny Streaming is the default model.
- Small Streamingを高精度オプションとして追加できます。  
  Small Streaming can be added as a higher-accuracy option.
- ブラウザ標準のWeb Speech / SpeechRecognition APIは使用しません。  
  The browser Web Speech / SpeechRecognition API is not used.
- Moonshine 0.1.5のブラウザ用アセットを `src/vendor/moonshine/` に固定しています。  
  Moonshine 0.1.5 browser assets are pinned in `src/vendor/moonshine/`.

## 音声合成 / TTS

- Kitten TTS Nano 0.8 / Kikiをブラウザ内でローカル実行します。  
  Kitten TTS Nano 0.8 / Kiki runs locally in the browser.
- Emma側で固定したブラウザ専用ランタイムを使用します。  
  The Web edition uses the browser-specific runtime bundled/pinned by Emma.
- Node.jsの `fs` に依存しないブラウザ経路を使用します。  
  The browser path does not depend on Node.js `fs`.

## モデル取得 / Model Download

初回起動時に、選択した構成に必要なモデルを取得します。  
The first launch downloads the models required by the selected configuration.

標準構成はMoonshine Tiny Streaming + Kitten TTS Nanoです。Small Streamingは設定で選択した場合のみ追加取得します。  
The default configuration uses Moonshine Tiny Streaming plus Kitten TTS Nano. Small Streaming is downloaded only when selected.

モデル準備後、音声認識・応答選択・音声合成はブラウザ内でローカル実行する設計です。  
After model setup, recognition, response selection, and speech synthesis are designed to run locally in the browser.

## なぜWeb版はLiteのみか / Why Lite Only?

Web版は、軽量で導入しやすいEmma体験に絞っています。  
The Web edition is intentionally focused on the lightweight Emma experience.

- APKインストール不要  
  No APK installation
- ブラウザ / PWAで利用可能  
  Browser / PWA access
- ローカルASR  
  Local ASR
- ローカル応答選択  
  Local response selection
- ローカルTTS  
  Local TTS
- GitHub Pagesで公開  
  Simple deployment through GitHub Pages

生成AIを使う **Full** はAndroid版で提供します。  
The generative **Full** edition is provided by the Android application.

## プライバシーとローカル処理 / Privacy and Local Processing

Emma Webはローカル推論を中心に設計しています。  
Emma Web is designed around local inference.

- マイク音声は音声認識のためブラウザ内で処理  
  Microphone audio is processed locally for speech recognition
- 応答選択はローカル実行  
  Response selection runs locally
- 音声合成はローカル実行  
  Speech synthesis runs locally
- 通常の会話にクラウドAI APIは不要  
  A cloud AI API is not required for normal conversation
- ネットワーク通信はアプリ本体や必要なモデル・ランタイムの取得に使用  
  Network access is used for loading the app and downloading required model/runtime files

## 初回起動 / First-Run Behavior

初回利用時は、赤ちゃんの名前などの初期設定と、必要なモデル準備を案内します。設定内容は保存され、2回目以降に再利用されます。  
On first use, Emma guides the user through initial setup, including the baby's name and required model preparation. Saved configuration is reused on later launches.

## ローカル開発 / Local Development

HTTPSまたはlocalhostで開いてください。  
Use HTTPS or localhost.

Moonshine WASMはcross-origin isolationを必要とするブラウザ機能を使います。GitHub PagesではService Workerを使って必要な環境を整え、初回初期化時に自動再読み込みする場合があります。  
Moonshine WASM uses browser features that require cross-origin isolation. On GitHub Pages, the app uses its Service Worker setup to provide the required environment and may reload automatically during first initialization.

```bash
python3 -m http.server 8080
```

その後、次を開きます。  
Then open:

```text
http://localhost:8080
```

開発用テキスト入力を表示する場合はURL末尾に次を付けます。  
For development-only text input, append:

```text
?debug=1
```

## 公開 / Deployment

`main` の更新はテスト後、GitHub Pagesへ公開します。  
Updates to `main` are tested and then deployed to GitHub Pages.

**現在の公開URL / Current public URL**  
https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/

## Android版 / Android Edition

Lite + Full、および安定版Android APKはこちらです。  
For Lite + Full and the stable Android APK:

https://github.com/eltnegcellist/Android_English_character_for_baby
