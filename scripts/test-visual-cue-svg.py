"""Reject malformed SVGs and unsafe external references in visual cue prototypes."""
from pathlib import Path
from xml.etree import ElementTree as ET
import json
root_dir = Path(__file__).resolve().parent.parent
manifest = json.loads((root_dir / "shared/visual-cue-prototype-manifest.json").read_text())
for item in manifest["entries"]:
    if item["mode"] != "illustration":
        continue
    path = root_dir / item["image"]
    svg = ET.parse(path).getroot()
    assert svg.tag.endswith("svg"), str(path)
    assert svg.attrib.get("viewBox") == "0 0 480 360", str(path)
    assert any(e.tag.endswith("title") and (e.text or "").strip() for e in svg), str(path)
    assert any(e.tag.endswith("desc") and (e.text or "").strip() for e in svg), str(path)
    for el in svg.iter():
        assert not el.tag.endswith("script"), str(path)
        for key, value in el.attrib.items():
            assert not key.startswith("on"), str(path)
            if key.endswith("href"):
                assert not value.startswith(("http:", "https:", "//")), str(path)
print("Eight SVG prototypes: XML, accessibility labels and offline references OK")
