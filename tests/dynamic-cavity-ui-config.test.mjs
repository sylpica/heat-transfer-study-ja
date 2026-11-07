import test from 'node:test';import assert from 'node:assert/strict';
import {cavityUIConfig,CAVITY_UI_PRANDTL,CAVITY_UI_ASPECT_RATIOS} from '../dynamic/dev/cavity-ui-config.mjs';
import {createCavity} from '../dynamic/dev/cavity.mjs';
import {cavityHeatFluxSections} from '../dynamic/dev/cavity-heat-flux.mjs';
// Verified steady values (natural-convection-cases-20261107): at Ra=1000 and
// 32 cells per height, Nu0 is 1.1179487 (Pr=0.1), 1.1199428 (Pr=0.71),
// 1.1199630 (Pr=1), 1.1199648 (Pr=7), 0.6071920 (AR=2, 64x32) and
// 2.0090397 (AR=0.5, 16x32). These tests pin the UI wiring that reaches
// those dimensionless conditions; the steady runs themselves are recorded
// in the development verification, not in this fast suite.
const ra=c=>Math.abs(c.gravityBeta*(c.leftTemperature-c.rightTemperature)*c.height**3/(c.nu*c.alpha));
test('default cavity UI config keeps the air-product Ra and the legacy geometry',()=>{
 const c=cavityUIConfig();assert.equal(c.nx,16);assert.equal(c.ny,16);assert.equal(c.width,.01);assert.equal(c.height,.01);
 assert.ok(Math.abs(c.nu/c.alpha-.71)<1e-12);assert.ok(Math.abs(c.nu*c.alpha-1.575e-5*(.0264/(1.177*1006)))<1e-24);
 assert.ok(Math.abs(ra(c)-931.1887301587304)<1e-6,'Ra at the default difference/gravity is unchanged from the air config');
 assert.equal(c.leftTemperature,305);assert.equal(c.rightTemperature,295);
});
test('every verified Pr keeps nu*alpha fixed, so Ra does not depend on Pr',()=>{
 const ras=CAVITY_UI_PRANDTL.map(prandtl=>{const c=cavityUIConfig({prandtl});assert.ok(Math.abs(c.nu/c.alpha-prandtl)<1e-12);return ra(c);});
 for(const r of ras)assert.ok(Math.abs(r-ras[0])<1e-9);
 const atVerified=cavityUIConfig({difference:11.5,gravity:9.16,prandtl:7});
 assert.ok(Math.abs(ra(atVerified)-999.9125467372133)<1e-6,'Ra=1000 is reachable inside the UI ranges (999.91 with step-sized inputs)');
 for(const prandtl of CAVITY_UI_PRANDTL){const c=cavityUIConfig({difference:11.5,gravity:9.16,prandtl});assert.ok(Math.abs(ra(c)-ra(atVerified))<1e-9);assert.doesNotThrow(()=>createCavity(c));}
});
test('aspect ratio scales width and the width cell count with square cells',()=>{
 const wide=cavityUIConfig({aspectRatio:2,grid:32});assert.equal(wide.nx,64);assert.equal(wide.ny,32);assert.equal(wide.width,.02);assert.equal(wide.height,.01);
 const tall=cavityUIConfig({aspectRatio:.5,grid:32});assert.equal(tall.nx,16);assert.equal(tall.ny,32);assert.equal(tall.width,.005);
 for(const aspectRatio of CAVITY_UI_ASPECT_RATIOS)for(const grid of [12,16,24,32]){const c=cavityUIConfig({aspectRatio,grid});assert.ok(Math.abs(c.width/c.nx-c.height/c.ny)<1e-15);}
 assert.throws(()=>cavityUIConfig({aspectRatio:2,grid:64}),/4〜96/,'64 per height at AR=2 needs nx=128, above the kernel grid limit');
});
test('unverified or out-of-range UI values are refused before the kernel',()=>{
 for(const input of [{prandtl:.5},{prandtl:2},{aspectRatio:.25},{aspectRatio:4},{grid:48},{difference:12.5},{difference:-1},{gravity:9.82},{unknown:1}])assert.throws(()=>cavityUIConfig(input),undefined,JSON.stringify(input));
 assert.doesNotThrow(()=>cavityUIConfig({difference:12,gravity:9.81}),'the builder does not invent its own Ra limit');
 assert.throws(()=>createCavity(cavityUIConfig({difference:12,gravity:9.81})),/Ra≤1000/,'kernel Ra limit is unchanged and still refuses');
});
test('builder configs run in the kernel and feed the heat-flux display for every Pr and aspect ratio',()=>{
 for(const prandtl of CAVITY_UI_PRANDTL){
  const c=cavityUIConfig({prandtl,grid:16}),m=createCavity(c);m.step(m.safeDt,false);const s=m.snapshot();
  assert.ok(Number.isFinite(s.nusselt));const heat=cavityHeatFluxSections(m.mesh,s,m.config);assert.ok(Number.isFinite(heat.leftWallNu));
 }
 for(const aspectRatio of CAVITY_UI_ASPECT_RATIOS){
  const c=cavityUIConfig({aspectRatio,grid:16}),m=createCavity(c);assert.equal(m.mesh.nx,c.nx);assert.equal(m.mesh.ny,c.ny);assert.equal(m.mesh.width,c.width);
  m.step(m.safeDt,false);const s=m.snapshot(),heat=cavityHeatFluxSections(m.mesh,s,m.config);
  assert.ok(Number.isFinite(heat.leftWallNu));
 }
 // At t=0 the wall Nu is exactly H/dx; with square cells dx=height/ny, so
 // the initial Nu0 equals ny for every aspect ratio.
 for(const aspectRatio of CAVITY_UI_ASPECT_RATIOS){const c=cavityUIConfig({aspectRatio,grid:16}),m=createCavity(c);assert.ok(Math.abs(m.snapshot().nusselt-c.ny)<1e-9,'initial Nu0 equals ny');}
});
