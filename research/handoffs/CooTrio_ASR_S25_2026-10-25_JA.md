# CooTrio ASR研究・S25実機比較 引き継ぎ（2026-10-25）

**このメモは研究用。公開Web、main、Android、本番Topic/Interactionヘッドを変更しない。**

## 最優先の現在地
- Galaxy S25 Chromeで **Vosk Small英語WASMは実機確認済み**。入力 `milk-invite-B-legacy.wav`、5秒窓＋0.8秒無音、5回最終認識。
- Vosk実機: **p50 1,367.49ms、p95 1,418.78ms、RTF 0.24、モデル読み込み637.57ms**（キャッシュ影響あり）。5回: 1431.59/1337.08/1355.15/1367.49/1367.56ms。旧Voskページの13.8msはpartial/late-eventの計測不具合疑いにつき不採用。
- **同一音声でのMoonshine Small / Whisper Small S25測定は未完了**。ユーザーの旧版比較ページでは両モデルが `読み込みエラー：Benchmark worker failed`。
- その後、#152で研究ページ配下のService WorkerによるCOOP/COEP/CORPを**module workerと同一オリジン読み込み先にも付加**するよう修正、Workerモジュールのlazy importとping診断を追加。**CI #40093650706 は成功**。ただしCIで最後まで認識を実行したのはVoskのみ。Moonshine/WhisperのS25復旧は未確認。

## 開く場所
- 研究Draft PR: https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/152
- この時点の研究コミット: `147b03cd26c62111328196736a51df09e497f88a`
- 固定テストページ: https://rawcdn.githack.com/eltnegcellist/Web_EmmaLocal_English_for_babies/147b03cd26c62111328196736a51df09e497f88a/research/s25-vosk-browser-benchmark/compare.html
- CI: https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/actions/runs/40093650706
- 対象コード: `research/s25-vosk-browser-benchmark/compare.js`、`compare.html`、`coi-service-worker.js`、`moonshine-bench-worker.js`、`whisper-bench-worker.js`。

## 次の担当への手順
1. **S25 Chromeで固定比較ページを再実行**。分離状態 `crossOriginIsolated=true` を確認。
2. `milk-invite-B-legacy.wav`を選択。Moonshine Smallのロード成否を確認し、失敗時は表示エラー全文・Worker/WASMのネットワークエラー・コンソールを採取。Whisper Smallでも同様。
3. Workerスクリプト、`src/moonshine-module.js`／`src/multilingual/`の依存importが同一オリジンで200、COEP/CORP付与済みか確認。Workerは起動するがモデルDLで失敗するならモデルURL、キャッシュ、WASM、容量・スレッドを調査。
4. **MoonshineとWhisperが実際にASRまで成功した場合のみ**、同じファイルの5秒／10秒＋0.8秒をそれぞれ5回処理し、p50/p95/RTF/モデルロード時間/認識テキストのJSONを回収。3モデルを同時ロードしない。
5. E5分類を含む最終遅延は、ASR単体の同一条件比較の後に別途測定。発話終了から応答までのストリーミング遅延とオフライン一括処理時間を混同しない。

## モデル選定の暫定方針
- 日本語 Moonshine Small + Ruri v3 70M が基準。
- 英語・ドイツ語・中国語は **Moonshine MIT系**の軽量候補を優先。
- タイ語 PengChengStarling、ヒンディー語 Vosk Small をユーザーは採用候補として希望（**本番導入済みではない**）。
- フランス語 Vosk Small: Linux合成音声22文でCER5.9%、ASR p50 813ms、Topic+Interaction 10/22と有望。S25実機と自然音声で未検証。
- 韓国語 Vosk Small: Linux合成音声でCER81.7%、両軸1/22。軽いが精度不足。旧Moonshine韓国語Tinyは非商用。
- Zipformerは評価から外す。200M～1.7B級の大型Whisper/Qwenはスマホ要件に比べ重いため優先しない。

## 分類研究・関連PR
- 二軸分類：Topic 22クラス、Interaction 15クラス。外国語はASR→E5、独立した分類ヘッド。
- 合成研究候補1,810文、両軸ラベル932文。人手レビュー済み0件。研究用学習結果は本番へ未投入。
- [#145](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/145) 初期言語特化、
  [#146](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/146) データと再学習、
  [#147](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/147) 新規154文検証、
  [#148](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/148) 8言語ASR比較、
  [#149](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/149) 韓仏特化Whisper、
  [#150](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/150) 韓仏軽量Vosk、
  [#151](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/151) Vosk S25ベンチ、
  **[#152](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/152) 3-ASR同一音声測定・Worker修正**。
- これらはDraft PR。#145→#150の研究スタックとは別に#151はmainから派生、#152は#151がbase。**研究スタックをそのままmainにマージしない**。

## 次のChatGPTに渡す要約
> CooTrio ASR研究の続き。Galaxy S25 ChromeのVosk Small英語は5秒音声＋0.8秒無音でp50 1367.49ms、p95 1418.78ms、RTF0.24（5回のfinal認識）。Moonshine SmallとWhisper Smallは旧比較ページでBenchmark worker failed。研究Draft #152はWorker/COOP/COEPを修正しCI成功（ただしS25では未再確認）。最新比較ページをS25で再実行し、失敗時は実際のWorker初期化エラーを収集・修正する。同じwavを5秒/10秒×5回で3モデル比較する。本番変更禁止。
