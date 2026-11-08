import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateChannelFlow,channelProfile,rectangleMobilitySeries,solveHeatSinkCoupled} from '../dynamic/dev/heat-sink-coupled.mjs';

// Acceptance criteria were fixed before implementation in
// docs/dynamic/HEATSINK_COUPLED_JS_20261107.md by comparison with the
// Python reference on branch codex/support-heatsink-performance
// (REFERENCE_v2.json).  Tolerances below are those criteria, unchanged.
const REF={
 r1:{source:317.4943819436352,pressure:2.851150417800843,radiation:.2388154662919355},
 r2:{source:316.8991015011487,pressure:2.9926844701835,radiation:.2306974387003427},
 r4:{source:316.6866687041174,pressure:3.0416976229211974,radiation:.22714426703806329,mobilityError:.006854974931364666},
 r4NoRad:{source:316.98898894367477}};

test('coupled heat sink matches the Python reference at refinement 1',()=>{
 const out=solveHeatSinkCoupled({},{refinement:1,hydraulicRefinement:2});
 assert.ok(Math.abs(out.sourceAverageTemperatureK-REF.r1.source)<.05);
 assert.ok(Math.abs(out.pressureDropPa-REF.r1.pressure)<.005);
 assert.ok(Math.abs(out.radiationOutwardW-REF.r1.radiation)<.001);
 assert.ok(out.relativeEnergyResidual<1e-8);
 assert.ok(Math.abs(out.fluidInternalBalanceW)<1e-8);
 assert.ok(Math.abs(out.radiationInternalBalanceW)<1e-8);
 assert.equal(out.releaseApproved,false);assert.equal(out.generalCFD,false);
});

test('coupled heat sink matches the reference at refinements 2 and 4 and converges',()=>{
 const coarse=solveHeatSinkCoupled({},{refinement:2,hydraulicRefinement:2});
 const fine=solveHeatSinkCoupled({},{refinement:4,hydraulicRefinement:2});
 assert.ok(Math.abs(coarse.sourceAverageTemperatureK-REF.r2.source)<.05);
 assert.ok(Math.abs(coarse.pressureDropPa-REF.r2.pressure)<.005);
 assert.ok(Math.abs(coarse.radiationOutwardW-REF.r2.radiation)<.001);
 assert.ok(Math.abs(fine.sourceAverageTemperatureK-REF.r4.source)<.05,
  `source ${fine.sourceAverageTemperatureK} vs reference ${REF.r4.source}`);
 assert.ok(Math.abs(fine.pressureDropPa-REF.r4.pressure)<.005);
 assert.ok(Math.abs(fine.radiationOutwardW-REF.r4.radiation)<.001);
 // Finest-grid flow coefficient against the continuum Fourier series.
 assert.ok(Math.abs(fine.hydraulicMobilityRelativeError)<.02);
 assert.ok(Math.abs(fine.hydraulicMobilityRelativeError-REF.r4.mobilityError)<1e-9);
 // Balances on the finest grid.
 assert.ok(fine.relativeEnergyResidual<1e-8);
 assert.ok(Math.abs(fine.fluidInternalBalanceW)<1e-8);
 assert.ok(Math.abs(fine.radiationInternalBalanceW)<1e-8);
 assert.ok(fine.solidResidualMaximumW<1e-10&&fine.fluidResidualMaximumW<1e-10);
 // Grid convergence of temperature rises, r2 -> r4, both under 3 percent.
 const rise=(o,v)=>o[v]-300;
 const dSource=Math.abs(rise(coarse,'sourceAverageTemperatureK')-rise(fine,'sourceAverageTemperatureK'))/rise(fine,'sourceAverageTemperatureK');
 const dMax=Math.abs(rise(coarse,'maximumBaseCellTemperatureK')-rise(fine,'maximumBaseCellTemperatureK'))/rise(fine,'maximumBaseCellTemperatureK');
 assert.ok(dSource<.03,`source rise change ${dSource}`);
 assert.ok(dMax<.03,`max base rise change ${dMax}`);
 // Radiation lowers the source temperature by about 0.302 K at r4.
 assert.ok(Math.abs((REF.r4NoRad.source-fine.sourceAverageTemperatureK)-.30232023955737)<.01);
});

test('zero emissivity reduces exactly to the convection-only solution',()=>{
 const out=solveHeatSinkCoupled({emissivity:0},{refinement:4,hydraulicRefinement:2});
 assert.equal(out.radiationOutwardW,0);
 assert.equal(out.radiationApertureW,0);
 assert.equal(out.nonlinearHistory.length,1);
 assert.ok(Math.abs(out.sourceAverageTemperatureK-REF.r4NoRad.source)<.05);
 assert.ok(out.relativeEnergyResidual<1e-8);
});

test('zero power gives exactly the ambient field',()=>{
 const out=solveHeatSinkCoupled({power:0},{refinement:1,hydraulicRefinement:2});
 assert.equal(out.sourceAverageTemperatureK,300);
 let max=0;for(const v of out.theta)max=Math.max(max,Math.abs(v));
 assert.equal(max,0);
});

test('zero or reverse flow is refused instead of relabelled natural convection',()=>{
 assert.throws(()=>solveHeatSinkCoupled({totalFlow:0},{refinement:1}),/自然対流/);
 assert.throws(()=>solveHeatSinkCoupled({totalFlow:-1e-4},{refinement:1}),/自然対流/);
 assert.throws(()=>solveHeatSinkCoupled({emissivity:1.5},{refinement:1}),/放射率/);
 assert.throws(()=>solveHeatSinkCoupled({unknownKey:1},{refinement:1}),/未対応条件/);
});

test('channel hydraulics: common-pressure allocation and continuum series',()=>{
 const gaps=Array(8).fill(.003),mu=1.177*1.575e-5;
 const byFlow=allocateChannelFlow(gaps,.03,.12,mu,{ny:6,nz:8,flow:7.2e-4,profileRefinement:2});
 for(const q of byFlow.channelFlows)assert.ok(Math.abs(q/7.2e-4*8-1)<1e-9);
 const byPressure=allocateChannelFlow(gaps,.03,.12,mu,{ny:6,nz:8,pressure:byFlow.pressurePa,profileRefinement:2});
 assert.ok(Math.abs(byPressure.flowM3PerS/7.2e-4-1)<1e-12);
 const fine=channelProfile(.003,.03,96,128),series=rectangleMobilitySeries(.003,.03);
 assert.ok(Math.abs(fine.integral/series-1)<.002,
  `profile integral ${fine.integral} vs series ${series}`);
 assert.ok(fine.maximumPoissonResidual<1e-15);
});
