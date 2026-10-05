#!/usr/bin/env python3
"""Guard the common play phrase contract and its generated explanation."""
import hashlib, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
path=root / ("app/src/main/assets/play-topics.json" if (root/"app").exists() else "shared/play-topics.json")
data=json.loads(path.read_text())
assert data["schemaVersion"] == 1
assert hashlib.sha256(path.read_bytes()).hexdigest() == "6f4fe0c8cb7c2251b9754490c0617638dcc784eb6e87aa03e5eeb2fb82635a54", "Update both editions and this contract hash together"
assert len({t["id"] for t in data["topics"]}) == len(data["topics"])
for topic in data["topics"]:
    assert len(topic["phrases"]) >= 2
    assert len(set(topic["phrases"])) == len(topic["phrases"])
    assert all(2 <= len(p.split()) <= 8 for p in topic["phrases"])
    assert all("you are" not in p.lower() and "you have" not in p.lower() and "you're" not in p.lower() for p in topic["phrases"])
expected="\n".join("| "+t["label"]+" | "+" / ".join(t["phrases"])+" |" for t in data["topics"])
assert expected in (root/"FEATURES.md").read_text(), "Phrase explanation is out of date"
assert len(data["topics"]) == 22
assert sum(len(t["phrases"]) for t in data["topics"]) == 110
assert all(len(__import__("re").findall(r"[.!?]+", p)) == 3 for t in data["topics"] for p in t["phrases"])
print("Shared play contract: 22 topics, 110 phrases and explanation OK")
