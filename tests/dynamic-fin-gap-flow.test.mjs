import test from 'node:test';import assert from 'node:assert/strict';
import {solveFinGapFlow} from '../dynamic/dev/fin-gap-flow.mjs';
// Acceptance criteria A1-A8 are pre-registered in
// docs/dynamic/FINGAP_FLOW_JS_20261107.md (fixed before implementation,
// from support request 3 part B, FIN_GAP_FORMULATION.md @1836092).
const rel=(a,b)=>Math.abs(a-b)/Math.abs(b);
const air={gap:.01,finHeight:.01,length:30,rho:1.177,cp:1006,k:.0264,nu:1.575e-5,inletTemperature:300};
const driveU={type:'mean-velocity',bulkVelocity:.5};
const flux50={type:'wall-heat-flux',wallHeatFlux:50};

test('A1: developed limit, both walls constant heat flux, reproduces support-3 check value and 140/17',t=>{
 const r=solveFinGapFlow({...air,nx:400,ny:128,dxGrowth:1.03,drive:driveU,boundary:flux50});
 assert.ok(Math.abs(r.thermal.outletLocalNusselt-8.235294109)<=1e-6,`${r.thermal.outletLocalNusselt}`);
 assert.ok(rel(r.thermal.outletLocalNusselt,140/17)<=1e-8,`${r.thermal.outletLocalNusselt} vs ${140/17}`);
 assert.equal(r.releaseApproved,false);assert.equal(r.assumptions.finConductionConjugateResolved,false);
 assert.equal(r.assumptions.hydrodynamicEntranceResolved,false);assert.equal(r.assumptions.entranceAndExitPressureLossesIncluded,false);
 t.diagnostic(JSON.stringify({outletLocalNusselt:r.thermal.outletLocalNusselt,support3Value:8.235294109,analytic:140/17}));
});

test('A2: developed limit, both walls constant temperature, reproduces support-3 check value and textbook 7.541',t=>{
 const r=solveFinGapFlow({...air,length:.5,nx:512,ny:128,dxGrowth:1.02,drive:driveU,boundary:{type:'wall-temperature',wallTemperature:320}});
 assert.ok(Math.abs(r.thermal.outletLocalNusselt-7.540485607)<=1e-6,`${r.thermal.outletLocalNusselt}`);
 assert.ok(Math.abs(r.thermal.outletLocalNusselt-7.541)<=1e-3,`${r.thermal.outletLocalNusselt} vs textbook 7.541`);
 assert.ok(Math.abs(r.thermal.outletLocalNusselt-7.540700874)<=3e-4,`${r.thermal.outletLocalNusselt} vs first-mode 7.540700874`);
 t.diagnostic(JSON.stringify({outletLocalNusselt:r.thermal.outletLocalNusselt,support3Value:7.540485607,textbook:7.541,firstMode:7.540700874}));
});

test('A3: pressure drop equals the developed laminar analytic law and f*Re_Dh=96 in every accepted case',()=>{
 const cases=[
  {...air,drive:driveU,boundary:flux50},
  {...air,gap:.002,finHeight:.025,length:.06,drive:{type:'volume-flow',volumeFlowRate:2e-4},boundary:{type:'wall-temperature',wallTemperature:330}},
  {...air,gap:.005,finHeight:.04,length:.12,drive:{type:'mass-flow',massFlowRate:1.2e-4},boundary:flux50}
 ];
 for(const c of cases){
  const r=solveFinGapFlow(c),mu=c.rho*c.nu,U=r.drive.bulkVelocityMPerS;
  assert.ok(rel(r.pressure.dropPa,12*mu*U*c.length/c.gap**2)<=1e-9,`${r.pressure.dropPa}`);
  assert.ok(rel(r.pressure.frictionReynoldsProduct,96)<=1e-9,`${r.pressure.frictionReynoldsProduct}`);
  assert.ok(rel(r.pressure.gradientPaPerM,-12*mu*U/c.gap**2)<=1e-12);
  assert.equal(r.geometry.hydraulicDiameterM,2*c.gap);
 }
});

test('A4: pressure-difference drive inverts the developed friction law',()=>{
 const dp=0.1,r=solveFinGapFlow({...air,length:.1,drive:{type:'pressure-difference',pressureDifference:dp},boundary:flux50});
 const mu=air.rho*air.nu,Uexpected=dp*air.gap**2/(12*mu*.1);
 assert.ok(rel(r.drive.bulkVelocityMPerS,Uexpected)<=1e-12,`${r.drive.bulkVelocityMPerS} vs ${Uexpected}`);
 assert.ok(rel(r.pressure.dropPa,dp)<=1e-9,`${r.pressure.dropPa} vs ${dp}`);
 // The same state is reached from the equivalent volume-flow drive.
 const q=solveFinGapFlow({...air,length:.1,drive:{type:'volume-flow',volumeFlowRate:r.drive.volumeFlowRateM3PerS},boundary:flux50});
 assert.ok(rel(q.thermal.outletBulkTemperatureK,r.thermal.outletBulkTemperatureK)<=1e-12);
});

test('A5: volume-flow and mass-flow drives convert exactly to the channel mean velocity',()=>{
 const Q=2e-4,caseDims={gap:.002,finHeight:.025,length:.06},r=solveFinGapFlow({...air,...caseDims,drive:{type:'volume-flow',volumeFlowRate:Q},boundary:flux50});
 assert.ok(rel(r.drive.bulkVelocityMPerS,Q/(caseDims.gap*caseDims.finHeight))<=1e-12);
 assert.ok(rel(r.drive.massFlowRateKgPerS,air.rho*Q)<=1e-12);
 const m=solveFinGapFlow({...air,...caseDims,drive:{type:'mass-flow',massFlowRate:air.rho*Q},boundary:flux50});
 assert.ok(rel(m.drive.bulkVelocityMPerS,r.drive.bulkVelocityMPerS)<=1e-12);
 assert.ok(rel(m.drive.volumeFlowRateM3PerS,Q)<=1e-12);
});

test('A6: entrance effect raises the mean Nusselt above the developed value and it relaxes monotonically with length',t=>{
 const lengths=[.05,.5,5,30],means=lengths.map(L=>solveFinGapFlow({...air,length:L,nx:400,ny:64,dxGrowth:1.03,drive:driveU,boundary:flux50}).thermal.meanNusselt);
 assert.ok(means[0]>140/17,`${means[0]} must exceed the developed value at L=0.05 m`);
 for(let i=1;i<means.length;i++)assert.ok(means[i]<means[i-1],`mean Nu not monotone: ${means}`);
 assert.ok(rel(means.at(-1),140/17)<3e-2,`${means.at(-1)}`);
 // Bound basis (set before running): the entrance excess integral
 // int(Nu-Nu_dev)dx* saturates at O(0.5), so at x*_outlet~3.3 the length
 // mean still sits O(0.5/3.3)~2% above the developed value; 3% is the
 // pre-set closeness budget for the longest case, not a fit to output.
 const short=solveFinGapFlow({...air,length:.05,nx:128,ny:32,drive:driveU,boundary:flux50});
 const analytic=300+2*50*.05/(air.rho*air.cp*.5*air.gap);
 assert.ok(Math.abs(short.thermal.outletBulkTemperatureK-analytic)<=1e-6,`${short.thermal.outletBulkTemperatureK} vs ${analytic}`);
 assert.ok(Math.abs(short.thermal.totalHeatRateW-2*50*.05*air.finHeight)<=1e-9);
 const hShort=short.thermal.meanHeatTransferCoefficientWPerM2K;
 assert.ok(Math.abs(hShort-short.thermal.meanNusselt*air.k/(2*air.gap))<=1e-9*hShort);
 t.diagnostic(JSON.stringify({lengths,meanNusselt:means,developed:140/17}));
});

test('A7: energy balance residual stays below 1e-9 through the wrapper',()=>{
 for(const boundary of [flux50,{type:'wall-heat-flux',wallHeatFlux:-50},{type:'wall-temperature',wallTemperature:320},{type:'wall-temperature',wallTemperature:280}]){
  const r=solveFinGapFlow({...air,length:.5,nx:128,ny:32,drive:driveU,boundary});
  assert.ok(r.thermal.energyBalanceRelativeResidual<1e-9,`${boundary.type}: ${r.thermal.energyBalanceRelativeResidual}`);
 }
 const zero=solveFinGapFlow({...air,length:.5,nx:64,ny:32,drive:driveU,boundary:{type:'wall-heat-flux',wallHeatFlux:0}});
 assert.equal(zero.thermal.meanNusselt,null);assert.equal(zero.thermal.meanHeatTransferCoefficientWPerM2K,null);
 assert.equal(zero.thermal.outletLocalNusselt,null);
});

test('A8: invalid drives, boundaries, dimensions and out-of-domain flow are rejected in Japanese',()=>{
 const bad=[
  {...air,drive:driveU,boundary:flux50,unknown:1},
  {...air,boundary:flux50},
  {...air,drive:{type:'volume-flow',volumeFlowRate:1e-4,massFlowRate:1e-4},boundary:flux50},
  {...air,drive:{type:'volume-flow'},boundary:flux50},
  {...air,drive:{type:'pressure-difference',pressureDifference:0},boundary:flux50},
  {...air,drive:{type:'pressure-difference',pressureDifference:-10},boundary:flux50},
  {...air,drive:{type:'other',bulkVelocity:.5},boundary:flux50},
  {...air,gap:0,drive:driveU,boundary:flux50},
  {...air,gap:-.002,drive:driveU,boundary:flux50},
  {...air,finHeight:NaN,drive:driveU,boundary:flux50},
  {...air,drive:driveU,boundary:{type:'wall-heat-flux-insulated',wallHeatFlux:50}},
  {...air,drive:driveU,boundary:{type:'wall-temperature',wallTemperature:320,wallHeatFlux:50}},
  {...air,drive:driveU,boundary:{type:'wall-heat-flux'}},
  {...air,drive:{type:'mean-velocity',bulkVelocity:3},boundary:flux50},
  {...air,gap:.05,finHeight:.05,drive:{type:'mean-velocity',bulkVelocity:.02},boundary:flux50}
 ];
 for(const b of bad)assert.throws(()=>solveFinGapFlow(b),Error);
});
