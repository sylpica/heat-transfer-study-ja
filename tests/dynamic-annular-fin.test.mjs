import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createAnnularFin} from '../dynamic/dev/annular-fin.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/ANNULAR_FIN_REFERENCE_20261107.json',import.meta.url)));
const cases=Object.fromEntries(reference.cases.map(c=>[c.name,c]));
function config(cells,extra={}){const c=cases.convection.config;return {innerRadius:c.innerRadius,outerRadius:c.outerRadius,thickness:c.thickness,cells,k:c.k,rho:c.rho,cp:c.cp,h:c.h,baseTemperature:c.baseK,ambient:c.ambientK,initial:c.initialK,tipCondition:c.tipCondition,...extra};}
function advance(model,target,dt=model.safeDt){while(model.time<target)model.step(Math.min(dt,target-model.time),false);return model.snapshot();}
function steady(model){let prev=model.snapshot();for(let guard=0;guard<20000;guard++){for(let j=0;j<256;j++)model.step(model.safeDt,false);const s=model.snapshot(),d=Math.max(...s.temperature.map((v,i)=>Math.abs(v-prev.temperature[i])));if(d<1e-9)return s;prev=s;}throw Error('定常へ到達しませんでした。');}
const rms=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length);

test('generator provenance and Bessel balance are recorded',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-annular-fin-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);
 for(const c of reference.cases)assert.ok(c.besselSteady.balanceDifferenceW<1e-35);
 assert.equal(reference.releaseApproved,false);
});

test('steady state matches the 50-digit Bessel cell averages and the discrete network steady state',t=>{
 const measured={};
 for(const name of ['convection','corrected']){
  const errors={};
  for(const n of [16,32,64]){
   const m=createAnnularFin(config(n,{tipCondition:name})),s=steady(m),ref=cases[name];
   const cellAvg=ref.besselSteady.cellAverageK[String(n)],disc=ref.discreteSteadyK[String(n)];
   assert.ok(rms(s.temperature,disc)<1e-7,`${name} n=${n} discrete steady`);
   errors[n]=rms(s.temperature,cellAvg);
   if(n===32){
    assert.ok(Math.abs(s.efficiency-ref.besselSteady.efficiency)<2e-3,`${name} efficiency`);
    assert.ok(Math.abs(s.effectiveness-ref.besselSteady.effectiveness)<5e-2,`${name} effectiveness`);
    assert.ok(Math.abs(s.baseHeatRateW-ref.besselSteady.basePowerW)<2e-1,`${name} base power`);
    assert.ok(Math.abs(s.totalLossW-s.baseHeatRateW)<1e-6,'steady base/loss balance');
   }
  }
  const orders=[16,32].map(n=>Math.log2(errors[n]/errors[2*n]));
  measured[name]={rmsK:errors,orders};
  assert.ok(orders.every(p=>p>1.8&&p<2.2),`${name} spatial order ${orders}`);
 }
 t.diagnostic(JSON.stringify(measured));
});

test('transient matches the independent matrix-exponential network at 2 s',t=>{
 const measured={};
 for(const name of ['convection','corrected']){
  const ref=cases[name],m=createAnnularFin(config(ref.discreteTransient.cells,{tipCondition:name}));
  const s=advance(m,ref.discreteTransient.timeS,.5*m.safeDt),exact=ref.discreteTransient.temperatureK;
  const errs=s.temperature.map((v,i)=>Math.abs(v-exact[i]));
  measured[name]={maxK:Math.max(...errs),rmsK:rms(s.temperature,exact)};
  assert.ok(Math.max(...errs)<.02,`${name} transient max`);
  assert.ok(Math.abs(s.energyError)<=s.energyRoundoffBudgetJ);
 }
 t.diagnostic(JSON.stringify(measured));
});

test('Euler time refinement is first order against the same-grid matrix exponential',t=>{
 const ref=cases.convection,exact=ref.discreteTransient.temperatureK;
 const result=[1,.5,.25].map(f=>{const m=createAnnularFin(config(ref.discreteTransient.cells));return rms(advance(m,ref.discreteTransient.timeS,f*m.safeDt).temperature,exact);});
 const orders=result.slice(1).map((e,i)=>Math.log2(result[i]/e));
 assert.ok(orders.every(p=>p>.9&&p<1.15),`time orders ${orders}`);
 t.diagnostic(JSON.stringify({timeRmsK:result,timeOrders:orders}));
});

test('energy budget: base inflow minus surface loss equals storage change',()=>{
 const m=createAnnularFin(config(16)),s=advance(m,3);
 assert.ok(Math.abs(s.energyError)<1e-8);assert.ok(Math.abs(s.energyError)<=s.energyRoundoffBudgetJ);
 assert.ok(Math.abs(s.energyChange-(s.energy-s.initialEnergy))<1e-9);
 const q=m.snapshot();assert.ok(q.baseHeatRateW>q.totalLossW,'加熱過渡では基部流入が表面損失を上回る');
});

test('limits: vanishing length gives unit efficiency; large radius approaches the straight fin',t=>{
 const thin=reference.limits.find(l=>l.config.outerRadius===0.011);
 const mThin=createAnnularFin({innerRadius:thin.config.innerRadius,outerRadius:thin.config.outerRadius,thickness:thin.config.thickness,cells:16,k:thin.config.k,rho:thin.config.rho,cp:thin.config.cp,h:thin.config.h,baseTemperature:thin.config.baseK,ambient:thin.config.ambientK,initial:thin.config.initialK,tipCondition:'corrected'});
 const sThin=steady(mThin);assert.ok(Math.abs(sThin.efficiency-thin.besselEfficiency)<2e-3);assert.ok(sThin.efficiency>.998);
 const diffs=[];
 for(const lim of reference.limits.filter(l=>l.straightFinEfficiency!==null)){
  const c=lim.config,m=createAnnularFin({innerRadius:c.innerRadius,outerRadius:c.outerRadius,thickness:c.thickness,cells:32,k:c.k,rho:c.rho,cp:c.cp,h:c.h,baseTemperature:c.baseK,ambient:c.ambientK,initial:c.initialK,tipCondition:'corrected'});
  const s=steady(m);assert.ok(Math.abs(s.efficiency-lim.besselEfficiency)<2e-3,`r1=${c.innerRadius} Bessel eta`);
  diffs.push(Math.abs(s.efficiency-lim.straightFinEfficiency));
 }
 assert.ok(diffs[1]<diffs[0]&&diffs[1]<.01,'曲率が下がると直線フィンへ近づく');
 t.diagnostic(JSON.stringify({thinEfficiency:sThin.efficiency,straightFinDifferences:diffs}));
});

test('failed timesteps and inconsistent restores never change the accepted state',()=>{
 const m=createAnnularFin(config(16)),zero=m.snapshot();advance(m,.1);const saved=m.snapshot(),end=advance(m,.2);
 m.restore(saved);assert.deepEqual(advance(m,.2),end);
 for(const dt of [0,-1,Infinity,NaN,m.safeDt*2]){const before=m.snapshot();assert.throws(()=>m.step(dt));assert.deepEqual(m.snapshot(),before);}
 const bad=[{...saved,signature:'other'},{...saved,time:-1},{...saved,steps:0},{...saved,netInput:saved.netInput+1},{...saved,netInputCompensation:Infinity}];
 const nan=structuredClone(saved);nan.temperature[0]=NaN;bad.push(nan);
 const inconsistent=structuredClone(zero);inconsistent.temperature[0]+=.1;bad.push(inconsistent);
 for(const state of bad){const before=m.snapshot();assert.throws(()=>m.restore(state));assert.deepEqual(m.snapshot(),before);}
 m.restore(zero);assert.deepEqual(m.snapshot(),zero);
});

test('invalid geometry, unsupported physics and unresolved scales are rejected atomically',()=>{
 for(const patch of [{innerRadius:0},{innerRadius:.03},{outerRadius:.01},{outerRadius:Infinity},{thickness:0},{cells:3},{cells:257},{cells:4.5},{h:-1},{h:1e8},{k:0},{cp:-1},{rho:NaN},{baseTemperature:0},{ambient:-5},{initial:NaN},{initial:[300,300]},{tipCondition:'adiabatic'},{source:1},{radiation:true},{materials:[]},{maxTemperature:300}])assert.throws(()=>createAnnularFin(config(16,patch)),JSON.stringify(patch));
 const c=config(16),m=createAnnularFin(c);c.h=999;const copy=m.config;copy.innerRadius=9;
 assert.equal(m.config.h,150);assert.equal(m.config.innerRadius,.01);
 const s=m.snapshot();assert.equal(s.releaseApproved,false);assert.equal(s.assumptions.radiationIncluded,false);assert.equal(s.assumptions.twoDimensionalConductionResolved,false);
 assert.equal(m.mesh.correctedOuterRadius,null);
 const mc=createAnnularFin(config(16,{tipCondition:'corrected'}));assert.ok(Math.abs(mc.mesh.correctedOuterRadius-(0.03+0.001))<1e-15);
});
