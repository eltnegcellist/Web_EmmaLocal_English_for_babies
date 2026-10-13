// Rare personalization for Ruri Topic × Interaction replies only.
// Work on the rendered three-sentence reply, never the shared template bank.
// Name (which may include "-chan") is not retained in reply-diversity history.
export const PAIRED_NAME_MIN_GAP = 8;
const words = text => (text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).length;
const sentences = text => text.trim().split(/(?<=[.!?])\s+/);
const vocative = /,\s*(?:sweetheart|baby|darling|little one)(?=[.!?])/i;

export function insertPairedBabyName(english, name) {
  if (!name || !/^[A-Za-z'’ -]{1,45}$/.test(name)) return english;
  const source = sentences(english);
  if (source.length !== 3) return english;
  const total = words(english);
  const valid = candidate => {
    const parts = sentences(candidate);
    return parts.length === 3 && words(candidate) >= 6 && words(candidate) <= 12
      && parts.every(part => words(part) <= 4);
  };
  // Replace a real term of address before adding more words to a sentence.
  for (const part of [0,1,2]) {
    if (!vocative.test(source[part])) continue;
    const result = [...source];
    result[part] = result[part].replace(vocative, ', '+name);
    const candidate = result.join(' ');
    if (valid(candidate)) return candidate;
  }
  if (total + words(name) > 12) return english;
  // Adding the name as a vocative (not a new fourth sentence) preserves meaning.
  // Prefer short declarative closings, then a short opening.
  for (const part of [2,0,1]) {
    if (!/[.!]$/.test(source[part]) || words(source[part]) + words(name) > 4) continue;
    const result = [...source];
    result[part] = result[part].replace(/([.!])$/, ', '+name+'$1');
    const candidate = result.join(' ');
    if (valid(candidate)) return candidate;
  }
  return english;
}
