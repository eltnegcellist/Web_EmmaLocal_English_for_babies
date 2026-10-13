// Explicitly authored name variants; each original line remains the fallback
// when no baby name is set or the name was used too recently.
// Do not infer a slot or insert names into arbitrary English.
export const PAIRED_NAME_TEMPLATES = new Map([
  ["Milk time, sweetheart! You're so lovely. I love you.", "Milk time, {name}! You're so lovely. I love you."],
  ["You drank your milk! You did it! Well done, sweetheart.", "You drank your milk! You did it! Well done, {name}."],
  ["Diaper change, all done! We did it! Well done, sweetheart.", "Diaper change, all done! We did it! Well done, {name}."],
  ["Time for a change. I'll be gentle. Ready, little one?", "Time for a change. I'll be gentle. Ready, {name}?"],
  ["Sweet dreams, little one. You're so loved. I'm beside you.", "Sweet dreams, {name}. You're so loved. I'm beside you."],
  ["Bath time, sweetheart! You're so lovely. I'm right here.", "Bath time, {name}! You're so lovely. I'm right here."],
  ["You've finished your food. Well done, sweetheart. Let's rest now.", "You've finished your food. Well done, {name}. Let's rest now."],
  ["Such careful little sips! You worked so well. High five, sweetheart!", "Such careful little sips! You worked so well. High five, {name}!"],
  ["Shall we roll together? Here comes your ball. Catch it, sweetheart!", "Shall we roll together? Here comes your ball. Catch it, {name}!"],
  ["Good morning, bright eyes! What a lovely hello. Welcome back, sweetheart.", "Good morning, bright eyes! What a lovely hello. Welcome back, {name}."],
  ["You're awake, sweetheart! What a lovely surprise. I love you.", "You're awake, {name}! What a lovely surprise. I love you."],
  ["I'm close by, darling. The night is quiet. Rest easy, sweetheart.", "I'm close by, darling. The night is quiet. Rest easy, {name}."],
]);
const words = text => (text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).length;
const sentences = text => text.trim().split(/(?<=[.!?])\s+/);
export function insertPairedBabyName(original, name) {
  if (!name || !/^[A-Za-z'’ -]{1,45}$/.test(name)) return original;
  const authored=PAIRED_NAME_TEMPLATES.get(original);
  if(!authored) return original;
  const rendered=authored.replaceAll('{name}',name);
  const parts=sentences(rendered);
  if(parts.length!==3 || words(rendered)<6 || words(rendered)>12 || parts.some(x=>words(x)>4)) return original;
  return rendered;
}
