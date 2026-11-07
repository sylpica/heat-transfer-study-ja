// Separate async transport for the dev CPU/WebGPU diffusion factory. The shared
// synchronous CPU Worker runtime remains unchanged. Core advance is atomic.
export function installAsyncDiffusionRuntime(createModel,scope=globalThis){
 let model=null,generation=0,active=null,tail=Promise.resolve();const error=(id,message)=>scope.postMessage({id,type:'error',message});
 scope.onmessage=({data})=>{
  const {id,type}=data??{};
  if(type==='cancel'){generation++;active?.abort();scope.postMessage({id,type:'cancelled'});return;}
  if(!['init','restore','advance'].includes(type)){error(id,'未対応の非同期計算要求です。');return;}
  if(type==='init'||type==='restore'){generation++;active?.abort();}
  const token=generation;
  const execute=async()=>{
   if(token!==generation){error(id,'cancelled');return;}
   try{
    if(type==='init'){
     let candidate=null;try{candidate=await createModel(data);if(token!==generation)throw Error('cancelled');const response={id,type:'ready',snapshot:candidate.snapshot(),mesh:candidate.mesh};model?.close();model=candidate;candidate=null;scope.postMessage(response);}finally{candidate?.close();}return;
    }
    if(!model)throw Error('実験を初期化してください。');
    if(type==='restore'){const snapshot=model.restore(data.snapshot);scope.postMessage({id,type:'result',snapshot});return;}
    const controller=new AbortController();active=controller;
    try{const snapshot=await model.advance({duration:data.duration,dt:data.dt,signal:controller.signal,onProgress:f=>{if(token===generation)scope.postMessage({id,type:'progress',fraction:f});}});if(token!==generation)throw Error('cancelled');scope.postMessage({id,type:'result',snapshot});}finally{if(active===controller)active=null;}
   }catch(cause){error(id,token!==generation?'cancelled':cause.message);}
  };
  // A later restore/init waits until the cancelled core has actually rolled back.
  const result=tail.then(execute,execute);tail=result.catch(()=>{});return result;
 };
 return {settled:()=>tail};
}
