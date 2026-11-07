import {writeFileSync} from 'node:fs';
// Measurement driver for closure order 3. Usage:
//   node dynamic-variable-property-surface-cases.mjs HARNESS_DIR OUT_JSON
// HARNESS_DIR must contain a copy of the production dynamic/ modules in
// which ONLY the variable-property x convection-radiation gate line has
// been removed (see TRANSIENT_CLOSURE_VERIFICATION_20261107.md). The
// production module itself still rejects this combination; nothing about
// the acceptance scope is changed by this measurement.
const harness=process.argv[2],out=process.argv[3];
const {createThermal}=await import(`${harness}/thermal.mjs`);
const bc={type:'convection-radiation',temperature:400,radiationTemperature:280,h:12,emissivity:.8};
const cases={
 kOnly:{materials:[{k:5,rho:1000,cp:1000,kTable:[[300,5],[500,6]]}]},
 cpOnly:{materials:[{k:5,rho:1000,cp:1000,cpTable:[[300,900],[400,1000],[500,1100]]}]},
 both:{materials:[{k:5,rho:1000,cp:1000,kTable:[[300,5],[500,6]],cpTable:[[300,900],[400,1000],[500,1100]]}]},
};
function runTo(m,t,dt){let s=m.snapshot();while(s.time<t-1e-12){m.step(Math.min(dt,t-s.time),false);s=m.snapshot();}return s;}
const result={};
for(const [name,patch] of Object.entries(cases)){
 result[name]={};
 for(const nx of [4,8,16,32]){
  const m=createThermal({nx,ny:1,width:.1,height:1,depth:1,initial:350,boundaries:{right:bc},...patch});
  const s=runTo(m,600,m.safeDt*.5);
  result[name][nx]={temperature:s.temperature,netInput:s.netInput,energyError:s.energyError,relativeEnergyError:s.relativeEnergyError,surfaceTemperatureMinK:s.surfaceExchange[0].surfaceTemperatureMinK,surfaceTemperatureMaxK:s.surfaceExchange[0].surfaceTemperatureMaxK};
 }
 // Long run toward the uniform steady state (both-tables physics on the
 // coarsest grid is enough: the steady state is grid-independent here).
 const m=createThermal({nx:8,ny:1,width:.1,height:1,depth:1,initial:350,boundaries:{right:bc},...patch});
 let s=m.snapshot(),guard=0;
 while(guard++<200000){const before=s;m.step(m.safeDt*.5,false);s=m.snapshot();if(Math.max(...s.temperature.map((v,i)=>Math.abs(v-before.temperature[i])))<1e-13)break;}
 result[name].steady={time:s.time,temperature:s.temperature,maxSpread:Math.max(...s.temperature)-Math.min(...s.temperature),energyError:s.energyError};
}
writeFileSync(out,JSON.stringify(result,null,1));
console.log(`wrote ${out}`);
