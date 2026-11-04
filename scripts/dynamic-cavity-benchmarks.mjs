import {execFileSync} from 'node:child_process';
import {createCavity} from '../dynamic/dev/cavity.mjs';
import {performance} from 'node:perf_hooks';
const full=process.argv.includes('--full'),start=performance.now(),out={date:'2026-11-04',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),stage:'development_only_not_public',sourceNotes:'CFD_DEVELOPMENT.md; equations independently implemented; numerical reference values are public transcriptions, not an expert approval.',lid:[],natural:[]};
const advance=(m,t,f=1)=>{while(m.time<t-1e-10)m.step(Math.min(m.safeDt*f,t-m.time),false);return m.snapshot();};
for(const n of [16,32]){
 const m=createCavity({nx:n,ny:n,width:1,height:1,rho:1,cp:1,nu:.01,alpha:.01,initial:300,lidVelocity:1});
 const s=advance(m,30),samples=[.2813,.5,.6172,.8516].map(y=>{const index=y*n-.5,j=Math.floor(index),a=index-j,u=(1-a)*s.u[j*(n+1)+n/2]+a*s.u[(j+1)*(n+1)+n/2];return {y,u};});
 out.lid.push({n,time:s.time,samples,divergence:s.divergence,energyError:s.energyError,pressureResidual:s.pressureResidual,pressureRhsNorm:s.pressureRhsNorm,steps:s.steps});console.error(JSON.stringify({stage:'lid',...out.lid.at(-1)}));
}
for(const n of full?[16,32,48]:[16,32]){
 const m=createCavity({nx:n,ny:n,width:1,height:1,rho:1,cp:1,nu:.71,alpha:1,initial:300,leftTemperature:300.5,rightTemperature:299.5,gravityBeta:710,beta:.001,referenceTemperature:300,scalarScheme:'central'});
 const s=advance(m,1);out.natural.push({n,time:s.time,rayleigh:1000,prandtl:.71,nusselt:s.nusselt,divergence:s.divergence,energyError:s.energyError,pressureResidual:s.pressureResidual,pressureRhsNorm:s.pressureRhsNorm,steps:s.steps});console.error(JSON.stringify({stage:'natural',...out.natural.at(-1)}));
}
if(full){const n=32,m=createCavity({nx:n,ny:n,width:1,height:1,rho:1,cp:1,nu:.01,alpha:.01,initial:300,lidVelocity:1}),s=advance(m,30,.5);out.halfTimeStep={n,time:s.time,centerU:(s.u[(n/2-1)*(n+1)+n/2]+s.u[(n/2)*(n+1)+n/2])/2};}
if(full){const [a,b,c]=out.natural.map(r=>r.nusselt),ratio=(a-b)/(b-c);let lo=.05,hi=8;for(let it=0;it<80;it++){const p=(lo+hi)/2,r=(2**p-1)/(1-(2/3)**p);if(r<ratio)lo=p;else hi=p;}const order=(lo+hi)/2,extrapolated=c+(c-b)/(1.5**order-1);out.naturalThreeGrid={observedOrder:order,extrapolatedNusselt:extrapolated,monotone:(a-b)*(b-c)>0,decreasingDifference:Math.abs(b-c)<Math.abs(a-b),scope:'Nonuniform-grid leading-error fit of one wall-average quantity, not a whole-field accuracy or asymptotic-range proof.'};}
const reference=[-.15662,-.20581,-.13641,.23151],fine=out.lid[1];out.acceptance={lidMaxNormalizedVelocityError:Math.max(...fine.samples.map((s,i)=>Math.abs(s.u-reference[i]))),lidBudget:.005,naturalReference:1.117,naturalBudget:.006,naturalError:Math.abs(out.natural[1].nusselt-1.117),massBudget:1e-8,thermalEnergyBudget:1e-8,gridImproves:Math.abs(out.lid[1].samples[1].u-reference[1])<Math.abs(out.lid[0].samples[1].u-reference[1])&&Math.abs(out.natural[1].nusselt-1.117)<Math.abs(out.natural[0].nusselt-1.117)};
out.passed=out.acceptance.lidMaxNormalizedVelocityError<out.acceptance.lidBudget&&out.acceptance.naturalError<out.acceptance.naturalBudget&&out.acceptance.gridImproves&&[...out.lid,...out.natural].every(s=>s.divergence<1e-8&&Math.abs(s.energyError)<1e-8);if(full)out.passed=out.passed&&out.naturalThreeGrid.monotone&&out.naturalThreeGrid.decreasingDifference;out.elapsedMs=performance.now()-start;out.timingScope='cloud CPU, possible concurrent verification workloads; not a phone or GPU performance claim';console.log(JSON.stringify(out,null,2));if(!out.passed)process.exitCode=1;
