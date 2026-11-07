import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createDevelopedChannel} from '../dynamic/developed-channel.mjs';import {ChannelJourney,channelLearningConfigs,channelThermalHarmonic} from '../dynamic/channel-learning.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/CHANNEL_LEARNING_REFERENCE_20261105.json',import.meta.url))),setup=(path='tutorial',nx=64,ny=24)=>{const configs=channelLearningConfigs(nx,ny),models=configs.map(createDevelopedChannel),journey=new ChannelJourney(path);journey.prepare({configs,snapshots:models.map(m=>m.snapshot())});return {configs,models,journey};},run=models=>{for(const model of models)for(let i=1;i<=20;i++){const end=i*.00625;while(model.time<end)model.step(Math.min(model.safeDt,end-model.time),false);}return models.map(m=>m.snapshot());};
test('guided channel observes opposite thermal transport and conserved sensible heat before a real rewind',()=>{
 const {models,journey}=setup(),initial=models.map(m=>m.snapshot());journey.locate({x:.8,y:.5});assert.equal(journey.canRun,false);journey.locate({x:.25,y:.5});assert.equal(journey.canRun,true);const states=run(models);journey.observe(states);assert.ok(journey.result.a.equivalentDisplacementM>0);assert.ok(journey.result.b.equivalentDisplacementM<0);assert.ok(Math.abs(journey.result.a.equivalentDisplacementM+journey.result.b.equivalentDisplacementM)<1e-13);assert.equal(journey.complete,false);states.forEach(s=>assert.ok(Math.abs(s.energyError)<1e-8));models.forEach((m,i)=>m.restore(initial[i]));journey.rewind(models.map(m=>m.snapshot()));assert.equal(journey.complete,true);assert.deepEqual(models.map(m=>m.snapshot()),initial);
});
test('flow prediction locks before calculation and leaves physical states ungraded and unchanged',()=>{
 const {models,journey}=setup('prediction'),before=models.map(m=>m.snapshot());assert.throws(()=>journey.predict(undefined,0));assert.throws(()=>journey.predict('opposite',.1));journey.predict('stationary',0);assert.deepEqual(models.map(m=>m.snapshot()),before);assert.throws(()=>journey.predict('opposite',0));journey.observe(run(models));assert.equal(journey.prediction,'stationary');assert.equal(journey.result.observed,'opposite');assert.equal(journey.complete,true);
});
test('first thermal harmonic and startup velocity agree with an independently converged continuous spectral ODE',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-channel-learning-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);assert.ok(Math.abs(reference.convergence.at(-1).phaseRad-reference.convergence.at(-2).phaseRad)<1e-5);const errors=[];
 for(const [nx,ny]of [[32,12],[64,24]]){
  const {configs,models}=setup('prediction',nx,ny),states=run(models),h=channelThermalHarmonic(configs[0],states[0]),r=reference.samples.find(row=>row.ny===ny),uError=Math.sqrt(states[0].velocity.reduce((sum,u,i)=>sum+(u-r.velocityCellAverageMPerS[i])**2,0)/ny),thermalError=Math.sqrt(h.rows.reduce((sum,t,i)=>sum+(t.realK-r.firstHarmonicRealK[i])**2+(t.imaginaryK-r.firstHarmonicImagK[i])**2,0)/ny);
  assert.ok(Math.abs(h.equivalentDisplacementM-reference.convergence.at(-1).equivalentDisplacementM)<(nx===32?.0003:.0001));assert.ok(uError<(nx===32?.003:.001));assert.ok(thermalError<.01);assert.ok(Math.abs(h.volumeMeanTemperatureK-reference.continuousVolumeMeanTemperatureK)<1e-8);errors.push(thermalError);
 }
 assert.ok(errors[0]/errors[1]>1.5,'first-order upwind temperature convergence, not a second-order claim');
});
test('wrong channel conditions, unresolved harmonics and invalid step order cannot become observations',()=>{
 const {configs,models,journey}=setup(),bad=structuredClone(configs);bad[0].acceleration*=2;assert.throws(()=>journey.prepare({configs:bad,snapshots:models.map(m=>m.snapshot())}));assert.equal(journey.prepared,false);
 const early=setup('prediction');early.models.forEach(m=>m.step(.00001));early.journey.observe(early.models.map(m=>m.snapshot()));assert.match(early.journey.reason,/確定前/);assert.equal(early.journey.result,null);
 const late=setup('prediction');late.journey.predict('opposite',0);late.journey.observe(run(late.models).map(s=>({...s,time:.2})));assert.match(late.journey.reason,/0.125秒/);assert.equal(late.journey.result,null);
 assert.throws(()=>channelThermalHarmonic(configs[0],{temperature:Array(configs[0].nx*configs[0].ny).fill(300)}));assert.throws(()=>channelLearningConfigs(64,12));assert.throws(()=>new ChannelJourney('invalid'));
});
