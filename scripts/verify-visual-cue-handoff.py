#!/usr/bin/env python3
"""Standard library only check for the archived Visual Cue artwork handoff."""
from pathlib import Path
from zipfile import ZipFile
import hashlib
import json

REPO = Path(__file__).resolve().parent.parent
PATH = REPO / "assets/visual-cue/handoff/visual-cue-artwork-v1.zip"
EXPECTED_SHA256 = "73f04e328dc5aed60f810d6a3b4fcfa93f79e65030db2fb3c3b0c90165c6a700"
assert PATH.exists(), f"Missing {PATH}"
assert hashlib.sha256(PATH.read_bytes()).hexdigest() == EXPECTED_SHA256
with ZipFile(PATH) as z:
    assert z.testzip() is None
    metadata = json.loads(z.read("manifest.json"))
    assets = metadata["assets"]
    assert len(assets) == 19, len(assets)
    assert sum(x["status"] == "approved-design-direction" for x in assets) == 4
    assert sum(x["status"] == "design-direction-accepted" for x in assets) == 1
    assert sum(x["status"] == "rejected-color" for x in assets) == 1
    assert sum(x["kind"] == "animated-webp" for x in assets) == 3
    for asset in assets:
        assert asset["path"] in z.namelist()
        assert len(z.read(asset["path"])) == asset["bytes"]
    assert z.read("preview.html").startswith(b"<!doctype html>")
print(f"Visual Cue handoff: {len(assets)} assets and SHA256 verified. This does NOT imply final visual approval.")
