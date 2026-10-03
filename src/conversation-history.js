export const HISTORY_LIMIT = 1000;
export function historyEnabled(storage) { return storage.getItem('emma_history_enabled') !== 'false'; }
export function createHistoryEntry(sessionId,japaneseText,englishText,topic,engine='lite') {
  return {schemaVersion:1,id:crypto.randomUUID(),sessionId,createdAt:new Date().toISOString(),japaneseText,englishText,topic:topic||'general',engine,source:'conversation'};
}
export class ConversationHistory {
  constructor(factory=globalThis.indexedDB) { this.factory=factory; this.opening=null; }
  open() {
    return this.opening ||= new Promise((resolve,reject)=>{
      if(!this.factory) return reject(new Error('このブラウザでは履歴を保存できません。'));
      const request=this.factory.open('mitsukotoba-conversation-history',1);
      request.onupgradeneeded=()=>{request.result.createObjectStore('entries',{keyPath:'id'}).createIndex('createdAt','createdAt');};
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.opening=null;};resolve(db);};
      request.onerror=()=>{this.opening=null;reject(request.error);};
      request.onblocked=()=>reject(new Error('別のタブを閉じて履歴を開き直してください。'));
    });
  }
  async append(entry) {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('entries','readwrite'), store=tx.objectStore('entries');
      store.put(entry);
      const count=store.count();
      count.onsuccess=()=>{
        let excess=count.result-HISTORY_LIMIT;
        if(excess<=0)return;
        const cursor=store.index('createdAt').openCursor();
        cursor.onsuccess=()=>{if(cursor.result&&excess-- >0){cursor.result.delete();cursor.result.continue();}};
      };
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }
  async list() {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const request=db.transaction('entries').objectStore('entries').index('createdAt').getAll();
      request.onsuccess=()=>resolve(request.result.reverse());request.onerror=()=>reject(request.error);
    });
  }
  async delete(id) {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries');
      if(id===undefined)store.clear();else store.delete(id);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
  }
}
