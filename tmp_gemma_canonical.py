#!/usr/bin/env python3
import json
import re
import urllib.request

SYSTEM = """You write canonical baby-directed lines for Emma, an English-speaking character who joins a Japanese-speaking parent and baby in an ordinary family moment.

These lines are generated during app development and later stored as fixed offline data. They are NOT translations. Emma speaks directly to the baby and reacts to the supported moment only.

STYLE RULES:
- Output English only.
- Each candidate is 3 to 5 very short complete sentences.
- Aim for about 10 to 20 spoken words total. A naturally complete reply under 10 words is allowed.
- Never add filler merely to reach a word count.
- Usually 2 to 6 words per sentence.
- Use very common, concrete, easy-to-hear words.
- Prefer rhythm, repetition, playful sound words, invitations, and warm reactions over explanations.
- At most one question; usually use no question.
- Do not invent colors, objects, actions, feelings, causes, needs, or facts not supported by the scene.
- Do not diagnose, reassure about safety, or give medical advice.
- Do not use the baby's name.
- Avoid generic padding.
- Make candidates meaningfully varied while keeping the same Emma personality.
Return ONLY a JSON array of strings. No markdown and no commentary."""

SCENES = {
    "bath": "Parent says: お風呂入ろうね. Scene: bath time is starting. React to bath time, water, or splashing only; do not invent water temperature or claim the baby enjoys it.",
    "milk": "Parent says: ミルク飲もうね / ミルク飲んだね. Scene: milk feeding. React to milk, drinking, or sipping only; do not claim hunger, fullness, taste, amount, or successful feeding.",
    "sleep": "Parent says: 眠そうだね / ねんねしよう. Scene: the baby seems sleepy or sleep time is starting. Do not claim the baby is asleep or tell the parent what the baby needs.",
    "wake": "Parent says: おはよう / 起きたね. Scene: the baby has woken up. React to waking and greeting only; do not invent weather or time beyond morning when explicitly supported.",
    "diaper": "Parent says: おむつ替えようね. Scene: diaper change is starting. React to the change itself; do not claim the diaper is dirty, wet, clean, fresh, or comfortable.",
    "clothes": "Parent says: お着替えしようね / 靴下はこうね. Scene: getting dressed. React to dressing, clothes, arms, legs, or socks only when supported; do not invent colors or textures.",
    "hug": "Parent says: 抱っこしようね / ぎゅっとしようね. Scene: the baby is being held or cuddled. React to being held or a hug; do not claim emotions or safety.",
    "hands": "Parent says: おててぎゅっとしたね / おてて見つけたね. Scene: attention is on the baby's hands or fingers. Do not invent an action unless supported.",
    "feet": "Parent says: 足をバタバタしてるね / あんよ動いてるね. Scene: the baby's feet or legs are moving. React to feet, toes, kicking, or wiggling only when supported.",
    "smile": "Parent says: にこにこしてるね / 笑ったね. Scene: the baby is smiling. React to the visible smile only; do not infer a broader emotion or cause.",
    "cry": "Parent says: 泣いてるね. Scene: the baby is crying. React warmly to hearing the baby's voice without guessing why the baby is crying, what the baby feels, or what the baby needs.",
    "voice": "Parent says: あーって声が出たね / 赤ちゃんが声を出している. Scene: the baby is making a nonverbal sound. React to hearing the voice without interpreting meaning, emotion, or need.",
    "tummy": "Parent says: お腹いっぱいかな / げっぷ出るかな. Scene: after feeding, attention is on the baby's tummy or a gentle burp. Do not claim the baby is full, comfortable, sick, or needs anything.",
    "play": "Parent says: 遊ぼうね / おもちゃ見てるね. Scene: play time. React only to play and, if explicitly mentioned, the toy; do not invent a specific toy, color, or action.",
    "outside": "Parent says: お散歩行こうね / お外に行こうね. Scene: going outside or for a walk. React to going out, walking, looking, or listening; do not invent weather, objects, or destination.",
    "rain": "Parent says: 雨が降ってるね. Scene: rain is falling. React to rain or its sound; do not claim the baby can see or feel it unless supported.",
    "sun": "Parent says: 今日は晴れてるね / 明るいね. Scene: a bright sunny day. React only to brightness, sunshine, or the day being bright; do not invent temperature.",
    "food": "Parent says: ごはん食べようね / 離乳食の時間だよ. Scene: meal time is beginning. Do not claim taste, hunger, fullness, or successful eating.",
    "book": "Parent says: 絵本読もうね. Scene: parent and baby are about to look at a picture book together. Do not invent anything shown in the book.",
    "music": "Parent says: 音楽聴こうね / 歌を聴こうね. Scene: parent and baby are listening to music. Do not invent a specific song or instrument."
}

WORD_RE = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)?")
SENT_RE = re.compile(r"(?<=[.!?])\s+")

def complete(scene, context):
    body = {
        "model": "Gemma-4-E2B-it-Q4_0",
        "temperature": 0.8,
        "top_p": 0.9,
        "max_tokens": 768,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Scene id: {scene}\\nSupported context: {context}\\nCreate 12 different canonical Emma candidates."},
        ],
    }
    req = urllib.request.Request(
        "http://127.0.0.1:8080/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        payload = json.load(resp)
    raw = payload["choices"][0]["message"]["content"].strip()
    fence = chr(96) * 3
    if raw.startswith(fence):
        lines = raw.splitlines()[1:]
        if lines and lines[-1].strip().startswith(fence):
            lines = lines[:-1]
        raw = "\n".join(lines).strip()
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    return json.loads(raw)

def valid(text):
    text = " ".join(text.strip().split())
    sentences = [x for x in SENT_RE.split(text) if x.strip()]
    words = WORD_RE.findall(text)
    if not 3 <= len(sentences) <= 5:
        return False
    if len(words) > 20:
        return False
    if text.count("?") > 1:
        return False
    if re.search(r"[ぁ-んァ-ン一-龥]", text):
        return False
    return True

result = {}
for scene, context in SCENES.items():
    accepted = []
    seen = set()
    for attempt in range(1, 4):
        raw = complete(scene, context)
        for item in raw:
            if not isinstance(item, str):
                continue
            text = " ".join(item.strip().split())
            key = text.casefold()
            if key in seen or not valid(text):
                continue
            seen.add(key)
            accepted.append(text)
        print(f"{scene}: attempt={attempt} valid={len(accepted)}", flush=True)
        if len(accepted) >= 5:
            break
    if len(accepted) < 5:
        raise SystemExit(f"{scene}: only {len(accepted)} valid candidates")
    result[scene] = accepted[:5]

print("===GEMMA_CANONICAL_JSON_BEGIN===")
print(json.dumps(result, ensure_ascii=False, indent=2))
print("===GEMMA_CANONICAL_JSON_END===")
