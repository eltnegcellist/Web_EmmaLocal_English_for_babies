# Visual Cue 採用済み素材（2026-10-19）

**静止22枚・動画21本、計43点は2026-10-19に利用者が採用しました。** [採用記録](ADOPTION_20261019.md) / [対象ファイルとSHA256](approval-20261019.json)。 第3回の指摘を受け、指を握る静止画と手振りを置換、コップで飲む動画を追加しました。不自然さが残る6動画を撤回。修正対象外40点の静止画・動画・ポスターはSHA256一致を検査します。

**[GitHub Pagesで今回の3候補を開く](https://eltnegcellist.github.io/visual-cue-artwork-preview/?review=r3&filter=new#hold-hands)**

[第3回の修正記録](REVIEW_R3_RESULT.md) / [全対応と実測](COVERAGE.md) / [英文の利用場面監査](qa/review-r3-usage.json)

## 今回の修正

- **手をつなぐ静止画**：通常の開いた手を基準に、大人の中指が最も長い形へ。子の手を左から近づけ、人差し指を外側から包む構図へ再制作。大人の指を子の手へ向けて引き延ばさず、指先を無理に突き出さない。
- **手振り**：親指・4本の指・掌・手首を含む一枚の原画を使い、手首を支点に左右22度動かす。指を分割して曲げる構成は使わない。42フレーム・3.486秒。
- **ブロックタップを撤回**：実英文914行のtap12行は雨4・音楽7・足1で、ブロックに触れる指示はなし。代わりにdrinkの38行を参考に**コップで飲む**動画を追加。容器の傾きに合わせて液面は水平を保ち、見える液体量が変わる。口や人物は描かない。

`hold-hands-squeeze / hand-open-close / hand-count / hand-wiggle / hand-squeeze-v3 / hand-tap` は現行候補から除外。旧7版（上記6動画とhold-hands静止画）は不採用履歴へ保存しました。旧版のファイルが存在しても、現行候補には数えません。

## 状態と残課題

14基本イラスト・10種類の動作コンセプトに採用済み素材があります。ただし、個々の動作Cueの完成とは別です。58 Cueは候補31、未制作5、起床draft1、Emma評価済み21。**握る・開閉・数える・指の独立動作・タップの5 Cueは未制作へ戻し、異なる意味の手振りで埋めません。** action.wakeは空の寝床と朝日の代案であり、本人が起きる動作の採用は保留です。

既存ZIP19点の分類と原本を保持。旧不採用37版は候補と別枠です。全43素材は利用者による採用済みです。実機での見やすさ、914英文の個別割当が残ります。技術検査のPASSを採用承認へ読み替えません。

過去の[第2回記録](REVIEW_R2_RESULT.md)と[第1回記録](REVISION_20261018.md)は当時の履歴です。現行の手の採否は第3回の判断を優先してください。

## プレビュー

GitHub Pagesの「今回の候補」は3点を表示します。静止と動画を並べ、220/256/320px、明暗・透過確認背景、全停止・個別再生、5フェーズと全フレームを比較できます。手をつなぐカードの「指摘された旧版の静止画と比較」で直前の旧版を表示できます。全候補はフィルターで選択してください。

サーバーなしでは [preview-offline.html](preview-offline.html) をダウンロードしてブラウザーで開けます。通常版はリポジトリ直下で次を実行します。

```sh
python3 -m http.server 8765 --bind 127.0.0.1
# http://127.0.0.1:8765/assets/visual-cue/artwork/preview.html
```

## 再現

```sh
python3 -m pip install -r scripts/visual-cue/requirements.txt
python3 scripts/verify-visual-cue-handoff.py
python3 scripts/visual-cue/audit_r3_usage.py
python3 scripts/visual-cue/build_artwork.py --only-r3
python3 scripts/visual-cue/compact_artwork.py
python3 scripts/visual-cue/apply_approval.py
python3 scripts/visual-cue/validate_artwork.py
python3 scripts/visual-cue/report_artwork.py
python3 scripts/visual-cue/export_preview.py
# 上のHTTPサーバーを起動後
node scripts/visual-cue/capture_preview.mjs
VISUAL_CUE_PREVIEW_URL="file://$PWD/assets/visual-cue/artwork/preview-offline.html" node scripts/visual-cue/capture_preview.mjs
```

ImageGenで生成・編集した透過PNGは `sources/generated/hold-r3.png` と `cup-empty-r3.png`。不採用の最初の指描き直しも別ファイルで保存。[プロンプト全文・生成ID](sources/generation-r3.json)を記録しています。保存原画からのアニメーション再生成はAI/APIキーを使いません。

制作ブランチは `codex/visual-cue-complete-assets`、[ドラフトPR #107](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/107)、進捗は[Issue #104](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/issues/104)。mainにマージせず、アプリ本体・Emma表示切替は実装しません。
