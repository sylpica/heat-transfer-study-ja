import test from 'node:test';import assert from 'node:assert/strict';import {createCutCellGeometry} from '../dynamic/dev/cut-cell-geometry.mjs';import {diagnoseAffineCutCellFlux} from '../dynamic/dev/cut-cell-flux.mjs';
const rectangle=(a,b,w,h)=>[[a,b],[a+w,b],[a+w,b+h],[a,b+h]],affine={a:300,b:7,c:-3};
function shape(angle=.37,nx=9,ny=7){const co=Math.cos(angle),si=Math.sin(angle),outline=rectangle(-.2,-.1,.4,.2).map(([x,y])=>[.53+x*co-y*si,.47+x*si+y*co]);return createCutCellGeometry({width:1,height:1,nx,ny,outline});}
const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
function patch(r,g,tol=1e-10){
 for(const face of [...r.sharedFaces,...r.wallFaces]){const independentExact=-r.k*face.length*r.depth*(r.affine.b*face.normal[0]+r.affine.c*face.normal[1]);close(face.exact.fluxW,independentExact,1e-14);close(face.corrected.fluxW,independentExact,tol);}
 for(const c of r.cells.filter(Boolean)){assert.equal(c.leastSquares.rank,2);assert.ok(c.leastSquares.condition<=1e8);close(c.reconstructedGradient[0],r.affine.b,1e-8);close(c.reconstructedGradient[1],r.affine.c,1e-8);assert.ok(Math.abs(c.outwardFluxW.corrected)<tol);assert.ok(Math.abs(c.outwardFluxW.exact)<tol);}
 assert.ok(Math.abs(r.summary.corrected.allBoundaryOutwardW)<tol);assert.ok(Math.abs(r.summary.exact.allBoundaryOutwardW)<tol);assert.ok(Math.abs(r.summary.corrected.internalCancellationResidualW)<tol);assert.equal(r.summary.corrected.maximumPairCancellationW,0);assert.equal(r.scope.temperaturePDEImplemented,false);assert.equal(r.scope.cflVerified,false);assert.equal(r.scope.symmetryVerified,false);assert.equal(r.scope.positivityVerified,false);assert.equal(r.scope.secondOrderGeneralAccuracyVerified,false);assert.equal(r.releaseApproved,false);
}
test('constant affine data give exact zero flux in orthogonal and rotated cut cells without reading coefficients as reconstructed gradients',()=>{
 for(const geometry of [shape(0),shape(.37)]){const r=diagnoseAffineCutCellFlux({geometry,k:15,depth:.03,affine:{a:300,b:0,c:0}});for(const c of r.cells.filter(Boolean)){assert.deepEqual(c.reconstructedGradient,[0,0]);assert.equal(c.outwardFluxW.corrected,0);}for(const f of [...r.sharedFaces,...r.wallFaces])for(const key of ['twoPoint','corrected','exact'])assert.equal(f[key].fluxW,0);assert.equal(r.summary.twoPoint.maximumFaceFluxErrorW,0);patch(r,geometry);}
});
test('grid-aligned rectangular cells reproduce independent Fourier flux and signs with either face formula',()=>{
 const g=createCutCellGeometry({width:2,height:1,nx:4,ny:4,outline:rectangle(0,0,2,1)}),r=diagnoseAffineCutCellFlux({geometry:g,k:15,depth:.03,affine});patch(r,g);assert.ok(r.summary.twoPoint.maximumFaceFluxErrorW<1e-10);for(const f of r.sharedFaces)if(f.normal[0]===1)assert.ok(f.exact.fluxW<0);else assert.ok(f.exact.fluxW>0);
});
test('the same rotated geometry demonstrates a failed two-point patch and linearly consistent least-squares nonorthogonal correction',t=>{
 const g=shape(),before=structuredClone(g),r=diagnoseAffineCutCellFlux({geometry:g,k:15,depth:.03,affine});assert.deepEqual(g,before);patch(r,g);assert.ok(r.summary.twoPoint.maximumFaceFluxErrorW>.1);assert.ok(r.summary.twoPoint.maximumCellImbalanceW>.1);assert.ok(r.summary.corrected.maximumFaceFluxErrorW<1e-10);assert.ok(r.summary.corrected.maximumCellImbalanceW<1e-10);assert.ok(r.summary.twoPoint.maximumFaceFluxErrorW/r.summary.corrected.maximumFaceFluxErrorW>1e10);t.diagnostic(JSON.stringify({sameGeometryAndData:true,twoPoint:r.summary.twoPoint,corrected:r.summary.corrected,scope:r.scope}));
});
test('one shared flux is returned and assembled as equal and opposite contributions for both neighboring cells',()=>{
 const g=shape(.53,11,8),r=diagnoseAffineCutCellFlux({geometry:g,k:3,depth:.07,affine:{a:10,b:-2,c:9}});patch(r,g);
 for(const key of ['twoPoint','corrected','exact']){
  const assembled=g.cells.map(()=>[]);for(const f of r.sharedFaces){const [a,b]=f.outwardFluxByCellW[key];assert.equal(a,f[key].fluxW);assert.equal(a+b,0);assembled[f.cells[0]].push(a);assembled[f.cells[1]].push(b);}for(const f of r.wallFaces)assembled[f.cell].push(f[key].fluxW);
  r.cells.forEach((c,i)=>{if(c)close(assembled[i].reduce((s,v)=>s+v,0),c.outwardFluxW[key],1e-12);});assert.equal(r.summary[key].maximumPairCancellationW,0);
 }
});
test('dimensional similarity changes gradients inversely and three-dimensional heat rates linearly with length',()=>{
 const g=shape(),r=diagnoseAffineCutCellFlux({geometry:g,k:15,depth:.03,affine}),co=Math.cos(.37),si=Math.sin(.37),outline=rectangle(-.2,-.1,.4,.2).map(([x,y])=>[.53+x*co-y*si,.47+x*si+y*co]);
 for(const lambda of [.25,2,8]){const geometry=createCutCellGeometry({width:lambda,height:lambda,nx:9,ny:7,outline:outline.map(p=>p.map(v=>v*lambda))}),s=diagnoseAffineCutCellFlux({geometry,k:15,depth:.03*lambda,affine:{a:300,b:7/lambda,c:-3/lambda}});patch(s,geometry,1e-9);s.cells.forEach((c,i)=>{if(c){close(c.temperature,r.cells[i].temperature,1e-12);c.reconstructedGradient.forEach((v,k)=>close(v,r.cells[i].reconstructedGradient[k]/lambda,1e-10));close(c.leastSquares.condition,r.cells[i].leastSquares.condition,1e-12);}});for(const kind of ['sharedFaces','wallFaces'])s[kind].forEach((f,i)=>{for(const key of ['twoPoint','corrected','exact'])close(f[key].fluxW,r[kind][i][key].fluxW*lambda,1e-10);});}
});
test('linear data on several convex polygons pass normal-flux and Gauss checks without claiming a time solver',()=>{
 for(const n of [3,5,8]){const outline=Array.from({length:n},(_,i)=>[.5+.29*Math.cos(.123+2*Math.PI*i/n),.5+.29*Math.sin(.123+2*Math.PI*i/n)]),g=createCutCellGeometry({width:1,height:1,nx:7,ny:9,outline}),r=diagnoseAffineCutCellFlux({geometry:g,k:2,depth:.1,affine:{a:280,b:-4,c:6}});patch(r,g);}
});
test('invalid distances, rank, conditioning, coefficients and unresolved temperature data are rejected with reasons',()=>{
 const g=createCutCellGeometry({width:1,height:1,nx:1,ny:1,outline:rectangle(0,0,1,1)}),base={geometry:g,k:1,depth:1,affine};
 for(const p of [{k:0},{k:Infinity},{depth:0},{depth:NaN},{affine:{a:300,b:NaN,c:0}},{affine:{a:1e300,b:1,c:1}},{geometry:{}},{source:1}])assert.throws(()=>diagnoseAffineCutCellFlux({...base,...p}));
 const rank=structuredClone(g);rank.wallFragments=rank.wallFragments.filter(f=>f.normal[0]!==0);assert.throws(()=>diagnoseAffineCutCellFlux({...base,geometry:rank}),/ランク/);
 const ill=structuredClone(g);ill.wallFragments=[{...ill.wallFragments[3],midpoint:[0,.5],normal:[-1,0]},{...ill.wallFragments[1],midpoint:[1,.5000001],normal:[1,0]}];assert.throws(()=>diagnoseAffineCutCellFlux({...base,geometry:ill}),/悪条件/);
 const distance=structuredClone(g);distance.wallFragments[0].midpoint=[.5,.6];assert.throws(()=>diagnoseAffineCutCellFlux({...base,geometry:distance}),/正の法線距離/);
 const length=structuredClone(g);length.wallFragments[0].length=0;assert.throws(()=>diagnoseAffineCutCellFlux({...base,geometry:length}),/長さ/);
 const normal=structuredClone(g);normal.wallFragments[0].normal=[2,0];assert.throws(()=>diagnoseAffineCutCellFlux({...base,geometry:normal}),/単位外向き/);
 const skew=structuredClone(g);skew.wallFragments[0].midpoint=[0,.5-1e-10];assert.throws(()=>diagnoseAffineCutCellFlux({...base,geometry:skew}),/悪条件/);
 assert.throws(()=>diagnoseAffineCutCellFlux({...base,k:1e308}),/数値範囲/);
});
