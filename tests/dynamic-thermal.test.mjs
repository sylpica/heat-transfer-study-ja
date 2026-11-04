import {execFileSync} from 'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';
import {createThermal,SIGMA} from '../dynamic/thermal.mjs';
import {polygon,rasterize,rectangle,circle} from '../dynamic/geometry.mjs';
const config=(extra={})=>({nx:10,ny:1,width:1,height:1,depth:1,materials:[{k:1,rho:1,cp:1}],initial:300,...extra});
function advance(m,t,dt=m.safeDt){while(m.snapshot().time<t-1e-12)m.step(Math.min(dt,t-m.snapshot().time));return m.snapshot();}
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
test('dynamic FVM preserves a uniform insulated field and adds exactly the specified volumetric energy',()=>{
 for(const source of [0,2,-2]){const m=createThermal(config({source})),s=advance(m,.2);for(const T of s.temperature)near(T,300+source*.2);near(s.energyError,0,1e-10);near(s.netInput,source*.2,1e-10);}
});
test('positive inward Neumann heat enters once at each exterior face and internal fluxes cancel',()=>{
 const m=createThermal(config({nx:8,ny:6,boundaries:{left:{type:'flux',flux:2},top:{type:'flux',flux:3}}})),s=advance(m,.03);near(s.netInput,5*.03);near(s.energyError,0,1e-10);assert.ok(s.max>s.min);
});
test('Dirichlet boundary uses half-cell resistances and reaches the exact cell-centred linear profile',()=>{
 const m=createThermal(config({nx:12,boundaries:{left:{type:'temperature',temperature:320},right:{type:'temperature',temperature:300}}}));const s=advance(m,2);
 for(let i=0;i<12;i++)near(s.temperature[i],320-20*(i+.5)/12,1e-6);near(s.energyError,0,1e-9);const q=m.flux();for(const v of q.x)near(v,20,1e-5);
});
test('composite wall interface and contact jump match an independent series-resistance solution',()=>{
 const mats=[{k:1,rho:1,cp:1},{k:4,rho:1,cp:1}],Rc=.2,m=createThermal(config({nx:10,materials:mats,regions:[{points:rectangle(.5,0,.5,1),material:1}],contactResistance:Rc,boundaries:{left:{type:'temperature',temperature:320},right:{type:'temperature',temperature:300}}}));
 const s=advance(m,3),q=20/(.5/1+.5/4+Rc);
 for(let i=0;i<10;i++){const x=(i+.5)/10,expected=x<.5?320-q*x:320-q*(.5+Rc+(x-.5)/4);near(s.temperature[i],expected,2e-6);}
 near(s.energyError,0,1e-8);for(const value of m.flux().x)near(value,q,1e-4);
});
test('convective face solves the half-cell conduction resistance in series with film resistance',()=>{
 const m=createThermal(config({nx:1,boundaries:{left:{type:'convection',h:2,temperature:320}}}));m.step(.1);near(m.snapshot().temperature[0],302);near(m.snapshot().netInput,2);near(m.snapshot().energyError,0,1e-10);
});
test('nonlinear radiation uses Kelvin and the face temperature with a conservative equal-sign energy balance',()=>{
 const m=createThermal(config({nx:1,initial:400,boundaries:{left:{type:'radiation',temperature:300,emissivity:.8}}}));const dt=.0001,s=m.step(dt),q=-s.netInput/dt,face=400-q/2;
 near(q,.8*SIGMA*(face**4-300**4),1e-8);assert.ok(face>300&&face<400);near(s.energyError,0,1e-10);
 const equal=createThermal(config({initial:300,boundaries:{left:{type:'radiation',temperature:300,emissivity:1}}}));advance(equal,.01);equal.snapshot().temperature.forEach(t=>near(t,300));
});
function sineError(n,stepFactor){const initial=Array.from({length:n},(_,i)=>300+Math.cos(Math.PI*(i+.5)/n)),m=createThermal(config({nx:n,initial})),t=.1,s=advance(m,t,m.safeDt*stepFactor);return Math.sqrt(s.temperature.reduce((sum,v,i)=>sum+(v-300-Math.exp(-(Math.PI**2)*t)*Math.cos(Math.PI*(i+.5)/n))**2,0)/n);}
test('space and time refinements converge to the insulated cosine eigenmode independently of the stencil',()=>{
 const errors=[10,20,40].map(n=>sineError(n,.1));assert.ok(errors[1]<errors[0]/3.5);assert.ok(errors[2]<errors[1]/3.5);assert.ok(errors[2]<.0002);
 // Isolate time error by using the exact semi-discrete eigenvalue at one fixed mesh.
 const n=12,lambda=4*Math.sin(Math.PI/(2*n))**2*n*n,initial=Array.from({length:n},(_,i)=>300+Math.cos(Math.PI*(i+.5)/n));
 const timeErrors=[.8,.4,.2].map(f=>{const m=createThermal(config({nx:n,initial})),s=advance(m,.1,m.safeDt*f);return Math.abs((s.temperature[0]-300)-Math.exp(-lambda*.1)*Math.cos(Math.PI/(2*n)));});
 assert.ok(timeErrors[1]<timeErrors[0]*.55);assert.ok(timeErrors[2]<timeErrors[1]*.55);
});
test('slender fin distributed surface loss approaches the cosh solution and balances heat',()=>{
 const n=50,k=10,h=2,PoverA=4,Tb=330,Ta=300,L=1,mpar=Math.sqrt(h*PoverA/k),m=createThermal(config({nx:n,materials:[{k,rho:1,cp:1}],distributedConvection:{h,areaPerVolume:PoverA,temperature:Ta},boundaries:{left:{type:'temperature',temperature:Tb}}}));
 const s=advance(m,1);for(let i=0;i<n;i++){const x=(i+.5)/n;near(s.temperature[i],Ta+(Tb-Ta)*Math.cosh(mpar*(L-x))/Math.cosh(mpar*L),.003);}near(s.energyError,0,1e-8);
});
test('invalid mesh, properties, absolute temperature and unstable step fail without mutating a valid state',()=>{
 for(const c of [config({nx:0}),config({initial:0}),config({materials:[{k:-1,rho:1,cp:1}]}),config({boundaries:{left:{type:'radiation',temperature:300,emissivity:1.1}}}),config({regions:[{points:rectangle(0,0,.3,1),material:5}]})])assert.throws(()=>createThermal(c));
 const m=createThermal(config({boundaries:{left:{type:'temperature',temperature:400}}})),before=m.snapshot();assert.throws(()=>m.step(m.safeDt*1.1));assert.deepEqual(m.snapshot(),before);
 const bad=createThermal(config({source:-1e20}));assert.throws(()=>bad.step(.1));assert.equal(bad.snapshot().time,0);
});
test('checkpoint rewind restores stored forward states and recovers the same next forward result',()=>{
 const m=createThermal(config({source:1}));m.step(.001);const a=m.snapshot();m.step(.001);const b=m.snapshot();m.restore(a);m.step(.001);assert.deepEqual(m.snapshot(),b);
});
test('geometry validates crossings, duplicate/degenerate edges and raster connectivity with explicit repair notes',()=>{
 assert.throws(()=>polygon([[0,0],[1,1],[0,1],[1,0]]),/自己交差/);assert.throws(()=>polygon([[0,0],[0,0],[1,1]]),/重複/);
 const p=polygon([...rectangle(0,0,1,1),[0,0]]);assert.equal(p.repaired.length,1);near(p.area,1);
 const shape=rasterize({nx:40,ny:40,width:1,height:1,outline:circle(.5,.5,.4)});assert.ok(Math.abs(shape.area-Math.PI*.4**2)<.01);assert.ok(shape.count>0);
 assert.throws(()=>rasterize({nx:4,ny:4,width:1,height:1,outline:rectangle(.01,.01,.001,.001)}),/解像/);
});

test('two-dimensional eigenmode benchmark records independently measured second-order space and first-order time convergence',async()=>{
 const result=JSON.parse(execFileSync(process.execPath,['scripts/dynamic-benchmarks.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}));
 assert.ok(result.spaceObservedOrders.every(v=>v>1.8&&v<2.2));assert.ok(result.timeObservedOrders.every(v=>v>.95&&v<1.1));
 assert.ok(result.space.every(row=>Math.abs(row.energyErrorJ)<1e-10));
});
