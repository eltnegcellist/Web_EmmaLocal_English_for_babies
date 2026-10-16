# Visual Cue 素材引き継ぎ（Codex専用、2026-10-17）

このディレクトリの **`visual-cue-artwork-v1.zip`** が今回までの採用方針・試作をまとめた保管庫です（19件のアセット）。既存の4枚、白いおかゆ、未承認の候補と動作の実験画像を**ステータス付き**で格納しました。

- SHA256: `73f04e328dc5aed60f810d6a3b4fcfa93f79e65030db2fb3c3b0c90165c6a700`
- 容量: 1,286,666 bytes
- ファイル内部の`manifest.json`が素材状態の基準。`preview.html`をブラウザで開いて確認。
- 解凍例: `python3 -m zipfile -e assets/visual-cue/handoff/visual-cue-artwork-v1.zip /tmp/mitsukotoba-visual-cue-reference`
- メインの制作指示: [`docs/VISUAL_CUE_CODEX_WORK_ORDER_2026-10-17.md`](../../../docs/VISUAL_CUE_CODEX_WORK_ORDER_2026-10-17.md)
- 進捗管理: [Issue #104](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/issues/104)
- 参考：本番表示試作 PR #102 は**閉鎖・未マージ**。それを本番に取り込まないこと。

### 含まれる素材
承認した**絵柄の方向**：milk_bottle / picture_book / clapping_hands / kicking_feet の4点。
色の方向性が採用された候補：meal_porridge（白いおかゆ）1点。
レビュー待ち：bath / diaper / clothes / sleep / rain の5点。
要作り直し：hug の1点。
却下保存：緑色の meal 1点。
生成3姿勢シート：clothes / diaper / sleep_moon / hug_bear の4点、**本番未使用**。
動きの実験用：rain_big / bath_big / porridge_scoop の3点、**本番未使用**。

**このZIPをGitHubに置く目的は情報の欠落を防ぐこと。これ自体を「完成済みの19本の動画」「全31コンセプト完成」とみなさない。** アプリ本体への接続は別途承認が必要。
