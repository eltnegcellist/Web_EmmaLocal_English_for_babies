export class SemanticLiteClient {
  constructor({ onStatus = () => {}, workerFactory = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }) } = {}) {
    this.onStatus = onStatus; this.workerFactory = workerFactory; this.pending = new Map(); this.seq = 0; this.ready = false; this.worker = null; this.preparing = null;
  }
  prepare() {
    if (this.ready) return Promise.resolve();
    if (this.preparing) return this.preparing;
    const worker = this.worker ||= this.workerFactory();
    worker.onmessage = ({ data }) => {
      if (worker !== this.worker) return;
      if (data.type === 'progress') { this.onStatus(data); return; }
      const request = this.pending.get(data.requestId);
      if (!request) return;
      clearTimeout(request.timer); this.pending.delete(data.requestId);
      if (data.type === 'error') request.reject(Error(data.message));
      else request.resolve(data.result);
    };
    worker.onerror = () => this.cancel('意味判定を開始できませんでした。従来Liteで続けます。');
    const operation = this.request('init', {}, 600000).then(() => { if(worker!==this.worker)throw Error('意味判定を中止しました。'); this.ready = true; this.onStatus({ type: 'progress', ready: true, message: '意味で話題を判定できます。' }); }).catch(error => { if(worker===this.worker)this.cancel(error.message); throw error; }).finally(() => { if(this.preparing===operation)this.preparing=null; });
    this.preparing=operation;return operation;
  }
  request(type, payload, timeout = 30000) {
    if(!this.worker)return Promise.reject(Error('意味判定を中止しました。'));
    return new Promise((resolve, reject) => {
      const requestId = ++this.seq;
      const timer = setTimeout(() => this.cancel('意味判定に時間がかかっています。従来Liteで続けます。'), timeout);
      this.pending.set(requestId, { resolve, reject, timer });
      try { this.worker.postMessage({ type, requestId, ...payload }); }
      catch(error) { clearTimeout(timer);this.pending.delete(requestId);reject(error); }
    });
  }
  async predict(text, { diagnostics = false } = {}) { await this.prepare(); return this.request('predict', { text: String(text), diagnostics }); }
  cancel(message = '意味判定を中止しました。') {
    this.worker?.terminate(); this.worker = null; this.ready = false;
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(Error(message)); }
    this.pending.clear(); this.preparing = null;
  }
  cancelPending() { if (this.pending.size) this.cancel(); }
}
