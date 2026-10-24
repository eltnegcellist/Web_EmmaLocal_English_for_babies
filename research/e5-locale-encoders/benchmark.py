#!/usr/bin/env python3
"""Research only. Frozen E5 shared head vs per-language heads vs locale encoder.
Never trains encoder weights and never writes to multilingual-assets/heads/.
"""
import argparse, base64, csv, hashlib, json, sys, time, unicodedata, zlib
from collections import Counter
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression

REPO=Path(__file__).resolve().parents[2]
V3=REPO/"research/e5-interaction-v3"
sys.path.insert(0,str(V3/"scripts"))
from train_interaction import FrozenE5, fetch_prod_heads

CANDIDATES={
 "en":("BAAI/bge-small-en-v1.5","mit"),
 "de":("deepset/gbert-base","mit"),
 "fr":("dangvantuan/sentence-camembert-base","apache-2.0"),
 "ko":("dragonkue/multilingual-e5-small-ko-v2","apache-2.0"),
 "th":("alphaedge-ai/multilingual-e5-small-tha-16384","mit"),
 "zh":("BAAI/bge-small-zh-v1.5","mit"),
 "hi":("AkshitaS/bhasha-embed-v0","apache-2.0"),
}
HASH=lambda b:hashlib.sha256(b).hexdigest()
def load_data():
    corpus=V3/"data/interaction_v3_training.jsonl"
    locked=V3/"data/locked_154.csv"
    meta=json.loads((V3/"data/manifest.json").read_text())
    if HASH(corpus.read_bytes())!=meta["training"]["sha256"] or HASH(locked.read_bytes())!=meta["locked154"]["sha256"]:
        raise ValueError("Frozen training/diagnostic input SHA256 mismatch")
    items=[json.loads(x) for x in corpus.read_text().splitlines() if x.strip()]
    with locked.open(encoding="utf-8-sig",newline="") as f: held=list(csv.DictReader(f))
    if len(items)!=360 or len(held)!=154: raise ValueError("Dataset size mismatch")
    if {r["family_id"] for r in items if r["split"]=="train"} & {r["family_id"] for r in items if r["split"]=="validation"}:
        raise ValueError("Family leakage between train and validation")
    return items,held
def normalize(text):
    return "".join(c for c in unicodedata.normalize("NFKC",text).casefold() if c.isalnum())
def load_frozen_asr(language,oracles):
    path=REPO/"research/e5-locale-encoders/data/asr374.b85"
    expected="b3572ef5f290456c05f96a708117c9977d49ba88c022314bfd8549a7857bf410"
    if HASH(path.read_bytes())!=expected:raise ValueError("Frozen 374 ASR input SHA256 mismatch")
    raw=base64.b85decode("".join(path.read_text("ascii").split()))
    data=json.loads(zlib.decompress(raw))
    if data.get("schema")!=1 or len(data["oracles"])!=154 or len(data["asr"])!=374:
        raise ValueError("Unexpected frozen ASR reference dataset")
    labels={r["id"]:(r["topic"],r["interaction"]) for r in oracles}
    selected=[]
    for ident,lang,model,text,expected_topic,expected_interaction in data["asr"]:
        if lang!=language:continue
        tp,it=labels[ident]
        selected.append({"id":ident,"language":lang,"model":model,"text":text,
          "topic":tp,"interaction":it,"expected_topic":expected_topic,
          "expected_interaction":expected_interaction})
    if len(selected) not in (44,66):raise ValueError("Per-locale ASR count invalid")
    return selected

def train_head(rows,features,classes,weights=None):
    y=[r["interaction"] for r in rows]
    if set(y)!=set(classes):raise ValueError("Missing Interaction class in training")
    x=np.stack([features[r["text"]] for r in rows])
    lr=LogisticRegression(C=1.0,max_iter=4000,solver="lbfgs",random_state=20261024)
    lr.fit(x,y,sample_weight=weights)
    idx=[list(lr.classes_).index(c) for c in classes]
    return np.concatenate([lr.coef_[idx],lr.intercept_[idx,None]],axis=1).astype("<f4")
def predict(weights,features,rows,classes):
    x=np.stack([features[r["text"]] for r in rows])
    scores=x@weights[:,:-1].T+weights[:,-1]
    return [classes[int(i)] for i in scores.argmax(axis=1)]
def scores(rows,ints,topics=None):
    it=sum(r["interaction"]==p for r,p in zip(rows,ints))
    out={"n":len(rows),"interaction_correct":it,"interaction_accuracy":round(it/len(rows),4)}
    if topics is not None:
        t=sum(r["topic"]==p for r,p in zip(rows,topics))
        both=sum(r["topic"]==p and r["interaction"]==i for r,p,i in zip(rows,topics,ints))
        out.update(topic_correct=t,joint_correct=both,joint_accuracy=round(both/len(rows),4))
    return out

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--lang",choices=sorted(CANDIDATES),required=True)
    parser.add_argument("--allow-unreviewed",action="store_true")
    args=parser.parse_args()
    if not args.allow_unreviewed:raise SystemExit("Synthetic, unreviewed training requires --allow-unreviewed")
    language=args.lang
    out=REPO/"research/e5-locale-encoders/outputs"/language
    out.mkdir(parents=True,exist_ok=True)
    allrows,held=load_data()
    train=[r for r in allrows if r["split"]=="train"]
    local_train=[r for r in train if r["language"]==language]
    local_val=[r for r in allrows if r["split"]=="validation" and r["language"]==language]
    oracle=[{"id":r["id"],"language":r["language"],"text":r["reference_text"],
             "topic":r["gold_topic"],"interaction":r["gold_interaction"],
             "expected_topic":r["oracle_topic"],"expected_interaction":r["oracle_interaction"]}
            for r in held if r["language"]==language]
    if len(local_train)!=(135 if language=="en" else 15) or len(local_val)!=(45 if language=="en" else 15) or len(oracle)!=22:
        raise ValueError("Unexpected per-language split")
    asr=load_frozen_asr(language,oracle)
    training_texts={(r["language"],normalize(r["text"])) for r in train}
    if any((r["language"],normalize(r["text"])) in training_texts for r in oracle):
        raise ValueError("Frozen oracle example leaked into train")

    conf,heads=fetch_prod_heads(REPO/"multilingual-assets/heads",offline=True)
    labels=conf["heads"]["interaction"]["classes"]
    topic_labels=conf["heads"]["topic"]["classes"]
    e5=FrozenE5(threads=2)
    alltexts=list(dict.fromkeys(r["text"] for r in train+local_val+oracle+asr))
    tic=time.monotonic()
    e5_features={text:e5.embed(text) for text in alltexts}
    e5_elapsed=round(time.monotonic()-tic,2)
    baseline=predict(heads["interaction"],e5_features,oracle,labels)
    topic=predict(heads["topic"],e5_features,oracle,topic_labels)
    old_asr=predict(heads["interaction"],e5_features,asr,labels)
    topic_asr=predict(heads["topic"],e5_features,asr,topic_labels)
    repro=[r["id"] for r,p,t in zip(oracle,baseline,topic)
           if p!=r["expected_interaction"] or t!=r["expected_topic"]]
    asr_repro=[(r["id"],r["model"]) for r,p,t in zip(asr,old_asr,topic_asr)
               if p!=r["expected_interaction"] or t!=r["expected_topic"]]
    (out/"baseline_reproduction.json").write_text(json.dumps({"oracle_mismatched":repro,
              "asr_mismatched":asr_repro,"runtime":"native ONNX CPU",
              "expected":"frozen v2 predictions"},indent=2)+"\n")
    if repro or asr_repro:
        raise ValueError(f"Baseline reproduction failed: oracle={len(repro)} ASR={len(asr_repro)}")
    B_local=train_head(local_train,e5_features,labels)
    B_weighted=train_head(train,e5_features,labels, np.asarray(
        [4.0 if r["language"]==language else 1.0 for r in train]))
    model_id,allow_license=CANDIDATES[language]
    from huggingface_hub import HfApi
    info=HfApi().model_info(model_id)
    license_name=(info.card_data.license or "").lower() if info.card_data else ""
    if license_name!=allow_license or license_name not in ("mit","apache-2.0"):
        raise ValueError(f"Disallowed or changed model license: {model_id}: {license_name!r}")
    if not info.sha or len(info.sha)!=40:raise ValueError("No immutable Hugging Face model revision")
    from sentence_transformers import SentenceTransformer
    import torch
    torch.set_num_threads(2)
    tic=time.monotonic()
    encoder=SentenceTransformer(model_id,revision=info.sha,device="cpu",trust_remote_code=False)
    localtexts=list(dict.fromkeys(r["text"] for r in local_train+local_val+oracle+asr))
    modeltexts=[("query: "+s if language in ("ko","th") else s) for s in localtexts]
    embs=encoder.encode(modeltexts, batch_size=16,convert_to_numpy=True,
                        normalize_embeddings=True,show_progress_bar=False)
    dedicated_features={s:np.asarray(v,dtype=np.float32) for s,v in zip(localtexts,embs)}
    encoder_elapsed=round(time.monotonic()-tic,2)
    del encoder
    if not np.isfinite(embs).all():raise ValueError("Dedicated encoder generated NaN")
    C_local=train_head(local_train,dedicated_features,labels)
    methods={"A_shared_v2":(heads["interaction"],e5_features),
             "B_e5_local":(B_local,e5_features),
             "B_e5_weighted":(B_weighted,e5_features),
             "C_dedicated_encoder":(C_local,dedicated_features)}
    comparison={}
    predictions=[]
    for name,(head,features) in methods.items():
        pp_val=predict(head,features,local_val,labels)
        pp_or=predict(head,features,oracle,labels)
        pp_asr=predict(head,features,asr,labels)
        comparison[name]={"validation":scores(local_val,pp_val),
                          "frozen154_oracle":scores(oracle,pp_or,topic),
                          "frozen374_asr":scores(asr,pp_asr,topic_asr),
                          "by_asr":{}}
        for model in sorted(set(r["model"] for r in asr)):
            ids=[i for i,r in enumerate(asr) if r["model"]==model]
            comparison[name]["by_asr"][model]=scores(
                [asr[i] for i in ids],[pp_asr[i] for i in ids],[topic_asr[i] for i in ids])
        for r,q in zip(local_val,pp_val):
            predictions.append({"language":language,"method":name,"subset":"validation",
                                "id":r["id"],"text":r["text"],"gold":r["interaction"],"predicted":q})
        for r,q in zip(oracle,pp_or):
            predictions.append({"language":language,"method":name,"subset":"frozen154",
                                "id":r["id"],"text":r["text"],"gold":r["interaction"],"predicted":q})
        for r,q in zip(asr,pp_asr):
            predictions.append({"language":language,"method":name,
              "subset":"frozen374_"+r["model"],"id":r["id"],"text":r["text"],
              "gold":r["interaction"],"predicted":q})
    payload={"status":"RESEARCH_ONLY_NOT_APPROVED","language":language,
             "e5_model_sha256":e5.model_sha,"dedicated_model":model_id,
             "dedicated_model_revision":info.sha,"dedicated_license":license_name,
             "training_examples":len(local_train),"validation_examples":len(local_val),
             "frozen_oracle_examples":len(oracle),"frozen_asr_examples":len(asr),
             "synthetic_labels_not_reviewed":True,"topic_head_unchanged":True,
             "asr374_evaluation":"COMPLETED_IF_JOB_PASSES",
             "e5_embedding_seconds":e5_elapsed,"dedicated_encoder_seconds":encoder_elapsed,
             "comparison":comparison}
    (out/"comparison.json").write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n")
    with (out/"predictions.csv").open("w",encoding="utf-8",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=list(predictions[0]))
        writer.writeheader();writer.writerows(predictions)
    print(json.dumps({"lang":language,"model":model_id,"scores":comparison},ensure_ascii=False,indent=2))
    print("RESEARCH ONLY: one training example per class for most languages; not production quality.")
if __name__=="__main__":main()
