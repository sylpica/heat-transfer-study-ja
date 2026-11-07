import test from 'node:test';import assert from 'node:assert/strict';
import {createThermal} from '../dynamic/thermal.mjs';
import {createRadial} from '../dynamic/radial.mjs';
// Dedicated aggregation of prompt section 6.4 item 3 (zero heat-flux
// condition) for the transient-conduction field: fully insulated boundaries,
// an insulated symmetry plane, and isothermal radiation at equal temperature.
// These cases existed only scattered inside broader tests; here they are
// named, isolated and checked against independently stated expectations.
const config=(extra={})=>({nx:10,ny:1,width:1,height:1,depth:1,materials:[{k:1,rho:1,cp:1}],initial:300,...extra});
function advance(m,t,dt=m.safeDt){while(m.snapshot().time<t-1e-12)m.step(Math.min(dt,t-m.snapshot().time));return m.snapshot();}
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);

test('zero-flux condition: fully insulated boundaries add no energy and a nonuniform field relaxes to its volume mean',()=>{
 // Uniform field: preserved exactly, with identically zero boundary input.
 const uniform=createThermal(config({nx:6,ny:4})),su=advance(uniform,.37);
 su.temperature.forEach(v=>near(v,300,0));near(su.netInput,0,0);near(su.energyError,0,1e-12);
 // Nonuniform field: no source and no boundary path, so the stored energy is
 // conserved to roundoff while conduction only redistributes it internally.
 const initial=Array.from({length:8},(_,i)=>300+2*i),mean=initial.reduce((a,b)=>a+b,0)/initial.length;
 const m=createThermal(config({nx:8,initial})),mid=advance(m,.05);
 near(mid.netInput,0,0);near(mid.energyError,0,1e-10);assert.ok(mid.max<314&&mid.min>300);
 const s=advance(m,3);near(s.netInput,0,0);near(s.energyError,0,1e-10);
 s.temperature.forEach(v=>near(v,mean,1e-6));
});

test('zero-flux condition: an insulated symmetry plane reproduces the mirrored half of the full-domain solution',()=>{
 // Full slab heated identically from both faces is symmetric about its
 // centre plane, so the centre face carries no heat. A half-domain model
 // whose right face is insulated must reproduce the full model's left half
 // on the same mesh spacing.
 const full=createThermal(config({nx:16,width:2,boundaries:{left:{type:'temperature',temperature:320},right:{type:'temperature',temperature:320}}}));
 const half=createThermal(config({nx:8,width:1,boundaries:{left:{type:'temperature',temperature:320}}}));
 const sf=advance(full,.3),sh=advance(half,.3);
 for(let i=0;i<8;i++)near(sh.temperature[i],sf.temperature[i],1e-7);
 for(let i=0;i<8;i++)near(sf.temperature[15-i],sf.temperature[i],1e-9);
 near(full.flux().x[7],-full.flux().x[8],1e-9); // centre cells report equal and opposite averaged fluxes; the interface itself carries no heat, as the mirrored field shows
 near(sh.energyError,0,1e-9);near(sf.energyError,0,1e-9);
});

test('zero-flux condition: isothermal radiation at equal temperature exchanges no net heat in FVM and radial models',()=>{
 for(const emissivity of [1,.5,.05]){
  const m=createThermal(config({nx:4,ny:3,boundaries:{left:{type:'radiation',temperature:300,emissivity},right:{type:'radiation',temperature:300,emissivity},top:{type:'radiation',temperature:300,emissivity},bottom:{type:'radiation',temperature:300,emissivity}}}));
  const s=advance(m,.21);s.temperature.forEach(v=>near(v,300,0));near(s.netInput,0,0);near(s.energyError,0,1e-12);
 }
 // Equality at a temperature different from the initial-reference value.
 const hot=createThermal(config({nx:1,initial:350,boundaries:{left:{type:'radiation',temperature:350,emissivity:.8}}}));
 const sh=advance(hot,.05);near(sh.temperature[0],350,0);near(sh.netInput,0,0);
 // Combined convection+radiation with both reservoirs at the body temperature.
 const combined=createThermal(config({nx:1,initial:350,boundaries:{right:{type:'convection-radiation',temperature:350,radiationTemperature:350,h:12,emissivity:.8}}}));
 const sc=advance(combined,.05);near(sc.temperature[0],350,0);near(sc.netInput,0,0);
 assert.equal(sc.surfaceExchange[0].inwardWatts,0);
 // Radial geometry: zero measured inward power at equality, field preserved.
 const sphere=createRadial({geometry:'sphere',n:8,radius:.1,k:5,rho:1000,cp:1000,initial:350,boundary:{type:'radiation',temperature:350,emissivity:.8}});
 const sr=advance(sphere,.5);sr.temperature.forEach(v=>near(v,350,1e-9));near(sr.outerInwardWatts,0,1e-9);near(sr.netInput,0,1e-9);near(sr.energyError,0,1e-7);
});
