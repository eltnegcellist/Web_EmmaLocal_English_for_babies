#!/usr/bin/env python3
"""Use the real app document and runtime, with an explicit trial-only entry point."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[2]
html=(ROOT/'index.html').read_text()
html=html.replace('<html lang="ja">','<html lang="ja" data-visual-cue-trial="true">')
html=html.replace('<title>みつことば Web</title>','<title>みつことば｜Visual Cue テスト版</title>')
html=re.sub(r'<link rel="manifest"[^>]+>','',html)
html=html.replace('</head>','<link rel="stylesheet" href="./visual-cue-trial.css?v=20261020-hug-preview-v2">\n</head>')
html,n=re.subn(r'(<script type="module" src=")[^"]*src/app.js[^"]*("></script>)',r'\1./src/visual-cue-trial.js?v=20261020-hug-preview-v2\2',html)
assert n==1,'App module entry point changed'
(ROOT/'visual-cue-test.html').write_text('\n'.join(line.rstrip() for line in html.splitlines())+'\n')
print('Trial document generated from the actual app index.html')
