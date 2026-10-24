#!/usr/bin/env python3
"""Aggregate locale-specific GitHub Actions artifacts without hiding failed jobs."""
import json,os,sys
from pathlib import Path
ROOT=Path(sys.argv[1]) if len(sys.argv)>1 else Path("research/e5-locale-encoders/artifacts")
OUT=Path("research/e5-locale-encoders/summary.md")
ALL=["en","de","fr","ko","th","zh","hi"]
arms=["A_shared_v2","B_e5_local","B_e5_weighted","C_dedicated_encoder"]
found={}
for f in ROOT.rglob("comparison.json"):
    obj=json.loads(f.read_text(encoding="utf-8"))
    name=obj.get("language")
    if name in ALL:found[name]=obj
lines=[
"# CooTrio locale-specific E5 research — synthetic, unreviewed",
"",
"**NOT FOR PRODUCTION.** Baseline reproducibility is enforced per example inside each locale job.",
"",
"| Language | Method | Validation (Interaction) | Oracle (Interaction / both) | ASR (Interaction / both) |",
"|---|---|---:|---:|---:|"
]
def metric(block):
    if not block:return "—"
    n=block["n"]
    i=f'{block["interaction_correct"]}/{n}'
    return f'{i} / {block["joint_correct"]}/{n}' if "joint_correct" in block else i
for lang in ALL:
    if lang not in found:
        lines.append(f"| {lang} | **MISSING/FAILED** | — | — | — |")
        continue
    block=found[lang]
    for arm in arms:
        scores=block["comparison"].get(arm,{})
        lines.append(f'| {lang} | {arm} | {metric(scores.get("validation"))} | {metric(scores.get("frozen154_oracle"))} | {metric(scores.get("frozen374_asr"))} |')
lines.extend(["","## Interpretation safeguards","",
"- Language models use different encoders, parameters and memory sizes; compare runtime on Galaxy S25 and browser WASM before product selection.",
"- Only 15 training and 15 validation examples per non-English language, one train per class; these are far too few to certify gains.",
"- Frozen 154/374 are clustered translations of 22 meaning templates, not independent natural-speech observations.",
"- Topic head is unchanged across all arms; this evaluates only Interaction specialization.",
"- Do not tune on the frozen 154/374; only fit with training split and inspect family-separated validation.",
"",
"Missing languages: "+(", ".join(l for l in ALL if l not in found) or "none"),
""])
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text("\n".join(lines),encoding="utf-8")
summary=os.environ.get("GITHUB_STEP_SUMMARY")
if summary:
    with open(summary,"a",encoding="utf-8") as f:f.write(OUT.read_text(encoding="utf-8"))
print(OUT.read_text(encoding="utf-8"))
