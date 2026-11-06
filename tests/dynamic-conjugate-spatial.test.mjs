import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createConjugateChannel} from '../dynamic/dev/conjugate-channel.mjs';
const ref=JSON.parse(readFileSync(new URL('../docs/dynamic/CONJUGATE_SPATIAL_REFERENCE_20261107_v1.json',import.meta.url)));
test('the actual coupled core preserves all independent manufactured discrete steady states with or without contact resistance',()=>{
 for(const row of ref.cases){const c=structuredClone(row.config);c.initial=row.temperatureOffsetsK.map(t=>c.referenceTemperatureK+t);const m=createConjugateChannel(c),before=m.snapshot(),after=m.step(m.safeDt/2);assert.ok(Math.max(...before.temperatureRatesKPerS.map(Math.abs))<1e-10,row.id);assert.ok(Math.max(...after.temperature.map((t,i)=>Math.abs(t-c.initial[i])))<1e-10,row.id);for(const value of Object.values(after.energyErrorJ))assert.ok(Math.abs(value)<=after.energyRoundoffBudgetJ,row.id);
  let weighted=0,volume=0;for(let n=0;n<before.temperature.length;n++){const v=m.mesh.dx*m.mesh.rowHeights[Math.floor(n/c.nx)]*m.mesh.depth,d=before.offsetTemperature[n]-row.continuousCellMeanOffsetsK[n];weighted+=v*d*d;volume+=v;}assert.ok(Math.abs(Math.sqrt(weighted/volume)-row.volumeWeightedRmsErrorK)<1e-11,row.id);
 }
 for(const family of ref.families){assert.ok(family.rows.at(-1).volumeWeightedRmsErrorK<.15);assert.ok(family.rmsOrders.at(-1)>.7);}assert.equal(ref.allChecksPassed,true);assert.equal(ref.productTimeToSteadyVerified,false);assert.equal(ref.releaseApproved,false);
});
