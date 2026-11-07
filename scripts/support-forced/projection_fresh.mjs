// Exercise real pressure iterations, not the favorable exact initial guesses
// retained transparently in PRESSURE_CASES.json. No production changes.
import {readFileSync,writeFileSync} from 'node:fs';
import {projectFaces} from '../../dynamic/dev/cavity.mjs';
import {createNeumannMultigrid} from '../../dynamic/dev/poisson-multigrid.mjs';
const input=JSON.parse(readFileSync(new URL('../../docs/dynamic/support-forced/PRESSURE_CASES.json',import.meta.url)));
const cases=input.projection.map(c=>({n:c.n,rho:c.rho,kind:c.kind,outputs:['jacobi','multigrid'].flatMap(pc=>[0,17].map(offset=>{
 const p=projectFaces(c.tentativeU,c.tentativeV,{nx:c.n,ny:c.n,dx:1/c.n,dy:1/c.n,rho:c.rho,dt:c.dt,tolerance:1e-12,maxIterations:4000,pressure:Array(c.n*c.n).fill(offset),...(pc==='multigrid'?{preconditioner:createNeumannMultigrid({nx:c.n,ny:c.n,dx:1/c.n,dy:1/c.n})}:{})});
 return {preconditioner:pc,initialConstantPa:offset,...p,u:Array.from(p.u),v:Array.from(p.v),maximumPressureError:Math.max(...p.pressure.map((x,i)=>Math.abs(x-c.expectedP[i]))),maximumVelocityError:Math.max(...p.u.map((x,i)=>Math.abs(x-c.expectedU[i])),...p.v.map((x,i)=>Math.abs(x-c.expectedV[i])))};
}))}));
writeFileSync(new URL('../../docs/dynamic/support-forced/PRESSURE_PROJECTION_FRESH.json',import.meta.url),JSON.stringify({cases,releaseApproved:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(cases.map(c=>({n:c.n,rho:c.rho,kind:c.kind,iterations:c.outputs.map(x=>x.iterations),maxPressureError:Math.max(...c.outputs.map(x=>x.maximumPressureError)),maxVelocityError:Math.max(...c.outputs.map(x=>x.maximumVelocityError))}))));
