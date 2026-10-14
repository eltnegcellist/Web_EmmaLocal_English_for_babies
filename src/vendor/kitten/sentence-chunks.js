/**
 * Pure sentence chunking shared by the browser Kitten TTS and Node regression
 * tests. Legacy comma-final chunks remain the production default.
 */
export function splitKittenChunks(text, { punctuationMode = 'legacy', maxChars = 400 } = {}) {
  const preserve = punctuationMode === 'preserve';
  const sentences = preserve
    ? (String(text || '').match(/[^.!?]+(?:[.!?]+|$)/g) || [])
    : String(text || '').split(/[.!?]+/);
  const chunks = [];
  const ensurePunctuation = (input) => {
    const trimmed = input.trim();
    if (!trimmed) return trimmed;
    return /[.!?,;:]$/.test(trimmed) ? trimmed : trimmed + ',';
  };
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (sentence.length <= maxChars) {
      chunks.push(ensurePunctuation(sentence));
      continue;
    }
    const ending = preserve ? (sentence.match(/[.!?]+$/)?.[0] || '') : '';
    const body = ending ? sentence.slice(0,-ending.length).trimEnd() : sentence;
    let part = '';
    for (const word of body.split(/\s+/)) {
      if (!part || part.length + word.length + 1 <= maxChars) {
        part += part ? ' ' + word : word;
      } else {
        chunks.push(ensurePunctuation(part));
        part = word;
      }
    }
    if (part) chunks.push(ensurePunctuation(part + ending));
  }
  return chunks;
}
