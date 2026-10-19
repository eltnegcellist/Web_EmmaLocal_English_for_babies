#!/usr/bin/env python3
"""Export the actual animated review gallery as one offline HTML file (no fetch/server)."""
from pathlib import Path
import base64,json,mimetypes,re
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/visual-cue/artwork'
m=json.loads((OUT/'manifest.json').read_text());qa=json.loads((OUT/'qa/validation.json').read_text());legacy=json.loads((OUT/'reference/manifest.json').read_text());paths=set()
for a in m['assets']+m.get('archivedAssets',[]):
 for k in ['animation','illustration','poster']:
  if a.get(k):paths.add(a[k])
 if a.get('animation'):paths.add(f'qa/{a["id"]}-filmstrip.jpg')
 if a.get('productionPass',0)>=5 and a.get('animation'):paths.add(f'qa/{"cup-liquid" if a["productionPass"]==7 else "r3" if a["productionPass"]==6 else "r2"}-allframes/{a["id"]}.jpg')
for a in legacy['assets']:paths.add('reference/'+a['path'])
for c in m['concepts']:
 if c.get('existingFile'):paths.add('../../../'+c['existingFile'])
paths.update(['qa/validation.json','README.md'])
media={p:'data:'+str(mimetypes.guess_type(p)[0] or 'application/octet-stream')+';base64,'+base64.b64encode((OUT/p).read_bytes()).decode() for p in paths if (OUT/p).exists()}
bundle=dict(manifest=m,qa=qa,legacy=legacy,media=media)
html=(OUT/'preview.html').read_text().replace('<link rel="stylesheet" href="preview.css">','<style>'+(OUT/'preview.css').read_text()+'</style>')
js='window.__visualCueBundle='+json.dumps(bundle,ensure_ascii=False).replace('</','<\\/')+';\n'+(OUT/'preview.js').read_text()
html=html.replace('<script type="module" src="preview.js"></script>','<script type="module">'+js+'</script>')
html=html.replace('href="qa/validation.json"','href="'+media['qa/validation.json']+'"').replace('href="README.md"','href="'+media['README.md']+'"')
(OUT/'preview-offline.html').write_text(html)
print('Offline preview:',(OUT/'preview-offline.html').stat().st_size,'bytes;',len(media),'embedded files')
