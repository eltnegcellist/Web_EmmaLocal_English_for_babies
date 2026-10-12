import { matchPhoneticScene } from './lite-phonetic-scene-matcher.js';
import { detectFlexibleTopics, normalizeParentSpeech, detectDrinkingAction, hasNonMilkDrink, detectNounTopics } from './lite-topic-matcher.js';

// A detected topic may be carried into at most one subsequent ambiguous turn.
const TOPIC_HOLD_TURNS = 1;

// Reply bank and style synced from Android Emma LiteResponseEngine.kt / LiteSpeechStyle.kt.
// Android source commit: dfd20958931d2767d3b54e0c9106f8cb690be93d
// Do not hand-edit the reply bank independently from Android.
const STYLE = {
  "MIN_WORDS": 6,
  "MAX_WORDS": 12,
  "MIN_SENTENCES": 3,
  "MAX_SENTENCES": 3,
  "MAX_WORDS_PER_SENTENCE": 4,
  "NAME_REPEAT_WINDOW": 2
};
// Human-curated baby-directed generic fallback. These short phrases are
// packaged offline; Lite never invokes a model to select them at runtime.
const GENERIC_REPLIES = [
  "Hello, little one! I'm here with you. Hi, baby!",
  "Hi there, sweetheart! Good to see you. Hello again!",
  "You're so precious! I'm glad you're here. Hello, baby!",
  "Hello, dear baby! You make me smile. I'm right here.",
  "Hi, my darling! You are so loved. Big hugs!",
  "Look who's here! My lovely little baby. Hello, sweetheart!",
  "You're wonderful! I'm happy you're here. Hello, baby!",
  "Hey, sweet baby! Let's say hello. Hi there!",
  "You're so special! I love you lots. Big, big hugs!",
  "My little sunshine! You're a lovely baby. Hello there!",
  "Hello, sweet pea! You are so loved. I'm here.",
  "Sweet little baby! I'm glad you're here. Hi there!",
  "Let's say hello! Hello, my love! Hi, hi!",
  "Can you hear me? I'm talking to you. Hello there!",
  "Shall we play? I have an idea. Peekaboo!",
  "Peekaboo, baby! There you are! Hello again!",
  "Let's play peekaboo! One, two, three. Here I am!",
  "Want a little song? La, la, la! Sing with me!",
  "Let's sing together! Listen to this tune. La, la!",
  "Here's a little song! La, la, la! Just for you!",
  "Shall we listen? Listen to my voice. Hi, hi!",
  "Want to hear something? I have a song. La, la!",
  "Let's count together! One, two, three! Good job!",
  "One, two, three! Let's count again! Well done!",
  "Let's wave hello! Wave, wave, wave! Hi there!",
  "Can you wave? Hello, hello! Wave with me!",
  "You're growing every day! How wonderful! I love you!",
  "I'm so happy! You're here with me. Hello, sweetheart!",
  "Let's have a cuddle! Come close, sweet baby. So cozy!",
  "You're my little star! Twinkle, twinkle! I love you!",
  "Shall we have fun? Let's play together. Yay, yay!",
  "Want to try something? Let's make a sound. Ba, ba!",
  "Let's say baa! Baa, baa, baa! What fun!",
  "Can you say boo? Boo, boo! Hello again!",
  "I love your voice! Talk to me, baby. I'm listening.",
  "You're good company! I love being here. Hello, dear!",
  "What's on your mind? I'm listening, little one. Tell me!",
  "Something to tell me? I'm listening, baby. Go ahead!",
  "How are you today? I'm happy you're here. Big hugs!",
  "Let's smile together! Big, happy smiles. Hello, sweetheart!",
  "You're my sunshine! I love you. Hello, dear!",
  "Let's have some fun! What's next, little one? You choose!",
  "Let me say hello! Hello to you! My sweet baby!",
  "Do you hear that? It's me saying hi. Hello again!"
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
    "Is it yummy?"
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
    "Big hugs!",
    "I\'m with you."
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
    "Is it tasty?"
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
const SCENE_CHILDCARE_ANCHORS = {
  bath: ["沐浴", "お風呂", "風呂", "湯船", "シャワー"],
  milk: ["ミルク", "みるく", "みのく", "母乳", "おっぱい", "哺乳瓶", "授乳"],
  sleep: ["ねんね", "おねんね", "おやすみ", "昼寝", "お昼寝", "寝る", "寝よう", "眠い", "眠そう"],
  wake: ["おはよう", "起きた", "起きよう", "目覚め"],
  diaper: ["おむつ", "オムツ", "おむづ", "うんち", "おしっこ"],
  clothes: ["着替え", "お着替え", "パジャマ"],
  hug: ["抱っこ", "だっこ", "ぎゅー", "抱きしめ"],
  hands: ["おてて", "指つか", "指握", "手バタ"],
  feet: ["あんよ", "足バタ", "キック", "つま先"],
  smile: ["にこにこ", "ニコニコ", "笑顔", "笑った", "笑う", "にこっ"],
  cry: ["泣く", "泣い", "泣き", "ぐず", "ぐずぐず", "えーん"],
  voice: ["喃語", "クーイング", "おしゃべり", "あーって", "うーって", "あうあう"],
  tummy: ["げっぷ", "ゲップ", "吐き戻", "お腹いっぱい", "おなかいっぱい"],
  play: ["遊ぼ", "あそぼ", "おもちゃ", "ガラガラ", "ぬいぐるみ", "メリー"],
  outside: ["散歩", "お散歩", "ベビーカー", "公園", "お外"],
  rain: ["雨", "雨音"],
  sun: ["お日様", "太陽", "晴れ", "ぽかぽか"],
  food: ["離乳食", "ごはん", "ご飯", "いただきます", "スプーン"],
  book: ["絵本", "ページめく"],
  music: ["音楽", "歌お", "うたお", "リズム"],
};

export const CHILDCARE_ASR_KEYTERMS = [
  "沐浴", "お風呂", "ミルク", "母乳", "おっぱい", "哺乳瓶", "授乳",
  "ねんね", "おやすみ", "昼寝", "おむつ", "うんち", "おしっこ",
  "着替え", "抱っこ", "おてて", "あんよ", "にこにこ", "泣く",
  "ぐずぐず", "喃語", "クーイング", "げっぷ", "吐き戻し", "おもちゃ",
  "お散歩", "ベビーカー", "離乳食", "絵本", "音楽",
];

const MEANINGFUL_SHORT_FORMS = [
  "ミルク", "みるく", "みのく", "母乳", "おっぱい", "授乳", "哺乳瓶",
  "お風呂", "風呂", "沐浴", "シャワー",
  "寝る", "寝よう", "ねんね", "おやすみ", "昼寝", "眠い",
  "起きた", "起きよう", "おはよう",
  "おむつ", "オムツ", "うんち", "おしっこ",
  "着替え", "抱っこ", "だっこ", "ぎゅー",
  "おてて", "あんよ", "笑った", "笑顔", "泣く", "泣いて",
  "げっぷ", "吐き戻", "お腹いっぱい",
  "遊ぼ", "おもちゃ", "散歩", "お散歩", "ベビーカー",
  "雨", "晴れ", "お日様", "ごはん", "離乳食", "絵本", "音楽", "歌お",
].map(normalize);

const FILLER_ONLY = new Set([
  "あ", "ああ", "あー", "あーー",
  "う", "うう", "うー", "うーー",
  "え", "ええ", "えー", "えーー",
  "お", "おお", "おー", "おーー",
  "ん", "んん", "んー", "んーー",
  "あう", "うあ", "あうあう", "うあうあ", "あーうー", "うーあー",
  "えっと", "えーと", "あの", "うん", "うんうん",
].map(normalize));

export function isMeaningfulUtterance(raw) {
  const value=normalize(String(raw||'').replaceAll('[不明]','').replaceAll('[unclear]',''));
  if(!value || value==='不明' || value==='unclear') return false;
  if(FILLER_ONLY.has(value)) return false;
  if(detectDrinkingAction(raw)) return true;
  if(Object.keys(detectNounTopics(raw)).length) return true;
  if(MEANINGFUL_SHORT_FORMS.some(x=>x && value.includes(x))) return true;
  if(/^[あいうえおんぁぃぅぇぉー〜]+$/.test(value)) return false;
  if(/^[アイウエオンァィゥェォー〜]+$/.test(value)) return false;
  if(value.length>=4) return true;
  const contentChars=[...value].filter(ch=>{
    const code=ch.codePointAt(0);
    return (code>=0x30A1&&code<=0x30FA) || (code>=0x3400&&code<=0x4DBF) || (code>=0x4E00&&code<=0x9FFF);
  }).length;
  return value.length>=2 && contentChars>=1;
}

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

// Longer, natural parent phrases are used only by the phonetic rescue path.
const SCENE_RESCUE_PHRASES = {
  bath: [
    "お風呂入りますか", "お風呂入ろうか", "お風呂入ろうね", "お風呂に入ろうか"
  ],
  milk: [
    "ミルク飲みますか", "ミルク飲む", "ミルク飲もうか", "ミルク飲もうね",
    "ミルクにしようか", "ミルクの時間だよ"
  ],
  sleep: [
    "そろそろ寝ようか", "ねんねしようか", "もう寝ようね", "眠くなってきたね"
  ],
  wake: [
    "そろそろ起きようか", "起きる時間だよ", "おはよう起きたね"
  ],
  diaper: [
    "おむつ替えようか", "おむつ替えようね", "おむつ替えますか"
  ],
  clothes: [
    "着替えようか", "お着替えしようか", "着替えようね"
  ],
  hug: [
    "抱っこしようか", "抱っこする", "抱っこしようね"
  ],
  play: [
    "一緒に遊ぼうか", "遊ぼうね", "おもちゃで遊ぼうか"
  ],
  outside: [
    "お散歩行こうか", "お外行こうか", "散歩に行こうね"
  ],
  food: [
    "ごはん食べようか", "ごはん食べますか", "ごはんにしようか"
  ],
  book: [
    "絵本読もうか", "絵本読もうね", "絵本を読みますか"
  ],
  music: [
    "歌を歌おうか", "お歌歌おうか", "音楽聞こうか"
  ]
};

const SCENE_EXCLUSIONS = {
  bath: ["風呂敷"],
  sleep: ["寝返り", "ねがえり", "重ね", "かさね"],
  hands: ["手伝", "手続", "手紙", "手数"],
  feet: ["足り", "足す", "足し"],
  tummy: ["お腹すい", "おなかすい", "お腹減", "おなか減"],
  voice: ["声優"],
  music: ["歌舞伎", "うたがう", "うたがっ", "うたがい"]
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
      "Milk time! Let's have milk. Yum, yum!",
      "Here comes milk! Is it tasty? Mmm, yummy!",
      "Little sips. Milk for your tummy. Mmm, yum!",
      "Milk is yummy! Let's have a sip. Mmm, yum!",
      "Time for milk! Let's get cozy. Sip, sip!",
      "Milk, milk! Are you enjoying it? Yum, yum!",
      "{name}, it's milk time! Hello, little one. Yum, yum!",
      "{name}, here comes milk! Let's have a sip. Yum, yum!"
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
      "How's your tummy? Are you feeling okay? I'm right here.",
      "Little tummy! Does it feel full? Let's have a cuddle.",
      "Is your tummy happy? Let's get comfortable. I'm here.",
      "Your little tummy. Let's get cozy. I'm with you.",
      "Tummy, tummy! I'm here to help. Big hugs!",
      "Let's have a cuddle. Is that better? I'm right here.",
      "{name}, how's your tummy? I'll stay right here. Big hugs!",
      "{name}, little tummy! Let's get cozy. I'm here!"
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
      "Food time! Let's try a bite. Yum, yum!",
      "Is it tasty? Mmm, that's yummy! Another little bite?",
      "Ready to eat? Open wide, little one! Here comes food!",
      "A little spoon! A little bite! Yum, yum!",
      "Let's taste this! Does it taste good? Mmm, yum!",
      "Food is fun! Let's taste it. Yum, yum!",
      "{name}, it's food time! One little bite. Mmm, yum!",
      "{name}, let's eat! Tiny little bites. Mmm, yummy!"
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

// Web-only neutral drinking fallback; the Android-synced milk reply bank is unchanged.
const DRINK_SCENE = {
  id: 'drink',
  replies: [
    "Ready for a drink? Little sips. How does it taste?",
    "Let's have a drink! Sip, sip! Is it tasty?",
    "Here's a little drink. Take a sip. Yum, yum!",
    "A little drink! Sip, sip! Does that taste good?",
    "Drink time! Let's have a sip. Mmm, yum!",
    "{name}, want a drink? Little sips. Yum, yum!",
    "{name}, here's a drink! Sip, sip! Is it yummy?"
  ],
};

function findScene(id) {
  return id === 'drink' ? DRINK_SCENE : SCENES.find(scene => scene.id === id) || null;
}

export class LiteResponseEngine {
  constructor() {
    this.recentReplies = [];
    this.recentOpeners = [];
    this.turnCounter = 0;
    this.turnsSinceName = STYLE.NAME_REPEAT_WINDOW;
    this.activeSceneId = null;
    this.activeSceneTurnsRemaining = 0;
  }

  respond(transcript, spokenBabyName = "", semantic = null) {
    const normalized = normalize(transcript);
    const flexible = detectFlexibleTopics(transcript);
    const ranked = SCENES.map(scene => [scene, Math.max(score(scene, normalized), flexible[scene.id]?.score || 0)])
      .sort((a, b) => b[1] - a[1]);
    const best = ranked[0];
    const selected = best && best[1] >= 3 ? best : null;
    const rescued = selected ? null : matchPhoneticScene(
      normalizeParentSpeech(transcript),
      Object.fromEntries(SCENES.map(scene => [
        scene.id,
        [
          ...(SCENE_CHILDCARE_ANCHORS[scene.id] || []),
          ...(SCENE_RESCUE_PHRASES[scene.id] || []),
        ],
      ])),
      SCENE_EXCLUSIONS,
    );
    const detectedScene = selected?.[0]
      || (rescued ? SCENES.find(candidate => candidate.id === rescued.sceneId) : null)
      || null;
    const drinking = detectDrinkingAction(transcript);
    const milkScene = findScene('milk');
    const explicitMilk = !!flexible.milk || hasStrongTopicEvidence(milkScene, normalized);
    const drinkingScene = drinking && !explicitMilk
      ? this.activeSceneId === 'milk' && !hasNonMilkDrink(transcript) ? milkScene : DRINK_SCENE
      : null;
    // A bare drinking action overrides weak milk keywords, but not another explicit topic.
    const useDrinkingScene = !!drinkingScene && (!detectedScene || detectedScene.id === 'milk'
      || !hasStrongTopicEvidence(detectedScene, normalized));
    const candidateScene = useDrinkingScene ? drinkingScene : detectedScene;
    const candidateScore = useDrinkingScene ? 4 : selected?.[1] || rescued?.score || 0;
    const candidateHasStrongTopicEvidence = !!candidateScene && (
      useDrinkingScene || !!rescued || !!flexible[candidateScene.id] || hasStrongTopicEvidence(candidateScene, normalized)
    );
    const explicitScene = !candidateScene ? null
      : !this.activeSceneId ? candidateScene
        : candidateScene.id === this.activeSceneId ? candidateScene
          : candidateHasStrongTopicEvidence ? candidateScene
            : null;
    const explicitScore = explicitScene ? candidateScore : 0;
    const contextualScene = !explicitScene && this.activeSceneTurnsRemaining > 0
      ? findScene(this.activeSceneId)
      : null;
    const ruleScene = explicitScene || contextualScene;
    const requested = semantic?.topic === 'generic' ? null : findScene(semantic?.topic);
    const validSemantic = !!semantic && (semantic.topic === 'generic' || !!requested);
    const semanticUsed = validSemantic && (semantic.mode === 'semantic' || (semantic.mode === 'guard' && !ruleScene));
    let scene = semanticUsed ? requested : ruleScene;
    let contextUsed = !semanticUsed && !!contextualScene;
    const plainFollowup = /^(いいね|そうだね|いい感じだね|いい感じですね|気持ちいいね|気持ちいいですね|ゆっくりでいいよ|ゆっくりね|もう少し|もうちょっと|どうかな|上手だね|かわいいね)$/.test(normalized);
    const implicitMilkDrink = useDrinkingScene && drinkingScene?.id==='milk' && this.activeSceneId==='milk' && !explicitMilk && !hasNonMilkDrink(transcript);
    const semanticFollowup = this.activeSceneTurnsRemaining>0 && (plainFollowup || implicitMilkDrink);
    // Clear Semantic evidence can change the topic. Generic/weak predictions
    // consume the same one follow-up turn as the existing rule matcher.
    const semanticClear = !semanticFollowup && !!requested && (
      semantic?.probability == null || (semantic.probability >= 0.65 && semantic.margin >= 0.15)
    );
    const ruleClear = !semanticFollowup && !!explicitScene && candidateHasStrongTopicEvidence;
    let clearScene = null;
    if(semanticUsed) {
      if(!this.activeSceneId || semanticClear)clearScene=requested;
      else if(this.activeSceneTurnsRemaining>0 && ruleClear)clearScene=explicitScene;
    }
    if(semanticUsed) {
      if(clearScene)scene=clearScene;
      else if(this.activeSceneTurnsRemaining>0){scene=findScene(this.activeSceneId);contextUsed=!!scene;}
    }
    const sceneScore = semanticUsed ? contextUsed ? 2 : 0 : explicitScene ? explicitScore : contextualScene ? 2 : 0;

    if (semanticUsed) {
      if(clearScene){this.activeSceneId=clearScene.id;this.activeSceneTurnsRemaining = TOPIC_HOLD_TURNS;}
      else if(contextUsed){
        this.activeSceneTurnsRemaining-=1;
        if(this.activeSceneTurnsRemaining<=0)this.activeSceneId=null;
      }
    } else if (explicitScene) {
      this.activeSceneId = explicitScene.id;
      this.activeSceneTurnsRemaining = TOPIC_HOLD_TURNS;
    } else if (contextualScene) {
      this.activeSceneTurnsRemaining -= 1;
      if (this.activeSceneTurnsRemaining <= 0) this.activeSceneId = null;
    }

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
    return { english: styled, scene: scene?.id || "generic", score: sceneScore, ruleScene: ruleScene?.id || "generic", semanticUsed, contextUsed };
  }

  respondGeneric(spokenBabyName = "") {
    const safeName = sanitizeName(spokenBabyName);
    const forceName = !!safeName && this.turnsSinceName >= STYLE.NAME_REPEAT_WINDOW;
    const suppressName = !!safeName && this.turnsSinceName < STYLE.NAME_REPEAT_WINDOW;
    const raw = this.chooseReply(GENERIC_REPLIES, "", forceName, suppressName);
    const named = applyName(raw, safeName, forceName);
    const styled = this.alignToBabyStyle(named, "", null);

    this.remember(raw, styled);
    this.turnsSinceName = safeName && containsName(styled, safeName)
      ? 0 : this.turnsSinceName + 1;
    this.turnCounter++;
    return { english: styled, scene: "generic", score: 0, ruleScene: "generic", semanticUsed: false, contextUsed: false };
  }

  // Roll back a speculative reply if the parent continues speaking.
  // History, name repetition and the one-turn topic hold all belong to
  // completed spoken replies, not to discarded preparation attempts.
  snapshotTurnState() {
    return {
      recentReplies:[...this.recentReplies],
      recentOpeners:[...this.recentOpeners],
      turnCounter:this.turnCounter,
      turnsSinceName:this.turnsSinceName,
      activeSceneId:this.activeSceneId,
      activeSceneTurnsRemaining:this.activeSceneTurnsRemaining
    };
  }
  restoreTurnState(snapshot) {
    if(!snapshot)return;
    this.recentReplies=[...snapshot.recentReplies];
    this.recentOpeners=[...snapshot.recentOpeners];
    this.turnCounter=snapshot.turnCounter;
    this.turnsSinceName=snapshot.turnsSinceName;
    this.activeSceneId=snapshot.activeSceneId;
    this.activeSceneTurnsRemaining=snapshot.activeSceneTurnsRemaining;
  }

  resetConversationContext() {
    this.activeSceneId = null;
    this.activeSceneTurnsRemaining = 0;
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

function hasStrongTopicEvidence(scene, transcript) {
  const strongPhrases=[
    ...(SCENE_CHILDCARE_ANCHORS[scene.id] || []),
    ...(SCENE_HINTS[scene.id] || []),
  ];
  return strongPhrases
    .map(normalize)
    .filter(Boolean)
    .some(phrase=>transcript.includes(phrase));
}

function score(scene, transcript) {
  const anchors = (SCENE_CHILDCARE_ANCHORS[scene.id] || []).map(normalize).filter(Boolean);
  const hints = (SCENE_HINTS[scene.id] || []).map(normalize).filter(Boolean);
  const exclusions = (SCENE_EXCLUSIONS[scene.id] || []).map(normalize).filter(Boolean);
  const anchorMatches = anchors.filter(x => transcript.includes(x)).length;
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

  if (anchorMatches > 0) total = Math.max(total, 6 + Math.min(2, anchorMatches - 1));
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
  return normalizeParentSpeech(text)
    .replace(/[\s、。！？!?,.・「」『』（）()〜~]/g, "")
    .replaceAll("おふろ", "お風呂")
    .replaceAll("お風呂", "風呂")
    .replaceAll("ねよっか", "寝よっか")
    .replace(/(?<!かさ|重|たず|尋|訪|は|跳|ま|真)ねよう/g, "寝よう")
    .replace(/(?<![ぁ-ん一-龯])ねる/g, "寝る")
    .replace(/(?<!かさ|重|たず|尋|訪|は|跳|ま|真)ねます/g, "寝ます")
    .replace(/(?<!かさ|重|たず|尋|訪|は|跳|ま|真)ねて/g, "寝て")
    .replace(/(?<!かさ|重|たず|尋|訪|は|跳|ま|真)ねた/g, "寝た");
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
