#!/usr/bin/env python3
"""R3 literal corpus audit; occurrence counts are not semantic assignment approval."""
import collections, hashlib, json, re
from pathlib import Path
root=Path(__file__).resolve().parents[2];src=root/'shared/visual-cue-phrases.json';rows=json.loads(src.read_text())['rows']
terms={term:[r for r in rows if re.search(r'\b'+term+r'\b',r['text'],re.I)] for term in ['tap','wave','sip','drink','squeeze']}
audit=dict(source='shared/visual-cue-phrases.json',sourceSHA256=hashlib.sha256(src.read_bytes()).hexdigest(),totalRows=len(rows),uniqueTexts=len({r['text'] for r in rows}),method='大文字小文字を区別しない単語境界一致。set/行数であり発話回数・実際の利用頻度ではない。ブロックへのtapは全12行の文脈を人が確認。',terms={term:dict(count=len(rs),topics=dict(collections.Counter(r['sourceKey'].split('|')[0] for r in rs)),rows=rs) for term,rs in terms.items()},drinkTopicRows=[r for r in rows if r['sourceKey'].split('|')[0]=='drink'],blockTapContextRows=[],decision='tap12行は雨4・音楽7・足1。ブロックに触れる指示は0行。手振り6行とdrink38行を優先し、ブロックタップを撤回。握る等のCueを手振りに自動で割り当てない。')
(root/'assets/visual-cue/artwork/qa/review-r3-usage.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
print({t:len(rs) for t,rs in terms.items()},'drinkTopic',len(audit['drinkTopicRows']))
