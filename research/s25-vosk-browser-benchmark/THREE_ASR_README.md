# Galaxy S25: same audio, Vosk / Moonshine Small / Whisper Small

Research-only, a companion to the earlier Vosk-only S25 tester. **No published app, Pages deployment, or existing ASR path is changed.**

## Test URL
Commit-pinned rawcdn.githack HTTPS link to `research/s25-vosk-browser-benchmark/compare.html`. The tester registers a **Service Worker scoped to this research subdirectory** which adds COOP/COEP to its own navigations for Moonshine/Whisper pthread WebAssembly. First load may reload once or twice. This does not change the CooTrio app Service Worker.

## Workflow on Galaxy S25 standalone Chrome
1. Open the page and verify the isolation indicator. If it is not enabled after automatic reload, Moonshine may not run; save the error instead of reporting zeros.
2. Select **the same local audio**, e.g. `milk-invite-B-legacy.wav`. It is converted once to 16 kHz mono. No upload.
3. Choose a 5-second window and 3 or 5 repeats. The exact same PCM plus **0.8 seconds padded trailing silence** goes to each engine.
4. Load English Vosk Small, measure; then load English Moonshine Small Streaming and measure; then Whisper Small q8 and measure. **Only one engine stays loaded at a time** (new engine unloads prior worker/model).
5. For each engine: p50/p95 (elapsed from full PCM submission to recognition result), real-time-factor (using complete speech window + pad), cold model load, raw per-pass text. JSON copy for diagnostic submission.
6. Repeat with a 10-second window. Model load time is excluded from ASR time but reported separately.

### Engine implementation
- Vosk: same `vosk-browser@0.0.5` and upstream 40 MB English TAR as prior S25 trial, but **only final recognizer result** completes a timing; `partialresult` is discarded. `retrieveFinalResult()` is sent after `acceptWaveform`; `recognizerId` is checked to reduce cross-run callback confusion. This addresses the earlier **13.8 ms artifact**.
- Moonshine: vendored app implementation `src/moonshine-module.js` and official **Small Streaming English** weights (MIT), through same-origin dedicated Web Worker; strict COI/SharedArrayBuffer check, WASM decompress/hashes reuse shipping code.
- Whisper: pinned app `Xenova/whisper-small` q8 revision from `src/multilingual/assets.json` via existing `src/multilingual/assets.js`, `multilingual-assets/runtime/transformers.mjs` and ONNX wasm. Only Whisper assets (~250MB) are downloaded; **E5 is excluded** to isolate ASR. Uses the same CooTrio `resolveWhisperThreads('auto')` rule. Explicit English prompt, 80 output tokens.
- Main-thread elapsed measures **browser-visible latency** from sending one full buffer to final response; worker reports internal processing separately where available. It is not continuous streaming end-of-speech delay.
- No classification/E5 timing in 3-ASR tester.
- Relative model/code imports resolve through the project source on same research commit; no main app patch.

### Checks
- `node --check` each JS worker and UI.
- Headless Linux Chromium **real model + WAV 3x** tests for original Vosk page and new comparison, including Service Worker COOP/COEP isolation. Browser smoke is **not** a Galaxy S25 runtime measurement.
- If large Moonshine/Whisper model downloads fail on rawcdn proxy, preserve exact status; investigate hosting/CORS rather than claiming a speed value.
- First run can consume significant bandwidth and storage; Whisper model assets are especially large.
- Compare only **same PCM, window, release config, device** and distinguish model download vs inference.
