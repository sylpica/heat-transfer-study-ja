import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCutCellGeometry} from '../dynamic/dev/cut-cell-geometry.mjs';
import {solveCutCellSteady} from '../dynamic/dev/cut-cell-steady.mjs';
import {evaluateCutCellFlux} from '../dynamic/dev/cut-cell-flux.mjs';
const co=Math.cos(.37),si=Math.sin(.37),outline=[[-.2,-.1],[.2,-.1],[.2,.1],[-.2,.1]].map(([x,y])=>[.53+x*co-y*si,.47+x*si+y*co]);
const geometry=n=>createCutCellGeometry({width:1,height:1,nx:n,ny:n,outline});
const base=(g,fn=()=>300)=>({geometry:g,k:15,depth:.03,wallTemperature:g.wallFragments.map(f=>fn(f.midpoint))});
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b} at absolute tolerance ${tol}`);
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/CUT_CELL_STEADY_REFERENCE_20261106.json',import.meta.url)));
function assertFinite(value){if(typeof value==='number')assert.ok(Number.isFinite(value));else if(value&&typeof value==='object')for(const v of Object.values(value))assertFinite(v);}

test('small all-Dirichlet system solves the unknown affine field on three cut grids, preserves its inputs and distinguishes two-point bias',()=>{
 for(const n of [6,12,24]){
  const g=geometry(n),a=base(g,([x,y])=>300+7*x-3*y),before=structuredClone(a),r=solveCutCellSteady(a),two=solveCutCellSteady({...a,scheme:'twoPoint'});
  for(const c of g.cells.filter(c=>c.active))near(r.temperature[c.id],300+7*c.centroid[0]-3*c.centroid[1],3e-12);
  assert.ok(Math.max(...two.activeCellIds.map(id=>Math.abs(two.temperature[id]-r.temperature[id])))>.02);
  assert.ok(r.maximumCellResidualW<1e-12);assert.ok(Math.abs(r.globalBalanceErrorW)<1e-12);assert.ok(r.linearSolve.relativeBackwardError<1e-13);assert.deepEqual(a,before);assertFinite(r);
  assert.equal(r.releaseApproved,false);assert.equal(r.scope.transientImplemented,false);assert.equal(r.scope.generalSecondOrderVerified,false);assert.equal(r.scope.positivityPreservationVerified,false);assert.equal(r.matrixProperties.mMatrixVerified,false);
  const constant=solveCutCellSteady(base(g));assert.equal(constant.maximumCellResidualW,0);assert.equal(constant.globalBalanceErrorW,0);assert.equal(constant.energyRoundoffBudgetW,0);for(const id of constant.activeCellIds){assert.equal(constant.temperature[id],300);assert.equal(constant.temperatureExcess[id],0);}
 }
});

test('independent exact polynomial cell/wall means show steady Poisson convergence while keeping boundary/source energy and linear-algebra evidence separate',t=>{
 near(reference.grids.reduce((a,g)=>a+g.cellAreaM2.reduce((s,v)=>s+v,0),0),4*.08,1e-14);
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-cut-cell-steady-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);
 assert.equal(reference.releaseApproved,false);const results=[];
 for(const row of reference.grids){
  const g=geometry(row.nx);assert.deepEqual(g.cells.filter(c=>c.active).map(c=>c.id),row.activeCellIds);row.activeCellIds.forEach((id,i)=>near(g.cells[id].area,row.cellAreaM2[i],2e-17));
  const actual=[];
  for(const scheme of ['twoPoint','corrected']){
   const r=solveCutCellSteady({...base(g),wallTemperature:row.wallTemperatureK,source:60,scheme}),errors=row.activeCellIds.map((id,i)=>r.temperature[id]-row.cellMeanTemperatureK[i]),rms=Math.sqrt(errors.reduce((s,e,i)=>s+e*e*row.cellAreaM2[i],0)/.08),record=row.runs.find(run=>run.scheme===scheme);
   near(rms,record.areaWeightedRmsErrorK,2e-12);near(r.totalSourceW,.144,2e-15);near(r.totalWallOutwardW,.144,2e-12);assert.ok(r.maximumCellResidualW<1e-12);assert.ok(r.linearSolve.relativeBackwardError<1e-13);assert.ok(record.independentLinearAlgebra.maximumExcessDifferenceK<1e-12);assert.equal(record.independentLinearAlgebra.finiteMatricesOnlyNotGeneralStability,true);actual.push(rms);
  }
  results.push({nx:row.nx,active:row.activeCellIds.length,twoPointRmsK:actual[0],correctedRmsK:actual[1]});
 }
 const orders=results.slice(1).map((r,i)=>Math.log2(results[i].correctedRmsK/r.correctedRmsK));t.diagnostic(JSON.stringify({results,observedCorrectedOrders:orders,scope:'This manufactured family, exact cell/wall averages; not a uniform arbitrary-geometry order or transient stability proof.'}));
 assert.ok(results.slice(1).every((r,i)=>r.correctedRmsK<results[i].correctedRmsK&&r.twoPointRmsK<results[i].twoPointRmsK));assert.ok(results.every(r=>r.correctedRmsK<r.twoPointRmsK));assert.ok(results.at(-1).correctedRmsK<.00025);
});

test('corrected affine consistency does not conceal the constructive discrete maximum-principle failure',()=>{
 const row=reference.grids[1],g=geometry(row.nx),r=solveCutCellSteady({...base(g),wallTemperature:row.wallTemperatureK,source:60}),counter=row.runs.find(run=>run.scheme==='corrected').maximumPrincipleCounterexample;
 const i=r.activeCellIds.indexOf(counter.receivingCellId),j=r.activeCellIds.indexOf(counter.initiallyWarmCellId);assert.ok(r.matrix[i][j]>r.matrixProperties.offDiagonalSignTolerance);assert.ok(r.matrixProperties.maximumAsymmetryWPerK>.1);assert.ok(counter.receivingExcessK<0);
 // Use the flux operator directly on a nonnegative basis excess. A receiving
 // cell initially at the wall temperature has positive outward heat, so its
 // capacity-normalized initial time derivative would be negative.
 const excess=g.cells.map(c=>c.active?0:null);excess[counter.initiallyWarmCellId]=1;
 const flux=evaluateCutCellFlux({geometry:g,k:15,depth:.03,temperature:excess,wallTemperature:g.wallFragments.map(()=>0)});
 assert.ok(flux.cells[counter.receivingCellId].outwardFluxW.corrected>0);
 near(-counter.algebraicEulerStepS*flux.cells[counter.receivingCellId].outwardFluxW.corrected/(g.cells[counter.receivingCellId].area*.03),counter.receivingExcessK,1e-13);
 assert.equal(r.matrixProperties.symmetryVerified,false);assert.equal(r.matrixProperties.spectrumVerified,false);assert.equal(r.scope.cflVerified,false);
});

test('shifted absolute boundary temperatures retain the same resolved steady excess and signed source balance without changing caller data',()=>{
 const g=geometry(12),a=base(g,([x,y])=>300+7*x-3*y),source=g.cells.map(c=>c.active?20+10*c.centroid[0]:null),before=structuredClone(source),r=solveCutCellSteady({...a,source});
 const shifted=solveCutCellSteady({...a,source,wallTemperature:a.wallTemperature.map(t=>t+1024)});
 for(const id of r.activeCellIds){near(shifted.temperatureExcess[id],r.temperatureExcess[id],2e-12);near(shifted.temperature[id]-r.temperature[id],1024,2e-12);}
 const cooled=solveCutCellSteady({...base(g),source:-60});near(cooled.totalSourceW,-.144,2e-15);near(cooled.totalWallOutwardW,-.144,1e-12);assert.ok(cooled.temperatureExcess.some(t=>t!==null&&t<0));assert.deepEqual(source,before);
 const arraySource=solveCutCellSteady({...base(g),source:g.cells.map(c=>c.active?60:null)}),uniform=solveCutCellSteady({...base(g),source:60});assert.deepEqual(arraySource.temperatureExcess,uniform.temperatureExcess);
});

test('tiny resolved source heat is never inferred from rounded absolute temperatures and absolute resolution loss is explicit',()=>{
 const g=createCutCellGeometry({width:1,height:1,nx:2,ny:2,outline:[[0,0],[1,0],[1,1],[0,1]]}),r=solveCutCellSteady({...base(g),source:1e-100});
 assert.equal(r.fluxEvaluationUsesExcess,true);assert.ok(r.temperatureExcess.every(v=>v>0));assert.ok(r.temperature.every(v=>v===300));assert.equal(r.absoluteTemperatureResolution.lostNonzeroExcessCount,4);assert.ok(r.absoluteTemperatureResolution.maximumRoundingErrorK>0);assert.ok(Math.abs(r.totalWallOutwardW/r.totalSourceW-1)<1e-13);assert.ok(r.maximumCellResidualW/r.totalSourceW<1e-13);assertFinite(r);
});

test('steady solver rejects nonphysical, nonfinite, unsupported, unresolved and oversized requests without mutating accepted inputs',()=>{
 const g=geometry(6),a=base(g),before=structuredClone(a),badWall=fn=>a.wallTemperature.map((v,i)=>i===0?fn(v):v);
 const bad=[null,[],{}, {...a,wallTemperature:[]},{...a,wallTemperature:badWall(()=>0)},{...a,wallTemperature:badWall(()=>-1)},{...a,wallTemperature:badWall(()=>Infinity)},{...a,k:0},{...a,depth:NaN},{...a,source:'60'},{...a,source:NaN},{...a,source:[]},{...a,source:g.cells.map(c=>c.active?Infinity:null)},{...a,source:-1e10},{...a,k:Number.MAX_VALUE,depth:Number.MAX_VALUE},{...a,depth:Number.MIN_VALUE},{...a,scheme:'explicit'},{...a,datum:1e100},{...a,dt:1},{...a,geometry:{kind:'box'}}];
 bad.forEach((value,i)=>assert.throws(()=>solveCutCellSteady(value),`invalid fixture ${i}`));
 // MAX_VALUE by itself is finite and this short/thin geometry keeps all
 // coefficients finite. Reject actual overflow, not a large valid scalar.
 const hugeFinite=solveCutCellSteady({...a,k:Number.MAX_VALUE});assertFinite(hugeFinite);assert.ok(hugeFinite.temperature.filter(v=>v!==null).every(v=>v===300));
 const large=createCutCellGeometry({width:1,height:1,nx:17,ny:17,outline:[[0,0],[1,0],[1,1],[0,1]]});assert.throws(()=>solveCutCellSteady(base(large)),/256/);assert.deepEqual(a,before);
});
