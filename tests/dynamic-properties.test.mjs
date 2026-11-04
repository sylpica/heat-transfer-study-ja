import test from 'node:test';import assert from 'node:assert/strict';import {positiveTable} from '../dynamic/properties.mjs';import {createThermal} from '../dynamic/thermal.mjs';
test('positive SI property table interpolates its own endpoints and refuses unsorted or extrapolated data',()=>{
 const p=positiveTable([[280,2],[300,4],[330,7]]);assert.equal(p.at(280),2);assert.equal(p.at(290),3);assert.equal(p.at(315),5.5);assert.equal(p.at(330),7);assert.equal(p.maxValue,7);
 for(const T of [279,331,NaN,Infinity])assert.throws(()=>p.at(T));for(const rows of [[[300,1],[290,2]],[[300,1],[300,2]],[[280,-1],[300,2]],[[0,1],[300,2]],[]])assert.throws(()=>positiveTable(rows));
});
const config=n=>({nx:n,ny:1,width:1,height:1,depth:1,materials:[{k:1,rho:1,cp:1,kTable:[[290,.5],[300,1],[320,2]]}],initial:300,boundaries:{left:{type:'temperature',temperature:320},right:{type:'temperature',temperature:300}}});
test('temperature-dependent k converges to the independent Kirchhoff-transformed steady conduction solution',()=>{
 const errors=[];for(const n of [10,20,40]){const m=createThermal(config(n));while(m.time<3)m.step(Math.min(m.safeDt,3-m.time),false);const s=m.snapshot();const error=Math.sqrt(s.temperature.reduce((sum,t,i)=>{const potential=30*(1-(i+.5)/n),theta=2*potential/(1+Math.sqrt(1+.1*potential));return sum+(t-300-theta)**2;},0)/n);errors.push(error);assert.ok(Math.abs(s.energyError)<1e-8);assert.ok(s.min>=300&&s.max<=320);}
 assert.ok(errors[1]<errors[0]/3.3);assert.ok(errors[2]<errors[1]/3.3);assert.ok(errors[2]<.005);
});
test('initial, boundary and updated temperature outside the supplied property range stop atomically',()=>{
 assert.throws(()=>createThermal({...config(10),initial:280}),/範囲/);const c=config(10);c.boundaries.left.temperature=350;const m=createThermal(c),before=m.snapshot();assert.throws(()=>m.step(m.safeDt),/範囲/);assert.deepEqual(m.snapshot(),before);assert.throws(()=>m.restore({...before,temperature:Array(10).fill(400)}),/範囲/);assert.deepEqual(m.snapshot(),before);
 const heated=createThermal({...config(10),source:1e8,boundaries:{}}),old=heated.snapshot();assert.throws(()=>heated.step(heated.safeDt),/範囲/);assert.deepEqual(heated.snapshot(),old);
});

test('temperature-dependent conduction coupled to convection and radiation matches an independent surface heat balance',()=>{
 for(const kind of ['convection','radiation']){
  const boundary=kind==='convection'?{type:kind,h:2,temperature:300}:{type:kind,emissivity:.8,temperature:300},S=5.670374419e-8,phi=theta=>theta+.025*theta*theta;
  let a=0,b=20;for(let i=0;i<70;i++){const theta=(a+b)/2,out=kind==='convection'?2*theta:.8*S*((300+theta)**4-300**4);if(30-phi(theta)>out)a=theta;else b=theta;}
  const surface=(a+b)/2,expectedFlux=30-phi(surface),m=createThermal({...config(50),boundaries:{left:{type:'temperature',temperature:320},right:boundary}});while(m.time<4)m.step(Math.min(m.safeDt,4-m.time),false);
  const q=m.flux().x;assert.ok(Math.abs(q[Math.floor(q.length/2)]-expectedFlux)<.03);assert.ok(Math.abs(m.snapshot().energyError)<1e-8);
 }
});
