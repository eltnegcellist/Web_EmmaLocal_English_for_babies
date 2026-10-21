# 抱っこ：顔が見える構図の静止原画（採用）

最新：顔ありの動画を制作・検証し、テスト版へ導入しました。[動画の制作・検証・導入記録](VISUAL_CUE_HUG_FACE_MOTION_2026-10-20.md)。以下の「未制作」は静止原画の承認時点の記録です。

2026-10-20追記：ユーザーの「抱っこに関しては顔が見えた方がいいです。」を受け、顔ありの静止原画を採用として記録しました。[承認記録](../assets/visual-cue/prototypes/hug-face/approval-20261020.json)。既存42点に静止原画1点を加え、採用済み原画・動画は合計43点（静止23・動画20）です。顔あり動画は未制作で、動画の採用数には加算しません。実行時表示の差し替えは、顔あり動作を制作・検証した後に行います。

以下は試作時の制作記録です。現在の採用状態はマニフェストと上の承認記録を参照してください。

ユーザーの「抱っこについて、顔が出るパターンも試作」という依頼に合わせ、既存の後ろ姿とは別に、大人と子どもの表情が両方見える斜め正面の構図を制作しました。人物の顔を描かない原則に対する、今回の依頼範囲の別案です。

## 保存したもの

- [生成原画PNG](../assets/visual-cue/prototypes/hug-face/hug-face-v1.png)：1254×1254 RGBA、1,335,128 bytes。背景透過。原画の内容は編集していません。
- [生成プロンプト・参照・使用ツール](../assets/visual-cue/prototypes/hug-face/PROMPT.md)：built-in image_genを使用。
- [試作マニフェスト](../assets/visual-cue/prototypes/hug-face/manifest.json)：`prototype-static` / `user-review-pending` / `animated: false`。
- [比較ページ](../visual-cue-hug-face.html)：採用済みの抱っこ動画と顔あり静止画を並べ、220・280・320px、透過模様・白・暗い色で確認できます。既存動画の停止・再開とOSのreduced-motionにも対応します。

## 状態と残課題

顔あり版は**静止構図の試作**です。「ぎゅっと寄せる」腕の動作は未制作で、アニメーション完成候補とはしていません。表情・構図・抱き方のユーザー確認が残ります。配信用512px/WebPの最適化もまだ行わず、生成原画を保存しています。外周には最大alpha 1の微小な生成残差がありますが、四隅はalpha 0です。

採用済み42素材、実行時カタログ、全1091原文の割当、既存の抱っこ動画を変更していません。新試作の英文割当は0件です。試作ページと原画は専用GitHub Pagesの比較用にだけ追加し、テスト版アプリの素材には含めません。コップ・起床・撤回済みの身振りの状態も維持します。mainへはマージしません。

## 確認

原画のRGBA・サイズ・SHA256・透過角を確認。比較ページの画像読込、表示サイズ、背景切替、既存動画の静止・再開、reduced-motion、390px画面の横はみ出しを実ブラウザで確認しました。[画面検証の記録](../assets/visual-cue/prototypes/hug-face/qa/browser-report.json) / [デスクトップ](../assets/visual-cue/prototypes/hug-face/qa/desktop.png) / [モバイル](../assets/visual-cue/prototypes/hug-face/qa/mobile.png)。自動検査は表情・意味の採用承認を代替しません。
