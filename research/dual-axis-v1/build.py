#!/usr/bin/env python3
"""Build and audit CooTrio bilingual-axis research corpus. Python stdlib only.
Unreviewed synthetic starter seeds are NEVER treated as verified production data.
Existing Interaction corpus may be included read-only, with missing Topic unlabeled.
"""
import argparse, base64, collections, csv, hashlib, json, lzma, re, unicodedata, zlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
CFG=ROOT/'multilingual-assets/heads/config.json'
LANGUAGES=('en','de','fr','ko','th','zh','hi')
EXPECTED_TOPIC=22
EXPECTED_INTERACTION=15
MIN_FAMILIES=30
TARGET_FAMILIES=50
NORMALIZE=lambda s: ''.join(c for c in unicodedata.normalize('NFKC',s).casefold() if c.isalnum())

def checked_json(path):
    return json.loads(path.read_text(encoding='utf-8'))

def load_frozen_inputs():
    """Use checked-in immutable reference corpus. Evaluation stays read-only."""
    loc=ROOT/'research/e5-interaction-v3/data'
    manifest=checked_json(loc/'manifest.json')
    blob=base64.b85decode((loc/'locked154.b85').read_text().strip())
    decoded=lzma.decompress(blob)
    if hashlib.sha256(decoded).hexdigest()!=manifest['locked154']['sha256']:
        raise ValueError('Locked 154 SHA256 mismatch')
    gold=list(csv.DictReader(decoded.decode('utf-8-sig').splitlines()))
    if len(gold)!=154: raise ValueError('Unexpected locked oracle count')
    frozen={(r['language'],NORMALIZE(r['reference_text'])) for r in gold}
    # The fixed ASR input is not itself a training set either.
    f=ROOT/'research/e5-locale-encoders/data/asr374.b85'
    assert hashlib.sha256(f.read_bytes()).hexdigest()=='b3572ef5f290456c05f96a708117c9977d49ba88c022314bfd8549a7857bf410'
    data=json.loads(zlib.decompress(base64.b85decode(''.join(f.read_text().split()))))
    assert len(data['asr'])==374
    frozen.update((r[1],NORMALIZE(r[3])) for r in data['asr'] if r[3].strip())
    return frozen

def make_rows(heads):
    topics=heads['topic']['classes']
    interactions=heads['interaction']['classes']
    if len(topics)!=EXPECTED_TOPIC or len(interactions)!=EXPECTED_INTERACTION:raise ValueError('Production labels changed; inspect schema before generating')
    seeds=[('topic',checked_json(HERE/'data/topic_seed.json'),topics),
           ('interaction',checked_json(HERE/'data/interaction_seed.json'),interactions)]
    rows=[]
    for axis,data,labels in seeds:
        if data['schema']!=1 or data['labels']!=labels:raise ValueError(f'Incorrect {axis} label order')
        if set(data['by_language'])!=set(LANGUAGES):raise ValueError(f'Language mismatch for {axis}')
        for lang in LANGUAGES:
            langmap=data['by_language'][lang]
            if set(langmap)!=set(labels):raise ValueError(f'Incomplete {lang} {axis} seed classes')
            for label in labels:
                texts=langmap[label]
                if len(texts)!=2:raise ValueError(f'Expected two independent {lang}/{axis}/{label} initial seeds')
                for index,utterance in enumerate(texts):
                    if not isinstance(utterance,str) or len(utterance.strip())<5:raise ValueError(f'Invalid seed {lang}/{axis}/{label}/{index}')
                    rows.append({
                        'id':f'v1-{lang}-{axis}-{label}-{index}',
                        'language':lang,'text':utterance.strip(),
                        'topic':label if axis=='topic' else None,
                        'interaction':label if axis=='interaction' else None,
                        'supervision_axis':axis,
                        'semantic_family':f'handseed-{lang}-{axis}-{label}-{index}',
                        'split':'train' if index==0 else 'validation',
                        'source':'assistant_authored_seed',
                        'label_reviewed':False,'native_speaker_reviewed':False,
                        'caution':'Other axis intentionally unknown; do not fill it with generic/none.'
                    })
    return rows

def collect_external(path,heads):
    """Optional future contributions; do not silently invent unspecified labels."""
    if not path:return []
    out=[]
    for i,line in enumerate(path.read_text(encoding='utf-8').splitlines(),1):
        if not line.strip():continue
        r=json.loads(line)
        required={'id','language','text','topic','interaction','semantic_family','split','source','label_reviewed','native_speaker_reviewed'}
        if not required.issubset(r):raise ValueError(f'External row {i} missing {sorted(required-set(r))}')
        if r['language'] not in LANGUAGES:raise ValueError(f'Unsupported external language at row {i}')
        if r['topic'] is not None and r['topic'] not in heads['topic']['classes']:raise ValueError(f'Unknown Topic at row {i}')
        if r['interaction'] is not None and r['interaction'] not in heads['interaction']['classes']:raise ValueError(f'Unknown Interaction at row {i}')
        if r['topic'] is None and r['interaction'] is None:raise ValueError(f'No supervision labels at row {i}')
        if r['split'] not in ('train','validation'):raise ValueError('External row split must be train/validation')
        r['supervision_axis']='both' if (r['topic'] and r['interaction']) else ('topic' if r['topic'] else 'interaction')
        out.append(r)
    return out

def audit(rows,labels,frozen):
    unique={}
    ids=set()
    kept=[]
    skipped=[]
    split_by_family={}
    for r in rows:
        key=(r['language'],NORMALIZE(r['text']))
        if not key[1]:raise ValueError('Empty normalized utterance')
        if r['id'] in ids:raise ValueError('Duplicate source ID '+r['id'])
        ids.add(r['id'])
        if key in frozen:
            skipped.append({'id':r['id'],'reason':'EVALUATION_OVERLAP'})
            continue
        if key in unique:
            skipped.append({'id':r['id'],'reason':'TEXT_DUPLICATE','duplicate_of':unique[key]['id']})
            continue
        unique[key]=r
        family=(r['language'],r['semantic_family'])
        split_by_family.setdefault(family,set()).add(r['split'])
        kept.append(r)
    leaky=[k for k,v in split_by_family.items() if len(v)!=1]
    if leaky:raise ValueError(f'Family leakage across train/validation: {leaky[:10]}')
    counter=collections.defaultdict(lambda:collections.defaultdict(collections.Counter))
    families=collections.defaultdict(lambda:collections.defaultdict(lambda:collections.defaultdict(set)))
    verified=collections.defaultdict(lambda:collections.defaultdict(lambda:collections.defaultdict(set)))
    for r in kept:
        for axis in ('topic','interaction'):
            label=r[axis]
            if label is None:continue
            counter[r['language']][axis][label]+=1
            families[r['language']][axis][label].add(r['semantic_family'])
            if r['label_reviewed'] and r['native_speaker_reviewed']:
                verified[r['language']][axis][label].add(r['semantic_family'])
    coverage={}
    for lang in LANGUAGES:
        coverage[lang]={}
        for axis in ('topic','interaction'):
            coverage[lang][axis]={}
            for label in labels[axis]:
                n=counter[lang][axis][label]
                family_n=len(families[lang][axis][label])
                reviewed_n=len(verified[lang][axis][label])
                coverage[lang][axis][label]={
                    'utterances':n,'unique_semantic_families':family_n,
                    'native_reviewed_families':reviewed_n,
                    'remaining_to_min30_reviewed':max(0,MIN_FAMILIES-reviewed_n),
                    'remaining_to_target50_reviewed':max(0,TARGET_FAMILIES-reviewed_n)
                }
    return kept,skipped,coverage

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--additional-jsonl',type=Path,help='Optional audited contribution records with explicit both-axis labels or null for unknown')
    p.add_argument('--output',type=Path,default=HERE/'outputs')
    args=p.parse_args()
    heads=checked_json(CFG)['heads']
    labels={axis:heads[axis]['classes'] for axis in ('topic','interaction')}
    assert len(labels['topic'])==22 and len(labels['interaction'])==15
    rows=make_rows(heads)+collect_external(args.additional_jsonl,heads)
    kept,skipped,coverage=audit(rows,labels,load_frozen_inputs())
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/'starter_corpus.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in kept),encoding='utf-8')
    (args.output/'excluded.json').write_text(json.dumps(skipped,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (args.output/'coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    total=collections.Counter(r['supervision_axis'] for r in kept)
    reviewed=sum(bool(r['label_reviewed'] and r['native_speaker_reviewed']) for r in kept)
    report={
        'classification_axes':{'topic':22,'interaction':15,'label_total':37,'theoretical_pairs':330},
        'languages':list(LANGUAGES),'starter_rows_kept':len(kept),
        'by_axis':dict(total),'excluded_overlap_or_duplicate':len(skipped),
        'human_and_native_reviewed_rows':reviewed,
        'ready_for_production':False,
        'meaning_family_target_per_axis_per_language':TARGET_FAMILIES,
        'minimum_reviewed_families_per_axis_per_language':MIN_FAMILIES,
        'important':'Count independently reviewed meaning families, not mechanical paraphrase variants.',
        'frozen_eval_154_374_never_train':True
    }
    (args.output/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    assert reviewed==0 or args.additional_jsonl, 'Unreviewed seeds must never be marked reviewed'

if __name__=='__main__':main()
