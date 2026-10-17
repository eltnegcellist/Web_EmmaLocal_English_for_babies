# Visual Cue 採用審査用素材（非ランタイム）

**制作対象の14基本イラスト・10動作すべてに審査候補を用意しました。静止20枚・透過動画25本、合計45候補。採用承認は0件です。** 旧試作2件は候補から除外し、別枠で保存しています。既存Emma 7状態は指示書どおり流用可否の評価だけ完了しました。

基準main `03a5bccbd62368cd5200bf2b86725f74940b8c20`、最新main確認 `ff14407`、ブランチ `codex/visual-cue-complete-assets`、[ドラフトPR #107](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/107)。アプリ本体・Emma表示切替・TTS・英文bank・Androidは変更していません。**mainにはマージしません。**

## プレビューを開く

- **[preview-offline.html](preview-offline.html)**：動画を含む単一HTML。ダウンロード／ローカルのファイルをブラウザで開くだけで動作し、サーバーやネット接続は不要です。GitHubのコード表示では動画は動きません。
- [ローカルHTTP版](http://127.0.0.1:8765/assets/visual-cue/artwork/preview.html)：リポジトリ直下で `python3 -m http.server 8765 --bind 127.0.0.1` を起動して開きます。

静止ポスターと動画を並べて表示。220/256/320px、明暗背景／透過チェック、全停止・個別停止・再生、1画面1素材、最終追加制作の絞り込みに対応します。Reduced Motionではポスターに停止します。旧試作・既存19点・Emma評価は別枠で閲覧できます。

[対応表と全実測](COVERAGE.md) / [素材検査](qa/validation.json) / [ブラウザ検査](qa/browser/report.json) / [オフライン検査](qa/browser/offline-report.json) / [最終追加の一覧](qa/browser/final-pass-overview.png)

## 今回埋めた制作対象

原画6点から、静止3枚と動画7本を追加しました。

| 候補 | 実際に動く部品・意味の範囲 |
| --- | --- |
| family-care / hug-arms | 両腕が毛布を包んで寄る。赤ちゃん本人や家族関係は描かず、抱き寄せる動作の候補 |
| tummy | 年齢を特定しない、おなかの部分図。へそと衣服の境界を明示 |
| hand-squeeze-v3 | 掌と親指で球を支え、上の4本の指を曲げて球を圧縮。旧試作を置換 |
| change-clothes | 黄色い服を脱ぐ→おなかが見える→青緑の服を着る。身体は部分図のみ |
| dress-sleeves | 片腕→もう片腕の順に袖を通す。肩側は実際に衣服で隠れる |
| change-diaper-exchange | オレンジの留め具の旧おむつを開き外す→青い留め具の新おむつを置き留める |
| wake-bed / wake-quilt | 掛け物を足元へ折り、寝具が現れて朝日が昇る。就寝と別素材 |
| care-burp | おなかに触れて手をやさしく動かすケア。げっぷが出た事実・背中を叩く意味は示さない |

抱き寄せ・身体部位・げっぷの構図と意味は特に目視採用審査が必要です。意味が合わなければ採用せず再制作します。「候補」は技術検査を通して審査できる状態であり、意味の採用承認ではありません。未完成の旧 `hand-squeeze` と `change-diaper` はそのまま昇格させず、置換済み試作に分けています。

## 必須10動作

| primitive | 制作候補 |
| --- | --- |
| motion.sip | 哺乳瓶の傾き＋水平な液面 |
| motion.water | 雨・シャワー・水しぶきの3種 |
| motion.hand | 拍手・手振り・開閉・握る・数える・指を動かす・タップ |
| motion.kick | 足首を支点に左右交互に蹴る |
| motion.page | 綴じ目を支点にページそのものをめくる |
| motion.change | 着替え・袖通し・おむつ交換・留め具・拭く・おなかのケア・起床 |
| motion.hug | 両腕を寄せて毛布を包む |
| motion.peekaboo | 布で玩具を隠す→見せる |
| motion.spoon | クリーム色のおかゆをすくう→持ち上げる→戻す |
| motion.notes | 静止した楽器の周囲で音符を拍に合わせて移動 |

58 Cueは物体／動作の37 Cueに候補、Emmaのみの21 Cueは流用評価済み。Emma neutralは待機表情、calmは目閉じ表情の流用候補、残り5状態は既存の待機・発話・まばたきでは意味不足と評価しました。専用表情の制作・アプリ統合は対象外です。**914英文の意味や最終割当が合格したという報告ではありません。**

## 自動検査と画質改善

全45素材と25ポスターの512×512・RGBA・外周余白を検査。動画は2.988秒または3.984秒、原則約12.05fpsで制作。符号化時に同一フレームは持続時間にまとまります。停止ポスターと編集用PNGを保持しています。

全フレームの透過・変化面積・220pxの動き・継ぎ目・輝度変化・固定部位を検査。動作別には拍手の接触、指の接続、数える段階、タップの接触、おむつの欠け／浮き、ファスナーの開閉、球の圧縮、抱き寄せの接触、服の色交換／おなかの露出、袖の順序、おむつの旧新交換、寝具の露出を画素から確認しています。数値は `qa/validation.json` が正です。

容量超過6動画はアルファの過剰な精度を調整し、**全静止150KB以下・全動画400KB以下**にしました。寸法・フレーム・タイミングは維持。220pxで明暗両背景の変更前後差を測定し、平均RGB誤差は0.244–0.494/255、95百分位は2–3/255。[比較実測](qa/encoding-improvements.json)参照。元の編集原画・部品は保持しています。

ブラウザでは実表示の時間差キャプチャーで主要11動画の動きを確認し、サイズ3種、停止／再生、Reduced Motion、絞り込み、390px幅、58 Cue／31コンセプト、試作の分離を検査します。HTTP版と単一HTMLをそれぞれ検査し、各素材のスクリーンショットと動画の5フェーズ比較を保存します。これは意味・人体の自然さ・乳児への分かりやすさを自動承認するものではありません。

## 出自・再現手順

実際の組込みImageGenで透過PNGを生成。保存原画は合計21点（初回11＋追加4＋最終6）、`sources/generated/`。正規化PNGは `sources/normalized/`、動く部品は `parts/`。生成指示と出力IDは [PROMPTS.md](PROMPTS.md)、[追加](sources/additional-prompts.json)、[最終](sources/final-prompts.json)。起床原画は最初の生成で余白が足りず、再編集してから採用候補にしました。参考商品の図版・ロゴ・キャラクターは模写していません。

ZIPは不変のバックアップ。SHA256 `73f04e328dc5aed60f810d6a3b4fcfa93f79e65030db2fb3c3b0c90165c6a700`、既存19点の分類は絵柄方向承認4・色修正方向性承認1・未完成候補5・hug再制作1・緑のおかゆ却下1・実験7。[inventory.csv](inventory.csv)参照。元の承認と今回の採用審査は別です。

```sh
python3 -m pip install -r scripts/visual-cue/requirements.txt
python3 scripts/verify-visual-cue-handoff.py
python3 scripts/visual-cue/build_artwork.py
python3 scripts/visual-cue/compact_artwork.py
python3 scripts/visual-cue/validate_artwork.py
python3 scripts/visual-cue/report_artwork.py
python3 scripts/visual-cue/export_preview.py
# HTTPサーバーを起動後（Playwright/Chromiumが必要）
node scripts/visual-cue/capture_preview.mjs
VISUAL_CUE_PREVIEW_URL="file://$PWD/assets/visual-cue/artwork/preview-offline.html" node scripts/visual-cue/capture_preview.mjs
```

最終追加だけ再生成する場合は `build_artwork.py --only-final`、2回目以降は `--only-new`。Pillow/numpyで原画から再現し、再生成にAIサービスやAPIキーは不要です。MacでPython 3.14.4 / Pillow 12.3.0 / numpy 2.5.1 / Chrome 155を使用。ライブラリ差で容量や符号化バイトは変わり得ます。

CIは `.github/workflows/visual-cue-artwork.yml`。QA・プレビューをartifactとして保存します。採用承認、実機での最終確認、914英文の最終意味割当は引き続き人の審査工程です。今回の候補以外の新しい表現の制作や本体実装は行いません。
