import test from 'node:test';import assert from 'node:assert/strict';
import {createNeumannMultigrid} from '../dynamic/dev/poisson-multigrid.mjs';import {projectFaces,createCavity} from '../dynamic/dev/cavity.mjs';import {manufacturedCavity} from '../dynamic/dev/manufactured-cavity.mjs';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),meanFree=a=>{const mean=a.reduce((s,v)=>s+v,0)/a.length;return Float64Array.from(a,v=>v-mean);},maximum=a=>Math.max(...a.map(Math.abs));
test('fixed Galerkin cycles are linear, symmetric and positive on the mean-free subspace, including odd grids',()=>{
 for(const [nx,ny]of [[8,8],[16,12],[13,9]]){
  const mg=createNeumannMultigrid({nx,ny,dx:1/nx,dy:1/ny}),a=meanFree(Array.from({length:nx*ny},(_,i)=>Math.sin(i*.7)+Math.cos(i*.13))),b=meanFree(Array.from({length:nx*ny},(_,i)=>Math.cos(i*.31)-Math.sin(i*.19))),copy=[...a],Ba=mg.apply(a),Bb=mg.apply(b),combined=mg.apply(Float64Array.from(a,(v,i)=>2*v-.7*b[i]));
  assert.deepEqual([...a],copy);assert.ok(dot(a,Ba)>0);assert.ok(Math.abs(dot(a,Bb)-dot(b,Ba))<1e-10*Math.max(1,Math.abs(dot(a,Bb))));assert.ok(maximum(Float64Array.from(combined,(v,i)=>v-2*Ba[i]+.7*Bb[i]))<1e-11);assert.ok(mg.apply(Array(nx*ny).fill(7)).every(v=>v===0));assert.ok(mg.levels.at(-1).size<=16);
 }
});
function projection(nx,ny,rho=1){
 const dx=1/nx,dy=1/ny,dt=.01,pressure=Array.from({length:nx*ny},(_,n)=>{const x=(n%nx+.5)/nx,y=(Math.floor(n/nx)+.5)/ny;return Math.cos(Math.PI*x)*Math.cos(2*Math.PI*y)+.3*Math.cos(3*Math.PI*x)*Math.cos(Math.PI*y);}),us=new Float64Array((nx+1)*ny),vs=new Float64Array(nx*(ny+1));
 for(let j=0;j<ny;j++)for(let i=1;i<nx;i++)us[j*(nx+1)+i]=dt/rho*(pressure[j*nx+i]-pressure[j*nx+i-1])/dx;for(let j=1;j<ny;j++)for(let i=0;i<nx;i++)vs[j*nx+i]=dt/rho*(pressure[j*nx+i]-pressure[(j-1)*nx+i])/dy;
 const options={nx,ny,dx,dy,rho,dt,tolerance:1e-11,maxIterations:4000},jacobi=projectFaces(us,vs,options),mg=createNeumannMultigrid(options),multigrid=projectFaces(us,vs,{...options,preconditioner:mg}),mean=pressure.reduce((a,b)=>a+b,0)/pressure.length;
 assert.ok(maximum(multigrid.pressure.map((v,i)=>v-(pressure[i]-mean)))<5e-9);assert.ok(maximum(multigrid.pressure.map((v,i)=>v-jacobi.pressure[i]))<5e-9);assert.ok(maximum(multigrid.u)<1e-9);assert.ok(maximum(multigrid.v)<1e-9);assert.ok(multigrid.divergence<1e-8);return {jacobi,multigrid};
}
test('multigrid PCG solves the original pressure problem and agrees with Jacobi on rectangular and odd meshes',()=>{
 for(const [nx,ny]of [[8,12],[13,9],[16,16]])for(const rho of [1,9])projection(nx,ny,rho);
});
test('multigrid reduces pressure iterations on a resolved mixed-mode 64 square without altering the solution',()=>{
 const {jacobi,multigrid}=projection(64,64);assert.ok(multigrid.iterations<jacobi.iterations*.5,`${multigrid.iterations} vs ${jacobi.iterations}`);
});
test('small coarse solves, malformed geometry, RHS and mismatched preconditioners have explicit outcomes',()=>{
 const {multigrid}=projection(2,3);assert.ok(multigrid.iterations<=2);for(const bad of [{nx:1},{ny:0},{dx:0},{dx:1e-200},{nx:257}])assert.throws(()=>createNeumannMultigrid({nx:8,ny:8,dx:.1,dy:.1,...bad}));const mg=createNeumannMultigrid({nx:8,ny:8,dx:.1,dy:.1});assert.throws(()=>mg.apply([1]));assert.throws(()=>mg.apply(Array(64).fill(NaN)));
 const us=new Float64Array(12),vs=new Float64Array(12);assert.throws(()=>projectFaces(us,vs,{nx:3,ny:3,dx:1,dy:1,dt:.1,preconditioner:mg}),/前処理/);
});
test('coupled lid, buoyant and manufactured trajectories match the original fine-grid solver',()=>{
 const base={nx:16,ny:16,width:1,height:1,rho:1,cp:1,nu:1,alpha:.2,initial:300,pressureTolerance:1e-11,maxPressureIterations:4000},cases=[{config:{...base,nu:.01,alpha:.01,lidVelocity:1},time:.3},{config:{...base,nu:.71,alpha:1,leftTemperature:300.5,rightTemperature:299.5,gravityBeta:710,beta:.001,referenceTemperature:300,scalarScheme:'central'},time:.03},{config:{...base,leftTemperature:300,rightTemperature:300,scalarScheme:'central'},verification:manufacturedCavity(),time:.025}];
 for(const {config,verification,time}of cases){const results=[];for(const pressurePreconditioner of ['jacobi','multigrid']){const m=createCavity({...config,pressurePreconditioner},verification);while(m.time<time-1e-12)m.step(Math.min(m.safeDt,time-m.time),false);results.push(m.snapshot());}for(const key of ['u','v','temperature','pressure'])assert.ok(maximum(results[0][key].map((v,i)=>v-results[1][key][i]))<(key==='pressure'?1e-6:1e-8),key);assert.ok(results[1].divergence<1e-8);assert.ok(Math.abs(results[1].energyError)<1e-8);assert.equal(results[1].pressurePreconditioner,'multigrid');assert.ok(Number.isSafeInteger(results[1].totalPressureIterations));}
 assert.throws(()=>createCavity({...base,pressurePreconditioner:'unchecked'}),/前処理/);
});
test('converged zero systems skip expensive preconditioning and overflowed norms cannot falsely succeed',()=>{
 const options={nx:2,ny:2,dx:1,dy:1,dt:1},u=new Float64Array(6),v=new Float64Array(6);assert.equal(projectFaces(u,v,{...options,preconditioner:{size:4,apply:()=>{throw Error('must not be called');}}}).iterations,0);u[1]=1e200;assert.throws(()=>projectFaces(u,v,options),/ノルム|数値範囲/);
});
