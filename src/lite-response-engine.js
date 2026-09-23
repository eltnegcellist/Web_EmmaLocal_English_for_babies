// AUTO-SYNCED from Android Emma LiteResponseEngine.kt / LiteSpeechStyle.kt.
// Android source commit: 9ac27cb1d8cb57be5d20fb57e46bc8aff5eb0ab6
// Do not hand-edit the reply bank independently from Android.
const STYLE = {
  "MIN_WORDS": 6,
  "MAX_WORDS": 12,
  "MIN_SENTENCES": 3,
  "MAX_SENTENCES": 3,
  "MAX_WORDS_PER_SENTENCE": 4,
  "NAME_REPEAT_WINDOW": 2
};
const GENERIC_REPLIES = [
  "Hello, little one! Emma is here. Hello, hello!",
  "Hi there, little one! I'm right here. Hello, hello!",
  "Hello, hello! Emma is here. Look with me.",
  "Hi, little one! I'm right here. Nice and easy.",
  "Hello there! Stay with me. Here we go!"
];
const NEUTRAL_CLOSERS = [
  "Here we go!",
  "Nice and easy.",
  "I'm right here.",
  "Hello, hello!",
  "Look with me.",
  "Listen with me."
];
const SCENE_FILLERS = {
  "bath": [
    "Splash, splash!",
    "Here we go!"
  ],
  "milk": [
    "Sip, sip!",
    "Nice and slow."
  ],
  "sleep": [
    "Night-night.",
    "Rest, rest."
  ],
  "wake": [
    "Hello, hello!",
    "Good morning!"
  ],
  "diaper": [
    "Here we go!",
    "Nice and easy."
  ],
  "clothes": [
    "Here we go!",
    "All ready."
  ],
  "hug": [
    "Big cuddle!",
    "Nice and close."
  ],
  "hands": [
    "Squeeze, squeeze!",
    "Wiggle, wiggle!"
  ],
  "feet": [
    "Kick, kick!",
    "Wiggle, wiggle!"
  ],
  "smile": [
    "Smile, smile!",
    "Hello, hello!"
  ],
  "cry": [
    "I'm right here.",
    "Nice and gentle."
  ],
  "voice": [
    "Ooh, ahh!",
    "I'm listening."
  ],
  "tummy": [
    "Nice and easy.",
    "Take your time."
  ],
  "play": [
    "Look, look!",
    "Here we go!"
  ],
  "outside": [
    "Look around!",
    "Here we go!"
  ],
  "rain": [
    "Pitter-patter!",
    "Listen, listen!"
  ],
  "sun": [
    "Bright, bright!",
    "Look, look!"
  ],
  "food": [
    "Yum, yum!",
    "Nice and slow."
  ],
  "book": [
    "Look, look!",
    "Turn the page."
  ],
  "music": [
    "La-la-la!",
    "Listen, listen!"
  ]
};
const SCENE_HINTS = {
  bath: [
    "お風呂入", "風呂入", "おふろはい", "シャワー浴", "体洗", "洗お", "湯船入"
  ],
  milk: [
    "ミルク飲", "みるく飲", "おっぱい飲", "授乳", "哺乳瓶", "ミルクにし", "おっぱいにし"
  ],
  sleep: [
    "寝よ", "寝る", "寝ます", "寝て", "寝た", "寝かし", "寝かせ", "眠ろ", "眠る",
    "眠い", "眠そう", "眠く", "ねんね", "おねんね", "おやすみ", "昼寝", "お昼寝", "睡眠", "就寝"
  ],
  wake: [
    "起きよ", "起きる", "起きて", "起きた", "目覚め", "おはよう", "朝だ"
  ],
  diaper: [
    "おむつ替", "オムツ替", "おむつかえ", "うんち出", "うんちした", "おしっこ出",
    "おしっこした", "お尻拭", "おしり拭"
  ],
  clothes: [
    "着替えよ", "着替えよう", "着替えよっか", "服着", "服脱", "着せよ", "脱ご",
    "パジャマ着", "靴下はこ"
  ],
  hug: [
    "抱っこし", "だっこし", "抱っこする", "だっこする", "ぎゅー", "ぎゅっ", "抱きしめ"
  ],
  hands: [
    "おてて", "手握", "手にぎ", "指つか", "指握", "手バタ"
  ],
  feet: [
    "あんよ", "足バタ", "足けり", "足蹴", "キック", "つま先", "足動"
  ],
  smile: [
    "にこにこ", "ニコニコ", "笑った", "笑って", "笑顔", "微笑", "にやっ", "にこっ"
  ],
  cry: [
    "泣い", "泣く", "泣き", "涙", "えーん", "ぐず", "ぐずぐず", "ぐずって"
  ],
  voice: [
    "声出", "おしゃべり", "喃語", "クーイング", "あーって", "うーって", "あうあう",
    "話してる", "しゃべって"
  ],
  tummy: [
    "げっぷ", "ゲップ", "お腹いっぱい", "おなかいっぱい", "満腹", "吐き戻", "吐いた",
    "お腹苦", "おなか苦"
  ],
  play: [
    "遊ぼ", "あそぼ", "遊ぶ", "おもちゃ", "ガラガラ", "ぬいぐるみ", "メリー", "ボールで遊"
  ],
  outside: [
    "散歩行", "お散歩行", "さんぽ行", "外行", "お外行", "出かけ", "ベビーカー乗", "公園行"
  ],
  rain: [
    "雨降", "雨だ", "あめ降", "雨音", "傘さ"
  ],
  sun: [
    "晴れ", "晴れた", "晴れてる", "いい天気", "お日様", "太陽", "ぽかぽか"
  ],
  food: [
    "ごはん食", "ご飯食", "離乳食", "食べよ", "たべよ", "食べる", "食べた",
    "いただきます", "スプーン", "お腹すい", "おなかすい", "お腹減", "おなか減"
  ],
  book: [
    "絵本読", "えほん読", "本読", "読も", "よもっか", "ページめく", "絵本見", "本見"
  ],
  music: [
    "歌お", "うたお", "歌う", "うたう", "音楽聞", "曲聞", "踊ろ", "リズム", "歌って"
  ]
};

const SCENE_EXCLUSIONS = {
  bath: ["風呂敷"],
  sleep: ["寝返り"],
  hands: ["手伝", "手続", "手紙", "手数"],
  feet: ["足り", "足す", "足し"],
  tummy: ["お腹すい", "おなかすい", "お腹減", "おなか減"],
  voice: ["声優"],
  music: ["歌舞伎"]
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
      "Bath time! Splash, splash! Here we go!",
      "Warm bath! Splash, splash! Nice and easy.",
      "Bath time! Wash, wash! All clean.",
      "Here we go! Bath time! Splash, splash!",
      "{name}, bath time! Splash, splash! Here we go!"
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
      "Milk time! Sip, sip! Nice and slow.",
      "Yummy milk! Sip, sip! Mmm, yummy!",
      "Milk, milk! Little sips. Nice and easy.",
      "Time for milk! Sip, sip! All done.",
      "{name}, milk time! Sip, sip! Nice and slow."
    ]
  },
  {
    "id": "sleep",
    "keywords": [
      "眠い",
      "眠そう",
      "ねむい",
      "ねむそう",
      "ねんね",
      "寝よう",
      "寝る",
      "寝るよ",
      "寝ます",
      "寝て",
      "寝た",
      "寝かせ",
      "寝かしつけ",
      "おやすみ",
      "昼寝",
      "お昼寝",
      "睡眠",
      "就寝",
      "眠く"
    ],
    "replies": [
      "So sleepy. Night-night. Rest, little one.",
      "Sleepy time. Nice and quiet. Night-night.",
      "Time to sleep. Rest, rest. Nice and cozy.",
      "Sleepy eyes. Night-night. Rest, little one.",
      "{name}, sleepy time. Night-night. Rest nice and easy."
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
      "Good morning! You're awake! Hello, hello!",
      "You're awake! Hello, hello! Good morning!",
      "Morning, little one! Eyes open. Hello, hello!",
      "Hello there! You're awake! Here we go!",
      "{name}, good morning! You're awake! Hello, hello!"
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
      "Diaper time! Nice and easy. Here we go!",
      "Fresh diaper! Here we go! Nice and easy.",
      "Diaper change! Wipe, wipe! All clean.",
      "Here we go! Diaper time! Nice and clean.",
      "{name}, diaper time! Nice and easy. Here we go!"
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
      "Clothes on! Here we go! Nice and easy.",
      "Time to dress! One little arm. Here we go!",
      "Getting dressed! Nice and easy. All ready.",
      "Clothes time! Here we go! All cozy.",
      "{name}, clothes on! Nice and easy. All ready."
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
      "Big cuddle! Up, up! Nice and close.",
      "Cuddle time! Nice and close. Here we go!",
      "Up we go! Big hug. So cozy.",
      "Big hug! Nice and close. I'm right here.",
      "{name}, cuddle time! Big hug. Nice and close."
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
      "Tiny hands! Squeeze, squeeze! Wiggle, wiggle!",
      "Little hands! Open, close. Wiggle, wiggle!",
      "Tiny fingers! Squeeze, squeeze! Little hands!",
      "Hands, hands! Open and close. Wiggle, wiggle!",
      "{name}, tiny hands! Squeeze, squeeze! Wiggle, wiggle!"
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
      "Little feet! Kick, kick! Wiggle, wiggle!",
      "Tiny feet! Kick, kick! Little toes!",
      "Feet, feet! Up and down. Kick, kick!",
      "Little toes! Wiggle, wiggle! Kick, kick!",
      "{name}, little feet! Kick, kick! Wiggle, wiggle!"
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
      "Big smile! Smile, smile! Hello, little one!",
      "What a smile! Hello, hello! Smile, smile!",
      "Smile, smile! There it is! Hello there!",
      "Happy smile! Hello, little one! So sweet.",
      "{name}, big smile! Hello, hello! Smile, smile!"
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
      "I hear you. I'm right here. Nice and gentle.",
      "I hear you. Here with you. Nice and close.",
      "Hello, little one. I hear you. I'm right here.",
      "I hear your voice. Nice and gentle. I'm right here.",
      "{name}, I hear you. I'm right here. Nice and gentle."
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
      "I hear you! Hello, hello! I'm listening.",
      "What a voice! Ooh, ahh! I hear you.",
      "Hello, little one! I hear you. Ooh, ahh!",
      "You're talking! Hello, hello! I'm listening.",
      "{name}, I hear you! Ooh, ahh! I'm listening."
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
      "Little tummy. Nice and easy. Take your time.",
      "Little tummy. Nice and gentle. Here we go.",
      "Nice and slow. Little tummy. Take your time.",
      "Easy, easy. Little tummy. I'm right here.",
      "{name}, little tummy. Nice and easy. Take your time."
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
      "Play time! Look, look! Here we go!",
      "Let's play! Look with me. Here we go!",
      "Play, play! Look, look! So much fun!",
      "Time to play! Hello, hello! Let's play!",
      "{name}, play time! Look, look! Here we go!"
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
      "Outside time! Look around! Here we go!",
      "Out we go! Look, look! Listen with me.",
      "Outside, outside! Look around! Here we go!",
      "Time outside! Look with me. Listen, listen!",
      "{name}, outside time! Look around! Here we go!"
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
      "Rain, rain! Pitter-patter! Listen, listen!",
      "Rain outside! Drip, drop! Listen with me.",
      "Pitter-patter! Rain, rain! Drip, drop!",
      "Listen, listen! Rain outside! Pitter-patter!",
      "{name}, rain outside! Pitter-patter! Listen, listen!"
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
      "Bright day! Hello, sunshine! Look, look!",
      "Sunshine! Bright, bright! Look with me.",
      "Hello, sunshine! Bright day! Look, look!",
      "Bright, bright! Sunshine! Here we go!",
      "{name}, bright day! Hello, sunshine! Look, look!"
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
      "Food time! Yum, yum! Nice and slow.",
      "Yummy food! Little bite. Nice and easy.",
      "Time to eat! Yum, yum! Here we go!",
      "Food, food! Little bite. Yum, yum!",
      "{name}, food time! Yum, yum! Nice and slow."
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
      "Book time! Look, look! Turn the page.",
      "Let's read! Look with me. Turn the page.",
      "Book, book! Look, look! Here we go!",
      "Story time! Turn the page. Let's see!",
      "{name}, book time! Look, look! Turn the page."
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
      "Music time! La-la-la! Listen, listen!",
      "Let's sing! La-la-la! Listen with me.",
      "Music, music! Tap, tap! Here we go!",
      "Song time! La-la-la! Listen, listen!",
      "{name}, music time! La-la-la! Listen, listen!"
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
    this.turnsSinceName = safeName && containsName(styled, safeName)
      ? 0 : this.turnsSinceName + 1;
    this.turnCounter++;
    return { english: styled, scene: scene?.id || "generic", score: sceneScore };
  }

  chooseReply(replies, transcript, forceName, suppressName) {
    let eligible = forceName ? replies.filter(x => x.includes("{name}"))
      : suppressName ? replies.filter(x => !x.includes("{name}")) : replies;
    if (!eligible.length) eligible = replies;
    if (eligible.length === 1) return eligible[0];

    const rawIndex = hashCode(transcript) + this.turnCounter;
    const start = Math.abs(rawIndex) % eligible.length;
    for (let offset = 0; offset < eligible.length; offset++) {
      const candidate = eligible[(start + offset) % eligible.length];
      if (!this.recentReplies.includes(candidate) && !this.recentOpeners.includes(openerKey(candidate))) return candidate;
    }
    for (let offset = 0; offset < eligible.length; offset++) {
      const candidate = eligible[(start + offset) % eligible.length];
      if (!this.recentReplies.includes(candidate)) return candidate;
    }
    return eligible[start];
  }

  alignToBabyStyle(reply, transcript, sceneId) {
    const sentences = splitSentences(reply);
    const closers = [...new Set([...NEUTRAL_CLOSERS, ...(SCENE_FILLERS[sceneId] || [])])];
    let offset = positiveIndex(hashCode(transcript) + this.turnCounter, closers.length);

    while (sentences.length > STYLE.MAX_SENTENCES) sentences.pop();

    while ((sentences.length < STYLE.MIN_SENTENCES || wordCount(sentences.join(" ")) < STYLE.MIN_WORDS)
      && sentences.length < STYLE.MAX_SENTENCES) {
      const candidate = closers[offset % closers.length];
      offset++;
      const proposed = [...sentences, candidate];
      if (wordCount(proposed.join(" ")) <= STYLE.MAX_WORDS) sentences.push(candidate);
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
  const hints = (SCENE_HINTS[scene.id] || []).map(normalize).filter(Boolean);
  const exclusions = (SCENE_EXCLUSIONS[scene.id] || []).map(normalize).filter(Boolean);
  const hintMatched = hints.some(x => transcript.includes(x));
  const excluded = exclusions.some(x => transcript.includes(x));

  if (excluded && !hintMatched) return 0;

  let total = 0;
  for (const keyword of scene.keywords) {
    const k = normalize(keyword);
    if (k && transcript.includes(k)) {
      total += Math.max(2, k.length);
      if (k.length >= 4) total += 2;
      if (k.length >= 2 && transcript === k) total += 2;
      else if (
        k.length === 2 &&
        transcript.length <= k.length + 3 &&
        (transcript.startsWith(k) || transcript.endsWith(k))
      ) total += 1;
    }
  }

  if (hintMatched) total = Math.max(total, 4);
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
    .replaceAll("お風呂", "風呂")
    .replaceAll("ねよっか", "寝よっか")
    .replaceAll("ねよう", "寝よう")
    .replaceAll("ねる", "寝る")
    .replaceAll("ねます", "寝ます")
    .replaceAll("ねて", "寝て")
    .replaceAll("ねた", "寝た");
}
function wordCount(text) {
  return (String(text).match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).length;
}
function openerKey(text) {
  const first = splitSentences(text)[0] || "";
  return first.replaceAll("{name}", "").toLowerCase().replace(/[^a-z]+/g, " ").trim().split(/\s+/).slice(0, 3).join(" ");
}
function containsName(text, safeName) {
  return !!safeName && String(text).toLowerCase().includes(String(safeName).toLowerCase());
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
