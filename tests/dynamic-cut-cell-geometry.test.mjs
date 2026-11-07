import test from 'node:test';import assert from 'node:assert/strict';import {createCutCellGeometry} from '../dynamic/dev/cut-cell-geometry.mjs';
const close=(a,b,tol=2e-13)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`),rect=(a,b,w,h)=>[[a,b],[a+w,b],[a+w,b+h],[a,b+h]];
function identities(g){
 for(const c of g.cells){if(!c.active){assert.equal(c.area,0);assert.equal(c.centroid,null);assert.equal(c.boundary.length,0);continue;}assert.ok(c.area>0&&c.areaFraction>0&&c.areaFraction<=1+128*Number.EPSILON);let x=0,y=0,direct=0,local=0,perimeter=0;for(const f of c.boundary){x+=f.normal[0]*f.length;y+=f.normal[1]*f.length;direct+=(f.midpoint[0]*f.normal[0]+f.midpoint[1]*f.normal[1])*f.length;local+=((f.midpoint[0]-c.centroid[0])*f.normal[0]+(f.midpoint[1]-c.centroid[1])*f.normal[1])*f.length;perimeter+=f.length;close(Math.hypot(...f.normal),1,1e-14);assert.ok(f.length>0);}
  assert.ok(Math.hypot(x,y)<2e-13*perimeter);assert.ok(Math.abs(direct-2*c.area)<3e-13*perimeter*Math.max(g.width,g.height));assert.ok(Math.abs(local-2*c.area)<3e-13*perimeter*Math.hypot(g.width/g.nx,g.height/g.ny));
 }
 for(const f of g.sharedFaces){const [a,b]=f.cells,A=g.cells[a].boundary.find(p=>p.faceId===f.id),B=g.cells[b].boundary.find(p=>p.faceId===f.id);assert.ok(A&&B);assert.deepEqual(A.endpoints,B.endpoints);assert.equal(A.length,B.length);assert.deepEqual(A.midpoint,B.midpoint);assert.deepEqual(A.normal,B.normal.map(v=>-v||0));assert.equal(A.neighbor,b);assert.equal(B.neighbor,a);}
 close(g.totals.cellArea,g.totals.polygonArea);close(g.totals.wallFragmentLength,g.totals.polygonPerimeter);g.totals.areaWeightedCellCentroid.forEach((v,k)=>close(v,g.totals.polygonCentroid[k]));
}
test('box-aligned cells retain exact box area and wall length without treating internal apertures as physical walls',()=>{
 const g=createCutCellGeometry({width:2,height:1,nx:4,ny:4,outline:rect(0,0,2,1)});assert.equal(g.totals.polygonArea,2);assert.equal(g.totals.cellArea,2);assert.equal(g.totals.polygonPerimeter,6);assert.deepEqual(g.totals.polygonCentroid,[1,.5]);assert.equal(g.sharedFaces.length,24);assert.equal(g.wallFragments.length,16);assert.equal(g.totals.activeCells,16);g.cells.forEach(c=>{assert.equal(c.area,.125);assert.equal(c.areaFraction,1);});identities(g);assert.equal(g.releaseApproved,false);assert.equal(g.numerics.heatEquationSolved,false);
});
test('triangle and a square with an analytically removed corner conserve independent areas, centroids and perimeter',()=>{
 const t=createCutCellGeometry({width:1,height:1,nx:8,ny:8,outline:[[.125,.125],[.875,.125],[.125,.875]]});close(t.totals.polygonArea,.75*.75/2);close(t.totals.polygonPerimeter,1.5+.75*Math.SQRT2);t.totals.polygonCentroid.forEach(v=>close(v,.375));identities(t);
 const g=createCutCellGeometry({width:2,height:2,nx:8,ny:8,outline:[[0,0],[2,0],[2,1],[1,2],[0,2]]});close(g.totals.polygonArea,3.5);close(g.totals.polygonPerimeter,6+Math.SQRT2);g.totals.polygonCentroid.forEach(v=>close(v,19/21));identities(g);
});
test('an explicitly repeated closing point and clockwise ordering preserve the original shape and source-wall identities',()=>{
 const points=[[0,0],[.5,0],[1,0],[1,1],[0,1]],cw=[...points].reverse();cw.push([...cw[0]]);const before=structuredClone(cw),g=createCutCellGeometry({width:1,height:1,nx:4,ny:4,outline:cw});assert.deepEqual(cw,before);assert.equal(g.repaired.length,2);assert.equal(g.totals.polygonArea,1);assert.equal(g.totals.polygonPerimeter,4);for(const f of g.wallFragments){assert.ok(Number.isInteger(f.edgeId)&&f.edgeId>=0&&f.edgeId<points.length);assert.ok((f.midpoint[0]-.5)*f.normal[0]+(f.midpoint[1]-.5)*f.normal[1]>0);}identities(g);
});
test('a rotated rectangle uses physical normals and cuts, not center sampling or a staircase perimeter',()=>{
 const angle=.37,co=Math.cos(angle),si=Math.sin(angle),outline=rect(-.2,-.1,.4,.2).map(([x,y])=>[.53+x*co-y*si,.47+x*si+y*co]),g=createCutCellGeometry({width:1,height:1,nx:9,ny:7,outline});close(g.totals.polygonArea,.08);close(g.totals.polygonPerimeter,1.2);close(g.totals.polygonCentroid[0],.53);close(g.totals.polygonCentroid[1],.47);assert.ok(g.cells.some(c=>c.areaFraction>0&&c.areaFraction<1));assert.ok(g.wallFragments.some(f=>Math.abs(f.normal[0])>0&&Math.abs(f.normal[1])>0));identities(g);
});
test('binary translation, quarter-turn rotation and dimensional similarity preserve geometric identities and scale areas/lengths correctly',()=>{
 const outline=rect(.25,.25,.25,.375),g=createCutCellGeometry({width:1,height:1,nx:8,ny:8,outline});identities(g);
 const translated=createCutCellGeometry({width:1,height:1,nx:8,ny:8,outline:outline.map(([x,y])=>[x+.125,y+.125])});close(translated.totals.cellArea,g.totals.cellArea);translated.totals.polygonCentroid.forEach((v,k)=>close(v,g.totals.polygonCentroid[k]+.125));assert.equal(translated.totals.activeCells,g.totals.activeCells);identities(translated);
 const rotated=createCutCellGeometry({width:1,height:1,nx:8,ny:8,outline:outline.map(([x,y])=>[1-y,x])});close(rotated.totals.cellArea,g.totals.cellArea);close(rotated.totals.polygonPerimeter,g.totals.polygonPerimeter);close(rotated.totals.polygonCentroid[0],1-g.totals.polygonCentroid[1]);close(rotated.totals.polygonCentroid[1],g.totals.polygonCentroid[0]);identities(rotated);
 for(const lambda of [.25,2,8]){const s=createCutCellGeometry({width:lambda,height:lambda,nx:8,ny:8,outline:outline.map(p=>p.map(v=>v*lambda))});close(s.totals.cellArea,g.totals.cellArea*lambda**2);close(s.totals.wallFragmentLength,g.totals.wallFragmentLength*lambda);s.totals.polygonCentroid.forEach((v,k)=>close(v,g.totals.polygonCentroid[k]*lambda));s.cells.forEach((c,i)=>close(c.areaFraction,g.cells[i].areaFraction));identities(s);}
});
test('a positive thin cut stays positive in all four touched cells while grid-aligned zero-area contacts remain inactive',()=>{
 const e=2**-40,g=createCutCellGeometry({width:1,height:1,nx:8,ny:8,outline:rect(.5-e,.5-e,2*e,2*e)});assert.equal(g.totals.activeCells,4);assert.equal(g.totals.polygonArea,4*e*e);assert.equal(g.totals.cellArea,4*e*e);assert.equal(g.totals.wallFragmentLength,8*e);for(const c of g.cells.filter(c=>c.active))assert.equal(c.area,e*e);assert.ok(g.totals.smallestPositiveAreaFraction<1e-20);identities(g);
 const aligned=createCutCellGeometry({width:1,height:1,nx:8,ny:8,outline:rect(.25,.25,.25,.25)});assert.equal(aligned.totals.activeCells,4);aligned.cells.filter(c=>!c.active).forEach(c=>assert.equal(c.area,0));identities(aligned);
});
test('concavity, crossing, duplicate/zero edges, invalid boxes and unresolvable positive geometry are rejected rather than silently changed',()=>{
 const base={width:1,height:1,nx:8,ny:8,outline:rect(.25,.25,.5,.5)};
 for(const outline of [[[.1,.1],[.9,.1],[.5,.5],[.9,.9],[.1,.9]],[[0,0],[1,1],[0,1],[1,0]],[[0,0],[1,0],[1,0],[0,1]],[[0,0],[1,0],[0,1],[1,0]],[[0,0],[.5,0],[1,0]],[[-.01,0],[1,0],[0,1]],[[0,0],[Infinity,0],[0,1]],[[0,0],[1e-200,0],[0,1e-200]]])assert.throws(()=>createCutCellGeometry({...base,outline}));
 for(const patch of [{width:0},{height:Infinity},{width:Number.MIN_VALUE,height:Number.MIN_VALUE},{nx:0},{ny:129},{nx:1.5},{outline:[]},{boundaries:{}}])assert.throws(()=>createCutCellGeometry({...base,...patch}));
 // This decimal rectangle nearly touches a grid corner in IEEE input. A
 // floating intersection collapses a genuinely positive sub-ULP triangle;
 // reject the unresolved geometry instead of declaring that cell empty.
 assert.throws(()=>createCutCellGeometry({...base,outline:[[.1,.2],[.8,.1],[.9,.8],[.2,.9]]}),/解像/);
});
test('exact-sign fallback retains representable subnormal area without intermediate exponent underflow',()=>{
 const outline=[[0,0],[1e-150,1e-150],[1e-150*(1+1e-15),1e-150*(1+2e-15)]],g=createCutCellGeometry({width:1,height:1,nx:1,ny:1,outline});
 // Independent Python Fraction.from_float arithmetic on these exact IEEE
 // input coordinates gives float((bx*cy-by*cx)/2) = 4.74832495e-316,
 // hex 0x0.0000005ba7a9fp-1022. A direct 2**exponent intermediate loses it.
 assert.equal(g.totals.polygonArea,4.74832495e-316);assert.equal(g.totals.cellArea,4.74832495e-316);assert.equal(g.totals.activeCells,1);assert.ok(g.cells[0].area>0);assert.ok(g.totals.polygonCentroid.every(v=>v>0&&Number.isFinite(v)));identities(g);
 const least=createCutCellGeometry({width:1,height:1,nx:1,ny:1,outline:[[0,0],[2**-536,0],[0,2**-537]]});assert.equal(least.totals.polygonArea,Number.MIN_VALUE);assert.equal(least.cells[0].area,Number.MIN_VALUE);
 const roundsUp=createCutCellGeometry({width:1,height:1,nx:1,ny:1,outline:[[0,0],[2**-536,0],[0,1.2*2**-538]]});assert.equal(roundsUp.totals.polygonArea,Number.MIN_VALUE); // exact area is about 0.6 MIN_VALUE, which rounds up; halving an already rounded determinant would erase it.

 // The mathematical area of this smaller triangle is half MIN_VALUE and
 // rounds to zero. It must be rejected, never relabeled as an empty domain.
 assert.throws(()=>createCutCellGeometry({width:1,height:1,nx:1,ny:1,outline:[[0,0],[2**-537,0],[0,2**-537]]}),/正面積|解像|数値範囲/);
});
