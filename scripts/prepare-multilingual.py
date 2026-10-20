"""Lock/retrieve public model files; never sends speech to a server."""
from pathlib import Path
import argparse, hashlib, json, shutil, urllib.request
ROOT=Path(__file__).resolve().parents[1]
MODELS={
 'e5':('Xenova/multilingual-e5-small','761b726dd34fb83930e26aab4e9ac3899aa1fa78',
       ['config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/model_quantized.onnx']),
 'whisper':('Xenova/whisper-small','2d67713f236afa48a18992566e7647f6ca848e13',
       ['config.json','generation_config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json',
        'preprocessor_config.json','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx'])}
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def get(url):
 with urllib.request.urlopen(url,timeout=120) as r:return r.read()
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--download',action='store_true');args=parser.parse_args()
 dest=ROOT/'multilingual-assets';dest.mkdir(exist_ok=True)
 manifest={'schema':1,'runtime':'transformers.js-3.8.1','models':{},'assets':[]}
 for key,(repo,rev,files) in MODELS.items():
  metadata=json.loads(get(f'https://huggingface.co/api/models/{repo}/revision/{rev}?blobs=true'))
  assert metadata['sha']==rev
  siblings={s['rfilename']:s for s in metadata['siblings']}
  manifest['models'][key]={'id':repo,'revision':rev,'dtype':'q8','license':'MIT' if key=='e5' else 'Apache-2.0'}
  for name in files:
   url=f'https://huggingface.co/{repo}/resolve/{rev}/{name}'
   item=siblings[name];target=dest/'models'/key/name
   expected=item.get('lfs',{}).get('sha256')
   if not expected:
    data=get(url);expected=hashlib.sha256(data).hexdigest();size=len(data)
   else:size=item['size'];data=None
   manifest['assets'].append({'model':key,'file':name,'url':url,'bytes':size,'sha256':expected})
   if args.download:
    target.parent.mkdir(parents=True,exist_ok=True)
    if target.exists() and target.stat().st_size==size and sha(target)==expected:continue
    partial=target.with_name(target.name+'.part')
    if data is not None:partial.write_bytes(data)
    else:
     with urllib.request.urlopen(url,timeout=180) as source,partial.open('wb') as output:shutil.copyfileobj(source,output)
    assert partial.stat().st_size==size and sha(partial)==expected,name
    partial.replace(target);print('verified',key,name,size,flush=True)
 (ROOT/'src/multilingual/assets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 import subprocess
 subprocess.run(['node','scripts/build-multilingual-runtime.mjs'],cwd=ROOT,check=True)
 print('manifest locked; total model bytes',sum(x['bytes'] for x in manifest['assets']))
if __name__=='__main__':main()
