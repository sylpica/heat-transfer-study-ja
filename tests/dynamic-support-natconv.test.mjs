import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {createCavity} from '../dynamic/dev/cavity.mjs';import {createThermalWallCavity} from '../dynamic/dev/thermal-wall-cavity.mjs';
const root=new URL('..',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,root)));
test('high-Ra support does not change either production admission gate or the original cavity source',()=>{
 const source=readFileSync(new URL('dynamic/dev/cavity.mjs',root)),saved=read('docs/dynamic/support-natconv/CURRENT_PROBE.json');assert.equal(createHash('sha256').update(source).digest('hex'),saved.originalSHA256);
 for(const ra of [1e4,1e5,1e6]){
  const c={nx:32,ny:32,width:1,height:1,depth:1,rho:1,cp:1,nu:.71,alpha:1,beta:.001,gravityBeta:.71*ra,initial:300,leftTemperature:300.5,rightTemperature:299.5,referenceTemperature:300,scalarScheme:'central'};
  assert.throws(()=>createCavity(c),/Ra≤1000/);
  assert.throws(()=>createThermalWallCavity({nx:32,ny:32,width:1,height:1,depth:1,rho:1,cp:1,nu:.71,alpha:1,beta:.001,gravityBeta:.71*ra,initial:300,wallInitialTemperature:300.5,coldTemperature:299.5,wallCapacityJPerK:1,wallInputW:0,wallMode:'isothermal-thermostat',scalarScheme:'central'}),/Ra≤1000/);
 }
});
test('support errors use distinct Nu definitions and retain cold-start failures alongside warm-start convergence',()=>{
 const r=read('docs/dynamic/support-natconv/RESULTS.json');assert.equal(r.fineColdStartCases.length,3);
 for(const row of r.fineColdStartCases){assert.equal(row.coldStart,true);assert.equal(row.steady,true);assert.equal(row.failure,null);for(const [metric,e]of Object.entries(row.errors)){assert.ok(Math.abs(e.computed-e.reference-e.signedDifference)<1e-12);if(!metric.endsWith('Position'))assert.ok(Math.abs(100*(e.computed/e.reference-1)-e.signedRelativePercent)<1e-12);}assert.ok(Object.values(row.checks).every(Boolean));}
 const high=r.fineColdStartCases.find(x=>x.ra===1e6);assert.equal(high.errors.Nu0.reference,8.817);assert.equal(high.errors.NuVolume.reference,8.8);assert.equal(high.errors.NuMidplane.reference,8.799);
 assert.equal(r.coldStartSeries.find(x=>x.ra===1e6&&x.grid===128).steady,false);assert.match(r.coldStartSeries.find(x=>x.ra===1e6&&x.grid===128).failure,/Peclet/);assert.equal(r.warmCoarseRa1e6.coldStart,false);assert.equal(r.productionGateChanged,false);assert.equal(r.wholeRaContinuumApproved,false);assert.equal(r.releaseApproved,false);
});
