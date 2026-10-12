// Ruri-only decision policy. No Japanese keyword, rescue, negation, or regex
// classification is used in the Live Lite reply route.
// The thresholds are independent per head and provisional, not calibrated on
// real caregiver ASR. Fail closed on missing/low-confidence predictions.
import { INTERACTION_REPLIES } from './response.js';

export const INTERACTION_ACCEPT_PROBABILITY = 0.40;
export const TOPIC_ACCEPT_MARGIN = 0.05;

export const COMBINED_REPLIES = {
  "milk|invitation": [
    "Shall we have milk? Little sips are fine. I'm here with you."
  ],
  "milk|praise": [
    "You drank some milk! Well done, little one. I'm proud of you."
  ],
  "milk|achievement": [
    "You drank your milk! You did it! Well done, sweetheart."
  ],
  "milk|finish": [
    "Milk is all done! You're finished now. Let's rest together."
  ],
  "milk|finish_check": [
    "Finished your milk? Shall we check? What do you think?"
  ],
  "milk|encouragement": [
    "Try a little sip. There's no hurry. I'm right here."
  ],
  "diaper|invitation": [
    "Shall we change diapers? I'll be gentle. Let's get comfy."
  ],
  "diaper|finish": [
    "All done changing! Nice and fresh. Here we are."
  ],
  "diaper|finish_check": [
    "Diaper all done? Let's have a look. All clean now?"
  ],
  "diaper|reassurance": [
    "It's diaper time. I'll be gentle. I'm here with you."
  ],
  "hug|invitation": [
    "Want a little cuddle? Come here, sweetheart. I'm right here."
  ],
  "hug|reassurance": [
    "Come for a cuddle. I'm right here. I've got you."
  ],
  "cry|reassurance": [
    "I hear you crying. I'm right here. Come for a cuddle."
  ],
  "cry|inquiry": [
    "I hear you crying. What's the matter? I'm listening, sweetheart."
  ],
  "sleep|invitation": [
    "Shall we rest now? Let's get cozy. I'll stay close."
  ],
  "sleep|reassurance": [
    "Ready for a rest? I'm right here. We have time."
  ],
  "wake|affection": [
    "Hello, sleepyhead! You're awake now. I love seeing you."
  ],
  "book|invitation": [
    "Shall we read together? Here's our book. Let's look inside."
  ],
  "book|repeat": [
    "One more page? Let's read again. Turn the page."
  ],
  "book|start": [
    "Here comes our book. Let's begin reading. What comes next?"
  ],
  "smile|affection": [
    "What a lovely smile! You're so sweet. I love you."
  ],
  "smile|praise": [
    "What a sweet smile! So lovely to see. Hello, little one."
  ],
  "play|invitation": [
    "Shall we play together? Let's try something. This could be fun."
  ],
  "play|repeat": [
    "Let's play again! One more time? Ready when you are."
  ],
  "play|start": [
    "Ready to play? Let's get started. Here we go."
  ],
  "food|invitation": [
    "Shall we eat? One little bite. I'll stay close."
  ],
  "food|praise": [
    "You took a bite! Good job, little one. That was lovely."
  ],
  "outside|invitation": [
    "Shall we go outside? Let's look around. What do you see?"
  ],
  "outside|start": [
    "Outside we go! Let's look around. What can you see?"
  ],
  "music|invitation": [
    "Shall we sing? La, la, la! Let's try together."
  ],
  "music|start": [
    "Let's sing together! Here we go. La, la, la!"
  ],
  "music|repeat": [
    "One more song? Let's sing again. La, la, la!"
  ],
  "drink|invitation": [
    "Want a little sip? Here is your drink. Sip if you like."
  ],
  "hands|praise": [
    "Look at those hands! You're doing great. Well done, little one."
  ],
  "feet|praise": [
    "Look at those feet! You're doing great. Well done, little one."
  ]
};

export function selectRuriAxes(topicPrediction, interactionPrediction, allowInteraction = true) {
  const topicId = topicPrediction?.id ?? topicPrediction?.topic ?? null;
  const topic = topicId && topicId !== 'generic'
    && (topicPrediction?.margin ?? 0) >= TOPIC_ACCEPT_MARGIN
    ? topicId : null;
  const id = interactionPrediction?.id ?? interactionPrediction?.interaction ?? null;
  const interaction = allowInteraction
    && id && id !== 'none' && Object.hasOwn(INTERACTION_REPLIES,id)
    && (interactionPrediction?.probability ?? interactionPrediction?.interactionProbability ?? 0) >= INTERACTION_ACCEPT_PROBABILITY
    ? id : null;
  return {topic,interaction};
}

export function combinedCandidates(topic, interaction) {
  return COMBINED_REPLIES[`${topic}|${interaction}`] || null;
}
