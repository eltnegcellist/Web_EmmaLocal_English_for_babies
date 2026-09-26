// Non-GPL English phonemizer for Emma / Kitten TTS.
// CMU Pronouncing Dictionary (BSD-style) + context rules + tiny fallback G2P.
// The dictionary is downloaded once from a pinned commit and cached locally.

const CMU_URL = 'https://cdn.jsdelivr.net/gh/cmusphinx/cmudict@74790861f652b15e4ac49015a90074ad62a27690/cmudict.dict';
const CMU_CACHE = 'emma-cmudict-74790861-v1';

let cmuMap = null;
let cmuPromise = null;

const PHONE = {
  AA:'ɑ', AE:'æ', AH:'ʌ', AO:'ɔ', AW:'aʊ', AY:'aɪ',
  B:'b', CH:'ʧ', D:'d', DH:'ð', EH:'ɛ', ER:'ɝ', EY:'eɪ',
  F:'f', G:'ɡ', HH:'h', IH:'ɪ', IY:'i', JH:'ʤ', K:'k',
  L:'l', M:'m', N:'n', NG:'ŋ', OW:'oʊ', OY:'ɔɪ', P:'p',
  R:'ɹ', S:'s', SH:'ʃ', T:'t', TH:'θ', UH:'ʊ', UW:'u',
  V:'v', W:'w', Y:'j', Z:'z', ZH:'ʒ',
  AX:'ə', AXR:'ɚ', IX:'ᵻ', UX:'ʊ', DX:'ɾ', EL:'l', EM:'m', EN:'n', NX:'ŋ'
};
const VOWELS = new Set(['AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW','AX','AXR','IX','UX']);

const SIMPLE_LETTER = {
  a:'æ',b:'b',c:'k',d:'d',e:'ɛ',f:'f',g:'ɡ',h:'h',i:'ɪ',j:'ʤ',k:'k',l:'l',
  m:'m',n:'n',o:'ɑ',p:'p',q:'k',r:'ɹ',s:'s',t:'t',u:'ʌ',v:'v',w:'w',x:'ks',y:'j',z:'z'
};

const AUX_BASE_FORM = new Set(['will','shall','can','could','would','should','may','might','must','do','does','did','to','please']);
const PERFECT_AUX = new Set(['have','has','had']);
const DETERMINERS = new Set(['a','an','the','this','that','these','those','my','your','his','her','our','their','another','each','every','one','new']);
const PAST_CUES = new Set(['yesterday','ago','earlier','previously','last']);
const LIVE_ADJ_NOUNS = new Set(['music','show','broadcast','stream','concert','performance','event','television','tv','coverage','audience','camera','video','feed','bird']);
const LEAD_METAL_NOUNS = new Set(['pipe','pipes','paint','metal','poisoning','ore','battery','batteries','shot','weight','weights']);
const CLOSE_ADJ_NOUNS = new Set(['friend','friends','relationship','relationships','call','calls','race','races','match','matches','look','contact']);
const STRESS_HETERONYMS = new Set([
  'record','present','object','project','permit','produce','progress','rebel','refuse','subject','suspect',
  'conduct','contract','contrast','convert','digest','discount','escort','export','extract','import',
  'increase','insult','invalid','perfect','protest','reject','survey','transfer','transport'
]);
const CUSTOM_IPA = new Map([
  ['peekaboo','pikəbˈu'],
  ['oo','ˈu'],
  ['pitter','pˈɪtɚ'],
  ['mmm','m'],
  ['bassinet','bˌæsɪnˈɛt'],
  ['breastmilk','bɹˈɛstmˌɪlk'],
  ['playtime','plˈeɪtˌaɪm'],
  ['tummytime','tˈʌmitˌaɪm']
]);

async function fetchDictionaryText() {
  const canCache = typeof caches !== 'undefined' &&
    typeof location !== 'undefined' &&
    (location.protocol === 'https:' || location.protocol === 'http:');

  if (canCache) {
    try {
      const cache = await caches.open(CMU_CACHE);
      const hit = await cache.match(CMU_URL);
      if (hit) return await hit.text();
      const response = await fetch(CMU_URL, { mode:'cors', cache:'no-store' });
      if (!response.ok) throw new Error('CMUDict HTTP ' + response.status);
      await cache.put(CMU_URL, response.clone());
      return await response.text();
    } catch (error) {
      console.warn('[kitten-phonemizer] CMUDict cache unavailable, using direct fetch.', error);
    }
  }

  const response = await fetch(CMU_URL, { mode:'cors', cache:'no-store' });
  if (!response.ok) throw new Error('CMUDict HTTP ' + response.status);
  return await response.text();
}

function parseCmu(text) {
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';;;')) continue;
    const m = line.match(/^(\S+)\s+(.+)$/);
    if (!m) continue;
    const word = m[1].toLowerCase().replace(/\(\d+\)$/,'');
    const phones = m[2].trim().split(/\s+/);
    if (!map.has(word)) map.set(word, []);
    map.get(word).push(phones);
  }
  return map;
}

export async function ensurePhonemizerReady() {
  if (cmuMap) return cmuMap;
  if (!cmuPromise) {
    cmuPromise = fetchDictionaryText()
      .then(parseCmu)
      .then((map) => {
        cmuMap = map;
        return map;
      })
      .catch((error) => {
        cmuPromise = null;
        throw error;
      });
  }
  return cmuPromise;
}

function arpabetToIpa(phones) {
  let out = '';
  for (const raw of phones) {
    const m = raw.match(/^([A-Z]+)([012])?$/);
    if (!m) continue;
    const base = m[1];
    const stress = m[2] || '';
    let p = PHONE[base];
    if (!p) continue;
    if (base === 'AH' && stress === '0') p = 'ə';
    if (base === 'ER' && stress === '0') p = 'ɚ';
    if (VOWELS.has(base)) {
      if (stress === '1') p = 'ˈ' + p;
      else if (stress === '2') p = 'ˌ' + p;
    }
    out += p;
  }
  return out;
}

function simpleG2P(word) {
  const w = word.toLowerCase();
  const rules = [['tion','ʃən'],['sh','ʃ'],['ch','ʧ'],['th','θ'],['ph','f'],['ng','ŋ'],['oo','u'],['ee','i'],['ea','i']];
  let out = '';
  let i = 0;
  while (i < w.length) {
    let hit = false;
    for (const pair of rules) {
      if (w.startsWith(pair[0], i)) {
        out += pair[1];
        i += pair[0].length;
        hit = true;
        break;
      }
    }
    if (hit) continue;
    const c = w[i++];
    if (SIMPLE_LETTER[c]) out += SIMPLE_LETTER[c];
  }
  return out;
}

function prevLex(parts, i, n = 1) {
  let found = 0;
  for (let j = i - 1; j >= 0; j--) {
    if (/^[a-z]/.test(parts[j])) {
      found++;
      if (found === n) return parts[j].toLowerCase();
    }
  }
  return '';
}

function nextLex(parts, i, n = 1) {
  let found = 0;
  for (let j = i + 1; j < parts.length; j++) {
    if (/^[a-z]/.test(parts[j])) {
      found++;
      if (found === n) return parts[j].toLowerCase();
    }
  }
  return '';
}

function nearbyLex(parts, i, radius = 5) {
  const out = [];
  for (let j = Math.max(0, i - radius); j <= Math.min(parts.length - 1, i + radius); j++) {
    if (j !== i && /^[a-z]/.test(parts[j])) out.push(parts[j].toLowerCase());
  }
  return out;
}

function basePhones(phones) {
  return phones.map((p) => p.replace(/[012]$/,''));
}

function chooseByPhone(cands, wanted) {
  return cands.find((c) => basePhones(c).includes(wanted)) || null;
}

function primaryStressIndex(phones) {
  return phones.findIndex((p) => /1$/.test(p));
}

function chooseStress(cands, mode) {
  if (cands.length < 2) return cands[0];
  const ranked = [...cands].sort((a,b) => primaryStressIndex(a) - primaryStressIndex(b));
  return mode === 'late' ? ranked[ranked.length - 1] : ranked[0];
}

function chooseHeteronym(word, cands, parts, i) {
  if (cands.length < 2) return cands[0];
  const prev = prevLex(parts, i);
  const prev2 = prevLex(parts, i, 2);
  const next = nextLex(parts, i);
  const nearby = new Set(nearbyLex(parts, i));
  let chosen = null;

  if (word === 'wind') {
    const nounish = DETERMINERS.has(prev) || ['strong','cold','warm','gentle','north','south','east','west'].includes(prev);
    const letUs = prev === 'us' && prev2 === 'let';
    const objectAhead = DETERMINERS.has(next);
    const verbish = AUX_BASE_FORM.has(prev) || letUs || objectAhead || ['up','down','back','around'].includes(next);
    chosen = chooseByPhone(cands, nounish && !verbish ? 'IH' : verbish ? 'AY' : 'IH');
  } else if (word === 'read') {
    const past = PERFECT_AUX.has(prev) || [...PAST_CUES].some((x) => nearby.has(x));
    const base = AUX_BASE_FORM.has(prev);
    chosen = chooseByPhone(cands, past && !base ? 'EH' : 'IY');
  } else if (STRESS_HETERONYMS.has(word)) {
    const verbish = AUX_BASE_FORM.has(prev) || ['i','you','we','they','he','she','it'].includes(prev) || (prev === 'not' && AUX_BASE_FORM.has(prev2));
    const nounish = DETERMINERS.has(prev);
    chosen = chooseStress(cands, verbish && !nounish ? 'late' : 'early');
  } else if (word === 'live') {
    const adjective = LIVE_ADJ_NOUNS.has(next) || DETERMINERS.has(prev);
    const verb = AUX_BASE_FORM.has(prev) || ['i','you','we','they','he','she'].includes(prev);
    chosen = chooseByPhone(cands, adjective && !verb ? 'AY' : 'IH');
  } else if (word === 'lead') {
    const metalPrev = new Set(['contain','contains','contained','containing','has','have','had','with','of','from','made']);
    const metal = LEAD_METAL_NOUNS.has(next) || ['metal','poisoning'].includes(prev) || metalPrev.has(prev);
    const verb = AUX_BASE_FORM.has(prev) || ['i','you','we','they','he','she'].includes(prev);
    chosen = chooseByPhone(cands, metal && !verb ? 'EH' : 'IY');
  } else if (word === 'close') {
    const niceAndClose = prev === 'and' && prev2 === 'nice';
    const adjective = CLOSE_ADJ_NOUNS.has(next) || ['very','too','so'].includes(prev) || next === 'to' || niceAndClose;
    const verb = AUX_BASE_FORM.has(prev) || ['i','you','we','they','he','she'].includes(prev) || prev === 'please' || prev === 'open';
    chosen = chooseByPhone(cands, adjective && !verb ? 'S' : 'Z');
  } else if (word === 'use') {
    const nounish = DETERMINERS.has(prev) || ['in','for','of'].includes(prev);
    const verbish = AUX_BASE_FORM.has(prev) || ['i','you','we','they','he','she'].includes(prev);
    chosen = chooseByPhone(cands, nounish && !verbish ? 'S' : 'Z');
  }
  return chosen || cands[0];
}

function normalizeNameHints(nameHints) {
  const out = new Set();
  for (const raw of Array.isArray(nameHints) ? nameHints : []) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) continue;
    const base = value.replace(/(?:-|\s)?chan$/i,'').trim();
    for (const part of base.split(/[\s-]+/)) {
      if (/^[a-z]+(?:'[a-z]+)?$/.test(part)) out.add(part);
    }
  }
  return out;
}

function japaneseNameToIpa(word) {
  let w = word.toLowerCase().replace(/(?:'s|’s)$/,'');
  const digraphs = [
    ['kyo','kjo'],['kyu','kju'],['kya','kja'],['sho','ʃo'],['shu','ʃu'],['sha','ʃa'],
    ['cho','ʧo'],['chu','ʧu'],['cha','ʧa'],['nyo','njo'],['nyu','nju'],['nya','nja'],
    ['hyo','hjo'],['hyu','hju'],['hya','hja'],['myo','mjo'],['myu','mju'],['mya','mja'],
    ['ryo','ɹjo'],['ryu','ɹju'],['rya','ɹja'],['gyo','ɡjo'],['gyu','ɡju'],['gya','ɡja'],
    ['jo','ʤo'],['ju','ʤu'],['ja','ʤa'],['shi','ʃi'],['chi','ʧi'],['tsu','tsu'],['fu','fu']
  ];
  const cons = {k:'k',s:'s',t:'t',n:'n',h:'h',m:'m',y:'j',r:'ɹ',w:'w',g:'ɡ',z:'z',d:'d',b:'b',p:'p',j:'ʤ',f:'f',v:'v'};
  const vowels = {a:'ɑ',i:'i',u:'u',e:'e',o:'o'};
  let out = '';
  let i = 0;
  while (i < w.length) {
    let matched = false;
    for (const pair of digraphs) {
      if (w.startsWith(pair[0], i)) {
        out += pair[1];
        i += pair[0].length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const c = w[i];
    const n = w[i + 1] || '';
    if (vowels[c]) { out += vowels[c]; i++; continue; }
    if (c === 'n' && (!n || (!vowels[n] && n !== 'y'))) { out += 'n'; i++; continue; }
    if (cons[c]) { out += cons[c]; i++; continue; }
    if (c === '-' || c === "'") { i++; continue; }
    return null;
  }
  return out ? 'ˈ' + out : null;
}

function cmuLookup(word, parts, i, nameHints) {
  const w = word.toLowerCase().replace(/’/g,"'");
  const basePossessive = w.replace(/'s$/,'');
  if (nameHints.has(basePossessive)) {
    const baseIpa = japaneseNameToIpa(basePossessive);
    if (baseIpa) return /'s$/.test(w) ? baseIpa + 'z' : baseIpa;
  }

  if (CUSTOM_IPA.has(w)) return CUSTOM_IPA.get(w);

  const tries = [w, w.replace(/'/g,''), basePossessive];
  for (const t of tries) {
    const cands = cmuMap.get(t);
    if (cands && cands.length) return arpabetToIpa(chooseHeteronym(t, cands, parts, i));
  }
  return simpleG2P(w);
}

export async function phonemize(text, opts = {}) {
  await ensurePhonemizerReady();
  const processed = String(text || '').toLowerCase();
  const parts = processed.match(/[a-z]+(?:'[a-z]+)?|[;:,.!?¡¿—…"«»"]|\S/g) || [];
  const nameHints = normalizeNameHints(opts.nameHints);
  const out = [];

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (/^[a-z]/.test(p)) {
      out.push(cmuLookup(p, parts, i, nameHints));
    } else if (/[;:,.!?¡¿—…"«»"]/.test(p)) {
      out.push(p);
    }
  }
  return out.join(' ').trim();
}
