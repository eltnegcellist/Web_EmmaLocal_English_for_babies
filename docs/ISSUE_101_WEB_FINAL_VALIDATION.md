# Issue #101: Web human review and real audible latency

Research preparation ONLY. No microphone measurements or human listening results
are included in this PR. Never upload caregiver WAVs, annotations, local trial logs
or transcripts to public GitHub, CI, Actions artifacts, or comments.
Keep sensitive files under .private-eval/ (git-ignored).

## 26 prerecorded audio clips

Open voice-content-review-26.html using the normal local HTTPS/dev-server workflow,
play all 26 actual audio clips, and independently mark each as:

- match: heard audio matches the expected English
- misread: human listener confirms a spoken mismatch (rerecord this clip)
- unclear: undecidable (NOT considered verified; request another listener)
- pending: not reviewed

Whisper Small/Base disagreement alone does not mean a recorded audio error.
The review screen now distinguishes confirmed verdicts from unclear items and
includes adjudication_complete and audio_issues_resolved in the exported JSON.

Save the exported file locally, then check it offline:

    node scripts/audit-voice-review-26.mjs \
      .private-eval/issue101/voice-export.json \
      .private-eval/issue101/voice-summary.json

This exits unsuccessfully if a case is missing, unclear, or requires rerecording.
The machine cannot mark human audio listening done by itself.

## Microphone-to-audible playback on Mac and Galaxy S25

Run the production Web application on each device, using the same set of spoken
Japanese phrases, and repeat at least 30 trials per device. Maintain a comparable
microphone, background noise and network/cache state; explicitly note cold/warm runs.

Record actual source speech and *audible speaker output* with an external microphone
or another device. From this acoustic recording, label the start/end of the
caregiver utterance and the first audible English sample in a common monotonic
millisecond timeline. Do not use HTMLAudioElement.play(), a Worker message or
WebAudio scheduled playback time as an acoustic timestamp.

Save a LOCAL JSON file with this structure:

    {
      "trials": [
        {
          "device": "Mac Chrome",
          "success": true,
          "onset_source": "acoustic",
          "speech_start_ms": 0,
          "speech_end_ms": 1200,
          "audible_onset_ms": 3600
        },
        {
          "device": "Galaxy S25 Chrome",
          "success": false,
          "failure_reason": "VAD never finalized"
        }
      ]
    }

The numbers shown are illustrative, not real observations. For each trial use
a common recording time origin (milliseconds), including failed trials.
Count failed or timed-out utterances; never silently drop failures from the total.

Compute median/p95 for BOTH onset minus speech-end (user wait after speaking)
and onset minus speech-start (total input-to-audible), plus success rates:

    node scripts/audit-mic-to-audible.mjs \
      .private-eval/issue101/acoustic-trials.json \
      .private-eval/issue101/acoustic-aggregate.json

The script rejects playback API timing substituted for acoustic onset, timestamp
reversals, missing failure reasons, and untagged successes. It flags any device
with fewer than 30 trials. Aggregate JSON excludes individual trials and words,
but review for privacy before sharing. The summary cannot grant release approval.

## Remains open

Mac vs Galaxy S25 six-way caregiver WAV testing, true Ruri meaning adjudication,
26 actual listens, audible median/p95 measurement, and explicit owner sign-off.
Do not alter 22 topic/15 interaction labels or adopt lower generic thresholds
without independent real-speech evidence.

Safe CI tests use synthetic input ONLY:

    node test-voice-review-gate.mjs
    node test-audible-latency-summary.mjs
