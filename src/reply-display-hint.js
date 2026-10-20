// Compact parent-facing hints for the existing three-sentence response.
// These are topic/interaction summaries, NOT sentence-by-sentence translations.
// Do not infer a verbatim Japanese translation from the Ruri route.
const TOPICS = {
  bath:['お風呂','お風呂に入ろうね。'], milk:['ミルク・授乳','ミルクの時間だよ。'],
  sleep:['ねんね','ゆっくり休もうね。'], wake:['おはよう','おはよう、起きたね。'],
  diaper:['おむつ','おむつを替えようね。'], clothes:['お着替え','お着替えしようね。'],
  hug:['抱っこ','ぎゅっと抱っこしよう。'], hands:['おてて','小さなおててだね。'],
  feet:['あんよ','あんよを動かそうね。'], smile:['笑顔','いい笑顔だね。'],
  cry:['泣く・ぐずぐず','そばにいるよ。'], voice:['おしゃべり','かわいい声だね。'],
  tummy:['おなか・げっぷ','おなかのことだよ。'], play:['あそぼう','一緒に遊ぼう。'],
  outside:['おさんぽ','お外を見てみよう。'], rain:['雨','雨の音を聞こうね。'],
  sun:['おひさま','おひさまが出ているね。'], food:['ごはん','ごはんの時間だよ。'],
  book:['絵本','絵本を読もうね。'], music:['音楽','歌を楽しもうね。'],
  drink:['飲む','少しずつ飲もうね。'],
};
const INTERACTIONS = {
  affection:['だいすき','大好きだよ。'], praise:['ほめる','よくできたね。'],
  achievement:['できた','できたね！'], effort:['がんばる','がんばっているね。'],
  encouragement:['応援','ゆっくりでいいよ。'], invitation:['誘う','一緒にやってみよう。'],
  start:['はじめる','さあ、始めよう。'], finish:['おしまい','おしまいだよ。'],
  finish_check:['おわった？','もう終わりかな？'], care:['いたわる','少し休もうね。'],
  inquiry:['たずねる','どうしたのかな？'], reassurance:['安心','そばにいるよ。'],
  repeat:['もう一度','もう一回やってみる？'],
  pause:['ひと休み','少し休もうね。'],
};
export function replyDisplayHint(route = '') {
  const parts = String(route || '').split(':');
  const combined = parts[0] === 'combined';
  const topicId = combined ? parts[1] : parts[0] === 'interaction' ? '' : parts[0];
  const interactionId = combined ? parts[2] : parts[0] === 'interaction' ? parts[1] : '';
  const topic = TOPICS[topicId];
  const interaction = INTERACTIONS[interactionId];
  return {
    topicLabel: topic?.[0] || interaction?.[0] || 'ふだんのことば',
    // A short Japanese contextual note; exact sentence translations need
    // separately reviewed, per-recorded-phrase assets.
    // Keep context fragments separate so each is translated independently.
    // This is a topic/interaction paraphrase, never a translation of the actual
    // recorded English sentence or the parent transcript.
    noteParts: [topic?.[1], interaction?.[1]].filter(Boolean).length
      ? [topic?.[1], interaction?.[1]].filter(Boolean)
      : ['赤ちゃんへのやさしい呼びかけ。'],
    japaneseNote: [topic?.[1], interaction?.[1]].filter(Boolean).join(' ') || '赤ちゃんへのやさしい呼びかけ。',
  };
}
