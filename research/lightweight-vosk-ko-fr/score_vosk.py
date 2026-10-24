#!/usr/bin/env python3
"""Research-only, fixed-audio Korean/French Vosk Small -> frozen E5 classifier.
The same 22 WAV files are reused by previous Whisper comparison, no retraining.
"""
import argparse,hashlib,io,json,statistics,sys,time,urllib.request,wave,zipfile
from pathlib import Path
import numpy as np
import vosk

REPO=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(REPO/'research/e5-interaction-v3/scripts'))
from train_interaction import FrozenE5,fetch_prod_heads
sys.path.insert(0,str(REPO/'research/asr-ruri-comparison'))
from score_foreign import load_models,pred,edit_distance,norm

SOURCES={
    'ko':('vosk-model-small-ko-0.22','https://alphacephei.com/vosk/models/vosk-model-small-ko-0.22.zip',82),
    'fr':('vosk-model-small-fr-0.22','https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip',41),
    'hi':('vosk-model-small-hi-0.22','https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip',42),
}
SHA=lambda b:hashlib.sha256(b).hexdigest()

def fetch_model(lang,dest):
    model_name,url,expected_mb=SOURCES[lang]
    dest.mkdir(parents=True,exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CooTrio-ASR-research/1'}),timeout=90) as response:
        blob=response.read(150_000_000+1)
    if len(blob)>150_000_000 or len(blob)<5_000_000:raise ValueError('Unexpected Vosk archive byte length')
    hash_value=SHA(blob)
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        for info in zf.infolist():
            path=Path(info.filename)
            if path.is_absolute() or '..' in path.parts or path.parts[0]!=model_name or info.file_size>300_000_000:
                raise ValueError('Unsafe or unexpected model archive member')
            if info.is_dir():continue
            to=dest/path
            to.parent.mkdir(parents=True,exist_ok=True)
            with zf.open(info) as inp,to.open('wb') as o:
                while True:
                    part=inp.read(1<<20)
                    if not part:break
                    o.write(part)
    print('VOSK MODEL',model_name,'model_archive_sha256',hash_value,'archive_bytes',len(blob),'license','Apache-2.0',flush=True)
    return dest/model_name,hash_value,len(blob)

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--language',choices=['ko','fr','hi'],required=True)
    p.add_argument('--audio-dir',type=Path,required=True)
    p.add_argument('--candidate-heads',type=Path,required=True)
    p.add_argument('--out',type=Path,default=HERE/'outputs')
    args=p.parse_args()
    lang=args.language
    data=json.loads((args.audio_dir/'manifest.json').read_text(encoding='utf8'))
    refs=data['examples']
    if data['language']!=lang or len(refs)!=22 or data['human_spoken']:
        raise ValueError('Expected a 22-item synthetic research audio corpus')
    model_dir,model_hash,model_bytes=fetch_model(lang,Path('/tmp/cootrio-vosk')/lang)
    vosk.SetLogLevel(-1)
    model=vosk.Model(str(model_dir))
    c,baseline=fetch_prod_heads(REPO/'multilingual-assets/heads',offline=True)
    labels={axis:c['heads'][axis]['classes'] for axis in ('topic','interaction')}
    candidates=load_models(args.candidate_heads,labels['interaction'])
    e5=FrozenE5(threads=2)
    result_rows=[]
    for i,r in enumerate(refs,1):
        file=args.audio_dir/r['audio_file']
        if SHA(file.read_bytes())!=r['wav_sha256']:raise ValueError('Audio sha mismatch')
        with wave.open(str(file),'rb') as wav:
            if (wav.getnchannels(),wav.getsampwidth(),wav.getframerate())!=(1,2,16000):
                raise ValueError('Unexpected audio format')
            pcm=wav.readframes(wav.getnframes())
        recognizer=vosk.KaldiRecognizer(model,16000)
        start=time.perf_counter()
        for n in range(0,len(pcm),6400):
            recognizer.AcceptWaveform(pcm[n:n+6400])
        out=json.loads(recognizer.FinalResult())
        elapsed=(time.perf_counter()-start)*1000
        recognized=(out.get('text') or '').strip()
        embedding=e5.embed(recognized or ' ')
        predictions={}
        for name,weight in [('v2',baseline['interaction']),('shared',candidates['shared']),('local',candidates[lang])]:
            predictions[name]={'topic':pred(baseline['topic'],embedding,labels['topic']),
                               'interaction':pred(weight,embedding,labels['interaction'])}
        result_rows.append({**r,'asr_text':recognized,
                 'recognition_ms':round(elapsed,2),'predictions':predictions,
                 'cer_numerator':edit_distance(norm(r['text']),norm(recognized)),
                 'cer_denominator':len(norm(r['text']))})
        print(f"RESULT {lang} {i}/22 {r['id']} {round(elapsed,1)}ms transcription={recognized}",flush=True)
    scores={}
    for name in ('v2','shared','local'):
        tp=sum(r['topic']==r['predictions'][name]['topic'] for r in result_rows)
        it=sum(r['interaction']==r['predictions'][name]['interaction'] for r in result_rows)
        both=sum(r['topic']==r['predictions'][name]['topic'] and
                 r['interaction']==r['predictions'][name]['interaction'] for r in result_rows)
        scores[name]={'n':22,'topic_correct':tp,'interaction_correct':it,'joint_correct':both,
                      'topic_rate':round(tp/22,4),'interaction_rate':round(it/22,4),'joint_rate':round(both/22,4)}
    report={'status':'RESEARCH_SYNTHETIC_NOT_PRODUCTION','language':lang,
            'asr_model':SOURCES[lang][0],'license':'Apache-2.0','model_zip_sha256':model_hash,
            'model_archive_bytes':model_bytes,'audio':'Moonshine TTS 22 locked synthetic wav clips',
            'language_classification_model':'E5 same native CPU shared encoder; frozen Topic plus previously trained shared/locale Interaction',
            'cer':round(sum(r['cer_numerator'] for r in result_rows)/sum(r['cer_denominator'] for r in result_rows),4),
            'median_asr_ms':round(statistics.median(r['recognition_ms'] for r in result_rows),1),
            'scores':scores,
            'limitations':['Unreviewed translated 22 caregiver templates',
                           'No human-recorded speech; no native-speaker audit',
                           'Native Linux CPU inference not WebAssembly or Android timing']}
    dest=args.out/lang;dest.mkdir(parents=True,exist_ok=True)
    (dest/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    (dest/'predictions.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in result_rows),encoding='utf8')
    print('VOSK_LIGHTWEIGHT_E5_RESULT '+json.dumps(report,ensure_ascii=False,indent=2),flush=True)

if __name__=='__main__':main()
