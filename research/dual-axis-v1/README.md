# CooTrio dual-axis corpus expansion v1 (research only)

The actual production label configuration has **22 Topic classes** (including `generic`) and **15 Interaction classes** (including `none`). These are **37 separate labels on two axes**, not 15 total. The theoretical Cartesian product has 330 combinations; **not every combination is natural**, and we will not manufacture every pair to chase coverage numbers.

## What this PR contains

- Topic seeds: 22 labels × 7 languages × 2 authored sentences = **308**.
- Interaction seeds: 15 labels × 7 languages × 2 authored sentences = **210**.
- Total newly authored utterances **518** before overlap/duplicate filtering.
- Automatically imports the earlier **360** Interaction-only utterances, using their immutable SHA-256-checked archive, while explicitly leaving Topic unknown. Total candidate corpus before exclusions: **878** rows.
- Seven languages: en, de, fr, ko, th, zh, hi.
- Seeds are **assistant-authored, synthetic, unreviewed, and not native-speaker validated**. They are a starter corpus, not a high-quality training dataset.
- Every sample labels **only the intended supervised axis**. The other axis is `null` (unknown), not guessed as `generic` or `none`.
- The earlier 360-sentence v3 corpus is imported as an Interaction-only source with the original train/validation semantic-family split. Its Topic labels are deliberately null.
- Frozen evaluation **154 reference sentences + 374 ASR transcripts** are explicitly excluded by normalized-text comparison, never fitted/tuned.
- Distinct semantic-family / review counts are tracked; templated surface variants must not be passed off as independent examples.

## Data targets

A provisional quality target is **50 distinct human-reviewed, natural meaning families per label per language**. A minimum screening gate is 30 reviewed meaning families per label per language, combined with independent validation and a new blind test. This target is a project threshold, not evidence that 30–50 guarantees model accuracy.

| Axis | Labels | 50 families per label and language | Across 7 languages |
|---|---:|---:|---:|
| Topic | 22 | 1,100 | 7,700 |
| Interaction | 15 | 750 | 5,250 |
| **Axis-label assignments** | **37** | **1,850** | **12,950** |

A single reviewed utterance with both labels contributes one *assignment to each axis*. Thus 12,950 axis-label assignments is **not necessarily** 12,950 distinct sentences. Topic×Interaction pair coverage should be based on realistic, manually defined compatibility, never automatic 330-way generation.

## Execute starter extraction and gap audit

From the repository root:

```bash
python research/dual-axis-v1/build.py
```

Outputs in `research/dual-axis-v1/outputs/`:

- `starter_corpus.jsonl` — normalized research starter set with explicit missing labels.
- `coverage.json` — per language, per axis, per label counts, reviewed family counts, deficits to 30 and 50.
- `excluded.json` — duplicates and exact overlap with locked 154+374.
- `summary.json` — source counts, schema and quality status.

To merge later reviewed examples, pass `--additional-jsonl PATH`. Rows must have:

```json
{
  "id": "en-bath-inquiry-native-001",
  "language": "en",
  "text": "Is the bath water warm enough?",
  "topic": "bath",
  "interaction": "inquiry",
  "semantic_family": "bath-temperature-check-001",
  "split": "train",
  "source": "native_caregiver_review",
  "label_reviewed": true,
  "native_speaker_reviewed": true
}
```

**Do not mark as reviewed without actual human verification.** Assign train/validation splits by independent semantic families, keep pairs of near-paraphrases in the same split, and reserve independent speech speakers/recordings for final evaluation.

## Label quality and minimum pairs

Focus on the hard boundaries noted in v3:

- inquiry vs invitation vs finish_check
- start vs repeat vs pause vs finish
- affection vs praise vs achievement vs encouragement vs effort
- care vs reassurance

For Topics, create boundaries for `milk` vs `drink`, `food` vs `milk`, `sleep` vs `wake`, `voice` vs `cry`, `rain` vs `outside`, and `play` vs `music`. Explicitly include `generic` and Interaction `none` as negative classes. Get naturally uttered baby-directed speech across different caregivers, dialects, phrasing lengths and ASR errors. Avoid translating the same 22 templates seven times and treating them as independent observations.

## Safety and applicability

- Dataset target and seeds do **not** demonstrate improved model quality.
- Never merge candidate heads from this branch to `multilingual-assets/heads`, and never deploy.
- No GitHub Actions retraining is triggered until adequate **human-reviewed** training and independent validation exist.
- Record the exact reviewed dataset provenance and holdout split before training either axis.
