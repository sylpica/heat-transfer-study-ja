import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createRadial} from '../dynamic/radial.mjs';import {RadialJourney,radialCoolingConfigs} from '../dynamic/radial-learning.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/RADIAL_LEARNING_REFERENCE_20261105.json',import.meta.url))),setup=(path='tutorial',n=64)=>{const configs=radialCoolingConfigs(n),models=configs.map(createRadial),journey=new RadialJourney(path);journey.prepare({configs,meshes:models.map(m=>m.mesh),snapshots:models.map(m=>m.snapshot())});return {configs,models,journey};},advance=models=>{for(const m of models)while(m.time<1)m.step(Math.min(m.safeDt,1-m.time),false);return models.map(m=>m.snapshot());};
test('radial tutorial compares physical volume means and finishes only after a real rewind',()=>{
 const {models,journey}=setup(),initial=models.map(m=>m.snapshot());assert.equal(journey.canRun,false);journey.locate(.8);assert.equal(journey.canRun,false);journey.locate(.25);assert.equal(journey.canRun,true);journey.observe(advance(models));assert.equal(journey.result.observed,'cylinder');assert.ok(journey.result.difference>9);assert.equal(journey.complete,false);
 assert.ok(Math.abs(journey.result.sphere.area/journey.result.sphere.volume-120)<1e-12);assert.ok(Math.abs(journey.result.cylinder.area/journey.result.cylinder.volume-80)<1e-12);
 models.forEach((m,i)=>m.restore(initial[i]));journey.rewind(models.map(m=>m.snapshot()));assert.equal(journey.complete,true);assert.deepEqual(models.map(m=>m.snapshot()),initial);
});
test('radial prediction is locked before time advances without grading or changing the physical models',()=>{
 const {models,journey}=setup('prediction'),before=models.map(m=>m.snapshot());assert.throws(()=>journey.predict(undefined,0));assert.throws(()=>journey.predict('sphere',.1));journey.predict('sphere',0);assert.throws(()=>journey.predict('cylinder',0));assert.deepEqual(models.map(m=>m.snapshot()),before);journey.observe(advance(models));assert.equal(journey.prediction,'sphere');assert.equal(journey.result.observed,'cylinder');assert.equal(journey.complete,true);
 const missing=setup('prediction');for(const m of missing.models)m.step(.00001);missing.journey.observe(missing.models.map(m=>m.snapshot()));assert.equal(missing.journey.prepared,false);assert.match(missing.journey.reason,/確定前/);
});
test('desktop and mobile cooling observations match continuous eigenfunctions integrated independently by quadrature',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-radial-learning-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);
 for(const n of [32,64]){
  const {models,journey}=setup('prediction',n);journey.predict('equal',0);const states=advance(models);journey.observe(states);
  for(const [i,key]of ['sphere','cylinder'].entries()){
   const exact=reference.geometry[key],shells=exact.samples.find(r=>r.n===n).temperatureK,mean=journey.result[key].mean;
   assert.ok(Math.abs(mean-(exact.volumeMeanK-273.15))<(n===32?.03:.01));
   const rms=Math.sqrt(states[i].temperature.reduce((sum,t,j)=>sum+(t-shells[j])**2,0)/n);assert.ok(rms<(n===32?.03:.01));assert.ok(Math.abs(states[i].energyError)<1e-7);
  }
 }
});
test('unmatched conditions, early guesses and overshot times cannot produce a cooling lesson result',()=>{
 const {configs,models,journey}=setup(),context={configs,meshes:models.map(m=>m.mesh),snapshots:models.map(m=>m.snapshot())},changed=structuredClone(context);changed.configs[0].source=1;assert.throws(()=>journey.prepare(changed));assert.equal(journey.prepared,false);
 const other=setup('prediction');other.journey.predict('equal',0);const states=advance(other.models);states.forEach(s=>s.time=1.1);other.journey.observe(states);assert.equal(other.journey.result,null);assert.equal(other.journey.prepared,false);assert.match(other.journey.reason,/1秒/);
 assert.throws(()=>new RadialJourney('invalid'));assert.throws(()=>radialCoolingConfigs(16));
});
