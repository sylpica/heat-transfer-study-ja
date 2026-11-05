import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {sampleMaximum} from '../scripts/dynamic-provided-cfd-check.mjs';
import {createCavity} from '../dynamic/dev/cavity.mjs';import {createMacVelocityField} from '../dynamic/dev/cavity-fields.mjs';
const review=JSON.parse(readFileSync(new URL('../docs/dynamic/PROVIDED_CFD_BENCHMARK_REVIEW_20261106.json',import.meta.url)));
const previous=JSON.parse(readFileSync(new URL('../docs/dynamic/PROVIDED_CFD_BENCHMARKS_20261105.json',import.meta.url)));
test('diffusive scaling preserves Ra, Pr, temperature and Nu while dimensional velocities scale with alpha/L',()=>{
 const c={nx:8,ny:8,width:1,height:1,rho:1,cp:1,nu:.71,alpha:1,initial:300,leftTemperature:300.5,rightTemperature:299.5,gravityBeta:710,beta:.001,referenceTemperature:300,scalarScheme:'central',pressurePreconditioner:'multigrid'};
 const scaled={...c,nu:.071,alpha:.1,gravityBeta:7.1};for(const q of [c,scaled]){assert.ok(Math.abs(q.nu/q.alpha-.71)<1e-14);assert.ok(Math.abs(q.gravityBeta/(q.nu*q.alpha)-1000)<1e-10);}
 const a=createCavity(c),b=createCavity(scaled);while(a.time<.02)a.step(Math.min(a.safeDt,.02-a.time),false);while(b.time<.2)b.step(Math.min(b.safeDt,.2-b.time),false);const x=a.snapshot(),y=b.snapshot();assert.equal(x.steps,y.steps);x.temperature.forEach((T,i)=>assert.ok(Math.abs(T-y.temperature[i])<1e-11));x.u.forEach((u,i)=>assert.ok(Math.abs(u-10*y.u[i])<1e-11));x.v.forEach((v,i)=>assert.ok(Math.abs(v-10*y.v[i])<1e-11));assert.ok(Math.abs(x.nusselt-y.nusselt)<1e-11);
});
test('a bilinear MAC centerline maximum occurs at native staggered nodes rather than at an invented sub-grid extremum',()=>{
 const n=8,mesh={nx:n,ny:n,width:1,height:1},u=Array((n+1)*n).fill(0),v=Array(n*(n+1)).fill(0);u[6*(n+1)+n/2]=3.6;v[(n/2)*n+1]=3.7;const field=createMacVelocityField(mesh,{u,v});assert.equal(field.at(.5,6.5/n)[0],3.6);assert.equal(field.at(1.5/n,.5)[1],3.7);assert.deepEqual(sampleMaximum(field,0,mesh),{value:3.6,position:6.5/n});assert.deepEqual(sampleMaximum(field,1,mesh),{value:3.7,position:1.5/n});
 for(let j=0;j<=1000;j++){assert.ok(field.at(.5,j/1000)[0]<=3.6);assert.ok(field.at(j/1000,.5)[1]<=3.7);}
});
test('the provided all-point comparisons and time refinement preserve unresolved reference differences without broadening the old gates',()=>{
 const fine=previous.lid.find(r=>r.n===32);assert.equal(fine.u.pointCount,17);assert.equal(fine.v.pointCount,17);assert.equal(fine.existingFourPointU.pointCount,4);assert.equal(fine.existingFourPointGatePassed,true);assert.ok(fine.v.maximumAbsoluteDifference>fine.existingFourPointBudget);assert.equal(previous.expandedComparisonApproval,false);
 const last=review.samples.at(-1);assert.ok(last.lastIntervalMaxUChange<1e-9);assert.ok(last.lastIntervalMaxVChange<1e-9);assert.ok(last.lastIntervalMaxTemperatureChange<1e-9);assert.ok(Math.abs(last.lastIntervalNusseltChange)<1e-10);assert.equal(review.referenceValuesRetained.oldOpenLBSecondaryMeanNu,1.117);assert.equal(review.referenceValuesRetained.ownerPackMeanNu,1.118);assert.equal(review.referenceValuesRetained.oldGateChanged,false);assert.equal(review.sourceDisagreementResolved,false);assert.equal(review.primaryDeVahlTableRead,false);assert.equal(review.releaseApproved,false);
 assert.equal(previous.dns.transcribedPointRoundingConsistent,true);assert.equal(previous.dns.physicalModelDiscrepancyNotApproval,true);assert.ok(Math.abs(previous.dns.rawCenterUPlus-previous.dns.packCenterUPlus)<.005);
});
