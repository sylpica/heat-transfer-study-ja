import test from 'node:test';import assert from 'node:assert/strict';
import {createCavity} from '../dynamic/dev/cavity.mjs';import {manufacturedCavity} from '../dynamic/dev/manufactured-cavity.mjs';
import {measureTemporalRefinement} from '../scripts/dynamic-cavity-time-benchmarks.mjs';
const base={nx:8,ny:8,width:1,height:1,rho:1,cp:1,nu:1,alpha:.2,initial:300,pressureTolerance:1e-11};
test('cavity restore repeats identical next states for lid, buoyancy and manufactured fields with both pressure solvers',()=>{
 for(const pressurePreconditioner of ['jacobi','multigrid'])for(const kind of ['lid','buoyancy','manufactured']){
  const exact=kind==='manufactured'?manufacturedCavity():null,c={...base,pressurePreconditioner,...(kind==='lid'?{lidVelocity:1}:kind==='buoyancy'?{leftTemperature:300.5,rightTemperature:299.5,gravityBeta:1,beta:.001}:{leftTemperature:300,rightTemperature:300,scalarScheme:'central'})},m=createCavity(c,exact);
  const initial=m.snapshot();for(let i=0;i<5;i++)m.step(m.safeDt/2,false);const accepted=m.snapshot();m.step(m.safeDt/2,false);const next=m.snapshot();m.restore(structuredClone(accepted));assert.deepEqual(m.snapshot(),accepted);m.step(m.safeDt/2,false);assert.deepEqual(m.snapshot(),next);
  const independent=createCavity(c,exact);independent.restore(accepted);assert.deepEqual(independent.snapshot(),accepted);m.restore(initial);assert.deepEqual(m.snapshot(),initial);
 }
});
test('invalid cavity restore is atomic and validates walls, divergence, gauge, model and field metadata',()=>{
 const m=createCavity({...base,lidVelocity:1});m.step(m.safeDt);const accepted=m.snapshot();
 const changes=[s=>s.u.pop(),s=>s.v[10]=NaN,s=>s.temperature[0]=0,s=>s.pressure[0]=Infinity,s=>s.time=-1,s=>s.steps=.5,s=>s.lastDt=NaN,s=>s.netInput=Infinity,s=>s.pressureIterations=-1,s=>s.totalPressureIterations=0,s=>s.signature+='other',s=>s.u[0]=1,s=>s.u[2]+=.01,s=>s.pressure=s.pressure.map(p=>p+1)];
 for(const edit of changes){const bad=structuredClone(accepted);edit(bad);assert.throws(()=>m.restore(bad));assert.deepEqual(m.snapshot(),accepted);}
 const other=createCavity({...base,lidVelocity:1,depth:.5});assert.throws(()=>other.restore(accepted),/一致/);
 const buoyant=createCavity({...base,leftTemperature:300.5,rightTemperature:299.5,gravityBeta:1,beta:.001}),old=buoyant.snapshot(),bad=structuredClone(old);bad.temperature[0]=401;assert.throws(()=>buoyant.restore(bad),/Boussinesq/);assert.deepEqual(buoyant.snapshot(),old);
});
test('specified depth scales total heat and capacity without introducing fictitious out-of-plane walls',()=>{
 const full=createCavity({...base,leftTemperature:320,rightTemperature:300}),thin=createCavity({...base,leftTemperature:320,rightTemperature:300,depth:.2});
 for(let i=0;i<30;i++){const dt=full.safeDt;full.step(dt,false);thin.step(dt,false);}const a=full.snapshot(),b=thin.snapshot();
 a.temperature.forEach((t,i)=>assert.ok(Math.abs(t-b.temperature[i])<1e-12));for(const key of ['energy','netInput','lastPower'])assert.ok(Math.abs(b[key]-.2*a[key])<1e-10,key);assert.ok(Math.abs(b.energyError)<1e-10);assert.deepEqual(a.u,b.u);assert.deepEqual(a.v,b.v);assert.deepEqual(a.pressure,b.pressure);assert.equal(thin.mesh.depth,.2);assert.equal(b.energyReference,'273.15 K');
});
test('loose pressure convergence cannot silently advance a nonconservative velocity field',()=>{
 const m=createCavity({...base,lidVelocity:1,pressureTolerance:2}),old=m.snapshot();assert.throws(()=>m.step(m.safeDt),/連続の式/);assert.deepEqual(m.snapshot(),old);
 assert.throws(()=>createCavity({...base,nu:1e308}),/安定時間/);
});
test('trusted manufactured callback object cannot be replaced after constructing the cavity',()=>{
 const exact=manufacturedCavity(),m=createCavity({...base,leftTemperature:300,rightTemperature:300,scalarScheme:'central'},exact),control=createCavity({...base,leftTemperature:300,rightTemperature:300,scalarScheme:'central'},manufacturedCavity());exact.bodyForce=()=>{throw Error('changed');};exact.heatSource=()=>NaN;m.step(m.safeDt);control.step(control.safeDt);assert.deepEqual(m.snapshot(),control.snapshot());
});
test('fixed-grid whole-field differences show first-order temporal self-convergence independently of grid refinement',()=>{
 const result=measureTemporalRefinement();assert.equal(result.passed,true);assert.equal(result.samples.length,4);for(const s of result.samples)assert.ok(Math.abs(s.time-.025)<1e-12);for(const key of ['u','v','pressure','temperature']){assert.ok(result.differences[0][key].rms>1e-8);for(const p of result.observedOrders[key])assert.ok(p>.85&&p<1.15,`${key}: ${p}`);}
});
