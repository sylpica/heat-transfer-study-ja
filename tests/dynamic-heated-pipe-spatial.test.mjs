import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHeatedPipe} from '../dynamic/dev/heated-pipe.mjs';

const ref=JSON.parse(readFileSync(new URL('../docs/dynamic/HEATED_PIPE_SPATIAL_REFERENCE_20261107_v1.json',import.meta.url)));
test('annular pipe independent steady states are actual fixed points and converge to the continuous quartic volume averages',()=>{
 const errors=[];
 for(const entry of ref.cases){
  const c=structuredClone(entry.config);c.initial=entry.temperatureOffsetsK.map(t=>c.referenceTemperatureK+t);
  const model=createHeatedPipe(c),before=model.snapshot(),after=model.step(model.safeDt/2);
  assert.ok(before.temperatureRatesKPerS.every(v=>Math.abs(v)<1e-10),entry.id);
  assert.ok(after.offsetTemperature.every((v,n)=>Math.abs(v-before.offsetTemperature[n])<1e-10),entry.id);
  assert.ok(Math.abs(after.energyErrorJ)<=after.energyRoundoffBudgetJ,entry.id);
  let sum=0,volume=0;
  for(let n=0;n<c.nx*c.nr;n++){
   const v=model.mesh.rowCellVolumesM3[Math.floor(n/c.nx)],error=before.offsetTemperature[n]-entry.continuousCellMeanOffsetsK[n];
   sum+=v*error*error;volume+=v;
  }
  const rms=Math.sqrt(sum/volume);errors.push(rms);
  assert.ok(Math.abs(rms-entry.summary.volumeWeightedRmsErrorK)<1e-11,entry.id);
  assert.ok(Math.abs(before.wallToBulkNusselt.at(-1)-entry.summary.outletNu)<1e-10,entry.id);
 }
 assert.ok(errors.at(-1)<.005);
 assert.ok(Math.log2(errors.at(-2)/errors.at(-1))>.7);
 assert.ok(Math.abs(ref.rows.at(-1).outletNu/(48/11)-1)<.005);
 assert.equal(ref.allChecksPassed,true);
 assert.equal(ref.productTimeToSteadyVerified,false);
 assert.equal(ref.releaseApproved,false);
});
