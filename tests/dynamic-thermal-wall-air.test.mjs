import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {thermalWallConfig,thermalWallApplicability} from '../dynamic/dev/thermal-wall-ui-config.mjs';import {createThermalWallCavity} from '../dynamic/dev/thermal-wall-cavity.mjs';
const ref=JSON.parse(readFileSync(new URL('../docs/dynamic/THERMAL_WALL_AIR_REFERENCE_20261107_v3.json',import.meta.url)));
test('actual-air finite and controlled wall presets satisfy independent full-state time budgets at the preselected GUI timestep',()=>{
 const own=JSON.parse(execFileSync(process.execPath,['scripts/dynamic-thermal-wall-air-cases.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8',maxBuffer:8*1024*1024}));assert.deepEqual(own.sourceFilesSHA256,ref.sourceFilesSHA256);
 for(const [p,sha]of Object.entries(ref.independentReferenceSourceFilesSHA256))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex'),sha);
 for(let k=0;k<ref.runs.length;k++){
  const r=ref.runs[k],o=own.runs[k],v=r.independentReference;assert.deepEqual(o.config,r.config);assert.deepEqual(o.config,thermalWallConfig({wallMode:r.config.wallMode}));assert.equal(r.selectedGuiDtFactor,.125);assert.ok(r.initialEffectiveRa<1000&&r.initialEffectiveRa>930);
  const errors=[],velocities=[];
  for(let i=0;i<o.cases.length;i++){
   const s=o.cases[i].snapshot,row=r.rows[i],te=Math.max(...s.offsetTemperature.map((x,n)=>Math.abs(x-v.temperatureOffsetsK[n])),Math.abs(s.wallOffsetTemperatureK-v.wallTemperatureOffsetK)),ve=Math.max(...s.u.map((x,n)=>Math.abs(x-v.u[n])),...s.v.map((x,n)=>Math.abs(x-v.v[n]))),he=Math.max(...s.cumulativeComponentJ.map((x,n)=>Math.abs(x-v.cumulativeComponentJ[n])));
   assert.ok(Math.abs(te-row.maximumFluidAndWallTemperatureErrorK)<1e-11);assert.ok(Math.abs(ve-row.maximumFaceVelocityErrorMPerS)<1e-11);assert.ok(Math.abs(he-row.maximumAllHeatIntegralDifferenceJ)<1e-11);assert.ok(s.maximumCellPeclet<=2&&s.divergence<1e-9);assert.ok(Object.values(s.energyErrorJ).every(x=>Math.abs(x)<=s.energyRoundoffBudgetJ));
   if(o.cases[i].factor===.125){assert.ok(te<.001&&ve<1e-6&&he<1e-7);const a=thermalWallApplicability(o.config,s);assert.ok(a.eckertEstimate>=0&&a.eckertEstimate<1e-6);assert.equal(a.viscousHeatingOmitted,true);}
   errors.push(te);velocities.push(ve);
  }
  for(const values of [errors,velocities]){const p=Math.log2(values.at(-2)/values.at(-1));assert.ok(p>1.8&&p<2.2);}
  assert.ok(Object.values(r.checks).every(x=>x===true));assert.equal(r.allChecksPassed,true);
 }
 assert.equal(ref.allChecksPassed,true);assert.equal(ref.releaseApproved,false);
});
test('air UI bounds reject unsupported physical drafts and retain exact zero with a zero wall-fluid contrast',()=>{
 for(const draft of [{grid:64},{wallTemperature:299},{wallTemperature:311},{wallTemperature:NaN},{wallTemperature:'310'},{wallMode:'unknown'}])assert.throws(()=>thermalWallConfig(draft));
 const c=thermalWallConfig({grid:32,wallTemperature:300}),m=createThermalWallCavity(c);m.step(m.safeDt/8);const s=m.snapshot();assert.ok([...s.offsetTemperature,...s.u,...s.v,...s.cumulativeComponentJ].every(x=>x===0));assert.equal(s.wallOffsetTemperatureK,0);assert.equal(thermalWallApplicability(c,s).eckertEstimate,null);
});
