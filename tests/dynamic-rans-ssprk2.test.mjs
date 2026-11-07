import test from 'node:test';import assert from 'node:assert/strict';import {createRansChannel} from '../dynamic/dev/rans-channel.mjs';import {runRansTimeSchemeComparison,initialHarmonic} from '../scripts/dynamic-rans-temperature-benchmarks.mjs';
const base={caseId:'MKM180',halfGap:.1,nu:1.575e-5,rho:1.177,cp:1006,k:.0264,width:1,depth:.01,nx:32,ny:16,turbulentPrandtl:1};
function advance(m,time){while(m.time<time)m.step(Math.min(m.safeDt,time-m.time),false);return m.snapshot();}
test('SSPRK2 time refinement reaches second order against the independent fixed-grid matrix exponential',()=>{
 const r=runRansTimeSchemeComparison();assert.equal(r.passed,true,JSON.stringify(r));assert.ok(r.coarseErrorReduction>20);assert.equal(r.releaseApproved,false);
});
test('both SSP stages preserve bounded discontinuous temperature, periodic energy and reverse-flow symmetry at the same Euler stability limit',()=>{
 for(const caseId of ['MKM180','MKM395','MKM590'])for(const direction of [-1,1]){
  const c={...base,caseId,direction,timeIntegrator:'ssprk2',initial:Array.from({length:512},(_,i)=>i%32<16?299:301)},m=createRansChannel(c),s=advance(m,.3);assert.ok(s.min>=299-1e-12&&s.max<=301+1e-12);assert.ok(Math.abs(s.energyError)<1e-9);assert.equal(s.timeIntegrator,'ssprk2');assert.equal(s.stagesPerStep,2);
  const before=m.snapshot();assert.throws(()=>m.step(m.safeDt*2));assert.deepEqual(m.snapshot(),before);m.restore(before);const end=advance(m,.4);m.restore(before);assert.deepEqual(advance(m,.4),end);
 }
});
test('Euler remains the explicit default, while cross-integrator restore and unknown schemes are rejected atomically',()=>{
 const c={...base,initial:initialHarmonic(32,16)},a=createRansChannel(c),b=createRansChannel({...c,timeIntegrator:'euler'}),r=createRansChannel({...c,timeIntegrator:'ssprk2'});assert.equal(a.safeDt,r.safeDt);assert.equal(a.snapshot().timeIntegrator,'euler');assert.equal(a.snapshot().stagesPerStep,1);
 assert.deepEqual(advance(a,.2).temperature,advance(b,.2).temperature);const before=r.snapshot();assert.throws(()=>r.restore(a.snapshot()));assert.deepEqual(r.snapshot(),before);assert.throws(()=>createRansChannel({...c,timeIntegrator:'rk4'}));
});
