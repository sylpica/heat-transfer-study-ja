import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const ref=JSON.parse(readFileSync(new URL('../docs/dynamic/THERMAL_WALL_TIME_REFERENCE_20261107_v4.json',import.meta.url)));
test('joint thermal-wall SSPRK2 converges in every fluid/wall temperature, velocity and heat component to independent physical exponential and projected nonlinear ODE',()=>{
 const own=JSON.parse(execFileSync(process.execPath,['scripts/dynamic-thermal-wall-time-cases.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8',maxBuffer:8*1024*1024}));assert.deepEqual(own.sourceFilesSHA256,ref.sourceFilesSHA256);
 for(let k=0;k<own.runs.length;k++){
  const r=ref.runs[k],run=own.runs[k],errors=[],velocities=[];assert.equal(run.name,r.name);assert.deepEqual(run.config,r.config);
  for(let i=0;i<run.cases.length;i++){const s=run.cases[i].snapshot,v=r.independentReference,row=r.rows[i],error=Math.max(Math.abs(s.wallOffsetTemperatureK-v.wallTemperatureOffsetK),...s.offsetTemperature.map((x,n)=>Math.abs(x-v.temperatureOffsetsK[n]))),velocity=Math.max(...s.u.map((x,n)=>Math.abs(x-v.u[n])),...s.v.map((x,n)=>Math.abs(x-v.v[n]))),heat=Math.max(...s.cumulativeComponentJ.map((x,n)=>Math.abs(x-v.cumulativeComponentJ[n])));assert.equal(run.cases[i].factor,row.factor);assert.ok(Math.abs(error-row.maximumFluidAndWallTemperatureErrorK)<1e-11);assert.ok(Math.abs(velocity-row.maximumFaceVelocityErrorMPerS)<1e-11);assert.ok(Math.abs(heat-row.maximumAllHeatIntegralDifferenceJ)<1e-11);assert.ok(Object.values(s.energyErrorJ).every(x=>Math.abs(x)<=s.energyRoundoffBudgetJ));assert.ok(s.divergence<1e-9);errors.push(error);velocities.push(velocity);}
  assert.ok(errors.at(-1)<.001);assert.ok(r.rows.at(-1).maximumAllHeatIntegralDifferenceJ<1e-4);const order=Math.log2(errors.at(-2)/errors.at(-1));assert.ok(order>1.8&&order<2.2);
  if(run.name==='buoyant'){assert.ok(velocities.at(-1)<1e-5);const p=Math.log2(velocities.at(-2)/velocities.at(-1));assert.ok(p>1.8&&p<2.2);assert.ok(r.independentReference.DOP853ToleranceRefinementMaximumDifference<1e-10);assert.equal(r.independentReference.initialDOPTolerancePairPassedSelfCheck,false);}else assert.ok(velocities.every(x=>x===0));
  assert.equal(r.allChecksPassed,true);
 }
 assert.equal(ref.allChecksPassed,true);assert.equal(ref.continuousSpatialAccuracyVerified,false);assert.equal(ref.releaseApproved,false);
});
