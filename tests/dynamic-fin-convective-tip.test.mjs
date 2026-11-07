import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createStraightFin} from '../dynamic/dev/fin-convective-tip.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/FIN_CONVECTIVE_TIP_REFERENCE_20261107.json',import.meta.url)));
const cases=Object.fromEntries(reference.cases.map(c=>[c.name,c]));
function config(name,cells,extra={}){const c=cases[name].config;return {length:c.length,thickness:c.thickness,depth:c.depth,cells,k:c.k,rho:c.rho,cp:c.cp,h:c.h,baseTemperature:c.baseK,ambient:c.ambientK,initial:c.initialK,tipCondition:c.tipCondition,...extra};}
function advance(model,target,dt=model.safeDt){while(model.time<target)model.step(Math.min(dt,target-model.time),false);return model.snapshot();}
function steady(model){let prev=model.snapshot();for(let guard=0;guard<20000;guard++){for(let j=0;j<256;j++)model.step(model.safeDt,false);const s=model.snapshot(),d=Math.max(...s.temperature.map((v,i)=>Math.abs(v-prev.temperature[i])));if(d<1e-9)return s;prev=s;}throw Error('定常へ到達しませんでした。');}
const rms=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length);

test('generator provenance, analytic balance and Feiris-verified adiabatic values are recorded',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-fin-convective-tip-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);
 for(const c of reference.cases)assert.ok(c.analyticSteady.balanceDifferenceW<1e-35);
 assert.equal(reference.releaseApproved,false);
 const a=cases['canonical-insulated'].analyticSteady,v=reference.feirisVerifiedCanonicalInsulated;
 assert.ok(Math.abs(a.basePowerW-v.basePowerW)<1e-9,'q');
 assert.ok(Math.abs(a.efficiency-v.efficiency)<1e-9,'eta');
 assert.ok(Math.abs(a.effectiveness-v.effectiveness)<1e-7,'epsilon');
});

test('steady state matches the 50-digit analytic cell averages and the discrete network steady state',t=>{
 const measured={};
 for(const name of ['canonical-convection','canonical-insulated']){
  const errors={};
  for(const n of [16,32,64]){
   const m=createStraightFin(config(name,n)),s=steady(m),ref=cases[name];
   const cellAvg=ref.analyticSteady.cellAverageK[String(n)],disc=ref.discreteSteadyK[String(n)];
   assert.ok(rms(s.temperature,disc)<1e-7,`${name} n=${n} discrete steady`);
   errors[n]=rms(s.temperature,cellAvg);
   if(n===32){
    assert.ok(Math.abs(s.efficiency-ref.analyticSteady.efficiency)<2e-3,`${name} efficiency`);
    assert.ok(Math.abs(s.effectiveness-ref.analyticSteady.effectiveness)<5e-2,`${name} effectiveness`);
    assert.ok(Math.abs(s.baseHeatRateW-ref.analyticSteady.basePowerW)<2e-2,`${name} base power`);
    assert.ok(Math.abs(s.totalLossW-s.baseHeatRateW)<1e-6,'steady base/loss balance');
    assert.ok(Math.abs(s.tipCellTemperatureK-cellAvg[n-1])<5e-3,`${name} tip cell vs analytic last-cell average`);
   }
  }
  const orders=[16,32].map(n=>Math.log2(errors[n]/errors[2*n]));
  measured[name]={rmsK:errors,orders};
  assert.ok(orders.every(p=>p>1.7&&p<2.3),`${name} spatial order ${orders}`);
 }
 t.diagnostic(JSON.stringify(measured));
});

test('convective tip carries measurably more heat than the insulated tip at the strong-tip case',t=>{
 const conv=cases['strong-tip-convection'].analyticSteady,ins=cases['strong-tip-insulated'].analyticSteady;
 const sConv=steady(createStraightFin(config('strong-tip-convection',32))),sIns=steady(createStraightFin(config('strong-tip-insulated',32)));
 assert.ok(Math.abs(sConv.baseHeatRateW-conv.basePowerW)<2e-2,'convective q vs analytic');
 assert.ok(Math.abs(sIns.baseHeatRateW-ins.basePowerW)<2e-2,'insulated q vs analytic');
 const gain=(sConv.baseHeatRateW-sIns.baseHeatRateW)/sIns.baseHeatRateW,analyticGain=(conv.basePowerW-ins.basePowerW)/ins.basePowerW;
 assert.ok(gain>0.04&&Math.abs(gain-analyticGain)<2e-3,'tip convection gain');
 assert.ok(sConv.tipLossW>0&&sIns.tipLossW===0,'tip loss only for convection');
 t.diagnostic(JSON.stringify({gain,analyticGain,tipLossW:sConv.tipLossW}));
});

test('corrected length Lc = L + Ac/P reproduces the exact convective-tip heat rate far better than the plain adiabatic formula',t=>{
 for(const name of ['canonical-convection','strong-tip-convection']){
  const cl=cases[name].analyticSteady.correctedLength;
  assert.ok(cl.adiabaticAtLRelativeError>0.01,`${name} plain adiabatic error is not negligible`);
  assert.ok(cl.correctedRelativeError<1e-4,`${name} corrected-length error`);
  assert.ok(cl.correctedRelativeError<cl.adiabaticAtLRelativeError/100,`${name} improvement factor`);
  t.diagnostic(JSON.stringify({case:name,adiabaticAtLRelativeError:cl.adiabaticAtLRelativeError,correctedRelativeError:cl.correctedRelativeError}));
 }
 const s=steady(createStraightFin(config('canonical-convection',64))),exact=cases['canonical-convection'].analyticSteady;
 assert.ok(Math.abs(s.baseHeatRateW-exact.basePowerW)<Math.abs(exact.correctedLength.adiabaticAtLW-exact.basePowerW)/10,'solver tracks the exact solution, not the adiabatic formula');
});

test('transient matches the independent matrix-exponential network',t=>{
 const measured={};
 for(const name of ['canonical-convection','canonical-insulated']){
  const ref=cases[name],m=createStraightFin(config(name,ref.discreteTransient.cells));
  const s=advance(m,ref.discreteTransient.timeS,.25*m.safeDt),exact=ref.discreteTransient.temperatureK;
  const errs=s.temperature.map((v,i)=>Math.abs(v-exact[i]));
  measured[name]={maxK:Math.max(...errs),rmsK:rms(s.temperature,exact)};
  assert.ok(Math.max(...errs)<.02,`${name} transient max`);
  assert.ok(Math.abs(s.energyError)<=s.energyRoundoffBudgetJ);
 }
 t.diagnostic(JSON.stringify(measured));
});

test('Euler time refinement is first order against the same-grid matrix exponential',t=>{
 const ref=cases['canonical-convection'],exact=ref.discreteTransient.temperatureK;
 const result=[1,.5,.25].map(f=>rms(advance(createStraightFin(config('canonical-convection',ref.discreteTransient.cells)),ref.discreteTransient.timeS,f*createStraightFin(config('canonical-convection',ref.discreteTransient.cells)).safeDt).temperature,exact));
 const orders=result.slice(1).map((e,i)=>Math.log2(result[i]/e));
 assert.ok(orders.every(p=>p>.9&&p<1.15),`time orders ${orders}`);
 t.diagnostic(JSON.stringify({timeRmsK:result,timeOrders:orders}));
});

test('energy budget: base inflow minus side and tip losses equals storage change',()=>{
 const m=createStraightFin(config('canonical-convection',16)),s=advance(m,3);
 assert.ok(Math.abs(s.energyError)<1e-8);assert.ok(Math.abs(s.energyError)<=s.energyRoundoffBudgetJ);
 assert.ok(Math.abs(s.energyChange-(s.energy-s.initialEnergy))<1e-9);
 const q=m.snapshot();assert.ok(q.baseHeatRateW>q.totalLossW,'加熱過渡では基部流入が側面+先端の損失を上回る');
 assert.ok(q.tipLossW>0,'対流先端では先端損失が正');
 const mi=createStraightFin(config('canonical-insulated',16)),si=advance(mi,3);
 assert.equal(si.tipLossW,0);assert.ok(si.baseHeatRateW>si.sideLossW);
});

test('adiabatic limit: insulated tip reproduces the cross-checked closed-form efficiency',t=>{
 const s=steady(createStraightFin(config('canonical-insulated',64))),v=reference.feirisVerifiedCanonicalInsulated;
 assert.ok(Math.abs(s.efficiency-v.efficiency)<5e-4,'eta vs verified');
 assert.ok(Math.abs(s.baseHeatRateW-v.basePowerW)<5e-3,'q vs verified');
 assert.ok(Math.abs(s.effectiveness-v.effectiveness)<2e-2,'epsilon vs verified');
 t.diagnostic(JSON.stringify({efficiency:s.efficiency,basePowerW:s.baseHeatRateW,effectiveness:s.effectiveness}));
});

test('failed timesteps and inconsistent restores never change the accepted state',()=>{
 const m=createStraightFin(config('canonical-convection',16)),zero=m.snapshot();advance(m,.1);const saved=m.snapshot(),end=advance(m,.2);
 m.restore(saved);assert.deepEqual(advance(m,.2),end);
 for(const dt of [0,-1,Infinity,NaN,m.safeDt*2]){const before=m.snapshot();assert.throws(()=>m.step(dt));assert.deepEqual(m.snapshot(),before);}
 const bad=[{...saved,signature:'other'},{...saved,time:-1},{...saved,steps:0},{...saved,netInput:saved.netInput+1},{...saved,netInputCompensation:Infinity}];
 const nan=structuredClone(saved);nan.temperature[0]=NaN;bad.push(nan);
 const inconsistent=structuredClone(zero);inconsistent.temperature[0]+=.1;bad.push(inconsistent);
 for(const state of bad){const before=m.snapshot();assert.throws(()=>m.restore(state));assert.deepEqual(m.snapshot(),before);}
 m.restore(zero);assert.deepEqual(m.snapshot(),zero);
});

test('invalid geometry, unsupported physics and unresolved scales are rejected atomically',()=>{
 for(const patch of [{length:0},{length:Infinity},{thickness:0},{depth:-1},{cells:3},{cells:257},{cells:4.5},{h:-1},{h:100000},{k:0},{cp:-1},{rho:NaN},{baseTemperature:0},{ambient:-5},{initial:NaN},{initial:[300,300]},{tipCondition:'radiative'},{source:1},{radiation:true},{materials:[]},{maxTemperature:300}])assert.throws(()=>createStraightFin(config('canonical-convection',16,patch)),JSON.stringify(patch));
 const c=config('canonical-convection',16),m=createStraightFin(c);c.h=999;const copy=m.config;copy.length=9;
 assert.equal(m.config.h,25);assert.equal(m.config.length,.1);
 const s=m.snapshot();assert.equal(s.releaseApproved,false);assert.equal(s.assumptions.radiationIncluded,false);assert.equal(s.assumptions.twoDimensionalConductionResolved,false);
 assert.equal(m.mesh.tipAreaM2,1e-4);
 const mi=createStraightFin(config('canonical-insulated',16));assert.equal(mi.mesh.tipAreaM2,0);assert.equal(mi.snapshot().assumptions.tipCondition,'insulated');
});
