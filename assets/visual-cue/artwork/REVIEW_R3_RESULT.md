# 第3回レビューへの対応（2026-10-19）

追記：利用者は現行43素材を採用しました。[現在の採用記録](ADOPTION_20261019.md)。以下の「未承認」は制作・提出時点の履歴です。

利用者からの3点の指摘を受けた修正候補です。採用承認ではありません。

| 指摘 | 対応 |
| --- | --- |
| 指を持たれる大人の人差し指が長く、子の手がめり込む | 自然な開いた手を参照し、大人の中指を最長にして再制作。子の手が左から近づき、人差し指を外側から包む。先端を無理に突出させない。静止のみを提示。 |
| 握る動作は不自然なので手振りへ | 握り・指曲げの6ループを撤回。手振りは指・親指・掌がつながる原画を一枚のまま手首で振る。42フレーム、3.486秒、左右22度。 |
| ブロックに触れて離れる動作の用途が乏しい | 全914行を検索し、tap12行を文脈確認。雨4・音楽7・足1で、ブロックに触れる指示はなし。drink38行を参考にコップで飲む動画を追加。 |

単語境界・大小文字無視の一致で、wave6行、sip54行（milk31/drink23）、drink20行、squeeze4行。これは行数であり、実利用頻度や割当の適合性の自動承認ではありません。[全文とSHA256](qa/review-r3-usage.json)。

## 候補からの撤回と意味の管理

- 動画撤回：`hold-hands-squeeze`、`hand-open-close`、`hand-count`、`hand-wiggle`、`hand-squeeze-v3`、`hand-tap`。
- 上記6動画と旧hold-hands静止画の計7版を `archive/2026-10-19-r3` に保存。候補数へ重複計上しない。
- 異なる動作を手振りで代用しない。action.open-close/count/wiggle/squeeze/tapはassetIds空・missingへ。
- 修正対象外40点の静止・動画・ポスターのSHA256は[修正前基準](qa/review-r3-baseline.json)と比較。
- 現行は静止22枚・動画21本、合計43候補。新規採用承認0件。
- 14基本イラスト・10動作コンセプトは候補あり。58 Cueは候補31・missing5・起床draft1・Emma評価済み21。

## 検査とプレビュー

[素材の技術検査](qa/validation.json)、[全対応と実測](COVERAGE.md)、[今回の5フェーズ](qa/review-r3-keyframes.jpg)、[手振り全フレーム](qa/r3-allframes/hand-wave.jpg)、[コップ全フレーム](qa/r3-allframes/cup-sip.jpg)。素材43/43・動作と構造33/33項目がPASS。手の接続と一枚原画の輪郭保持、コップの液面変化と容器外の変化、撤回Cueの意味の整合、40点の不変を検査しました。手振りは42の原画フレームのうち同一の連続画像が統合され、WebPは40復号フレーム・計3.486秒です。全静止150KB以下・全動画400KB以下です。

[公開プレビュー](https://eltnegcellist.github.io/visual-cue-artwork-preview/?review=r3&filter=new#hold-hands) / [通常ブラウザー検査](qa/browser/report.json) / [単一HTML検査](qa/browser/offline-report.json)。通常版・単一HTML版とも31/31項目PASS、JSエラー・取得失敗なし。220/256/320px、停止・再開、Reduced Motion、スマホ幅、12動画の実表示変化、旧版比較、全フレーム表示を確認。[220pxの目視記録](qa/review-r3-visual.json)。公開版はPages配信コミットとHTML SHA256をdeployment.jsonに照合してから報告します。

技術検査と利用者の目視採用審査は別です。指の本数・長さ・接触の自然さは原画と220px表示で目視確認し、人体を画素接続テストだけで承認しません。握る等5 Cue、起床の意味、実機視認性、914英文の個別割当は残課題です。

原画は組込みImageGenで生成・編集。[指示全文・生成ID](sources/generation-r3.json)。最初のhold再生成は指の長さが改善せず不採用にして、自然な開いた手の別原画を基準に再生成しました。[再現手順](README.md#再現)。
