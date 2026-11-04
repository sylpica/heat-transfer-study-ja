import test from 'node:test';import assert from 'node:assert/strict';import {createCavity,projectFaces} from '../dynamic/dev/cavity.mjs';
const base={nx:8,ny:8,width:1,height:1,rho:1,cp:1,nu:.01,alpha:.01,initial:300,lidVelocity:0};
test('MAC projection removes a closed-domain manufactured velocity divergence while retaining its pressure gauge',()=>{
 const nx=12,ny=10,dx=1/nx,dy=1/ny,u=new Float64Array((nx+1)*ny),v=new Float64Array(nx*(ny+1));for(let j=0;j<ny;j++)for(let i=1;i<nx;i++)u[j*(nx+1)+i]=Math.sin(Math.PI*i/nx)*Math.sin(Math.PI*(j+.5)/ny);
 const p=projectFaces(u,v,{nx,ny,dx,dy,dt:.01,tolerance:1e-11});assert.ok(p.divergence<1e-8);assert.ok(Math.abs(p.pressure.reduce((s,x)=>s+x,0))<1e-10);assert.ok(p.iterations>0);for(let j=0;j<ny;j++){assert.equal(p.u[j*(nx+1)],0);assert.equal(p.u[j*(nx+1)+nx],0);}
});
test('quiescent isothermal cavity remains stationary and nonconverged pressure cannot partially advance its state',()=>{
 const m=createCavity(base),before=m.snapshot();m.step(m.safeDt);const s=m.snapshot();assert.ok(s.u.every(x=>x===0)&&s.v.every(x=>x===0));assert.ok(s.temperature.every(x=>x===300));assert.equal(s.energyError,0);assert.equal(s.divergence,0);
 const failed=createCavity({...base,lidVelocity:1,maxPressureIterations:1}),old=failed.snapshot();assert.throws(()=>failed.step(failed.safeDt),/収束/);assert.deepEqual(failed.snapshot(),old);assert.equal(before.time,0);
});
test('moving lid develops a vortex from calculated momentum and preserves scalar heat in the closed cavity',()=>{
 const m=createCavity({...base,lidVelocity:1});for(let i=0;i<100;i++)m.step(m.safeDt,false);const s=m.snapshot();assert.ok(s.u.some(x=>x<0)&&s.u.some(x=>x>0));assert.ok(s.v.some(x=>x<0)&&s.v.some(x=>x>0));assert.ok(s.divergence<1e-8);assert.ok(Math.abs(s.energyError)<1e-8);assert.ok(s.temperature.every(x=>Math.abs(x-300)<1e-7));
});
test('unsupported Reynolds and unchecked Boussinesq settings are refused',()=>{
 assert.throws(()=>createCavity({...base,lidVelocity:2}),/Re/);assert.throws(()=>createCavity({...base,gravityBeta:1}),/β/);assert.throws(()=>createCavity({...base,gravityBeta:1,beta:.02,leftTemperature:320,rightTemperature:280}),/Boussinesq/);assert.throws(()=>createCavity({...base,nx:0}));
});

test('invalid pressure fields, normal wall flow, unknown discretization and unverified Rayleigh are explicitly rejected',()=>{
 const args={nx:4,ny:4,dx:.25,dy:.25,dt:.01},u=new Float64Array(20),v=new Float64Array(20);assert.throws(()=>projectFaces(u,v,{...args,pressure:[0]}),/圧力場/);u[0]=1;assert.throws(()=>projectFaces(u,v,args),/法線/);
 assert.throws(()=>createCavity({...base,scalarScheme:'unknown'}));assert.throws(()=>createCavity({...base,gravityBeta:1000,beta:.001,leftTemperature:300.5,rightTemperature:299.5}),/Ra/);assert.throws(()=>createCavity({...base,rho:1e308,cp:1e308}));
});
