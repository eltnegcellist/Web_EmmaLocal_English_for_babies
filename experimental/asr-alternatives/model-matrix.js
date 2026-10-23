// Research shortlist: explicit support is verified against upstream catalogs.
// These are NOT production-approved models. Raw model licenses must be checked
// separately from sherpa-onnx's Apache-2.0 runtime.
export const LANGUAGE_ROUTES=Object.freeze({
  ja: {name:'日本語',primary:'Moonshine Small Streaming / Tiny Streaming',status:'prototype',license:'MIT',source:'https://moonshine-voice.readthedocs.io/en/latest/models/available-models/'},
  de: {name:'ドイツ語',primary:'Moonshine Small Streaming / Tiny Streaming',status:'prototype',license:'MIT',source:'https://moonshine-voice.readthedocs.io/en/latest/models/available-models/'},
  en: {name:'英語',primary:'Moonshine Small Streaming / Tiny Streaming',status:'prototype',license:'MIT',source:'https://moonshine-voice.readthedocs.io/en/latest/models/available-models/'},
  fr: {name:'フランス語',primary:'sherpa-onnx streaming Zipformer fr-2023-04-14',status:'research',license:'Model listing Apache-2.0; verify exact files and training rights',source:'https://huggingface.co/shaojieli/sherpa-onnx-streaming-zipformer-fr-2023-04-14'},
  ko: {name:'韓国語',primary:'sherpa-onnx streaming Zipformer ko-2024-06-16',status:'research',license:'Verify model checkpoint and underlying dataset usage separately',source:'https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/zipformer-transducer-models.html'},
  th: {name:'タイ語',primary:'sherpa-onnx offline Zipformer th-2024-06-20',status:'research',license:'Verify GigaSpeech2 model checkpoint/data rights',source:'https://k2-fsa.github.io/sherpa/onnx/pretrained_models/offline-transducer/zipformer-transducer-models.html'}
});
export const MOONSHINE_TRIAL_LANGUAGES=Object.freeze(['ja','de','en']);
export const MOONSHINE_TRIAL_SIZES=Object.freeze(['tiny','small']);
export const WASM_PACKAGE='@moonshine-ai/moonshine-wasm@0.1.5';
export const WASM_CDN_URL='https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-wasm@0.1.5/dist/index.js';
