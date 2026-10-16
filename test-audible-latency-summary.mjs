import assert from 'node:assert/strict';
import {summarizeAcousticTrials} from './scripts/audit-mic-to-audible.mjs';

const good={device:'Galaxy S25',success:true,speech_start_ms:0,speech_end_ms:1000,
            audible_onset_ms:1800,onset_source:'acoustic'};
const data={trials:[good,{...good,speech_end_ms:800,audible_onset_ms:1800},
                         {device:'Mac',success:false,failure_reason:'VAD timeout'}]};
let output=summarizeAcousticTrials(data);
const s25=output.devices.find(x=>x.device==='Galaxy S25');
assert.equal(s25.end_to_audible_median_ms,900);
assert.equal(s25.end_to_audible_p95_ms,1000);
assert.equal(s25.start_to_audible_median_ms,1800);
assert.equal(s25.enough_trials,false);
assert.equal(output.devices.find(x=>x.device==='Mac').failures,1);
assert.equal(output.devices.find(x=>x.device==='Mac').end_to_audible_median_ms,null);
assert.throws(()=>summarizeAcousticTrials({trials:[{...good,onset_source:'play-api'}]}),/acoustically/);
assert.throws(()=>summarizeAcousticTrials({trials:[{...good,audible_onset_ms:500}]}),/Invalid/);
assert.throws(()=>summarizeAcousticTrials({trials:[{...good,success:false,failure_reason:''}]}),/reason/);
console.log('Mic-to-acoustic-onset aggregate: synthetic tests PASS; no device was measured.');
