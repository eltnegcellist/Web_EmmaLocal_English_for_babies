import {SemanticLiteClient} from '../semantic/client.js';
export class LanguageSemanticClient {
  constructor({language,multilingual,onStatus}){
    this.language=language;this.multilingual=multilingual;this.japanese=new SemanticLiteClient({onStatus});
  }
  get active(){return this.language()==='ja'?this.japanese:this.multilingual;}
  get ready(){return this.active.ready;}
  prepare(){return this.active.prepare();}
  predict(text,options){return this.active.predict(text,options);}
  cancel(){this.active.cancel();}
  cancelPending(){this.active.cancelPending();}
}
