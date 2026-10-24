# Korean and French ASR experiment (research only)

This branch replaces poor Zipformer candidates **in research experiments**; it does not change CooTrio's released ASR routing or production assets.

**Five actively executed paths**

| Locale | Model ID | Size/role | Declared license |
|---|---|---|---|
| Korean | `openai/whisper-small` | baseline; ~244M parameters | Apache 2.0 |
| Korean | `kimthegarden/whisper-small-ko-new` | Korean finetune; ~244M | MIT |
| French | `openai/whisper-small` | baseline; ~244M | Apache 2.0 |
| French | `bofenghuang/whisper-small-cv11-french` | French finetune; ~244M | Apache 2.0 |
| French | `bofenghuang/whisper-medium-french` | larger French finetune; ~769M | Apache 2.0 |

Each language's 22 caregiving reference utterances are converted into identical 16-kHz mono TTS WAV files by Moonshine's text-to-speech engine. The same WAV bytes, SHA-256 verified, are given to each language's ASR contenders. ASR predictions feed **the same pinned E5 encoder + the same frozen production Topic and three Interaction heads**, and scores include CER, Topic, Interaction, both-correct and Linux CPU latency. This is **not** an unbiased real-audio evaluation or browser runtime.

Run: `Korean French specialized ASR to E5 benchmark` workflow. Its matrix creates two audio artifacts and five ASR score artifacts. If a model has an incompatible decoder generation configuration, the decoder-language prefix is supplied explicitly. Any other failure must remain a failure and cannot be reported as zero accuracy.

## Advanced/high-capacity candidates (not yet measured by this workflow)

- `Qwen/Qwen3-ASR-0.6B`: **Korean + French**, Apache 2.0, ~600M parameters. Raw HF model files around **1.88 GB**; CPU-only memory/runtime may be prohibitive.
- `Qwen/Qwen3-ASR-1.7B`: **Korean + French**, Apache 2.0, ~1.7B parameters; raw checkpoint around **4.7 GB**. Prefer a separate GPU experiment to study the accuracy ceiling rather than an in-browser asset.
- `nvidia/parakeet-tdt-0.6b-v3`: French, 600M parameters, CC BY 4.0 (attribution required); **does not support Korean**. Optimized for NVIDIA hardware.
- `FunAudioLLM/SenseVoiceSmall`: Korean support, ~228 MB sherpa-onnx INT8 conversion; special FunASR model license, not MIT/Apache 2.0. Requires explicit license/legal review before CooTrio distribution.
- Legacy `moonshine-ko-tiny`: Moonshine's official license page classifies this **legacy non-streaming Korean Tiny** under non-commercial Moonshine Community License, unlike new MIT streaming models. Research-only, **not a release candidate**.

## Limitations

- All current 22 test utterance labels are provisional; 0 human-reviewed native speaker labels.
- Moonshine TTS sample audio may sound different from a human caretaker, and may be unintelligible or unnatural in Korean/French.
- Historical 374 ASR transcripts were produced from different TTS audio and are **not** an identical acoustic comparison with this new test.
- E5 meaning classification should be compared on the *same recognized text* and same immutable classification heads.
- Linux CPU inference timings are **not** Galaxy S25 browser WASM timings. Model suitability needs device load time, memory, battery and latency measurement.
- Include no Zipformer rows in the new leaderboard.
