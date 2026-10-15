/**
 * Keep supported childcare terms even if one Japanese word cannot be tokenized.
 * A single unsupported term must not silently disable all Moonshine bias.
 */
export function applySupportedKeyterms(transcriber, requested) {
  const applied=[], skipped=[];
  for(const term of requested||[]) {
    try {
      transcriber.setKeyterms([...applied,term]);
      applied.push(term);
    } catch(error) {
      skipped.push({term,error:String(error?.message||error)});
    }
  }
  transcriber.setKeyterms(applied);
  return {applied,skipped};
}
