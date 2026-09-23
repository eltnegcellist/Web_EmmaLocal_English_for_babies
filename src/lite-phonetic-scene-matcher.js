// AUTO-SYNCED from Android LitePhoneticSceneMatcher.kt.
// Android source commit: c8e3eea90d9ab975652064d25a9907ed1822def4

export function matchPhoneticScene(transcript, scenePhrases, sceneExclusions = {}) {
  const source = phoneticKey(transcript);
  if (source.length < MIN_SOURCE_LENGTH) return null;

  const plainTranscript = plainNormalize(transcript);
  const ranked = Object.entries(scenePhrases)
    .map(([sceneId, phrases]) => {
      const excluded = (sceneExclusions[sceneId] || []).some(exclusion => {
        const plainExclusion = plainNormalize(exclusion);
        return plainExclusion && plainTranscript.includes(plainExclusion);
      });
      if (excluded) return null;

      let best = null;
      for (const phrase of phrases) {
        const key = phoneticKey(phrase);
        if (key.length < MIN_CANDIDATE_LENGTH) continue;
        const candidate = {
          sceneId,
          confidence: bestWindowSimilarity(source, key),
          matchedPhrase: phrase,
          keyLength: key.length,
        };
        if (!best || candidate.confidence > best.confidence) best = candidate;
      }
      return best;
    })
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence);

  const best = ranked[0];
  if (!best) return null;

  const requiredConfidence = best.keyLength >= 7 ? 0.72
    : best.keyLength >= 5 ? 0.76
      : 0.82;
  if (best.confidence < requiredConfidence) return null;

  const runnerUp = ranked[1]?.confidence || 0;
  if (best.confidence - runnerUp < MIN_CONFIDENCE_MARGIN) return null;

  return {
    sceneId: best.sceneId,
    confidence: best.confidence,
    score: Math.max(MIN_RESCUE_SCORE, Math.round(best.confidence * 10)),
    matchedPhrase: best.matchedPhrase,
  };
}

export function phoneticKey(text) {
  let value = plainNormalize(text);

  for (const [from, to] of SPEECH_ALIASES) {
    value = value.replaceAll(from, to);
  }

  value = [...value].map(katakanaToHiragana).join('');
  value = value.normalize('NFD')
    .replace(/[\u3099\u309A]/g, '')
    .replaceAll('ぁ', 'あ')
    .replaceAll('ぃ', 'い')
    .replaceAll('ぅ', 'う')
    .replaceAll('ぇ', 'え')
    .replaceAll('ぉ', 'お')
    .replaceAll('ゃ', 'や')
    .replaceAll('ゅ', 'ゆ')
    .replaceAll('ょ', 'よ')
    .replaceAll('ゎ', 'わ')
    .replaceAll('っ', '')
    .replaceAll('ー', '');

  return value;
}

function plainNormalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s、。！？!?,.・「」『』（）()【】\[\]ー〜~]/g, '');
}

function katakanaToHiragana(ch) {
  const code = ch.codePointAt(0);
  return code >= 0x30A1 && code <= 0x30F6
    ? String.fromCodePoint(code - 0x60)
    : ch;
}

function bestWindowSimilarity(source, target) {
  if (source.includes(target)) return 1.0;
  if (target.includes(source) && source.length >= MIN_CANDIDATE_LENGTH) {
    return source.length / target.length;
  }

  const minLength = Math.max(MIN_CANDIDATE_LENGTH, target.length - WINDOW_LENGTH_TOLERANCE);
  const maxLength = Math.min(source.length, target.length + WINDOW_LENGTH_TOLERANCE);
  let best = similarity(source, target);

  if (minLength > maxLength) return best;

  for (let windowLength = minLength; windowLength <= maxLength; windowLength++) {
    if (windowLength > source.length) continue;
    for (let start = 0; start <= source.length - windowLength; start++) {
      const window = source.slice(start, start + windowLength);
      best = Math.max(best, similarity(window, target));
      if (best >= 1.0) return 1.0;
    }
  }
  return best;
}

function similarity(left, right) {
  if (left === right) return 1.0;
  const denominator = Math.max(left.length, right.length);
  if (!denominator) return 1.0;
  return 1.0 - levenshtein(left, right) / denominator;
}

function levenshtein(left, right) {
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  let current = new Array(right.length + 1).fill(0);

  for (let i = 0; i < left.length; i++) {
    current[0] = i + 1;
    for (let j = 0; j < right.length; j++) {
      const substitution = previous[j] + (left[i] === right[j] ? 0 : 1);
      current[j + 1] = Math.min(
        current[j] + 1,
        previous[j + 1] + 1,
        substitution,
      );
    }
    [previous, current] = [current, previous];
  }

  return previous[right.length];
}

const SPEECH_ALIASES = [
  ['お風呂', 'おふろ'],
  ['風呂', 'ふろ'],
  ['お袋', 'おふろ'],
  ['年々', 'ねんね'],
  ['使用', 'しよう'],
  ['睡眠', 'すいみん'],
  ['就寝', 'しゅうしん'],
  ['昼寝', 'ひるね'],
  ['寝', 'ね'],
  ['眠', 'ねむ'],
  ['起', 'お'],
  ['目覚', 'めざ'],
  ['着替', 'きが'],
  ['洋服', 'ようふく'],
  ['服', 'ふく'],
  ['靴下', 'くつした'],
  ['抱っこ', 'だっこ'],
  ['抱', 'だ'],
  ['手', 'て'],
  ['指', 'ゆび'],
  ['足', 'あし'],
  ['笑顔', 'えがお'],
  ['笑', 'わら'],
  ['泣', 'な'],
  ['涙', 'なみだ'],
  ['声', 'こえ'],
  ['喃語', 'なんご'],
  ['満腹', 'まんぷく'],
  ['お腹', 'おなか'],
  ['腹', 'なか'],
  ['遊', 'あそ'],
  ['散歩', 'さんぽ'],
  ['公園', 'こうえん'],
  ['外', 'そと'],
  ['雨音', 'あまおと'],
  ['雨', 'あめ'],
  ['晴', 'は'],
  ['天気', 'てんき'],
  ['太陽', 'たいよう'],
  ['離乳食', 'りにゅうしょく'],
  ['ご飯', 'ごはん'],
  ['食', 'た'],
  ['絵本', 'えほん'],
  ['本', 'ほん'],
  ['読', 'よ'],
  ['音楽', 'おんがく'],
  ['歌', 'うた'],
  ['踊', 'おど'],
  ['替え', 'かえ'],
  ['替', 'かえ'],
  ['変え', 'かえ'],
  ['入ろ', 'はいろ'],
  ['入る', 'はいる'],
  ['入', 'はい'],
  ['飲', 'の'],
  ['授乳', 'じゅにゅう'],
  ['哺乳瓶', 'ほにゅうびん'],
  ['湯船', 'ゆぶね'],
  ['お湯', 'おゆ'],
  ['体洗', 'からだあら'],
  ['洗', 'あら'],
  ['尻', 'しり'],
];

const MIN_SOURCE_LENGTH = 4;
const MIN_CANDIDATE_LENGTH = 3;
const WINDOW_LENGTH_TOLERANCE = 2;
const MIN_CONFIDENCE_MARGIN = 0.08;
const MIN_RESCUE_SCORE = 3;
