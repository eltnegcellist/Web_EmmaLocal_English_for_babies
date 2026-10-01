# GPL / eSpeak Dependency Audit

Audit date: 2026-10-02  
Audited baseline before remediation:
`0fc59fd56910ae11a66642af8953bbf805ba3ebb`

## Scope

This technical audit covered:

- the production Web conversation path;
- development/diagnostic pages deployed from the same GitHub Pages repository;
- dynamic CDN imports;
- Kitten phonemization;
- the provenance/build configuration of the vendored Moonshine Voice 0.1.5 WASM;
- known third-party code, model and data licenses relevant to GPL/eSpeak risk.

This is a technical dependency audit, not legal advice.

## Findings and remediation

### Production Kitten TTS

The production path imports Mitsukotoba's
`src/vendor/kitten/phonemizer.js`. It uses CMUDict, ARPABET-to-target-symbol
conversion, context rules and local fallbacks. It does not call an eSpeak NG
runtime.

### Development model lab: Piper removed

The previous model lab dynamically imported
`@mintplex-labs/piper-tts-web@1.0.5`.

Its browser phonemizer includes eSpeak NG data/runtime material. The Piper
comparison was therefore removed.

### Development model lab: Kokoro.js removed

The previous model lab dynamically imported `kokoro-js@1.2.1`.

That release depends on the `phonemizer` package, whose documented
implementation uses eSpeak NG. The Kokoro.js comparison was therefore removed.

### Supertonic retained

The remaining development comparison uses a pinned Supertonic helper plus ONNX
Runtime. The audited helper contains no eSpeak or GPL runtime reference and uses
Unicode text preprocessing.

### Moonshine Voice 0.1.5

Moonshine's upstream license states that its own source and all streaming STT
models are MIT except for separately identified material.

The v0.1.5 WASM build links the native core and a minimal ONNX Runtime static
library. Moonshine's vendored Eigen README explicitly states that it keeps the
MPL-2.0-only subset, removes GPL/LGPL sparse modules/wrappers, and compiles with
`EIGEN_MPL2_ONLY=1`.

No GPL/LGPL Moonshine third-party component was identified in the audited
upstream v0.1.5 source configuration. The resulting dependency set is not
permissive-only: it contains MPL-2.0 material (Eigen) and attribution-licensed
data such as VCTK CC BY 4.0 reference clips.

## Current stable-main conclusion

After the model-lab remediation and the 2026-10-02 README/license sync:

- no known eSpeak NG runtime remains in Mitsukotoba's production or model-lab
  execution paths;
- no known GPL/LGPL runtime dependency was identified in the audited Web stack;
- the stack is **not permissive-only** because MPL-2.0 and CC BY 4.0 material
  remain in Moonshine WASM provenance;
- a future STT-only Moonshine WASM build could remove unused TTS/diarization
  material and simplify the license surface further.

## Regression guard

CI rejects reintroduction of known eSpeak-backed browser runtime identifiers,
including:

- `@mintplex-labs/piper-tts-web`
- `createPiperPhonemize`
- `espeak-ng-data`
- `kokoro-js`
- external `phonemizer@` package references

Mitsukotoba's local `src/vendor/kitten/phonemizer.js` is intentionally
allowed; it is the CMUDict-based implementation described above.
