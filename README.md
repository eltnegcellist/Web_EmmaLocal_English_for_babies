# Emma Web — 赤ちゃん向けローカル英語コンパニオン

## 日本語

Emma Webは、APKをインストールせずブラウザやPWAで使える **Emma Lite** です。

**Web版を開く**  
https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/

親が普段どおり日本語で赤ちゃんに話しかけると、Emmaがその場面に合った短くやさしい英語で赤ちゃんに参加します。単純な日本語→英語翻訳ではありません。

### 安定版の位置づけ

現在のWeb版 `main` は、**Emma Android v1.5.0** と対応するブラウザ版の安定基準です。

- Webアプリ: https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/
- Android安定版: https://github.com/eltnegcellist/Android_English_character_for_baby/releases/tag/emma-v1.5.0
- Androidリポジトリ: https://github.com/eltnegcellist/Android_English_character_for_baby

Web版は **Liteのみ** です。

| プラットフォーム | エディション |
| --- | --- |
| **Web** | Lite |
| **Android** | Lite / Full |

### 構成

```text
マイク
↓
Moonshine Japanese Tiny Streaming
  └─ Small Streamingは任意
↓
LiteResponseEngine
↓
Kitten TTS Nano 0.8 / Kiki
↓
Emmaアバター + PCM連動口パク
```

### 音声認識

- Moonshineをブラウザ内WASMでローカル実行します
- 既定はJapanese Tiny Streamingです
- Small Streamingを高精度オプションとして追加できます
- ブラウザ標準のWeb Speech / SpeechRecognition APIは使用しません
- Moonshine 0.1.5のブラウザ用アセットを `src/vendor/moonshine/` に固定しています

### 音声合成

- Kitten TTS Nano 0.8 / Kikiをブラウザ内でローカル実行します
- Emma側で固定したブラウザ専用ランタイムを使用します
- Node.jsの `fs` に依存しないブラウザ経路を使用します

### モデル取得

初回起動時に、選択した構成に必要なモデルを取得します。

標準構成はMoonshine Tiny Streaming + Kitten TTS Nanoです。Small Streamingは設定で選択した場合のみ追加取得します。

モデル準備後、音声認識・応答選択・音声合成はブラウザ内でローカル実行する設計です。

### なぜWeb版はLiteのみか

Web版は、軽量で導入しやすいEmma体験に絞っています。

- APKインストール不要
- ブラウザ / PWAで利用可能
- ローカルASR
- ローカル応答選択
- ローカルTTS
- GitHub Pagesで公開

生成AIを使う **Full** はAndroid版で提供します。

### プライバシーとローカル処理

Emma Webはローカル推論を中心に設計しています。

- マイク音声は音声認識のためブラウザ内で処理
- 応答選択はローカル実行
- 音声合成はローカル実行
- 通常の会話にクラウドAI APIは不要
- ネットワーク通信はアプリ本体や必要なモデル・ランタイムの取得に使用

### 初回起動

初回利用時は、赤ちゃんの名前などの初期設定と、必要なモデル準備を案内します。設定内容は保存され、2回目以降に再利用されます。

### ローカル開発

HTTPSまたはlocalhostで開いてください。

Moonshine WASMはcross-origin isolationを必要とするブラウザ機能を使います。GitHub PagesではService Workerを使って必要な環境を整え、初回初期化時に自動再読み込みする場合があります。

```bash
python3 -m http.server 8080
```

その後、次を開きます。

```text
http://localhost:8080
```

開発用テキスト入力を表示する場合はURL末尾に次を付けます。

```text
?debug=1
```

### 公開

`main` の更新はテスト後、GitHub Pagesへ公開します。

**現在の公開URL**  
https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/

### Android版

Lite + Full、および安定版Android APKはこちらです。

https://github.com/eltnegcellist/Android_English_character_for_baby

---

# Emma Web — Local English for Babies

## English

Emma Web is the browser/PWA edition of **Emma Lite** and runs without installing an APK.

**Open Emma Web**  
https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/

Parents can speak naturally in Japanese, and Emma responds to the baby in short, simple English that fits the current situation. It is not intended to be a literal Japanese-to-English translator.

### Stable Project Baseline

The current Web `main` is the browser-side stable companion to **Emma Android v1.5.0**.

- Web app: https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/
- Android stable release: https://github.com/eltnegcellist/Android_English_character_for_baby/releases/tag/emma-v1.5.0
- Android repository: https://github.com/eltnegcellist/Android_English_character_for_baby

The Web edition is **Lite-only**.

| Platform | Editions |
| --- | --- |
| **Web** | Lite |
| **Android** | Lite / Full |

### Architecture

```text
Microphone
↓
Moonshine Japanese Tiny Streaming
  └─ Small Streaming is optional
↓
LiteResponseEngine
↓
Kitten TTS Nano 0.8 / Kiki
↓
Emma avatar + PCM-linked lip sync
```

### ASR

- Moonshine runs locally in browser WASM
- Japanese Tiny Streaming is the default model
- Small Streaming can be added as a higher-accuracy option
- The browser Web Speech / SpeechRecognition API is not used
- Moonshine 0.1.5 browser assets are pinned in `src/vendor/moonshine/`

### TTS

- Kitten TTS Nano 0.8 / Kiki runs locally in the browser
- The Web edition uses the browser-specific runtime bundled/pinned by Emma
- The browser path does not depend on Node.js `fs`

### Model Download

The first launch downloads the models required by the selected configuration.

The default configuration uses Moonshine Tiny Streaming plus Kitten TTS Nano. Small Streaming is downloaded only when selected.

After model setup, recognition, response selection, and speech synthesis are designed to run locally in the browser.

### Why Lite Only?

The Web edition is intentionally focused on the lightweight Emma experience.

- No APK installation
- Browser / PWA access
- Local ASR
- Local response selection
- Local TTS
- Simple deployment through GitHub Pages

The generative **Full** edition is provided by the Android application.

### Privacy and Local Processing

Emma Web is designed around local inference.

- Microphone audio is processed locally for speech recognition
- Response selection runs locally
- Speech synthesis runs locally
- A cloud AI API is not required for normal conversation
- Network access is used for loading the app and downloading required model/runtime files

### First-Run Behavior

On first use, Emma guides the user through initial setup, including the baby's name and required model preparation. Saved configuration is reused on later launches.

### Local Development

Use HTTPS or localhost.

Moonshine WASM uses browser features that require cross-origin isolation. On GitHub Pages, the app uses its Service Worker setup to provide the required environment and may reload automatically during first initialization.

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

For development-only text input, append:

```text
?debug=1
```

### Deployment

Updates to `main` are tested and then deployed to GitHub Pages.

**Current public URL**  
https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/

### Android Edition

For Lite + Full and the stable Android APK:

https://github.com/eltnegcellist/Android_English_character_for_baby
