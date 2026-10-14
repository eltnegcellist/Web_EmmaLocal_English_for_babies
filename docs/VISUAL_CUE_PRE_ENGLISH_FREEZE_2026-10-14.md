# Visual Cue: 英文改稿中にできる事前準備（2026-10-14）

**英文が確定するまでは、914セットへの個別割当・安定IDの実際の付与・画像枚数確定・画像生成・UI表示実装は保留。**

## この段階で準備したもの

- `shared/visual-cue-contract.schema.json`（v2 draft）: ID・元のbank種別／group・主／補助Cue・文単位Cue・レビュー状態のデータ構造。
- `shared/visual-cue-namespaces.json`: subject / action / observed / emotion / social / attention / dialogue の7軸。個別Cue名や枚数を今は確定しない。renderingが未対応ならEmma neutralへの安全fallbackを予定するが、**runtimeには未接続**。
- `shared/visual-cue-contract.example.json`: 本文とは無関係の例示用データ2セットのみ。現在の914セットに割り当てたものではない。
- `scripts/validate-visual-cues.mjs` と `scripts/test-visual-cue-contract.mjs`: Node標準APIのみで、重複ID・Cue競合・不明namespace・文番号不備・未reviewedの例を検出する。

## 英文を書き換えても保てる方針

- `kind:scene:index` の現行監査IDは**永続IDに使わない**。英文確定後に正本へopaqueなphraseIdを発行する。修正前後で同じ英文候補の意図ならIDは維持する。
- textFingerprintは改稿検出に使い、識別子にはしない。分割／統合時は移行表を用意する。
- Web版の押して聞く1文モードは現状「文字列の重複除去」により元セット・文番号を失うため、**将来**`(phraseId,sentenceIndex)` の選択記録へ変更する。今は現行機能を変更しない。
- 元の3文セットの主役Cueを、1文だけ再生する場合に無条件で流用しない。
- Cue候補の命名軸は今設定しても、各英文への映像割当と新しいcue名の採否は改稿後に人手で確定する。

## 検証と保留

```bash
node scripts/test-visual-cue-contract.mjs
node scripts/validate-visual-cues.mjs shared/visual-cue-contract.example.json shared/visual-cue-namespaces.json --strict
```

**厳格チェックは入力例の妥当性だけを検査**する。実際の英文バンク全件との突合・未割当ゼロ・Web/Android同期は、英文修正が終わってphraseIdが確定した後に作る。ここで「全914件対応済み」とは主張しない。

## 後で進める順序

1. 修正後の最新mainの英文を再抽出し、件数・重複数を更新。
2. 全固定英文に安定phraseIdを付与し、選択したIDを返答結果まで持ち回る。
3. 1文/3文を含む全英文へCue提案 → 人手レビュー → Cueと素材の圧縮集計。
4. 約12種類の試作 → TTS同期・表示負荷確認 → Web/Android共通化。
5. 実データを対象に未割当・孤児ID・改稿fingerprint・renderer有無・parityをCIで検査。

関連: [現行英文調査](./VISUAL_CUE_CORPUS_REFRESH_2026-10-13.md) / [旧引継ぎ](./VISUAL_CUE_HANDOFF_2026-10-10.md)
