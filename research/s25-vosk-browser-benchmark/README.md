# Galaxy S25 Vosk WASM speed benchmark (standalone research tool)

This branch adds **only** `research/s25-vosk-browser-benchmark/` and a lightweight JS syntax check. No app/ASR production code, original Pages site or models have been changed.

## Open from Galaxy S25 Chrome

Development-only HTTPS preview (the third-party HTML proxy might require pressing a one-time confirmation):

https://raw.githack.com/eltnegcellist/Web_EmmaLocal_English_for_babies/research/s25-vosk-browser-benchmark-v1/research/s25-vosk-browser-benchmark/index.html

The benchmark uses the upstream `vosk-browser@0.0.5` JS/WebAssembly runtime from jsDelivr. **No speech audio is uploaded** by our source code. Only the model and browser code are downloaded.

### Workflow

1. Select **English Vosk Small (known demonstration model)** initially, then "モデルを読み込む"; initial model download roughly 40 MB. French model is a separate experimental URL (its `model/` tar layout and CORS have not yet been verified on S25). Selecting custom supports an independently hosted Vosk-browser-format `model.tar.gz`. **Official Vosk model `.zip` cannot be passed to vosk-browser**.
2. Select 5 seconds and 3 repetitions.
3. Record one phrase on the same Galaxy S25 via microphone, or select an audio file, then click "3回測定する".
4. Repeat at 10 seconds. Copy the output JSON into the research discussion.
5. For Moonshine comparison, run exactly the same selected audio with the current CooTrio Moonshine test and compare `ASR p50/p95` **after model load**. Do not compare Vosk's model-download time to Moonshine's recognition timing.

### Metrics and validity

- `modelLoadMs`: network + extraction + WASM/worker model startup (not inference).
- `elapsedMs`: time between passing one complete 16kHz 5s or 10s `AudioBuffer` to `KaldiRecognizer.acceptWaveform` and receiving the first worker `result` or `partialresult` event. Includes roughly 0.8s trailing silence added to help finalize. Worker processing time is measurable because a whole offline buffer is passed at once. This does **not** measure end-of-speech streaming latency.
- `p50Ms`, `p95Ms`: interpolated p50 and p95 over 3 or 5 repetitions; **p95 of only 3 runs is not a stable tail estimate**.
- `rtfP50`: median inference time divided by audio duration including padded silence. RTF <1 means processing faster than real time.
- Cold first recognition versus subsequent runs, recognized partial/final transcript, user agent/hardwareConcurrency.
- No E5 embedding/classification timing or actual peak RAM measurement, because this page deliberately isolates ASR for direct comparison.

### Limitations

1. English browser-format TAR is hosted by upstream Vosk demo. French TAR on Hugging Face is an **unverified alternate host/packing**; failures must be reported, not presented as runtime scores.
2. The library uses a Web Worker; a browser-embedded ChatGPT webview may not grant microphone permission. Open the page in the standalone Chrome app via the URL.
3. No GitHub Pages deployment is performed: this prevents overwriting CooTrio's existing production Pages deployment. The raw.githack HTTPS proxy serves only this research branch's static HTML.
4. It is not necessarily the same implementation as an eventual CooTrio integrated Vosk engine; a production trial still requires end-to-end ASR + E5 and validation on real childcare phrases, including concurrent CPU/memory loads.
