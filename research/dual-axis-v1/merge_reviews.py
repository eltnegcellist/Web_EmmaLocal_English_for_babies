#!/usr/bin/env python3
"""Merge 2 independent, blinded human label reviews without auto-approving seeds.

Only identical fully filled A/B labels by distinct self-identified native
reviewers can become candidate human-reviewed data. Identity/native claims
require external verification by project owner, never inferred here.
"""
import argparse, collections, csv, json
from pathlib import Path
HERE=Path(__file__).resolve().parent
REPO=HERE.parents[1]
LANGUAGES=('en','de','fr','ko','th','zh','hi')
REQUIRED=('id','language','text','review_topic','review_interaction',
          'naturalness','baby_directed','native_speaker_confirmed','reviewer_id','notes')
def get_csv(path):
    with path.open('r',encoding='utf-8-sig',newline='') as f:
        rows=list(csv.DictReader(f))
    ids=[r['id'] for r in rows]
    if len(ids)!=len(set(ids)):raise ValueError(f'Duplicate reviewed ID in {path}')
    for r in rows:
        if set(REQUIRED)-set(r):raise ValueError(f'Missing review columns in {path}')
    return {r['id']:r for r in rows}
def main():
    p=argparse.ArgumentParser()
    p.add_argument('--packets',type=Path,default=HERE/'outputs/reviewer_packets')
    p.add_argument('--corpus',type=Path,default=HERE/'outputs/starter_corpus.jsonl')
    p.add_argument('--output',type=Path,default=HERE/'outputs/review_merge')
    args=p.parse_args()
    conf=json.loads((REPO/'multilingual-assets/heads/config.json').read_text(encoding='utf-8'))
    topics=set(conf['heads']['topic']['classes']);ints=set(conf['heads']['interaction']['classes'])
    allrows=[json.loads(x) for x in args.corpus.read_text(encoding='utf-8').splitlines() if x]
    index={r['id']:r for r in allrows}
    if len(index)!=len(allrows):raise ValueError('Duplicate original row IDs')
    accepted=[];needs=[];counts=collections.Counter()
    for lang in LANGUAGES:
        a=get_csv(args.packets/f'{lang}_A.csv')
        b=get_csv(args.packets/f'{lang}_B.csv')
        expected={r['id'] for r in allrows if r['language']==lang}
        if set(a)!=expected or set(b)!=expected:
            raise ValueError(f'Review packet IDs missing/unexpected in {lang}')
        for ident in sorted(expected):
            r=index[ident];x=a[ident];y=b[ident]
            for z in (x,y):
                if z['text']!=r['text'] or z['language']!=r['language']:
                    raise ValueError(f'Review row text/language tampered: {ident}')
            def normalized(z,key):return (z.get(key) or '').strip()
            fields=('review_topic','review_interaction','naturalness',
                    'baby_directed','native_speaker_confirmed','reviewer_id')
            if any(not normalized(z,k) for z in (x,y) for k in fields):
                needs.append({'id':ident,'language':lang,'status':'INCOMPLETE'})
                counts['incomplete']+=1;continue
            if any(normalized(z,'native_speaker_confirmed').lower()!='yes' for z in (x,y)):
                needs.append({'id':ident,'language':lang,'status':'NATIVE_REVIEW_NOT_CONFIRMED'})
                counts['unconfirmed']+=1;continue
            if normalized(x,'reviewer_id')==normalized(y,'reviewer_id'):
                needs.append({'id':ident,'language':lang,'status':'REVIEWERS_NOT_INDEPENDENT'})
                counts['non_independent']+=1;continue
            xx=(normalized(x,'review_topic'),normalized(x,'review_interaction'))
            yy=(normalized(y,'review_topic'),normalized(y,'review_interaction'))
            if xx[0] not in topics or xx[1] not in ints or yy[0] not in topics or yy[1] not in ints:
                needs.append({'id':ident,'language':lang,'status':'UNKNOWN_LABEL',
                              'review_a':xx,'review_b':yy})
                counts['invalid_labels']+=1;continue
            if xx!=yy:
                needs.append({'id':ident,'language':lang,'status':'LABEL_DISAGREEMENT',
                              'review_a':xx,'review_b':yy})
                counts['disagreement']+=1;continue
            if any(normalized(z,k).lower()!='yes' for z in (x,y) for k in ('naturalness','baby_directed')):
                needs.append({'id':ident,'language':lang,'status':'NATURALNESS_OR_INFANT_REGISTER_REJECTED'})
                counts['rejected']+=1;continue
            row=dict(r)
            row.update({'id':'reviewed-'+ident,'topic':xx[0],'interaction':xx[1],
                        'supervision_axis':'both','label_reviewed':True,'native_speaker_reviewed':True,
                        'source':'two_independent_human_native_reviews',
                        'reviewers':[normalized(x,'reviewer_id'),normalized(y,'reviewer_id')],
                        'review_provenance':'A/B blinded signed review; human identities must be verified outside program'})
            accepted.append(row)
            counts['accepted']+=1
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/'accepted_reviewed.jsonl').write_text(
        ''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in accepted),encoding='utf-8')
    (args.output/'needs_adjudication.jsonl').write_text(
        ''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in needs),encoding='utf-8')
    report={'raw_rows':len(allrows),'accepted':len(accepted),'statuses':dict(counts),
            'reviewed_only_after_two_independent_human_native_speaker_checks':True,
            'native_speaker_identity_verified_by_software':False,
            'production_ready':False}
    (args.output/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
