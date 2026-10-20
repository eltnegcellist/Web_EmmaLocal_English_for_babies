# Multilingual on-device components

Pinned model URLs, sizes, revisions and SHA-256 are recorded in
`src/multilingual/assets.json` (or its packaged Android copy).

- **Whisper Small**: OpenAI Whisper, MIT. See WHISPER-MIT.txt.
  https://github.com/openai/whisper
- **Converted Whisper Small ONNX**: Xenova/whisper-small,
  revision `2d67713f236afa48a18992566e7647f6ca848e13`, Apache-2.0 model card.
  https://huggingface.co/Xenova/whisper-small/tree/2d67713f236afa48a18992566e7647f6ca848e13
- **Multilingual E5 Small**: Microsoft, MIT. See E5-MIT.txt.
  Converted ONNX: Xenova/multilingual-e5-small,
  revision `761b726dd34fb83930e26aab4e9ac3899aa1fa78`.
  https://huggingface.co/Xenova/multilingual-e5-small/tree/761b726dd34fb83930e26aab4e9ac3899aa1fa78
- **Transformers.js 3.8.1**: Hugging Face, Apache-2.0.
  Its license is included in `multilingual-assets/runtime/LICENSE-transformers.txt`.
- **ONNX Runtime Web 1.30.0**: Microsoft, MIT. See ONNXRUNTIME.txt.
  The runtime license is also included alongside the bundled runtime; existing
  ONNX Runtime third-party notices in `licenses/semantic/` remain applicable.

The Apache-2.0 license text included with Transformers.js also applies to the
converted Whisper model. Model weights are downloaded on demand, never included
in the APK or duplicated per language. Speech remains on the device.

The small project-specific FP32 classification heads originate from the frozen
C10 Topic and v2 Interaction experiments. Their provenance, class order and hash
are recorded in `multilingual-assets/heads/config.json`. They are not a new
training run or a human-reviewed product-accuracy claim.
