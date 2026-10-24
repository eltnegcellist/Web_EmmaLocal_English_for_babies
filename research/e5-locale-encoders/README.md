# CooTrio – locale-specific Interaction encoder/head experiment (research only)

This draft branch compares on the exact same family-disjoint validation and frozen 154 sentences:
- **A**: current frozen E5 + current shared v2 Interaction head.
- **B1**: current frozen E5 + 15-class logistic head trained ONLY for that language.
- **B2**: current frozen E5 + logistic head trained across all languages; first balance total weight per language, then apply a 4x weight to the target language.
- **C**: frozen language-focused MIT/Apache-2.0 encoder + locale-only logistic head.

Languages: en/de/fr/ko/th/zh/hi. Existing v3 research data from the parent branch remains **unreviewed**: 360 examples total, 225 train, 135 validation. Non-English locales have only 15 training and 15 validation sentences, one example per Interaction class per split; model rankings are exploratory only. A held-out 154 reference-text examples and frozen 374 ASR transcripts are evaluated after training, never used for fitting or hyperparameter selection. No ASR rerun. The original v2 Topic and Interaction predictions for all 528 texts must match exactly before the experimental comparisons are considered valid.

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

## Failure isolation and reproducibility

The baseline v2 predictions must match 154 reference texts and 374 fixed ASR texts exactly before any new scores are reported. If the dedicated-language C encoder is incompatible, unavailable, or fails its MIT/Apache-2.0 license gate, A/B1/B2 results are still saved. The C arm is explicitly marked `FAILED` or `EXCLUDED_LICENSE`, with a reason, and never treated as a zero-accuracy model. Each locale job saves `run.log`, head weight binaries, and a SHA-256 manifest in research-only artifacts. Candidate weights are never copied into production.

The GitHub workflow is configured for pushes to `research/e5-locale-encoders-v1`; workflow runs and their success must be independently confirmed on the repository's Actions page. Commit creation alone does not prove that GitHub Actions ran or completed.
