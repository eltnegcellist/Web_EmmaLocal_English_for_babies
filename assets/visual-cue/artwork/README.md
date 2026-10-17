# Visual Cue 修正候補・素材審査（2026-10-18）

**静止22枚・動画26本、計48点の審査候補。目視採用承認は0件です。** ユーザー指摘の旧版17点（共通部品を使う派生版を含む）は不採用として候補から外しました。以前の試作2点も別枠で保存しています。技術PASSを、人体・意味・場面の自然さの完成判定に使いません。

**[GitHub Pagesで修正版を開く](https://eltnegcellist.github.io/visual-cue-artwork-preview/?revision=20261018&filter=new#kick)**

公開元は専用リポジトリ `eltnegcellist/visual-cue-artwork-preview` の `gh-pages`。制作元のmainや既存アプリのPages設定は変更しません。制作ブランチ `codex/visual-cue-complete-assets`、[ドラフトPR #107](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/107)。**mainへマージしません。アプリ本体・Emma切替・TTS・914英文の割当は変更していません。**

## 指摘を受けた修正

| 対象 | 修正候補 |
| --- | --- |
| キック | 左右を直し、親指が中央を向く静止画・動画へ統一 |
| ページ | 紙の表は太陽、裏は洋なし、下の右ページは魚。りんご・太陽→洋なし・魚の見開きを実際に表示。白紙の裏面を撤回 |
| 5本指 | 親指を手首から42px上げ、掌側面に連続。開閉・数える・指を動かす・タップも修正 |
| 抱っこ | 毛布と手の記号を撤回。養育者と子の頭・首・肩・胴・支える両腕がつながった原画へ再制作 |
| 球を握る | 手全体の新原画で、球の下と右に掌を広く残す。指と親指を局所的に動かす |
| 着替え | 腹部だけの絵を撤回。顔の見えない後ろ姿の頭・首・肩・肌着・胴・腕を保って服を替える |
| 袖通し | 元の腕に合う水平な袖を着用した原画から服を分離。袖の軸に沿って片腕ずつ出し、指先の直線切断や首の欠片を除去 |
| 寝具 | 真上からのベッドと掛け物を再制作。同じ投影で、枕の下・木枠内のマットレス上面に掛け物を置く |
| げっぷの場面 | 腹部をさする旧版を却下。肩に頭を預けた縦抱きで、背中に手を添える構図へ再制作 |

[指摘と旧版の対応](REVISION_20261018.md) / [修正候補の5フェーズ](qa/revision-keyframes-20261018.jpg) / [全対応表と実測](COVERAGE.md)

抱っこ・げっぷのように人物が必要な場面と着替えは、顔の見えない頭と上半身を描く方針へ改めました。げっぷの構図は[NHSの頭・首を支えた背中へのケア](https://www.nhs.uk/best-start-in-life/baby/feeding-your-baby/bottle-feeding/bottle-feeding-your-baby/how-to-burp-your-baby/)を参照しています。姿勢や人体の自然さは目視審査前で、図の医学的適否を自動承認しません。

## 汎用性の再点検

[914セットから見直した優先順位](USAGE_REVIEW_20261018.md) / [集計・英文例JSON](qa/usage-audit.json)

生成済みのprimaryCueだけで判断せず、元の話題と本文を確認しました。話題別ではミルク80、おむつ55、遊び51、お風呂45、絵本45、飲み物38、就寝38、衣服31セット。一方、countへの言及は2件（1件は足の指）、burpは3件。squeezeは4件で、主に「手を握る」文脈でした。**話題のセット数は、同じ画像が適合する件数や実際の利用ログの頻度ではありません。**

細かな動作より日常の基本場面を先に見せる構成へ変更し、コップと手をつなぐ絵、手を握る動作を追加しました。コップは哺乳瓶と区別する追加コンセプト `scene.drink` の案です。元の14基本イラスト・10動作には候補がありますが、共有設計31コンセプトやruntimeは変更していません。

ボールを握る具体的な英文は見つからず、この動画を汎用対応数へ含めません。「Hold my hand」には手をつなぐ新素材を対応候補にしました。声・聞く・安心・質問・応援を一つの物体へ無理に割り当てず、場面の静止絵とEmmaの既存表情／追加表情の検討を分けます。Emma 7状態は評価だけで、新しいEmma表情やアプリ統合は別工程です。

## 比較プレビュー

- Pagesはブラウザだけで開けます。初期表示は「日常の基本場面」。「今回の修正・追加」「すべてのvariant」などに切り替えられます。
- 静止ポスターと動画を並列表示。220/256/320px、明暗背景／透過チェック、全停止・個別停止、Reduced Motion、1画面1素材に対応。
- 修正したカードの「指摘された旧版の静止画と比較」を開くと、旧版と見比べられます。旧版は現行候補数に含めません。
- [単一HTML](preview-offline.html)はローカルで直接開けます。HTTP版はリポジトリ直下で `python3 -m http.server 8765 --bind 127.0.0.1` → `assets/visual-cue/artwork/preview.html`。

[素材検査](qa/validation.json) / [ブラウザ検査](qa/browser/report.json) / [オフライン検査](qa/browser/offline-report.json)

## 検査・出自・再現

保存原画30点（今回の新規・編集9点）は `sources/generated/`、部品PNGは `parts/`、正規化PNGは `sources/normalized/`。今回も実際の組込みImageGenを使い、[指示全文・生成ID](sources/revision-prompts-20261018.json)を保存しました。NHSの絵や商品の図版・ロゴを複製していません。

全48素材の512×512・RGBA・外周余白、全ポスター、2.988/3.984秒のループ、220pxの変化量、固定部分を検査。今回は親指の内向き、親指突出部の高さ、新しい左右のページ絵柄、見える掌、袖の連続と順序、着替え中の頭部シルエット、掛け物の木枠外へのはみ出しを追加しました。これらは回帰検出で、意味や人体の完全性の自動承認ではありません。

全静止150KB以下・全動画400KB以下。超過した動画はアルファ精度を調整し、寸法とタイミングを保って、220pxの明暗背景で変更前後差を測定。[今回の圧縮実測](qa/encoding-improvements.json)参照。

元ZIP19点とSHA256は不変です。`73f04e328dc5aed60f810d6a3b4fcfa93f79e65030db2fb3c3b0c90165c6a700`。[元素材の棚卸し](inventory.csv)を参照してください。

```sh
python3 -m pip install -r scripts/visual-cue/requirements.txt
python3 scripts/verify-visual-cue-handoff.py
python3 scripts/visual-cue/audit_scene_usage.py
python3 scripts/visual-cue/build_artwork.py --only-review
python3 scripts/visual-cue/compact_artwork.py
python3 scripts/visual-cue/validate_artwork.py
python3 scripts/visual-cue/report_artwork.py
python3 scripts/visual-cue/export_preview.py
# PlaywrightとChromiumを用意し、HTTPサーバーを起動後
node scripts/visual-cue/capture_preview.mjs
VISUAL_CUE_PREVIEW_URL="file://$PWD/assets/visual-cue/artwork/preview-offline.html" node scripts/visual-cue/capture_preview.mjs
```

最初からの再出力は `build_artwork.py`、今回の修正だけは `--only-review`。保存原画からの再生成にAIサービスやAPIキーは不要です。Pages用パッケージは `prepare_pages.py --output /tmp/visual-cue-pages-new` で作り、公開専用リポジトリの `gh-pages` へ反映します。

残る工程は、修正版の目視採用審査、実機での見やすさ、914英文の個別の意味割当です。不適合な候補を自動で採用へ昇格させません。
