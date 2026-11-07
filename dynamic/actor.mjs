// Shared asynchronous CPU-model transport. Rendering and physical models stay separate.
export class Actor{
 constructor({progress=()=>{},fatal=()=>{},workerURL=new URL('./worker.mjs',import.meta.url)}={}){
  this.pending=new Map();this.id=0;this.failure=null;try{this.worker=new Worker(workerURL,{type:'module'});}catch(error){this.failure=Error('計算Workerを起動できませんでした。対応ブラウザーと設定を確認してください。');queueMicrotask(()=>fatal(this.failure));return;}
  this.worker.onmessage=({data})=>{const p=this.pending.get(data.id);if(!p)return;if(data.type==='progress'){progress(data.fraction);return;}this.pending.delete(data.id);data.type==='error'?p.reject(Error(data.message)):p.resolve(data);};
  this.worker.onerror=event=>{const error=Error('計算Workerを読み込めませんでした。再読み込みしてください。');this.failure=error;for(const p of this.pending.values())p.reject(error);this.pending.clear();fatal(error);event.preventDefault();};
 }
 request(type,values={}){if(this.failure)return Promise.reject(this.failure);return new Promise((resolve,reject)=>{const id=++this.id;this.pending.set(id,{resolve,reject});try{this.worker.postMessage({id,type,...values});}catch(error){this.pending.delete(id);reject(error);}});}
 cancel(){this.worker?.postMessage({id:++this.id,type:'cancel'});for(const p of this.pending.values())p.reject(Error('cancelled'));this.pending.clear();}
 close(){this.cancel();this.worker?.terminate();}
}
