"""Local, offline candidates; never writes into the adopted experiment or app banks."""
import os, json, hashlib, time, random, socket, subprocess, argparse
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--experiment-root',type=Path,required=True)
parser.add_argument('--output-dir',type=Path,required=True)
parser.add_argument('--ffmpeg',type=Path,required=True)
args=parser.parse_args()
EXP=args.experiment_root.resolve()
OUT=args.output_dir.resolve();OUT.mkdir(parents=True,exist_ok=True)
os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HOME=str(ROOT/'work/hf-cache'), MPLCONFIGDIR=str(ROOT/'work/mpl'))
def deny(*args, **kwargs): raise RuntimeError('Offline inference only')
socket.socket.connect = socket.socket.connect_ex = socket.getaddrinfo = deny
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
import mlx.core as mx
from mlx_audio.tts.utils import load_model
from importlib.metadata import version
profile=json.loads((EXP/'outputs/adopted_voice/voice_profile.json').read_text())
ref=EXP/profile['reference_audio']
assert hashlib.sha256(ref.read_bytes()).hexdigest()==profile['reference_sha256']
assert profile['generation']['fixed_seed']==1202
ledger=json.loads((ROOT/'research/voice-content-26-review-20261015.json').read_text())
texts={r['number']:r['expected'] for r in ledger['entries']}
# Pronunciation spelling and sentence boundaries are synthesis input only.
# The app's canonical text and text-based IDs remain unchanged.
prompts={9:'Was that a koo?\nI heard you!\nHello, baby!',
11:'Little sips, baby!\nSip, sip!\nHigh five!',
14:'Sip, sip!\nNice little sips!\nNo need to rush!',
16:'Cuddle, cuddle!\nMy sweet baby!\nI love you!',
17:"All done eating?\nWipe, wipe?\nLet's have a look!"}
model_path=EXP/'models/Qwen3-TTS-12Hz-1.7B-Base-8bit'
mx.set_default_device(mx.gpu)
assert mx.metal.is_available()
t=time.perf_counter()
model=load_model(str(model_path)); mx.eval(model.parameters())
print('MODEL LOADED',round(time.perf_counter()-t,2),flush=True)
records=[]
for n,prompt in prompts.items():
 dest=OUT/f'{n}.m4a'; raw=OUT/f'{n}.wav'; record_path=OUT/f'{n}.json'
 if dest.exists() and record_path.exists():
  prior=json.loads(record_path.read_text())
  if prior.get('canonicalText')!=texts[n] or prior.get('synthesisText')!=prompt or prior.get('assembly') or prior.get('segments'):
   raise ValueError('Existing candidate uses different text or rejected assembly; choose a fresh --output-dir')
  assert hashlib.sha256(dest.read_bytes()).hexdigest()==prior['sha256']
  records.append(prior); continue
 random.seed(1202);np.random.seed(1202);mx.random.seed(1202);mx.reset_peak_memory()
 t=time.perf_counter()
 results=list(model.generate(text=prompt,lang_code='English',ref_audio=str(ref),ref_text=profile['reference_text'],split_pattern=None,**profile['generation']['parameters']))
 assert len(results)==1, 'Only one full-utterance generation is allowed'
 sr=int(results[0].sample_rate)
 mx.eval(results[0].audio)
 a=np.asarray(results[0].audio,dtype=np.float32).reshape(-1)
 assert sr==24000 and np.all(np.isfinite(a)) and np.sqrt(np.mean(a*a))>1e-5
 assert not any(r.token_count>=2048 for r in results)
 elapsed=time.perf_counter()-t
 sf.write(raw,a,sr,subtype='FLOAT')
 lufs=float(pyln.Meter(sr).integrated_loudness(a))
 gain=min(-20-lufs,-1-20*np.log10(max(float(np.max(np.abs(a))),1e-12)))
 normalized=OUT/f'{n}-normalized.wav'
 sf.write(normalized,a*10**(gain/20),sr,subtype='PCM_24')
 subprocess.run([str(args.ffmpeg.resolve()),'-hide_banner','-loglevel','error','-y','-i',str(normalized),'-c:a','aac','-profile:a','aac_low','-b:a','96k','-ac','1','-ar','24000','-movflags','+faststart',str(dest)],check=True)
 normalized.unlink()
 rec={'number':n,'canonicalText':texts[n],'synthesisText':prompt,'seed':1202,'referenceSha256':profile['reference_sha256'],'modelId':profile['generation']['model_id'],'modelRevision':profile['generation']['model_revision'],'parameters':profile['generation']['parameters'],'effectiveIclRepetitionPenalty':1.5,'runtimeVersions':{p:version(p) for p in ['mlx','mlx-audio','numpy']},'sampleRate':sr,'durationSeconds':len(a)/sr,'processingSeconds':elapsed,'rawSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bytes':dest.stat().st_size,'lufsBefore':lufs,'gainDb':gain,'lufsTarget':-20,'peakBefore':float(np.max(np.abs(a))),'offlineInference':True,'humanVerdict':'pending','tokenCount':sum(r.token_count for r in results)}
 record_path.write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n');records.append(rec)
 print('GENERATED',n,round(elapsed,2),rec['durationSeconds'],flush=True)
 mx.clear_cache()
(OUT/'generation.json').write_text(json.dumps({'audioIssuesResolved':False,'candidates':records},ensure_ascii=False,indent=2)+'\n')
