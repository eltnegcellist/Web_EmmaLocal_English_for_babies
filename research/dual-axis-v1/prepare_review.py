#!/usr/bin/env python3
"""Prepare independent, label-blinded native-language review packets.

Never mark a record as reviewed. A/B packets contain no model/candidate labels,
so reviewers are not inadvertently anchored to generated labels.
"""
import argparse, collections, csv, hashlib, json
from pathlib import Path

HERE=Path(__file__).resolve().parent
LANGUAGES=('en','de','fr','ko','th','zh','hi')
FIELDS=['id','language','text','review_topic','review_interaction','naturalness',
        'baby_directed','native_speaker_confirmed','reviewer_id','notes']

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--corpus',type=Path,default=HERE/'outputs/starter_corpus.jsonl')
    parser.add_argument('--output',type=Path,default=HERE/'outputs/reviewer_packets')
    args=parser.parse_args()
    if not args.corpus.exists():
        raise SystemExit('Generate the corpus first with python research/dual-axis-v1/build.py')
    rows=[json.loads(line) for line in args.corpus.read_text(encoding='utf-8').splitlines() if line.strip()]
    if not rows:raise ValueError('No corpus rows')
    ids=[r['id'] for r in rows]
    if len(ids)!=len(set(ids)):raise ValueError('Duplicate input IDs')
    args.output.mkdir(parents=True,exist_ok=True)
    by_lang=collections.defaultdict(list)
    for r in rows:
        if r['language'] not in LANGUAGES:raise ValueError('Unexpected locale')
        by_lang[r['language']].append(r)
    for lang in LANGUAGES:
        if not by_lang[lang]:raise ValueError(f'No review rows for {lang}')
        for reviewer in ('A','B'):
            path=args.output/f'{lang}_{reviewer}.csv'
            with path.open('w',encoding='utf-8-sig',newline='') as f:
                writer=csv.DictWriter(f,fieldnames=FIELDS)
                writer.writeheader()
                for r in by_lang[lang]:
                    writer.writerow({'id':r['id'],'language':lang,'text':r['text'],
                                     'review_topic':'','review_interaction':'',
                                     'naturalness':'','baby_directed':'',
                                     'native_speaker_confirmed':'','reviewer_id':'','notes':''})
    # Only the adjudicator receives candidate seed labels, explicitly separate
    # from the blinded reviewer packets.
    with (args.output/'adjudication_seed_key.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['id','language','draft_topic','draft_interaction','semantic_family','split','source'])
        w.writeheader()
        for r in rows:
            w.writerow({'id':r['id'],'language':r['language'],'draft_topic':r['topic'],
                        'draft_interaction':r['interaction'],
                        'semantic_family':r['semantic_family'],'split':r['split'],'source':r['source']})
    info={'type':'independent_blinded_native_review','rows':len(rows),
          'by_language':{k:len(by_lang[k]) for k in LANGUAGES},
          'packet_files':14,'seed_label_key_is_separate':True,
          'auto_approved':0,'native_speaker_reviewers_recruited':False,
          'instructions':'Two DIFFERENT human/native-speaking reviewers per language; use allowed labels, choose none/generic explicitly; do not infer missing labels. Naturalness and baby-directed must both be yes to accept.'}
    (args.output/'manifest.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(info,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
