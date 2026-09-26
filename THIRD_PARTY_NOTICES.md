# Third-Party Notices

## Moonshine Voice / Japanese Small Streaming STT

Emma Web uses the Moonshine Voice WebAssembly runtime and the Japanese Tiny
Streaming speech-to-text model from Moonshine AI.

- Runtime: `@moonshine-ai/moonshine-wasm` 0.1.5 (official GitHub release archive, hosted under `src/vendor/moonshine/`)
- Model: Japanese Tiny Streaming
- License: MIT
- Upstream: https://github.com/moonshine-ai/moonshine

Copyright (c) 2025 Useful Sensors, Inc. (dba Moonshine AI)

The runtime's upstream MIT license is included in `src/vendor/moonshine/LICENSE`.
No legacy non-commercial model is used.


MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## Kitten TTS Nano 0.8

Emma Web uses the Kitten TTS Nano 0.8 speech-synthesis model from
KittenML / Stellon Labs and the browser JavaScript port `kitten-tts-js`.

- Model: `KittenML/kitten-tts-nano-0.8-fp32`
- Browser runtime integration: browser-only adapted subset of `kitten-tts-js` 0.1.2
- Upstream runtime commit: `222cb5586764fa51f4e73d469d6b1e5d92a56f21`
- The adapted subset removes Node.js-only `fs`, `path`, and `os` code paths
- Model/runtime integration license: Apache License 2.0
- Model upstream: https://github.com/KittenML/KittenTTS
- JavaScript port attribution: Copyright 2026 Algiras

The KittenTTS model architecture, pretrained model, voice embeddings, symbol
table, and phoneme tokenization logic are credited to KittenML / Stellon Labs.
The JavaScript port is an independent community port and is not affiliated with
or endorsed by KittenML / Stellon Labs.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.


## CMU Pronouncing Dictionary (CMUDict)

Emma Web uses CMUDict as the primary English pronunciation dictionary for
Kitten TTS. The dictionary is fetched from a pinned upstream commit during
initial setup and cached locally by the browser. Speech synthesis itself
remains on-device.

- Upstream: https://github.com/cmusphinx/cmudict
- Pinned commit: `74790861f652b15e4ac49015a90074ad62a27690`
- License: BSD-style CMUdict license

Emma's phonemizer converts CMUDict ARPABET entries to the IPA symbol inventory
expected by Kitten TTS. A small local exception dictionary and context rules
handle infant-directed expressions, homographs, and the configured Japanese
baby name. No eSpeak NG runtime is used by this experimental branch.


### CMUDict license notice

Copyright (C) 1993-2015 Carnegie Mellon University. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer. The contents of
   this file are deemed to be source code.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY CARNEGIE MELLON UNIVERSITY "AS IS" AND ANY
EXPRESSED OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL CARNEGIE MELLON UNIVERSITY NOR ITS EMPLOYEES
BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
