// Development-only CPU/WebGPU comparison for a narrowly defined heat equation.
// No public registration, free shapes, boundary exchange, CFD or variable properties.
import {createThermal} from '../thermal.mjs';

export class GPUUnavailableError extends Error{}
export class GPUPrecisionUnsupportedError extends Error{}
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const signature=(spec,backend,policy={})=>JSON.stringify(['adiabatic-diffusion-state-v1',backend,canonical(spec.config),canonical(policy)]);
const meshFor=spec=>({kind:'insulated-rectangular-diffusion',nx:spec.config.nx,ny:spec.config.ny,count:spec.config.nx*spec.config.ny,width:spec.config.width,height:spec.config.height,depth:spec.config.depth,dx:spec.dx,dy:spec.dy,cellCapacity:spec.capacity});
const positive=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<=0)throw Error(name+' must be finite and positive');return v;};
export function diffusionConfig(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['nx','ny','width','height','depth','materials','initial','boundaries','edge','source','contactResistance','regions','outline','distributedConvection'].includes(k)))throw Error('Unknown or invalid insulated diffusion condition');
 const c=structuredClone(input),{nx,ny}=c;
 if(c.boundaries&&(typeof c.boundaries!=='object'||Array.isArray(c.boundaries)||Object.keys(c.boundaries).some(k=>!['left','right','bottom','top'].includes(k))))throw Error('Unknown insulated rectangle side');
 if(![nx,ny].every(n=>Number.isSafeInteger(n)&&n>=1&&n<=128)||nx*ny>16384)throw Error('Development diffusion supports 1–128 cells per axis and at most 16384 cells');
 for(const key of ['width','height','depth'])positive(c[key],key);
 if(c.materials?.length!==1||c.materials[0].kTable||c.materials[0].cpTable)throw Error('One constant-property material is required');
 const m=c.materials[0];if(Object.keys(m).some(k=>!['k','rho','cp','name','id'].includes(k)))throw Error('Unknown constant material condition');for(const key of ['k','rho','cp'])positive(m[key],key);
 if([...Object.values(c.boundaries??{}),...(c.edge?[c.edge]:[])].some(b=>!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>k!=='type')))throw Error('Unknown insulated boundary condition');
 if(c.regions||c.outline||c.distributedConvection||(c.source??0)!==0||(c.contactResistance??0)!==0||Object.values(c.boundaries??{}).some(b=>b.type!=='insulated')||c.edge&&c.edge.type!=='insulated')throw Error('Only a source-free rectangular body with all faces insulated is supported');
 const initial=Array.isArray(c.initial)?c.initial:Array(nx*ny).fill(c.initial);if(initial.length!==nx*ny)throw Error('Initial field length differs from mesh');initial.forEach(t=>positive(t,'initial K'));c.initial=initial;
 const dx=c.width/nx,dy=c.height/ny,alpha=m.k/(m.rho*m.cp),volume=dx*dy*c.depth,capacity=m.rho*m.cp*volume;
 for(const [key,value]of Object.entries({dx,dy,alpha,volume,capacity}))positive(value,key);
 const inverseTime=2*alpha*((nx>1?1/dx**2:0)+(ny>1?1/dy**2:0)),safeDt=inverseTime>0?.8/inverseTime:Infinity;
 if(!(safeDt>0)||((nx>1||ny>1)&&!(inverseTime>0&&Number.isFinite(inverseTime)))||!Number.isFinite(capacity*nx*ny))throw Error('Diffusion stability scale or total capacity is not representable');
 return {config:c,dx,dy,alpha,capacity,safeDt};
}
function plan(duration,dt,safeDt){positive(duration,'duration');const maximum=dt??(Number.isFinite(safeDt)?safeDt:duration);positive(maximum,'dt');if(maximum>safeDt*(1+1e-12))throw Error('Diffusion time step exceeds the stability bound');const steps=Math.ceil(duration/maximum);if(!Number.isSafeInteger(steps)||steps>100000)throw Error('Development batch exceeds 100000 steps');return {steps,dt:maximum,lastDt:duration-(steps-1)*maximum};}
const cancelled=signal=>{if(signal?.aborted)throw new DOMException('Calculation cancelled before acceptance','AbortError');};
const yieldThread=()=>new Promise(resolve=>setTimeout(resolve,0));

export const ADIABATIC_DIFFUSION_WGSL=`
struct Parameters {nx:u32,ny:u32,rx:f32,ry:f32};
@group(0) @binding(0) var<storage,read> input:array<f32>;
@group(0) @binding(1) var<storage,read_write> output:array<f32>;
@group(0) @binding(2) var<uniform> p:Parameters;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x>=p.nx || id.y>=p.ny){return;}
 let i=id.y*p.nx+id.x;let value=input[i];var lx=0.0;var ly=0.0;
 if(id.x>0u){lx+=input[i-1u]-value;}if(id.x+1u<p.nx){lx+=input[i+1u]-value;}
 if(id.y>0u){ly+=input[i-p.nx]-value;}if(id.y+1u<p.ny){ly+=input[i+p.nx]-value;}
 output[i]=value+p.rx*lx+p.ry*ly;
}`;

function cpuModel(spec,reason){
 const model=createThermal(spec.config),identity=signature(spec,'cpu'),N=spec.config.nx*spec.config.ny,initial=spec.config.initial,min=Math.min(...initial),max=Math.max(...initial);let busy=false,closed=false,accepted=model.snapshot();
 const snapshot=()=>structuredClone({...accepted,backend:'cpu',precision:'Float64',fallbackReason:reason??null,diffusionSignature:identity,safeDt:spec.safeDt});
 function validateRestore(s){
  if(!s||s.backend!=='cpu'||s.diffusionSignature!==identity||!Array.isArray(s.temperature)||s.temperature.length!==N||!Number.isSafeInteger(s.steps)||s.steps<0||!Number.isFinite(s.time)||s.time<0||!Number.isFinite(s.lastDt)||s.lastDt<0||s.lastDt>spec.safeDt*(1+1e-12)||s.netInput!==0||s.lastPower!==0||(s.steps===0?(s.time!==0||s.lastDt!==0||s.temperature.some((t,i)=>t!==initial[i])):(s.time<=0||s.lastDt<=0||s.time<s.lastDt||s.time>s.steps*spec.safeDt*(1+1e-10))))throw Error('CPU diffusion restore model, conditions or clock differ');
  const tolerance=128*Number.EPSILON*Math.max(...initial)*(1+Math.sqrt(s.steps));for(const t of s.temperature)if(!Number.isFinite(t)||t<=0||t<min-tolerance||t>max+tolerance)throw Error('CPU diffusion restore violates temperature or maximum principle');
  const change=spec.capacity*s.temperature.reduce((v,t,i)=>v+(t-initial[i]),0),budget=1024*Number.EPSILON*spec.capacity*(s.temperature.reduce((v,t)=>v+Math.abs(t),0)+initial.reduce((v,t)=>v+Math.abs(t),0))*(1+Math.sqrt(s.steps));if(!Number.isFinite(change)||!Number.isFinite(budget)||Math.abs(change)>budget)throw Error('CPU diffusion restore violates insulated energy balance');
 }
 return {backend:'cpu',fallbackReason:reason??null,precision:'Float64',safeDt:spec.safeDt,mesh:meshFor(spec),snapshot,
  restore(s){if(closed||busy)throw Error('Diffusion model is closed or busy');validateRestore(s);accepted=model.restore(s);return snapshot();},
  async advance({duration,dt,signal,onProgress}={}){
   if(closed||busy)throw Error('Diffusion model is closed or busy');const p=plan(duration,dt,spec.safeDt),before=accepted;if(!Number.isFinite(before.time+duration)||before.time+duration<=before.time||!Number.isSafeInteger(before.steps+p.steps))throw Error('Physical time or step count is not representable');busy=true;
   try{cancelled(signal);for(let i=0;i<p.steps;i++){model.step(i===p.steps-1?p.lastDt:p.dt,false);if((i+1)%32===0||i===p.steps-1){onProgress?.((i+1)/p.steps);cancelled(signal);await yieldThread();cancelled(signal);if(closed)throw Error('Diffusion model was closed');}}const candidate=model.snapshot(),target=before.time+duration,clockBudget=64*Number.EPSILON*target*(p.steps+1);if(!Number.isFinite(candidate.time)||Math.abs(candidate.time-target)>clockBudget)throw Error('CPU substep clock differs from the declared interval beyond roundoff');accepted=model.restore({...candidate,time:target});return snapshot();
   }catch(error){model.restore(before);throw error;}finally{busy=false;}
  },close(){closed=true;}
 };
}

export async function createAdiabaticDiffusion(config,{backend='auto',gpu=globalThis.navigator?.gpu,inputRoundingBudgetK=1e-6,energyToleranceFraction=1e-6}={}){
 const spec=diffusionConfig(config);if(!['auto','cpu','webgpu'].includes(backend))throw Error('Unknown development diffusion backend');
 positive(inputRoundingBudgetK,'input rounding budget');positive(energyToleranceFraction,'energy tolerance');if(backend==='cpu')return cpuModel(spec);
 try{return await gpuModel(spec,gpu,{inputRoundingBudgetK,energyToleranceFraction});}
 catch(error){if(backend==='auto'&&(error instanceof GPUUnavailableError||error instanceof GPUPrecisionUnsupportedError))return cpuModel(spec,error.message);throw error;}
}

async function gpuModel(spec,gpu,{inputRoundingBudgetK,energyToleranceFraction}){
 if(!gpu)throw new GPUUnavailableError('WebGPU is unavailable; the identical insulated diffusion equations use CPU');
 let adapter,device;try{adapter=await gpu.requestAdapter();if(!adapter)throw Error('no adapter');device=await adapter.requestDevice();}catch(error){throw new GPUUnavailableError('WebGPU device acquisition failed: '+error.message);}
 const {config:c,dx,dy,alpha,capacity}=spec,N=c.nx*c.ny,bytes=N*4,reference=c.initial.reduce((s,t)=>s+t/N,0),initial=Float32Array.from(c.initial,t=>t-reference),rounding=Math.max(...Array.from(initial,(t,i)=>Math.abs(t-(c.initial[i]-reference))));
 if(initial.some(t=>!Number.isFinite(t)||reference+t<=0)||rounding>inputRoundingBudgetK){device.destroy();throw new GPUPrecisionUnsupportedError('Float32 input violates the positive-temperature or input-rounding budget');}
 const initialSum=initial.reduce((s,t)=>s+t,0),initialMin=Math.min(...initial),initialMax=Math.max(...initial),contrast=capacity*N*Math.max(inputRoundingBudgetK,initialMax-initialMin);
 if(!(contrast>0)||!Number.isFinite(contrast)||!Number.isFinite(capacity*initialSum+capacity*N*(reference-273.15))){device.destroy();throw Error('GPU energy scale is not representable');}
 const identity=signature(spec,'webgpu',{inputRoundingBudgetK,energyToleranceFraction}),buffers=[];let accepted=initial,time=0,steps=0,busy=false,closed=false,lost=null;
 device.lost.then(info=>{if(!closed)lost=info.message||'WebGPU device lost';});
 const buffer=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};
 const dispose=()=>{closed=true;for(const b of buffers)b.destroy();device.destroy();};
 try{
  const module=device.createShaderModule({code:ADIABATIC_DIFFUSION_WGSL}),info=await module.getCompilationInfo();if(info.messages.some(m=>m.type==='error'))throw Error('WGSL compilation failed: '+info.messages.filter(m=>m.type==='error').map(m=>m.message).join('; '));
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}),storage=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC,
   a=buffer(bytes,storage),b=buffer(bytes,storage),readback=buffer(bytes,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST),normal=buffer(16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),last=buffer(16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),layout=pipeline.getBindGroupLayout(0);
  const groups=[normal,last].map(uniform=>[[a,b],[b,a]].map(([input,output])=>device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:input}},{binding:1,resource:{buffer:output}},{binding:2,resource:{buffer:uniform}}]})));
  const params=dt=>{const data=new ArrayBuffer(16),v=new DataView(data);v.setUint32(0,c.nx,true);v.setUint32(4,c.ny,true);v.setFloat32(8,c.nx>1?alpha*dt/dx**2:0,true);v.setFloat32(12,c.ny>1?alpha*dt/dy**2:0,true);return data;};
  function snapshot(){const temperature=Array.from(accepted,t=>reference+t),sum=accepted.reduce((s,t)=>s+t,0),energyErrorJ=capacity*(sum-initialSum);return {backend:'webgpu',diffusionSignature:identity,fallbackReason:null,safeDt:spec.safeDt,offsetTemperature:Array.from(accepted),precision:'Float32 excess temperature; Float64 readback diagnostics',referenceTemperatureK:reference,inputRoundingMaxK:rounding,temperature,time,steps,energyErrorJ,energyToleranceScaleJ:contrast,energyErrorFractionOfScale:Math.abs(energyErrorJ)/contrast,adapter:{vendor:adapter.info?.vendor??'',architecture:adapter.info?.architecture??'',isFallbackAdapter:adapter.info?.isFallbackAdapter??null},physicalGPUVerified:false};}
  function validateAccepted(values){
   const errorJ=capacity*(values.reduce((s,t)=>s+t,0)-initialSum),tolerance=32*2**-23*Math.max(1,Math.abs(initialMin),Math.abs(initialMax));
   if(values.some(t=>!Number.isFinite(t)||Math.fround(t)!==t||reference+t<=0||t<initialMin-tolerance||t>initialMax+tolerance)||!Number.isFinite(errorJ)||Math.abs(errorJ)/contrast>energyToleranceFraction)throw Error('GPU temperature, maximum principle or energy gate failed before state acceptance');
  }
  return {backend:'webgpu',fallbackReason:null,precision:'Float32 excess temperature',safeDt:spec.safeDt,mesh:meshFor(spec),snapshot,
   restore(s){
    if(closed||busy||lost)throw Error(lost||'Diffusion model is closed or busy');
    if(!s||s.backend!=='webgpu'||s.diffusionSignature!==identity||s.referenceTemperatureK!==reference||!Array.isArray(s.offsetTemperature)||s.offsetTemperature.length!==N||!Array.isArray(s.temperature)||s.temperature.length!==N||s.temperature.some((t,i)=>t!==reference+s.offsetTemperature[i])||!Number.isSafeInteger(s.steps)||s.steps<0||!Number.isFinite(s.time)||s.time<0||(s.steps===0?(s.time!==0||s.offsetTemperature.some((t,i)=>t!==initial[i])):(s.time<=0||s.time>s.steps*spec.safeDt*(1+1e-10))))throw Error('GPU diffusion restore model, conditions, field or clock differ');
    validateAccepted(s.offsetTemperature);accepted=Float32Array.from(s.offsetTemperature);time=s.time;steps=s.steps;return snapshot();
   },
   async advance({duration,dt,signal,onProgress}={}){
    if(closed||busy||lost)throw Error(lost||'Diffusion model is closed or busy');const p=plan(duration,dt,spec.safeDt),nextTime=time+duration;if(!Number.isFinite(nextTime)||nextTime<=time||!Number.isSafeInteger(steps+p.steps))throw Error('Physical time or step count is not representable');busy=true;let mapped=false,scopeOpen=false;
    try{
     cancelled(signal);device.pushErrorScope('validation');scopeOpen=true;device.queue.writeBuffer(a,0,accepted);device.queue.writeBuffer(normal,0,params(p.dt));device.queue.writeBuffer(last,0,params(p.lastDt));
     for(let first=0;first<p.steps;first+=32){const end=Math.min(first+32,p.steps),encoder=device.createCommandEncoder();for(let i=first;i<end;i++){const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,groups[i===p.steps-1?1:0][i%2]);pass.dispatchWorkgroups(Math.ceil(c.nx/8),Math.ceil(c.ny/8));pass.end();}device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();if(lost||closed)throw Error(lost||'Diffusion model was closed');onProgress?.(end/p.steps);cancelled(signal);}
     const encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(p.steps%2?b:a,0,readback,0,bytes);device.queue.submit([encoder.finish()]);await readback.mapAsync(GPUMapMode.READ);mapped=true;const next=new Float32Array(readback.getMappedRange().slice(0));readback.unmap();mapped=false;
     const validation=await device.popErrorScope();scopeOpen=false;if(validation)throw Error('WebGPU validation error: '+validation.message);cancelled(signal);if(lost||closed)throw Error(lost||'Diffusion model was closed');
     validateAccepted(next);
     accepted=next;time=nextTime;steps+=p.steps;return snapshot();
    }finally{if(mapped)readback.unmap();if(scopeOpen)try{await device.popErrorScope();}catch{}busy=false;}
   },close:dispose
  };
 }catch(error){dispose();throw error;}
}
