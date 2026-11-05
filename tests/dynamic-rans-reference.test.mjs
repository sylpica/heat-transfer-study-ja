import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {runRansBenchmarks} from '../scripts/dynamic-rans-temperature-benchmarks.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/RANS_TEMPERATURE_REFERENCE_20261105.json',import.meta.url)));
test('continuous mean-temperature reference is independently mode/quadrature refined and tied to its actual generator',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-rans-temperature-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);
 for(const c of reference.cases){assert.ok(c.modeRefinementMaxTemperatureDifferenceK<1e-7);assert.ok(c.quadratureRefinementMaxTemperatureDifferenceK<1e-8);assert.equal(c.grids.length,3);for(const g of c.grids){assert.equal(g.rowHarmonic.length,g.ny);assert.ok(g.rowHarmonic.every(a=>Number.isFinite(a.real)&&Number.isFinite(a.imag)));}}
 assert.equal(reference.releaseApproved,false);
});
test('conservative passive temperature converges to the continuous PDE and independently verifies first-order time integration',()=>{
 const out=runRansBenchmarks();assert.equal(out.passed,true,JSON.stringify(out));assert.equal(out.releaseApproved,false);assert.equal(out.spatial.length,3);assert.equal(out.temporal.length,3);
});
