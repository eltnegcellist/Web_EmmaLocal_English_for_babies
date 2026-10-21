# 第2回レビューへの対応（2026-10-18）

[評価コメント](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/107#issuecomment-6249317494)と[受入条件](REVIEW_REQUEST_20261018_R2.md)に対する修正候補です。採用承認ではありません。

| 指摘 | 今回の対応 |
| --- | --- |
| 手をつなぐ指が消える | 大人の人差し指の付け根から握られる部分・先に出る指先まで、同軸でつながる単一原画へ再制作。小さな手の握りだけをわずかに動かす。 |
| 親指の付け根の継ぎ目 | 静止画は手全体を描いた一枚の新原画。動作では親指・母指球・掌・手首・袖口を一枚のまま使い、別の親指を貼らない。既存の4本の指の部品原画を関節位置で再利用し、曲げた指の上端を改善。タップは自然な指差しの手全体を別途再制作。 |
| 枕・掛け布団の寝床 | 原画から空のベビーベッドと平らなマットレス／フィットシーツへ再制作。枕、掛け布団、バンパー、玩具、赤ちゃんを置かない。 |
| wake-quilt | 候補から撤回。寝床を動かさず、その外側の朝日だけを動かす `wake-daylight` を別案として提示。本人が起きる動作の絵ではなく、action.wakeへの意味の採用は保留（draft）。 |
| キック | 親指の内向きと足首の支点を維持。26度・42フレーム・3.486秒へ再出力。左右同時の鏡像運動をやめ、半周期ごとに片足だけ動かす。 |

睡眠環境は[NHSのSIDS予防の寝床の説明](https://www.nhs.uk/baby/caring-for-a-newborn/sudden-infant-death-syndrome-sids/)を参照しています。実際の商品の安全性認証や医学的な適否を自動検査で承認するものではありません。

## 状態と検証範囲

- 11点を置換し、旧版11点は不採用として保存。修正対象外の37候補の静止画／動画／ポスターはSHA256が一致することを検査。
- 現行48点（静止22・動画26）は審査候補。旧wake-quiltを現行候補数へ重複計上しない。採用承認は0件。
- 必須14基本イラスト・10動作には候補あり。起床の具体的動作は朝日案で完成扱いにしない。58 Cueのうちaction.wakeをdraftへ戻す。Emmaは従来の評価のみ。
- キックの全フレームで足の衝突、固定支点、左右交互の角度を確認。寝床は静止画・動画間で固定。手の画素の接続と、一枚の原画からの親指・母指球の保持も検査。
- これらの技術検査と、指の本数・関節・遮蔽の自然さや乳児への意味の分かりやすさの採用判断を区別する。

[今回の5フェーズ](qa/review-r2-keyframes.jpg) / [素材検証](qa/validation.json) / [ブラウザー検証](qa/browser/report.json) / [指示全文・生成ID](sources/review-r2-prompts.json)

## 再生成

```sh
python3 scripts/visual-cue/build_artwork.py --only-r2
python3 scripts/visual-cue/compact_artwork.py
python3 scripts/visual-cue/validate_artwork.py
python3 scripts/visual-cue/report_artwork.py
python3 scripts/visual-cue/export_preview.py
```

保存原画と部品から再生成するため、再ビルドにはAIサービス・APIキーを使いません。4点の原画の新規生成・編集には組込みImageGenを使用しました。
