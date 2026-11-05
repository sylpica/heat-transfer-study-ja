import test from 'node:test';import assert from 'node:assert/strict';import {createRansChannel} from '../dynamic/dev/rans-channel.mjs';
const base={caseId:'MKM180',halfGap:.1,nu:1.575e-5,rho:1.177,cp:1006,k:.0264,width:1,depth:.01,nx:32,ny:16,turbulentPrandtl:1,initial:300};
const varying=c=>Array.from({length:c.nx*c.ny},(_,n)=>300+Math.cos(2*Math.PI*((n%c.nx)+.5)/c.nx)*(1+.25*Math.cos(2*Math.PI*(Math.floor(n/c.nx)+.5)/c.ny)));
function advance(m,target){while(m.time<target){const d=Math.min(m.safeDt,target-m.time);m.step(d,false);}return m.snapshot();}
test('steady mean flow transports a passive temperature rather than resolving turbulent fluctuations',()=>{
 const m=createRansChannel(base),s=advance(m,.2);assert.equal(s.min,300);assert.equal(s.max,300);assert.equal(s.energyError,0);assert.equal(s.netInput,0);assert.equal(s.meanFlowSteady,true);assert.equal(s.fluctuationsResolved,false);assert.equal(s.viscousHeatingIncluded,false);assert.equal(s.releaseApproved,false);
 assert.equal(s.meanFlow.reTau,178.12);assert.ok(s.omittedMeanHeatingRateKPerS>0);assert.ok(Math.abs(s.omittedMeanHeatingEstimateK/(.2*s.meanFlow.acceleration*s.meanFlow.bulkVelocity/base.cp)-1)<1e-14);
 const a=s.rowEffectiveThermalDiffusivity;assert.ok(a.every(v=>v>=base.k/(base.rho*base.cp)));assert.equal(s.faceEffectiveThermalDiffusivity[0],base.k/(base.rho*base.cp));assert.deepEqual(a,a.toReversed());
});
test('periodic pair fluxes conserve heat and maintain the initial maximum principle under advection and variable eddy diffusion',()=>{
 for(const caseId of ['MKM180','MKM395','MKM590'])for(const direction of [-1,1]){
  const c={...base,caseId,direction};c.initial=varying(c);const m=createRansChannel(c),s=advance(m,.3);assert.ok(Math.abs(s.energyError)<1e-9);assert.ok(s.energyError<s.energyRoundoffBudgetJ);assert.ok(s.min>=Math.min(...c.initial)-1e-12&&s.max<=Math.max(...c.initial)+1e-12);assert.ok(s.advectionCfl<.8);assert.deepEqual(s.velocity,s.velocity.toReversed());
 }
});
test('reversing pressure and reflecting the initial scalar reflect the actual evolving temperature',()=>{
 const c={...base};c.initial=varying(c);c.initial[5]+=0.1;const reflect=a=>a.map((_,n)=>a[Math.floor(n/c.nx)*c.nx+c.nx-1-n%c.nx]);
 const a=createRansChannel(c),b=createRansChannel({...c,direction:-1,initial:reflect(c.initial)}),sa=advance(a,.2),sb=advance(b,.2);reflect(sa.temperature).forEach((t,i)=>assert.ok(Math.abs(t-sb.temperature[i])<2e-12));assert.ok(sa.omittedMeanHeatingRateKPerS>0);assert.equal(sa.omittedMeanHeatingRateKPerS,sb.omittedMeanHeatingRateKPerS);
});
test('the prescribed turbulent Prandtl ratio changes only modeled thermal diffusivity, never the mean velocity',()=>{
 const a=createRansChannel(base).snapshot(),b=createRansChannel({...base,turbulentPrandtl:2}).snapshot(),alpha=base.k/(base.rho*base.cp);assert.deepEqual(a.velocity,b.velocity);a.rowEffectiveThermalDiffusivity.forEach((v,i)=>assert.ok(Math.abs((v-alpha)/2-(b.rowEffectiveThermalDiffusivity[i]-alpha))<1e-17));
});
test('failed steps and invalid restores preserve accepted state; exact replay is deterministic',()=>{
 const c={...base};c.initial=varying(c);const m=createRansChannel(c),zero=m.snapshot();advance(m,.2);const saved=m.snapshot();advance(m,.4);const end=m.snapshot();m.restore(saved);assert.deepEqual(advance(m,.4),end);
 for(const dt of [NaN,0,-1,Infinity,m.safeDt*2]){const before=m.snapshot();assert.throws(()=>m.step(dt));assert.deepEqual(m.snapshot(),before);}
 const bad=[];bad.push({...saved,signature:'wrong'},{...saved,time:-1},{...saved,lastDt:m.safeDt*2},{...saved,steps:0},{...saved,temperature:saved.temperature.map(v=>v+.01)});const nan=structuredClone(saved);nan.temperature[4]=NaN;bad.push(nan);const tampered=structuredClone(zero);[tampered.temperature[0],tampered.temperature[1]]=[tampered.temperature[1],tampered.temperature[0]];bad.push(tampered);
 for(const s of bad){const before=m.snapshot();assert.throws(()=>m.restore(s));assert.deepEqual(m.snapshot(),before);}m.restore(zero);assert.deepEqual(m.snapshot(),zero);
});
test('unsupported geometry, closures, boundaries and invalid dimensions are rejected before a model exists',()=>{
 for(const patch of [{initial:0},{initial:Array(1).fill(300)},{initial:Infinity},{ny:15},{nx:3},{turbulentPrandtl:0},{turbulentPrandtl:3},{caseId:'custom'},{width:1e-300},{depth:0},{boundaries:{}},{heatSource:1},{initialVelocity:[0]}])assert.throws(()=>createRansChannel({...base,...patch}));
 const c=structuredClone(base),m=createRansChannel(c);c.width=1e9;const exposed=m.config;exposed.width=100;assert.equal(m.config.width,1);
});
