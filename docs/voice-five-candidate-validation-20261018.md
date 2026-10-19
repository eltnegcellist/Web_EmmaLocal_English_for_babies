# 音源と2回表記の同期（2026-10-18）

ユーザーの方針に合わせ、No.9は改善したcooの音声を維持し、No.11/14/16/17は元の自然な音声へ戻して、英文を2回の反復に合わせました。4本は元AACとバイト単位で同一です。再合成・切り出し・接合・再エンコードはしていません。

| No. | 現在の英文 | 対応 |
|---|---|---|
| 9 | Was that a coo? I heard you! Hello, baby! | 改善版を維持。ユーザーよりcooの発音改善との報告 |
| 11 | Little sips, baby! Sip, sip! High five! | 元の音声を保持し、sipを2回表記 |
| 14 | Sip, sip! Nice little sips! No need to rush! | 元の音声を保持し、sipを2回表記 |
| 16 | Cuddle, cuddle! My sweet baby! I love you! | 元の音声を保持し、cuddleを2回表記 |
| 17 | All done eating? Wipe, wipe? Let's have a look! | 元の音声を保持し、wipeを2回表記 |

表示英文の変更に伴い、テキスト由来の4音源ID・ファイル名と両manifest、Web/Androidの該当発話、レビュー表示を同期。Visual Cueの4行も英文を同期し、IDと割当は維持しました。元の3回表記はレビュー台帳の `originalExpected` に保存し、旧判定を現行英文へ流用しません。

検証:
- Web `npm test` と全音源SHA/1093表現のカバレッジ検証、26件review gate、音源キャッシュ更新、5件の現行対応とレビューDOM検証に成功。
- Visual Cueの914件生成整合性・参照・意味監査・プロトタイプ検証成功。4行の表示同期だけでID・cue割当は不変。
- Androidユニットテスト 106件、failure/error 0、skip 1件。`:app:assembleDebug` 成功。
- APK内の全1105音源とmanifestはWeb/Androidのソースとバイト単位で一致。対象外1100音源・manifest行は不変。音源データを変更したのはcooの1本のみ。
- Whisper Smallは4件すべて現在の英文の単語と一致。BaseはNo.11をSips/zipと誤転写し、他3件は一致。ASRを人手実聴の代用にはしていません。

APK: 143,625,999 bytes。SHA-256: `30e53ae669a30387883af72632a151faf56e6b196dc19673b79288839093370d`。

人手再聴とWeb/Android実機受入の全完了は記録しておらず、`audioIssuesResolved` は `false` を維持しています。ユーザーよりこの方針のmain反映承認を受けています。

## 2回反復の英文確認とmain反映承認

2026-10-18、ユーザーから「2回でも英文として問題がなければmainへマージ」と承認を受けました。現在の4全文を確認し、`Sip, sip!`、`Cuddle, cuddle!` は動詞原形による短い声かけ、`Wipe, wipe?` は文脈のある短い問いかけとして意味が成立します。反復を2回にすることで文法的に欠落する要素はありません。3回との違いはリズムと強調です。

一般文法の確認先はCambridge English Grammar Todayの [Imperative clauses](https://dictionary.cambridge.org/uk/grammar/british-grammar/imperative) と [Questions: short forms](https://dictionary.cambridge.org/grammar/british-grammar/questions-short-forms) です。これらの一般則に照らした今回の4全文の個別判断であり、当該ページがこの製品の英文を直接審査したという意味ではありません。

mainへの反映承認と、Web/Android両方での実機受入完了は区別します。実機受入は未完了のため `audioIssuesResolved: false` を維持しています。
