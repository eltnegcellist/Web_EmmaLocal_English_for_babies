# 更新: 2026-10-12 — PR-C優先方針

**以下のGemma大量生成手順より、今回追加したChatGPT執筆の統一英文草案を先にレビューすること。** 
- Web PR [#72](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/72) に、通常Lite 197セットの再編集と新Interaction 112セットの草案がある。
- Android PR [#37](https://github.com/eltnegcellist/Android_English_character_for_baby/pull/37) に、同じ197セットと112セットがある。
- 英文全件レビュー: `docs/english/UNIFIED_309_REVIEW.md`（各PRブランチ上）。新Interaction草案: Webの `shared/interaction-replies.proposed.json`、Androidの `research/interaction-replies.proposed.json`。
- 両者309セットは3文・6〜12語・1文4語以内、両版で一致。**新Interaction 112セットは候補のみで通常会話未接続。**
- 現時点ではGemmaによる280候補の新規生成を必須とはしない。Codexはまず意味・重複・英語らしさの独立確認、Kiki発音試聴、分類器との接続準備を行う。追加候補の比較が必要なら、以下のGemma生成手順を選択可能な研究手段として実施し、出自と品質を分けて記録する。
- 既存の『押して聞く』は別カタログ。1文／3文切替を壊さない。
- PR #71の実験用Ruri head・推論測定・学習は英文とは別に継続。無断でmainへマージしない。

---

# Codex引き継ぎ：Gemmaによる日常の語りかけ英語ライブラリ作成（PR-C）

- 作成日：2026-10-12
- 対象：みつことば Web Lite / Android Lite の共通**固定英文**。Gemmaは開発時の文章案作成にのみ用い、Lite実行時には使用しない。
- **Gemma実行担当：Mac上のCodex**。この資料の作成者はGemma生成を実行しておらず、生成済み・品質確認済みとの主張もしない。
- PR-Cの開始条件：分類定義のレビュー。PR-B（分類器の訓練）との並行作業を認める。
- 参照：`shared/interaction-taxonomy-draft.json`（14分類の暫定定義・例・対照）および既存 `src/lite-response-engine.js`。現在のブランチで名称・ID変更があれば共同開発者と調整すること。

## 0. Codexへの即時実行指示

**このリポジトリのPR-C専用作業ブランチを作る。既存のWeb/Android本番動作は変更しない。** PR-Aの分類定義を読み、GemmaをMacの利用可能な実行環境から実際に動かし、14分類それぞれ20候補を作る。厳選した5〜8セット/分類をJSONとして保存する。英語は全て**赤ちゃんへ直接呼びかける自然な簡潔表現**であり、親の日本語への直訳や赤ちゃんの代弁に固定しない。自動Lintとモデル情報・審査レポートを作る。生成結果について言語的レビューとKiki発音試聴は未実施なら未実施と明記する。**実際にGemmaを呼べなかった場合は他モデルの文章をGemma生成と偽らず、環境診断と実行可能な手順を残す。**

## 1. 必須対象（分類クラス14個）

`affection`（かわいい・大好き）、`praise`（上手・えらい）、`achievement`（できた）、`effort`（頑張ってる）、`encouragement`（頑張って）、`invitation`（一緒に〜しようか）、`start`（始めるよ）、`finish`（終わったね）、`finish_check`（終わったかな）、`care`（お疲れさま）、`inquiry`（どうしたの）、`reassurance`（そばにいるよ）、`repeat`（もう一回）、`pause`（ちょっと待ってね）。

**除外：** `sleep`（眠い）、`wake`（起きた）、`cry`（泣く）、`smile`（笑顔）は既存Topicで初回リリース対応。現時点では新しい英文を作らず、既存の語句の意味の誤りがないか確認するのみ。`hot/cold`、寝返りなど月齢特有の専用クラスは次期版以降。`none`用英文は作らない。具体的なミルク、おむつ、絵本等も現行ライブラリを使う。

## 2. 準拠する英文スタイル（現行Liteに合わせる）

- 1セットは**必ず3文**（質問も一文として数える）。
- 全体 **6～12語**、**1文あたり4語以内**。短い発話は自然なリズムを優先。単語数の機械的な水増しをしない。
- 同じ分類で短い候補を20セット以上生成し、最終採用は**5～8セット**（良い候補が足りなければ「不足」と報告）。
- 米国・英国のいずれでも概ね自然な簡単な英語。赤ちゃんに語りかける優しく明るい口調。英語らしい抑揚や子音・母音を犠牲にする不自然な造語を避ける。
- 不必要な固有名詞、人名、子の性別、月齢や成長段階、親子の関係を特定する言葉は使わない。個人の音声・履歴をプロンプトに含めない。
- `{name}`挿入は現行実装との整合を確認するまでは**使用しない**。また `\n` やスマート引用符・絵文字・全角記号、SSMLは使わない。
- 同じ英文を多数のカテゴリへ使い回さない。同じカテゴリ内も表現・韻律を適度に変え、意味を変えない。

## 3. 禁止される意味上のズレ（最優先で審査）

| クラス | やってはいけないこと |
|---|---|
| affection | `You did it!` など動作の達成へ勝手に変えること |
| praise | `I love you` だけになる、目的のない過度な持ち上げ |
| achievement | `Maybe you can do it` のように完了を未完了へ反転 |
| effort | `You did it!` と達成断定する（努力の観察と区別） |
| encouragement | 成功済みと断定する。競争・急かし・過剰な負荷をかける |
| invitation | `We did it` と実施済みへ変える |
| start | `All done!` と逆転する |
| finish | 未確認の未来形へ変える。過度に動作を特定する |
| finish_check | **`All done!` と断定しない。必ず不確かさや質問を残す** |
| care | 病気・症状・苦痛の原因を勝手に決めつける |
| inquiry | 親の問いかけを勝手に診断・回答する |
| reassurance | `You're healthy/safe` 等の医学的な安全を根拠なく断定しない |
| repeat | 前回の成功を決めつける |
| pause | 終了を断定しない。命令で赤ちゃんを沈黙させない |

`Stop crying`, `Don't cry`, `Be quiet`, `No more tears`のような感情を否定・抑圧する文は採用しない。`You should sleep now` のような押し付けも避ける。英語の文法だけでなく、乳児との温かなやり取りに適切かを審査する。

## 4. Gemma実行環境の確認

1. Macで既存のGemma 4 E2B（可能なら現在のAndroid Fullと出自を揃えたモデル）を使用できるかを調査。`ollama list`、`llama-cli`、ローカルモデルの有無、Codexが利用できる他の推論経路を確認し、**実際のモデル名・revision/quantization・ロード方法**を記録。
2. ネイティブ実行がない場合は、互換ランタイムの必要性を説明する。2GB級モデルの再ダウンロードや新しいサービスへの送信が必要なら、手順と影響を明記してから実行方針を決める。秘密鍵・トークン・実録音は記録しない。
3. 再現用の生成スクリプトを `scripts/generate-interaction-replies.py`（またはNode）として作成。モデル起動、プロンプト、seed、temperature、top_p、最大出力トークン、再試行条件を外部から設定できるようにする。
4. 14分類×20候補をバッチで生成。JSONパース失敗・制約違反は再生成し、元結果も棄却理由付きで残す。**候補の英語をコードへ直書きしてモデルを呼んだことにしない**。
5. 再現性に限界がある場合はランタイム差・seedの効き方を文書化。

## 5. Gemmaに渡すプロンプトの基本形

SYSTEM/INSTRUCTION:

> You are an editor of short, natural English utterances addressed directly to an infant during warm, everyday interaction with a caregiver. You do not translate Japanese literally. Write exactly 20 distinct candidate reply sets for the given semantic label. Each reply has exactly three simple sentences, total 6 to 12 whitespace-separated English words, no more than four words in any sentence. Preserve whether the caregiver observed effort, encouraged future effort, stated completion, or merely asked if something was complete. Do not invent a concrete activity, a medical condition, a milestone, or a baby's emotions. No proper names, emoji, markup, or placeholders. Return JSON only.

USER payload:

```json
{
  "label": "<ID>",
  "description_ja": "<definition>",
  "seed_utterances_ja": ["<from taxonomy>"],
  "must_not_confuse_with": "<potential_collision>",
  "boundary_note_ja": "<annotation_rule>",
  "desired_count": 20,
  "output_schema": {"label": "<ID>", "candidates": [{"english": "Sentence one. Sentence two. Sentence three."}]}
}
```

クラス別に追加で**意味要件**を与える。特に `finish_check` は質問としての含意を残し、`effort` は達成を断定せず、`inquiry` は答えを勝手に決めず、`reassurance` は健康を保証しない。

## 6. 出力の形式とファイル

### a. Gemmaが生成した全候補（採用前の生データ）

`research/interaction-gemma/candidates.jsonl` に**1候補1行**として保存：

```json
{"label":"affection","english":"You are so sweet. I love you. Right here together.","model":"<actual-model-id>","prompt_version":"v1","seed":42,"generation_id":"affection-0001","decision":"unreviewed","rejection_reason":null}
```

上は**形式例**であり、生成済みと誤認しないこと。固有の生成日時、モデルID、実行設定、ソースcommit、Gemmaライセンスを `research/interaction-gemma/manifest.json` に記載。

### b. 採用する固定ライブラリ（英語の人手審査後）

唯一の編集元は `shared/interaction-replies.json`。形式：

```json
{
  "schema_version": 1,
  "taxonomy_version": "interaction-phase-a-draft-1",
  "style": {"sentences":3,"total_words_min":6,"total_words_max":12,"words_per_sentence_max":4},
  "replies": {
    "affection": ["<adopted three-sentence text>"],
    "praise": ["<adopted three-sentence text>"],
    "achievement": ["<adopted three-sentence text>"],
    "effort": ["<adopted three-sentence text>"],
    "encouragement": ["<adopted three-sentence text>"],
    "invitation": ["<adopted three-sentence text>"],
    "start": ["<adopted three-sentence text>"],
    "finish": ["<adopted three-sentence text>"],
    "finish_check": ["<adopted three-sentence text>"],
    "care": ["<adopted three-sentence text>"],
    "inquiry": ["<adopted three-sentence text>"],
    "reassurance": ["<adopted three-sentence text>"],
    "repeat": ["<adopted three-sentence text>"],
    "pause": ["<adopted three-sentence text>"]
  }
}
```

上は構造例であり `<...>` は有効な英語ではない。本物の完成ファイルでは全14キーに5～8個の審査済み文字列を入れる。Gemma生成候補は**審査していなければ決して「採用済み」としない**。審査待ちの場合は `interaction-replies.json` を完成品として作成せず、`proposed-replies.json` という名前で置く。

### c. 検証

- `node scripts/validate-interaction-replies.mjs <path-to-proposed-or-reviewed-json>`。クラス数・キー・重複・3文・6～12語・1文4語以下・一部危険文言を検証（**機械検証は意味や発音の正しさを保証しない**）。
- `research/interaction-gemma/REVIEW.md` に「カテゴリー別候補数/採用数」「人手審査者と日付」「意味上の否認例」「Kiki試聴結果」「未実施項目」「既存sleep/wake/cry/smileを変更していない」等を記録。
- モデルによる自己採点だけを人手承認とみなさない。Kikiでの発音確認には従来開発者診断や実際の音声合成経路を使用。未実施の試聴を実施済みと報告しない。
- 実際のGitHub PRにはリリース前に必要な承認事項をチェックリストで残す。
- 最初のPRは**本番会話の変更を含めない**。モデル学習PR-Bを待たず英語の作業を完了できる構造にする。

## 7. 受け入れ基準

- [ ] 14クラスがID一致。5～8セット/クラスの最終採用ライブラリ、または足りない理由と追加生成計画
- [ ] Gemma実行ログ・モデル名/固定版/生成設定・候補と棄却判断の追跡
- [ ] 全文の機械チェック合格、重複ゼロ、`finish_check`に完了断定なし
- [ ] 不自然な英語・医療断定・感情否定がないことの**独立した人手審査**（未了なら候補扱い）
- [ ] Kiki実際の発音・語末の子音・質問の抑揚を試聴（未了なら未了と明記）
- [ ] 英文は端末内で固定文字列として利用可能。Lite実行時にGemma呼出なし
- [ ] PR-Aのラベル名と一対一。Web/Android同期可能
- [ ] Android v1.9.42の現在のライブラリ・Full・押して聞く・Silero/ASRを改変しない

## 8. 分業と同期

- **本作業（PR-A）**：分類仕様・境界・合否基準を準備。データは暫定であり全例人手審査完了ではない。
- **Codex（PR-C）**：Gemmaモデルの実行、候補提案、再現可能な生成スクリプト、候補整理、英文ファイルの作成・品質証跡。採用には人手レビューが必要。
- **並行するPR-B**：Ruriから384次元Embeddingを使ったInteraction headを訓練・診断統合。PR-Cは分類IDが固定されれば、PR-Bの完了を待たない。
- **接続PR-D/PR-E**：本番の最終route調停・英語選択・Android同等化。両PRが品質ゲートを通ってから接続。

**注意：** 本書の分類と英文候補の数は開発目標であり、現在のモデル精度や乳児への英語学習効果を主張するものではない。
