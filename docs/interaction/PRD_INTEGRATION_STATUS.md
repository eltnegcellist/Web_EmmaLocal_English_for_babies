# PR-D Web Integration Verification

Date: 2026-10-12.

- Web PR #73 is a staging integration of the candidate Interaction head and 112 fixed three-sentence replies.
- The base includes PR #72's 197 curated replies. 14 classifications + 1 abstention use the same cached 384-dimensional Ruri embedding as the existing Topic classifier; the Interaction head itself is 23,100 bytes.
- Opt-in key: `emma_interaction_experimental`. Default `false`. Five-tap developer settings expose the switch.
- The current user utterance's explicit Topic takes priority; memory of the previous turn alone does not prevent an explicit compliment. Negative/question sentences are conservatively rejected.
- Test: `node test-interaction.mjs` covers 14 labels, 112 English sets, current concrete topics, negation and memory reset. Standard Web CI also runs ONNX parity, asset SHA checks, and the previous Lite/ASR/Kitten/VAD tests.
- Candidate head validated on synthetic text only. Not independently validated on natural parental speech; Kiki English listen test and on-device ASR + microphone session testing are pending.
- PR-F checklist: `docs/interaction/PRF_QA_RELEASE_CHECKLIST.md`. Android companion: PR #38. Do not enable for all users, merge or publish a "verified" release without human QA.
