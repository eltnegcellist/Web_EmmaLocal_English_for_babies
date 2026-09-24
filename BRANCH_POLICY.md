# Emma Web branch policy

## Active branches

- `main`
  - 唯一の開発・本番ソース。
  - 変更はここへ集約する。
  - CIのSmoke testとJavaScript構文チェックが成功した場合のみ公開処理へ進む。

- `chore/trigger-pages`
  - GitHub Pages専用の公開元ブランチ。
  - **手動編集禁止**。
  - `main` のCI成功後にGitHub Actionsがfast-forwardし、同じコミットSHAであることまで検証する。
  - GitHub Pages sourceはこのブランチのroot。

- `stable/2026-09-25`
  - 2026-09-25時点の安定版スナップショット。
  - 通常の開発では更新しない。
  - 障害時の比較・復旧基準として使う。

## Legacy / experimental branches

上記3系統以外は、過去の検証・修正・比較用ブランチとして扱い、現在の本番やPages公開には使用しない。

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

## Stable baseline

安定版とした時点の主な動作:

- 2回目以降も会話画面で自動セッション開始
- 一時的なマイク許可が失効していれば、実際の `getUserMedia()` により再度許可を要求
- マイク取得をMoonshine / Kitten初期化より先に実施
- モデル準備中はVAD入力を無視
- 準備完了後にVADをリセットして聞き取り開始
- Service Worker / app shellのキャッシュ更新を明示的に管理
- `main` からPages公開元へ自動同期
