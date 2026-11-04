import {createThermal} from './thermal.mjs';
let model=null,generation=0,inflight=null;
function rollback(){if(inflight&&inflight.model===model)model.restore(inflight.before);inflight=null;}
self.onmessage=async({data})=>{
 const {id,type}=data;
 try{
  if(type==='cancel'){rollback();generation++;self.postMessage({id,type:'cancelled'});return;}
  if(type==='init'){rollback();generation++;model=createThermal(data.config);self.postMessage({id,type:'ready',snapshot:model.snapshot(),mesh:model.mesh});return;}
  if(!model)throw Error('実験を選んで初期化してください。');
  if(type==='restore'){rollback();generation++;self.postMessage({id,type:'result',snapshot:model.restore(data.snapshot),flux:model.flux()});return;}
  if(type!=='advance')throw Error('未対応の計算要求です。');
  const token=++generation,start=model.time,end=start+data.duration;inflight={model,before:model.snapshot()};
  if(!Number.isFinite(end)||data.duration<=0||data.duration>1e5)throw Error('進行時間が不正です。');
  const maximum=data.dt??model.safeDt;if(!(maximum>0))throw Error('時間刻みは正です。');
  if(Number.isFinite(model.safeDt)&&maximum>model.safeDt*(1+1e-12))throw Error('指定の時間刻みが安定性上限を超えます。');
  let n=0;
  while(model.time<end-1e-12){
   if(token!==generation)return;
   const now=model.time,dt=Math.min(maximum,end-now);model.step(dt,false);n++;
   if(n>100000)throw Error('一回の計算量が上限を超えました。表示間隔か格子を小さくしてください。');
   if(n%100===0){self.postMessage({id,type:'progress',fraction:(model.time-start)/data.duration});await new Promise(resolve=>setTimeout(resolve,0));}
  }
  const snapshot=model.snapshot();if(snapshot.relativeEnergyError>1e-8)throw Error('エネルギー収支の誤差が監視上限を超えたため停止しました。');
  inflight=null;self.postMessage({id,type:'result',snapshot,flux:model.flux()});
 }catch(error){rollback();generation++;self.postMessage({id,type:'error',message:error.message});}
};
