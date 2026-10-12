#!/usr/bin/env python3
"""CMUdict/ARPAbet coverage inventory for shipped Lite English. Offline CI only.

Do not normalize English phonemes to equal frequencies: a natural infant-directed
English baseline has NOT been measured. This is diagnostics, not learning proof.
"""
import argparse, collections, json, pathlib, re, subprocess
import cmudict

ROOT=pathlib.Path(__file__).resolve().parent.parent
ALL=set('AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH'.split())
CONTRAST=set('R L TH DH V F'.split())
WORD_RE=re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)?")
SENT_RE=re.compile(r'(?<=[.!?])\s+')
dictionary=cmudict.dict()

def lookup(word):
    phon=dictionary.get(word.lower().replace('’',"'"))
    if not phon:
        return None
    return [re.sub(r'\d','',p) for p in phon[0]]

def audit(rows):
    raw=collections.Counter()
    phrase=collections.Counter()
    lexical=collections.defaultdict(set)
    scene=collections.defaultdict(set)
    position=collections.defaultdict(lambda:collections.Counter())
    unknown=collections.Counter()
    unknown_examples=collections.defaultdict(list)
    opener=collections.Counter()
    trigrams=collections.Counter()
    seen_phrases=set()
    words_total=0
    for r in rows:
        txt=r['english'].replace('{name}','')
        tokens=WORD_RE.findall(txt)
        words_total+=len(tokens)
        if len(tokens)<1:
            raise ValueError('empty text '+r['id'])
        opener[' '.join(t.lower() for t in tokens[:3])]+=1
        trigrams.update(set(' '.join(t.lower() for t in tokens[i:i+3]) for i in range(len(tokens)-2)))
        phonemes=set()
        for token in tokens:
            ph=lookup(token)
            if not ph:
                unknown[token.lower()]+=1
                if len(unknown_examples[token.lower()])<3:unknown_examples[token.lower()].append(r['id'])
                continue
            for k,p in enumerate(ph):
                raw[p]+=1
                phonemes.add(p)
                lexical[p].add(token.lower())
                # Position within each spoken word.
                position[p]['initial' if k==0 else 'final' if k==len(ph)-1 else 'medial']+=1
        seen_phrases.add((r['kind'],r['scene'],txt))
        for p in phonemes:
            phrase[p]+=1
            scene[p].add(r['kind']+':'+r['scene'])
    count=len(rows)
    common=lambda x:{k:v for k,v in x.most_common(25)}
    summary={
      'total_sets':count,'total_words':words_total,
      'catalogs':dict(collections.Counter(x['kind'] for x in rows)),
      'phonemes':{p:{'raw':raw[p],'sets':phrase[p],'unique_words':len(lexical[p]),
            'scenes':len(scene[p]),'positions':dict(position[p])} for p in sorted(ALL)},
      'unseen_phonemes':[p for p in sorted(ALL) if raw[p]==0],
      'contrasts':{p:{'occurrences':raw[p],'sets':phrase[p],
          'distinct_words':len(lexical[p]),'different_scenes':len(scene[p]),
          'lexemes':sorted(lexical[p])[:30]} for p in sorted(CONTRAST)},
      'unknown_words':common(unknown),
      'unknown_token_occurrences':sum(unknown.values()),
      'unknown_ratio':round(sum(unknown.values())/max(1,words_total),5),
      'unknown_example_ids':dict(unknown_examples),
      'repeated_opening_3_words':common(opener),
      'repeated_3_word_sequences':common(trigrams),
      'unique_sets':len(seen_phrases),
      'warning':'Actual TTS audio was NOT analyzed. Natural speech reference distribution unavailable. Dictionary cannot validate TTS pronunciation.',
    }
    return summary

def render(r):
    out=['# みつことば 音素カバレッジ監査 — CMUdict',
         '',f"セット数: **{r['total_sets']}**、単語数: **{r['total_words']}**",
         f"未登録単語の割合: **{r['unknown_ratio']*100:.2f}%**（辞書で検証できないものを含む）",
         '', '## 音素一覧（均等化目標ではない）',
         '| ARPAbet | Count | 含むセット数 | 単語種類 | シーン数 |',
         '|---|---:|---:|---:|---:|']
    for p,x in r['phonemes'].items():
        out.append(f"| {p} | {x['raw']} | {x['sets']} | {x['unique_words']} | {x['scenes']} |")
    out+=['','## 英語対立の確認（母語干渉の可能性を観察）','','|音素|総数|セット数|語彙種類|話題数|','|---|---:|---:|---:|---:|']
    for p,v in r['contrasts'].items():
        out.append(f"|{p}|{v['occurrences']}|{v['sets']}|{v['distinct_words']}|{v['different_scenes']}|")
    out+=['','## 発音辞書外語','','|単語|回数|','|---|---:|']
    for p,v in r['unknown_words'].items():out.append(f'|{p}|{v}|')
    out+=['','## 3語連続の定型句（上位）','','|語句|出現セット数|','|---|---:|']
    for p,v in r['repeated_3_word_sequences'].items():out.append(f'|{p}|{v}|')
    out+=['','## 制約','','- 英語の全音素を同一頻度に**しない**。英語の自然な分布を目指すが、基準用の乳児向け英語コーパスはまだない。',
          '- 未知語はG2P未実施を表す。Kiki発音異常があったことを示すものではない。',
          '- CMUdictの音素は辞書上の予定音。Kiki音源の発音は別途評価する。',
          '- 文章の自然さと元の育児場面の意味を優先し、音素のために話題選択を変えない。']
    return '\n'.join(out)+'\n'

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--report',default='docs/english/PHONEME_AUDIT_REPORT.md')
    parser.add_argument('--json',default='docs/english/phoneme-audit.json')
    args=parser.parse_args()
    payload=json.loads(subprocess.check_output(['node','scripts/export-phoneme-corpus.mjs'],cwd=ROOT,text=True))
    r=audit(payload['rows'])
    for name,s in [(args.report,render(r)),(args.json,json.dumps(r,ensure_ascii=False,indent=2)+'\n')]:
        path=ROOT/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(s)
    print('PHONEME_AUDIT',json.dumps({'sets':r['total_sets'],'catalogs':r['catalogs'],
        'coverage':sum(v['raw']>0 for v in r['phonemes'].values()),'all_phonemes':len(ALL),
        'unknown_ratio':r['unknown_ratio'],'unknown_words':r['unknown_words'],
        'contrasts':{k:v['sets'] for k,v in r['contrasts'].items()},
        'top_phrases':list(r['repeated_3_word_sequences'].items())[:12]},ensure_ascii=False))
    assert r['catalogs'].get('topic')==197 and r['catalogs'].get('interaction')==112 and r['catalogs'].get('combined')==333

if __name__=='__main__':main()
