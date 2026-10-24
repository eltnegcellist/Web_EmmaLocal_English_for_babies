# Lightweight Korean/French ASR: accuracy **and** latency

This is a research-only Vosk Small → E5 benchmark. Models and clips are unchanged between accuracy and timing calculations; no production routes have changed.

## Models
- Korean `vosk-model-small-ko-0.22` (~82 MB ZIP, Apache 2.0)
- French `vosk-model-small-fr-0.22` (~41 MB ZIP, Apache 2.0)
- Both use the same **previously generated 22-waveform synthetic test set**, per language, as previous Whisper comparisons. Each WAV file is individually SHA-256 verified before recognition.

## Reported metrics
1. **Recognition accuracy**: CER, Topic, Interaction, and both-correct / 22.
2. **ASR-only wall clock**: first utterance, p50/median, p95, per-sample and total; excludes downloading and loading model.
3. **RTF**: ASR seconds / audio seconds, both per-sample p50/p95 and duration-weighted overall. Lower is faster; RTF below 1 indicates faster-than-real-time processing.
4. **Classification latency**: E5 embedding p50/p95 and **ASR + E5 + heads** p50/p95, measured per same utterance.
5. **Startup cost**: Vosk ASR model initialization and E5 encoder initialization independently measured.
6. **Memory**: Linux process peak resident memory. This includes Python, Vosk and E5, not just Vosk model weights.
7. **Environment**: Linux OS, Python version, SHA-256 of archived Vosk weights, every audio length, per-clip runtime and transcript.

Korean also generates `outputs/ko/vosk_vs_whisper_speed.json` comparing Vosk against the **already measured same-WAV Whisper Small baseline** from GitHub Actions run `40079226795`, which reported ASR median 1763.705 ms and p95 1857.597 ms across 22 clips. Since the jobs run on **different GitHub-hosted CPU VMs**, this ratio is indicative, not a controlled same-device benchmark. French has no successfully completed same-WAV Whisper baseline, so no speed ratio will be fabricated.

**Do not** equate Linux native Kaldi/PyTorch inference with Android Galaxy S25 WebAssembly. A production decision requires on-device 5/10 second windows, peak RAM, download and cold-start behavior, and speaker-independent recordings.

## Running
GitHub Actions `Lightweight Korean French Vosk ASR E5 benchmark` on `research/lightweight-vosk-ko-fr-v1` runs both locales and publishes auditable `summary.json`, `predictions.jsonl`, and logs. Repeated changes to this research branch retrigger tests; the latest run is authoritative. No Zipformer or large Whisper is downloaded by this new Vosk workflow (the previously measured Whisper JSON is downloaded for comparison only).
