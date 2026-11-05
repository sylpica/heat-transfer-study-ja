import test from 'node:test';import assert from 'node:assert/strict';
import {createCavity} from '../dynamic/dev/cavity.mjs';import {manufacturedCavity} from '../dynamic/dev/manufactured-cavity.mjs';import {prepareWallClosureShadow} from '../scripts/lib/wall-closure-shadow.mjs';
const study=await prepareWallClosureShadow({advectionSecondOrder:false,viscositySecondOrder:true,cornersOnly:true}),cfg={nx:8,ny:8,width:1,height:1,rho:1,cp:1,nu:.01,alpha:.01,initial:300,pressurePreconditioner:'multigrid',pressureTolerance:1e-12,maxPressureIterations:4000},near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('corner diagnostic retains the original polynomial equations when tangential wall data are continuous',()=>{
 const common={...cfg,nu:1,alpha:.2,leftTemperature:300,rightTemperature:300,scalarScheme:'central'},a=createCavity({...common,momentumScheme:'polynomial4'},manufacturedCavity()),b=study.createCavity({...common,momentumScheme:study.variant},manufacturedCavity());
 for(let i=0;i<10;i++){a.step(.0001,false);b.step(.0001,false);}const x=a.snapshot(),y=b.snapshot();for(const key of ['u','v','pressure','temperature','energy','netInput'])assert.deepEqual(x[key],y[key]);assert.notEqual(x.signature,y.signature);
});
test('active corner handling respects reflection of a moving lid and is distinguished from the unmodified closure',()=>{
 const a=study.createCavity({...cfg,momentumScheme:study.variant,lidVelocity:1}),b=study.createCavity({...cfg,momentumScheme:study.variant,lidVelocity:-1}),original=createCavity({...cfg,momentumScheme:'polynomial4',lidVelocity:1});
 for(let k=0;k<50;k++){a.step(.001,false);b.step(.001,false);original.step(.001,false);}const x=a.snapshot(),y=b.snapshot(),n=8;
 for(let j=0;j<n;j++)for(let i=0;i<=n;i++)near(x.u[j*(n+1)+i],-y.u[j*(n+1)+n-i]);
 for(let j=0;j<=n;j++)for(let i=0;i<n;i++)near(x.v[j*n+i],y.v[j*n+n-1-i]);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++)near(x.pressure[j*n+i],y.pressure[j*n+n-1-i]);
 assert.ok(x.divergence<1e-8&&y.divergence<1e-8);assert.ok(Math.abs(x.energyError)<1e-8);const o=original.snapshot();assert.ok(Math.max(...x.u.map((u,i)=>Math.abs(u-o.u[i])))>1e-8);
});
test('corner study snapshots identify their law and replay without accepting a different momentum closure',async()=>{
 const m=study.createCavity({...cfg,momentumScheme:study.variant,lidVelocity:1}),p=createCavity({...cfg,momentumScheme:'polynomial4',lidVelocity:1}),initial=m.snapshot();assert.throws(()=>m.restore(p.snapshot()),/一致/);assert.deepEqual(m.snapshot(),initial);
 m.step(.001);const next=m.snapshot();m.restore(initial);m.step(.001);assert.deepEqual(m.snapshot(),next);
 await assert.rejects(prepareWallClosureShadow({advectionSecondOrder:true,viscositySecondOrder:true,cornersOnly:true}));
});
