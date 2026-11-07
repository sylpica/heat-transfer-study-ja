import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createRadiationNetwork} from '../dynamic/radiation-network.mjs';import {RadiationJourney,radiationLearningConfig} from '../dynamic/radiation-learning.mjs';
const setup=(path='tutorial')=>{const config=radiationLearningConfig(),model=createRadiationNetwork(config),journey=new RadiationJourney(path);journey.prepare({configs:[config],snapshots:[model.snapshot()]});return {config,model,journey};},run=model=>{while(model.time<20)model.step(Math.min(.05,model.safeDt,20-model.time),false);return model.snapshot();};
test('guided radiation observes unequal heat capacities and completes after an actual rewind',()=>{
 const {model,journey}=setup(),initial=model.snapshot();assert.equal(journey.canRun,false);journey.locate(1);assert.equal(journey.canRun,false);journey.locate(0);assert.equal(journey.canRun,true);journey.observe([run(model)]);const r=journey.result;
 assert.equal(journey.complete,false);assert.ok(r.hot>80&&r.cold<80,'20 seconds is not equilibrium');assert.ok(Math.abs(r.weighted-80)<1e-9);assert.ok(Math.abs(r.lost-r.gained)<1e-7);assert.ok(Math.abs((200-r.hot)/(r.cold-20)-2)<1e-10);assert.ok(r.outwardPower[0]>0&&r.outwardPower[1]<0);
 model.restore(initial);journey.rewind([model.snapshot()]);assert.equal(journey.complete,true);assert.deepEqual(model.snapshot(),initial);
});
test('radiation guesses lock before calculation without changing the model or pretending the final temperature was reached',()=>{
 const {model,journey}=setup('prediction'),before=model.snapshot();assert.throws(()=>journey.predict(undefined,0));assert.throws(()=>journey.predict('weighted',1));journey.predict('arithmetic',0);assert.deepEqual(model.snapshot(),before);assert.throws(()=>journey.predict('weighted',0));journey.observe([run(model)]);assert.equal(journey.prediction,'arithmetic');assert.equal(journey.result.observed,'weighted');assert.equal(journey.complete,true);assert.equal(journey.result.equilibriumC,80);assert.ok(journey.result.hot>journey.result.equilibriumC&&journey.result.cold<journey.result.equilibriumC);
});
test('network and Heun observations match an independent scalar DOP853 energy-eliminated two-plate ODE',()=>{
 const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/RADIATION_LEARNING_REFERENCE_20261105.json',import.meta.url)));assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-radiation-learning-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);
 const {model,journey}=setup('prediction');assert.ok(Math.abs(model.snapshot().outwardPower[0]-reference.initialOutwardPowerW)<1e-9);journey.predict('cold',0);const s=run(model);journey.observe([s]);for(let i=0;i<2;i++){assert.ok(Math.abs(s.temperature[i]-reference.temperatureK[i])<.001);assert.ok(Math.abs(s.outwardPower[i]-reference.outwardPowerW[i])<.001);}assert.ok(Math.abs(s.energy-reference.initialSensibleEnergyJ)<1e-7);assert.ok(Math.abs(s.radiationBalance)<1e-9);
});
test('incompatible networks and invalid prediction order or observation times cannot become lesson results',()=>{
 const {config,model,journey}=setup(),bad=structuredClone(config);bad.surfaces[0].power=1;assert.throws(()=>journey.prepare({configs:[bad],snapshots:[model.snapshot()]}));assert.equal(journey.prepared,false);
 const early=setup('prediction');early.model.step(.01);early.journey.observe([early.model.snapshot()]);assert.equal(early.journey.prepared,false);assert.match(early.journey.reason,/確定前/);
 const late=setup('prediction');late.journey.predict('weighted',0);const s=run(late.model);late.journey.observe([{...s,time:20.1}]);assert.equal(late.journey.result,null);assert.match(late.journey.reason,/20秒/);assert.throws(()=>new RadiationJourney('unknown'));
});
