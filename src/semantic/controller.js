import { SemanticLiteClient } from './client.js';
import { DIVERSITY_STORAGE_KEY } from '../interaction/diversity.js';
import { describeRuriTurn, appendRuriTurn } from '../interaction/diagnostics.js';

// Conversation behavior is independent of whether the developer UI is visible.
export function createSemanticController({ engine, storage = localStorage, beforeChange = async () => {}, clientFactory, mode = null }) {
  let requested = storage.getItem('emma_semantic_enabled') !== 'false';
  const savedMode = storage.getItem('emma_semantic_mode');
  let selectedMode = mode || (['semantic','guard','lite'].includes(savedMode) ? savedMode : 'semantic');
  let generation = 0, failed = false, lastResponse = null, result = null;
  // The last 20 decisions are session-only and contain no conversational text.
  let routingHistory = [];
  let status = {message: requested ? '意味で話題を判定します。初回の準備でデータを取得します。' : '意味判定を無効にしたため汎用英文を使います。'};
  const listeners = new Set();
  const publish = () => { for (const listener of listeners) listener(api.snapshot); };
  const client = clientFactory ? clientFactory(updateStatus) : new SemanticLiteClient({onStatus:updateStatus});
  function updateStatus(data) { status=data; publish(); }
  const api = {
    client,
    get enabled() { return requested && selectedMode !== 'lite' && !failed; },
    get requested() { return requested; },
    get snapshot() { return {requested, mode:selectedMode, enabled:api.enabled, failed, ready:client.ready, status, lastResponse, result, routingHistory:routingHistory.slice()}; },
    subscribe(listener) { listeners.add(listener);listener(api.snapshot);return () => listeners.delete(listener); },
    async prepare({retry = false} = {}) {
      if (!requested || selectedMode === 'lite' || (failed && !retry)) return false;
      const token=generation;
      failed=false;updateStatus({message:'話題の理解を準備しています…',loading:true});
      try {
        await client.prepare();
        if(token!==generation)return false;
        failed=false;updateStatus({message:'意味で話題を判定できます。',ready:true});return true;
      } catch(error) {
        if(token===generation){failed=true;updateStatus({message:`意味判定を準備できないため、汎用英文で続けます。${error.message}`,error:true});}
        return false;
      }
    },
    async setEnabled(value, {prepare = false, mode = selectedMode} = {}) {
      const token=++generation;
      requested=!!value;failed=false;
      if(['semantic','guard','lite'].includes(mode))selectedMode=mode;
      if(!requested)client.cancel();else client.cancelPending();
      storage.setItem('emma_semantic_enabled',String(requested));
      storage.setItem('emma_semantic_mode',selectedMode);
      updateStatus({message:requested ? '意味で話題を判定します。' : '意味判定を無効にしたため汎用英文を使います。'});
      await beforeChange();
      if(token!==generation)return;
      engine.resetConversationContext();lastResponse=null;result=null;publish();
      if(prepare && requested)await api.prepare({retry:true});
    },
    async setMode(value) {
      if(!['semantic','guard','lite'].includes(value))return;
      const token=++generation;
      selectedMode=value;failed=false;client.cancelPending();
      storage.setItem('emma_semantic_mode',value);publish();
      await beforeChange();
      if(token!==generation)return;
      engine.resetConversationContext();lastResponse=null;result=null;
      if(selectedMode==='lite'){client.cancel();updateStatus({message:'意味判定を無効にしたため汎用英文を使います。'});}
      else {publish();if(requested)await api.prepare({retry:true});}
    },
    async respond(text, name, {isCurrent = () => true} = {}) {
      const token=generation, enabled=api.enabled, mode=selectedMode;
      let prediction;
      if(enabled) {
        try {prediction=await client.predict(text);}
        catch(error) {
          if(token!==generation || !isCurrent())return null;
          failed=true;updateStatus({message:`意味判定ができないため、従来Liteで返答します。${error.message}`,error:true});
        }
      }
      if(token!==generation || !isCurrent())return null;
      if(prediction?.unavailable)updateStatus({message:prediction.message});
      // No keyword fallback; unset interaction preference defaults to ON.
      // An explicit saved OFF remains OFF.
      const interactionEnabled = true; // Both Ruri axes are always active in public Lite.
      lastResponse=engine.respondRuri(text,name,prediction?.topic, prediction?.interaction, interactionEnabled,prediction?.source);
      // Store only template IDs and hashed phrase shingles, never what the parent said.
      try {
        if(typeof engine.exportReplyDiversityState==='function')
          storage.setItem(DIVERSITY_STORAGE_KEY,JSON.stringify(engine.exportReplyDiversityState()));
      } catch { /* Storage denial must never interrupt speaking. */ }
      routingHistory=appendRuriTurn(routingHistory, describeRuriTurn({
        prediction, response:lastResponse, interactionEnabled,
      }));
      result=prediction;publish();return lastResponse;
    },
    respondGeneric(name) {
      lastResponse=engine.respondGeneric(name);result=null;publish();return lastResponse;
    },
    async reset() {
      const token=++generation;client.cancelPending();await beforeChange();
      if(token===generation){engine.resetConversationContext();lastResponse=null;result=null;publish();}
    },
    interrupt:beforeChange,
    cancel() { return api.setEnabled(false); },
    cancelPending() {client.cancelPending();}
  };
  return api;
}
