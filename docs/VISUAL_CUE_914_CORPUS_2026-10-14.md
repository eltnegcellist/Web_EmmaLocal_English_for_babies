# みつことば Visual Cue：最新914英文セット（2026-10-14）

## データ作成と出典

Web main commit `6b821338f9af59012148d3a0f6d8812ab9ad4037` 時点の実英文を基に作成。Topic **197**、Interaction **112**、Topic×Interaction **495**、押して聞く **110**、計 **914** セット。押して聞くは3文/セットで、現行の1文モードの重複除去後は **178種類**（旧報告173から更新）。現在の英文bankに `{name}` はなく、Visual Cueの照合・意味付けはプレースホルダーを参照しない。

## 追加したファイル

| ファイル | 目的 |
|---|---|
| `shared/visual-cue-corpus.snapshot.json` | 914セットの正確な文章・出所・並び順の監査記録 |
| `shared/visual-cue-phrases.json` | 永続 `vc_000001` 形式のphraseIdの台帳 |
| `shared/visual-cue-assignments.draft.json` | 914セットの主Cue・補助Cue自動提案、押して聞くの3文個別Cue |
| `shared/visual-cue-namespaces.json` | 59個のCue名（`emma.neutral`を含む）と名前空間。**素材未作成** |
| `scripts/build-visual-cue-data.mjs` | 現在の英文bankから3つのデータを構築・差分チェック |
| `scripts/validate-visual-cue-data.mjs` | unknown Cue、重複ID、孤児・未割当、Press文番号欠落の検出 |
| `scripts/test-visual-cue-data.mjs` | 正常データ＋9種類の意図的な破損データの検証 |

全914件の `reviewStatus` は **generated**（未レビュー）。ルールベースによる候補のため、主語・比喩・反語・疑問・発話状況と動作の一致を保証しない。**59Cueは59枚の画像という意味ではなく、58の使用・候補概念＋1fallbackに過ぎない**。画像制作、画面表示、TTS同期、Android側実装はまだ行っていない。

## 検証方法

```bash
node scripts/build-visual-cue-data.mjs --check
node scripts/test-visual-cue-data.mjs
node scripts/validate-visual-cue-data.mjs
```

`--check` は現行英語bankと登録済み3ファイルの完全一致を要求し、英文変更時に失敗する。改稿後は `node scripts/build-visual-cue-data.mjs` で再生成でき、既存の出所・英文一致を優先して同じphraseIdを維持する。ただし大幅な挿入や意味変更がある場合はID引継ぎと自動分類を確認すること。**生成時に既存ファイルを上書きするため差分確認必須**。

`validate-visual-cue-data.mjs --strict` は全914件の `reviewed` が揃うまで意図的に失敗する（現段階の通常CIでは実行しない）。CIでの整合性確認は**意味的な人手レビューの代わりではない**。Press 1文モードは現時点で文字列重複除去を使っており、将来のruntime実装でphraseId+sentenceIndexへのリンクが必要。

次の作業はCue候補の人手監査→類似Cueの統合→代表素材の試作→Web/Android表示同期。古い203セット/41分類より本書と自動生成データを優先する。
