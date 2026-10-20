/** Resume-only Japanese greetings. Avoid repeating the immediately preceding phrase. */
export const JAPANESE_RESUME_GREETINGS = Object.freeze([
  'おかえり！',
  'また会えたね！',
  'やっほー、また一緒だね！'
]);

export function chooseJapaneseResumeGreeting(previous = null, random = Math.random) {
  const candidates = JAPANESE_RESUME_GREETINGS.filter(text => text !== previous);
  const sample = Number(random());
  const index = Math.min(candidates.length - 1,
    Math.max(0, Math.floor((Number.isFinite(sample) ? sample : 0) * candidates.length)));
  return candidates[index];
}
