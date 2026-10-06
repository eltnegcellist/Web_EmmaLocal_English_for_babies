// Unigram byte fallback is present in the pinned SentencePiece vocabulary.
// The JS tokenizer returns unknown spans as ID 0; expand those spans to UTF-8
// byte tokens to match the native fast tokenizer without changing normalization.
export function createRuriTokenizer(Tokenizer, json, config) {
  const tokenizer = new Tokenizer(json, config);
  const bytes = new Map();
  json.model.vocab.forEach(([token], id) => {
    const match = /^<0x([0-9A-F]{2})>$/.exec(token);
    if (match) bytes.set(parseInt(match[1], 16), id);
  });
  if (!json.model.byte_fallback || bytes.size !== 256) throw Error('Unexpected Ruri byte fallback vocabulary');
  const encoder = new TextEncoder();
  return text => {
    const encoded = tokenizer.encode(text, { add_special_tokens: true });
    const ids = [];
    encoded.ids.forEach((id, i) => {
      if (id !== json.model.unk_id || encoded.tokens[i] === '<unk>') ids.push(id);
      else for (const byte of encoder.encode(encoded.tokens[i])) ids.push(bytes.get(byte));
    });
    return ids;
  };
}
