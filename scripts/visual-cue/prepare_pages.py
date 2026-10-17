#!/usr/bin/env python3
"""Prepare only the standalone artwork review for the dedicated GitHub Pages repo."""
from pathlib import Path
import argparse, hashlib, json, shutil, subprocess

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'assets/visual-cue/artwork'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True, help='New directory for the publication package')
args = parser.parse_args()
manifest = json.loads((ART / 'manifest.json').read_text())
qa = json.loads((ART / 'qa/validation.json').read_text())
assert qa['passed'] and qa['assetCount'] == len(manifest['assets'])
source_commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
args.output.mkdir(parents=True, exist_ok=False)
shutil.copyfile(ART / 'preview-offline.html', args.output / 'index.html')
(args.output / '.nojekyll').write_text('')
metadata = dict(sourceRepository='eltnegcellist/Web_EmmaLocal_English_for_babies',
                sourceCommit=source_commit, reviewPullRequest=107,
                artifactSHA256=hashlib.sha256((args.output / 'index.html').read_bytes()).hexdigest(),
                stills=sum(a['kind'] == 'illustration' for a in manifest['assets']),
                animations=sum(a['kind'] == 'animation' for a in manifest['assets']),
                accepted=0, nonRuntime=True)
(args.output / 'deployment.json').write_text(json.dumps(metadata, indent=2) + '\n')
(args.output / 'README.md').write_text('''# Visual Cue イラスト・動画プレビュー

[プレビューを開く](https://eltnegcellist.github.io/visual-cue-artwork-preview/)

静止画と動作を比較する採用審査用ページです。制作元は
[Web_EmmaLocal_English_for_babies / PR #107](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/107)。
審査候補であり、採用承認は0件です。アプリ本体やEmmaの表示切替は含みません。

公開元は `gh-pages` ブランチのルートです。`index.html` は動画を内包した単一HTMLで、
GitHub Pagesでもローカルのファイルとしても閲覧できます。
生成元コミットとHTMLのSHA256は `deployment.json` を参照してください。

再公開は制作元の `scripts/visual-cue/prepare_pages.py` でパッケージを作成し、
このリポジトリの `gh-pages` にコミット・pushします。
''')
print(json.dumps(dict(output=str(args.output), **metadata), indent=2))
