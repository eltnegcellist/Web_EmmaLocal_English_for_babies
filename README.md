# みつことば Web — 親と赤ちゃんとAI、3人でつくる英語の時間

## 日本語

みつことば Webは、APKをインストールせずブラウザやPWAで使える **みつことば Lite** です。

**Web版を開く**  
https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/

親が普段どおり日本語で赤ちゃんに話しかけると、AIがその場面に合った短くやさしい英語で赤ちゃんに参加します。単純な日本語→英語翻訳ではありません。

**「みつことば」**という名前には、**親・赤ちゃん・AIの3人でことばを交わす**という意味を込めています。親が話し、AIが返し、赤ちゃんの声や反応もやり取りのきっかけになる――家庭のいつもの時間に英語の話し手をもう一人加えるためのアプリです。

### なぜみつことばを作ったのか

#### 赤ちゃんの耳は、まだ一つの言語だけに決まっていない

乳児期の早い段階では、赤ちゃんは母語にはない外国語の音の違いにも高い感度を持っています。研究では、生後6〜12か月ごろにかけて、普段聞く言語の音へ知覚が徐々に最適化され、非母語の音声対立を聞き分ける能力が低下していくことが示されています。

これは単純に能力を失うというより、脳が身の回りの言語へ効率よく適応していく発達の一部と考えられています。みつことばは、この時期に家庭の中で英語の音・リズム・イントネーションへ自然に触れる機会を増やすことを目指しています。

#### ただ英語を流すだけとは違う

Kuhl、Tsao、Liuらの2003年の研究では、9か月の英語環境の乳児が、中国語の母語話者と12回の対面セッションを経験しました。その後、乳児は中国語特有の音の違いをよりよく識別しました。

一方、同じ外国語刺激を映像や音声を通して経験した条件では、同じような音韻学習は確認されませんでした。この研究は、外国語の音を聞く「量」だけでなく、社会的で相互作用のある経験が重要である可能性を示しています。

#### みつことばが目指していること

理想を言えば、英語話者が毎日の親子の時間に入り、赤ちゃんや親の様子に合わせて、その瞬間に合う英語を話してくれる環境です。しかし、それを家庭でいつも実現するのは簡単ではありません。

そこでみつことばは、親が普段どおり日本語で赤ちゃんに話しかけ、その内容を手がかりにAIが赤ちゃんへ英語で反応する仕組みにしました。親・赤ちゃん・AIの3人が同じ場面を共有することが、名前の由来です。

たとえば、

```text
親：「お風呂入ろうね」

みつことば AI:
“Bath time!”
“Splash, splash!”
“Here we go!”
```

みつことばの目的は「お風呂入ろうね」を単純に “Let’s take a bath.” と翻訳することではありません。今が「お風呂の時間」だと受け取り、その場にいる英語話者のように赤ちゃんへ直接話しかけることを目指しています。

#### なぜみつことばには顔があるのか

新生児が、スクランブルされた配置や空白の刺激よりも、顔らしく配置された刺激をより長く追視することを示した研究があります。

みつことばは単なる音声プレーヤーではなく、「誰かがこちらに話しかけている」感覚へ少しでも近づけるため、顔・口の動き・まばたき・表情を持つキャラクターとして設計しています。長時間画面を見せること自体を目的としているわけではありません。

#### 研究が証明していることと、みつことばが目指していること

重要な点として、Kuhlらの研究が調べたのは**生身の人間との社会的な外国語経験**です。AIキャラクターであるみつことばが同じ学習効果を生むことは、現時点で直接証明されていません。

みつことばは、「ただ外国語音声を流すだけではなく、相互作用のある言語経験が重要かもしれない」という研究上の示唆を、家庭で日常的に使える形へ近づけようとする試みです。

#### 参考研究

- [Kuhl, Tsao & Liu (2003)](https://doi.org/10.1073/pnas.1532872100) — *Foreign-language experience in infancy: Effects of short-term exposure and social interaction on phonetic learning*. PNAS 100(15), 9096–9101.
- [Werker & Tees (1984)](https://doi.org/10.1016/S0163-6383(84)80022-3) — *Cross-language speech perception: Evidence for perceptual reorganization during the first year of life*. Infant Behavior and Development 7(1), 49–63.
- [Kuhl (2007)](https://doi.org/10.1111/j.1467-7687.2007.00572.x) — *Is speech learning ‘gated’ by the social brain?* Developmental Science 10(1), 110–120.
- [Johnson et al. (1991)](https://doi.org/10.1016/0010-0277(91)90045-6) — *Newborns' preferential tracking of face-like stimuli and its subsequent decline*. Cognition 40(1–2), 1–19.

### 安定版の位置づけ

現在のWeb版 `main` は、Android v1.6.0を基準にしたブラウザ版です。Android v1.6.0自体は改名前の「Emma」表記で公開されています。

- Webアプリ: https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/
- Android安定版: https://github.com/eltnegcellist/Android_English_character_for_baby/releases/tag/mitsukotoba-v1.6.0
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
みつことばアバター + PCM連動口パク
```

### 音声認識

- Moonshineをブラウザ内WASMでローカル実行します
- 既定はJapanese Tiny Streamingです
- Small Streamingを高精度オプションとして追加できます
- ブラウザ標準のWeb Speech / SpeechRecognition APIは使用しません
- Moonshine 0.1.5のブラウザ用アセットを `src/vendor/moonshine/` に固定しています

### 音声合成

- Kitten TTS Nano 0.8 / Kikiをブラウザ内でローカル実行します
- みつことば側で固定したブラウザ専用ランタイムを使用します
- Node.jsの `fs` に依存しないブラウザ経路を使用します

### モデル取得

初回起動時に、選択した構成に必要なモデルを取得します。

標準構成はMoonshine Tiny Streaming + Kitten TTS Nanoです。Small Streamingは設定で選択した場合のみ追加取得します。

モデル準備後、音声認識・応答選択・音声合成はブラウザ内でローカル実行する設計です。

### なぜWeb版はLiteのみか

Web版は、軽量で導入しやすいみつことば体験に絞っています。

- APKインストール不要
- ブラウザ / PWAで利用可能
- ローカルASR
- ローカル応答選択
- ローカルTTS
- GitHub Pagesで公開

生成AIを使う **Full** はAndroid版で提供します。

### プライバシーとローカル処理

みつことば Webはローカル推論を中心に設計しています。

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

# Mitsukotoba Web — Local English for Babies

## English

Mitsukotoba Web is the browser/PWA edition of **Mitsukotoba Lite** and runs without installing an APK.

**Open Mitsukotoba Web**  
https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/

Parents can speak naturally in Japanese, and Mitsukotoba responds to the baby in short, simple English that fits the current situation. It is not intended to be a literal Japanese-to-English translator.

### Why Mitsukotoba Was Created

#### A baby's ear is not yet tuned to only one language

Early in infancy, babies are highly sensitive to speech-sound contrasts that may not exist in the language they hear every day. Research suggests that between roughly 6 and 12 months of age, speech perception gradually becomes optimized for the languages in the baby's environment, while sensitivity to some non-native phonetic contrasts declines.

This is not simply a loss of ability. It is generally understood as part of the brain's adaptation to the language environment around the child. Mitsukotoba aims to increase natural opportunities at home for babies to hear English sounds, rhythm, and intonation during this period.

#### More than simply playing English audio

In a 2003 study by Kuhl, Tsao, and Liu, 9-month-old infants from English-speaking environments took part in 12 face-to-face sessions with native Mandarin speakers. Afterwards, the infants showed improved discrimination of Mandarin phonetic contrasts.

Comparable phonetic learning was not observed when the same foreign-language material was presented through audiovisual or audio-only exposure. The study suggests that the amount of foreign-language sound alone may not be the whole story, and that social, interactive experience may matter.

#### What Mitsukotoba is trying to provide

In an ideal setting, an English speaker could join everyday parent-and-baby moments and say something appropriate in English based on what the baby and parent are doing at that exact moment. That is difficult to provide continuously in most homes.

Mitsukotoba is an attempt to approximate part of that experience. The parent continues speaking naturally in Japanese, Mitsukotoba uses the parent's speech as context, and then responds directly to the baby in English.

For example:

```text
Parent: 「お風呂入ろうね」

Mitsukotoba AI:
“Bath time!”
“Splash, splash!”
“Here we go!”
```

The goal is not to translate 「お風呂入ろうね」 into “Let’s take a bath.” Mitsukotoba instead recognizes that this is a bath-time moment and speaks to the baby as an English-speaking person present in that situation might.

#### Why does Mitsukotoba have a face?

Research has found that newborns may preferentially track face-like configurations compared with scrambled or blank stimuli.

Mitsukotoba is therefore designed not merely as an audio player, but as a character with a face, mouth movement, blinking, and expression, in an effort to make the experience feel more like someone is speaking to the baby. The goal is not to encourage prolonged screen viewing.

#### What the research shows — and what Mitsukotoba does not yet prove

An important limitation is that the Kuhl studies examined **social foreign-language experience with real human speakers**. There is currently no direct evidence that an AI character such as Mitsukotoba produces the same language-learning effect.

Mitsukotoba is an attempt to bring one implication of this research into an everyday home setting: foreign-language experience may be more meaningful when it is connected to interaction and context, rather than being only passive audio exposure.

#### References

- [Kuhl, Tsao & Liu (2003)](https://doi.org/10.1073/pnas.1532872100) — *Foreign-language experience in infancy: Effects of short-term exposure and social interaction on phonetic learning*. PNAS 100(15), 9096–9101.
- [Werker & Tees (1984)](https://doi.org/10.1016/S0163-6383(84)80022-3) — *Cross-language speech perception: Evidence for perceptual reorganization during the first year of life*. Infant Behavior and Development 7(1), 49–63.
- [Kuhl (2007)](https://doi.org/10.1111/j.1467-7687.2007.00572.x) — *Is speech learning ‘gated’ by the social brain?* Developmental Science 10(1), 110–120.
- [Johnson et al. (1991)](https://doi.org/10.1016/0010-0277(91)90045-6) — *Newborns' preferential tracking of face-like stimuli and its subsequent decline*. Cognition 40(1–2), 1–19.

### Stable Project Baseline

The current Web `main` is the browser-side stable companion to **Mitsukotoba Android v1.6.0**.

- Web app: https://eltnegcellist.github.io/Web_EmmaLocal_English_for_babies/
- Android stable release: https://github.com/eltnegcellist/Android_English_character_for_baby/releases/tag/mitsukotoba-v1.6.0
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
Mitsukotoba avatar + PCM-linked lip sync
```

### ASR

- Moonshine runs locally in browser WASM
- Japanese Tiny Streaming is the default model
- Small Streaming can be added as a higher-accuracy option
- The browser Web Speech / SpeechRecognition API is not used
- Moonshine 0.1.5 browser assets are pinned in `src/vendor/moonshine/`

### TTS

- Kitten TTS Nano 0.8 / Kiki runs locally in the browser
- The Web edition uses the browser-specific runtime bundled/pinned by Mitsukotoba
- The browser path does not depend on Node.js `fs`

### Model Download

The first launch downloads the models required by the selected configuration.

The default configuration uses Moonshine Tiny Streaming plus Kitten TTS Nano. Small Streaming is downloaded only when selected.

After model setup, recognition, response selection, and speech synthesis are designed to run locally in the browser.

### Why Lite Only?

The Web edition is intentionally focused on the lightweight Mitsukotoba experience.

- No APK installation
- Browser / PWA access
- Local ASR
- Local response selection
- Local TTS
- Simple deployment through GitHub Pages

The generative **Full** edition is provided by the Android application.

### Privacy and Local Processing

Mitsukotoba Web is designed around local inference.

- Microphone audio is processed locally for speech recognition
- Response selection runs locally
- Speech synthesis runs locally
- A cloud AI API is not required for normal conversation
- Network access is used for loading the app and downloading required model/runtime files

### First-Run Behavior

On first use, Mitsukotoba guides the user through initial setup, including the baby's name and required model preparation. Saved configuration is reused on later launches.

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
