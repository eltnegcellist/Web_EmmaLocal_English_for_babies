// Fixed FP32 LR heads: class order and margins are part of the measured contract.
export function decodeHead(buffer, config) {
  const [classes, width] = config.shape;
  if (width !== 385 || classes !== config.classes.length || buffer.byteLength !== classes * width * 4) throw Error('分類器データのサイズが一致しません。');
  const view = new DataView(buffer);
  const weights = Float64Array.from({ length: classes * width }, (_, i) => view.getFloat32(i * 4, true));
  if (!weights.every(Number.isFinite)) throw Error('分類器データが壊れています。');
  return { ...config, weights };
}
export function classifyEmbedding(embedding, heads, thresholds) {
  if (embedding.length !== 384 || !Array.from(embedding).every(Number.isFinite)) throw Error('判定モデルの出力が不正です。');
  const result = {};
  for (const [name, head] of Object.entries(heads)) {
    const logits = head.classes.map((_, c) => {
      const offset = c * 385;
      let value = head.weights[offset + 384];
      for (let i = 0; i < 384; i++) value += head.weights[offset + i] * embedding[i];
      return value;
    });
    const max = Math.max(...logits);
    const exp = logits.map(x => Math.exp(x - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    const probabilities = exp.map(x => x / sum);
    const ranking = head.classes.map((id, i) => ({ id, probability: probabilities[i] })).sort((a, b) => b.probability - a.probability);
    const top = ranking[0], margin = top.probability - ranking[1].probability;
    const rejected = name === 'topic' && (top.probability < thresholds.threshold || margin < thresholds.margin);
    result[name] = { id: rejected ? 'generic' : top.id, rawId: top.id, probability: top.probability, margin, candidates: ranking.slice(0, 2), probabilities, rejected };
  }
  return result;
}
