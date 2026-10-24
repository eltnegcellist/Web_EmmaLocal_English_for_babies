# CooTrio – locale-specific Interaction encoder/head experiment (research only)

This draft branch compares on the exact same family-disjoint validation and frozen 154 sentences:
- **A**: current frozen E5 + current shared v2 Interaction head.
- **B1**: current frozen E5 + 15-class logistic head trained ONLY for that language.
- **B2**: current frozen E5 + logistic head trained across languages with a 4x weight for that language.
- **C**: frozen language-focused MIT/Apache-2.0 encoder + locale-only logistic head.

Languages: en/de/fr/ko/th/zh/hi. Existing v3 research data from the parent branch remains **unreviewed**: 360 examples total, 225 train, 135 validation. Non-English locales have only 15 training and 15 validation sentences, one example per Interaction class per split; model rankings are exploratory only. A held-out 154 examples are used for final diagnostic evaluation only and **not training or hyperparameter selection**. No ASR rerun. The 374 ASR transcripts are currently available in the separate locally generated evaluation kit, not yet attached to this GitHub job.

**Topic remains on the original frozen E5 v2 head across all arms**. This is not a dual-axis language-specific deployment experiment because independent Topic training data is missing. Report Topic+Interaction joint accuracy using the fixed Topic prediction only.

Candidate language-focused models (every repo license must be checked at runtime):
- en BAAI/bge-small-en-v1.5 (MIT)
- de deepset/gbert-base (MIT; base masked LM, mean pooling is not trained for sentence similarity)
- fr dangvantuan/sentence-camembert-base (Apache-2.0)
- ko dragonkue/multilingual-e5-small-ko-v2 (Apache-2.0; Korean-adapted multilingual E5)
- th alphaedge-ai/multilingual-e5-small-tha-16384 (MIT; trimmed E5 vocabulary, not Thai intent finetuning)
- zh BAAI/bge-small-zh-v1.5 (MIT)
- hi AkshitaS/bhasha-embed-v0 (Apache-2.0; Hindi/English embedding).

Workflow: .github/workflows/e5-locale-encoders-research.yml, pushes to research/e5-locale-encoders-v1 trigger 7 matrix jobs. Files under multilingual-assets/heads/ must remain unchanged. Research artifacts are never deployed. All models' exact resolved Hugging Face git revisions and measured results are saved.

**The interpretation must be conservative**: synthetic unreviewed labels; 22 translated families in frozen evaluation; native CPU only, never infer WASM/Galaxy S25 accuracy or latency. Do not use frozen evaluation to tune C or sample weighting. Get human-labeled natural caregiver speech, broader class-balanced training, independent Topic corpus and runtime benchmarking before production decisions.
