import test from 'node:test';import assert from 'node:assert/strict';
import {createCavity} from '../dynamic/dev/cavity.mjs';import {manufacturedCavity} from '../dynamic/dev/manufactured-cavity.mjs';
const config=n=>({nx:n,ny:n,width:1,height:1,rho:1,cp:1,nu:1,alpha:.2,initial:300,leftTemperature:300,rightTemperature:300,scalarScheme:'central',pressureTolerance:1e-11,maxPressureIterations:4000}),rms=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length);
function errors(n){const exact=manufacturedCavity(),m=createCavity(config(n),exact);while(m.time<.025-1e-13)m.step(Math.min(m.safeDt,.025-m.time),false);const s=m.snapshot(),u=[],v=[],p=[],T=[];
 for(let j=0;j<n;j++)for(let i=0;i<=n;i++)u.push(s.u[j*(n+1)+i]-exact.velocity(i/n,(j+.5)/n,s.time)[0]);for(let j=0;j<=n;j++)for(let i=0;i<n;i++)v.push(s.v[j*n+i]-exact.velocity((i+.5)/n,j/n,s.time)[1]);for(let j=0;j<n;j++)for(let i=0;i<n;i++){p.push(s.pressure[j*n+i]-exact.pressure((i+.5)/n,(j+.5)/n,s.time));T.push(s.temperature[j*n+i]-exact.temperature((i+.5)/n,(j+.5)/n,s.time));}return {u:rms(u),v:rms(v),pressure:rms(p),temperature:rms(T),snapshot:s};
}
test('whole manufactured velocity, gauge-pressure and temperature fields converge on three grids',()=>{
 const e=[8,16,32].map(errors);for(const key of ['u','v','pressure','temperature']){assert.ok(e[0][key]/e[1][key]>3.5,key);assert.ok(e[1][key]/e[2][key]>3.5,key);}for(const row of e){assert.ok(row.snapshot.divergence<1e-8);assert.ok(Math.abs(row.snapshot.energyError)<1e-8);}
 // This is a convergence gate, not a pressure-accuracy release gate. The exact
 // pressure RMS is ~0.049 Pa; 32 cells still have ~0.0133 Pa RMS error.
 assert.ok(e[2].pressure<.014,'pressure convergence budget for this coarse code-verification case, not a release threshold');
});
test('manufactured forces agree with independently differenced continuous PDE derivatives',()=>{
 const exact=manufacturedCavity(),h=2e-4;
 for(const [x,y,t]of [[.13,.37,.019],[.66,.28,.01],[.45,.79,.023]]){
  const f=(x,y,t)=>exact.fields(x,y,t),c=f(x,y,t),xp=f(x+h,y,t),xm=f(x-h,y,t),yp=f(x,y+h,t),ym=f(x,y-h,t),tp=f(x,y,t+h),tm=f(x,y,t-h),d=(a,b)=>(a-b)/(2*h),lap=(a,b,c0,d0,e)=>(a+b+d0+e-4*c0)/h**2;
  for(let k=0;k<2;k++){const value=d(tp.velocity[k],tm.velocity[k])+c.velocity[0]*d(xp.velocity[k],xm.velocity[k])+c.velocity[1]*d(yp.velocity[k],ym.velocity[k])+(k?d(yp.pressure,ym.pressure):d(xp.pressure,xm.pressure))-lap(xp.velocity[k],xm.velocity[k],c.velocity[k],yp.velocity[k],ym.velocity[k]);assert.ok(Math.abs(value-c.bodyForce[k])<.0002);}
  const heat=d(tp.temperature,tm.temperature)+c.velocity[0]*d(xp.temperature,xm.temperature)+c.velocity[1]*d(yp.temperature,ym.temperature)-.2*lap(xp.temperature,xm.temperature,c.temperature,yp.temperature,ym.temperature);assert.ok(Math.abs(heat-c.heatSource)<.00002);
 }
});
test('constant body acceleration recovers a linear gauge pressure without spurious closed-cavity motion',()=>{
 for(const rho of [.3,1,7]){const n=8,exact={velocity:()=>[0,0],temperature:()=>300,pressure:()=>0,bodyForce:()=>[1/rho,0],heatSource:()=>0},m=createCavity({...config(n),rho},exact),s=m.step(.001);assert.ok(Math.max(...s.u.map(Math.abs),...s.v.map(Math.abs))<1e-12);for(let j=0;j<n;j++)for(let i=0;i<n;i++)assert.ok(Math.abs(s.pressure[j*n+i]-((i+.5)/n-.5))<1e-11);}
});
test('invalid manufactured source or temperature fails before any model state is changed',()=>{
 const exact=manufacturedCavity();assert.throws(()=>createCavity(config(8),{...exact,temperature:()=>0}));assert.throws(()=>createCavity({...config(8),lidVelocity:1},exact));assert.throws(()=>createCavity(config(8),{bodyForce:()=>[0,0]}));
 for(const bad of [{bodyForce:()=>[NaN,0]},{heatSource:()=>Infinity}]){const m=createCavity(config(8),{...exact,...bad}),before=m.snapshot();assert.throws(()=>m.step(m.safeDt));assert.deepEqual(m.snapshot(),before);}
});
test('zero-velocity manufactured pressure recovers the independently derived staggered gradient factor',()=>{
 const n=16,exact=manufacturedCavity({velocityAmplitude:0}),m=createCavity({...config(n),pressureTolerance:1e-12},exact),s=m.step(m.safeDt/2),factor=(Math.PI/n)/Math.sin(Math.PI/n);assert.ok(Math.max(...s.u.map(Math.abs),...s.v.map(Math.abs))<1e-13);
 // Explicit body-force RHS was sampled at old time 0. Continuous face
 // gradients differ from central differences of cell cosines by this sinc.
 for(let j=0;j<n;j++)for(let i=0;i<n;i++)assert.ok(Math.abs(s.pressure[j*n+i]-factor*exact.pressure((i+.5)/n,(j+.5)/n,0))<3e-11);
});
test('manufactured-law identity and declared PDE parameters prevent wrong-law replay',()=>{
 const cfg=config(8),a=createCavity(cfg,manufacturedCavity()),b=createCavity(cfg,manufacturedCavity({velocityAmplitude:.1})),before=b.snapshot();assert.throws(()=>b.restore(a.snapshot()),/一致/);assert.deepEqual(b.snapshot(),before);const same=createCavity(cfg,manufacturedCavity({velocityAmplitude:.1}));same.restore(b.snapshot());assert.deepEqual(same.snapshot(),before);
 assert.throws(()=>createCavity({...cfg,nu:.5},manufacturedCavity()),/一致/);assert.throws(()=>createCavity({...cfg,width:1.5},manufacturedCavity()),/一致/);assert.throws(()=>manufacturedCavity({velocityAmplitude:NaN}));
 const custom={velocity:()=>[0,0],temperature:()=>300,pressure:()=>0,bodyForce:()=>[0,0],heatSource:()=>1},one=createCavity(cfg,custom),two=createCavity(cfg,{...custom,heatSource:()=>2}),seed=one.snapshot();one.step(one.safeDt);assert.throws(()=>two.restore(one.snapshot()),/一致/);one.restore(seed);assert.deepEqual(one.snapshot(),seed);
});
