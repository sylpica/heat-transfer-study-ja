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
test('channel evolution and restore are atomic, validate derived scales, and do not retain mutable input references',()=>{
 for(const bad of [{width:1e308,height:1e308},{rho:1e300,cp:1e300},{initial:'300'},{initialVelocity:Array(16).fill('0')},{outline:[[0,0],[1,0],[0,1]]},{boundaries:{left:{type:'temperature',temperature:400}}}])assert.throws(()=>createDevelopedChannel({...c(),...bad}));
 const original=c(),m=createDevelopedChannel(original),fresh=createDevelopedChannel(c());original.nu=1e20;original.initialVelocity=Array(16).fill(999);m.step(.001);fresh.step(.001);assert.deepEqual(m.snapshot(),fresh.snapshot());const a=m.snapshot();m.step(.001);const b=m.snapshot();m.restore(a);m.step(.001);assert.deepEqual(m.snapshot(),b);
 for(const bad of [{temperature:Array(256).fill(0)},{velocity:Array(16).fill(1e30)},{momentumInput:Infinity},{time:-1},{steps:.5},{maxAdvectionCfl:-1}]){const before=m.snapshot();assert.throws(()=>m.restore({...before,...bad}));assert.deepEqual(m.snapshot(),before);}
});
test('startup time refinements have first-order error against an independent exact semi-discrete eigenfunction expansion',()=>{
 const n=16,t=.2,exact=Array.from({length:n},(_,j)=>{let sum=0;for(let k=1;k<=n;k++){const mode=Array.from({length:n},(_,i)=>Math.sin(k*Math.PI*(i+.5)/n)),forcing=mode.reduce((a,b)=>a+b,0)/mode.reduce((a,b)=>a+b*b,0),lambda=4*n*n*Math.sin(k*Math.PI/(2*n))**2;sum+=forcing/lambda*(1-Math.exp(-lambda*t))*mode[j];}return sum;});
 const errors=[1,.5,.25].map(f=>{const m=createDevelopedChannel(c(n));while(m.time<t-1e-12)m.step(Math.min(m.safeDt*f,t-m.time),false);return Math.sqrt(m.snapshot().velocity.reduce((sum,v,j)=>sum+(v-exact[j])**2,0)/n);});for(let i=0;i<2;i++)assert.ok(errors[i]/errors[i+1]>1.95&&errors[i]/errors[i+1]<2.05);
});
test('periodic thermal diffusion converges to the continuum Fourier decay with grid refinement',()=>{
 const errors=[];for(const nx of[16,32,64]){const ny=8,initial=Array.from({length:nx*ny},(_,n)=>300+5*Math.cos(2*Math.PI*(n%nx+.5)/nx)),m=createDevelopedChannel({...c(ny),nx,acceleration:0,initial}),t=.02;while(m.time<t-1e-12)m.step(Math.min(m.safeDt*.01,t-m.time),false);const s=m.snapshot();errors.push(Math.sqrt(s.temperature.reduce((sum,v,n)=>sum+(v-300-5*Math.exp(-.2*(2*Math.PI)**2*t)*Math.cos(2*Math.PI*(n%nx+.5)/nx))**2,0)/(nx*ny)));near(s.energyError,0,1e-9);}
 assert.ok(errors[0]/errors[1]>3.5&&errors[1]/errors[2]>3.5);
});
test('CFL speed bound covers acceleration of a nonzero initial profile rather than just its initial maximum',()=>{
 const initialVelocity=Array(16).fill(1),m=createDevelopedChannel({...c(),initialVelocity}),s=run(m,.01);assert.ok(Math.max(...s.velocity)>1,'the initial maximum is not an upper bound once the drive accelerates a flat profile');assert.ok(s.velocityBound>=s.maxVelocity);assert.ok(s.velocityBound>=1.125);assert.ok(s.advectionCfl<1);assert.ok(s.maxAdvectionCfl>=s.advectionCfl);assert.ok(s.cellPecletBound>=s.cellPeclet);near(s.momentumError,0,1e-10);
});
