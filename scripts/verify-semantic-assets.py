"""Integrity check for the assets actually shipped by Pages; no model evaluation."""
import hashlib,json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((root/'src/semantic-assets-manifest.json').read_text())
for name,meta in manifest['assets'].items():
    path=(root/'src'/meta['url']).resolve()
    assert path.is_relative_to(root), f'Asset outside app: {name}'
    assert path.stat().st_size==meta['bytes'], f'Wrong size: {name}'
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    assert h.hexdigest()==meta['sha256'], f'Wrong SHA256: {name}'
assert manifest['assets']['model.onnx']['sha256']==manifest['modelSha']
print(f"Verified {len(manifest['assets'])} pinned Semantic assets for Pages")
