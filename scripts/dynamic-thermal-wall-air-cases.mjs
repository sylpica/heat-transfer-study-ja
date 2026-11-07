import {createThermalWallCavity} from '../dynamic/dev/thermal-wall-cavity.mjs';
import {thermalWallConfig} from '../dynamic/dev/thermal-wall-ui-config.mjs';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const runs=[];
for(const wallMode of ['finite-capacity','isothermal-thermostat']){
 const config=thermalWallConfig({wallMode}),cases=[];
 for(const factor of [1,.5,.25,.125,.0625]){
  const m=createThermalWallCavity(config),maximumDt=m.safeDt*factor;
  while(m.time<.01)m.step(Math.min(maximumDt,.01-m.time),false);
  cases.push({factor,maximumDt,snapshot:m.snapshot()});
 }
 runs.push({name:'air-'+wallMode,config,timeS:.01,cases});
}
const paths=['dynamic/dev/thermal-wall-cavity.mjs','dynamic/dev/cavity.mjs','dynamic/dev/poisson-multigrid.mjs','dynamic/dev/thermal-wall-ui-config.mjs','scripts/dynamic-thermal-wall-air-cases.mjs'];
console.log(JSON.stringify({sourceFilesSHA256:Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex')])),runs}));
