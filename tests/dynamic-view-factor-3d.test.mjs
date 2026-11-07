import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createBoxViewFactors3D} from '../dynamic/dev/view-factor-3d.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/VIEW_FACTOR_3D_REFERENCE_20261107.json',import.meta.url)));
const near=(a,b,tol=1e-11)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b} (tol ${tol})`);
const dimsOf=row=>({x:row.dimensions[0],y:row.dimensions[1],z:row.dimensions[2]});
function checkInvariants(r){
 for(let i=0;i<6;i++){
  assert.equal(r.viewFactors[i][i],0);
  near(r.viewFactors[i].reduce((s,v)=>s+v,0),1,1e-9);
  for(let j=0;j<6;j++){
   assert.ok(r.viewFactors[i][j]>=0&&r.viewFactors[i][j]<=1);
   near(r.areas[i]*r.viewFactors[i][j],r.areas[j]*r.viewFactors[j][i],1e-9*Math.max(r.areas[i],r.areas[j]));
  }
 }
 assert.equal(r.diagnostics.renormalized,false);assert.equal(r.diagnostics.clipped,false);
 assert.equal(r.scope.generalGeometry,false);assert.equal(r.scope.curvedSurfaces,false);
 assert.equal(r.scope.radiationNetworkConnected,false);assert.equal(r.releaseApproved,false);
}

test('generator is pinned and its two independent paths agree',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-view-factor-3d-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);
 assert.equal(reference.releaseApproved,false);
 for(const row of reference.cases){
  assert.ok(row.formulaRowSumMaxError<1e-38,`${row.id} row sum`);
  assert.ok(row.formulaReciprocityMaxError<1e-38,`${row.id} reciprocity`);
 }
 assert.equal(reference.quadratureChecks.length,10);
 for(const c of reference.quadratureChecks)assert.ok(c.difference<1e-25,`${c.case} ${c.from}->${c.to}`);
});

test('box matrices agree with the analytic Table 10.3 reference for every recorded case',()=>{
 for(const row of reference.cases){
  const r=createBoxViewFactors3D({dimensions:dimsOf(row)});checkInvariants(r);
  r.viewFactors.forEach((values,i)=>values.forEach((v,j)=>near(v,row.viewFactors[i][j],2e-11)));
  r.areas.forEach((v,i)=>near(v,row.areas[i],1e-12));
 }
});

test('cube factors match the known analytic values and the summation rule holds at round-off level',()=>{
 const r=createBoxViewFactors3D({dimensions:{x:1,y:1,z:1}});
 near(r.viewFactors[0][1],0.19982489569838738,1e-12);
 for(const j of [2,3,4,5])near(r.viewFactors[0][j],0.20004377607540316,1e-12);
 assert.ok(r.diagnostics.maximumRowResidual<1e-13,`row residual ${r.diagnostics.maximumRowResidual}`);
 assert.ok(r.diagnostics.reciprocityRelativeResidual<1e-12);
 // All faces of a cube are equivalent: every row is a permutation of one row.
 const sorted=r.viewFactors.map(row=>[...row].sort((a,b)=>a-b));
 for(const row of sorted)sorted[0].forEach((v,i)=>near(row[i],v,1e-12));
});

test('long boxes approach the infinite-duct (2D) crossed-string values monotonically',()=>{
 const duct=reference.duct2D;
 assert.ok(Math.abs(duct.oppositeF-(Math.SQRT2-1))<1e-15);
 const at=length=>createBoxViewFactors3D({dimensions:{x:1,y:length,z:1}});
 const r20=at(20),r100=at(100);
 const err20=Math.abs(r20.viewFactors[0][1]-duct.oppositeF),err100=Math.abs(r100.viewFactors[0][1]-duct.oppositeF);
 assert.ok(r20.viewFactors[0][1]<duct.oppositeF&&r100.viewFactors[0][1]<duct.oppositeF);
 assert.ok(err100<err20&&err100<3e-3,`2D approach: ${err20} -> ${err100}`);
 // End-cap share vanishes as the duct lengthens; side-wall share approaches the 2D adjacent value.
 assert.ok(r100.viewFactors[0][2]<r20.viewFactors[0][2]&&r100.viewFactors[0][2]<3e-3);
 assert.ok(Math.abs(r100.viewFactors[0][4]-duct.adjacentF)<Math.abs(r20.viewFactors[0][4]-duct.adjacentF));
});

test('flat and extreme-aspect boxes stay inside the resolution budget',()=>{
 const flat=createBoxViewFactors3D({dimensions:{x:1,y:1,z:0.001}});
 near(flat.viewFactors[0][1],0.9980056319075797,1e-9);
 checkInvariants(flat);
 const tall=createBoxViewFactors3D({dimensions:{x:1,y:1000,z:1}});
 checkInvariants(tall);
 assert.ok(tall.diagnostics.maximumRowResidual<1e-9);
});

test('finer integration resolution does not move the result away from the reference',()=>{
 const row=reference.cases.find(c=>c.id==='box-2-1-3'),dims=dimsOf(row);
 const errAt=integration=>{
  const r=createBoxViewFactors3D({dimensions:dims,integration});
  return Math.max(...r.viewFactors.flatMap((values,i)=>values.map((v,j)=>Math.abs(v-row.viewFactors[i][j]))));
 };
 // The coarsest setting that still satisfies the module's own residual
 // guard; anything coarser is refused by the factory instead of being
 // returned with degraded accuracy.
 const coarse=errAt({separationPanels:8,polarPanels:16,gaussOrder:5});
 const standard=errAt({});
 const fine=errAt({separationPanels:20,polarPanels:32,gaussOrder:7});
 assert.ok(coarse<1e-9,`coarse error ${coarse}`);
 assert.ok(standard<coarse/10,`standard ${standard} vs coarse ${coarse}`);
 assert.ok(standard<2e-11,`standard error ${standard}`);
 assert.ok(fine<=standard,`fine ${fine} vs standard ${standard}`);
});

test('view factors are invariant under uniform scaling of the box',()=>{
 const base=createBoxViewFactors3D({dimensions:{x:2,y:1,z:3}});
 for(const s of [1e-6,1e6]){
  const r=createBoxViewFactors3D({dimensions:{x:2*s,y:1*s,z:3*s}});
  r.viewFactors.forEach((values,i)=>values.forEach((v,j)=>near(v,base.viewFactors[i][j],1e-12)));
  r.areas.forEach((v,i)=>near(v/(s*s),base.areas[i],1e-9));
 }
});

test('invalid dimensions and integration options fail atomically and leave caller data intact',()=>{
 const good={dimensions:{x:1,y:2,z:3}},before=structuredClone(good);
 const invalid=[
  {},null,{dimensions:null},{dimensions:{x:1,y:1}},{dimensions:{x:0,y:1,z:1}},
  {dimensions:{x:-1,y:1,z:1}},{dimensions:{x:NaN,y:1,z:1}},{dimensions:{x:Infinity,y:1,z:1}},
  {dimensions:{x:1,y:1,z:1},extra:1},{dimensions:{x:1,y:1,z:1,w:2}},
  {dimensions:{x:1,y:1,z:1},integration:5},{dimensions:{x:1,y:1,z:1},integration:{bogus:1}},
  {dimensions:{x:1,y:1,z:1},integration:{gaussOrder:1}},
  {dimensions:{x:1,y:1,z:1},integration:{gaussOrder:9}},
  {dimensions:{x:1,y:1,z:1},integration:{gaussOrder:2.5}},
  {dimensions:{x:1,y:1,z:1},integration:{separationPanels:0}},
  {dimensions:{x:1,y:1,z:1},integration:{polarPanels:65}},
 ];
 for(const v of invalid)assert.throws(()=>createBoxViewFactors3D(v));
 assert.deepEqual(good,before);
 const r=createBoxViewFactors3D(good);
 r.viewFactors[0][1]=999;
 assert.notEqual(createBoxViewFactors3D(good).viewFactors[0][1],999);
});
