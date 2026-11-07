import test from 'node:test';import assert from 'node:assert/strict';import {createCutCellGeometry} from '../dynamic/dev/cut-cell-geometry.mjs';
// Closed forms for regular polygons are independent of clipping, polygon area
// accumulation, face extraction and centroid routines in the implementation.
test('rotated regular polygons preserve their analytic area, perimeter and centroid across nonmatching Cartesian cuts',()=>{
 for(let n=3;n<=12;n++)for(const angle of [.013,.123,.521,.812]){
  const r=.3,outline=Array.from({length:n},(_,i)=>[.5+r*Math.cos(angle+2*Math.PI*i/n),.5+r*Math.sin(angle+2*Math.PI*i/n)]),expectedArea=.5*n*r*r*Math.sin(2*Math.PI/n),expectedPerimeter=2*n*r*Math.sin(Math.PI/n),m=createCutCellGeometry({width:1,height:1,nx:7,ny:9,outline}),budget=64*n*Number.EPSILON;
  assert.ok(Math.abs(m.totals.cellArea-expectedArea)<budget);assert.ok(Math.abs(m.totals.polygonArea-expectedArea)<budget);assert.ok(Math.abs(m.totals.wallFragmentLength-expectedPerimeter)<budget);assert.ok(Math.abs(m.totals.polygonPerimeter-expectedPerimeter)<budget);
  for(const center of [m.totals.polygonCentroid,m.totals.areaWeightedCellCentroid])assert.ok(Math.hypot(center[0]-.5,center[1]-.5)<budget);
  assert.equal(m.cells.length,63);assert.ok(m.cells.filter(c=>c.active).every(c=>c.area>0&&c.centroid!==null));assert.equal(m.numerics.heatEquationSolved,false);assert.equal(m.releaseApproved,false);
 }
});

test('finite polygon area cannot hide an overflowing Gauss diagnostic behind a NaN comparison',()=>{
 const s=1e154;assert.ok(Number.isFinite(s*s));assert.equal(Number.isFinite(2*s*s),false);
 // The area itself fits, while a required diagnostic does not. Returning a
 // geometry with NaN residuals would bypass abs(residual)>tolerance checks.
 assert.throws(()=>createCutCellGeometry({width:s,height:s,nx:1,ny:1,outline:[[0,0],[s,0],[s,s],[0,s]]}),/数値範囲/);
});
