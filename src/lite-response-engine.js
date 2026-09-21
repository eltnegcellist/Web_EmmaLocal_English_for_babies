// Generated from the Android LiteResponseEngine/BabySpeechStyle snapshot at implementation time.
// Keep behavior aligned with app/src/main/java/com/eltnegcellist/emma/ai when changing Lite.
const STYLE = {
  MIN_WORDS: 20,
  MAX_WORDS: 32,
  MIN_SENTENCES: 5,
  MAX_SENTENCES: 7,
  NAME_REPEAT_WINDOW: 2,
};
const GENERIC_REPLIES = [
  "Hi, little one! I'm right here. Hello, hello! Let's enjoy this moment together.",
  "Hello, little one! I hear you. Here we are! Nice and easy. One little moment.",
  "Hi there! Emma is here. Hello, hello! Look, look! Listen with me.",
  "Hey, little one! I'm with you. So nice! Here we go! Nice and easy.",
  "Hello! I'm right here with you. Hi, hi! Stay with me. Nice and easy."
];
const NEUTRAL_CLOSERS = [
  "Look right here with me.",
  "Listen right here with me.",
  "Here we go together now.",
  "Nice and easy, little one.",
  "Emma is right here now.",
  "Hello, hello, little one, hello!",
  "Stay right here with me."
];
const SCENE_FILLERS = {
  "bath": [
    "Bath time together.",
    "Splash, splash!",
    "Here we go!",
    "Nice and easy."
  ],
  "milk": [
    "Milk time together.",
    "Sip, sip!",
    "Nice and slow.",
    "Mmm, yummy!"
  ],
  "sleep": [
    "Sleepy, sleepy.",
    "Night-night.",
    "Rest, rest.",
    "Nice and quiet."
  ],
  "wake": [
    "You're awake!",
    "Hello, hello!",
    "Good morning!",
    "Here we go!"
  ],
  "diaper": [
    "Diaper time together.",
    "Here we go!",
    "Nice and easy.",
    "All nice and comfy."
  ],
  "clothes": [
    "Clothes time together.",
    "Here we go!",
    "Nice and easy.",
    "One little step."
  ],
  "hug": [
    "Cuddle time together.",
    "Up, up!",
    "Nice and close.",
    "Big cuddle!"
  ],
  "hands": [
    "Tiny little hands.",
    "Squeeze, squeeze!",
    "Wiggle, wiggle!",
    "Little fingers."
  ],
  "feet": [
    "Little tiny feet.",
    "Kick, kick!",
    "Wiggle, wiggle!",
    "Tiny toes."
  ],
  "smile": [
    "Smile, smile!",
    "Hello, happy face!",
    "Hi, little one!",
    "So nice to see."
  ],
  "cry": [
    "I hear you.",
    "I'm right here.",
    "Nice and gentle.",
    "Here with you."
  ],
  "voice": [
    "I hear you.",
    "Hello, hello!",
    "Ooh, ahh!",
    "I'm listening."
  ],
  "tummy": [
    "Little tummy.",
    "Nice and easy.",
    "Take your time.",
    "Here we go."
  ],
  "play": [
    "Play time together.",
    "Look, look!",
    "Here we go!",
    "Let's play!"
  ],
  "outside": [
    "Outside time together.",
    "Look around!",
    "Here we go!",
    "Out we go!"
  ],
  "rain": [
    "Rain, rain!",
    "Pitter-patter!",
    "Listen, listen!",
    "Drip, drop!"
  ],
  "sun": [
    "Bright, bright!",
    "Look at the light.",
    "Hello, sunshine!",
    "Look, look!"
  ],
  "food": [
    "Food time together.",
    "Yum, yum!",
    "Little bite.",
    "Nice and slow."
  ],
  "book": [
    "Book time together.",
    "Look, look!",
    "Turn the page.",
    "Let's see!"
  ],
  "music": [
    "Music time together.",
    "La-la-la!",
    "Listen, listen!",
    "Hear the music!"
  ]
};
const SCENES = [
  {
    "id": "bath",
    "keywords": [
      "お風呂",
      "風呂",
      "湯船",
      "お湯",
      "シャワー",
      "体洗",
      "あったかいお湯"
    ],
    "replies": [
      "Bath time! Let's go! Splash, splash! So much fun!",
      "Time for a bath! Splash, splash! Warm water feels nice. Let's enjoy bath time!",
      "Bath time, little one! In we go! Splash, splash! Nice warm water!",
      "Warm bath! Here we go! Splash, splash! Wash, wash! All nice and clean!",
      "{name}, bath time! Warm water. Splash, splash! Here we go! So nice!"
    ]
  },
  {
    "id": "milk",
    "keywords": [
      "ミルク",
      "母乳",
      "おっぱい",
      "飲んだ",
      "飲もう",
      "飲めた",
      "哺乳瓶",
      "授乳"
    ],
    "replies": [
      "Yummy milk! Big drink! Mmm, yummy! All done!",
      "Yummy milk! Drink, drink! Nice and easy. Sip, sip! All cozy.",
      "Time for milk! Little sips. Mmm, yummy! Nice and slow, little one.",
      "Milk, milk! Sip, sip! Take your time. Yummy, yummy! There you go!",
      "{name}, milk time! Sip, sip! Nice and slow. Yummy milk!"
    ]
  },
  {
    "id": "sleep",
    "keywords": [
      "眠い",
      "眠そう",
      "ねんね",
      "寝よう",
      "寝る",
      "おやすみ",
      "昼寝",
      "眠く"
    ],
    "replies": [
      "So sleepy. Soft eyes. Night-night. Rest, little one.",
      "Sleepy time. Nice and quiet. Night-night! Rest your little eyes. So cozy.",
      "Time to sleep. Soft and quiet. Night-night, little one. Rest, rest.",
      "Sleepy eyes! Let's rest. Nice and cozy. Night-night! Sweet dreams.",
      "{name}, night-night. So sleepy. Rest your eyes. Nice and cozy. Sweet dreams!"
    ]
  },
  {
    "id": "wake",
    "keywords": [
      "起きた",
      "おはよう",
      "目覚め",
      "起きよう",
      "起きて",
      "朝だ"
    ],
    "replies": [
      "Good morning! You're awake! Hello, hello! A new moment! Hello, hello!",
      "Hi, sleepyhead! You're awake. Good morning! Hello, hello! Here we go!",
      "Good morning, little one! Eyes open! Hi there! Nice to see you.",
      "You're awake! Hello! Good morning. Stretch, stretch! Here we go!",
      "{name}, good morning! You're awake! Hello, hello! Nice to see you!"
    ]
  },
  {
    "id": "diaper",
    "keywords": [
      "おむつ",
      "オムツ",
      "うんち",
      "おしっこ",
      "替えよう",
      "替える",
      "お尻"
    ],
    "replies": [
      "Diaper time! Here we go. Nice and clean. Fresh and comfy! All done soon.",
      "Let's change your diaper! Nice and easy. Clean and fresh. There we go!",
      "Diaper change! Lift, lift! Wipe, wipe! Nice and clean. All comfy!",
      "Fresh diaper time! Nice and easy. Clean, clean! There you go, little one.",
      "{name}, diaper time! Nice and easy. Clean and fresh. All comfy!"
    ]
  },
  {
    "id": "clothes",
    "keywords": [
      "着替え",
      "服着",
      "服脱",
      "お洋服",
      "パジャマ",
      "靴下",
      "帽子"
    ],
    "replies": [
      "Let's get dressed! One arm, then the other. Here we go! All cozy!",
      "Clothes on! Arm in, arm out. Nice and easy. Looking comfy!",
      "Time to get dressed! Here we go. One little arm. Then the other!",
      "Let's change clothes! Nice and easy. Pull, pull! All ready!",
      "{name}, let's get dressed! Here we go. Nice and easy. All ready!"
    ]
  },
  {
    "id": "hug",
    "keywords": [
      "抱っこ",
      "だっこ",
      "ぎゅ",
      "抱きしめ",
      "抱っこしよう",
      "腕の中"
    ],
    "replies": [
      "Up we go! Big cuddle! Snuggle, snuggle. Nice and close. So cozy!",
      "Cuddle time! Up, up! Nice and close. Warm hug! There we go.",
      "Big hug! Snuggle in. Nice and cozy. Up, up! I'm right here.",
      "Up in your arms! Cuddle, cuddle. Nice and close. So warm and cozy.",
      "{name}, cuddle time! Up, up! Big hug. Nice and close. So cozy!"
    ]
  },
  {
    "id": "hands",
    "keywords": [
      "手",
      "おてて",
      "握って",
      "にぎって",
      "ぎゅっと",
      "指",
      "つかん"
    ],
    "replies": [
      "Tiny hands! Squeeze, squeeze! Hold tight! Little hands!",
      "Look at those hands! Open, close. Wiggle, wiggle! Tiny little fingers.",
      "Little hands! Grip, grip! Open and close. Wiggle those tiny fingers!",
      "Tiny fingers! One, two, three! Squeeze, squeeze. Little hands at work!",
      "{name}, tiny hands! Squeeze, squeeze! Wiggle, wiggle! So busy!"
    ]
  },
  {
    "id": "feet",
    "keywords": [
      "足",
      "あんよ",
      "キック",
      "蹴って",
      "つま先",
      "足バタ"
    ],
    "replies": [
      "Little feet! Kick, kick! Wiggle, wiggle! Those tiny toes are moving!",
      "Kick those feet! Kick, kick! Little toes. Wiggle, wiggle! So busy!",
      "Tiny feet! Up, down! Kick, kick! Wiggle those little toes.",
      "Look at those feet! Kick, kick! Toes, toes! So much movement!",
      "{name}, little feet! Kick, kick! Wiggle those tiny toes!"
    ]
  },
  {
    "id": "smile",
    "keywords": [
      "笑った",
      "笑って",
      "笑顔",
      "にこにこ",
      "ニコニコ",
      "微笑"
    ],
    "replies": [
      "What a smile! Hello, happy face! Smile, smile! So lovely to see.",
      "Big smile! I see it! Hello, little one. Smile, smile! So sweet.",
      "Look at that smile! Hi there! Such a bright little face. Hello!",
      "Smile, smile! There it is! Hi, little one. So nice to see.",
      "{name}, what a smile! Hello, hello! Smile, smile! So sweet!"
    ]
  },
  {
    "id": "cry",
    "keywords": [
      "泣いて",
      "泣いた",
      "泣いちゃ",
      "涙",
      "えーん",
      "ぐず",
      "ぐずぐず"
    ],
    "replies": [
      "I hear you, little one. I'm right here. Nice and close. You're not alone.",
      "I hear your voice. I'm here with you. Nice and gentle. One moment at a time.",
      "Hello, little one. I hear you. I'm right here. Nice and close.",
      "I hear you. Here we are together. Soft and gentle. I'm right here.",
      "{name}, I hear you. I'm right here with you. Nice and close."
    ]
  },
  {
    "id": "voice",
    "keywords": [
      "声出",
      "あーって",
      "うーって",
      "おしゃべり",
      "喃語",
      "クーイング",
      "あうあう"
    ],
    "replies": [
      "Hi, little one! I hear your voice! Hello, hello! I'm listening!",
      "What a voice! Ahh, ahh! I hear you. Hello there! Talk, talk!",
      "Hi, little one! I hear your voice. Ooh, ahh! I'm listening!",
      "You're talking! Hello, hello! I hear you. Ahh, ooh! So many sounds!",
      "{name}, I hear your voice! Hello, hello! Ahh, ooh! I'm listening!"
    ]
  },
  {
    "id": "tummy",
    "keywords": [
      "お腹",
      "おなか",
      "げっぷ",
      "ゲップ",
      "お腹いっぱい",
      "満腹",
      "吐き戻"
    ],
    "replies": [
      "Little tummy! Nice and gentle. Pat, pat. Take your time. There we go.",
      "Little tummy. Time to rest. Nice and easy. Pat, pat. All gentle.",
      "Nice and slow. Little tummy. Pat, pat! Take your time, little one.",
      "There we go. Gentle pats. Nice and easy. Little tummy, little rest.",
      "{name}, nice and easy. Gentle pat, pat. Take your time, little one."
    ]
  },
  {
    "id": "play",
    "keywords": [
      "遊ぼう",
      "遊ん",
      "おもちゃ",
      "ガラガラ",
      "ぬいぐるみ",
      "メリー",
      "ボール"
    ],
    "replies": [
      "Play time! Look, look! Let's play. Shake, shake! So much to see!",
      "Let's play! Look over here. Shake, shake! Fun little sounds. Here we go!",
      "Play time, little one! Look and listen. Shake, shake! Let's have fun!",
      "Here we go! Time to play. Look, look! Shake, shake! So much fun!",
      "{name}, play time! Look, look! Shake, shake! Let's have fun!"
    ]
  },
  {
    "id": "outside",
    "keywords": [
      "散歩",
      "お散歩",
      "外行",
      "お外",
      "公園",
      "ベビーカー",
      "出かけ"
    ],
    "replies": [
      "Let's go outside! Here we go. Look around! So much to see! Listen, listen!",
      "Outside time! Look, look! Fresh air. Here we go, little one!",
      "Let's take a walk! Out we go. Look around! So many things to see.",
      "Here we go outside! Look and listen. A little walk together!",
      "{name}, let's go outside! Look around. Here we go! So much to see!"
    ]
  },
  {
    "id": "rain",
    "keywords": [
      "雨",
      "降ってる",
      "降ってきた",
      "雨音",
      "傘"
    ],
    "replies": [
      "Rain, rain! Pitter-patter! Listen, listen! Rain outside!",
      "It's raining! Pitter-patter. Listen to the rain. Tap, tap, tap!",
      "Rain outside! Drip, drop! Listen, little one. Pitter-patter!",
      "Pitter-patter! Rain, rain. Listen to that sound. Drip, drop!",
      "{name}, listen! Rain outside. Pitter-patter! Drip, drop, drip!"
    ]
  },
  {
    "id": "sun",
    "keywords": [
      "晴れ",
      "いい天気",
      "お日様",
      "太陽",
      "明るい",
      "ぽかぽか"
    ],
    "replies": [
      "Bright day! Look at the light. Hello, sunshine! Nice and warm.",
      "What a bright day! Light all around. Hello, hello! Nice and warm.",
      "Sunshine! Bright, bright! Look at the light. Such a nice day!",
      "A bright day! Hello, sunshine. Warm and light. Look, look!",
      "{name}, bright day! Hello, sunshine! Look at the light. So warm!"
    ]
  },
  {
    "id": "food",
    "keywords": [
      "ごはん",
      "離乳食",
      "食べよう",
      "食べた",
      "おいしい",
      "いただきます",
      "スプーン"
    ],
    "replies": [
      "Yummy food! Open wide. Mmm, yummy! Little bite. Nice and slow!",
      "Time to eat! Little bite. Mmm, yummy! Nice and slow. Here we go!",
      "Yum, yum! Food time. Open wide! Little bite. There you go!",
      "Let's eat! Mmm, yummy! One little bite. Nice and easy!",
      "{name}, yummy food! Little bite. Mmm, yummy! Nice and slow!"
    ]
  },
  {
    "id": "book",
    "keywords": [
      "絵本",
      "本読",
      "読もう",
      "お話",
      "ページ",
      "めく"
    ],
    "replies": [
      "Book time! Look, look! Turn the page. What's next? Let's see!",
      "Let's read! Page by page. Look at this! Turn, turn. Here we go!",
      "Story time! Look and listen. Turn the page. Let's see what comes next!",
      "A book! Look, look! Page turn. Here we go! So much to see.",
      "{name}, book time! Look, look! Turn the page. Let's see!"
    ]
  },
  {
    "id": "music",
    "keywords": [
      "歌",
      "音楽",
      "うた",
      "歌おう",
      "踊ろう",
      "リズム",
      "曲"
    ],
    "replies": [
      "Music time! La-la-la! Listen to the beat. Tap, tap! Here we go!",
      "Let's sing! La-la-la! Music, music. Tap the beat! So much fun!",
      "I hear music! La-la-la! Tap, tap. Listen to the rhythm!",
      "Song time! La-la-la! Listen, listen. Tap the beat! Here we go!",
      "{name}, music time! La-la-la! Tap, tap! Listen to the beat!"
    ]
  }
];

export function splitSentences(text) {
  return String(text || "").trim().split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
}

export class LiteResponseEngine {
  constructor() {
    this.recentReplies = [];
    this.recentOpeners = [];
    this.turnCounter = 0;
    this.turnsSinceName = STYLE.NAME_REPEAT_WINDOW;
  }

  respond(transcript, spokenBabyName = "") {
    const normalized = normalize(transcript);
    const ranked = SCENES.map(scene => [scene, score(scene, normalized)])
      .sort((a, b) => b[1] - a[1]);
    const best = ranked[0];
    const selected = best && best[1] >= 3 ? best : null;
    const scene = selected?.[0] || null;
    const sceneScore = selected?.[1] || 0;
    const replies = scene?.replies || GENERIC_REPLIES;
    const safeName = sanitizeName(spokenBabyName);
    const forceName = !!safeName && this.turnsSinceName >= STYLE.NAME_REPEAT_WINDOW;
    const suppressName = !!safeName && this.turnsSinceName < STYLE.NAME_REPEAT_WINDOW;
    const raw = this.chooseReply(replies, normalized, forceName, suppressName);
    const named = applyName(raw, safeName, forceName);
    const styled = this.alignToBabyStyle(named, normalized, scene?.id);

    this.remember(raw, styled);
    this.turnsSinceName = safeName && styled.toLowerCase().includes(safeName.toLowerCase())
      ? 0 : this.turnsSinceName + 1;
    this.turnCounter++;
    return { english: styled, scene: scene?.id || "generic", score: sceneScore };
  }

  chooseReply(replies, transcript, forceName, suppressName) {
    let eligible = forceName ? replies.filter(x => x.includes("{name}"))
      : suppressName ? replies.filter(x => !x.includes("{name}")) : replies;
    if (!eligible.length) eligible = replies;
    if (eligible.length === 1) return eligible[0];
    const start = positiveIndex(hashCode(transcript) + this.turnCounter, eligible.length);
    for (let offset = 0; offset < eligible.length; offset++) {
      const c = eligible[(start + offset) % eligible.length];
      if (!this.recentReplies.includes(c) && !this.recentOpeners.includes(openerKey(c))) return c;
    }
    for (let offset = 0; offset < eligible.length; offset++) {
      const c = eligible[(start + offset) % eligible.length];
      if (!this.recentReplies.includes(c)) return c;
    }
    return eligible[start];
  }

  alignToBabyStyle(reply, transcript, sceneId) {
    const sentences = splitSentences(reply);
    const closers = [...new Set([...NEUTRAL_CLOSERS, ...(SCENE_FILLERS[sceneId] || [])])];
    let offset = positiveIndex(hashCode(transcript) + this.turnCounter, closers.length);
    while ((sentences.length < STYLE.MIN_SENTENCES || wordCount(sentences.join(" ")) < STYLE.MIN_WORDS)
      && sentences.length < STYLE.MAX_SENTENCES) {
      const candidate = closers[offset % closers.length];
      offset++;
      if (wordCount([...sentences, candidate].join(" ")) <= STYLE.MAX_WORDS) sentences.push(candidate);
      else break;
    }
    while (wordCount(sentences.join(" ")) > STYLE.MAX_WORDS && sentences.length > STYLE.MIN_SENTENCES) {
      sentences.pop();
    }
    return sentences.join(" ").trim();
  }

  remember(template, reply) {
    this.recentReplies.push(template);
    while (this.recentReplies.length > 5) this.recentReplies.shift();
    this.recentOpeners.push(openerKey(reply));
    while (this.recentOpeners.length > 3) this.recentOpeners.shift();
  }
}

function score(scene, transcript) {
  let total = 0;
  for (const keyword of scene.keywords) {
    const k = normalize(keyword);
    if (k && transcript.includes(k)) {
      total += Math.max(2, k.length);
      if (k.length >= 4) total += 2;
    }
  }
  return total;
}
function sanitizeName(name) {
  return String(name || "").trim().replace(/[^\p{L}'’\- ]/gu, "").slice(0, 40);
}
function applyName(reply, safeName, forceName) {
  if (reply.includes("{name}") && !safeName) return reply.replaceAll("{name}, ", "").replaceAll("{name}", "little one");
  if (reply.includes("{name}")) return reply.replaceAll("{name}", safeName);
  if (forceName && safeName) return safeName + "! " + reply;
  return reply;
}
function normalize(text) {
  return String(text || "").toLowerCase()
    .replace(/[\s、。！？!?,.・「」『』（）()ー〜~]/g, "")
    .replaceAll("おふろ", "お風呂")
    .replaceAll("お風呂", "風呂");
}
function wordCount(text) {
  return (String(text).match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).length;
}
function openerKey(text) {
  const first = splitSentences(text)[0] || "";
  return first.replaceAll("{name}", "").toLowerCase().replace(/[^a-z]+/g, " ").trim().split(/\s+/).slice(0, 3).join(" ");
}
function positiveIndex(value, size) {
  if (!size) return 0;
  const mod = value % size;
  return mod < 0 ? mod + size : mod;
}
function hashCode(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h * 31) + text.charCodeAt(i)) | 0;
  return h;
}
