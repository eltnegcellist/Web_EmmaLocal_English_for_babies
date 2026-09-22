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
Return ONLY a JSON array of arrays. Each inner array is ONE reply and contains 3 to 5 complete sentence strings.
Example shape only: [["Bath time!", "Splash, splash!", "Here we go!"], ["Time for a bath!", "Water, water!", "Let's go!"]]
No markdown and no commentary."""

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


ANCHORS = {
    "bath": ("bath", "water", "splash"),
    "milk": ("milk", "sip", "drink"),
    "sleep": ("sleep", "sleepy", "rest", "night-night"),
    "wake": ("morning", "awake", "wake", "hello"),
    "diaper": ("diaper", "change"),
    "clothes": ("dress", "clothes", "sock"),
    "hug": ("hug", "hold", "cuddle", "snuggle"),
    "hands": ("hand", "finger"),
    "feet": ("feet", "foot", "toe", "kick", "wiggle"),
    "smile": ("smile",),
    "cry": ("hear", "voice", "sound", "cry"),
    "voice": ("voice", "sound", "hear"),
    "tummy": ("tummy", "belly", "burp"),
    "play": ("play", "toy"),
    "outside": ("outside", "walk", "out"),
    "rain": ("rain", "pitter", "drop"),
    "sun": ("sun", "sunshine", "bright", "light"),
    "food": ("food", "eat", "meal", "bite"),
    "book": ("book", "read", "page", "story"),
    "music": ("music", "song", "sound", "listen"),
}

BANNED = {
    "bath": ("warm", "bubble", "clean", "dirty", "happy", "love"),
    "milk": ("yummy", "warm", "full", "hungry", "all", "more milk", "good drink", "happy"),
    "sleep": ("music", "song", "happy", "needs", "need to", "must"),
    "wake": ("sun", "weather", "happy", "smile"),
    "diaper": ("dirty", "wet", "clean", "fresh", "comfy", "comfortable", "inside", "legs", "bright"),
    "clothes": ("strong", "walking", "shoes", "fit well", "pretty", "color"),
    "hug": ("love", "safe", "happy"),
    "hands": ("clap", "wave", "happy"),
    "feet": ("happy",),
    "smile": ("happy", "because"),
    "cry": ("okay", "all right", "happy", "peace", "love", "need", "hungry", "sleepy", "hurt"),
    "voice": ("happy", "funny", "means", "need", "hungry", "sleepy", "spoke", "talked"),
    "tummy": ("full", "happy", "nice", "good burp", "big tummy", "rest now", "comfortable", "sick"),
    "play": ("you like", "favorite", "happy"),
    "outside": ("sun", "rain", "warm", "cold", "park", "tree", "car", "happy"),
    "rain": ("feel the rain", "wet outside", "wash", "happy"),
    "sun": ("warm", "hot", "happy", "love"),
    "food": ("yummy", "delicious", "hungry", "full", "good eating", "eat it up", "chew"),
    "book": ("picture", "bright", "pretty", "animal", "color"),
    "music": ("happy", "instrument", "close your eyes", "dance", "wiggle"),
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
            {"role": "user", "content": f"Scene id: {scene}\\nSupported context: {context}\\nCreate 8 different canonical Emma replies. EACH reply must be an inner JSON array of 3 to 5 short sentences and must stay under 18 words total."},
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
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"JSON decode retry: {exc}; raw={raw[:300]!r}", flush=True)
        return None

def normalize_candidate(item):
    if isinstance(item, dict):
        item = item.get("text") or item.get("response") or item.get("content") or ""
    if not isinstance(item, str):
        return None
    text = " ".join(item.strip().split())
    if not text or re.search(r"[ぁ-んァ-ン一-龥]", text):
        return None
    if text.count("?") > 1:
        return None

    sentences = [x.strip() for x in SENT_RE.split(text) if x.strip()]
    if len(sentences) < 3:
        return None

    selected = []
    for sentence in sentences[:5]:
        proposed = " ".join(selected + [sentence])
        if selected and len(WORD_RE.findall(proposed)) > 20:
            break
        selected.append(sentence)

    while len(WORD_RE.findall(" ".join(selected))) > 20 and len(selected) > 3:
        selected.pop()

    normalized = " ".join(selected).strip()
    if len(selected) < 3 or len(WORD_RE.findall(normalized)) > 20:
        return None
    return normalized

def scene_safe(scene, text):
    low = text.casefold()
    if not any(anchor in low for anchor in ANCHORS[scene]):
        return False
    if any(term in low for term in BANNED[scene]):
        return False
    return True

def candidate_items(raw):
    if isinstance(raw, dict):
        for key in ("candidates", "responses", "items", "phrases"):
            value = raw.get(key)
            if isinstance(value, list):
                raw = value
                break

    if not isinstance(raw, list):
        return []

    # Preferred format: [["Sentence.", "Sentence.", "Sentence."], ...]
    nested = []
    for item in raw:
        if isinstance(item, list):
            parts = [str(x).strip() for x in item if isinstance(x, str) and str(x).strip()]
            if parts:
                nested.append(" ".join(parts))
        elif isinstance(item, dict):
            value = item.get("sentences") or item.get("lines")
            if isinstance(value, list):
                parts = [str(x).strip() for x in value if isinstance(x, str) and str(x).strip()]
                if parts:
                    nested.append(" ".join(parts))
    if nested:
        return nested

    # Gemma sometimes returns one micro-sentence per array element despite the
    # nested-array instruction. Group those model-written lines in threes.
    flat = [x.strip() for x in raw if isinstance(x, str) and x.strip()]
    if flat and all(len(SENT_RE.split(x)) < 3 for x in flat):
        grouped = []
        for i in range(0, len(flat) - 2, 3):
            grouped.append(" ".join(flat[i:i + 3]))
        return grouped

    return flat

result = {}
for scene, context in SCENES.items():
    accepted = []
    seen = set()
    for attempt in range(1, 9):
        raw = complete(scene, context)
        if raw is None:
            print(f"{scene}: attempt={attempt} malformed JSON, retrying", flush=True)
            continue
        items = candidate_items(raw)
        print(f"{scene}: attempt={attempt} raw_type={type(raw).__name__} items={len(items)}", flush=True)
        for item in items:
            text = normalize_candidate(item)
            if not text or not scene_safe(scene, text):
                continue
            key = text.casefold()
            if key in seen:
                continue
            seen.add(key)
            accepted.append(text)
        print(f"{scene}: attempt={attempt} accepted={len(accepted)}", flush=True)
        if len(accepted) >= 5:
            break
    if len(accepted) < 5:
        print(f"{scene}: raw={json.dumps(raw, ensure_ascii=False)}", flush=True)
        raise SystemExit(f"{scene}: only {len(accepted)} usable candidates")
    result[scene] = accepted[:5]
    print("===SCENE_RESULT_BEGIN===" + scene)
    print(json.dumps(result[scene], ensure_ascii=False))
    print("===SCENE_RESULT_END===" + scene)

print("===GEMMA_CANONICAL_JSON_BEGIN===")
print(json.dumps(result, ensure_ascii=False, indent=2))
print("===GEMMA_CANONICAL_JSON_END===")
