import test from 'node:test';import assert from 'node:assert/strict';
import {createCavity} from '../dynamic/dev/cavity.mjs';
import {createNeumannMultigrid} from '../dynamic/dev/poisson-multigrid.mjs';
// High-Ra port (docs/dynamic/HIGHRA_CAVITY_JS_20261107.md): the development
// kernel accepts Ra<=1e6 and grids up to 256 so the multigrid projection
// path can be benchmarked against de Vahl Davis at Ra=1e4..1e6. The long
// steady runs live in scripts/dynamic-cavity-highra-benchmarks.mjs; only
// fast checks live here. The screen scope (Ra<=1000) is guarded separately
// in cavity-ui-config.mjs and covered by dynamic-cavity-ui-config.test.mjs.
const highRa={nx:8,ny:8,width:1,height:1,rho:1,cp:1,nu:.71,alpha:1,initial:300,leftTemperature:300.5,rightTemperature:299.5,beta:.001,referenceTemperature:300,scalarScheme:'central',pressurePreconditioner:'multigrid',pressureTolerance:1e-11,maxPressureIterations:4000};
test('kernel accepts Ra=1e6 and refuses beyond it',()=>{
 assert.doesNotThrow(()=>createCavity({...highRa,gravityBeta:.71e6}));
 assert.throws(()=>createCavity({...highRa,gravityBeta:.71*1.1e6}),/Ra≤1000000/);
 assert.throws(()=>createCavity({...highRa,gravityBeta:.71*1e7}),/Ra≤1000000/);
});
test('kernel and multigrid accept grids up to 256 and refuse 257',()=>{
 const m=createCavity({nx:256,ny:256,width:1,height:1,rho:1,cp:1,nu:.01,alpha:.01,initial:300,pressurePreconditioner:'multigrid'});
 assert.equal(m.mesh.nx,256);assert.ok(m.pressureHierarchy?.length>1);
 assert.throws(()=>createCavity({nx:257,ny:257,width:1,height:1,rho:1,cp:1,nu:.01,alpha:.01,initial:300}),/4〜256/);
 assert.throws(()=>createNeumannMultigrid({nx:257,ny:257,dx:1/257,dy:1/257}),/多重格子/);
 assert.doesNotThrow(()=>createNeumannMultigrid({nx:192,ny:192,dx:1/192,dy:1/192}));
});
test('short Ra=1e4 run develops convection with conserved energy',()=>{
 const m=createCavity({...highRa,nx:32,ny:32,gravityBeta:.71e4});
 while(m.time<.05)m.step(Math.min(m.safeDt,.05-m.time),false);
 const s=m.snapshot();
 assert.ok(s.nusselt>1.5&&s.nusselt<3,'Nu_0 rises above the conduction value toward the Ra=1e4 range, got '+s.nusselt);
 assert.ok(s.relativeEnergyError<1e-6,'relative energy error stays within the AC4 budget');
 assert.ok(s.u.some(v=>v>0)&&s.v.some(v=>v>0),'buoyant flow has developed');
 assert.ok(s.max<300.5&&s.min>299.5,'temperature stays inside the wall bounds');
});
test('Ra=1000 regression anchor through the multigrid path stays at the recorded value',()=>{
 const m=createCavity({...highRa,nx:32,ny:32,gravityBeta:710});
 while(m.time<1)m.step(Math.min(m.safeDt,1-m.time),false);
 const s=m.snapshot();
 assert.ok(Math.abs(s.nusselt-1.11994276)<.002,'Nu_0 at t=1 matches the recorded 1.11994276 within 0.002, got '+s.nusselt);
});
