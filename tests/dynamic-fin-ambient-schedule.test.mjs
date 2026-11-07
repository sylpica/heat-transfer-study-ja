import test from 'node:test';import assert from 'node:assert/strict';
import {createThermal} from '../dynamic/thermal.mjs';import {finLearningConfigs,FinJourney} from '../dynamic/fin-learning.mjs';
// Acceptance tests for the ambient-temperature schedule of the fin lateral
// loss (fin-coupling-verification-20261107.md section 2, conditions (a)1-5).
// Pinned values come from that record: the step response measured through a
// probe (C vs A at t=130 s: 2.079759043574086 K; C vs B at t=600 s:
// 1.844509523607485e-05 K; relative energy error 6.0e-15) and its independent
// enthalpy-form reference / analytic steady states. The regular input path
// implemented in thermal.mjs must reproduce the same physics.
const base=()=>structuredClone(finLearningConfigs(48)[0]);
const withSchedule=()=>{const c=base();c.distributedConvection.temperatureSchedule=[{at:100,temperature:313.15}];return c;};
const constant=temperature=>{const c=base();c.distributedConvection.temperature=temperature;return c;};
const runTo=(m,t)=>{while(m.time<t-1e-12)m.step(Math.min(m.safeDt,t-m.time),false);return m.snapshot();};
const maxDiff=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));

test('ambient schedule is validated at construction and is not a backdoor',()=>{
 for(const bad of [[],[{at:100,temperature:0}],[{at:100,temperature:-1}],[{at:100,temperature:NaN}],[{at:-1,temperature:313.15}],[{at:100,temperature:313.15},{at:100,temperature:320}],[{at:100,temperature:313.15},{at:50,temperature:320}],'x',[null],[{temperature:313.15}],[{at:100}]]){
  const c=base();c.distributedConvection.temperatureSchedule=bad;assert.throws(()=>createThermal(c),/流体温度|有限値|正/);}
 const c=base();c.distributedConvection.temperature=[293.15];assert.throws(()=>createThermal(c));
 // Post-construction mutation of the returned config must not change physics:
 // the schedule path is sealed at construction by design.
 const sealed=createThermal(withSchedule()),pristine=createThermal(withSchedule());
 sealed.config.distributedConvection.temperature=400;sealed.config.distributedConvection.temperatureSchedule=[{at:0,temperature:400}];sealed.config.distributedConvection.h=9999;
 runTo(sealed,130);runTo(pristine,130);
 assert.equal(maxDiff(sealed.snapshot().temperature,pristine.snapshot().temperature),0);
});

test('ambient schedule leaves safeDt unchanged (the bound depends on h only)',()=>{
 assert.equal(createThermal(withSchedule()).safeDt,createThermal(base()).safeDt);
});

test('ambient step response reproduces the verified record',()=>{
 const a=createThermal(constant(293.15)),b=createThermal(constant(313.15)),c=createThermal(withSchedule());
 const c100=runTo(c,100),a100=runTo(a,100);
 assert.equal(maxDiff(c100.temperature,a100.temperature),0);
 // At the exact switch instant the reported ambient is already the new value;
 // the temperature field still equals the pre-change run because the step
 // that arrived at t=100 was evaluated with the old ambient.
 assert.equal(c100.ambientTemperature,313.15);
 const c130=runTo(c,130),a130=runTo(a,130);
 assert.equal(c130.ambientTemperature,313.15);
 assert.ok(Math.abs(maxDiff(c130.temperature,a130.temperature)-2.079759043574086)<.005);
 const c600=runTo(c,600),b600=runTo(b,600);
 assert.ok(maxDiff(c600.temperature,b600.temperature)<1e-4);
 assert.ok(c600.relativeEnergyError<1e-11);
 // Analytic steady state at the new ambient (adiabatic-tip cosh profile,
 // cell averages), independent of both runs.
 const L=.1,n=48,dx=L/n,m=Math.sqrt(50),thetaB=353.15-313.15;
 const analytic=Array.from({length:n},(_,j)=>313.15+thetaB*(Math.sinh(m*(L-j*dx))-Math.sinh(m*(L-(j+1)*dx)))/(m*dx*Math.cosh(m*L)));
 assert.ok(maxDiff(c600.temperature,analytic)<3e-3);
});

test('snapshot/restore keeps the ambient state consistent with physical time',()=>{
 const c=createThermal(withSchedule());
 const s50=runTo(c,50);assert.equal(s50.ambientTemperature,293.15);
 const s130=runTo(c,130);assert.equal(s130.ambientTemperature,313.15);
 c.restore(s50);assert.equal(c.snapshot().ambientTemperature,293.15);
 const again=runTo(c,130);
 assert.equal(maxDiff(again.temperature,s130.temperature),0);
 assert.equal(again.ambientTemperature,313.15);
 c.restore(s130);assert.equal(c.snapshot().ambientTemperature,313.15);
});

test('the learning journey keeps fixed conditions: a schedule is rejected',()=>{
 const configs=[withSchedule(),structuredClone(finLearningConfigs(48)[1])],models=configs.map(createThermal),journey=new FinJourney();
 assert.throws(()=>journey.prepare({configs,snapshots:models.map(m=>m.snapshot())}),/一致しません/);
 assert.equal(journey.prepared,false);
});
