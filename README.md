# Emma Web — Local English for Babies

Emma Web is the browser/PWA edition of **Emma Lite**. It runs without installing an APK.

**Open the current Web edition:**  
https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/

親が普段どおり日本語で赤ちゃんに話しかけると、Emmaがその場面に合った短くやさしい英語で赤ちゃんに参加することを目指します。単純な日本語→英語翻訳ではありません。

## Stable project baseline

The current Web `main` is the browser-side stable companion to **Emma Android v1.5.0**.

- Web app: https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/
- Android stable release: https://github.com/eltnegcellist/Android_English_character_for_baby/releases/tag/emma-v1.5.0
- Android repository: https://github.com/eltnegcellist/Android_English_character_for_baby

Web版は **Liteのみ** です。

| Platform | Editions |
| --- | --- |
| **Web** | Lite |
| **Android** | Lite / Full |

## Architecture

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

- Moonshine runs locally in browser WASM.
- Japanese Tiny Streaming is the default model.
- Small Streaming can be added as a higher-accuracy option.
- The browser Web Speech / SpeechRecognition API is not used.
- Moonshine 0.1.5 browser assets are pinned in `src/vendor/moonshine/`.

### TTS

- Kitten TTS Nano 0.8 / Kiki runs locally in the browser.
- The Web edition uses the browser-specific runtime bundled/pinned by Emma.
- Node.js `fs`-dependent behavior is not required in the browser path.

### Model download

The first launch downloads the models required by the selected configuration.

The default configuration uses Moonshine Tiny Streaming plus Kitten TTS Nano. Small Streaming is downloaded only when selected.

After model setup, recognition, response selection, and speech synthesis are designed to run locally in the browser.

## Why Lite only?

The Web edition is intentionally focused on the lightweight Emma experience:

- no APK installation
- browser/PWA access
- local ASR
- local response selection
- local TTS
- simple deployment through GitHub Pages

The generative **Full** edition is provided by the Android application.

## Local processing and privacy

Emma Web is designed around local inference.

- microphone audio is processed locally for speech recognition
- response selection runs locally
- speech synthesis runs locally
- a cloud AI API is not required for normal conversation
- network access is used for loading the app and downloading required model/runtime files

## First-run behavior

On first use, Emma guides the user through initial setup, including the baby's name and the required model preparation. After setup, the saved configuration is reused on later launches.

## Local development

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

## Deployment

Updates to `main` are tested and then deployed to GitHub Pages.

Current public URL:

https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/

GitHub Pages deployment is based on the repository's Pages branch/workflow configuration.

## Android edition

For Lite + Full and the stable Android APK:

https://github.com/eltnegcellist/Android_English_character_for_baby
