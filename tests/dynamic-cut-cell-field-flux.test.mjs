import test from 'node:test';import assert from 'node:assert/strict';
import {createCutCellGeometry} from '../dynamic/dev/cut-cell-geometry.mjs';import {evaluateCutCellFlux} from '../dynamic/dev/cut-cell-flux.mjs';
const co=Math.cos(.37),si=Math.sin(.37),outline=[[-.2,-.1],[.2,-.1],[.2,.1],[-.2,.1]].map(([x,y])=>[.53+x*co-y*si,.47+x*si+y*co]),g=createCutCellGeometry({width:1,height:1,nx:9,ny:7,outline});
const data=fn=>({temperature:g.cells.map(c=>c.active?fn(c.centroid):null),wallTemperature:g.wallFragments.map(f=>fn(f.midpoint))});
const run=d=>evaluateCutCellFlux({geometry:g,k:15,depth:.03,...d});
function near(a,b,tol=1e-11){assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);}
test('numeric cell/wall data reproduce independent affine Fourier flux without an exact reference in the field API',()=>{
 const d=data(([x,y])=>300+7*x-3*y),before=structuredClone({g,d}),r=run(d);
 for(const f of [...r.sharedFaces,...r.wallFaces]){near(f.corrected.fluxW,-15*f.length*.03*(7*f.normal[0]-3*f.normal[1]));assert.equal(f.exact,undefined);}
 assert.equal(r.exactMaximumFaceFluxMagnitudeW,null);assert.equal(r.affine,null);assert.equal(r.scope.arbitraryFieldFluxOnly,true);assert.equal(r.scope.temperaturePDEImplemented,false);assert.equal(r.summary.corrected.maximumFaceFluxErrorW,undefined);assert.equal(r.summary.corrected.maximumCellImbalanceW,undefined);assert.deepEqual({g,d},before);
 const constant=run(data(()=>300));for(const f of [...constant.sharedFaces,...constant.wallFaces])assert.equal(f.corrected.fluxW,0);
});
test('arbitrary field flux is linear in cell and boundary data and conserves each shared contribution before global assembly',()=>{
 const a=data(([x,y])=>Math.sin(17*x+3*y)),b=data(([x,y])=>x*x-2*y*y),combined={temperature:a.temperature.map((v,i)=>v===null?null:2*v-3*b.temperature[i]),wallTemperature:a.wallTemperature.map((v,i)=>2*v-3*b.wallTemperature[i])},x=run(a),y=run(b),z=run(combined);
 for(const type of ['sharedFaces','wallFaces'])z[type].forEach((f,i)=>near(f.corrected.fluxW,2*x[type][i].corrected.fluxW-3*y[type][i].corrected.fluxW));
 z.cells.forEach((c,i)=>{if(c)near(c.outwardFluxW.corrected,2*x.cells[i].outwardFluxW.corrected-3*y.cells[i].outwardFluxW.corrected);});
 for(const f of z.sharedFaces)assert.equal(f.outwardFluxByCellW.corrected[0]+f.outwardFluxByCellW.corrected[1],0);
 near(z.summary.corrected.sumCellOutwardW,z.summary.corrected.allBoundaryOutwardW);assert.ok(z.summary.corrected.maximumCellOutwardSumMagnitudeW>0);assert.equal(z.scope.cflVerified,false);
});
test('field data require the exact cell and wall layout and finite active values without mutating accepted inputs',()=>{
 const d=data(()=>0),first=g.cells.findIndex(c=>c.active);
 for(const bad of [{...d,temperature:[]},{...d,wallTemperature:[]},{...d,temperature:d.temperature.map((v,i)=>i===first?NaN:v)},{...d,wallTemperature:d.wallTemperature.map((v,i)=>i===0?Infinity:v)}])assert.throws(()=>run(bad));
 assert.throws(()=>evaluateCutCellFlux({geometry:g,k:15,depth:.03,...d,source:1}));const before=structuredClone(d);run(d);assert.deepEqual(d,before);
});
