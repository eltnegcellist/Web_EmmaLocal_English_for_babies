// Experimental child-directed Interaction routing. Enabled only by explicit opt-in.
// Interaction classifications remain provisional; never compare Topic and Interaction softmax scores.
export const INTERACTION_REPLIES = {
  "affection": [
    "You're so cute! What a sweetheart! I love you.",
    "You're so sweet. Just as you are. I love you dearly.",
    "What a sweetheart! You're adorable. Such a lovely child.",
    "Look at you! My sweet baby. I love you!",
    "You are wonderful. Just as you are. I adore you.",
    "Hello, sweet one. You are adorable. Yes, you are!",
    "Such a cutie! That's you! My sweet little one.",
    "I love you. My darling little one. So very much."
  ],
  "praise": [
    "Well done! You did great. I'm proud of you!",
    "Good job! That's just right. You did so well!",
    "Great work! Look what you did! I'm proud of you.",
    "That's wonderful! You did well. Well done, little one!",
    "Very good! You did that yourself. How wonderful is that!",
    "Nicely done! That was lovely. Great job, little one!",
    "That's really good! What a great job! I'm so proud!",
    "Good job, little one! That's lovely. You did great!"
  ],
  "achievement": [
    "You did it! Look what happened! Hooray for you!",
    "Hooray! You did it! That was wonderful!",
    "You got it! Yes, you did! Let's clap together.",
    "There you go! Look what you did! Let's clap together!",
    "Yes! You made it! That's wonderful!",
    "You did it! You kept trying! Look at you!",
    "There it is! You did it! Hooray for you!",
    "It's done! You got it! What a lovely moment!"
  ],
  "effort": [
    "You're trying again! Look at you go! I'm here!",
    "You're really trying! You're working on it. I can see that!",
    "You're working so hard. I see you trying. Take your time.",
    "You keep on trying. You're giving it time. I see you.",
    "You're trying again. I can see that. I'm here with you.",
    "You're really trying. You haven't stopped yet. I'm cheering you on.",
    "You've been trying hard. I see that. I'm proud of you.",
    "Look at you trying! You're working so hard. I'm right beside you."
  ],
  "encouragement": [
    "You can try. I'm beside you. Go when you're ready.",
    "Give it a try! I'll stay close. You can do this!",
    "Keep trying, little one. No need to hurry. I'm cheering you on.",
    "Try again, sweetheart. That's okay. You've got time.",
    "One more try? I'm here too. You've got this!",
    "You can keep trying. Go at your pace. I'll stay nearby.",
    "Go on, little one! You can try. I believe in you.",
    "There's no hurry. Try when you're ready. I'll be close."
  ],
  "invitation": [
    "Shall we do this? Come with me. Let's try together.",
    "Want to try? Let's do it. Let's try together.",
    "What should we play? Want to play together? Let's pick a toy.",
    "How about this? We can try. Let's do it together.",
    "Ready to join me? Let's do this. We'll try together.",
    "Want to try this? Let's look together. Pick your favorite.",
    "Let's try something. Let's do it together. What do you think?",
    "Shall we go? I'll go with you. We can go together."
  ],
  "start": [
    "Here we go! We're beginning now. Ready, little one?",
    "Ready, set, go! Let's begin now. Off we go!",
    "It's time to start. Ready, little one? Let's do this.",
    "We're starting! Are you ready? Off we go!",
    "Let's begin! Now we start. Ready for this?",
    "Ready? We're starting now. Let's go together.",
    "Here we go! It's time to start. Ready for this?",
    "Three, two, one! It's time! Let's begin together."
  ],
  "finish": [
    "It's all done! We finished. Well done, little one.",
    "That's the end. All finished now. We did it.",
    "All done now. We're finished. Good work, little one.",
    "That's finished now. We can stop. Well done, little one.",
    "We're all done. That's the end. Well done, sweetheart.",
    "That's everything. We're all finished. Time for a break.",
    "All finished now! We can pause here. Thank you, little one.",
    "That's it! We're finished now. All done together."
  ],
  "finish_check": [
    "All done? Is that everything? Let's have a look.",
    "Are we finished? Shall we check? What do you think?",
    "Is it all done? Let's see together. Shall we check?",
    "Finished already? Let me see. Are we all done?",
    "Is that the end? Shall we see? Let's check together.",
    "Are you done? Let's have a look. Is that everything?",
    "All finished? Let's check together. Are we done now?",
    "Could that be it? Let's see. Are we done yet?"
  ],
  "care": [
    "You worked so hard. That's a lot. Rest if you like.",
    "That was a lot. You did well. Now let's rest.",
    "Good work today. You can rest. We can slow down.",
    "You worked so hard. Look at you! Let's rest now.",
    "You worked so hard. Let's rest together. I'll hold you.",
    "You worked hard! Your little hands moved. Let's rest a bit.",
    "You worked hard today. That was plenty. Time to rest.",
    "You did a lot. Now take a break. I'm still with you."
  ],
  "inquiry": [
    "What's the matter? I'm right here. Can you show me?",
    "What's going on? Let's figure it out. What do you need?",
    "Is something bothering you? I'm right here. What do you need?",
    "What is it? Can you show me? I'll listen closely.",
    "What's happening, little one? I'll listen closely. Tell me more.",
    "Do you need something? I'm with you. Let's find out.",
    "Are you okay? Let's take a look. What happened, sweetheart?",
    "What's up, little one? I'm listening closely. What do you need?"
  ],
  "reassurance": [
    "I'm here with you. You're not alone. I'm staying close.",
    "It's okay, sweetheart. I'm here to listen. We have time.",
    "You're not alone. I'll stay close. We can slow down.",
    "I'm here with you. I'll listen closely. We're together now.",
    "I've got you. I'll stay right here. We're together now.",
    "You're not alone. I'm here now. We'll take our time.",
    "Right here, little one. I've got you. I'll stay nearby.",
    "We're together now. I'm close by. There's no hurry."
  ],
  "repeat": [
    "One more time? Let's try again. Ready to go?",
    "Again? Let's do that. One more time!",
    "Shall we try again? Just once more. Ready to go?",
    "Let's do it again. Ready for more? We can start.",
    "Once more? Let's try together. Shall we go?",
    "One more go? Let's do it. Ready when you are.",
    "Want to try again? Let's try once more. Ready, little one?",
    "Let's have another go. We can try again. Shall we start?"
  ],
  "pause": [
    "Just a moment. I'll be right here. We can wait.",
    "Let's wait a little. No need to rush. We'll wait together.",
    "Hold on, sweetheart. Just a moment. I'm with you.",
    "We can pause now. There's no hurry. I'm staying right here.",
    "One little moment. Let's stay together. We have time.",
    "Shall we rest? We have time. I'll stay beside you.",
    "Wait a moment. Not just yet. I'll stay close.",
    "Let's take a break. We can wait. No rush."
  ]
};

export const INTERACTION_LABELS = ["affection","praise","achievement","effort","encouragement","invitation","start","finish","finish_check","care","inquiry","reassurance","repeat","pause"];


// Legacy diagnostic helper only. Even this helper uses only the Ruri
// classifier's label and score: no Japanese keyword or regular-expression gates.
export function selectInteraction(_text, prediction) {
  const label = prediction?.id;
  return label && Object.hasOwn(INTERACTION_REPLIES, label) && prediction.probability >= 0.50
    ? label : null;
}
