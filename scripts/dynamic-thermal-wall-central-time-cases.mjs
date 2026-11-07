import {createThermalWallCavity} from '../dynamic/dev/thermal-wall-cavity.mjs';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const nx=8,ny=8,base={nx,ny,width:1,height:1,depth:1,rho:1,cp:1,nu:.0071,alpha:.01,beta:1/300,initial:Array.from({length:nx*ny},(_,n)=>{const x=(n%nx+.5)/nx,y=(Math.floor(n/nx)+.5)/ny;return 300+.1*Math.sin(Math.PI*x)*Math.sin(Math.PI*y)+.05*x;}),wallInitialTemperature:301,coldTemperature:300,wallCapacityJPerK:.1,wallInputW:.01,maxTemperature:1000,wallMode:'finite-capacity',scalarScheme:'central'},runs=[];
for(const [name,gravityBeta,wallMode] of [['central-thermal-only',0,'finite-capacity'],['central-buoyant',.071,'finite-capacity'],['central-thermostat',.071,'isothermal-thermostat']]){
 const config={...base,gravityBeta,wallMode,wallInputW:wallMode==='finite-capacity'?.01:0},cases=[];
 for(const factor of [1,.5,.25,.125,.0625]){
  const m=createThermalWallCavity(config),maximumDt=m.safeDt*factor;
  while(m.time<.2)m.step(Math.min(maximumDt,.2-m.time),false);
  cases.push({factor,maximumDt,snapshot:m.snapshot()});
 }
 runs.push({name,config,timeS:.2,cases});
}
const paths=['dynamic/dev/thermal-wall-cavity.mjs','dynamic/dev/cavity.mjs','dynamic/dev/poisson-multigrid.mjs','scripts/dynamic-thermal-wall-central-time-cases.mjs'];
console.log(JSON.stringify({sourceFilesSHA256:Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex')])),runs}));
