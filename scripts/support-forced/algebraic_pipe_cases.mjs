import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {calculateLaminarPipe,LAMINAR_PIPE_DEFAULTS} from '../../laminar-pipe-convection.mjs';
import {calculatePipeConvection,PIPE_DEFAULTS} from '../../turbulent-pipe-convection.mjs';
const cases=[];
for(const [kind,base,reynolds,fn]of [['laminar',LAMINAR_PIPE_DEFAULTS,[100,800,2000],calculateLaminarPipe],['turbulent',PIPE_DEFAULTS,[12000,1e5,1e6],calculatePipeConvection]])for(const Re of reynolds){const c={...base,velocity:Re*base.viscosity/(base.density*base.diameter)},r=fn(c);if(r.error)throw Error(r.error);cases.push({kind,input:c,re:r.re,darcy:r.darcy,pressureDropPa:r.pressureDrop,hydraulicPowerW:r.hydraulicPower??r.hydraulicWatts});}
const files=['laminar-pipe-convection.mjs','turbulent-pipe-convection.mjs'];
writeFileSync(new URL('../../docs/dynamic/support-forced/ALGEBRAIC_PIPE_CASES.json',import.meta.url),JSON.stringify({cases,sourceSHA256:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../../'+p,import.meta.url))).digest('hex')])),newModelAdded:false,releaseApprovalChanged:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(cases.map(r=>({kind:r.kind,re:r.re,pressureDropPa:r.pressureDropPa}))));
