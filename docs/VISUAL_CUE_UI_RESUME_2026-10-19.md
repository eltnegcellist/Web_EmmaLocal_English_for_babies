# Visual Cue UI 制作引き継ぎ — 2026-10-19

**11:10 JST再開済み。以下は中断時点の記録です。最新状態は[実装・検証結果](VISUAL_CUE_UI_IMPLEMENTATION_2026-10-19.md)を参照してください。**

ユーザーの利用制限への配慮で09:40頃（JST）に区切りを保存して中断。**2026-10-19 11:10 JST**にこのスレッドで再開するheartbeatを作成済み（`visual-cue-ui-11-10`、1回）。

## 今回の依頼と制約

- 元計画の不足を確認し、Emmaの身振りを含む不足素材を追加する。その後、音声に対応した絵やアニメーションでEmmaの表示領域を置き換えるアプリUIを作る。
- 最新の依頼でアプリUI実装は許可された。以前の制作指示書の「アプリには実装しない」という範囲制約は今回の依頼で変更された。
- **mainへのマージは禁止。** 作業ブランチ`codex/visual-cue-complete-assets`、ドラフトPR #107、進捗Issue #104。
- 最新main `b2536ab`を作業ブランチへマージ済み（`8c25cb9`）。main自体は変更していない。新しい録音音声・Ruri・音声認識などのmainの変更を巻き戻さない。

## 保存したもの（未完成、まだ完成報告しない）

1. `scripts/visual-cue/build_emma_gestures.py` → `assets/emma-gestures/`の7状態のSVGアニメーションと各静止ポスター、`src/emma-gestures.js`。
   - neutral / smile / calm / celebrate / listen / ask / invite。
   - 既存Emmaの顔のSVG形状と配色変数を継承し、肩を支点にロボットの腕を動かす。人間の指を再制作していない。
   - 同一ページでCSSが他の状態に干渉する不具合を修正済み。listenの右手は頭より手前に描画。
   - 7点とも**新規確認候補**。ユーザーの採用済み42点に混ぜない。
2. `scripts/visual-cue/build_runtime_catalog.py` → `src/visual-cue-catalog.js`、`shared/visual-cue-runtime-review.json`。
   - 元の914セットのdraft割当から**実装確認用**の対応を生成。元の意味確認済みは21セットだけであり、893件を承認済みとしない。
   - 原文の完全一致（空白・大小文字・曲がったアポストロフィだけ正規化）。実行時に英文キーワードで分類しない。未知の英文は従来Emma。
   - 元draftの誤りが残る可能性があるため、**意味対応の追加レビューが必要**。現在921ユニーク対応（単文8件含む）、Emma309・素材612。
   - 疑問文・意味監査の注意対象では動作動画を避け、静止画に落とす。cup-sipは除外。wake-daylightも意味が未完成なので除外。
3. `src/visual-cue-controller.js`。
   - 音声再生トークンと画像読込世代を分離。停止後の遅延読み込み、古い音声終了が次の表示を消す問題を防止。
   - homeとcloneしたplay画面の両avatarへ表示。表示失敗・未知英文・停止・非表示タブで従来Emmaへ戻る。
   - 動作オフ・OSのreduced-motionではポスター/静止SVG。音声を画像読込待ちにしない。
4. `index.html`・`styles.css`・`src/app.js`に実際のUI追加。
   - 設定→見た目→「英語を話している間の表示」Emma / イラストと動き、動作checkbox。
   - 初期値は従来のEmma。localStorage保存。optional dynamic import失敗時も音声アプリを壊さない。
   - `playBlob`の実際の`source.start()`後に表示、終了時に解除。`stopEmma`とerrorでも解除。
   - 録音AACは1応答1ファイルで文ごとの時刻情報がないため、3文は全体に1つの絵。均等な仮時刻で文を切り替えない。
5. `visual-cue-ui-preview.html`・`src/visual-cue-ui-preview.js`・`shared/visual-cue-ui-examples.json`。
   - 実際のcontrollerと採用済みAACを使う、マイク不要のUIプレビュー。7身振り一覧と16音声付き例。
   - 本体へのUI実装は存在するが、プレビューは表示部分だけの確認用。
   - **GitHub Pagesへはまだ公開していない。** `prepare_pages.py`はまだ旧素材一覧だけを公開する状態なので、次にUI用ファイルと必要な素材・音声を追加する。

## 承認状況を維持

- 既存素材43点のうち42点をユーザー採用済み。
- cup-sipは液面の物理表現を修正したが、ユーザー確認待ち1点のまま。`approval-hold-cup-20261019.json`を尊重する。
- 14基本イラスト・10動作カテゴリには素材があるが、`action.open-close / count / wiggle / squeeze / tap`の5つはユーザー指示で撤回。新たな手の変形動画を復活させない。
- wakeの空のベッド+太陽は「起きた赤ちゃん」の表現として意味未完成。
- 実験のクマ・月のストリップは可愛いと評価されたが、完成した動作動画にはなっていない。
- 元19参照・却下38旧版などは既存記録のまま。既存素材の承認hashを変更していない。

## ここまでの検証

- 既存の`npm test`全項目成功（この後新規testをnpm scriptにも追加）。
- `node test-visual-cue-ui.mjs`成功：承認保留の除外、914原文対応、疑問文に動画を使わない、未知文fallback、遅延読込の取消、home/play両表示、古い終了の無視、設定変更後の終了、reduced motion、タブ復帰で勝手に再開しない。
- Chromeでプレビューの採用済みAACを実再生し、kick表示→停止でEmmaへ戻ることを確認。ページ例外0。
- desktop1200px/mobile390pxの初回スクリーンショットを確認：`/tmp/emma-ui-first.png`、`/tmp/emma-ui-mobile.png`。
- **未検証**：本体画面の実音声・play/history/navigation、7SVGの時間差・220pxでの可読性・動作停止の画素検証、生成物再現性、全英文の意味レビュー。新規CIはまだ実行していない。

## 再開後の作業

1. 7身振りの姿勢・動き・静止をブラウザで検証し、必要なら修正。特にlistenの手と頭の接続、inviteの招き方、neutralの説明を確認。現状neutralは僅かな首と腕の動きで、まばたきは実装していない。
2. 英文対応を検証。候補対応921件を承認済みと誤表示しない。意味が曖昧なものは保守的にEmmaへfallback。単文再生178種類への対応は限定的で、未知文fallbackを明記。
3. 実アプリの音声ライフサイクルテストを増やす。`test-features.mjs`後半は実際のapp.jsをVMで読み込み、decode中停止・speculative生成取消・音声開始/終了をテストしている。Visual Cueのbegin/end/stopも検証するとよい。
4. 実アプリの設定/スマホ/ホーム/遊ぶ/履歴/エラー/OS reduced-motionを確認。必要最小限のテストを追加。
5. UIプレビューを既存専用Pages repoへ追加して公開する。本体mainはdeploy/mergeしない。
6. 検証結果と残課題を日本語でIssue #104・ドラフトPR #107に更新し、コミット・push。完成候補と確認待ちを区別してユーザーへプレビューURLを報告。

## 実行環境・公開情報

- node_modulesは`npm ci --ignore-scripts`済み、Playwright使用可。
- Chrome: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`。
- この作業のHTTPサーバーは127.0.0.1:8781、tool session60103。必要なら再起動する。別の8765/8770サーバーを無断で停止しない。
- 現在の公開素材一覧: https://eltnegcellist.github.io/visual-cue-artwork-preview/?revision=9bb9610&filter=new#cup-sip
- 専用Pages repoのlocal clone: `/tmp/visual-cue-pages-r2-publish`、branch gh-pages。公開済みcommit `9bb9610b0cdef3582ffa11b7c6851c0598a28044`。
- PR: https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/107
- Issue: https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/issues/104
- source直前commit `a730553`、main取込commit `8c25cb9`。
- Git更新/networkは必要に応じrequire_escalatedで実行。fsmonitorにより遅くなる場合は`git -c core.fsmonitor=false -c core.preloadIndex=false`。
