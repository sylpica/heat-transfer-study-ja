import test from 'node:test';import assert from 'node:assert/strict';
import {createRadial} from '../dynamic/radial.mjs';import {radialIsothermRadii} from '../dynamic/radial-analysis.mjs';
const advance=(m,end)=>{while(m.time<end)m.step(Math.min(m.safeDt,end-m.time),false);return m.snapshot();};
// Independent check: piecewise-linear profile through shell centres and the
// surface point, evaluated at an arbitrary radius.
function profileAt(mesh,state,r){
 const points=mesh.centres.map((c,i)=>[c,state.temperature[i]]);points.push([mesh.radius,state.surfaceTemperature]);
 if(r<points[0][0]||r>mesh.radius)return null;
 for(let i=0;i<points.length-1;i++){const [r0,t0]=points[i],[r1,t1]=points[i+1];if(r>=r0&&r<=r1)return t0+(t1-t0)*(r-r0)/(r1-r0);}
 return points.at(-1)[1];
}
test('cooling sphere isotherms are single radii whose interpolated profile equals the level',()=>{
 const m=createRadial({geometry:'sphere',n:16,radius:.01,k:10,rho:1000,cp:1000,initial:373.15,boundary:{type:'temperature',temperature:293.15}}),s=advance(m,1),levels=[310,330,345],found=radialIsothermRadii(m.mesh,s,levels);
 assert.equal(found.length,3);
 for(const [i,c] of found.entries()){assert.equal(c.level,levels[i]);assert.ok(c.radius>m.mesh.centres[0]&&c.radius<m.mesh.radius);assert.ok(Math.abs(profileAt(m.mesh,s,c.radius)-c.level)<1e-9);}
 assert.ok(found[0].radius>found[1].radius&&found[1].radius>found[2].radius,'hotter isotherms sit closer to the centre while cooling');
});
test('uniform and out-of-range fields produce no isotherms, and a heated interior can produce two radii per level',()=>{
 const still=createRadial({geometry:'cylinder',length:.1,n:8,radius:.01,k:10,rho:1000,cp:1000,initial:300,boundary:{type:'insulated'}}),ss=advance(still,1);
 assert.deepEqual(radialIsothermRadii(still.mesh,ss,[300,310]),[]);
 const band=Array.from({length:16},(_,i)=>i>=6&&i<=9?400:300),hot=createRadial({geometry:'sphere',n:16,radius:.01,k:10,rho:1000,cp:1000,initial:band,boundary:{type:'insulated'}}),hs=hot.snapshot(),found=radialIsothermRadii(hot.mesh,hs,[350]);
 assert.equal(found.length,2);assert.ok(found[0].radius<found[1].radius);
 for(const c of found)assert.ok(Math.abs(profileAt(hot.mesh,hs,c.radius)-350)<1e-9);
});
test('radial isotherm inspection rejects mismatched shapes and invalid levels',()=>{
 const m=createRadial({geometry:'sphere',n:8,radius:.01,k:10,rho:1000,cp:1000,initial:300,boundary:{type:'insulated'}}),s=m.snapshot();
 for(const f of [()=>radialIsothermRadii(m.mesh,{...s,temperature:[300]},[300]),()=>radialIsothermRadii(m.mesh,s,[NaN]),()=>radialIsothermRadii(m.mesh,s,Array(13).fill(300)),()=>radialIsothermRadii({...m.mesh,centres:[.01,.005]},s,[300])])assert.throws(f);
});
