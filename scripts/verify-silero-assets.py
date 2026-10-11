from pathlib import Path
import hashlib, json

root = Path(__file__).resolve().parents[1]
folder = root / "app/src/main/assets/vad" if (root / "app").is_dir() else root / "assets/vad"
expected = "1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3"
model = (folder / "silero_vad.onnx").read_bytes()
metadata = json.loads((folder / "model-provenance.json").read_text())
assert hashlib.sha256(model).hexdigest() == expected == metadata["sha256"]
assert len(model) == 2327524 == metadata["bytes"]
assert metadata["silence_ms"] == 1100
assert "MIT License" in (folder / "LICENSE-SILERO-VAD-MIT.txt").read_text()
print("Silero model SHA-256, size, provenance and MIT notice: OK")
