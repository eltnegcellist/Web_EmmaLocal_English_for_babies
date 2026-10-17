# Issue #101: Ruri meaning adjudication (local only)

**Research only. This does not grant production approval or change Ruri thresholds, weights, Topic/Interaction classes, English bank or prerecorded audio.** It prepares the human review required by Issue #101 and experimental Web PR #109. No caregiver recordings are needed for this text-only step.

## Inputs (frozen research PR #109)

Obtain these two files from PR #109 commit `125172858bab63b24b562a089b1222902b7e1695` and save them on your Mac:

- [evaluation.json](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/blob/125172858bab63b24b562a089b1222902b7e1695/research/ruri-reevaluation-20261017/evaluation.json): 150 Japanese phrases, including 73 provisionally ambiguous cases
- [english-meaning-review.json](https://github.com/eltnegcellist/Web_EmmaLocal_English_for_babies/blob/125172858bab63b24b562a089b1222902b7e1695/research/ruri-reevaluation-20261017/english-meaning-review.json): 51 selected Japanese/English reply pairs, all Codex-provisional and unapproved

These research files are **not main assets**. The UI requires importing them explicitly. The webpage does not automatically apply those provisional labels or judgments.

## Human review

Use branch `research/issue101-human-semantic-review-20261017` or the merged tool if/when this research PR is approved.

On Mac run from Web repository root:

    python3 -m http.server 8000

Open `http://localhost:8000/tools/ruri-human-review.html`. Import the two files with the browser file pickers. The page contains no upload endpoint and makes no outbound request for this task. Do not add private caregiver audio here.

For each of **150** source Japanese utterances, independently assign Topic (including explicit `generic`) and Interaction (including explicit `none`). In contrast to the provisional study, all 150 require a human decision, even if it is to abstain on both axes. If the context is genuinely insufficient, choose `generic` / `none`, and explain why in notes; never pretend the labels are definitive universal truth.

For each of **51** specific Japanese-and-selected-English pairs, independently mark:
- `appropriate`: consistent and natural
- `minor_mismatch`: wrong intent or missing meaning but no factual inversion
- `contradiction`: changed negation, subject, temporal order or other explicit factual assertion
- `undecidable`: context insufficient; **not counted as adjudicated**

Prioritize the important cases (sleep observation, negative crying/smiling/mood, no sun/rain, and milk-then-bath chronology). The same Japanese utterance may have multiple distinct selected English outputs, which must be judged independently. Avoid accepting a label only because it appears as the model's top candidate.

Use **Save JSON** frequently (no autosave); you can import an earlier export to continue. Export includes text and human notes, and must remain **LOCAL**. Never commit human private observations, audio, exports or local aggregates to GitHub unless they have been inspected for privacy.

## Auditing the exported JSON

With the two source JSON files and your locally exported verdicts:

    node scripts/audit-ruri-human-review.mjs \
      path/to/evaluation.json \
      path/to/english-meaning-review.json \
      path/to/mitsukotoba-ruri-human-review.json \
      path/to/ruri-human-aggregate.json

- The command checks exact ID/Japanese/English correspondence, 22 Topic IDs and 15 Interaction IDs, duplicate keys and missing reviews.
- **Exit 1** means missing/undecidable reviews. This is a review blocker, not a script error; partial JSON still produces an aggregate summary.
- Aggregates contain only counts, no Japanese phrases, reply texts, filenames or audio.
- Agreement with the 150 synthetic provisional labels is labeled as *exploratory agreement*, never field accuracy.
- A completed JSON **does not prove that a person reviewed it** and does not independently validate correctness. Require a separate reviewer's confirmation before using the results to decide new thresholds or re-training.

CI runs `node scripts/test-audit-ruri-human-review.mjs` using **synthetic fixtures only**.

## Other blockers from Issue #101

This tool does not supply missing caregiver WAV tests on Mac/S25, real microphone acoustic onset timing, or actual listening to 26 prerecorded candidate clips. Those remain explicit manual requirements; use `docs/ISSUE_101_WEB_FINAL_VALIDATION.md` and the Android `docs/ISSUE_101_LOCAL_EVALUATION.md`.

No production threshold change is justified by the current PR #109 study: 45% introduces a voice-negation inversion, and the retrained head regresses the 67-case protected baseline from 56/67 to 40/67 paired agreement. Keep the current 50% production acceptance rule while gathering independently adjudicated evidence.
