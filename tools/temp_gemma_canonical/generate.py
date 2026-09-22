#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

PROMPT_VERSION = "standard-emma-canonical-v2"
SCENES = {
    "bath": "親: お風呂入ろうね。場面: これから赤ちゃんがお風呂に入る。",
    "milk": "親: ミルク飲もうね。場面: 赤ちゃんがミルクを飲む。",
    "sleep": "親: 眠そうだね。ねんねしよう。場面: 赤ちゃんが眠る前。",
    "wake": "親: おはよう、起きたね。場面: 赤ちゃんが起きた。",
    "diaper": "親: おむつ替えようね。場面: おむつ交換。",
    "clothes": "親: お着替えしようね。場面: 赤ちゃんの着替え。",
    "hug": "親: 抱っこしようね。場面: 赤ちゃんを抱っこする。",
    "hands": "親: おててぎゅっとしたね。場面: 赤ちゃんの手に注目している。",
    "feet": "親: あんよ動いてるね。場面: 赤ちゃんの足に注目している。",
    "smile": "親: にこにこ笑ったね。場面: 赤ちゃんが笑っている。",
    "cry": "親: 泣いてるね。場面: 赤ちゃんが泣いている。理由、感情、要求は推測しない。",
    "voice": "親: あーって声が出たね。場面: 赤ちゃんが声を出している。意味、感情、要求は推測しない。",
    "tummy": "親: げっぷ出るかな。場面: 授乳後、赤ちゃんを支えてやさしく背中をトントンしている。医学的な助言や結果の断定はしない。",
    "play": "親: 遊ぼうね。場面: 赤ちゃんと遊び始める。具体的なおもちゃはまだ示されていない。",
    "outside": "親: お散歩行こうね。場面: 赤ちゃんと外へ出る。天気や行き先は不明。",
    "rain": "親: 雨が降ってるね。場面: 雨の音や雨に気づいている。濡れているとは限らない。",
    "sun": "親: 今日は明るいね。場面: 明るい日の光に気づいている。暑さや気温は不明。",
    "food": "親: ごはん食べようね。場面: 赤ちゃんの食事を始める。具体的な食べ物や味は不明。",
    "book": "親: 絵本読もうね。場面: 赤ちゃんと絵本を見る。絵本の内容や色は不明。",
    "music": "親: 音楽聴こうね。場面: 赤ちゃんと音楽を一緒に聞く。曲や楽器は不明。",
}

SYSTEM = """You are generating fixed, offline canonical lines for Emma, an English-speaking
character who joins a Japanese-speaking parent and baby in an ordinary family moment.

Emma speaks DIRECTLY TO THE BABY. The parent's Japanese is context, not a sentence to translate.

For EACH candidate:
- English only.
- 3 to 5 very short complete sentences.
- Aim for 10 to 20 spoken words total; under 10 is okay when naturally complete.
- Never exceed 20 words.
- Usually 2 to 6 words per sentence.
- Warm, playful, rhythmic, baby-directed.
- Prefer repetition, sound words, simple reactions, and tiny invitations over explanations.
- Usually no question; never more than one.
- Stay strictly inside the supported scene.
- Do NOT invent colors, objects, weather, actions, feelings, causes, needs, safety claims,
  developmental claims, medical advice, or outcomes that the scene did not provide.
- Do NOT use a baby name.
- Do NOT pad with generic filler such as "Look and listen with me",
  "Emma is right here with you", "One little moment here together",
  or "Here we go together now".
- Make the candidates meaningfully different from one another.

Return ONLY one JSON array of strings. No markdown, labels, or commentary."""

WORD_RE = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)?")
SENT_RE = re.compile(r"(?<=[.!?])\s+")
JP_RE = re.compile(r"[\u3040-\u30ff\u3400-\u9fff]")
FILLER = (
    "look and listen with me",
    "emma is right here with you",
    "one little moment here together",
    "here we go together now",
)

def validate(text: str) -> list[str]:
    reasons=[]
    text=" ".join(text.strip().split())
    words=WORD_RE.findall(text)
    sents=[x for x in SENT_RE.split(text) if x.strip()]
    if not text: reasons.append("empty")
    if JP_RE.search(text): reasons.append("japanese")
    if not 3 <= len(sents) <= 5: reasons.append(f"sentences={len(sents)}")
    if len(words) > 20: reasons.append(f"words={len(words)}")
    if text.count("?") > 1: reasons.append("questions")
    low=text.lower()
    if any(x in low for x in FILLER): reasons.append("filler")
    return reasons

def call(scene: str, context: str, count: int, temperature: float) -> list[str]:
    body={
        "model":"Gemma-4-E2B-it-Q4_0",
        "temperature":temperature,
        "max_tokens":512,
        "messages":[
            {"role":"system","content":SYSTEM},
            {"role":"user","content":f"Scene id: {scene}\nSupported context: {context}\nGenerate {count} different candidates now."},
        ],
    }
    req=urllib.request.Request(
        "http://127.0.0.1:8080/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Content-Type":"application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req,timeout=240) as resp:
        payload=json.loads(resp.read().decode())
    raw=payload["choices"][0]["message"]["content"].strip()
    raw=re.sub(r"^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$", "", raw, flags=re.I|re.S)
    left,right=raw.find("["),raw.rfind("]")
    if left >= 0 and right > left:
        raw=raw[left:right+1]
    parsed=json.loads(raw)
    if not isinstance(parsed,list) or not all(isinstance(x,str) for x in parsed):
        raise ValueError("not a JSON string array")
    return parsed

def main() -> int:
    result={
        "prompt_version":PROMPT_VERSION,
        "generator_model":"Gemma-4-E2B-it-Q4_0",
        "provenance":"Generated on GitHub Actions with llama.cpp and ggml-org/gemma-4-E2B-it-GGUF:Q4_0",
        "scenes":{},
    }
    for scene,context in SCENES.items():
        accepted=[]
        rejected=[]
        seen=set()
        for attempt in range(1,16):
            if len(accepted)>=5: break
            try:
                candidates=call(scene,context,8,0.85 + (attempt % 3)*0.03)
            except Exception as exc:
                print(f"{scene} attempt {attempt}: {type(exc).__name__}: {exc}",file=sys.stderr)
                time.sleep(1)
                continue
            for candidate in candidates:
                text=" ".join(candidate.strip().split())
                key=text.casefold()
                if key in seen: continue
                seen.add(key)
                reasons=validate(text)
                if reasons:
                    rejected.append({"text":text,"reasons":reasons})
                else:
                    accepted.append(text)
                    print(f"{scene} [{len(accepted)}/5] {text}",flush=True)
                    if len(accepted)>=5: break
        if len(accepted)<5:
            raise SystemExit(f"{scene}: only {len(accepted)} valid candidates")
        result["scenes"][scene]={"context":context,"accepted":accepted[:5],"rejected":rejected}

    out=Path("canonical_emma_phrases.json")
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("CANONICAL_JSON_BEGIN")
    print(out.read_text(encoding="utf-8"))
    print("CANONICAL_JSON_END")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
