# Third-Party Notices

Updated: 2026-10-01

This file summarizes third-party software, models, data, and runtime components
used by Mitsukotoba Web. It is intended to make redistribution and attribution
requirements visible. The accompanying `LICENSE_AUDIT.md` records the
GPL/eSpeak-focused technical audit.

## GPL / eSpeak NG status

Mitsukotoba Web does not intentionally ship or dynamically import an eSpeak NG
runtime in its production path or development model lab.

The former development-only comparisons using `kokoro-js@1.2.1` and
`@mintplex-labs/piper-tts-web` were removed because those browser paths use
eSpeak NG-based phonemization.

The production Kitten path uses Mitsukotoba's local
`src/vendor/kitten/phonemizer.js`, which is based on CMUDict plus local
conversion/context rules and does not call eSpeak NG.

"GPL-free" here does not mean "permissive-only": the Moonshine WASM provenance
also includes MPL-2.0 and CC BY 4.0 material described below.

## Moonshine Voice 0.1.5 / Japanese Streaming STT

Mitsukotoba Web vendors the official Moonshine Voice 0.1.5 WebAssembly runtime
under `src/vendor/moonshine/` and uses Japanese Streaming speech-to-text
models.

- Upstream: https://github.com/moonshine-ai/moonshine
- Runtime/source default license: MIT
- Streaming STT models: MIT
- Vendored upstream license: `src/vendor/moonshine/LICENSE`

The legacy non-streaming Japanese Base/Tiny models covered by the Moonshine
Community License are not the models used by Mitsukotoba Web.

### Material statically linked by the upstream Moonshine WASM build

Moonshine 0.1.5's upstream WASM build statically links its native core and a
minimal ONNX Runtime build. Relevant audited third-party material includes:

- Eigen 3.4.0 subset — MPL-2.0. Moonshine explicitly builds with
  `EIGEN_MPL2_ONLY=1` and its vendored README states that GPL/LGPL sparse
  modules and wrappers were removed.
- cpp-annote — MIT.
- kaldi-native-fbank — Apache-2.0.
- kissfft — BSD-3-Clause.
- nlohmann/json — MIT.
- ONNX Runtime 1.23.2 — MIT, with its own third-party notices.
- utfcpp — Boost Software License 1.0.
- utf8proc — MIT, with Unicode-derived data subject to the Unicode data notice.
- Silero VAD model/runtime material — MIT.
- Built-in ZipVoice reference clips derived from the VCTK Corpus — CC BY 4.0.

### VCTK attribution

VCTK Corpus, Centre for Speech Technology Research (CSTR), University of
Edinburgh. The VCTK 0.92 corpus is distributed under Creative Commons
Attribution 4.0 International (CC BY 4.0).

- Dataset page: https://datashare.ed.ac.uk/handle/10283/3443
- License: https://creativecommons.org/licenses/by/4.0/

## Kitten TTS Nano 0.8

Mitsukotoba Web uses Kitten TTS Nano 0.8 for production speech synthesis.

- Model: `KittenML/kitten-tts-nano-0.8-fp32`
- Browser integration: adapted browser-only subset of `kitten-tts-js` 0.1.2
- Upstream runtime commit used by the project:
  `222cb5586764fa51f4e73d469d6b1e5d92a56f21`
- License: Apache-2.0
- Upstream: https://github.com/KittenML/KittenTTS

The adapted browser path removes Node-only `fs`, `path`, and `os` code.
Mitsukotoba does not use the eSpeak-backed browser packages removed from the
model lab for this production Kitten path.

## CMU Pronouncing Dictionary (CMUDict)

Mitsukotoba Web uses CMUDict as the primary English pronunciation dictionary
for Kitten TTS.

- Upstream: https://github.com/cmusphinx/cmudict
- Pinned commit: `74790861f652b15e4ac49015a90074ad62a27690`
- License: BSD-style CMUDict license

The dictionary is fetched from the pinned upstream commit and cached by the
browser. Mitsukotoba converts ARPABET entries to the IPA/symbol inventory
expected by Kitten TTS and applies local context/exception rules.

CMUDict copyright notice:

Copyright (C) 1993-2015 Carnegie Mellon University. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that source redistributions retain the
copyright notice, conditions and disclaimer, and binary redistributions
reproduce them in the documentation and/or other materials.

THIS SOFTWARE IS PROVIDED BY CARNEGIE MELLON UNIVERSITY "AS IS" AND ANY
EXPRESSED OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED.

## ONNX Runtime Web used by Kitten and the model lab

The browser Kitten integration loads ONNX Runtime Web 1.20.0. The remaining
Supertonic development comparison currently loads ONNX Runtime Web 1.17.0.

- Upstream: https://github.com/microsoft/onnxruntime
- License: MIT
- Third-party notices: see the matching ONNX Runtime distribution/upstream
  `ThirdPartyNotices.txt`.

## Supertonic development comparison

`model-lab.html` retains a development-only Supertonic 3 comparison.

- Helper source pinned from:
  https://github.com/cskwork/supertonic-tts
- Helper/application code: MIT according to its upstream documentation.
- Model: `Supertone/supertonic-3`
- Model license: Supertone OpenRAIL-M terms apply.
- The pinned helper uses Unicode text preprocessing and does not reference
  eSpeak NG.

This development comparison is not part of the normal Mitsukotoba conversation
path and only loads when the model-lab page is opened and the user runs it.

## Project code

Unless a file or directory says otherwise, Mitsukotoba project code is governed
by the license selected for this repository. Third-party components retain
their own licenses and notices.
