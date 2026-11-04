import {createThermal} from '../dynamic/thermal.mjs';
import {performance} from 'node:perf_hooks';
const result={date:'2026-11-04',environment:{node:process.version,platform:process.platform,architecture:process.arch},reference:'Independent separation-of-variables solution for an insulated constant-property rectangle; no benchmark values inferred from CFD literature.',temperatureUnits:'K',space:[],time:[]};
function run(nx,ny,dtFraction){
 const width=1,height=.5,time=.01,initial=Array.from({length:nx*ny},(_,n)=>300+Math.cos(Math.PI*(n%nx+.5)/nx)*Math.cos(Math.PI*(Math.floor(n/nx)+.5)/ny));
 const model=createThermal({nx,ny,width,height,depth:1,materials:[{k:1,rho:1,cp:1}],initial}),dt=model.safeDt*dtFraction;
 const begin=performance.now();while(model.time<time-1e-12)model.step(Math.min(dt,time-model.time),false);const elapsedMs=performance.now()-begin,s=model.snapshot();
 const discreteLambda=4*nx*nx*Math.sin(Math.PI/(2*nx))**2+4*(ny/height)**2*Math.sin(Math.PI/(2*ny))**2;
 const semiDiscreteError=Math.sqrt(s.temperature.reduce((a,v,n)=>{const exact=300+Math.exp(-discreteLambda*time)*Math.cos(Math.PI*(n%nx+.5)/nx)*Math.cos(Math.PI*(Math.floor(n/nx)+.5)/ny);return a+(v-exact)**2;},0)/(nx*ny));
 const error=Math.sqrt(s.temperature.reduce((a,v,n)=>{const exact=300+Math.exp(-5*Math.PI*Math.PI*time)*Math.cos(Math.PI*(n%nx+.5)/nx)*Math.cos(Math.PI*(Math.floor(n/nx)+.5)/ny);return a+(v-exact)**2;},0)/(nx*ny));
 return {nx,ny,dt,errorRMSKelvin:error,semiDiscreteErrorRMSKelvin:semiDiscreteError,energyErrorJ:s.energyError,steps:s.steps,elapsedMs};
}
for(const n of [10,20,40])result.space.push(run(n,n/2,.1));
for(const fraction of [.8,.4,.2])result.time.push(run(20,10,fraction));
result.spaceObservedOrders=result.space.slice(1).map((row,i)=>Math.log2(result.space[i].errorRMSKelvin/row.errorRMSKelvin));
result.timeObservedOrders=result.time.slice(1).map((row,i)=>Math.log2(result.time[i].semiDiscreteErrorRMSKelvin/row.semiDiscreteErrorRMSKelvin));
result.acceptance={timePassed:result.timeObservedOrders.every(v=>v>.95&&v<1.1),spatialOrder:'approximately2; all reported order estimates must be >1.8',spatialPassed:result.spaceObservedOrders.every(v=>v>1.8),note:'Time errors against the continuum combine spatial and temporal error; isolated first-order temporal convergence is separately checked against the exact semi-discrete eigenvalue in tests/dynamic-thermal.test.mjs. Timings are this cloud CPU only; not device or GPU measurements.'};
if(!result.acceptance.spatialPassed||!result.acceptance.timePassed)process.exitCode=1;
console.log(JSON.stringify(result,null,2));
