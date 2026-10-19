#!/usr/bin/env python3
"""Prepare artwork and voice-backed UI review for the dedicated GitHub Pages repo."""
from pathlib import Path
import argparse, hashlib, json, shutil, subprocess

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'assets/visual-cue/artwork'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True, help='New directory for the publication package')
args = parser.parse_args()
source_commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
def committed(relative):
    return subprocess.check_output(['git','show',source_commit+':'+relative],cwd=ROOT)
manifest = json.loads(committed('assets/visual-cue/artwork/manifest.json'))
qa = json.loads(committed('assets/visual-cue/artwork/qa/validation.json'))
assert qa['passed'] and qa['assetCount'] == len(manifest['assets'])
args.output.mkdir(parents=True, exist_ok=False)
(args.output/'index.html').write_text(committed('assets/visual-cue/artwork/preview-offline.html').decode().replace('href="../../../visual-cue-ui-preview.html"','href="ui.html"').replace('<body>','<body><nav style="padding:14px;text-align:center;background:#f4edf6"><a href="test/">テスト版アプリを開く</a> · <a href="coverage.html">英文の網羅率を見る</a></nav>'))
# Publish only the display-component demo, not the microphone/AI application.
(args.output/'ui.html').write_text(committed('visual-cue-ui-preview.html').decode().replace('href="./visual-cue-test.html"','href="./test/"').replace('href="./visual-cue-coverage.html"','href="./coverage.html"'))
(args.output/'coverage.html').write_text(committed('visual-cue-coverage.html').decode().replace('data-trial-url="./visual-cue-test.html"','data-trial-url="./test/"').replace('href="./visual-cue-test.html"','href="./test/"'))
files=['src/visual-cue-ui-preview.js','src/visual-cue-controller.js','src/visual-cue-catalog.js','src/emma-background-cues.js','src/emma-preview-motion.js','shared/visual-cue-ui-examples.json',*['assets/emma-face/'+name for name in ['emma-face-idle-open.svg','emma-face-idle-half.svg','emma-face-idle-closed.svg']+['emma-face-talk-'+size+blink+'.svg' for size in ['small','medium','large'] for blink in ['', '-half','-closed']]]]
for a in manifest['assets']:
 if a['status']=='accepted' and a['id']!='wake-daylight':
  files.extend('assets/visual-cue/artwork/'+a[k] for k in ['animation','illustration','poster'] if a.get(k))
examples=json.loads(committed('shared/visual-cue-ui-examples.json'))
files.extend(e['audio'] for e in examples)
files += ['visual-cue-coverage.css','src/visual-cue-coverage.js','shared/visual-cue-trial-data.json','shared/visual-cue-coverage.json','shared/visual-cue-coverage.csv']
for file in sorted(set(files)):
 dest=args.output/file;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(committed(file))
# Separate path for the actual app test, without installing a worker over the gallery.
trial_html=committed('visual-cue-test.html').decode().replace('data-visual-cue-trial="true"','data-visual-cue-trial="true" data-coverage-url="../coverage.html"')
trial=args.output/'test';trial.mkdir();(trial/'index.html').write_text(trial_html)
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',source_commit,'--','src','icons','worklets'],cwd=ROOT,text=True).splitlines()
trial_files=[p for p in tracked if '/vendor/kitten/' not in p and p not in ['src/preview-emma-app.js','src/emma-gestures.js'] and not p.startswith('src/visual-cue-prototype')]
trial_files += ['styles.css','visual-cue-trial.css','shared/play-topics.json','shared/visual-cue-trial-data.json','assets/voice-1202/manifest.json']
trial_files += ['assets/voice-1202/'+e['file'] for e in json.loads(committed('assets/voice-1202/manifest.json'))['entries']]
trial_files += ['assets/mitsukotoba-'+s+'.png' for s in ['parent','baby','ai']]
trial_files += [p for p in files if p.startswith(('assets/emma-face/','assets/visual-cue/artwork/'))]
for file in sorted(set(trial_files)):
 dest=trial/file;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(committed(file))
published=['ui.html','coverage.html','test/index.html']+sorted(set(files))+['test/'+p for p in sorted(set(trial_files))]
ui_hashes={file:hashlib.sha256((args.output/file).read_bytes()).hexdigest() for file in published}

(args.output / '.nojekyll').write_text('')
metadata = dict(sourceRepository='eltnegcellist/Web_EmmaLocal_English_for_babies',
                sourceCommit=source_commit, reviewPullRequest=107,
                artifactSHA256=hashlib.sha256((args.output / 'index.html').read_bytes()).hexdigest(),
                stills=sum(a['kind'] == 'illustration' for a in manifest['assets']),
                animations=sum(a['kind'] == 'animation' for a in manifest['assets']),
                accepted=sum(a['status']=='accepted' for a in manifest['assets']), nonRuntime=True, uiPreview='ui.html', trialApp='test/', coverageReport='coverage.html', uiFileSHA256=ui_hashes, emmaGestureCandidates=0,withdrawnEmmaGestures=7,emmaBackgroundCandidates=2, applicationDeployed=False, trialApplicationDeployed=True)
(args.output / 'deployment.json').write_text(json.dumps(metadata, indent=2) + '\n')
(args.output / 'README.md').write_text('''# Visual Cue イラスト・動画プレビュー

[プレビューを開く](https://eltnegcellist.github.io/visual-cue-artwork-preview/)

静止画と動作を比較する採用審査用ページです。制作元は
[Web_EmmaLocal_English_for_babies / PR #107](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/pull/107)。
採用済み素材と旧版を区別するプレビューです。採用数はdeployment.jsonを参照してください。\n\n[音声付きUIプレビュー](https://eltnegcellist.github.io/visual-cue-artwork-preview/ui.html)では、実際の表示部品と採用済み録音音声で切替を確認できます。mainのまばたき・口パクを維持し、ハート・星を背景に出す2案を確認できます。7種類の差し替え身振りは撤回済みで、英文割当と背景の意味は確認候補です。マイク・AIモデル・アプリ本体の公開は含みません。

[テスト版アプリ](https://eltnegcellist.github.io/visual-cue-artwork-preview/test/)は制作ブランチの実際の画面・音声Worker・表示制御を使用します。「押して聞く」と全英文の選択再生を試せます。テスト入口ではマイク・認識モデルの自動起動を行わず、録音音声は再生時に検証して取得します。本番アプリの更新やmainへのマージは行いません。
[英文の網羅率](https://eltnegcellist.github.io/visual-cue-artwork-preview/coverage.html)で、0件の動画も含む全件数・割合と英文CSVを確認できます。

公開元は `gh-pages` ブランチのルートです。`index.html` は動画を内包した単一HTMLで、
GitHub Pagesでもローカルのファイルとしても閲覧できます。
生成元コミットとHTMLのSHA256は `deployment.json` を参照してください。

再公開は制作元の `scripts/visual-cue/prepare_pages.py` でパッケージを作成し、
このリポジトリの `gh-pages` にコミット・pushします。
''')
print(json.dumps(dict(output=str(args.output), **{k:v for k,v in metadata.items() if k!='uiFileSHA256'}, uiFiles=len(ui_hashes)), indent=2))
