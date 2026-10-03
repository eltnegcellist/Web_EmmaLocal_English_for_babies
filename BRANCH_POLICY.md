# みつことば Web — ブランチと開発資料の方針

更新日：2026-10-03

## 現行の開発・公開ブランチ

- `main`
  - 唯一の開発・本番ソース。
  - 変更はここへ集約する。
  - CIのSmoke testとJavaScript構文チェックが成功した場合のみ公開処理へ進む。

- `chore/trigger-pages`
  - GitHub Pages専用の公開元ブランチ。
  - **手動編集禁止**。
  - `main` のCI成功後にGitHub Actionsがfast-forwardし、同じコミットSHAであることまで検証する。
  - GitHub Pages sourceはこのブランチのroot。

## Legacy / experimental branches

`main` と `chore/trigger-pages` 以外は、過去の検証・修正・比較用ブランチとして扱い、現在の本番やPages公開には使用しない。

特に以下の系統は本番ソースにしない。

- `codex/*`
- `feat/*`, `feature/*`
- `fix/*`
- `refactor/*`
- `perf/*`
- `deploy/pages-bootstrap`
- `local-asr-*`, `native-local-asr*`
- `temp/*`, `tmp/*`
- その他、過去の個別検証用ブランチ

これらのブランチから直接GitHub Pagesを公開したり、`chore/trigger-pages`へ手動pushしたりしない。

## Deployment invariant

公開版のコードは常に次を満たすこと。

```text
main HEAD
  ==
chore/trigger-pages HEAD
  ==
GitHub Pages build source commit
```

`main` のpush時にCIがこの同期を自動実行する。同期できない場合はpublish jobを失敗させ、古い公開版を正常扱いしない。

## 過去の安定版スナップショット

`stable/2026-09-25` は2026-09-25時点の比較用スナップショットです。現在の推奨版や最新の復旧先ではありません。通常の開発では更新せず、必要な過去版はコミットSHAと対応するCI結果を確認して参照します。

現在の構成は [README.md](README.md) と `main` のソースを参照してください。

### 当時の主な動作

安定版とした時点の主な動作:

- 2回目以降も会話画面で自動セッション開始
- 一時的なマイク許可が失効していれば、実際の `getUserMedia()` により再度許可を要求
- マイク取得をMoonshine / Kitten初期化より先に実施
- モデル準備中はVAD入力を無視
- 準備完了後にVADをリセットして聞き取り開始
- Service Worker / app shellのキャッシュ更新を明示的に管理
- `main` からPages公開元へ自動同期

## 開発資料と過去の検証

- [README.md](README.md)：現在の使い方、構成、開発方法。
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)：現行の第三者コンポーネントと帰属。
- [LICENSE_AUDIT.md](LICENSE_AUDIT.md)：過去のPiper/Kokoro比較経路の削除と現行構成の監査。旧経路の記載は導入手順ではありません。
- [topic-guide.html](topic-guide.html)：現在の話題判定と呼びかけ例。

`model-lab.html` は開発用の比較ページです。通常の利用画面や、本番で使用するモデルの選択肢一覧として扱いません。

過去の実験・修正ブランチは履歴として保持します。古い検証結果やブランチ名だけを根拠に、本番のモデル構成を戻しません。

## English

`main` is the development source; `chore/trigger-pages` is the CI-managed Pages source. `stable/2026-09-25` is a historical comparison snapshot, not the current recommended version. Other experimental branches remain historical references. The README describes current behavior, while LICENSE_AUDIT explicitly distinguishes removed comparison paths from the current stack. `model-lab.html` is a development comparison page, not the production model selector.
