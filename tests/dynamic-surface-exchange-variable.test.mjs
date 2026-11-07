import test from 'node:test';import assert from 'node:assert/strict';
import {createThermal} from '../dynamic/thermal.mjs';
// Acceptance regression for variable properties k(T)/cp(T) combined with the
// convection-radiation boundary in the rectangular FVM (thermal.mjs).
// Reference values: radiation-closure-verification-20261107.md section 5
// (independent Kirchhoff steady solution and DOP853 references), re-measured
// against this JS implementation when the guard was removed (2026-11-07).
const sigma=5.670374419e-8;
const bc={type:'convection-radiation',temperature:300,radiationTemperature:350,h:20,emissivity:.8};
const tables={kTable:[[250,3.0],[700,7.5]],cpTable:[[250,300],[700,750]]};
const docMaterials=(extra={})=>[{k:5,rho:1000,cp:500,...extra}];
const docCase=(nx,extra={})=>({nx,ny:1,width:.1,height:1,depth:1,materials:docMaterials(extra),initial:300,
 boundaries:{left:{type:'temperature',temperature:600},right:bc}});

test('variable properties with the combined boundary are accepted; the outline refusal still wins',()=>{
 const base={nx:4,ny:1,width:.1,height:1,depth:1,initial:320,
  boundaries:{left:{type:'temperature',temperature:600},right:bc}};
 for(const extra of [{kTable:tables.kTable},{cpTable:tables.cpTable},{...tables}]){
  const m=createThermal({...base,materials:docMaterials(extra)}),s=m.step(m.safeDt);
  assert.ok(s.temperature.every(Number.isFinite));
 }
 for(const right of [{type:'convection',temperature:300,h:20},{type:'radiation',temperature:350,emissivity:.8}]){
  const m=createThermal({...base,materials:docMaterials({...tables}),boundaries:{left:{type:'temperature',temperature:600},right}});
  assert.ok(m.step(m.safeDt).temperature.every(Number.isFinite));
 }
 assert.throws(()=>createThermal({...base,materials:docMaterials({...tables}),outline:[[0,0],[.1,0],[.1,1],[0,1]]}),/自由輪郭/);
});

test('variable-property combined slab reproduces the independent Kirchhoff steady state',()=>{
 // Exact steady state for k(T)=3+0.01(T-250): Phi(T)=int_250^T k dT is linear in x,
 // and Ts balances conduction against convection+radiation. Solved here by
 // bisection + Simpson cell averages; no solver code is shared with thermal.mjs.
 const Phi=T=>3*(T-250)+0.005*(T-250)**2,PhiInv=p=>250+(-3+Math.sqrt(9+0.02*p))/0.01;
 const residual=Ts=>(Phi(600)-Phi(Ts))/.1-(20*(Ts-300)+.8*sigma*(Ts**4-350**4));
 let lo=300,hi=600;for(let i=0;i<200;i++){const mid=(lo+hi)/2;if(residual(mid)>0)lo=mid;else hi=mid;}
 const TsExact=(lo+hi)/2,qExact=20*(TsExact-300)+.8*sigma*(TsExact**4-350**4);
 assert.ok(Math.abs(TsExact-498.4157)<5e-4,`reference sanity: Ts=${TsExact}`);
 assert.ok(Math.abs(qExact-6087.01)<.01,`reference sanity: q=${qExact}`);
 const cellAvg=N=>{const dx=.1/N,out=[];for(let i=0;i<N;i++){const a=i*dx,M=400,hx=dx/M;let s=0;
  for(let j=0;j<=M;j++)s+=PhiInv(Phi(600)-qExact*(a+hx*j))*(j===0||j===M?1:j%2?4:2);out.push(s*hx/3/dx);}return out;};
 const errors=[];
 for(const N of [16,32]){
  const m=createThermal(docCase(N,{...tables}));while(m.time<20000)m.step(m.safeDt);
  const s=m.snapshot(),exact=cellAvg(N),err=Math.max(...s.temperature.map((t,i)=>Math.abs(t-exact[i])));
  errors.push(err);
  const se=s.surfaceExchange[0];
  assert.ok(Math.abs(se.surfaceTemperatureMinK-TsExact)<1e-6,`N=${N} Ts ${se.surfaceTemperatureMinK} vs exact ${TsExact}`);
  assert.ok(Math.abs(-se.inwardWatts-qExact)/qExact<1e-9,`N=${N} q ${-se.inwardWatts} vs exact ${qExact}`);
  assert.ok(Math.abs(se.convectionOutwardWatts-3968.31)<.05&&Math.abs(se.radiationOutwardWatts-2118.70)<.05,`N=${N} components`);
  assert.ok(s.relativeEnergyError<1e-9,`N=${N} energy ${s.relativeEnergyError}`);
 }
 assert.ok(errors[0]<1e-2&&errors[1]<3e-3,`cell errors ${errors}`);
 const order=errors[0]/errors[1];assert.ok(order>3.2&&order<4.8,`spatial order ratio ${order}`);
});

test('variable-property combined transient is first order in dt',()=>{
 const t=100,fields=[];
 for(const f of [1,4,16]){const m=createThermal(docCase(16,{...tables}));
  while(m.time<t-1e-12)m.step(Math.min(m.safeDt/f,t-m.time));fields.push(m.snapshot().temperature);}
 const d1=Math.max(...fields[0].map((v,i)=>Math.abs(v-fields[1][i]))),
       d2=Math.max(...fields[1].map((v,i)=>Math.abs(v-fields[2][i])));
 assert.ok(d1>.02,`dt refinement must show a real difference, got ${d1}`);
 const ratio=d1/d2;assert.ok(ratio>3.2&&ratio<4.8,`time order ratio ${ratio}`);
});

test('safeDt stays stable when the radiation tangent far exceeds the half-cell conductance',()=>{
 // Single cell, G/A=20 W/m2K; at Ts=2000 K the tangent 4*eps*sigma*Ts^3 is
 // ~1814 W/m2K, about 90x G/A. |dq_in/dTc| = G*X/(G+X) <= G keeps the
 // G-only sumG bound conservative; measured here at dt=safeDt itself.
 const hot={type:'convection-radiation',temperature:300,radiationTemperature:2000,h:0,emissivity:1};
 for(const [name,materials,maxGperA] of [
  ['constant',[{k:1,rho:1000,cp:1000}],20],
  ['variable',[{k:1,rho:1000,cp:1000,kTable:[[250,.8],[2500,1.2]],cpTable:[[250,900],[2500,1100]]}],24]]){
  const m=createThermal({nx:1,ny:1,width:.1,height:1,depth:1,materials,initial:300,boundaries:{right:hot}});
  let prev=300,maxRatio=0,s;
  for(let i=0;i<80;i++){s=m.step(m.safeDt);const T=s.temperature[0];
   assert.ok(T>=prev-1e-9&&T<=2000+1e-9,`${name}: step ${i} left the bounded monotone path at ${T}`);
   prev=T;maxRatio=Math.max(maxRatio,4*sigma*s.surfaceExchange[0].surfaceTemperatureMaxK**3/maxGperA);}
  assert.ok(maxRatio>50,`${name}: stress regime actually entered, tangent/G max ${maxRatio}`);
  assert.ok(Math.abs(s.temperature[0]-2000)<.05,`${name}: final ${s.temperature[0]}`);
  assert.ok(s.relativeEnergyError<1e-12,`${name}: energy ${s.relativeEnergyError}`);
 }
});

test('a surface temperature outside a property table stops the step without advancing',()=>{
 const hot={temperature:1500,radiationTemperature:1500,h:10,emissivity:.9},
       cold={temperature:100,radiationTemperature:100,h:10,emissivity:.9};
 for(const [name,materials,weak] of [
  ['kTable',[{k:5,rho:1000,cp:500,kTable:[[300,5],[600,5]]}],[{k:.5,rho:1000,cp:500,kTable:[[300,.5],[600,.5]]}]],
  ['cpTable',[{k:5,rho:1000,cp:500,cpTable:[[300,500],[600,500]]}],[{k:.5,rho:1000,cp:500,cpTable:[[300,500],[600,500]]}]]]){
  for(const [label,mats,bcOver] of [['high',materials,hot],['low',weak,cold]]){
   const m=createThermal({nx:1,ny:1,width:.1,height:1,depth:1,materials:mats,initial:400,
    boundaries:{right:{type:'convection-radiation',...bcOver}}});
   const before=m.snapshot();
   assert.throws(()=>m.step(m.safeDt),/物性表の範囲/,`${name} ${label} side`);
   const after=m.snapshot();assert.equal(after.time,0);assert.deepEqual(after.temperature,before.temperature);
  }
  const ok=createThermal({nx:1,ny:1,width:.1,height:1,depth:1,materials,initial:400,
   boundaries:{right:{type:'convection-radiation',temperature:500,radiationTemperature:450,h:10,emissivity:.9}}});
  assert.ok(Number.isFinite(ok.step(ok.safeDt).temperature[0]),`${name} in-range control`);
 }
});
