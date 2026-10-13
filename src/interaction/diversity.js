// Ruri reply diversity: deterministic, bounded, conversation-text-free history.
// The Ruri Topic and Interaction labels themselves are never altered.
export const DIVERSITY_STORAGE_KEY = 'emma_ruri_reply_diversity_v1';
const RECENT_LIMIT = 60;
const PHRASE_LIMIT = 24;
const MAX_CYCLES = 135;

function ngrams(text) {
  const words = (text.toLowerCase().match(/[a-z]+(?:['’][a-z]+)?/g) || []);
  const grams = [];
  for (let i=0; i+2<words.length; i++) {
    const source = words.slice(i,i+3).join(' ');
    let h=2166136261;
    for (let j=0;j<source.length;j++) h=Math.imul(h^source.charCodeAt(j),16777619);
    grams.push((h>>>0).toString(16));
  }
  return [...new Set(grams)];
}
const safeId = value => typeof value==='string' && /^[a-z0-9_:\-|#]+$/.test(value);

export class RuriReplyDiversity {
  constructor(state=null) { this.restore(state); }
  restore(state) {
    const valid = state && state.version===1;
    this.history = valid && Array.isArray(state.history)
      ? state.history.filter(safeId).slice(-RECENT_LIMIT) : [];
    this.phrases = valid && Array.isArray(state.phrases)
      ? state.phrases.filter(row=>Array.isArray(row)).slice(-PHRASE_LIMIT)
        .map(row=>row.filter(x=>typeof x==='string'&&/^[0-9a-f]+$/.test(x)).slice(0,32)) : [];
    this.cycles={};
    if (valid && state.cycles && typeof state.cycles==='object') {
      for(const [key,cycle] of Object.entries(state.cycles).slice(-MAX_CYCLES)) {
        if(!safeId(key) || !cycle || !Array.isArray(cycle.used))continue;
        this.cycles[key]={used:[...new Set(cycle.used.filter(n=>Number.isInteger(n)&&n>=0&&n<100))],
          fallbackStep:cycle.fallbackStep===1||cycle.fallbackStep===2?cycle.fallbackStep:0};
      }
    }
  }
  snapshot() {
    return {version:1,history:[...this.history],phrases:this.phrases.map(row=>[...row]),
      cycles:Object.fromEntries(Object.entries(this.cycles).map(([k,v])=>[k,{used:[...v.used],fallbackStep:v.fallbackStep}]))};
  }
  pick(poolKey, candidates, excluded=[]) {
    if(!Array.isArray(candidates) || !candidates.length)return null;
    const banned=new Set(excluded);
    let indices=candidates.map((_,i)=>i).filter(i=>!banned.has(i));
    if(!indices.length)indices=candidates.map((_,i)=>i);
    const recentGroups=this.phrases.slice(-18);
    const scored=indices.map(i=>{
      const text=candidates[i], id=poolKey+'#'+i, last=this.history.lastIndexOf(id);
      const occurrences=this.history.filter(x=>x===id).length;
      const grams=ngrams(text);
      const phraseFrequency=recentGroups.reduce((total,group)=>total+grams.filter(x=>group.includes(x)).length,0);
      const opener=grams[0];
      const openerFrequency=opener ? recentGroups.filter(group=>group.includes(opener)).length : 0;
      const score=(last<0?0:1200+last*4)+occurrences*240+phraseFrequency*7+openerFrequency*35;
      return {i,score};
    }).sort((a,b)=>a.score-b.score||a.i-b.i);
    const chosen=scored[0].i, id=poolKey+'#'+chosen;
    this.history.push(id);
    if(this.history.length>RECENT_LIMIT)this.history.shift();
    this.phrases.push(ngrams(candidates[chosen]));
    if(this.phrases.length>PHRASE_LIMIT)this.phrases.shift();
    return {text:candidates[chosen],poolKey,index:chosen};
  }
  select({topic,interaction,pair,topicReplies,interactionReplies}) {
    const topicKey=topic?'topic:'+topic:null;
    const interactionKey=interaction?'interaction:'+interaction:null;
    if(topic && interaction && pair?.length) {
      const key=topic+'|'+interaction;
      const cycle=this.cycles[key]||{used:[],fallbackStep:0};
      this.cycles[key]=cycle;
      cycle.used=cycle.used.filter(i=>i<pair.length);
      if(cycle.used.length>=pair.length && cycle.fallbackStep<2) {
        const step=cycle.fallbackStep++;
        const preferred=step===0
          ? [interactionKey,interactionReplies,'diversity_interaction']
          : [topicKey,topicReplies,'diversity_topic'];
        const other=step===0
          ? [topicKey,topicReplies,'diversity_topic']
          : [interactionKey,interactionReplies,'diversity_interaction'];
        const choice=this.pick(preferred[0],preferred[1])||this.pick(other[0],other[1]);
        if(choice)return {...choice,reason:choice.poolKey===preferred[0]?preferred[2]:other[2]};
      }
      if(cycle.fallbackStep>=2){cycle.used=[];cycle.fallbackStep=0;}
      const choice=this.pick('combined:'+key,pair,cycle.used);
      if(choice){cycle.used.push(choice.index);return {...choice,reason:'combined'};}
    }
    if(topic && topicReplies?.length){
      const choice=this.pick(topicKey,topicReplies);
      if(choice)return {...choice,reason:topic && interaction ? 'pair_missing':'topic_only'};
    }
    if(interaction && interactionReplies?.length){
      const choice=this.pick(interactionKey,interactionReplies);
      if(choice)return {...choice,reason:'interaction_only'};
    }
    return null;
  }
}
