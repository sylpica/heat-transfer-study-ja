import test from 'node:test';import assert from 'node:assert/strict';import {createDevelopedChannel,scalarRates} from '../dynamic/dev/channel.mjs';
const c=(ny=16)=>({nx:16,ny,width:1,height:1,depth:1,rho:1,cp:1,k:.2,nu:1,acceleration:1,initial:300});
const run=(m,t)=>{while(m.time<t-1e-12)m.step(Math.min(m.safeDt,t-m.time),false);return m.snapshot();};
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`);
test('fully developed channel startup converges to the independent Fourier-series solution with grid refinement',()=>{
 const errors=[];for(const n of [8,16,32]){const m=createDevelopedChannel(c(n)),t=.2,s=run(m,t),exact=y=>y*(1-y)/2-Array.from({length:100},(_,i)=>{const k=2*i+1;return 4/(Math.PI*k)**3*Math.sin(Math.PI*k*y)*Math.exp(-((Math.PI*k)**2)*t);}).reduce((a,b)=>a+b,0);errors.push(Math.sqrt(s.velocity.reduce((sum,v,j)=>sum+(v-exact((j+.5)/n))**2,0)/n));near(s.momentumError,0,1e-12);near(s.energyError,0,1e-9);assert.equal(s.massDivergence,0);}
 assert.ok(errors[1]<errors[0]/3.5);assert.ok(errors[2]<errors[1]/3.5);assert.ok(errors[2]<.0002);
});
test('steady plane Poiseuille profile and wall shear balance the imposed pressure gradient',()=>{
 const n=32,m=createDevelopedChannel(c(n)),s=run(m,2);for(let j=0;j<n;j++){const y=(j+.5)/n;near(s.velocity[j],y*(1-y)/2,.00013);}near(s.velocity.reduce((a,b)=>a+b)/n,1/12,.0002);near(s.steadyMomentumResidual,0,1e-7);near(s.momentumError,0,1e-10);assert.equal(s.pressureGradient,-1);near(s.steadyReynoldsDh,1/6,1e-12);
});
test('periodic upwind energy fluxes conserve total heat for both flow directions and constant temperature is invariant',()=>{
 for(const sign of [-1,1]){const nx=12,ny=8,base={nx,ny,dx:.1,dy:.1,depth:.2,rho:2,cp:3,k:.4,u:Array(ny).fill(sign*.5)},temperature=Array.from({length:nx*ny},(_,n)=>300+5*Math.cos(2*Math.PI*(n%nx+.5)/nx)),rate=scalarRates({...base,temperature});near(rate.reduce((a,b)=>a+b),0,1e-10);const constant=scalarRates({...base,temperature:Array(nx*ny).fill(300)});constant.forEach(v=>near(v,0,1e-12));}
});
test('advection-diffusion Fourier symbol independently matches the implemented conservative periodic stencil',()=>{
 const nx=20,ny=8,dx=.1,dy=.1,k=.2,U=.3,theta=2*Math.PI/nx,T=Array.from({length:nx*ny},(_,n)=>300+Math.cos(theta*(n%nx))),sine=Array.from({length:nx},(_,i)=>Math.sin(theta*i));
 const rate=scalarRates({temperature:T,u:Array(ny).fill(U),nx,ny,dx,dy,depth:1,rho:1,cp:1,k}),real=-U/dx*(1-Math.cos(theta))+2*k/dx**2*(Math.cos(theta)-1),imaginary=-U/dx*Math.sin(theta);
 for(let i=0;i<nx;i++)near(rate[i],real*Math.cos(theta*i)-imaginary*sine[i],1e-10);
});
test('invalid or out-of-scope flow is rejected instead of silently switching to a different model',()=>{
 assert.throws(()=>createDevelopedChannel({...c(),acceleration:1e9}),/上限/);assert.throws(()=>createDevelopedChannel({...c(),nu:0}));const m=createDevelopedChannel(c()),before=m.snapshot();assert.throws(()=>m.step(m.safeDt*2));assert.deepEqual(m.snapshot(),before);
});
