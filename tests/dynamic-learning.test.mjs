import test from 'node:test';import assert from 'node:assert/strict';
import {HeatingJourney} from '../dynamic/learning-path.mjs';import {preset} from '../dynamic/presets.mjs';import {createThermal} from '../dynamic/thermal.mjs';
function prepared(path='tutorial',n=24){const config=preset('heating',n),m=createThermal(config),journey=new HeatingJourney(path);journey.prepare({config,mesh:m.mesh,snapshot:m.snapshot()});return {m,journey,config};}
function run(m){while(m.time<5)m.step(Math.min(m.safeDt,5-m.time));return m.snapshot();}
// Independent continuous series with cell averaging; no FVM conductance or
// timestep formula is reused. Dirichlet x=0, adiabatic x=L, uniform initial.
function analyticCell(i,n,t){const L=.1,dx=L/n,alpha=167/(2700*896);let theta=0;for(let j=0;j<200;j++){const lambda=(j+.5)*Math.PI/L;theta+=2/(lambda*L)*(Math.cos(lambda*i*dx)-Math.cos(lambda*(i+1)*dx))/(lambda*dx)*Math.exp(-alpha*lambda*lambda*t);}return 60-40*theta;}
test('guided heating records real probes, numerical states and a real return to the initial state',()=>{
 const {m,journey}=prepared(),seed=m.snapshot();assert.equal(journey.canRun,false);journey.locate({x:.75,y:.5});assert.equal(journey.canRun,false);journey.locate({x:.25,y:.5});assert.equal(journey.canRun,true);journey.observe(run(m));assert.equal(journey.result.observed,'left');assert.equal(journey.complete,false);m.restore(seed);journey.rewind(m.snapshot());assert.equal(journey.complete,true);assert.equal(journey.result.time,5);assert.ok(journey.result.leftPosition[0]>0&&journey.result.rightPosition[0]<.1);
});
test('prediction is committed before time advances and never changes a physical state or a quiz record',()=>{
 const {m,journey}=prepared('prediction'),before=m.snapshot();assert.throws(()=>journey.predict(undefined,0));assert.throws(()=>journey.predict('left',1));journey.predict('right',0);assert.deepEqual(m.snapshot(),before);assert.throws(()=>journey.predict('left',0));journey.observe(run(m));assert.equal(journey.prediction,'right');assert.equal(journey.result.observed,'left');assert.equal(journey.complete,true);
 const other=prepared('prediction');other.m.step(.01);other.journey.observe(other.m.snapshot());assert.equal(other.journey.prepared,false);assert.match(other.journey.reason,/確定前/);
});
test('lesson readings agree with independent mixed-boundary heat-equation cell-average series on desktop and mobile grids',()=>{
 for(const n of [24,32]){const {m,journey}=prepared('prediction',n);journey.predict('equal',0);journey.observe(run(m));const r=journey.result;assert.ok(Math.abs(r.left-analyticCell(Math.floor(n*.25),n,5))<.07);assert.ok(Math.abs(r.right-analyticCell(Math.floor(n*.75),n,5))<.07);assert.ok(r.difference>10);assert.ok(Math.abs(m.snapshot().energyError)<1e-7);}
});
test('reinitialization and incompatible conditions clear the old reflection rather than scoring another experiment',()=>{
 const {m,journey,config}=prepared();journey.observe(run(m));journey.invalidate('条件を変更');assert.equal(journey.result,null);assert.equal(journey.prepared,false);assert.equal(journey.complete,false);const clone=structuredClone(config);clone.source=1;assert.throws(()=>journey.prepare({config:clone,mesh:m.mesh,snapshot:{...m.snapshot(),time:0}}));assert.equal(journey.prepared,false);assert.throws(()=>new HeatingJourney('bad'));
});
