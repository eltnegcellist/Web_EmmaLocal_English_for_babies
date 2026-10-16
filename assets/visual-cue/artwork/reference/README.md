# みつことば Visual Cue 素材引き継ぎ v1（2026-10-17）

このZIPは **素材制作のための原画派生素材・検討案・動きの検証映像** です。アプリ本番に読み込む実装は含みません。

- `artwork/approved` 4点: ユーザー承認の絵柄方向（哺乳瓶・絵本・拍手する手・足）。実写/人物本体は描かない。
- `artwork/approved-style/meal_porridge.webp`: 色の修正を受け入れられた、おかゆ。
- `artwork/candidates` 6点: 追加候補。浴槽、服、オムツ、雨、睡眠など。制作完了とはみなさない。
- `artwork/superseded/meal.webp`: 緑のおかゆ **却下・使用禁止**。修正履歴のためのみ残す。
- `artwork/sprite-drafts` 4シート: 画像生成で作った3コマ静止姿勢の試作。再描画・コマ検証前に使わない。
- `artwork/motion-drafts` 3本: rain/bath/porridgeの動作強化WebP試作。製品完成の証拠ではない。
- `manifest.json`: 素材の出自、採用ステータス、注意点。日本語を含むUTF-8。
- `preview.html`: サムネイルとアニメーションのローカル確認用。GitHub側でunzipしてブラウザ表示できる。

**重要**: 雨/浴槽/おかゆの動きは確認用。拍手・キック・ページめくり・飲む等の**実際に各部品が動く**アニメーションは未完成です。

既存の古い抽象SVGや半リアル人体SVGは見た目を却下されており、新規制作のベースに使わないこと。生身の赤ちゃんの画像本体は基本登場させません。

GitHub Issue: https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/issues/104
