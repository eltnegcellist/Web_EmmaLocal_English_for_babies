"""Structural and safety validation of semireal SVGs, independent of browser rendering."""
from pathlib import Path
from xml.etree import ElementTree as ET
import json
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'shared/visual-cue-semireal-study.json').read_text())
for item in manifest["entries"]:
    path=root/item["new"]
    tree=ET.parse(path)
    svg=tree.getroot()
    assert svg.tag.endswith('svg'),str(path)
    assert svg.get('viewBox')=='0 0 520 390',str(path)
    assert any(e.tag.endswith('title') and (e.text or '').strip() for e in svg),str(path)
    assert any(e.tag.endswith('desc') and (e.text or '').strip() for e in svg),str(path)
    ids={e.get('id') for e in svg.iter() if e.get('id')}
    for part in item['movingParts']:
        assert part in ids, f'{path}: missing moving part {part}'
    assert len(ids)==len(set(ids)),f'{path}: duplicate ids'
    for e in svg.iter():
        assert not e.tag.endswith('script'),str(path)
        for k,v in e.attrib.items():
            assert not k.startswith('on'),f'{path}: executable SVG attr {k}'
            if k.endswith('href'):assert not v.startswith(('http://','https://','//')),str(path)
print('Four semireal SVG scenes pass XML accessibility and no-external-source checks')
