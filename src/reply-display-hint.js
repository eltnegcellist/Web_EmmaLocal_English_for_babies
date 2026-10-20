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

// Chinese explanations can be selected separately from the interface language.
// The full app has no Chinese UI locale yet; this does not change the speech
// or display language.
const CHINESE_CONTEXT_NOTES = {
  "お風呂に入ろうね。": "我们来洗澡吧。",
  "ミルクの時間だよ。": "该喝奶啦。",
  "ゆっくり休もうね。": "好好休息一下吧。",
  "おはよう、起きたね。": "早上好，醒来啦。",
  "おむつを替えようね。": "我们来换尿布吧。",
  "お着替えしようね。": "我们来换衣服吧。",
  "ぎゅっと抱っこしよう。": "来抱抱你。",
  "小さなおててだね。": "小手真可爱。",
  "あんよを動かそうね。": "动动小脚吧。",
  "いい笑顔だね。": "笑得真好看。",
  "そばにいるよ。": "我就在你身边。",
  "かわいい声だね。": "声音真可爱。",
  "おなかのことだよ。": "我们在说小肚肚的事。",
  "一緒に遊ぼう。": "我们一起玩吧。",
  "お外を見てみよう。": "一起看看外面吧。",
  "雨の音を聞こうね。": "来听听雨声。",
  "おひさまが出ているね。": "太阳出来啦。",
  "ごはんの時間だよ。": "到吃饭时间啦。",
  "絵本を読もうね。": "一起读绘本吧。",
  "歌を楽しもうね。": "一起听首歌吧。",
  "少しずつ飲もうね。": "慢慢喝，一小口一小口来。",
  "大好きだよ。": "我爱你。",
  "よくできたね。": "做得真棒！",
  "できたね！": "你做到了！",
  "がんばっているね。": "你很努力呢。",
  "ゆっくりでいいよ。": "慢慢来就好。",
  "一緒にやってみよう。": "我们一起试试吧。",
  "さあ、始めよう。": "我们开始吧。",
  "おしまいだよ。": "结束啦。",
  "もう終わりかな？": "已经结束了吗？",
  "少し休もうね。": "休息一下吧。",
  "どうしたのかな？": "怎么了呀？",
  "もう一回やってみる？": "要再试一次吗？",
  "赤ちゃんへのやさしい呼びかけ。": "对宝宝说的温柔话语。"
};
export function explainReplyContext(hint,language,translate=x=>x) {
  if(language==='none'||language==='en')return '';
  return hint.noteParts.map(part=>language==='zh'
    ? (CHINESE_CONTEXT_NOTES[part]||CHINESE_CONTEXT_NOTES['赤ちゃんへのやさしい呼びかけ。'])
    : translate(part)).join(' ');
}
