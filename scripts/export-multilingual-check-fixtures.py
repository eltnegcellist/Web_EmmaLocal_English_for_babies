"""Export known, synthetic diagnostics for the browser check. No fitting/inference.

Usage: python3 scripts/export-multilingual-check-fixtures.py /path/to/outputs/multilingual-next
Requires numpy only for loading the saved CPU embedding cache. Does not copy audio.
"""
import hashlib
import json
from pathlib import Path
import sys
import numpy as np

base = Path(sys.argv[1]).resolve()
run = base / '20261019-e5-c10-controlled-v1'
v3 = base / '20261018-e5-text-v3'
dest = Path(__file__).resolve().parents[1] / '.multilingual-test-results'
def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
def lines(p):
    return [json.loads(s) for s in p.read_text().splitlines() if s.strip()]
manifest = json.loads((v3 / 'DELIVERABLES_SHA256.json').read_text())
assert sha(v3 / 'embeddings.npz') == manifest['embeddings.npz']
cache = np.load(v3 / 'embeddings.npz', allow_pickle=False)
assert str(cache['freeze_sha']) == sha(v3 / 'evaluation_freeze.json')
embeddings = dict(zip(cache['ids'].tolist(), cache['X']))
source = {r['id']: r for r in lines(v3 / 'data/corpus.jsonl')}
rows = []
for p in lines(run / 'predictions.jsonl'):
    if p['model'] != 'expanded_c10' or p['split'] != 'test':
        continue
    r = source[p['id']]
    rows.append(dict(id=p['id'],text=r['text'],language=r['language'],
        originalTopic=p['topic_original'],originalInteraction=p['interaction_original'],
        cpuTopic=p['topic'],cpuInteraction=p['interaction']))
assert len(rows) == 450 and len({r['id'] for r in rows}) == 450
probes=[]
for language in ['ja','de','fr','ko','th']:
    r=next(r for r in rows if r['language']==language)
    probes.append(dict(language=language,text=r['text'],topic=r['cpuTopic'],
        interaction=r['cpuInteraction'],embedding=embeddings[r['id']].tolist()))
dest.mkdir(exist_ok=True)
for name,data in [('e5-all.json',rows),('e5-probes.json',probes)]:
    (dest/name).write_text(json.dumps(data,ensure_ascii=False)+'\n')
(dest/'fixture-provenance.json').write_text(json.dumps(dict(
    source=str(run),humanReviewCount=0,knownDiagnostics=True,
    cacheSha256=sha(v3/'embeddings.npz'),
    predictionsSha256=sha(run/'predictions.jsonl')),indent=2)+'\n')
print('Exported frozen known diagnostics to',dest)
