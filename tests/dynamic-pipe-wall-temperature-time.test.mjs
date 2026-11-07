import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {heatedPipeTimeCases as original} from '../scripts/dynamic-pipe-wall-temperature-time-cases.mjs';import {heatedPipeTimeCases as refined} from '../scripts/dynamic-pipe-wall-temperature-time-refinement.mjs';
const read=version=>JSON.parse(readFileSync(new URL(`../docs/dynamic/PIPE_WALL_TEMPERATURE_TIME_REFERENCE_20261107_${version}.json`,import.meta.url)));
test('CWT pipe retains the original failed heat budget and supplementary time refinement meets the unchanged independent temperature and all-heat criteria',()=>{
 const old=read('v1'),fine=read('v2');assert.equal(old.allChecksPassed,false);assert.ok(old.rows.at(-1).maximumCumulativeComponentDifferenceJ>1e-4);
 for(const [own,ref]of [[original(),old],[refined(),fine]]){
  assert.deepEqual(own.config,ref.config);const errors=[];
  for(let i=0;i<own.cases.length;i++){
   const s=own.cases[i].snapshot,error=Math.max(...s.offsetTemperature.map((v,n)=>Math.abs(v-ref.reference.temperatureOffsetsK[n]))),heat=Math.max(...s.cumulativeComponentJ.map((v,n)=>Math.abs(v-ref.reference.cumulativeComponentJ[n])));
   assert.equal(own.cases[i].factor,ref.rows[i].factor);assert.ok(Math.abs(error-ref.rows[i].maximumTemperatureErrorK)<1e-11);assert.ok(Math.abs(heat-ref.rows[i].maximumCumulativeComponentDifferenceJ)<1e-10);assert.ok(Math.abs(s.energyErrorJ)<=s.energyRoundoffBudgetJ);errors.push(error);
  }
  assert.ok(errors.at(-1)<.001);const p=Math.log2(errors.at(-2)/errors.at(-1));assert.ok(p>1.8&&p<2.2);
 }
 assert.equal(fine.allChecksPassed,true);assert.ok(fine.rows.at(-1).maximumCumulativeComponentDifferenceJ<1e-4);assert.equal(fine.originalV1HeatCriterionPassed,false);assert.equal(fine.releaseApproved,false);
});
