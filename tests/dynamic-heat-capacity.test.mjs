import test from 'node:test';import assert from 'node:assert/strict';
import {heatCapacityTable} from '../dynamic/properties.mjs';import {createThermal} from '../dynamic/thermal.mjs';
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`),table=[[290,1.9],[300,2],[350,2.5]],config=(extra={})=>({nx:10,ny:1,width:1,height:1,depth:1,materials:[{k:1,rho:1,cp:2,cpTable:table}],initial:300,...extra});
const advance=(m,t,dt=m.safeDt)=>{while(m.time<t-1e-12)m.step(Math.min(dt,t-m.time),false);return m.snapshot();};
test('piecewise-linear cp integrates exactly and inverts rising, falling and constant segments',()=>{
 const p=heatCapacityTable([[300,2],[320,4],[340,3],[350,3]]);near(p.enthalpy(300),0);near(p.enthalpy(320),60);near(p.enthalpy(330),97.5);near(p.enthalpy(340),130);near(p.enthalpy(350),160);assert.equal(p.minValue,2);
 for(let i=0;i<=500;i++){const T=300+i/10;near(p.temperature(p.enthalpy(T)),T,1e-11);}for(const h of [-1,161,NaN,Infinity])assert.throws(()=>p.temperature(h),/範囲/);assert.throws(()=>p.enthalpy(351),/範囲/);
 const original=[[300,2],[400,2]],copy=heatCapacityTable(original);original[1][1]=999;near(copy.temperature(100),350);
});
test('uniform heating and cooling match an independently inverted quadratic enthalpy instead of cp(T) times deltaT',()=>{
 for(const [start,source] of [[300,10],[340,-5]])for(const factor of [1,.25]){
  const m=createThermal(config({initial:start,source})),s=advance(m,2,m.safeDt*factor),theta=start-300,target=2*theta+.005*theta**2+2*source,expected=300+2*target/(2+Math.sqrt(4+.02*target));
  s.temperature.forEach(t=>near(t,expected,1e-9));near(s.netInput,2*source,1e-10);near(s.energyError,0,2e-9);
 }
});
test('an insulated nonuniform body equilibrates according to integrated enthalpy, not arithmetic mean temperature',()=>{
 const m=createThermal(config({nx:2,initial:[300,340]})),s=advance(m,12),target=(0+2*40+.005*40**2)/2,expected=300+2*target/(2+Math.sqrt(4+.02*target));
 s.temperature.forEach(t=>near(t,expected,1e-7));assert.ok(Math.abs(expected-320)>.8);near(s.energyError,0,1e-9);
});
test('constant cp tables reproduce constant-property temperatures and stable steps',()=>{
 const plain=createThermal(config({materials:[{k:1,rho:2,cp:3}],boundaries:{left:{type:'temperature',temperature:320}}})),tabulated=createThermal(config({materials:[{k:1,rho:2,cp:3,cpTable:[[280,3],[350,3]]}],boundaries:{left:{type:'temperature',temperature:320}}}));
 near(plain.safeDt,tabulated.safeDt);const a=advance(plain,.4),b=advance(tabulated,.4);a.temperature.forEach((t,i)=>near(t,b.temperature[i],1e-10));near(a.netInput,b.netInput,1e-10);near(b.energyError,0,1e-8);
});
test('variable k and cp share a conservative update and reach the independent Kirchhoff steady profile',()=>{
 const n=20,m=createThermal(config({nx:n,materials:[{k:1,rho:1,cp:2,cpTable:table,kTable:[[290,.5],[300,1],[320,2]]}],boundaries:{left:{type:'temperature',temperature:320},right:{type:'temperature',temperature:300}}})),s=advance(m,6);
 s.temperature.forEach((t,i)=>{const potential=30*(1-(i+.5)/n);near(t,300+2*potential/(1+Math.sqrt(1+.1*potential)),.025);});near(s.energyError,0,1e-8);
});
test('out-of-range cp enthalpy and restored state fail without changing temperatures, clock or energy',()=>{
 const m=createThermal(config({source:1e8})),before=m.snapshot();assert.throws(()=>m.step(m.safeDt),/物性表の範囲/);assert.deepEqual(m.snapshot(),before);assert.throws(()=>m.restore({...before,temperature:Array(10).fill(400)}),/範囲/);assert.deepEqual(m.snapshot(),before);assert.throws(()=>createThermal(config({initial:280})),/範囲/);
 const wall=createThermal(config({boundaries:{left:{type:'temperature',temperature:400}}})),wallBefore=wall.snapshot();assert.throws(()=>wall.step(wall.safeDt),/範囲/);assert.deepEqual(wall.snapshot(),wallBefore);
 const valid=createThermal(config({source:2}));valid.step(.001);const a=valid.snapshot();valid.step(.001);const b=valid.snapshot();valid.restore(a);valid.step(.001);assert.deepEqual(valid.snapshot(),b);
});
