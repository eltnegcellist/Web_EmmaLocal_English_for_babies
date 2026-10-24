# CooTrio E5 Interaction v3 — research-only training

This folder is an isolated GitHub Actions experiment. It **does not deploy or update the production E5 model, Topic head, or Interaction head**.

Workflow: `.github/workflows/e5-interaction-v3-research.yml`; it runs on pushes to `research/e5-interaction-v3-actions`. `workflow_dispatch` is available after the workflow is present on the default branch (not required for the research-branch push run).

The fixture is exactly the prior 360 provisional synthetic utterances (225 train, 135 heldout validation) and the locked 154 ASR×E5 text references (diagnostic-only). Base85/LZMA compressed source files are SHA256-verified at startup. Human review = **0**, so neither metric is product accuracy. The 154 diagnostic examples are never used to fit or select the model. Do not tune hyperparameters based on their results.

Model: `Xenova/multilingual-e5-small` pinned at revision `761b726dd34fb83930e26aab4e9ac3899aa1fa78`, q8 ONNX checksum checked. Exactly the repository's checked-out `multilingual-assets/heads/interaction.f32` is the baseline with the source `config.json` SHA256 validation. Feature extraction: `query: ` prefix, max_length 512, mean pooling, L2 normalization. Train only multinomial logistic regression head; output `interaction.candidate.f32` in Actions artifact.

Run: open GitHub Actions for the research branch push; inspect the `cootrio-e5-interaction-v3-research-*` artifact containing `comparison.json`, `score_summary.json`, `candidate_manifest.json`, `interaction.candidate.f32`, `python-packages.txt`. GitHub Actions network access is required to fetch the pinned E5 ONNX, tokenizer and Python packages; download failure is reported as job failure. `ubuntu-24.04` CPU performance must not be used as Galaxy S25 / browser WASM performance.

Evaluation limitations: label definitions may need human adjudication, English has many more training phrases than the other languages, some translated text may be unnatural, and the locked evaluation contains only 22 semantic templates repeated in 7 languages. Approve only after language review, a fresh independent evaluation, and WASM/phone parity checks.
