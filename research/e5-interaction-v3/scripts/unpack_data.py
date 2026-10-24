#!/usr/bin/env python3
"""Unpack and validate frozen CooTrio research inputs; fail closed on mismatch."""
from pathlib import Path
import base64, csv, hashlib, json, lzma, collections, re, unicodedata
ROOT = Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'data/manifest.json').read_text())
(ROOT/'data').mkdir(exist_ok=True)
for key, info in manifest.items():
    encoded=(ROOT/'data'/f'{key}.b85').read_text().strip()
    blob=lzma.decompress(base64.b85decode(encoded))
    digest=hashlib.sha256(blob).hexdigest()
    assert digest==info['sha256'], f'{key}: checksum mismatch'
    (ROOT/'data'/info['filename']).write_bytes(blob)
rows=[json.loads(l) for l in (ROOT/'data/interaction_v3_training.jsonl').read_text().splitlines() if l]
with (ROOT/'data/locked_154.csv').open(encoding='utf-8-sig',newline='') as f: locked=list(csv.DictReader(f))
assert len(rows)==360 and len(locked)==154
assert collections.Counter(r['split'] for r in rows)=={'train':225,'validation':135}
assert len(set(r['interaction'] for r in rows))==15
assert len(set(r['language'] for r in rows))==7
assert all(n==24 for n in collections.Counter(r['interaction'] for r in rows).values())
train=[r for r in rows if r['split']=='train']
val=[r for r in rows if r['split']=='validation']
assert not ({r['family_id'] for r in train}&{r['family_id'] for r in val})
def norm(s): return re.sub(r'[^\w]+','',unicodedata.normalize('NFKC',s).casefold())
reserved={(r['language'],norm(r['reference_text'])) for r in locked}
assert not reserved.intersection({(r['language'],norm(r['text'])) for r in rows})
print('Verified corpus: train=225, validation=135, frozen evaluation=154; 7 languages, 15 labels.')
