import test from 'node:test';import assert from 'node:assert/strict';
import {createAdiabaticDiffusion,diffusionConfig,GPUUnavailableError} from '../dynamic/dev/adiabatic-diffusion.mjs';
const base={nx:16,ny:8,width:1,height:.5,depth:1,materials:[{k:.01,rho:1,cp:1}],initial:Array.from({length:128},(_,i)=>300+Math.cos(Math.PI*(i%16+.5)/16)*Math.cos(Math.PI*(Math.floor(i/16)+.5)/8))};
test('unavailable WebGPU selects identical Float64 insulated physics only when auto was explicitly requested',async()=>{
 const m=await createAdiabaticDiffusion(base,{backend:'auto',gpu:{requestAdapter:async()=>null}});assert.equal(m.backend,'cpu');assert.match(m.fallbackReason,/acquisition/);const s=await m.advance({duration:.1,dt:.001}),alpha=.01,dx=1/16,dy=.5/8,lambda=4*alpha*(Math.sin(Math.PI/32)**2/dx**2+Math.sin(Math.PI/16)**2/dy**2),decay=(1-lambda*.001)**100;
 for(let i=0;i<128;i++)assert.ok(Math.abs(s.temperature[i]-(300+(base.initial[i]-300)*decay))<1e-11);assert.ok(Math.abs(s.energyError)<1e-11);m.close();
 await assert.rejects(createAdiabaticDiffusion(base,{backend:'webgpu',gpu:{requestAdapter:async()=>null}}),GPUUnavailableError);
});
test('fallback never erases sources, non-insulated walls, geometry or variable properties to fit a GPU stencil',async()=>{
 for(const patch of [{source:1},{outline:[[0,0],[1,0],[1,1]]},{boundaries:{left:{type:'temperature',temperature:350}}},{materials:[{k:.01,rho:1,cp:1,kTable:[[290,.01],[310,.02]]}]},{nx:0},{regions:[]},{distributedConvection:{h:1}}])await assert.rejects(createAdiabaticDiffusion({...base,...patch},{backend:'auto',gpu:undefined}));
 assert.throws(()=>diffusionConfig({...base,initial:[300]}));assert.throws(()=>diffusionConfig({...base,materials:[{k:1,rho:1e300,cp:1e300}]}));
});
test('CPU alternative cancellation and failed step requests preserve the last accepted physical state',async()=>{
 const m=await createAdiabaticDiffusion(base,{backend:'cpu'}),initial=m.snapshot(),controller=new AbortController();
 await assert.rejects(m.advance({duration:1,dt:.0001,signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});assert.deepEqual(m.snapshot(),initial);
 for(const request of [{duration:0},{duration:.1,dt:m.safeDt*2},{duration:100,dt:1e-10}]){await assert.rejects(m.advance(request));assert.deepEqual(m.snapshot(),initial);}
 const after=await m.advance({duration:.1,dt:.001});assert.ok(Math.abs(after.time-.1)<1e-14);assert.ok(after.temperature.every(Number.isFinite));m.close();await assert.rejects(m.advance({duration:.1}));
});
