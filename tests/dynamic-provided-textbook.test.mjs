import test from 'node:test';import assert from 'node:assert/strict';
import {runProvidedTextbookChecks,slabCellTheta,sphereRobinBi1ShellTheta} from '../scripts/dynamic-provided-textbook-check.mjs';
test('the slab center oracle includes the original external factor and alternating sign, and point temperatures are not substituted for cell averages',()=>{
 const point=4/Math.PI*Math.exp(-(Math.PI**2)/4)-4/(3*Math.PI)*Math.exp(-9*Math.PI**2/4);assert.ok(Math.abs(point-.1079770444)<1e-9);assert.ok(Math.abs(point-.085)>.02);
 const plateCell=slabCellTheta(1,1+1/32,1),sphereCell=sphereRobinBi1ShellTheta(0,1/32,1);assert.ok(plateCell<point&&sphereCell<point);assert.ok(Math.abs(plateCell-point)>1e-5);assert.ok(Math.abs(sphereCell-point)>1e-5);
 // Equal center eigenvalues do not make sphere shell weights equal to slab weights.
 assert.ok(Math.abs(plateCell-sphereCell)>1e-6);
});
test('three compatible production models converge to independently integrated textbook equations without changing printed values or using charts as exact data',()=>{
 const out=runProvidedTextbookChecks();assert.equal(out.cases.length,3);assert.ok(out.cases.every(c=>c.passed),JSON.stringify(out));assert.equal(out.releaseApproved,false);assert.equal(out.ownerPack.rawPackRedistributed,false);
 const sphere=out.cases.find(c=>c.id==='T1-03'),fin=out.cases.find(c=>c.id==='T2-01');assert.ok(Math.abs(sphere.oneTermCenterTheta-sphere.roundedOneTermCenterFromPack)<.00005);assert.ok(Math.abs(fin.exactEfficiency-fin.roundedEfficiencyFromPack)<.00005);assert.ok(fin.transverseBi<.01);
 for(const c of out.cases){assert.equal(c.rows.length,3);assert.ok(c.rows.every(r=>Math.abs(r.energyErrorJ)<1e-8));}
});
