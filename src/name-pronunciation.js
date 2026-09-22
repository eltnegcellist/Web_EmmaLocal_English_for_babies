const SINGLE = new Map(Object.entries({
  'あ':'a','い':'i','う':'u','え':'e','お':'o',
  'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
  'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
  'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
  'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
  'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
  'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
  'や':'ya','ゆ':'yu','よ':'yo',
  'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
  'わ':'wa','を':'o','ん':'n',
  'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
  'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
  'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
  'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
  'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
  'ゔ':'vu','ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o'
}));

const COMBO = new Map(Object.entries({
  'きゃ':'kya','きゅ':'kyu','きょ':'kyo',
  'しゃ':'sha','しゅ':'shu','しょ':'sho',
  'ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
  'にゃ':'nya','にゅ':'nyu','にょ':'nyo',
  'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
  'みゃ':'mya','みゅ':'myu','みょ':'myo',
  'りゃ':'rya','りゅ':'ryu','りょ':'ryo',
  'ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
  'じゃ':'ja','じゅ':'ju','じょ':'jo',
  'びゃ':'bya','びゅ':'byu','びょ':'byo',
  'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo',
  'ふぁ':'fa','ふぃ':'fi','ふぇ':'fe','ふぉ':'fo',
  'てぃ':'ti','でぃ':'di','とぅ':'tu','どぅ':'du',
  'ゔぁ':'va','ゔぃ':'vi','ゔぇ':'ve','ゔぉ':'vo'
}));

export function toSpokenEnglish(savedName, overrideName='') {
  const explicit = sanitizeEnglishName(overrideName);
  if (explicit) return explicit;

  const cleaned = String(savedName || '').replace(/[\u0000-\u001f\u007f]/g,'').trim();
  if (!cleaned) return '';

  const ascii = sanitizeEnglishName(cleaned);
  if (ascii && /^[A-Za-z'’ -]+$/.test(cleaned)) return ascii;
  if (/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(cleaned)) return '';

  const romanized = romanizeKana(cleaned);
  if (!romanized) return '';
  return romanized.split(/\s+/).filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ').slice(0,40);
}

function sanitizeEnglishName(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g,'')
    .replace(/[^A-Za-z'’ -]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,40);
}

function romanizeKana(value) {
  const hiragana = Array.from(value).map(ch => {
    const code = ch.charCodeAt(0);
    return code >= 0x30A1 && code <= 0x30F6 ? String.fromCharCode(code - 0x60) : ch;
  }).join('');

  let out = '';
  let i = 0;
  let doubleNext = false;
  while (i < hiragana.length) {
    const ch = hiragana[i];
    if (/\s/.test(ch) || ch === '・' || ch === '-' || ch === '‐') {
      if (out && !out.endsWith(' ')) out += ' ';
      i++;
      continue;
    }
    if (ch === 'っ') {
      doubleNext = true;
      i++;
      continue;
    }
    if (ch === 'ー') {
      const m = out.match(/[aeiou](?!.*[aeiou])/);
      if (m) out += m[0];
      i++;
      continue;
    }
    const pair = hiragana.slice(i,i+2);
    const pairRoman = COMBO.get(pair);
    const roman = pairRoman || SINGLE.get(ch);
    if (!roman) return null;
    if (doubleNext && roman && !'aeioun'.includes(roman[0])) out += roman[0];
    doubleNext = false;
    out += roman;
    i += pairRoman ? 2 : 1;
  }
  return out.trim() || null;
}
