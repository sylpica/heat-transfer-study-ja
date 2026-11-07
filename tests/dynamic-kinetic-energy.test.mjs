import test from 'node:test';import assert from 'node:assert/strict';import {macKineticDiagnostics} from '../dynamic/dev/kinetic-energy.mjs';import {projectFaces} from '../dynamic/dev/cavity.mjs';
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('MAC kinetic diagnostics use independent volume, density and pressure-work units and preserve gauge invariance',()=>{
 const c={nx:2,ny:2,width:2,height:4,depth:.5,rho:3},s={u:[0,1,0,0,2,0],v:[0,0,3,4,0,0],pressure:[1,3,2,4],lastDt:.2},before=structuredClone(s),r=macKineticDiagnostics(s,c);
 near(r.kineticEnergyJ,45);near(r.pressurePowerByFacesW,-9.5);near(r.pressurePowerByCellsW,-9.5);near(r.projectionImpliedLossJ,1.9566666666666666);near(r.orthogonalProjectionLossJ,.05666666666666667);near(r.projectionOrthogonalityDefectJ,1.9);near(r.projectionIdentityResidualJ,0);assert.deepEqual(s,before);
 const gauge=macKineticDiagnostics({...s,pressure:s.pressure.map(p=>p+1000)},c);for(const key of Object.keys(r))near(gauge[key],r[key]);
 const doubled=macKineticDiagnostics(s,{...c,depth:1});for(const key of ['kineticEnergyJ','pressurePowerByFacesW','projectionImpliedLossJ'])near(doubled[key],2*r[key]);
});
test('the actual closed pressure projection removes the independently measured kinetic energy with adjoint D and G',()=>{
 const nx=12,ny=8,dx=.03,dy=.04,rho=2.5,dt=.002,c={nx,ny,width:nx*dx,height:ny*dy,depth:.2,rho},u=Float64Array.from({length:(nx+1)*ny},(_,n)=>n%(nx+1)===0||n%(nx+1)===nx?0:Math.sin(n*.7)),v=Float64Array.from({length:nx*(ny+1)},(_,n)=>Math.floor(n/nx)===0||Math.floor(n/nx)===ny?0:.4*Math.cos(n*.3)),before=macKineticDiagnostics({u,v,pressure:Array(nx*ny).fill(0),lastDt:0},c),projected=projectFaces(u,v,{nx,ny,dx,dy,rho,dt,tolerance:1e-12,maxIterations:3000}),after=macKineticDiagnostics({...projected,lastDt:dt},c);
 assert.ok(after.kineticEnergyJ<before.kineticEnergyJ);near(before.kineticEnergyJ-after.kineticEnergyJ,after.projectionImpliedLossJ);near(after.projectionImpliedLossJ,after.orthogonalProjectionLossJ);near(after.pressurePowerByFacesW,0);near(after.pressurePowerByCellsW,0);near(after.integrationByPartsResidualW,0);near(after.projectionIdentityResidualJ,0);assert.ok(after.divergenceMaxPerS<1e-8);
});
test('a discrete curl has zero divergence and pressure work for arbitrary pressure while the implied correction loss stays positive',()=>{
 const nx=10,ny=8,dx=.05,dy=.03,psi=(i,j)=>i===0||i===nx||j===0||j===ny?0:Math.sin(Math.PI*i/nx)**2*Math.sin(Math.PI*j/ny)**2,u=Array.from({length:(nx+1)*ny},(_,n)=>{const i=n%(nx+1),j=Math.floor(n/(nx+1));return (psi(i,j+1)-psi(i,j))/dy;}),v=Array.from({length:nx*(ny+1)},(_,n)=>{const i=n%nx,j=Math.floor(n/nx);return -(psi(i+1,j)-psi(i,j))/dx;}),pressure=Array.from({length:nx*ny},(_,i)=>Math.cos(i*.4)),r=macKineticDiagnostics({u,v,pressure,lastDt:.01},{nx,ny,width:nx*dx,height:ny*dy,depth:1,rho:1.177});
 near(r.pressurePowerByFacesW,0);near(r.pressurePowerByCellsW,0);near(r.projectionOrthogonalityDefectJ,0);assert.ok(r.orthogonalProjectionLossJ>0);assert.ok(r.divergenceMaxPerS<1e-10);
});
test('invalid or open-boundary fields are rejected without editing caller data',()=>{
 const c={nx:2,ny:2,width:1,height:1,rho:1},s={u:Array(6).fill(0),v:Array(6).fill(0),pressure:Array(4).fill(0),lastDt:0},before=structuredClone(s);
 for(const bad of [{...s,u:[0]},{...s,pressure:[NaN,0,0,0]},{...s,lastDt:-1},{...s,u:[1,0,0,0,0,0]}])assert.throws(()=>macKineticDiagnostics(bad,c));assert.throws(()=>macKineticDiagnostics(s,{...c,rho:0}));assert.deepEqual(s,before);
});
