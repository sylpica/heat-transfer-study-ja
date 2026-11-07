import test from 'node:test';import assert from 'node:assert/strict';
import {buildTriangleExperiment} from '../dynamic/dev/triangle-ui-config.mjs';import {createTriangleDiffusion} from '../dynamic/dev/triangle-diffusion.mjs';
import {sampleTriangleField} from '../dynamic/dev/triangle-field-view.mjs';import {triangleContours,triangleCrossSection} from '../dynamic/dev/triangle-field-analysis.mjs';
const values=extra=>({shape:'rectangle',width:.4,height:.2,angleRadians:21.199438419840458*Math.PI/180,hotC:76.85,wallC:26.85,k:15,rho:1000,cp:1000,depth:.03,source:0,initialMode:'sine',subdivisions:16,mobile:false,...extra});
function advanced(extra={},time=20){const built=buildTriangleExperiment(values(extra)),m=createTriangleDiffusion(built.config);while(m.time<time)m.step(Math.min(1.25,m.safeDt,time-m.time),false);return {mesh:m.mesh,state:m.snapshot()};}
test('isotherm segments lie on the level under the same P1 interpolation used for measurement',()=>{
 const {mesh,state}=advanced(),lo=Math.min(...state.temperature),hi=Math.max(...state.temperature),level=(lo+hi)/2,segments=triangleContours(mesh,state,[level]);
 assert.ok(segments.length>10,`expected a closed isotherm loop, got ${segments.length}`);
 for(const s of segments){assert.equal(s.level,level);for(const point of [s.from,s.to]){const found=sampleTriangleField(mesh,state,point);assert.ok(found,`segment endpoint ${point} must be inside the mesh`);assert.ok(Math.abs(found.temperature-level)<1e-4,`endpoint temperature ${found.temperature} vs level ${level}`);}}
 assert.deepEqual(triangleContours(mesh,state,[hi+1,lo-1]),[],'levels outside the field produce no segments');
});
test('a uniform field has no isotherms and its cross section is flat inside and null outside',()=>{
 const {mesh,state}=advanced({initialMode:'uniform',hotC:26.85},0),wall=26.85+273.15;
 assert.deepEqual(triangleContours(mesh,state,[wall]),[]);
 const points=mesh.nodes.map(n=>n.point),section=triangleCrossSection(mesh,state,{axis:'x',at:.47,extent:[Math.min(...points.map(p=>p[0]))-.05,Math.max(...points.map(p=>p[0]))+.05],samples:81});
 assert.ok(section.points.some(p=>p.temperature===null),'the rotated outline leaves part of the common extent outside');
 for(const p of section.points)if(p.temperature!==null)assert.ok(Math.abs(p.temperature-wall)<1e-9);
});
test('cross section through the probe matches the probe sample and brackets the domain',()=>{
 const {mesh,state}=advanced(),probe=[.53,.47],expected=sampleTriangleField(mesh,state,probe).temperature,points=mesh.nodes.map(n=>n.point),extent=[Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))],section=triangleCrossSection(mesh,state,{axis:'x',at:probe[1],extent,samples:401});
 assert.equal(section.at,probe[1]);assert.equal(section.points.length,401);
 let best=null;for(let i=0;i<section.points.length-1;i++){const a=section.points[i],b=section.points[i+1];if(a.temperature!==null&&b.temperature!==null&&probe[0]>=a.position&&probe[0]<=b.position){const t=a.temperature+(b.temperature-a.temperature)*(probe[0]-a.position)/(b.position-a.position);if(!best||Math.abs(t-expected)<Math.abs(best-expected))best=t;}}
 assert.ok(best!==null,'the probe must lie on a sampled in-domain interval');
 assert.ok(Math.abs(best-expected)<.05,`section interpolation ${best} vs probe sample ${expected}`);
 const vertical=triangleCrossSection(mesh,state,{axis:'y',at:probe[0],extent:[Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[1]))],samples:201});
 assert.ok(vertical.points.some(p=>p.temperature!==null)&&vertical.points.some(p=>p.temperature===null),'a vertical line through a rotated rectangle enters and leaves the domain');
});
test('triangle field inspection rejects mismatched shapes and invalid requests',()=>{
 const {mesh,state}=advanced({},0);
 for(const f of [()=>triangleContours(mesh,{temperature:[300]},[300]),()=>triangleContours(mesh,state,[Infinity]),()=>triangleContours(mesh,state,Array(13).fill(300)),()=>triangleCrossSection(mesh,state,{axis:'z',at:0,extent:[0,1]}),()=>triangleCrossSection(mesh,state,{axis:'x',at:0,extent:[1,0]}),()=>triangleCrossSection(mesh,state,{axis:'x',at:0,extent:[0,1],samples:1})])assert.throws(f);
});
