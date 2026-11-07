import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createTransientBrick3d} from '../dynamic/dev/transient-brick-3d.mjs';
import {createThermal} from '../dynamic/thermal.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/TRANSIENT_BRICK_3D_REFERENCE_20261107.json',import.meta.url)));
const rms=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length);
const maxd=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
const FACES=['xMin','xMax','yMin','yMax','zMin','zMax'];
function advance(m,target,frac=1){let guard=0;while(m.time<target-1e-12){m.step(Math.min(m.safeDt*frac,target-m.time),false);if(++guard>2000000)throw Error('進行しませんでした。');}return m.snapshot();}
function steady(m){let prev=m.snapshot();for(let g=0;g<500;g++){for(let j=0;j<200;j++)m.step(m.safeDt,false);const s=m.snapshot();if(maxd(s.temperature,prev.temperature)<1e-11)return s;prev=s;}throw Error('定常へ到達しませんでした。');}
const dirichlet=(tw)=>Object.fromEntries(FACES.map(f=>[f,{type:'temperature',temperature:tw}]));
const base=()=>({size:{x:0.1,y:0.08,z:0.06},cells:{nx:4,ny:3,nz:2},k:25,rho:900,cp:1100,initial:300});

test('generator provenance is recorded and the model stays unpublished',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-transient-brick-3d-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);
 assert.equal(reference.releaseApproved,false);
 assert.equal(createTransientBrick3d(base()).snapshot().releaseApproved,false);
});

test('invalid geometry, material, boundary and step inputs are refused with reasons',()=>{
 const bad=[
  [{...base(),size:{x:0,y:0.08,z:0.06}},/数値範囲外/],
  [{...base(),size:{x:0.1,y:0.08}},/数値範囲外/],
  [{...base(),cells:{nx:0,ny:3,nz:2}},/格子は各軸/],
  [{...base(),cells:{nx:65,ny:3,nz:2}},/格子は各軸/],
  [{...base(),cells:{nx:33,ny:32,nz:32}},/格子は各軸/],
  [{...base(),cells:{nx:2.5,ny:3,nz:2}},/格子は各軸/],
  [{...base(),k:-1},/数値範囲外/],
  [{...base(),initial:0},/数値範囲外/],
  [{...base(),unknown:1},/未対応の物理条件/],
  [{...base(),boundaries:{front:{type:'insulated'}}},/面名は/],
  [{...base(),boundaries:{xMin:{type:'radiation',temperature:300,emissivity:1}}},/未対応の境界条件/],
  [{...base(),boundaries:{xMin:{type:'temperature'}}},/数値範囲外/],
  [{...base(),boundaries:{xMin:{type:'convection',h:-1,temperature:300}}},/数値範囲外/],
  [{...base(),boundaries:{xMin:{type:'flux',flux:NaN}}},/数値範囲外/],
 ];
 for(const [cfg,pattern] of bad)assert.throws(()=>createTransientBrick3d(cfg),pattern);
 const m=createTransientBrick3d({...base(),boundaries:dirichlet(350)});
 assert.throws(()=>m.step(m.safeDt*1.01),/安定性の上限/);
 assert.throws(()=>m.step(0),/数値範囲外/);
 assert.throws(()=>m.step(-1),/数値範囲外/);
});

test('a uniform insulated brick is preserved exactly; a single insulated cell has no stability limit',()=>{
 const m=createTransientBrick3d(base()),s=advance(m,10);
 for(const v of s.temperature)assert.equal(v,300);
 assert.equal(s.energyError,0);
 const single=createTransientBrick3d({...base(),cells:{nx:1,ny:1,nz:1}});
 assert.equal(single.snapshot().safeDt,null);
 single.step(100,false);
 assert.equal(single.snapshot().temperature[0],300);
});

test('Dirichlet cube matches the product-of-series cell averages with second-order grid convergence',()=>{
 const c=reference.cases.dirichletCube,errors={};
 for(const n of [4,8,16]){
  const m=createTransientBrick3d({size:c.size,cells:{nx:n,ny:n,nz:n},k:c.k,rho:c.rho,cp:c.cp,initial:c.initial,boundaries:dirichlet(c.wallTemperature)});
  const s=advance(m,c.time,0.25);
  errors[n]=rms(s.temperature,c.grids[`${n}x${n}x${n}`]);
  assert.ok(s.relativeEnergyError<1e-12,`${n} energy`);
 }
 // Measured 2026-11-07: 0.4916 / 0.1176 / 0.0291 K (dt = safeDt/4 isolates the spatial error).
 assert.ok(errors[4]<0.6&&errors[8]<0.15&&errors[16]<0.04,`rms ${JSON.stringify(errors)}`);
 for(const [coarse,fine] of [[4,8],[8,16]]){
  const order=Math.log2(errors[coarse]/errors[fine]);
  assert.ok(order>1.8&&order<2.25,`${coarse}->${fine} order ${order}`);
 }
});

test('Dirichlet brick (unequal sides) matches the product series and refines at second order',()=>{
 const c=reference.cases.dirichletBrick,errors={};
 for(const [nx,ny,nz] of [[12,8,5],[24,16,10]]){
  const m=createTransientBrick3d({size:c.size,cells:{nx,ny,nz},k:c.k,rho:c.rho,cp:c.cp,initial:c.initial,boundaries:dirichlet(c.wallTemperature)});
  const s=advance(m,c.time,0.25);
  errors[`${nx}x${ny}x${nz}`]=rms(s.temperature,c.grids[`${nx}x${ny}x${nz}`]);
  assert.ok(s.relativeEnergyError<1e-12,'energy');
 }
 // Measured 2026-11-07: 0.5010 / 0.1234 K.
 assert.ok(errors['12x8x5']<0.6&&errors['24x16x10']<0.16);
 assert.ok(errors['12x8x5']/errors['24x16x10']>3.4,'second-order ratio');
});

test('flux-only heating adds exactly the prescribed energy and mean temperature',()=>{
 const cfg={...base(),cells:{nx:8,ny:6,nz:5},boundaries:{xMin:{type:'flux',flux:5000}}};
 const s=advance(createTransientBrick3d(cfg),60);
 const expected=300+5000*(0.08*0.06)*60/(900*1100*0.1*0.08*0.06);
 assert.ok(Math.abs(s.mean-expected)<1e-9,`mean ${s.mean} != ${expected}`);
 assert.ok(Math.abs(s.netInput-5000*(0.08*0.06)*60)<1e-6,'netInput');
 assert.ok(s.relativeEnergyError<1e-12,'energy balance');
});

test('asymmetric flux-plus-convection case conserves energy to roundoff',()=>{
 const cfg={...base(),cells:{nx:8,ny:6,nz:5},boundaries:{xMin:{type:'flux',flux:5000},xMax:{type:'convection',h:50,temperature:290}}};
 const s=advance(createTransientBrick3d(cfg),60);
 assert.ok(s.relativeEnergyError<1e-12,`energy error ${s.energyError}`);
 assert.ok(s.min>295&&s.max<310&&s.max>s.min,'field range');
 assert.ok(s.netInput>0,'net input positive');
});

test('thickness-uniform brick reproduces the 2D rectangular FVM field',()=>{
 const m3=createTransientBrick3d({size:{x:0.12,y:0.09,z:0.04},cells:{nx:12,ny:9,nz:5},k:15,rho:1200,cp:900,initial:320,
  boundaries:{xMin:{type:'temperature',temperature:380},xMax:{type:'convection',h:25,temperature:300},yMin:{type:'flux',flux:2000}}});
 const m2=createThermal({nx:12,ny:9,width:0.12,height:0.09,depth:0.04,materials:[{k:15,rho:1200,cp:900}],initial:320,
  boundaries:{left:{type:'temperature',temperature:380},right:{type:'convection',h:25,temperature:300},bottom:{type:'flux',flux:2000}}});
 const dt=Math.min(m3.safeDt,m2.safeDt);
 for(let s=0;s<300;s++){m3.step(dt,false);m2.step(dt,false);}
 const t3=m3.snapshot().temperature,t2=m2.snapshot().temperature;
 let d=0,spread=0;
 for(let l=0;l<5;l++)for(let j=0;j<9;j++)for(let i=0;i<12;i++){
  d=Math.max(d,Math.abs(t3[i+12*(j+9*l)]-t2[i+12*j]));
  spread=Math.max(spread,Math.abs(t3[i+12*(j+9*l)]-t3[i+12*j]));
 }
 assert.ok(d<1e-9,`3D vs 2D ${d}`);
 assert.ok(spread<1e-9,`z spread ${spread}`);
});

test('marched steady state equals the independently solved discrete system',()=>{
 const c=reference.cases.steadyDiscrete;
 const bc=Object.fromEntries(Object.entries(c.faceTemperatures).map(([f,t])=>[f,{type:'temperature',temperature:t}]));
 const m=createTransientBrick3d({size:c.size,cells:{nx:c.grid[0],ny:c.grid[1],nz:c.grid[2]},k:c.k,rho:c.rho,cp:c.cp,initial:c.initial,boundaries:bc});
 const s=steady(m);
 assert.ok(c.solveResidualMax<1e-8,'reference solve residual');
 // Measured 2026-11-07: max difference 6.8e-13 K.
 assert.ok(maxd(s.temperature,c.temperature)<1e-9,'discrete steady match');
});

test('steady state approaches the continuum series solution; edge jumps limit the RMS rate',()=>{
 const c=reference.cases.steadySeries;
 const bc=Object.fromEntries(Object.entries(c.faceTemperatures).map(([f,t])=>[f,{type:'temperature',temperature:t}]));
 const full={},interior={};
 for(const n of [8,16]){
  const m=createTransientBrick3d({size:c.size,cells:{nx:n,ny:n,nz:n},k:c.k,rho:c.rho,cp:c.cp,initial:c.initial,boundaries:bc});
  const s=steady(m),r=c.grids[`${n}x${n}x${n}`],inner=[],innerRef=[];
  full[n]=rms(s.temperature,r);
  for(let l=1;l<n-1;l++)for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){inner.push(s.temperature[i+n*(j+n*l)]);innerRef.push(r[i+n*(j+n*l)]);}
  interior[n]=rms(inner,innerRef);
  assert.ok(c.tailRmsK[`${n}x${n}x${n}`]<0.05,'series tail below discretization error');
 }
 // Measured 2026-11-07: full 0.7335 / 0.3736 K, interior 0.3189 / 0.1417 K.
 // The boundary data jump at the twelve edges, so the RMS rate is about
 // first order here even though the scheme is second order on smooth
 // fields (see the Dirichlet transient cases above).
 assert.ok(full[8]<0.85&&full[16]<0.45,`full rms ${JSON.stringify(full)}`);
 assert.ok(full[8]/full[16]>1.7,'full rms decreases');
 assert.ok(interior[8]/interior[16]>1.9,'interior rms decreases');
});

test('single-cell convection follows the exact discrete amplification and h=0 insulates',()=>{
 const one=(h)=>createTransientBrick3d({size:{x:0.1,y:0.1,z:0.1},cells:{nx:1,ny:1,nz:1},k:10,rho:1000,cp:1000,initial:400,
  boundaries:{xMin:{type:'convection',h,temperature:300},xMax:{type:'convection',h,temperature:300}}});
 const m=one(20),G=0.01/(0.1/(2*10)+1/20),C=1000*1000*0.001,dt=0.4*m.safeDt;
 let expected=400;
 for(let s=0;s<50;s++){m.step(dt,false);expected=300+(expected-300)*(1-dt*2*G/C);}
 assert.ok(Math.abs(m.snapshot().temperature[0]-expected)<1e-9,'discrete amplification');
 const insulated=one(0);insulated.step(1,false);
 assert.equal(insulated.snapshot().temperature[0],400);
});

test('snapshot and restore round-trip the full state',()=>{
 const m=createTransientBrick3d({...base(),boundaries:{xMin:{type:'temperature',temperature:380},zMax:{type:'convection',h:10,temperature:290}}});
 advance(m,2);const s=m.snapshot();
 const restored=createTransientBrick3d({...base(),boundaries:{xMin:{type:'temperature',temperature:380},zMax:{type:'convection',h:10,temperature:290}}}).restore(s);
 assert.deepEqual(restored.temperature,s.temperature);
 assert.equal(restored.time,s.time);
 assert.equal(restored.netInput,s.netInput);
 assert.throws(()=>m.restore({temperature:[1,2],time:0,netInput:0,steps:0}),/再生状態が不正/);
});
