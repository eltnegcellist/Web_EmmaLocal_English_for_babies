// GitHub Pages repositories on the same account share an origin. Trial
// preferences must not read, overwrite or clear the production app's settings.
export function createTrialStorage(storage,prefix='emma_visual_cue_trial_v1:'){
 const keys=()=>Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(k=>k?.startsWith(prefix));
 return {
  get length(){return keys().length;},
  key(index){return keys()[index]?.slice(prefix.length)??null;},
  getItem(key){return storage.getItem(prefix+key);},
  setItem(key,value){storage.setItem(prefix+key,String(value));},
  removeItem(key){storage.removeItem(prefix+key);},
  clear(){for(const key of keys())storage.removeItem(key);}
 };
}
