import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const ref=JSON.parse(readFileSync(new URL('../docs/dynamic/THERMAL_WALL_CENTRAL_TIME_REFERENCE_20261107_v1.json',import.meta.url)));
test('central finite-capacity and actual-heat thermostated walls converge to independently projected physical ODE in every temperature, velocity and integral',()=>{
 const own=JSON.parse(execFileSync(process.execPath,['scripts/dynamic-thermal-wall-central-time-cases.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8',maxBuffer:8*1024*1024}));
 assert.deepEqual(own.sourceFilesSHA256,ref.sourceFilesSHA256);
 for(const [p,sha] of Object.entries(ref.independentReferenceSourceFilesSHA256))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex'),sha);
 assert.equal(own.runs.length,3);
 for(let k=0;k<own.runs.length;k++){
  const r=ref.runs[k],run=own.runs[k],errors=[],velocities=[];assert.equal(run.name,r.name);assert.deepEqual(run.config,r.config);assert.equal(run.config.scalarScheme,'central');
  for(let i=0;i<run.cases.length;i++){
   const s=run.cases[i].snapshot,v=r.independentReference,row=r.rows[i],error=Math.max(Math.abs(s.wallOffsetTemperatureK-v.wallTemperatureOffsetK),...s.offsetTemperature.map((x,n)=>Math.abs(x-v.temperatureOffsetsK[n]))),velocity=Math.max(...s.u.map((x,n)=>Math.abs(x-v.u[n])),...s.v.map((x,n)=>Math.abs(x-v.v[n]))),heat=Math.max(...s.cumulativeComponentJ.map((x,n)=>Math.abs(x-v.cumulativeComponentJ[n])));
   assert.equal(run.cases[i].factor,row.factor);assert.ok(Math.abs(error-row.maximumFluidAndWallTemperatureErrorK)<1e-11);assert.ok(Math.abs(velocity-row.maximumFaceVelocityErrorMPerS)<1e-11);assert.ok(Math.abs(heat-row.maximumAllHeatIntegralDifferenceJ)<1e-11);
   assert.ok(Object.values(s.energyErrorJ).every(x=>Math.abs(x)<=s.energyRoundoffBudgetJ));assert.ok(s.divergence<1e-9);assert.ok(s.maximumCellPeclet<=2);
   if(run.config.wallMode==='isothermal-thermostat'){assert.equal(s.wallTemperature,run.config.wallInitialTemperature);assert.equal(s.storageChangeJ.wall,0);assert.equal(s.cumulativeComponentJ[0],s.cumulativeComponentJ[2]);}
   errors.push(error);velocities.push(velocity);
  }
  assert.ok(errors.at(-1)<.001);assert.ok(r.rows.at(-1).maximumAllHeatIntegralDifferenceJ<1e-4);assert.ok(velocities.at(-1)<1e-5);
  const order=Math.log2(errors.at(-2)/errors.at(-1));assert.ok(order>1.8&&order<2.2);
  if(run.config.gravityBeta){const p=Math.log2(velocities.at(-2)/velocities.at(-1));assert.ok(p>1.8&&p<2.2);}else assert.ok(velocities.every(x=>x===0));
  assert.ok(r.independentReference.DOP853ToleranceRefinementMaximumDifference<1e-10);assert.ok(r.independentReference.threeEnergyResidualsJ.every(x=>Math.abs(x)<1e-11));assert.ok(Object.values(r.checks).every(x=>x===true));assert.equal(r.allChecksPassed,true);
 }
 assert.equal(ref.allChecksPassed,true);assert.equal(ref.releaseApproved,false);
});
