import { phoneticKey } from './lite-phonetic-scene-matcher.js';

// Normalize known childcare actions, not every occurrence of a Japanese syllable.
// The reply bank remains shared with Android; this module only detects topics.
export function normalizeParentSpeech(text) {
  let value = String(text || '').normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[\s、。！？!?,.・「」『』（）()【】\[\]〜~]/g, '');
  for (const [stems, action] of POLITE_ACTIONS) {
    const alternatives = stems.map(stem => stem === 'ね' ? '(?<!かさ|重|たず|尋|訪|は|跳|ま|真)ね'
      : stem === 'おき' ? '(?<!て|で)おき'
        : stem === 'のみ' ? '(?<!た|こ|好|頼)のみ' : stem);
    value = value.replace(new RegExp(`(?:${alternatives.join('|')})(?:ましょう|ませんか|ました|ます)`, 'g'), action);
  }
  return value
    .replace(/(?:寝|(?<!かさ|重|は|跳)ね)ちゃ(?:った|う)/g, '寝た')
    .replace(/(?:泣|な)いちゃ(?:った|う)/g, '泣いた')
    .replaceAll('わらって', '笑って')
    .replaceAll('わらった', '笑った')
    .replaceAll('ねむく', '眠く')
    .replaceAll('ねむそう', '眠そう')
    .replaceAll('はれて', '晴れて');
}

const POLITE_ACTIONS = [
  [['寝', 'ね'], '寝よう'], [['眠り', 'ねむり'], '眠ろう'],
  [['起き', 'おき'], '起きよう'], [['食べ', 'たべ'], '食べよう'],
  [['飲み', 'のみ'], '飲もう'], [['読み', 'よみ'], '読もう'],
  [['遊び', 'あそび'], '遊ぼう'], [['歌い', 'うたい'], '歌おう'],
  [['踊り', 'おどり'], '踊ろう'],
];

// Keep the object unspecified when only the action of drinking is stated.
export function detectDrinkingAction(text) {
  const value = normalizeParentSpeech(text);
  if (/(?:飲み会|飲会|のみかい|飲酒|酒|ビール|びーる|服薬|薬|くすり)/.test(value)) return false;
  return /飲(?:む|もう|みたい|みたが|んだ|んで|めた|める)/.test(value)
    || /(?:^|そろそろ|もう|少し|すこし|いっぱい|ゆっくり|ひとくち|一口|を)(?:のむ|のもう|のみたい|のんだ|のんで|のめた|のめる)/.test(value);
}

export function hasNonMilkDrink(text) {
  return /(?:水|みず|お茶|おちゃ|麦茶|むぎちゃ|白湯|さゆ|ジュース|じゅーす|飲み物|のみもの)/.test(normalizeParentSpeech(text));
}

// Short topic nouns use lexical boundaries, rather than requiring an action.
// Kana nouns need a boundary or a common pointing/possessive phrase before them.
const NOUN_END = '(?:$|だ|です|ね|よ|を|が|は|も|に|で|の|と|って|ちゃん)';
const KANA_START = '(?:(?<![ぁ-ん])|この|その|あの|かわいい|ちいさな|小さな|あなたの|きみの|赤ちゃんの)';
const NOUN_TOPICS = {
  hands: new RegExp(`(?:(?<!\\p{Script=Han})(?:両手|手|指)|${KANA_START}ゆび|(?:^|この|その|あの|かわいい|ちいさな|小さな|あなたの|きみの|赤ちゃんの)て)${NOUN_END}`, 'u'),
  feet: new RegExp(`(?:(?<!\\p{Script=Han})(?:両足|足)|${KANA_START}あし(?!た|ら|あと|もと|おと|ば|なみ|どり))${NOUN_END}`, 'u'),
  voice: new RegExp(`(?:(?<!\\p{Script=Han})声|${KANA_START}こえ)${NOUN_END}`, 'u'),
  book: new RegExp(`(?:(?<!\\p{Script=Han})本|${KANA_START}ほん)${NOUN_END}`, 'u'),
  clothes: new RegExp(`(?:(?<!\\p{Script=Han})服|${KANA_START}ふく)${NOUN_END}`, 'u'),
  music: new RegExp(`(?:(?<!\\p{Script=Han})歌|${KANA_START}うた(?!がう|がっ|がい))${NOUN_END}`, 'u'),
  tummy: new RegExp(`(?:お腹|おなか)${NOUN_END}`, 'u'),
};

export function detectNounTopics(text) {
  const value = normalizeParentSpeech(text);
  return Object.fromEntries(Object.entries(NOUN_TOPICS)
    .filter(([scene, pattern]) => pattern.test(value)
      // Hunger is food; a bare tummy mention must not override it.
      && !(scene === 'tummy' && /(?:お腹|おなか)(?:が|も)?(?:すい|空い|減|へっ)/.test(value)))
    .map(([scene]) => [scene, { score: 6, kind: 'topic-noun' }]));
}

// Fuzzy matches use distinctive topic words plus an independent action.
// Invitation endings such as "しよう" are never fuzzy topic evidence themselves.
const TOPICS = {
  bath: { words: ['お風呂', '風呂', '沐浴', '湯船', 'シャワー'], actions: ['入ろ', '入る', '入り', '洗', 'あらう', 'あらお'] },
  milk: { words: ['ミルク', '母乳', 'おっぱい', '哺乳瓶', '授乳'], actions: ['飲', 'のも', 'のむ', 'のん', 'にしよう'] },
  sleep: { words: ['ねんね', 'おやすみ', '昼寝', '睡眠', '就寝'], actions: ['しよう', '時間', 'じかん'] },
  wake: { words: ['おはよう', '目覚め'], actions: ['起き', 'おき'] },
  diaper: { words: ['おむつ', 'うんち', 'おしっこ'], actions: ['替', '変え', 'かえ', '出', 'でた', 'した'] },
  clothes: { words: ['着替え', '洋服', 'パジャマ', '靴下'], actions: ['着', 'きま', 'きよ', '脱', 'ぬご', 'はこ'] },
  hug: { words: ['抱っこ', '抱きしめ', 'ぎゅー'], actions: ['しよう', 'する', 'して'] },
  hands: { words: ['おてて'], actions: ['握', 'にぎ', 'つか', 'ばた'] },
  feet: { words: ['あんよ', 'キック', 'つま先'], actions: ['動', 'うご', 'ばた', '蹴', 'けっ'] },
  smile: { words: ['にこにこ', '笑顔', 'にこっ'], actions: ['笑', 'わら', 'して'] },
  cry: { words: ['ぐずぐず', 'えーん'], actions: ['泣', 'して'] },
  voice: { words: ['おしゃべり', '喃語', 'クーイング'], actions: ['出', 'でた', 'して', '話', 'はな'] },
  tummy: { words: ['げっぷ', '吐き戻し', 'お腹いっぱい', '満腹'], actions: ['出', 'でた', 'した', 'しちゃ'] },
  play: { words: ['おもちゃ', 'ガラガラ', 'ぬいぐるみ', 'メリー'], actions: ['遊', 'あそ', '振', 'ふっ'] },
  outside: { words: ['散歩', 'ベビーカー', '公園', 'お外'], actions: ['行', 'いこ', 'いく', '乗', 'のろ', '出かけ', 'でかけ'] },
  rain: { words: ['雨', 'あめ', '雨音'], actions: ['降', 'ふっ', 'ふる', '聞', 'きこ'] },
  sun: { words: ['晴れ', '太陽', 'お日様', 'ぽかぽか'], actions: ['出', 'でて', 'して'] },
  food: { words: ['ごはん', '離乳食', 'スプーン', 'いただきます'], actions: ['食', 'たべ', 'にしよう'] },
  book: { words: ['絵本', 'ページ'], actions: ['読', 'よも', 'よみ', 'めく', '見', 'みよ'] },
  music: { words: ['音楽', 'リズム'], actions: ['聞', 'きこ', '歌', 'うた', '踊', 'おど'] },
};

// Object and action can be separated by particles, with any following conjugation.
const ACTION_PAIRS = {
  sleep: /(?:^|そろそろ|もう|早く|はやく)(?:ねる|ねて|ねた|ねよう)/,
  cry: /(?:^|また|もう|いっぱい)(?:ないて|ないた|なき)/,
  bath: /(?:体|からだ)(?:を|も)?(?:洗|あら)/,
  wake: /(?:目|め)(?:を|が)?(?:覚ま|さま)/,
  clothes: /(?:洋服|ようふく|服|ふく)(?:を|も)?(?:着|きま|きよ|脱|ぬ)/,
  hands: /(?:手|て|指|ゆび)(?:を|が|で|に|も)?(?:握|にぎ|つか|ばた)/,
  feet: /(?:足|あし)(?:を|が|で|も)?(?:動|うご|蹴|けっ|ばた)/,
  voice: /(?:声|こえ)(?:を|が|も)?(?:出|だ)/,
  food: /(?:お腹|おなか)(?:が|も)?(?:すい|空い|減|へっ)/,
  book: /(?:本|ほん)(?:を|も)?(?:読|よも|よみ)/,
};

const EXCLUSIONS = {
  bath: ['風呂敷', 'ふろしき'], sleep: ['寝返り', 'ねがえり', '重ね', 'かさね'],
  hands: ['手伝', 'てつだ', '手続', 'てつづ', '手紙', 'てがみ', '手数'],
  feet: ['足り', 'たり', '足す', 'たす', '足し'],
  voice: ['声優', 'せいゆう'], music: ['歌舞伎', 'かぶき', 'うたがう', 'うたがっ', 'うたがい'],
};

const prepared = Object.entries(TOPICS).map(([scene, topic]) => ({
  scene,
  words: topic.words.map(word => ({ word, key: phoneticKey(normalizeParentSpeech(word)),
    fullTsu: word.includes('っ') ? phoneticKey(normalizeParentSpeech(word.replaceAll('っ', 'つ'))) : null,
  })),
  actions: topic.actions.map(normalizeParentSpeech),
  exclusions: (EXCLUSIONS[scene] || []).map(normalizeParentSpeech),
}));

export function detectFlexibleTopics(transcript) {
  const text = normalizeParentSpeech(transcript);
  const sound = phoneticKey(text);
  const evidence = detectNounTopics(transcript);
  const fuzzy = [];
  for (const topic of prepared) {
    if (evidence[topic.scene]) continue;
    if (topic.exclusions.some(word => text.includes(word))) continue;
    if (ACTION_PAIRS[topic.scene]?.test(text)) {
      evidence[topic.scene] = { score: 6, kind: 'object-action' };
      continue;
    }
    const supported = topic.scene === 'voice'
      ? /(?:出|でた|して|話|はな(?:す|し|そ)|しゃべ)/.test(text)
      : topic.actions.some(action => text.includes(action));
    for (const { word, key, fullTsu } of topic.words) {
      // Exact reading matches cover kanji/kana spellings independently of the ASR output.
      if (key.length >= 3 ? sound.includes(key) : text.includes(normalizeParentSpeech(word)) || sound === key) {
        evidence[topic.scene] = { score: 6, kind: 'topic-word', word };
        break;
      }
      if (supported && fullTsu && sound.includes(fullTsu)) {
        fuzzy.push({ scene: topic.scene, score: 5, kind: 'phonetic-topic', word, confidence: .9 });
        continue;
      }
      if (key.length < 3 || (!supported && key.length < 5)) continue;
      const confidence = windowSimilarity(sound, key);
      const minimum = supported ? (key.length <= 3 ? 2 / 3 : .74) : .8;
      if (confidence + 1e-9 >= minimum) {
        fuzzy.push({ scene: topic.scene, score: supported ? 5 : 4, kind: 'phonetic-topic', word, confidence });
      }
    }
  }
  // A clear exact topic always wins over speculative corrections to another word.
  if (!Object.keys(evidence).length && fuzzy.length) {
    const ranked = [...new Set(fuzzy.map(x => x.scene))].map(scene =>
      fuzzy.filter(x => x.scene === scene).sort((a, b) => b.confidence - a.confidence)[0]
    ).sort((a, b) => b.confidence - a.confidence);
    if (ranked.length === 1 || ranked[0].confidence - ranked[1].confidence >= .08) {
      evidence[ranked[0].scene] = ranked[0];
    }
  }
  return evidence;
}

function windowSimilarity(source, target) {
  let best = 0;
  // Topic words tolerate one edit; longer words can tolerate two.
  const edits = target.length >= 7 ? 2 : 1;
  for (let size = Math.max(3, target.length - edits); size <= target.length + edits; size++) {
    for (let start = 0; start + size <= source.length; start++) {
      const word = source.slice(start, start + size);
      let row = Array.from({ length: target.length + 1 }, (_, i) => i);
      for (let i = 0; i < word.length; i++) {
        const next = [i + 1];
        for (let j = 0; j < target.length; j++) {
          next[j + 1] = Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (word[i] === target[j] ? 0 : 1));
        }
        row = next;
      }
      if (row[target.length] <= edits) best = Math.max(best, 1 - row[target.length] / Math.max(word.length, target.length));
    }
  }
  return best;
}
