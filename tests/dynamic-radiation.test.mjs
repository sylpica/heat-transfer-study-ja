import test from 'node:test';import assert from 'node:assert/strict';
import {createRadiationNetwork} from '../dynamic/radiation-network.mjs';
const sigma=5.670374419e-8,near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const surface=(temperature,emissivity=.8,extra={})=>({area:1,capacity:100,temperature,emissivity,...extra});
const plates=(extra={})=>({surfaces:[surface(600),surface(300,.6)],viewFactors:[[0,1],[1,0]],maxTemperature:1000,...extra});
function advance(m,end,dt=m.safeDt){while(m.time<end-1e-12)m.step(Math.min(dt,end-m.time),false);return m.snapshot();}

test('two diffuse-gray plates match the independently derived surface/space resistance network',()=>{
 for(const [a,e1,e2] of [[1,.8,.6],[2,1,1],[.5,.2,.9]]){
  const m=createRadiationNetwork(plates({surfaces:[surface(600,e1,{area:a}),surface(300,e2,{area:a})]})),s=m.snapshot(),q=a*sigma*(600**4-300**4)/(1/e1+1/e2-1);
  near(s.outwardPower[0],q,1e-9);near(s.outwardPower[1],-q,1e-9);near(s.radiationBalance,0,1e-10);assert.ok(s.linearResidual<1e-12);
 }
});
test('self-viewing outer surface matches the unequal-area enclosure resistance, including perfect reflection',()=>{
 const s=createRadiationNetwork(plates({surfaces:[surface(500,.7),surface(300,.4,{area:4})],viewFactors:[[0,1],[.25,.75]]})).snapshot(),q=sigma*(500**4-300**4)/((1-.7)/.7+1+(1-.4)/(.4*4));near(s.outwardPower[0],q,1e-9);near(s.outwardPower[1],-q,1e-9);
 const mirror=createRadiationNetwork(plates({surfaces:[surface(600,0),surface(300,.5)]})).snapshot();mirror.outwardPower.forEach(q=>near(q,0));near(mirror.radiosity[0],sigma*300**4,1e-10);
});
test('three black faces obey each independent weighted Stefan-Boltzmann balance and the isothermal limit',()=>{
 const T=[300,400,500],F=[[0,.5,.5],[.5,0,.5],[.5,.5,0]],s=createRadiationNetwork({surfaces:T.map(t=>surface(t,1)),viewFactors:F}).snapshot();
 for(let i=0;i<3;i++)near(s.outwardPower[i],sigma*(T[i]**4-.5*(T[(i+1)%3]**4+T[(i+2)%3]**4)),1e-9);near(s.radiationBalance,0,1e-9);
 for(const t of [1,300,1000]){const equal=createRadiationNetwork({surfaces:[surface(t,0),surface(t,.3),surface(t,1)],viewFactors:F}).snapshot();equal.outwardPower.forEach(q=>assert.equal(q,0));}
 // Near-equilibrium exchange uses a factored fourth-power difference.
 const t=300+1e-8,s2=createRadiationNetwork(plates({surfaces:[surface(t),surface(300,.6)]})).snapshot();near(s2.outwardPower[0],sigma*(t-300)*(t+300)*(t*t+300**2)/(1/.8+1/.6-1),1e-15);
});
test('time integration conserves closed-system energy and reaches the heat-capacity-weighted equilibrium',()=>{
 const m=createRadiationNetwork(plates({surfaces:[surface(600,.8,{capacity:10}),surface(300,.6,{capacity:20})]})),s=advance(m,100);near(s.temperature[0],400,1e-7);near(s.temperature[1],400,1e-7);near(s.energyError,0,2e-9);assert.ok(s.relativeEnergyError<1e-12);
 const heated=createRadiationNetwork(plates({surfaces:[surface(300,.8,{power:10}),surface(300,.6,{power:10})]})),h=advance(heated,2);h.temperature.forEach(t=>near(t,300.2,1e-10));near(h.netInput,40);near(h.energyError,0,1e-8);
});
test('Heun transients have second-order temporal refinement against an independent two-body RK4 solution',()=>{
 const f=t=>{const q=sigma*(t[0]**4-t[1]**4)/(1/.8+1/.6-1);return [-q/100,q/100];};let ref=[600,300],h=.0001;
 for(let i=0;i<20000;i++){const a=f(ref),b=f(ref.map((v,j)=>v+h*a[j]/2)),c=f(ref.map((v,j)=>v+h*b[j]/2)),d=f(ref.map((v,j)=>v+h*c[j]));ref=ref.map((v,j)=>v+h*(a[j]+2*b[j]+2*c[j]+d[j])/6);}
 const errors=[.04,.02,.01].map(dt=>Math.abs(advance(createRadiationNetwork(plates()),2,dt).temperature[0]-ref[0]));assert.ok(errors[0]/errors[1]>3.8&&errors[1]/errors[2]>3.8);assert.ok(errors[2]<.0001);
});
test('invalid enclosure geometry, mirror singularity and failed timesteps are rejected atomically',()=>{
 for(const c of [plates({viewFactors:[[0,.9],[1,0]]}),plates({viewFactors:[[0,1],[.5,.5]]}),plates({viewFactors:[[0,1],[-.1,1.1]]}),plates({surfaces:[surface(300,0),surface(400,0)]}),plates({surfaces:[surface(0),surface(300)]}),plates({surfaces:[surface(300,1.1),surface(400)]}),plates({surfaces:[surface(300,.8,{capacity:0}),surface(400)]})])assert.throws(()=>createRadiationNetwork(c));
 const disconnected={surfaces:[surface(300),surface(400),surface(300,0),surface(400,0)],viewFactors:[[0,1,0,0],[1,0,0,0],[0,0,0,1],[0,0,1,0]]};assert.throws(()=>createRadiationNetwork(disconnected),/特異|悪条件/);
 const m=createRadiationNetwork(plates()),before=m.snapshot();assert.throws(()=>m.step(m.safeDt*1.1),/安定性/);assert.deepEqual(m.snapshot(),before);assert.throws(()=>m.restore({...before,temperature:[300,0]}));assert.deepEqual(m.snapshot(),before);
 m.step(.01);const a=m.snapshot();m.step(.01);const b=m.snapshot();m.restore(a);m.step(.01);assert.deepEqual(m.snapshot(),b);
 const explosive=createRadiationNetwork(plates({surfaces:[surface(300,.8,{power:1e12}),surface(300)]})),s=explosive.snapshot();assert.throws(()=>explosive.step(.001),/監視上限/);assert.deepEqual(explosive.snapshot(),s);
});
