# 顔あり抱っこ動画の制作とテスト版導入（2026-10-20）

ユーザーの「顔ありも動画にしてから実装」に従い、採用済みの顔あり原画から動画と静止ポスターを制作しました。動画の技術検証に合格してから、作業ブランチのテスト版へ導入しています。本番更新・mainへのマージは行いません。

## 動画

- [透過animated WebP](../assets/visual-cue/motion-variants/hug-face-cuddle.webp)：512×512、3.2秒ループ、40描画フレーム・配信時26フレーム（同じ絵の保持区間をまとめたため）。
- [静止ポスター](../assets/visual-cue/motion-variants/hug-face-cuddle-poster.webp)：初期姿勢と同じ絵。動作オフ・OSのreduced-motionで表示します。
- [原画](../assets/visual-cue/prototypes/hug-face/hug-face-v1.png)と[生成プロンプト](../assets/visual-cue/prototypes/hug-face/PROMPT.md)を維持。新しい画像生成や原画の上書きはしていません。
- 動くのは、背中に添えた手・前腕と、下から支える手・前腕です。SVGの滑らかな局所変位をブラウザで描画し、腕を少し寄せ、戻します。人物全体を揺らす方法は使いません。
- 顔・頭・首・上半身は静止。圧縮後の実WebPでも、顔を含む上部280pxの可視画素差は全フレームで0です。

動画553,318 bytes、ポスター155,340 bytes。動画400KB・静止150KBの目標を超えています。通常の非可逆圧縮ではフレーム間で顔の色が変わったため、ちらつきを避ける可逆圧縮を選びました。

## 導入範囲と承認

顔ありの**静止原画**はユーザー承認済みです。新しい腕の動きは確認候補であり、動画の採用承認を自動で付けません。素材採用数は43点（静止23・動画20）のままです。

既存の抱っこ動画へ割り当てていた42原文を `hug-face-cuddle` へ、抱っこの静止表示だった2原文を `hug-face-v1` へ変更しました。終了・待機などで静止表示にしていた文を動画に変更していません。旧顔なし動画は比較用に保存し、実行時の対象から外しています。44件すべての変更前後を[個別台帳](../shared/visual-cue-hug-face-overrides.json)に記録しています。

全1091原文のうち、採用済み物体動画366件、新しい動作7候補183件、背景候補123件、静止145件、通常Emma274件です。物体動作は候補込み549件、背景込み672件（61.59%）で、追加アニメーションなし419件（38.41%）は前回から変わりません。旧顔なし42件を「採用済み動画」から「新しい動作候補」へ分類し直したため、承認区分別の件数は変化しています。

## 検証

- npm test成功。実行時カタログ・独立集計・44件の変更台帳を照合し、コップ・起床の保留と撤回した手の動作を維持します。
- ブラウザ描画：動く画素4,981、顔を含む上部の差分0。最初と最後の絵は一致し、四隅は透過。
- 配信用WebPを独立に復号し、3.2秒・無限ループ、顔の可視画素差0、初期姿勢とポスターの一致、ループ端の一致、透過角、原画のSHA256維持を確認。
- 実画面118項目に成功。新しい動画の実AAC再生、動作オフのポスター、停止・終了、静止のまま残す2件、比較ページ、モバイルを検証しました。最新の成功結果は[実画面の記録](../assets/visual-cue/trial-qa/browser-report.json)を参照。

[描画・エンコードの検証](../assets/visual-cue/prototypes/hug-face/qa/motion-validation.json) / [配信ファイルの独立検証](../assets/visual-cue/prototypes/hug-face/qa/motion-delivery-validation.json)

再生成は `build_hug_face_motion.mjs`（Chromium）→ `encode_hug_face_motion.py`（描画PNGの形式エンコードのみ）→ `verify_hug_face_motion.py` → `build_runtime_catalog.py` → `build_ui_preview.py` → `build_trial_data.py`。一時PNGは `frames/` に生成しGit管理しません。腕の動きの元になる[SVG](../assets/visual-cue/prototypes/hug-face/hug-face-motion-source.svg)と描画スクリプトを保存しています。

[比較ページ](https://eltnegcellist.github.io/visual-cue-artwork-preview/visual-cue-hug-face.html) / [音声付きテスト版](https://eltnegcellist.github.io/visual-cue-artwork-preview/test/?target=hug-face-cuddle) / [現在の英文対応数](VISUAL_CUE_COVERAGE_2026-10-20.md)
