// Ruri-only decision policy. No Japanese keyword, rescue, negation, or regex
// classification is used in the Live Lite reply route.
// The thresholds are independent per head and provisional, not calibrated on
// real caregiver ASR. Fail closed on missing/low-confidence predictions.
import { INTERACTION_REPLIES } from './response.js';

export const INTERACTION_ACCEPT_PROBABILITY = 0.50;
export const TOPIC_ACCEPT_PROBABILITY = 0.50;
export const TOPIC_ACCEPT_MARGIN = 0.05;

export const COMBINED_REPLIES = {
  "milk|invitation": [
    "Shall we have milk? Little sips are fine. I'm here with you.",
    "Here's your milk. Let's do it together. Ready when you are?",
    "Milk time together. Come try with me. What do you think?"
  ],
  "milk|praise": [
    "You drank some milk! Well done, little one. I'm proud of you.",
    "Here's your milk. That was lovely! Well done, sweetheart.",
    "Milk time together. You're doing so well. I'm proud of you."
  ],
  "milk|achievement": [
    "You drank your milk! You did it! Well done, sweetheart.",
    "Here's your milk. You did it! How wonderful is that!",
    "Milk time together. That worked out! Hooray, little one!"
  ],
  "milk|finish": [
    "Milk is all done! You're finished now. Let's rest together.",
    "Here's your milk. All finished now! Let's get cozy.",
    "Milk time together. That's all done. We can rest now."
  ],
  "milk|finish_check": [
    "Finished your milk? Shall we check? What do you think?",
    "Here's your milk. Shall we check? All done now?",
    "Milk time together. Let's check together. Are we finished?"
  ],
  "milk|encouragement": [
    "Try a little sip. There's no hurry. I'm right here.",
    "Here's your milk. Give it a try! I'm right here.",
    "Milk time together. Try when you're ready. We can take time."
  ],
  "diaper|invitation": [
    "Shall we change diapers? I'll be gentle. Let's get comfy.",
    "Here's your diaper. Let's do it together. Ready when you are?",
    "A little diaper change. Come try with me. What do you think?"
  ],
  "diaper|finish": [
    "All done changing! Nice and fresh. Here we are.",
    "Here's your diaper. All finished now! Let's get cozy.",
    "A little diaper change. That's all done. We can rest now."
  ],
  "diaper|finish_check": [
    "Diaper all done? Let's have a look. All clean now?",
    "Here's your diaper. Shall we check? All done now?",
    "A little diaper change. Let's check together. Are we finished?"
  ],
  "diaper|reassurance": [
    "It's diaper time. I'll be gentle. I'm here with you.",
    "Here's your diaper. I'll stay close. You're not alone.",
    "A little diaper change. We have time. I'm here with you."
  ],
  "hug|invitation": [
    "Want a little cuddle? Come here, sweetheart. I'm right here.",
    "Time for a cuddle. Let's do it together. Ready when you are?",
    "Here comes a hug. Come try with me. What do you think?"
  ],
  "hug|reassurance": [
    "Come for a cuddle. I'm right here. I've got you.",
    "Time for a cuddle. I'll stay close. You're not alone.",
    "Here comes a hug. We have time. I'm here with you."
  ],
  "cry|reassurance": [
    "I hear you crying. I'm right here. Come for a cuddle.",
    "I hear you crying. I'll stay close. You're not alone.",
    "I hear those tears. We have time. I'm here with you."
  ],
  "cry|inquiry": [
    "I hear you crying. What's the matter? I'm listening, sweetheart.",
    "I hear you crying. What's bothering you? I'm here to listen.",
    "I hear those tears. Let's take a look. I'm listening, sweetheart."
  ],
  "sleep|invitation": [
    "Shall we rest now? Let's get cozy. I'll stay close.",
    "Time for a rest. Let's do it together. Ready when you are?",
    "Let's rest a little. Come try with me. What do you think?"
  ],
  "sleep|reassurance": [
    "Ready for a rest? I'm right here. We have time.",
    "Time for a rest. I'll stay close. You're not alone.",
    "Let's rest a little. We have time. I'm here with you."
  ],
  "wake|affection": [
    "Hello, sleepyhead! You're awake now. I love seeing you.",
    "You're awake now! I love being together. You're so precious.",
    "Hello, little one! I love you, sweetheart. I'm right here."
  ],
  "book|invitation": [
    "Shall we read together? Here's our book. Let's look inside.",
    "Let's open our book. Let's do it together. Ready when you are?",
    "Look at this book. Come try with me. What do you think?"
  ],
  "book|repeat": [
    "One more page? Let's read again. Turn the page.",
    "Let's open our book. Let's try once more. Ready when you are?",
    "Look at this book. Shall we go again? I'll stay close."
  ],
  "book|start": [
    "Here comes our book. Let's begin reading. What comes next?",
    "Let's open our book. Here we go! Let's begin gently.",
    "Look at this book. Let's get started. I'm right beside you."
  ],
  "smile|affection": [
    "What a lovely smile! You're so sweet. I love you.",
    "What a lovely smile! I love being together. You're so precious.",
    "Look at your smile! I love you, sweetheart. I'm right here."
  ],
  "smile|praise": [
    "What a sweet smile! So lovely to see. Hello, little one.",
    "What a lovely smile! That was lovely! Well done, sweetheart.",
    "Look at your smile! You're doing so well. I'm proud of you."
  ],
  "play|invitation": [
    "Shall we play together? Let's try something. This could be fun.",
    "Here's our little game. Let's do it together. Ready when you are?",
    "Let's play together. Come try with me. What do you think?"
  ],
  "play|repeat": [
    "Let's play again! One more time? Ready when you are.",
    "Here's our little game. Let's try once more. Ready when you are?",
    "Let's play together. Shall we go again? I'll stay close."
  ],
  "play|start": [
    "Ready to play? Let's get started. Here we go.",
    "Here's our little game. Here we go! Let's begin gently.",
    "Let's play together. Let's get started. I'm right beside you."
  ],
  "food|invitation": [
    "Shall we eat? One little bite. I'll stay close.",
    "Here's a little food. Let's do it together. Ready when you are?",
    "A little food together. Come try with me. What do you think?"
  ],
  "food|praise": [
    "You took a bite! Good job, little one. That was lovely.",
    "Look at your food! You're doing so well. Well done, sweetheart.",
    "A little food together. You're doing so well. I'm proud of you."
  ],
  "outside|invitation": [
    "Shall we go outside? Let's look around. What do you see?",
    "We're going outside. Let's do it together. Ready when you are?",
    "Let's look outside. Come try with me. What do you think?"
  ],
  "outside|start": [
    "Outside we go! Let's look around. What can you see?",
    "We're going outside. Here we go! Let's begin gently.",
    "Let's look outside. Let's get started. I'm right beside you."
  ],
  "music|invitation": [
    "Shall we sing? La, la, la! Let's try together.",
    "Here's a little song. Let's do it together. Ready when you are?",
    "Listen to our music. Come try with me. What do you think?"
  ],
  "music|start": [
    "Let's sing together! Here we go. La, la, la!",
    "Here's a little song. Here we go! Let's begin gently.",
    "Listen to our music. Let's get started. I'm right beside you."
  ],
  "music|repeat": [
    "One more song? Let's sing again. La, la, la!",
    "Here's a little song. Let's try once more. Ready when you are?",
    "Listen to our music. Shall we go again? I'll stay close."
  ],
  "drink|invitation": [
    "Want a little sip? Here is your drink. Sip if you like.",
    "Here's your drink. Let's do it together. Ready when you are?",
    "Let's have a drink. Come try with me. What do you think?"
  ],
  "hands|praise": [
    "Look at those hands! You're doing great. Well done, little one.",
    "Look at those hands! That was lovely! Well done, sweetheart.",
    "Your little hands move. You're doing so well. I'm proud of you."
  ],
  "feet|praise": [
    "Look at those feet! You're doing great. Well done, little one.",
    "Look at those toes! That was lovely! Well done, sweetheart.",
    "Look at your feet! You're doing so well. I'm proud of you."
  ],
  "bath|invitation": [
    "Shall we bathe? Let's get ready. I'll be gentle.",
    "Ready for bath time? Let's do it together. Ready when you are?",
    "Want a little bath? Come try with me. What do you think?"
  ],
  "bath|start": [
    "Here comes bath time! Let's begin gently. I'm with you.",
    "Bath time begins! Here we go! Let's begin gently.",
    "Ready to start bathing? Let's get started. I'm right beside you."
  ],
  "bath|finish": [
    "Bath time is finished! All done now. Let's get dry.",
    "Bath time is over! All finished now! Let's get cozy.",
    "All done with baths! That's all done. We can rest now."
  ],
  "bath|finish_check": [
    "Bath time all done? Shall we get out? Let's check together.",
    "Are we finished bathing? Shall we check? All done now?",
    "Shall we finish bathing? Let's check together. Are we finished?"
  ],
  "bath|reassurance": [
    "I'm right here, sweetheart. Let's bathe gently. I'll stay close.",
    "Bath time with me. I'll stay close. You're not alone.",
    "In the bath together. We have time. I'm here with you."
  ],
  "clothes|invitation": [
    "Shall we get dressed? Here comes your shirt. One arm first.",
    "Ready for some clothes? Let's do it together. Ready when you are?",
    "Shall we dress together? Come try with me. What do you think?"
  ],
  "clothes|start": [
    "Time to get dressed! Let's start here. One arm first.",
    "Here come your clothes! Here we go! Let's begin gently.",
    "Dressing time starts now! Let's get started. I'm right beside you."
  ],
  "clothes|finish": [
    "All dressed now! Look at your outfit. Nice and cozy.",
    "You're all dressed! All finished now! Let's get cozy.",
    "Your clothes are on! That's all done. We can rest now."
  ],
  "clothes|finish_check": [
    "Are we all dressed? Let's have a look. One more sleeve?",
    "Are your clothes on? Shall we check? All done now?",
    "Dressing finished now? Let's check together. Are we finished?"
  ],
  "clothes|praise": [
    "Look at you helping! Your shirt is on. Good job, little one.",
    "You're helping with dressing! That was lovely! Well done, sweetheart.",
    "Look at your clothes! You're doing so well. I'm proud of you."
  ],
  "hands|invitation": [
    "Shall we hold hands? Give me your hand. I'm right here.",
    "Want to touch hands? Let's do it together. Ready when you are?",
    "Let's play with fingers! Come try with me. What do you think?"
  ],
  "hands|effort": [
    "Your hands are moving. You're trying so hard. I see you.",
    "Look at your hands! I see you trying. I'm here with you.",
    "See your little fingers? You're working so hard. I'll stay beside you."
  ],
  "hands|achievement": [
    "Your fingers found it! Hooray, little one! You did that.",
    "Look at those hands! You did it! How wonderful is that!",
    "Your fingers did it! That worked out! Hooray, little one!"
  ],
  "feet|invitation": [
    "Shall we move toes? Let's kick together. One, two, three!",
    "Want to wiggle toes? Let's do it together. Ready when you are?",
    "Shall we kick together? Come try with me. What do you think?"
  ],
  "feet|effort": [
    "Your feet are moving. I see you trying. That's hard work.",
    "Look at those feet! I see you trying. I'm here with you.",
    "Your little feet move! You're working so hard. I'll stay beside you."
  ],
  "feet|achievement": [
    "You gave a kick! You did it! Hooray for you.",
    "Look at your feet! You did it! How wonderful is that!",
    "Those little toes moved! That worked out! Hooray, little one!"
  ],
  "voice|affection": [
    "I love your voice! Such a sweet sound. I'm listening, sweetheart.",
    "What a little voice! I love being together. You're so precious.",
    "Listen to those sounds! I love you, sweetheart. I'm right here."
  ],
  "voice|praise": [
    "What a lovely sound! You're doing so well. I'm listening, sweetheart.",
    "That's your little voice! That was lovely! Well done, sweetheart.",
    "You're making sweet sounds! You're doing so well. I'm proud of you."
  ],
  "voice|repeat": [
    "Another little sound? Let's try again. I'll listen closely.",
    "One more little sound? Let's try once more. Ready when you are?",
    "Shall we make sounds? Shall we go again? I'll stay close."
  ],
  "voice|start": [
    "Let's make some sounds! I'll listen first. Now it's your turn.",
    "Let's start making sounds! Here we go! Let's begin gently.",
    "Ready for little noises? Let's get started. I'm right beside you."
  ],
  "tummy|inquiry": [
    "How's your tummy? Are you comfortable? I'm listening, sweetheart.",
    "Is your tummy okay? What do you notice? Let's find out together.",
    "What about your tummy? Let's take a look. I'm listening, sweetheart."
  ],
  "tummy|reassurance": [
    "Let's rest a little. I'll hold you close. You're not alone.",
    "I'm here, sweetheart. I'll stay close. You're not alone.",
    "Let's rest your tummy. We have time. I'm here with you."
  ],
  "tummy|care": [
    "That was a lot. Let's rest your tummy. I'm right here.",
    "Let's rest your tummy. We can rest together. I'll stay with you.",
    "Your tummy can rest. I'm here with you. Let's take time."
  ],
  "rain|inquiry": [
    "Can you hear rain? What's that sound? Let's listen together.",
    "Hear the rain outside? What do you notice? Let's find out together.",
    "Can you hear raindrops? Let's take a look. I'm listening, sweetheart."
  ],
  "rain|affection": [
    "Rain is falling outside. I'm here with you. I love these moments.",
    "Listen to the rain! I love being together. You're so precious.",
    "Rain sounds so gentle. I love you, sweetheart. I'm right here."
  ],
  "rain|invitation": [
    "Shall we watch rain? Look at the window. Listen with me.",
    "Shall we hear rain? Let's do it together. Ready when you are?",
    "Want to watch raindrops? Come try with me. What do you think?"
  ],
  "sun|invitation": [
    "Shall we see sunshine? Let's look outside. So bright today!",
    "Want to see sunshine? Let's do it together. Ready when you are?",
    "Shall we watch sunlight? Come try with me. What do you think?"
  ],
  "sun|affection": [
    "Sunshine is so bright! I'm here with you. I love this moment.",
    "Look at the sunshine! I love being together. You're so precious.",
    "Sunny light is lovely! I love you, sweetheart. I'm right here."
  ],
  "sun|inquiry": [
    "Can you see sunshine? Look at the light. Isn't it bright?",
    "Where is the sunshine? What do you notice? Let's find out together.",
    "Can you see sunlight? Let's take a look. I'm listening, sweetheart."
  ],
  "smile|repeat": [
    "Another little smile? I'll smile at you. Your turn again.",
    "Want to smile together? Here's a smile. I'll smile with you.",
    "Shall we smile together? Look at my face. I'll smile too."
  ],
  "wake|inquiry": [
    "You're awake now! How do you feel? Hello, sweetheart.",
    "Hello, little one! What do you notice? Let's find out together.",
    "Awake already, sweetheart? Let's take a look. I'm listening, sweetheart."
  ],
  "wake|start": [
    "You're awake now! Here we go again. Hello, little one.",
    "Look who's awake! Here we go! Let's begin gently.",
    "It's awake time! Let's get started. I'm right beside you."
  ],
  "sleep|finish_check": [
    "Is nap time finished? Shall we get up? I'm right here.",
    "All done resting? Shall we check? All done now?",
    "Is your rest finished? Let's check together. Are we finished?"
  ],
  "cry|care": [
    "I hear you crying. That was a lot. I'm here with you.",
    "I hear you crying. We can rest now. I'll stay beside you.",
    "Those tears are real. I'll stay with you. Let's rest together."
  ],
  "cry|affection": [
    "I hear you crying. I love you, sweetheart. I'm right here.",
    "I hear your tears. I love being together. You're so precious.",
    "You're crying, little one. I love you, sweetheart. I'm right here."
  ],
  "play|praise": [
    "Look at you playing! You're doing great. Well done, sweetheart.",
    "What lovely playing! That was lovely! Well done, sweetheart.",
    "You're playing right now! You're doing so well. I'm proud of you."
  ],
  "play|achievement": [
    "You got the toy! You did it! What a moment.",
    "Look at that play! You did it! How wonderful is that!",
    "Your game worked out! That worked out! Hooray, little one!"
  ],
  "play|effort": [
    "You're working on this! I see you trying. No need to hurry.",
    "You're trying this game. I see your effort. I'm here with you.",
    "You're trying this game. You're working so hard. I'll stay beside you."
  ],
  "book|inquiry": [
    "What's in the book? Let's turn a page. What do you see?",
    "See the book? What do you notice? Let's find out together.",
    "Look at this picture! Let's take a look. I'm listening, sweetheart."
  ],
  "book|praise": [
    "You looked at pictures! That's lovely, sweetheart. Well done.",
    "Look at your book! That was lovely! Well done, sweetheart.",
    "You're looking at pictures! You're doing so well. I'm proud of you."
  ],
  "music|praise": [
    "You made a sound! Well done, little one. Let's sing together.",
    "What a lovely tune! That was lovely! Well done, sweetheart.",
    "I heard your music! You're doing so well. I'm proud of you."
  ],
  "outside|reassurance": [
    "We're going outside together. I'll stay close. I've got you.",
    "Out here with me. I'll stay close. You're not alone.",
    "We're outside together. We have time. I'm here with you."
  ],
  "food|finish_check": [
    "Are we done eating? Shall we wipe up? Let's check together.",
    "Finished eating yet? Shall we check? All done now?",
    "Are we done eating? Let's check together. Are we finished?"
  ],
  "food|reassurance": [
    "It's food time, sweetheart. I'll stay beside you. We can go slowly.",
    "Food time together. I'll stay close. You're not alone.",
    "Here's a little bite. We have time. I'm here with you."
  ],
  "milk|care": [
    "That was milk time. You did a lot. Let's rest together.",
    "Milk time was busy. That took some effort. Let's rest together.",
    "Milk time is over. I'll stay with you. Let's rest together."
  ],
  "milk|reassurance": [
    "Here comes your milk. I'll stay close. We can go slowly.",
    "It's milk time, sweetheart. I'll stay close. You're not alone.",
    "Here's a little milk. We have time. I'm here with you."
  ],
  "drink|finish_check": [
    "All done drinking? Want another sip? Let's see together.",
    "Finished your drink? Shall we check? All done now?",
    "Had enough to drink? Let's check together. Are we finished?"
  ],
  "drink|praise": [
    "You took a sip! Well done, little one. That's lovely.",
    "Look at that sip! That was lovely! Well done, sweetheart.",
    "You had your drink! You're doing so well. I'm proud of you."
  ],
  "diaper|care": [
    "That change is over. Let's get cozy. I'm with you.",
    "Diaper time is over. Let's get cozy. I'm here with you.",
    "A fresh diaper now. We can get cozy. I'll stay with you."
  ],
  "hug|affection": [
    "I love this cuddle. You're my sweetheart. Stay close, little one.",
    "A cuddle for you! I love being together. You're so precious.",
    "Hugs together, sweetheart! I love you, sweetheart. I'm right here."
  ],
  "hug|care": [
    "You've done a lot. Come for a cuddle. I'll hold you close.",
    "Time for a cuddle. That took some effort. Let's rest together.",
    "A gentle little cuddle. You did a lot. I'll stay with you."
  ],
  "hug|praise": [
    "You reached for hugs! How lovely, little one. Well done.",
    "What a sweet cuddle! That was lovely! Well done, sweetheart.",
    "Look at your cuddle! You're doing so well. I'm proud of you."
  ],
  "bath|care": [
    "That was a bath! Now we can rest. I'm right here.",
    "All done with baths. That was a lot. Let's rest together.",
    "Your bath is finished. Let's get cozy now. I'll stay with you."
  ],
  "milk|pause": [
    "Let's pause feeding. We can wait now. I'll stay with you.",
    "Milk time can wait. There's no hurry. I'm right here.",
    "Another sip can wait. Let's take a break. I'll be close."
  ],
  "diaper|pause": [
    "Let's pause changing. We have time. I'm right here.",
    "Diaper time can wait. No need to rush. I'll stay beside you.",
    "A moment during changing. We'll take it slowly. I'm here, sweetheart."
  ],
  "bath|pause": [
    "Let's pause bath time. No need to rush. I'll stay close.",
    "Bath time can wait. We'll go gently. I'm here with you.",
    "Let's slow down now. We have time. I'll stay with you."
  ],
  "book|pause": [
    "Let's pause reading. We can read later. I'm right here.",
    "A pause in reading. Let's rest a moment. We'll return soon.",
    "Let's stop this page. No need to rush. I'll stay with you."
  ],
  "play|pause": [
    "Let's pause our game. We can rest now. I'm right here.",
    "Playtime can wait. Let's take a break. I'll stay beside you.",
    "Shall we stop playing? We can rest together. I'm here, sweetheart."
  ],
  "outside|pause": [
    "Let's stop a moment. Our walk can wait. I'll stay near.",
    "Pause our little walk. Let's look around. We have time.",
    "A break while outside. We can wait here. I'm with you."
  ],
  "food|pause": [
    "Let's pause eating now. We can wait. I'm beside you.",
    "Food time can wait. No need to hurry. I'm right here.",
    "Another bite can wait. Let's take a break. I'll stay close."
  ],
  "drink|pause": [
    "Let's pause drinking. More sips can wait. I'm right here.",
    "No more sips yet. We can wait. I'll stay with you.",
    "Your drink can wait. Let's rest a little. I'm right here."
  ],
  "music|pause": [
    "Let's pause our song. We can listen later. I'll stay close.",
    "A little music break. We have time. I'm here with you.",
    "Let's stop the music. We'll sing again later. I'm right here."
  ],
  "cry|pause": [
    "We can pause now. I hear you crying. I'm here with you.",
    "Let's rest a moment. I hear your cries. I'll stay close.",
    "No need to rush. I hear you crying. We're here together."
  ],
  "hands|encouragement": [
    "Try reaching your hand. I'm right here. You can go slowly.",
    "Those hands can try. Just one little reach. I'll stay close.",
    "Give your hand time. You can try again. I'm cheering you on."
  ],
  "feet|encouragement": [
    "Try kicking those feet! I'm right here. You can try again.",
    "One little kick? Give it a try! I'll stay close.",
    "Those little toes! Try moving them. I'm cheering you on."
  ],
  "play|encouragement": [
    "Try the game again. You can do this. I'm here with you.",
    "Let's try that toy. Go at your pace. I'll stay close.",
    "Playing takes practice. Give it a try. I'm right here."
  ],
  "voice|encouragement": [
    "Want to make sounds? Give it a try. I'll listen closely.",
    "Make a little sound. I'm listening, sweetheart. You can try again.",
    "Another little sound? You can try. I'm right here."
  ],
  "milk|effort": [
    "You're trying to drink. I see your effort. We'll go gently.",
    "Little sips take practice. I see you trying. I'm right here.",
    "You're practicing little sips. I see your effort. We'll go gently."
  ],
  "food|effort": [
    "You're trying that food. I see you trying. I'll stay close.",
    "A new little bite. You're working on it. I'm right here.",
    "You're trying new food. I can see that. We'll go slowly."
  ],
  "rain|start": [
    "Rain is starting now. Can you hear it? Let's listen together.",
    "Here comes the rain! Drip, drop, drip. Let's listen together.",
    "The first raindrops fall. Can you hear them? Come listen with me."
  ],
  "sun|start": [
    "Here comes the sunshine! Look at that light. Let's look together.",
    "The sunshine is coming. Shall we look outside? Look at that glow.",
    "Sunlight is showing now. Look at the sky. Here it comes."
  ],
  "music|finish": [
    "Our song is finished! All done singing. Let's rest together.",
    "Music time is over. That was lovely. I'm right here.",
    "That's the last note! We finished our song. Hooray for us."
  ],
  "book|finish": [
    "Our book is finished! That's the last page. Well done, sweetheart.",
    "Story time is over. We read together. What a lovely book.",
    "All done reading now! Let's close the book. We can rest."
  ],
  "outside|finish": [
    "Our walk is over! Here we are. Let's get cozy.",
    "Outside time is over. We're back together. I'm right here.",
    "Our outing is finished. Let's take a rest. Here we are."
  ],
  "drink|finish": [
    "All done drinking now! You're finished here. Let's rest together.",
    "Drinking time is over. We can pause now. I'm right here.",
    "No more sips now. Drinking time is done. Let's relax together."
  ],
  "play|finish": [
    "Our game is finished! All done playing now. Well done, sweetheart.",
    "Playtime is over now. Let's take a break. That was lovely.",
    "That's the last game. We're all finished. Time for a rest."
  ]
};

export function selectRuriAxes(topicPrediction, interactionPrediction, allowInteraction = true) {
  const topicId = topicPrediction?.id ?? topicPrediction?.topic ?? null;
  const topic = topicId && topicId !== 'generic'
    && (topicPrediction?.probability ?? 0) >= TOPIC_ACCEPT_PROBABILITY
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
