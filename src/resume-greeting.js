/**
 * Select one short English sentence from the existing Play topic "greeting".
 * Only phrases with established Qwen3-1202 recordings are eligible.
 * Never synthesize Japanese or create a second speech engine.
 */
export const RECORDED_RESUME_GREETINGS = Object.freeze([
  'Hi there!',
  'Hello again!',
  'Hello, little one!',
  'Hello, hello!'
]);

export function greetingSentences(playTopics) {
  const topic = (playTopics?.topics || []).find(item => item.id === 'greeting');
  if (!topic) return [];
  const actual = new Set(
    (topic.phrases || []).flatMap(phrase =>
      (String(phrase).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
        .map(sentence => sentence.trim()).filter(Boolean)
    )
  );
  return RECORDED_RESUME_GREETINGS.filter(text => actual.has(text));
}

export function chooseEnglishResumeGreeting(playTopics, previous = null, random = Math.random) {
  const options = greetingSentences(playTopics);
  if (!options.length) return null;
  const nonRepeating = options.filter(text => text !== previous);
  const pool = nonRepeating.length ? nonRepeating : options;
  const n = Number(random());
  return pool[Math.max(0, Math.min(pool.length - 1,
    Math.floor((Number.isFinite(n) ? n : 0) * pool.length)))];
}
