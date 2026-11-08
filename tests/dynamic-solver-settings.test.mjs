import test from 'node:test';import assert from 'node:assert/strict';
import {cavityUIConfig} from '../dynamic/dev/cavity-ui-config.mjs';
import {lidCavityUIConfig} from '../dynamic/dev/lid-cavity-ui-config.mjs';
import {thermalWallConfig} from '../dynamic/dev/thermal-wall-ui-config.mjs';
import {createCavity} from '../dynamic/dev/cavity.mjs';
// P5-3: the pressure-projection solver settings (relative PCG tolerance and
// iteration cap) are exposed on the two cavity expert screens. Record:
// docs/dynamic/SOLVER_SETTINGS_20261107.md. Defaults must stay bit-identical
// to the values the screens used before the settings were exposed.

test('defaults are unchanged: omitting the settings reproduces the legacy configs exactly',()=>{
 assert.deepEqual(cavityUIConfig(),cavityUIConfig({pressureTolerance:1e-11,maxPressureIterations:4000}));
 assert.deepEqual(lidCavityUIConfig(),lidCavityUIConfig({pressureTolerance:1e-11,maxPressureIterations:4000}));
 assert.equal(cavityUIConfig().pressureTolerance,1e-11);assert.equal(cavityUIConfig().maxPressureIterations,4000);
 assert.equal(lidCavityUIConfig().pressureTolerance,1e-11);assert.equal(lidCavityUIConfig().maxPressureIterations,4000);
});

test('exposed settings pass through inside the safe envelope, boundaries included',()=>{
 const c=cavityUIConfig({pressureTolerance:1e-12,maxPressureIterations:123});
 assert.equal(c.pressureTolerance,1e-12);assert.equal(c.maxPressureIterations,123);
 for(const pressureTolerance of [1e-13,1e-10])for(const maxPressureIterations of [1,5000]){
  assert.equal(cavityUIConfig({pressureTolerance,maxPressureIterations}).pressureTolerance,pressureTolerance);
  assert.equal(lidCavityUIConfig({pressureTolerance,maxPressureIterations}).maxPressureIterations,maxPressureIterations);
 }
});

test('out-of-envelope solver settings are refused with the reason, before the kernel',()=>{
 const bad=[{pressureTolerance:1e-9},{pressureTolerance:1e-14},{pressureTolerance:0},{pressureTolerance:-1e-11},{pressureTolerance:NaN},{pressureTolerance:'1e-11'},{pressureTolerance:Infinity},{maxPressureIterations:0},{maxPressureIterations:5001},{maxPressureIterations:2.5},{maxPressureIterations:NaN},{maxPressureIterations:'4000'}];
 for(const input of bad){
  assert.throws(()=>cavityUIConfig(input),/圧力反復/,JSON.stringify(input));
  assert.throws(()=>lidCavityUIConfig(input),/圧力反復/,JSON.stringify(input));
 }
 assert.throws(()=>cavityUIConfig({pressureTolerance:1e-11,unknown:1}),/未対応/);
 assert.throws(()=>lidCavityUIConfig({pressureTolerance:1e-11,unknown:1}),/未対応/);
});

test('settings are part of the model signature: snapshots restore only under the same settings',()=>{
 const a=createCavity(lidCavityUIConfig({pressureTolerance:1e-11}));
 a.step(a.safeDt/2,false);const snap=a.snapshot();
 assert.doesNotThrow(()=>a.restore(structuredClone(snap)));
 const b=createCavity(lidCavityUIConfig({pressureTolerance:1e-12}));
 assert.notEqual(a.snapshot().signature,b.snapshot().signature);
 assert.throws(()=>b.restore(structuredClone(snap)),/一致しません/);
 const fewer=createCavity(lidCavityUIConfig({maxPressureIterations:10}));
 assert.throws(()=>fewer.restore(structuredClone(snap)),/一致しません/);
});

test('direction of the setting: looser stops earlier with a larger residual, stricter iterates more and projects closer',()=>{
 // Lid-driven cavity (Re=100, 16x16) through the screen builder itself.
 // Measured 2026-11-07 at t=0.0625 s (10 steps): tolerance 1e-10 -> residual
 // 4.59e-9, 71 total iterations, divergence 5.24e-12; 1e-13 -> residual
 // 9.82e-13, 99 iterations, divergence 1.28e-15; the velocity fields differ
 // by at most 1.7e-13. Assertions keep orders of magnitude of margin.
 const loose=createCavity(lidCavityUIConfig({pressureTolerance:1e-10}));
 const strict=createCavity(lidCavityUIConfig({pressureTolerance:1e-13}));
 for(let s=0;s<10;s++){const dt=Math.min(loose.safeDt,strict.safeDt)/2;loose.step(dt,false);strict.step(dt,false);}
 const L=loose.snapshot(),S=strict.snapshot();
 assert.equal(L.time,S.time);assert.equal(L.steps,10);assert.equal(S.steps,10);
 // Each run honours its own stopping bound: residual <= max(1e-12, tol*rhsNorm).
 assert.ok(L.pressureResidual<=Math.max(1e-12,1e-10*L.pressureRhsNorm)*(1+1e-9),`loose residual ${L.pressureResidual}`);
 assert.ok(S.pressureResidual<=Math.max(1e-12,1e-13*S.pressureRhsNorm)*(1+1e-9),`strict residual ${S.pressureResidual}`);
 assert.ok(S.pressureResidual<L.pressureResidual/100,'stricter tolerance ends at a much smaller residual');
 assert.ok(S.totalPressureIterations>L.totalPressureIterations,'stricter tolerance costs more iterations');
 assert.ok(S.divergence<L.divergence,'stricter tolerance leaves a smaller post-projection divergence');
 const du=Math.max(...L.u.map((v,i)=>Math.abs(v-S.u[i])),...L.v.map((v,i)=>Math.abs(v-S.v[i])));
 const dp=Math.max(...L.pressure.map((v,i)=>Math.abs(v-S.pressure[i])));
 assert.ok(du<1e-9&&dp<1e-9,'both settings approximate the same projected field');
});

test('default screen settings reproduce the explicitly-set run bit for bit',()=>{
 const implicit=createCavity(lidCavityUIConfig());
 const explicit=createCavity(lidCavityUIConfig({pressureTolerance:1e-11,maxPressureIterations:4000}));
 for(let s=0;s<3;s++){const dt=Math.min(implicit.safeDt,explicit.safeDt)/2;implicit.step(dt,false);explicit.step(dt,false);}
 assert.deepEqual(implicit.snapshot(),explicit.snapshot());
});

test('thermal-wall screen settings stay unexposed: its builder is pinned by a frozen verification reference',()=>{
 // THERMAL_WALL_AIR_REFERENCE_20261107_v1.json pins the SHA-256 of
 // thermal-wall-ui-config.mjs and deep-compares its output, so the builder
 // must not gain keys here. The kernel-side settings (1e-12 / 2000, capped
 // at 1e-10 / 5000) are unchanged. See SOLVER_SETTINGS_20261107.md.
 const c=thermalWallConfig();
 assert.equal('pressureTolerance' in c,false);
 assert.equal('maxPressureIterations' in c,false);
});
