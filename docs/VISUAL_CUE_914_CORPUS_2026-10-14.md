# Visual Cue 最新英文914セットの割当（2026-10-14）

## 最新の取得元

対象Web main commit: `40c890e3d1080bf825a9af4cb53f0cb59c044cb7`。

作業中に別の英文改稿（194セット）がmainへ取り込まれたため、この最新版に合わせてデータを再生成する。Topic 197、Interaction 112、Topic×Interaction 495、押して聞く110で合計914セット。最新の英文では、同じ文章が複数箇所に存在しても各候補に別のIDを維持する。

押して聞く110セットには3文ずつあるが、1文モードで重複除去した場合の種類数は178。名前プレースホルダーは含めず、置換機能を追加しない。

## 成果物

- `shared/visual-cue-corpus.snapshot.json`: 914セットの文章・分類・所在
- `shared/visual-cue-phrases.json`: 再利用する固定 `vc_######` ID台帳
- `shared/visual-cue-assignments.draft.json`: 全候補の primary/secondary Cue案。押して聞くは各文のCueも保持
- `shared/visual-cue-namespaces.json`: 存在するCue IDの登録簿。イラスト素材・Emma表情はまだ未作成
- `scripts/build-visual-cue-data.mjs`: 最新の英文を読み取り、登録済みIDをできるだけ維持しながら再生成
- `scripts/validate-visual-cue-data.mjs`: 914の網羅性、ID重複、出所整合、未知Cue ID、Pressの文単位割当を監査
- `scripts/test-visual-cue-data.mjs`: 検証ルールの回帰テスト
- `.github/workflows/visual-cue-corpus.yml`: CIの監査実行

すべての候補は `reviewStatus=generated` で、**人手承認されていない推定Cueです**。英文から抽出した動詞、話題、Interaction分類を基に機械提案を行っており、意味・状況・比喩・否定の誤割当が残り得る。59個前後のCue IDがそのまま画像59枚の制作を意味するわけではない。

## 動作・テスト

```bash
node scripts/build-visual-cue-data.mjs --check
node scripts/test-visual-cue-data.mjs
node scripts/validate-visual-cue-data.mjs
```

`--check` はWebの固定英文bankと3ファイルおよびCue登録簿を照合する。ソース修正後、再生成する場合は `node scripts/build-visual-cue-data.mjs` を実行し、差分を目視で確認すること。英文を大幅に分割・追加・並べ替えた場合に、旧IDが誤って別の意味に割り当てられないかも確認する。

**strict review gateは人手確認完了後にのみ使用可能**。このPRでは英語本文、TTS、UI、画像、Androidは変更しない。次は自動Cueの意味レビューと試作対象の決定。
