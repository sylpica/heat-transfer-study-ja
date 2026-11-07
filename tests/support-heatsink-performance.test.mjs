import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createHeatSink} from '../dynamic/dev/heat-sink.mjs';
const root=new URL('../',import.meta.url),dir=new URL('docs/dynamic/support-heatsink/',root);
const read=n=>JSON.parse(readFileSync(new URL(n,dir)));
test('support heat-sink reference retains energy/grid limits, original failures and field provenance',()=>{
 const r=read('REFERENCE_v2.json'),v=read('VALIDATION_v2.json');assert.equal(r.releaseApproved,false);assert.equal(r.generalCFD,false);
 for(const c of r.cases){assert.ok(c.relativeEnergyResidual<1e-8);assert.ok(Math.abs(c.fluidInternalBalanceW)<1e-8);assert.ok(Math.abs(c.radiationInternalBalanceW)<1e-8);assert.equal(createHash('sha256').update(readFileSync(new URL(c.field,dir))).digest('hex'),c.fieldSHA256);}
 const a=r.cases[1],b=r.cases[2];assert.ok(Math.abs(a.sourceAverageTemperatureK-b.sourceAverageTemperatureK)/(b.sourceAverageTemperatureK-300)<.03);assert.ok(b.hydraulicMobilityRelativeError<.02);
 assert.ok(read('REFERENCE.json').cases[2].hydraulicMobilityRelativeError>.02);
 assert.ok(read('VALIDATION.json').spreading.fv.at(-1).relativeResistanceError>.02);
 assert.ok(Math.abs(v.spreading.fv.at(-1).relativeResistanceError)<.02);assert.equal(v.flow.zeroFlowRejected,true);
 assert.ok(v.radiation.grayTwoPlateRelativeError<1e-12);
});
test('same-geometry prescribed-h comparator is the actual existing learning solver equilibrium',()=>{
 const r=read('REFERENCE_v2.json'),record=read('LEARNING_MODEL.json'),c=r.learning.at(-1).config;
 assert.equal(createHash('sha256').update(readFileSync(new URL('dynamic/dev/heat-sink.mjs',root))).digest('hex'),record.originalSourceSHA256);
 const m=createHeatSink(c),a=m.snapshot(),b=m.step(m.safeDt/2);
 assert.ok(Math.abs(a.netExternalPowerW)<1e-8);assert.ok(Math.abs(b.baseTemperature-a.baseTemperature)<1e-10);
 assert.ok(Math.abs(a.baseTemperature-r.learning.at(-1).continuumBaseTemperatureK)<1e-4);
 assert.ok(r.cases[2].sourceAverageTemperatureK-a.baseTemperature>10);
 assert.equal(record.baselineRepresentsMassFlowOrLocalizedPatch,false);assert.equal(a.assumptions.radiationIncluded,false);
});
