import { selectRuriAxes, combinedCandidates } from './interaction/ruri-routing.js';
import { selectInteraction, INTERACTION_REPLIES } from './interaction/response.js';
import { matchPhoneticScene } from './lite-phonetic-scene-matcher.js';
import { detectFlexibleTopics, normalizeParentSpeech, detectDrinkingAction, hasNonMilkDrink, detectNounTopics } from './lite-topic-matcher.js';

// A detected topic may be carried into at most one subsequent ambiguous turn.
const TOPIC_HOLD_TURNS = 1;

// Reply bank and style synced from Android Emma LiteResponseEngine.kt / LiteSpeechStyle.kt.
// Android source commit: 91c5bc86fa343ec688e489415052af5f8adf6fa3
// Do not hand-edit the reply bank independently from Android.
const STYLE = {
  "MIN_WORDS": 6,
  "MAX_WORDS": 12,
  "MIN_SENTENCES": 3,
  "MAX_SENTENCES": 3,
  "MAX_WORDS_PER_SENTENCE": 4,
  "NAME_REPEAT_WINDOW": 2
};
// Curated baby-directed English, synced from Android. Play Topics has an
// independent one/three-sentence phrase catalog.
const GENERIC_REPLIES = [
  "Hello, sweet baby! You're so loved. I'm right here.",
  "Hi, little one! It's nice being together. Hello again!",
  "Look at you! What a sweet face. I'm glad you're here!",
  "You're very special. I'm happy you're here. Hello, sweetheart!",
  "Hello again, baby! It's lovely seeing you. Shall we say hello?",
  "You're my little sunshine. I love you. Big hugs!",
  "Can you hear me? It's my voice. Hello there!",
  "Let's say hello! Hi, little one! Hello again!",
  "I'm glad we're together. Let's spend time here. Hello, sweetie!",
  "Hello, sweetheart! Look at my face. Here I am!",
  "Shall we talk? I'm listening, baby. Your turn!",
  "Tell me more! I'm listening to you. Hello, baby!",
  "You're so precious. I love you lots. Big hugs!",
  "Hi there, baby! It's lovely seeing you. Hello!",
  "Hello, little one! Can you hear me? Hi there!",
  "Let's make a sound! Ba, ba, ba! Your turn!",
  "One, two, three! Let's count together. Shall we go again?",
  "Shall we wave hello? Hi, hi, hi! Here comes my hand!",
  "Look at my hands! Let's wave hello. Hi, hi!",
  "Let's say good morning! Hello, sweet baby. Hi there!",
  "You're my sweet baby. I'm here with you. Big hugs!",
  "Can you see me? Here I am! Hello, hello!",
  "What do you think? Tell me, little one. I'm listening!",
  "Do you hear that? That's my voice! Hello, baby!",
  "{name}, hello there! I'm here with you. Big hugs!",
  "{name}, my sweetheart! You're so loved. Hello, baby!",
  "{name}, look here! It's me again. Hello there!",
  "{name}, how are you? I'm listening, baby. Your turn!",
  "{name}, my little star! I love you. Hello, sweetheart!",
  "{name}, hello again! I'm happy you're here. Big hugs!"
];
const NEUTRAL_CLOSERS = [
  "You are wonderful!",
  "You are loved.",
  "I'm right here.",
  "Hello, hello!",
  "Look with me.",
  "Listen with me."
];
const SCENE_FILLERS = {
  "bath": [
    "Splash, splash!",
    "Let's get clean!"
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
    "Let's change you!",
    "All fresh!"
  ],
  "clothes": [
    "Let's get dressed!",
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
    "I'm with you."
  ],
  "play": [
    "Look, look!",
    "Let's have fun!"
  ],
  "outside": [
    "Look around!",
    "What do you see?"
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
      "Bath time is here! Is the water warm? Splash, splash!",
      "Let's wash your hands. One, then the other. All clean!",
      "Your little toes! Let's wash them gently. Splash, splash!",
      "Feel the warm water. Can you hear it? Splish, splash!",
      "We're taking a bath. Listen to the water. Splash, splash!",
      "Let's wash your tummy. A little splash. There you go!",
      "{name}, bath time! Feel the warm water. Splash, splash!",
      "{name}, look! Water on your toes. Splish, splash!"
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
      "Here's your milk! Ready for a sip? Here you go!",
      "Can you taste it? A little milk. Mmm, yummy!",
      "Milk for you! One little sip. Then another!",
      "Are you still hungry? We can have more. I'm here!",
      "It's milk time! Take little sips. I'm here with you.",
      "Milk time! Are you hungry? Let's have some!",
      "{name}, your milk! Here's a little sip. Mmm, yummy!",
      "{name}, milk time! Take a little sip. I'm here!"
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
      "Are you sleepy? Let's get cozy. Night-night!",
      "Time to rest. Let's get cozy now. I'll stay close.",
      "Let's close our eyes. I'll stay nearby. Sleep well!",
      "Shh, little one. Let's have quiet time. I'm right here.",
      "Getting sleepy? I'll stay with you. Rest well!",
      "Rest well, baby. I'll stay close by. Sweet dreams!",
      "{name}, sleep well. I'm right here. Sweet dreams!",
      "{name}, night-night! Let's get cozy. Rest well!"
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
      "You're awake! Hello, little one. It's nice seeing you!",
      "Your eyes are open! Hello, little one. How are you?",
      "Look who's awake! How are you? Hello, little one!",
      "Hello again! Did you rest well? I'm glad you're awake.",
      "Look who's awake! Did you rest well? Hello there!",
      "Hello there! You're awake now. Let's say hello!",
      "{name}, you're awake! How was your rest? Hello, sweetheart!",
      "{name}, you're awake! How are you? Hello again!"
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
      "Time for a change. Let's get you dry. All fresh!",
      "New diaper time! Let's wipe your bottom. All clean!",
      "Let's change your diaper. One little wipe. All fresh!",
      "Off comes your diaper. Let's clean you up. There!",
      "Let's change your diaper. I'll be gentle. Nice and fresh!",
      "Diaper change! I'll be gentle. You're doing great!",
      "{name}, diaper time! Let's get you clean. All fresh!",
      "{name}, let's change you. One little wipe. All clean!"
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
      "Let's put clothes on. One arm first. Other arm next!",
      "Your little shirt! Let's put it on. One arm goes in!",
      "Here come your socks. One little foot. Then another!",
      "Time to get dressed. Arms through the sleeves. All ready!",
      "Let's change your clothes. This arm first. There you go!",
      "Look at your clothes! Shall we get dressed? One arm first!",
      "{name}, clothes on! One arm in. Looking lovely!",
      "{name}, let's get dressed. Socks on next. All ready!"
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
      "Come here, baby. Let's have a cuddle. Big hugs!",
      "Up you go! Into my arms. I've got you!",
      "A little cuddle? I'll hold you close. So cozy!",
      "Let's have a hug. Close to my heart. I love you!",
      "Here are my arms. Come close, sweetheart. Big hug!",
      "Hug time! You're warm and cozy. I'm here!",
      "{name}, come here! A big warm hug. I love you!",
      "{name}, cuddle time! I'll hold you close. So cozy!"
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
      "Look at your hands! Ten tiny fingers. Wiggle, wiggle!",
      "Open your hands. Close them again. Good job!",
      "Those little fingers! Can you wiggle them? Wiggle, wiggle!",
      "Here's your little hand. Hold my finger. So tiny!",
      "One hand, two hands! Let's wave hello. Hi there!",
      "Your fingers are moving! Open and close. Look at that!",
      "{name}, tiny hands! Hold my finger. Hello there!",
      "{name}, look! Your hands are moving. Wiggle, wiggle!"
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
      "Look at your feet! Ten tiny toes. Wiggle, wiggle!",
      "Kick those little legs! Kick, kick! Look at you!",
      "Your toes are moving! One, two, three. So tiny!",
      "Let's count your toes. One, two, three. More to go!",
      "Little feet up! Little feet down! Kick, kick!",
      "Can you kick? There go your feet! Good job!",
      "{name}, little feet! Kick, kick! Look at you!",
      "{name}, tiny toes! Wiggle those feet. So cute!"
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
      "What a smile! I love seeing it. You're so sweet!",
      "There's your smile! I love seeing it. So sweet!",
      "You're smiling! That makes me smile. Thank you!",
      "Such a big smile! Your cheeks look lovely. Hello, baby!",
      "I see a smile! Are you happy? I am too!",
      "Hello, little smiler! That's a lovely grin. I see you!",
      "{name}, that smile! You make me happy. Hello, sweetheart!",
      "{name}, you're smiling! I love that smile. So sweet!"
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
      "I hear you crying. I'm right here. You're not alone.",
      "Are you feeling upset? I'm listening, baby. I'm right here.",
      "Are you upset? I'll stay close. Would you like cuddles?",
      "I hear you crying. Would a cuddle help? I'm here.",
      "Are you upset? I'm here with you. Big hugs!",
      "You can cry. I'll stay beside you. I love you.",
      "{name}, I'm here. I hear you crying. Big hugs!",
      "{name}, it's okay. I'm listening to you. I'm here!"
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
      "I hear your voice! Tell me more. I'm listening!",
      "Are you talking? Hello, little one. Your turn!",
      "What a lovely sound! Say it again. I'm listening!",
      "Ooh, ahh! I hear you! Hello there!",
      "You're making sounds! I love your voice. Talk to me!",
      "Was that a coo? I heard you! Hello, baby!",
      "{name}, I hear you! Tell me more. I'm listening!",
      "{name}, your voice! I love hearing it. Hello, sweetheart!"
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
      "How's your tummy? Do you feel full? I'm here!",
      "Let's pat your back. Maybe a little burp. There!",
      "Your little tummy! Let's have a cuddle. So cozy!",
      "Is that a burp? Let's take it slowly. I'm right here.",
      "Let's get comfortable. I'll hold you close. Big hugs!",
      "Full tummy? We can rest now. I'm right here.",
      "{name}, little tummy! Let's get comfortable. Big hugs!",
      "{name}, feeling full? I'll hold you close. So cozy!"
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
      "Let's play together! What should we try? Peekaboo!",
      "Here's your toy! Can you see it? Look here!",
      "Ready to play? Shall we start together? Here's a little game!",
      "Peekaboo! Where did I go? Here I am!",
      "Let's shake the rattle. Can you hear it? Shake, shake!",
      "Look at this toy! It's here for you. Let's play!",
      "{name}, let's play! Here's your toy. Look at that!",
      "{name}, peekaboo! Where am I? Here I am!"
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
      "Let's go outside! Look at the sky. What do you see?",
      "Fresh air outside! Can you feel it? Hello, world!",
      "Time for a stroll. Let's look around. What's over there?",
      "We're going outside! Let's look all around. What do you see?",
      "Look up, baby! There's the sky. So big!",
      "Out we go! What can you hear? Let's listen!",
      "{name}, outside time! Look at the sky. Hello, world!",
      "{name}, let's stroll! What can you see? Look around!"
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
      "Rain is falling! Can you hear it? Pitter-patter!",
      "Listen to the rain. Drip, drop! Drip, drop!",
      "Rain on the window! Tap, tap, tap. Can you hear?",
      "It's raining outside. Look at the drops. Drip, drop!",
      "The rain sounds soft. Listen with me. Pitter-patter!",
      "Raindrops are falling. Listen to their sound. Drip, drop!",
      "{name}, it's raining! Listen to the drops. Drip, drop!",
      "{name}, hear that? It's the rain. Pitter-patter!"
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
      "The sun is shining! What a bright day. Hello, sunshine!",
      "Look at the sunlight! It's bright outside. So lovely!",
      "Hello, sunshine! The sky is bright. Look up!",
      "A sunny day! Let's look outside. Can you see?",
      "See the bright sky? The sun is out. Hello, sunshine!",
      "Look at the sunshine! Can you see it? So bright!",
      "{name}, it's sunny! Look at the light. So bright!",
      "{name}, sunshine today! The sky is bright. Hello, sunshine!"
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
      "Time for a bite! Here's your spoon. Open wide!",
      "Let's try some food. One little bite. How is it?",
      "Ready to eat? A little spoonful. There you go!",
      "Do you like it? Want another bite? No need to hurry.",
      "Here's a little bite. Let's taste it. Mmm, yummy!",
      "All done eating? Shall we wipe up? You did well!",
      "{name}, food time! One little spoonful. Is it yummy?",
      "{name}, let's eat! Here's your spoon. Open wide!"
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
      "Let's read a book! Look at the pictures. What's that?",
      "Here's your book! Turn the page. What comes next?",
      "Look at this picture! What can you see? Let's look together!",
      "One more page! Let's see what's there. Turn, turn!",
      "Story time! Listen to my voice. Here comes a story!",
      "Let's look together. See that picture? What do you notice?",
      "{name}, book time! Look at the pictures. What's that?",
      "{name}, let's read! Turn the page. What comes next?"
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
      "Let's sing together! La, la, la! Your turn!",
      "Listen to the music. Can you hear it? Tap, tap!",
      "Here's a little song. Listen with me. La, la!",
      "Hear the music? Tap, tap! Let's sing!",
      "Let's make some music! Clap, clap! What fun!",
      "A song for you! La, la, la! Sing with me!",
      "{name}, let's sing! La, la, la! Your turn!",
      "{name}, hear that song? Let's listen together. Tap, tap!"
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
    "Would you like some? Here's a little sip. There you go!",
    "Here's your drink! Ready for a sip? Here you are!",
    "Drink time! One little sip. How does it taste?",
    "Want a little sip? Here's your drink. Sip if you like!",
    "Want another sip? No need to hurry. Here you go!",
    "{name}, your drink! Here's a little sip. There you go!",
    "{name}, thirsty? Let's have a drink. Sip when you're ready!"
  ],
};

function findScene(id) {
  return id === 'drink' ? DRINK_SCENE : SCENES.find(scene => scene.id === id) || null;
}

// Expose the complete baked bank for regression checks. "Press to listen" phrases
// live in shared/play-topics.json and are validated independently.
export function allLiteReplyTemplatesForValidation() {
  return [...GENERIC_REPLIES, ...SCENES.flatMap(scene => scene.replies), ...DRINK_SCENE.replies];
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

  // Sole live classification path: Topic and Interaction labels come exclusively
  // from their independent Ruri linear heads. Legacy respond() remains only for
  // diagnostic comparison of the old rule engine, never for live Lite playback.
  respondRuri(transcript, spokenBabyName = "", topicPrediction = null, interactionPrediction = null, allowInteraction = true) {
    const { topic, interaction } = selectRuriAxes(topicPrediction, interactionPrediction, allowInteraction);
    const scene = findScene(topic);
    const pair = scene && interaction ? combinedCandidates(scene.id, interaction) : null;
    const replies = pair || scene?.replies || (interaction ? INTERACTION_REPLIES[interaction] : null)
      || GENERIC_REPLIES;
    const route = pair ? `combined:${scene.id}:${interaction}`
      : scene?.id || (interaction ? `interaction:${interaction}` : 'generic');
    // The current utterance's Ruri result is authoritative: stale context never
    // overrides a new label and cannot cause fabricated composite replies.
    this.activeSceneId = null;
    this.activeSceneTurnsRemaining = 0;
    const safeName = sanitizeName(spokenBabyName);
    const allowName = !interaction && !pair;
    const forceName = allowName && !!safeName && this.turnsSinceName >= STYLE.NAME_REPEAT_WINDOW;
    const suppressName = allowName && !!safeName && this.turnsSinceName < STYLE.NAME_REPEAT_WINDOW;
    const raw = this.chooseReply(replies, transcript, forceName, suppressName);
    const named = allowName ? applyName(raw, safeName, forceName) : raw;
    const styled = this.alignToBabyStyle(named, transcript, scene?.id);
    this.remember(raw, styled);
    this.turnsSinceName = safeName && containsName(styled, safeName) ? 0 : this.turnsSinceName + 1;
    this.turnCounter++;
    return {
      english: styled, scene: route, topic: scene?.id || null,
      interaction: interaction || null, combined: !!pair, score: 0,
      ruleScene: 'unused', semanticUsed: true, contextUsed: false
    };
  }

  respond(transcript, spokenBabyName = "", semantic = null, interaction = null) {
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
    // An explicit current childcare topic outranks an Interaction label. Held
    // context does not outrank a new, clear compliment or question.
    const interactionId = selectInteraction(transcript, interaction, candidateHasStrongTopicEvidence);
    if (interactionId) return this.respondInteraction(interactionId, normalized);

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

  respondInteraction(id, normalized) {
    // This is a different utterance; never let the previous Topic bleed into it.
    this.activeSceneId = null;
    this.activeSceneTurnsRemaining = 0;
    const raw = this.chooseReply(INTERACTION_REPLIES[id], normalized, false, false);
    this.remember(raw, raw);
    this.turnsSinceName++;
    this.turnCounter++;
    return { english: raw, scene: 'interaction:' + id, score: 0, ruleScene: 'generic', semanticUsed: true, contextUsed: false, interactionUsed: true };
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
