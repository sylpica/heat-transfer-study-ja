import test from 'node:test';import assert from 'node:assert/strict';import {createOrthogonalTriangleMesh} from '../dynamic/dev/orthogonal-triangle-mesh.mjs';
const rectangle=[[0,0],[1,0],[1,1],[0,1]],L=[[0,0],[1,0],[1,.5],[.5,.5],[.5,1],[0,1]],T=[[.25,0],[.75,0],[.75,.5],[1,.5],[1,.75],[0,.75],[0,.5],[.25,.5]],C=[[0,0],[1,0],[1,.25],[.25,.25],[.25,.75],[1,.75],[1,1],[0,1]],stair=[[0,0],[1,0],[1,.25],[.75,.25],[.75,.5],[.5,.5],[.5,.75],[.25,.75],[.25,1],[0,1]];
test('conforming concave orthogonal meshes preserve exact polygon areas, disk topology, outline corners and nonnegative local edge conditions',()=>{
 for(const [outline,area]of [[rectangle,1],[L,.75],[T,.5],[C,.625],[stair,.625]])for(const subdivisions of [1,2,4,8]){
  if(outline===stair&&subdivisions===8){assert.throws(()=>createOrthogonalTriangleMesh({outline,subdivisions}),/600節点\/1024三角形/);continue;}
  const m=createOrthogonalTriangleMesh({outline,subdivisions});assert.equal(m.numerics.area,area);assert.equal(m.nodes.length-m.edges.length+m.elements.length,1);assert.ok(m.edges.every(e=>e.triangles.length===(e.boundary?1:2)));assert.equal(m.numerics.allLocalInteriorEdgesDelaunay,true);assert.equal(m.numerics.boundaryCotangentsNonnegative,true);assert.ok(m.edges.filter(e=>e.boundary).every(e=>Number.isInteger(e.outlineEdge)));assert.ok(outline.every(p=>m.nodes.some(n=>n.point[0]===p[0]&&n.point[1]===p[1])));assert.equal(m.scope.temperaturePDEImplemented,false);assert.equal(m.releaseApproved,false);
 }
});
test('only same-shape orientation and repeated closure are repaired; shifts, reflections and exact powers of two preserve areas',()=>{
 for(const scale of [2**-20,1,8])for(const reversed of [false,true]){const outline=L.map(([x,y])=>[2+scale*x,-3+scale*y]);if(reversed)outline.reverse();outline.push(outline[0].slice());const m=createOrthogonalTriangleMesh({outline,subdivisions:4});assert.equal(m.numerics.area,.75*scale*scale);assert.ok(m.repaired.some(s=>s.includes('閉終点')));assert.equal(m.repaired.some(s=>s.includes('反時計')),reversed);}
 const reflected=createOrthogonalTriangleMesh({outline:L.map(([x,y])=>[-y,x]),subdivisions:4});assert.equal(reflected.numerics.area,.75);
});
test('nonorthogonal, degenerate, crossing, touching, overlapping and hidden extra inputs are rejected loudly',()=>{
 for(const outline of [[[0,0],[1,0],[1,.5],[.5,1],[0,1]],[[0,0],[1,0],[.5,0],[.5,1],[0,1]],[[0,0],[2,0],[2,2],[1,2],[1,-1],[0,-1]],[[0,0],[1,0],[1,1],[0,1],[0,.5],[1,.5],[1,0]],[[0,0],[1,0],[1,0],[0,1]],[[0,0],[Infinity,0],[1,1],[0,1]]])assert.throws(()=>createOrthogonalTriangleMesh({outline}));assert.throws(()=>createOrthogonalTriangleMesh({outline:L,holes:[]}));assert.throws(()=>createOrthogonalTriangleMesh({outline:L,subdivisions:3}));
});
test('coordinate fidelity rejects collapse or quantization while preserving exactly representable shifts and small lengths',()=>{
 for(const [offset,length,n]of [[1e16,4,4],[1e15,.5,8],[1e15,1.25,8]]){const outline=rectangle.map(([x,y])=>[offset+x*length,offset+y*length]);assert.throws(()=>createOrthogonalTriangleMesh({outline,subdivisions:n}));}
 for(const [offset,length,n]of [[1e9,1,4],[1e15,4,2],[0,2**-30,8]]){const outline=rectangle.map(([x,y])=>[offset+x*length,offset+y*length]);const m=createOrthogonalTriangleMesh({outline,subdivisions:n});assert.equal(m.numerics.area,length*length);assert.ok(m.numerics.maximumPhysicalElementAreaRelativeError<=4096*Number.EPSILON);}
});
