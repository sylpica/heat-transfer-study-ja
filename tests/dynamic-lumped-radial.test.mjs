import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createLumpedRadial} from '../dynamic/lumped-radial.mjs';
const base={approximation:'lumped',geometry:'sphere',radius:.1,k:10,rho:1000,cp:1000,initial:350,source:0,boundary:{type:'convection',temperature:300,h:20}},near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('uniform reduced convection follows Newton cooling or heating without an explicit time-step restriction',()=>{
 for(const initial of [280,300,350])for(const geometry of ['sphere','cylinder']){
  const m=createLumpedRadial({...base,initial,geometry,length:.2}),s=m.step(123),V=m.mesh.volumes[0],A=m.mesh.areas[1],expected=300+(initial-300)*Math.exp(-20*A*123/(1000*1000*V));
  near(s.temperature[0],expected);assert.equal(s.temperature.length,1);assert.equal(s.surfaceTemperature,s.temperature[0]);assert.equal(m.safeDt,Infinity);assert.equal(s.safeDt,null);assert.equal(s.approximation,'lumped');near(s.netInput,1000*1000*V*(s.temperature[0]-initial),1e-8);near(s.energyError,0,1e-8);near(s.outerInwardWatts,20*A*(300-s.temperature[0]));assert.equal(m.flux().surfaceOnly,true);
 }
});
test('small-Bi approximation is compared against independent continuous volume-average Robin eigenfunctions',()=>{
 const r=JSON.parse(readFileSync(new URL('../docs/dynamic/LUMPED_RADIAL_REFERENCE_20261105.json',import.meta.url)));assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-lumped-reference.py',import.meta.url))).digest('hex'),r.generatorSHA256);
 for(const row of r.cases)for(const sample of row.samples){
  const m=createLumpedRadial({approximation:'lumped',geometry:row.geometry,length:1,radius:1,k:1,rho:1,cp:1,initial:350,boundary:{type:'convection',temperature:300,h:row.BiRadius}}),s=m.step(sample.Fo),fraction=(s.temperature[0]-300)/50;
  near(fraction,sample.lumpedExcessFraction,2e-14);near(fraction-sample.continuousVolumeMeanExcessFraction,sample.errorNormalizedByInitialExcess,2e-14);assert.ok(Math.abs(fraction-sample.continuousVolumeMeanExcessFraction)<.025);
 }
 for(const geometry of ['sphere','cylinder']){const rows=r.cases.filter(row=>row.geometry===geometry).map(row=>Math.max(...row.samples.map(s=>Math.abs(s.errorNormalizedByInitialExcess))));assert.ok(rows[0]<rows[1]&&rows[1]<rows[2]);}
});
test('applicability gate rejects high Bi and physically different requests instead of silently switching models',()=>{
 const atLimit={...base,k:20*(.1/3)/.1};near(createLumpedRadial(atLimit).snapshot().BiLc,.1);
 for(const patch of [{k:atLimit.k*.999},{approximation:'radial'},{geometry:'plate'},{initial:[350]},{source:1},{kTable:[[300,1],[400,2]]},{boundary:{type:'radiation',temperature:300,emissivity:.8}},{boundary:{type:'convection-radiation',temperature:300,h:20,emissivity:.8,radiationTemperature:300}},{boundary:{type:'convection',temperature:300,h:-1}},{radius:1e200},{rho:Infinity}])assert.throws(()=>createLumpedRadial({...base,...patch}));
});
test('exact time stepping, long-time equilibrium and zero-h insulation keep one uniform state',()=>{
 const m=createLumpedRadial(base),single=m.step(200),split=createLumpedRadial(base);for(let i=0;i<1000;i++)split.step(.2,false);near(split.snapshot().temperature[0],single.temperature[0],1e-10);
 const insulated=createLumpedRadial({...base,boundary:{...base.boundary,h:0}}),s=insulated.step(1e5);assert.equal(s.temperature[0],350);assert.equal(s.netInput,0);assert.equal(s.outerInwardWatts,0);assert.equal(s.BiLc,0);
 assert.equal(createLumpedRadial(base).step(1e100).temperature[0],300);
});
test('cylinder length scales capacity and surface power without changing the predicted temperature',()=>{
 const a=createLumpedRadial({...base,geometry:'cylinder',length:.1}),b=createLumpedRadial({...base,geometry:'cylinder',length:.2}),sa=a.step(10),sb=b.step(10);near(sa.temperature[0],sb.temperature[0]);near(2*sa.energy,sb.energy,1e-8);near(2*sa.outerInwardWatts,sb.outerInwardWatts,1e-9);near(2*sa.netInput,sb.netInput,1e-8);
});
test('wrong or damaged snapshots and invalid progress preserve the accepted state; real rewind replays exactly',()=>{
 const m=createLumpedRadial(base),initial=m.snapshot(),advanced=m.step(10);m.restore(initial);assert.deepEqual(m.step(10),advanced);
 for(const bad of [{...advanced,temperature:[-1]},{...advanced,time:20},{...advanced,netInput:0},{...advanced,temperature:[340]},{...advanced,signature:'other'}]){assert.throws(()=>m.restore(bad));assert.deepEqual(m.snapshot(),advanced);}
 assert.throws(()=>createLumpedRadial({...base,radius:.08}).restore(advanced));
 for(const dt of [0,-1,NaN,Infinity]){assert.throws(()=>m.step(dt));assert.deepEqual(m.snapshot(),advanced);}
});
