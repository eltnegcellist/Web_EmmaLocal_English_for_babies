// Ruri-only decision policy. No Japanese keyword, rescue, negation, or regex
// classification is used in the Live Lite reply route.
// The thresholds are independent per head and provisional, not calibrated on
// real caregiver ASR. Fail closed on missing/low-confidence predictions.
import { INTERACTION_REPLIES } from './response.js';
import { SUPPLEMENTAL_COMBINED_REPLIES } from './supplemental-replies.js';
import { FREQUENT_COMBINED_VARIANTS } from './frequent-replies.js';

export const INTERACTION_ACCEPT_PROBABILITY = 0.50;
export const TOPIC_ACCEPT_PROBABILITY = 0.50;
export const TOPIC_ACCEPT_MARGIN = 0.05;

const BASE_COMBINED_REPLIES = {
  "milk|invitation": [
    "Milk time, baby! Sip, sip, sip! I'm right here!",
    "Milk is ready! Sip, sip, sip! Nice and easy!",
    "A little milk now. Would you like some? Take your time."
  ],
  "milk|praise": [
    "You drank some milk! Well done, little one. I'm proud of you.",
    "Look at those sips! That was lovely! Well done, sweetheart.",
    "Sip, sip, sip! Look at you! Good job, baby!"
  ],
  "milk|achievement": [
    "You drank your milk! You did it! Well done, sweetheart.",
    "Milk all gone! You did it! Hooray, hooray!",
    "You drank some milk! Good job, baby! I'm right here."
  ],
  "milk|finish": [
    "Milk is all done! You're finished now. Let's rest together.",
    "Milk time is over! All finished now! Let's get cozy.",
    "We're all done drinking! That's all done. We can rest now."
  ],
  "milk|finish_check": [
    "Milk all done? One more sip? Let's have a look!",
    "Is milk time over? Shall we check? All done now?",
    "All done drinking? Look at your bottle! All done, baby?"
  ],
  "milk|encouragement": [
    "Try a little sip. There's no hurry. I'm right here.",
    "Here's your milk. Give it a try! I'm right here.",
    "Milk time together. Try when you're ready. We can take time."
  ],
  "diaper|invitation": [
    "Shall we change diapers? I'll be gentle. Let's get comfy.",
    "Fresh diaper coming up! Shall we get ready? I'll be gentle.",
    "Let's change your diaper. I'll go very slowly. Are you ready?"
  ],
  "diaper|finish": [
    "All done changing! Nice and fresh. Here we are.",
    "That diaper is changed! All finished now! Let's get cozy.",
    "Diaper change is finished! That's all done. We can rest now."
  ],
  "diaper|finish_check": [
    "Diaper all done? Let's have a look. All clean now?",
    "Diaper change finished yet? Shall we check? All done now?",
    "Clean diaper now? Let's have a look! All done, baby?"
  ],
  "diaper|reassurance": [
    "It's diaper time. I'll be gentle. I'm here with you.",
    "Here's your fresh diaper. I'll change you gently. You'll feel cozy.",
    "A little diaper change. We have time. I'm here with you."
  ],
  "hug|invitation": [
    "Want a little cuddle? Come here, sweetheart. I'm right here.",
    "Shall we have cuddles? Come into my arms. I'll hold you.",
    "A gentle little hug. Would you like one? Come close, sweetheart."
  ],
  "hug|reassurance": [
    "Come for a cuddle. I'm right here. I've got you.",
    "Time for a cuddle. I'll stay close. You're not alone.",
    "Here comes a hug. We have time. I'm here with you."
  ],
  "cry|reassurance": [
    "I hear you crying. I'm right here. Come for a cuddle.",
    "I hear your crying. Let me hold you. My arms are warm.",
    "I hear your cries. Take your time, baby. I'll hold you."
  ],
  "cry|inquiry": [
    "I hear you crying. What's the matter? I'm listening, sweetheart.",
    "I hear you crying. What's bothering you? I'm here to listen.",
    "I hear those tears. Let's take a look. I'm listening, sweetheart."
  ],
  "sleep|invitation": [
    "Ready for your nap? Let's get cozy. I'll sing softly.",
    "Let's rest for now. Here's a cozy spot. I'll sit beside you.",
    "Feel like resting now? Let's get comfortable. I'll stay with you."
  ],
  "sleep|reassurance": [
    "Ready for a rest? I'm right here. We have time.",
    "Time for a rest. Your bed feels soft. I'll sit nearby.",
    "Let's rest a little. We have time. I'm here with you."
  ],
  "wake|affection": [
    "Hello, my treasure! You're awake now. I love seeing you.",
    "You're awake, sweetheart! What a lovely surprise. I love you.",
    "Hello, little one! I love you, sweetheart. I'm right here."
  ],
  "book|invitation": [
    "Shall we read together? Here's our book. Let's look inside.",
    "Here is our book. Shall we read together? Turn a page.",
    "A story for you! Look at these pictures. Shall we start?"
  ],
  "book|repeat": [
    "One more page? Let's read again. Turn the page.",
    "Let's open our book. See that little bird? Turn the page!",
    "Look at this book. Shall we go again? I'll stay close."
  ],
  "book|start": [
    "Here comes our book. Let's begin reading. What comes next?",
    "Let's open our book. See the first page? Shall we read?",
    "Look at this book. Let's get started. I'm right beside you."
  ],
  "smile|affection": [
    "What a lovely smile! You're so sweet. I love you.",
    "What a lovely smile! Your face lights up. I love you.",
    "Look at your smile! It lights my day. Such a happy face!"
  ],
  "smile|praise": [
    "What a sweet smile! So lovely to see. Hello, little one.",
    "What a happy smile! Your cheeks are glowing. I love it!",
    "Smile, smile, smile! Look at those cheeks! Big happy face!"
  ],
  "play|invitation": [
    "Shall we play together? Let's try something. This could be fun.",
    "Let's start a game. Can you see this? It looks fun.",
    "Shall we play together? Here's our little toy. Let's have fun."
  ],
  "play|repeat": [
    "Let's play again! One more turn? Here comes your toy!",
    "Here's our little game. Want another turn? Let's play together.",
    "Let's play together. Shall we go again? I'll stay close."
  ],
  "play|start": [
    "Ready to play? Let's get started. Here we go.",
    "Look at this toy! Ready for a game? Let's begin together.",
    "Let's play together. Let's get started. I'm right beside you."
  ],
  "food|invitation": [
    "Shall we eat? One little bite. I'll stay close.",
    "Ready for some food? Here's a little bite. We can go slowly.",
    "Would you like food? One little bite now. I'll stay near."
  ],
  "food|praise": [
    "You took a bite! Good job, little one. That was lovely.",
    "A little bite today! Look at your spoon. Nicely done, baby!",
    "Yum, yum, yum! One little bite! Yay, baby!"
  ],
  "outside|invitation": [
    "Shall we go outside? Let's look around. What do you see?",
    "Shall we go outside? Let's look all around. I'll stay close.",
    "Want some fresh air? We can go together. Let's look around."
  ],
  "outside|start": [
    "Outside we go! Let's look around. What can you see?",
    "We're going outside. Here we go! Let's begin gently.",
    "Let's look outside. Let's get started. I'm right beside you."
  ],
  "music|invitation": [
    "Shall we sing? La, la, la! Let's try together.",
    "Shall we sing now? Listen to this tune. La, la, la!",
    "Can you hear that? Shall we sing together? La, la, la!"
  ],
  "music|start": [
    "Let's sing together! Here we go. La, la, la!",
    "Here's a little song. Here we go! Let's begin gently.",
    "Music time, baby! La, la, la! Here we go!"
  ],
  "music|repeat": [
    "One more song? Let's sing again. La, la, la!",
    "Here's a little song. Can you hear it? Let's hum together.",
    "Listen to our music. Shall we go again? I'll stay close."
  ],
  "drink|invitation": [
    "Want a little sip? Here is your drink. Sip if you like.",
    "Shall we try drinking? Just a little sip. I'll stay nearby.",
    "Here's a little drink. Take it slowly now. I'm here, sweetheart."
  ],
  "hands|praise": [
    "Look at those hands! You're doing great. Well done, little one.",
    "Your fingers are moving! Open and close them. Look at you!",
    "Wiggle, wiggle, wiggle! Look at those fingers! Yay, baby!"
  ],
  "feet|praise": [
    "Look at those feet! You're doing great. Well done, little one.",
    "Your toes are wiggling! Kick those little feet. There you go!",
    "Kick, kick, kick! Look at those toes! Yay, baby!"
  ],
  "bath|invitation": [
    "Shall we bathe? Let's get ready. I'll be gentle.",
    "Bath time, baby! Splish, splash, splash! I'm right here!",
    "Here comes warm water. Let's take it gently. Shall we start?"
  ],
  "bath|start": [
    "Here comes bath time! Let's begin gently. I'm with you.",
    "Bath time begins! Here we go! Let's begin gently.",
    "Bath time, baby! Splash, splash, splash! Here we go!"
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
    "Here's the warm water. I'll wash your toes. Splish, splash, splash!",
    "Bath time together. My hands are gentle. Your toes are warm.",
    "In the bath together. We have time. I'm here with you."
  ],
  "clothes|invitation": [
    "Shall we get dressed? Here comes your shirt. One arm first.",
    "Here's your little shirt! One arm goes in. Here comes the other!",
    "Clothes on, baby! One little arm! Here we go!"
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
    "All dressed now? Look at your shirt! All done, baby?"
  ],
  "clothes|praise": [
    "Look at you helping! Your shirt is on. Good job, little one.",
    "One arm through! Your shirt is on. Nice and cozy now!",
    "One arm in! Other arm in! All dressed, baby!"
  ],
  "hands|invitation": [
    "Shall we hold hands? Give me your hand. I'm right here.",
    "Give me your hand. Let's feel those fingers. Squeeze, squeeze!",
    "Let's play with fingers! Come try with me. What do you think?"
  ],
  "hands|effort": [
    "Your hands are moving. You're trying so hard. I see you.",
    "Look at your hands! I see you trying. I'm here with you.",
    "Little fingers! Wiggle, wiggle, wiggle! I'm right here!"
  ],
  "hands|achievement": [
    "Your fingers found it! Hooray, little one! You did that.",
    "Look at those hands! You did it! How wonderful is that!",
    "Your little fingers moved! You did it! Wiggle them again!"
  ],
  "feet|invitation": [
    "Shall we move toes? Let's kick together. One, two, three!",
    "Look at your toes! Wiggle, wiggle, little feet! Let's kick together.",
    "Kick, kick, kick! Little baby feet! Here we go!"
  ],
  "feet|effort": [
    "Your feet are moving. I see you trying. That's hard work.",
    "Look at those feet! I see you trying. I'm here with you.",
    "Little feet! Kick, kick, kick! I'm right here!"
  ],
  "feet|achievement": [
    "You gave a kick! You did it! Hooray for you.",
    "Look at your feet! You did it! How wonderful is that!",
    "Your little toes moved! You did it! Kick them again!"
  ],
  "voice|affection": [
    "I love your voice! Such a sweet sound. I'm listening, sweetheart.",
    "Ooh, ahh, ooh! Sweet little voice! I love you!",
    "Listen to those sounds! I love you, sweetheart. I'm right here."
  ],
  "voice|praise": [
    "I hear your voice! Such a lovely sound. Let's hear it again!",
    "I heard your voice! Ooh, what a sound! Say it again?",
    "Ooh, ahh, ooh! I hear you! Hooray, baby!"
  ],
  "voice|repeat": [
    "Another little sound? Let's try again. I'll listen closely.",
    "One more little sound? I'll listen closely. Ooh, ahh, ooh!",
    "Shall we make sounds? Shall we go again? I'll stay close."
  ],
  "voice|start": [
    "Let's make some sounds! I'll listen first. Now it's your turn.",
    "Let's start making sounds! Here we go! Let's begin gently.",
    "Ready for little noises? Let's get started. I'm right beside you."
  ],
  "tummy|inquiry": [
    "How's your tummy? Are you comfortable? I'm listening, sweetheart.",
    "Little tummy! How's it feeling? I'm right here!",
    "How's your tummy? Little gurgle sounds! I'm right here!"
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
    "Hear the rain? Drip, drop, drip! Tap, tap, tap!",
    "Hear the raindrops? Tap, tap, tap! They're on the window."
  ],
  "rain|affection": [
    "Rain is falling outside. I'm here with you. I love these moments.",
    "Listen, listen! Drip, drop, drip! I love you!",
    "Rain taps the window. I love you, sweetheart. Let's listen together."
  ],
  "rain|invitation": [
    "Shall we watch rain? Look at the window. Listen with me.",
    "Listen to the rain! Drip, drop, drip. Can you hear it?",
    "Want to watch raindrops? Come try with me. What do you think?"
  ],
  "sun|invitation": [
    "Shall we see sunshine? Let's look outside. So bright today!",
    "Look at the sunshine! It's bright and warm. See that glow?",
    "Look at the sun! Bright, bright, bright! See that light?"
  ],
  "sun|affection": [
    "Sunshine is so bright! I'm here with you. I love this moment.",
    "Hello, sunshine! Bright, bright, bright! Hello, baby!",
    "Look at the sunshine! Your face looks bright. I love you!"
  ],
  "sun|inquiry": [
    "Can you see sunshine? Look at the light. Isn't it bright?",
    "Where's the sunshine? Look up, baby! There it is!",
    "Can you see sunshine? Look at that light. It's so bright!"
  ],
  "smile|repeat": [
    "Another little smile? I'll smile at you. Your turn again.",
    "Want to smile together? Here's a smile. I'll smile with you.",
    "Shall we smile together? Look at my face. I'll smile too."
  ],
  "wake|inquiry": [
    "You're awake now! How do you feel? Hello, sweetheart.",
    "Hello, baby! Eyes wide open! Look, look, look!",
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
    "All done resting? More cozy time? I'm right here!"
  ],
  "cry|care": [
    "I hear you crying. That was a lot. I'm here with you.",
    "I hear you crying. We can rest now. I'll stay beside you.",
    "Those tears are real. I'll stay with you. Let's rest together."
  ],
  "cry|affection": [
    "I hear you crying. I love you, sweetheart. I'm right here.",
    "Oh, sweet baby! I hear you! Big, soft hugs!",
    "You're crying, little one. I love you, sweetheart. I'm right here."
  ],
  "play|praise": [
    "Look at you playing! You're doing great. Well done, sweetheart.",
    "You're playing with me! That toy goes round. Look at it!",
    "Play, play, play! Look at that toy! Yay, baby!"
  ],
  "play|achievement": [
    "Got the toy! You did it! Yay, yay!",
    "Yay, yay, yay! You did it! Let's clap together!",
    "What a fun game! You did it! Let's clap together!"
  ],
  "play|effort": [
    "Try, try, try! No rush, baby! I'm here!",
    "You're playing this game. You keep trying! I'm watching you.",
    "Try, try, try! That little toy! I'm right here!"
  ],
  "book|inquiry": [
    "What's in the book? Let's turn a page. What do you see?",
    "See this book? Look, look, look! Turn the page!",
    "Look at this picture! What do you see? Let's look again!"
  ],
  "book|praise": [
    "You looked at pictures! That's lovely, sweetheart. Well done.",
    "You turned the page! Look at that picture. What comes next?",
    "Look, look, look! A pretty picture! Yay, baby!"
  ],
  "music|praise": [
    "You made a sound! Well done, little one. Let's sing together.",
    "You're moving to music! Your little feet bounce. Tap, tap, tap!",
    "La, la, la! I hear you! Yay, baby!"
  ],
  "outside|reassurance": [
    "We're going outside together. I'll stay close. I've got you.",
    "Out here with me. I'll stay close. You're not alone.",
    "We're outside together. We have time. I'm here with you."
  ],
  "food|finish_check": [
    "All done eating? Wipe, wipe, wipe? Let's have a look!",
    "Finished eating yet? Shall we check? All done now?",
    "All done eating? Last little bite? Let's have a look!"
  ],
  "food|reassurance": [
    "It's food time, sweetheart. I'll stay beside you. We can go slowly.",
    "Food time together. I'll stay close. You're not alone.",
    "Here's a little bite. We have time. I'm here with you."
  ],
  "milk|care": [
    "That was milk time. You did a lot. Let's rest together.",
    "You drank your milk. Your tummy is full. Let's rest together.",
    "Milk time is over. I'll stay with you. Let's rest together."
  ],
  "milk|reassurance": [
    "Here comes your milk. I'll hold your bottle. One little sip.",
    "It's milk time, sweetheart. Let's get comfy. I'm beside you.",
    "Here's a little milk. We have time. I'm here with you."
  ],
  "drink|finish_check": [
    "All done drinking? Want another sip? Let's see together.",
    "Finished your drink? Shall we check? All done now?",
    "Had enough to drink? Let's check together. Are we finished?"
  ],
  "drink|praise": [
    "You took a sip! Well done, little one. That's lovely.",
    "You took a sip! Little by little now. Good job, baby!",
    "You had your drink! You're doing so well. I'm proud of you."
  ],
  "diaper|care": [
    "That change is over. Let's get cozy. I'm with you.",
    "Diaper time is over. Let's get cozy. I'm here with you.",
    "A fresh diaper now. We can get cozy. I'll stay with you."
  ],
  "hug|affection": [
    "I love this cuddle. You're my treasure. Stay close, little one.",
    "Cuddle, cuddle, cuddle! My sweet baby! I love you!",
    "A cuddle with you! You're warm and cozy. I love you!"
  ],
  "hug|care": [
    "You've done a lot. Come for a cuddle. I'll hold you close.",
    "Come for a cuddle. You look tired, sweetheart. Let's rest together.",
    "A gentle little cuddle. You did a lot. I'll stay with you."
  ],
  "hug|praise": [
    "You reached for hugs! How lovely, little one. Well done.",
    "Such a warm cuddle! You're snuggled up close. I love you.",
    "Cuddle time! Snuggle, snuggle, snuggle! I love you!"
  ],
  "bath|care": [
    "Bath time is done! You're all clean now. Let's get cozy!",
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
    "You're trying little sips. Look at you! Take your time.",
    "Little sips take practice. I see you trying. I'm right here.",
    "You're taking little sips. That looks gentle. Take your time."
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

// Stable core bank plus newly curated short, meaningful combinations.
const COMBINED_BASE = {...BASE_COMBINED_REPLIES, ...SUPPLEMENTAL_COMBINED_REPLIES};
export const COMBINED_REPLIES = Object.fromEntries(
  Object.entries(COMBINED_BASE).map(([key,replies]) => [key,[...replies,...(FREQUENT_COMBINED_VARIANTS[key]||[])]])
);

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
