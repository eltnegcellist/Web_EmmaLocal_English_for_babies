// Pure, research-only comparison helpers. Never upload any recording/transcript.
export function normalizedChars(input) {
  return Array.from(String(input ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, ''));
}
export function characterErrorRate(expected, actual) {
  const a = normalizedChars(expected);
  const b = normalizedChars(actual);
  if (!a.length) return null;
  const row = Array.from({length:b.length+1}, (_,j)=>j);
  for (let i=1; i<=a.length; i++) {
    let prev=row[0];
    row[0]=i;
    for (let j=1; j<=b.length; j++) {
      const prior=row[j];
      row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));
      prev=prior;
    }
  }
  return row[b.length]/a.length;
}
