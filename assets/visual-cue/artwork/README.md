# Visual Cue 第2回修正候補（2026-10-18）

**静止22枚・動画26本、計48点の審査候補。採用承認は0件です。** [第2回評価](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/107#issuecomment-6249317494)を受けて11点を置換。修正対象外の37点の静止画・動画・ポスターはSHA256一致を検査します。

**[GitHub Pagesで第2回修正版を開く](https://eltnegcellist.github.io/visual-cue-artwork-preview/?review=r2&filter=new#hold-hands)**

[第2回の修正結果・5フェーズ・再現手順](REVIEW_R2_RESULT.md) / [受入条件](REVIEW_REQUEST_20261018_R2.md) / [全対応と実測](COVERAGE.md)

## 今回の修正

- **手をつなぐ**：大人の指先が子の握りの先へ見える、連続した一枚の原画へ再制作。小さな手の握り周辺だけを動かす。
- **親指と掌**：母指球から掌へ一体の形を新しく描き、別の親指を貼る構成を廃止。静止画は手全体の一枚絵。動作は一体の掌・親指を保ち、従来の4本の指の部品を再利用。数える動画は親指から1本→5本と明示。タップは手全体の新しい指差し原画。
- **寝床**：枕・掛け布団を含む旧原画を撤回。空のベビーベッドと平らなマットレス／フィットシーツへ原画から再制作。赤ちゃん、枕、掛け布団、玩具、バンパーを置かない。
- **起床**：掛け布団を動かす `wake-quilt` を候補から撤回。空の寝床を固定し、外側の朝日だけが動く `wake-daylight` を別案として提示。本人が起きる動作は描かないため、**action.wakeはdraftへ戻し、意味の採用を保留**。
- **キック**：内向きの親指と足首の支点を維持。26度・42フレーム・3.486秒へ再出力。左右同時の鏡像動作をやめ、片足ずつ交互に動かす。

寝床の構成は[NHSの空で平らな寝床に関する説明](https://www.nhs.uk/baby/caring-for-a-newborn/sudden-infant-death-syndrome-sids/)を参照。イラストの適否や育児姿勢を技術テストで自動承認しません。

## 状態と比較プレビュー

14基本イラスト・10動作には候補があります。58 Cueは物体・動作36件に候補、起床1件は代案の意味審査待ち、Emmaのみ21件は流用可否の評価済みです。Emma7状態は従来の評価のみです。**914英文の割当品質は承認していません。**

既存ZIP19点の分類を保持。第1回で撤回した17点と旧試作2点、今回撤回した11点は別枠の不採用履歴です。候補48点へ重複計上しません。過去の[第1回修正記録](REVISION_20261018.md)と画像は当時の記録で、現行の寝床・手の判断は第2回の結果を優先します。

Pagesでは「今回の修正・追加」で第2回の11点を比較できます。「日常の基本場面」「すべてのvariant」へ切替可能。静止画と動画を並べ、220/256/320px、明暗・透過背景、全停止・個別停止、Reduced Motion、スマホ表示に対応。カードの「指摘された旧版の静止画と比較」は直近の不採用版です。5フレーム一覧は同じページ内で開きます。

[単一HTML](preview-offline.html)はダウンロードしてブラウザで直接開けます。HTTP版はリポジトリ直下で `python3 -m http.server 8765 --bind 127.0.0.1` → `assets/visual-cue/artwork/preview.html`。

[素材検査](qa/validation.json) / [ブラウザー検査](qa/browser/report.json) / [オフライン検査](qa/browser/offline-report.json) / [対象外37点の比較元](qa/review-r2-baseline.json)

## 汎用性・出自・残課題

[914セットからの再点検](USAGE_REVIEW_20261018.md)は継続。日常の物体・場面を優先し、球を握る・数える・げっぷは限定用途です。話題件数を素材適合数や実際の利用ログとして扱いません。コップは追加コンセプトscene.drinkの提案で、共有設計・アプリの割当は未変更です。

原画34点（今回4点）は `sources/generated/`、[今回の指示全文と生成ID](sources/review-r2-prompts.json)を保存。組込みImageGenで生成・編集した原画と、PNG部品・再生成スクリプトが編集元です。元ZIP19点とSHA256 `73f04e328dc5aed60f810d6a3b4fcfa93f79e65030db2fb3c3b0c90165c6a700` は不変。[元素材棚卸し](inventory.csv)。

制作ブランチ `codex/visual-cue-complete-assets`、[ドラフトPR #107](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/107)。公開元は専用リポジトリ `eltnegcellist/visual-cue-artwork-preview` の `gh-pages`。配信HTMLのSHA256と生成元コミットは [deployment.json](https://eltnegcellist.github.io/visual-cue-artwork-preview/deployment.json) で照合します。

残る工程は、指の本数・関節・遮蔽、母指球、空の寝床、キックの動きの目視採用審査、実機での読み取りやすさ、起床の代案と914英文の個別意味割当です。**mainへマージしません。アプリ本体・Emma切替・本文・音声・既存アプリのPages設定は変更しません。**
