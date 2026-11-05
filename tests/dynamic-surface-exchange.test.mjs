import test from 'node:test';import assert from 'node:assert/strict';
import {surfaceExchange,validateSurfaceExchange} from '../dynamic/surface-exchange.mjs';
import {createThermal} from '../dynamic/thermal.mjs';import {createRadial} from '../dynamic/radial.mjs';
import {execFileSync} from 'node:child_process';
const sigma=5.670374419e-8,bc={type:'convection-radiation',temperature:400,radiationTemperature:280,h:12,emissivity:.8};
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const slab=b=>({nx:1,ny:1,width:.1,height:1,depth:1,materials:[{k:5,rho:1000,cp:1000}],initial:350,boundaries:{right:b}});
test('combined surface uses one face temperature, distinct reservoirs and a conservative signed flux',()=>{
 for(const temperature of [250,350,450]){
  const r=surfaceExchange(temperature,100,1,bc);
  near(r.inwardWatts,100*(r.surfaceTemperature-temperature));
  near(r.convectionOutwardWatts,12*(r.surfaceTemperature-400));
  near(r.radiationOutwardWatts,.8*sigma*(r.surfaceTemperature**4-280**4));
  near(r.inwardWatts+r.convectionOutwardWatts+r.radiationOutwardWatts,0);
  assert.ok(r.surfaceTemperature>=Math.min(temperature,280)&&r.surfaceTemperature<=Math.max(temperature,400));
 }
 const mixed=surfaceExchange(350,100,1,bc);assert.ok(mixed.convectionOutwardWatts<0&&mixed.radiationOutwardWatts>0);
 const m=createThermal(slab(bc)),s=m.step(.01);near(s.netInput,mixed.inwardWatts*.01);near(s.energyError,0,1e-8);
 const report=s.surfaceExchange[0];near(report.inwardWatts+report.convectionOutwardWatts+report.radiationOutwardWatts,0);assert.equal(report.side,'right');near(report.area,1);
});
test('zero coefficients reproduce insulation and the separate convection or radiation laws',()=>{
 const none=surfaceExchange(350,100,1,{...bc,h:0,emissivity:0});assert.equal(none.inwardWatts,0);assert.equal(none.surfaceTemperature,350);
 const convection=surfaceExchange(350,100,1,{...bc,emissivity:0});near(convection.inwardWatts,(400-350)/(.01+1/12));
 for(const [h,emissivity,type]of [[12,0,'convection'],[0,.8,'radiation']]){
  const model=createThermal(slab({...bc,h,emissivity})),separate=createThermal(slab({type,temperature:type==='radiation'?280:400,h,emissivity}));
  near(model.step(.01).temperature[0],separate.step(.01).temperature[0],1e-12);
 }
});
test('sub-ULP face offsets still carry finite heat at a highly conducting surface',()=>{
 const r=surfaceExchange(350,1e25,1,{...bc,emissivity:0});assert.equal(r.surfaceTemperature,350);near(r.inwardWatts,600,1e-10);near(r.inwardWatts+r.convectionOutwardWatts,0,1e-10);
});
test('radial combined boundary returns independently balanced component diagnostics and energy',()=>{
 for(const geometry of ['sphere','cylinder']){
  const m=createRadial({geometry,n:8,radius:.1,length:1,k:5,rho:1000,cp:1000,initial:350,boundary:bc}),initial=m.snapshot(),s=m.step(.001),x=s.surfaceExchange,A=m.mesh.areas.at(-1);
  near(x.convectionOutwardWatts,12*A*(s.surfaceTemperature-400));near(x.radiationOutwardWatts,.8*sigma*A*(s.surfaceTemperature**4-280**4));near(s.outerInwardWatts+x.convectionOutwardWatts+x.radiationOutwardWatts,0,1e-9);
  near(s.netInput,initial.outerInwardWatts*.001,1e-10);near(s.energyError,0,1e-7);
  m.restore(initial);assert.deepEqual(m.step(.001),s);
 }
});
test('invalid coupled inputs, unsupported geometry and overflow do not advance an accepted model',()=>{
 for(const patch of [{h:-1},{h:NaN},{h:'12'},{emissivity:2},{temperature:0},{radiationTemperature:0},{radiationTemperature:1e100}])assert.throws(()=>validateSurfaceExchange({...bc,...patch}));
 assert.throws(()=>createThermal({...slab(bc),outline:[[0,0],[.1,0],[.1,1],[0,1]]}),/自由輪郭/);
 assert.throws(()=>createThermal({...slab(bc),materials:[{k:5,rho:1000,cp:1000,kTable:[[300,5],[500,6]]}]}),/検証待ち/);
 assert.throws(()=>createThermal(slab({...bc,h:1e308})),/数値範囲|収束/);
});
test('combined output overflow is checked before committing new or restored temperatures',()=>{
 const m=createThermal({...slab(bc),source:1e100}),before=m.snapshot();assert.throws(()=>m.step(.01),/数値範囲/);assert.deepEqual(m.snapshot(),before);
 assert.throws(()=>m.restore({...before,temperature:[1e100]}),/数値範囲/);assert.deepEqual(m.snapshot(),before);
 const grid=createThermal({...slab(bc),nx:8,ny:4,boundaries:{left:bc,right:bc,top:bc,bottom:bc}}),rows=grid.snapshot().surfaceExchange;
 assert.equal(rows.length,4);near(rows.reduce((sum,r)=>sum+r.area,0),2*(.1+1));
});
test('coupled slab and radial steady fields and a separate transient control-volume reference meet independent gates',()=>{
 const result=JSON.parse(execFileSync(process.execPath,['scripts/dynamic-surface-exchange-benchmarks.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}));
 assert.equal(result.passed,true);assert.equal(result.slab.length,3);assert.equal(result.radial.length,2);
 assert.ok(result.radial.every(g=>g.rows.length===3&&g.steadySpatialOrders.every(p=>p>1.8)));
 assert.ok(result.timeOrders.every(p=>p>.95&&p<1.1));
});
