import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createBoxRadiation3D,BOX_RADIATION_3D_FACE_IDS} from '../dynamic/dev/box-radiation-3d.mjs';
import {createRadiationNetwork} from '../dynamic/radiation-network.mjs';
import {createLongDuctRadiation} from '../dynamic/dev/long-duct-radiation.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/BOX_RADIATION_3D_REFERENCE_20261107.json',import.meta.url)));
const relNear=(a,b,tol=1e-11)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b} (rel tol ${tol})`);
const facesOf=(temperatures,emissivities,extra={})=>temperatures.map((temperature,i)=>({temperature,emissivity:emissivities[i],capacity:2e5,...extra}));
const grayConfig=()=>({dimensions:{x:2,y:1,z:3},faces:facesOf([600,300,400,350,500,450],[.8,.6,.9,.5,.7,1]),maxTemperature:700});

test('generator is pinned and its analytic factors satisfy the enclosure identities at 50 digits',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-box-radiation-3d-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);
 assert.equal(reference.releaseApproved,false);
 assert.deepEqual(reference.faceOrder,[...BOX_RADIATION_3D_FACE_IDS]);
 for(const row of reference.cases){
  assert.ok(row.formulaRowSumMaxError<1e-38,`${row.id} row sum`);
  assert.ok(row.formulaReciprocityMaxError<1e-38,`${row.id} reciprocity`);
  assert.ok(Math.abs(row.radiationBalanceW)<1e-25,`${row.id} balance`);
 }
});

test('connector snapshots agree with the independent mpmath radiosity reference for every recorded case',()=>{
 for(const row of reference.cases){
  const [x,y,z]=row.dimensions,m=createBoxRadiation3D({dimensions:{x,y,z},faces:facesOf(row.temperaturesK,row.emissivities),maxTemperature:700}),s=m.snapshot(),g=m.geometry;
  // The connected factors are the kernel's, and they match the analytic matrix.
  g.viewFactors.forEach((values,i)=>values.forEach((v,j)=>relNear(v,row.viewFactors[i][j],2e-11)));
  g.areas.forEach((v,i)=>relNear(v,row.areas[i],1e-12));
  assert.equal(g.scope.radiationNetworkConnected,true);assert.equal(g.diagnostics.networkAdmission.renormalized,false);
  assert.ok(g.diagnostics.networkAdmission.maximumRowResidual<=1e-12);assert.ok(g.diagnostics.networkAdmission.reciprocityRelativeResidual<=1e-12);
  s.radiosity.forEach((v,i)=>relNear(v,row.radiosityWPerM2[i]));
  s.irradiation.forEach((v,i)=>relNear(v,row.irradiationWPerM2[i]));
  s.outwardPower.forEach((v,i)=>relNear(v,row.outwardPowerW[i]));
  s.pairPower.forEach((values,i)=>values.forEach((v,j)=>relNear(v,row.pairPowerW[i][j])));
  assert.ok(Math.abs(s.radiationBalance)<=1e-9,`balance ${s.radiationBalance}`);
  s.faceOutwardFlux.forEach((v,i)=>relNear(v,row.outwardPowerW[i]/row.areas[i]));
  assert.equal(s.scope.radiationNetworkConnected,true);assert.equal(s.scope.generalGeometry,false);assert.equal(s.scope.curvedSurfaces,false);assert.equal(s.releaseApproved,false);
 }
 // Reradiating sides carry exactly no net power while the coupled pair exchanges through them.
 const row=reference.cases.find(r=>r.id==='gray-cube-reradiating-sides'),s=createBoxRadiation3D({dimensions:{x:1,y:1,z:1},faces:facesOf(row.temperaturesK,row.emissivities),maxTemperature:700}).snapshot();
 for(const i of [2,3,4,5])assert.ok(Math.abs(s.outwardPower[i])<=1e-9,`side ${i} ${s.outwardPower[i]}`);
 relNear(s.outwardPower[0],-s.outwardPower[1],1e-12);
});

test('isothermal blackbody cube exchanges nothing, and the connector adds no numerical deviation to the bare network',()=>{
 const iso=createBoxRadiation3D({dimensions:{x:1,y:1,z:1},faces:facesOf(Array(6).fill(400),Array(6).fill(1))}).snapshot();
 iso.outwardPower.forEach(v=>assert.ok(Math.abs(v)<=1e-12));iso.pairPower.flat().forEach(v=>assert.ok(Math.abs(v)<=1e-12));assert.equal(iso.radiationBalance,0);
 const cfg=grayConfig(),m=createBoxRadiation3D(cfg),g=m.geometry;
 const bare=createRadiationNetwork({surfaces:cfg.faces.map((f,i)=>({id:g.faces[i].id,area:g.areas[i],capacity:f.capacity,power:0,temperature:f.temperature,emissivity:f.emissivity})),viewFactors:g.viewFactors,maxTemperature:700});
 const a=m.snapshot(),b=bare.snapshot();
 assert.deepEqual(a.temperature,b.temperature);assert.deepEqual(a.radiosity,b.radiosity);assert.deepEqual(a.irradiation,b.irradiation);assert.deepEqual(a.outwardPower,b.outwardPower);assert.deepEqual(a.pairPower,b.pairPower);
 m.step(10);bare.step(10);assert.deepEqual(m.snapshot().temperature,bare.snapshot().temperature);
});

test('admission escalates resolution only when needed and refuses an explicitly under-resolved matrix without renormalising',()=>{
 const admitted=(dims,extra={})=>createBoxRadiation3D({dimensions:dims,faces:facesOf(Array(6).fill(300),Array(6).fill(.8)),...extra});
 for(const dims of [{x:1,y:1,z:1},{x:2,y:1,z:3},{x:1,y:1000,z:1}])assert.equal(admitted(dims).geometry.diagnostics.networkAdmission.resolutionEscalated,false);
 const flat=admitted({x:1,y:1,z:.001});assert.equal(flat.geometry.diagnostics.networkAdmission.resolutionEscalated,true);
 assert.ok(flat.geometry.diagnostics.maximumRowResidual<=1e-9);assert.equal(flat.geometry.scope.radiationNetworkConnected,true);
 assert.throws(()=>admitted({x:1,y:1,z:.001},{integration:{separationPanels:10,polarPanels:16,gaussOrder:6}}),/受入精度/);
 const explicit=admitted({x:1,y:1,z:.001},{integration:{separationPanels:20,polarPanels:32,gaussOrder:7}});assert.equal(explicit.geometry.diagnostics.networkAdmission.resolutionEscalated,false);
});

test('long boxes approach the independent long-duct crossed-string solution monotonically',()=>{
 const duct=createLongDuctRadiation({outline:[[0,0],[1,0],[1,1],[0,1]],span:1,walls:[600,500,300,400].map(temperature=>({temperature,emissivity:.8,capacityPerLength:2e5})),maxTemperature:700}).snapshot();
 const pairs=[[0,0],[1,2],[4,3],[5,1]],errors={};
 for(const L of [20,100]){
  const s=createBoxRadiation3D({dimensions:{x:1,y:L,z:1},faces:[{temperature:600,emissivity:.8,capacity:2e5},{temperature:300,emissivity:.8,capacity:2e5},{temperature:300,emissivity:1,capacity:2e5},{temperature:300,emissivity:1,capacity:2e5},{temperature:400,emissivity:.8,capacity:2e5},{temperature:500,emissivity:.8,capacity:2e5}],maxTemperature:700}).snapshot();
  errors[L]=pairs.map(([bi,di])=>Math.abs(s.outwardPower[bi]/L-duct.wallOutwardPowerPerLength[di])/Math.abs(duct.wallOutwardPowerPerLength[di]));
 }
 pairs.forEach((_,k)=>assert.ok(errors[100][k]<errors[20][k],`pair ${k}: ${errors[20][k]} -> ${errors[100][k]}`));
 assert.ok(errors[100][0]<5e-3,`bottom approach ${errors[100][0]}`);errors[100].forEach(e=>assert.ok(e<5e-2));
});

test('finite-capacity gray box conserves energy to round-off and relaxes to the capacity-weighted equilibrium',()=>{
 const m=createBoxRadiation3D(grayConfig());let s;
 for(let i=0;i<3000;i++){s=m.step(m.safeDt);assert.ok(Math.abs(s.radiationBalance)<=1e-9);}
 assert.ok(Math.max(...s.temperature)-Math.min(...s.temperature)<1e-9);
 s.temperature.forEach(v=>assert.ok(Math.abs(v-2600/6)<1e-9,`${v} != ${2600/6}`));
 assert.ok(s.relativeEnergyError<1e-12,`relative energy error ${s.relativeEnergyError}`);
});

test('power and heatFlux inputs are equivalent, and valid rewind/resume is exact',()=>{
 const base={dimensions:{x:1,y:1,z:1},maxTemperature:700},hot={temperature:500,emissivity:.8,capacity:2e5},cold={temperature:300,emissivity:.8,capacity:2e5};
 const a=createBoxRadiation3D({...base,faces:[{...hot,power:100},cold,cold,cold,cold,cold]}),b=createBoxRadiation3D({...base,faces:[{...hot,heatFlux:100},cold,cold,cold,cold,cold]});
 a.step(10);b.step(10);assert.deepEqual(a.snapshot(),b.snapshot());relNear(a.snapshot().netInput,1000,1e-12);
 const m=createBoxRadiation3D(grayConfig()),history=[];
 for(let i=0;i<8;i++){m.step(10);history.push(m.snapshot());}
 const middle=m.snapshot();m.restore(history[2]);for(let i=3;i<8;i++)m.step(10);assert.deepEqual(m.snapshot(),middle);
 const geometry=m.geometry;geometry.viewFactors[0][1]=999;const c=m.config;c.faces[0].temperature=1;assert.deepEqual(m.snapshot(),middle);assert.notEqual(m.geometry.viewFactors[0][1],999);
});

test('invalid conditions, out-of-scope requests and corrupt restoration fail atomically and leave caller data intact',()=>{
 const c=grayConfig(),before=structuredClone(c);
 for(const v of [{...c,faces:c.faces.slice(0,5)},{...c,faces:facesOf(Array(6).fill(300),Array(6).fill(1.5))},{...c,faces:[{...c.faces[0],power:1,heatFlux:1},...c.faces.slice(1)]},{...c,faces:[{...c.faces[0],area:2},...c.faces.slice(1)]},{...c,curved:true},{...c,dimensions:{x:1,y:1,z:1,w:2}}])assert.throws(()=>createBoxRadiation3D(v));
 // An all-mirror enclosure has no unique radiosity level: the network either
 // refuses the singular system or returns the physical zero exchange.  A
 // nonzero exchange would be the failure.
 try{createBoxRadiation3D({...c,faces:facesOf(Array(6).fill(300),Array(6).fill(0))}).snapshot().outwardPower.forEach(v=>assert.ok(Math.abs(v)<=1e-9));}
 catch(e){assert.match(e.message,/特異または悪条件/);}
 const m=createBoxRadiation3D(c);m.step(10);const state=m.snapshot();
 for(const dt of [0,-1,NaN,Infinity,m.safeDt*2]){assert.throws(()=>m.step(dt));assert.deepEqual(m.snapshot(),state);}
 for(const v of [{...state,time:NaN},{...state,time:-1},{...state,steps:0},{...state,lastDt:m.safeDt*2},{...state,netInput:1},{...state,temperature:state.temperature.map(v=>v+1)},{...state,temperature:[NaN,300,300,300,300,300]}]){assert.throws(()=>m.restore(v));assert.deepEqual(m.snapshot(),state);}
 assert.deepEqual(c,before);assert.equal(state.scope.participatingMedium,false);assert.equal(state.releaseApproved,false);
});
