// High-Ra natural-convection benchmark runner (development only, not part of
// the test suite). Protocol: docs/dynamic/HIGHRA_CAVITY_JS_20261107.md sec. 4
// (incl. the 4.2.1 grid-sequencing amendment).
// Cold: node scripts/dynamic-cavity-highra-benchmarks.mjs --ra 1e4 --n 48
//       [--max-tau 3] [--save-state state.json]
//   Steady: tau>=0.4 and relative Nu_0 change over trailing 0.1 below 2e-5.
// Warm: node scripts/dynamic-cavity-highra-benchmarks.mjs --ra 1e5 --n 128
//       --from state.json [--max-tau 0.8] [--save-state next.json]
//   The converged coarse state is bilinearly interpolated, projected with
//   projectFaces to remove discrete divergence, and restored into the fine
//   cavity. netInput is set to (warm-field internal energy - uniform-field
//   internal energy) so snapshot energyError tracks conservation inside the
//   segment. Steady: segment tau>=0.15, trailing-0.1 drift below 2e-5, and
//   final Nu_0 within 0.5% of the coarse steady Nu_0.
// Exit code 0 = steady reached, 2 = tau cap reached (unconverged), 1 = error.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCavity,projectFaces} from '../dynamic/dev/cavity.mjs';
import {createNeumannMultigrid} from '../dynamic/dev/poisson-multigrid.mjs';
import {performance} from 'node:perf_hooks';
const args=process.argv.slice(2),opt={ra:1e4,n:64};
for(let i=0;i<args.length;i++){const key=args[i].replace(/^--/,'');if(key==='from'||key==='save-state')opt[key]=args[++i];else opt[key]=Number(args[++i]);}
const Ra=opt.ra,n=opt.n,warm=typeof opt.from==='string',maxTau=opt['max-tau']??(warm?.8:3),minTau=opt['min-tau']??(warm?.15:.4);
const files=['dynamic/dev/cavity.mjs','dynamic/dev/mac-momentum.mjs','dynamic/dev/poisson-multigrid.mjs','scripts/dynamic-cavity-highra-benchmarks.mjs'],root=new URL('..',import.meta.url);
const config={nx:n,ny:n,width:1,height:1,rho:1,cp:1,nu:.71,alpha:1,initial:300,leftTemperature:300.5,rightTemperature:299.5,gravityBeta:.71*Ra,beta:.001,referenceTemperature:300,scalarScheme:'central',pressurePreconditioner:'multigrid',pressureTolerance:1e-11,maxPressureIterations:4000};
const out={generatedAtUTC:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch},sourceTreeDirty:!!execFileSync('git',['status','--porcelain','--',...files],{encoding:'utf8'}).trim(),sourceFilesSHA256:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(new URL(p,root))).digest('hex')])),releaseApproved:false,stage:'development_only_not_public',rayleigh:Ra,grid:n,mode:warm?'warm':'cold',protocol:'HIGHRA_CAVITY_JS_20261107 sec.4 + 4.2.1',steadyCriterion:warm?'segment tau>=0.15, |Nu(tau)-Nu(tau-0.1)|/Nu < 2e-5, final Nu within 0.5% of coarse steady Nu, cap '+maxTau:'tau>=0.4 and |Nu(tau)-Nu(tau-0.1)|/Nu < 2e-5, cap tau='+maxTau};
const start=performance.now();
function sampleCell(field,nc,x,y){const u=Math.min(Math.max(x*nc-.5,0),nc-1),v=Math.min(Math.max(y*nc-.5,0),nc-1),i0=Math.min(Math.floor(u),nc-2),j0=Math.min(Math.floor(v),nc-2),fu=u-i0,fv=v-j0;return (field[j0*nc+i0]*(1-fu)+field[j0*nc+i0+1]*fu)*(1-fv)+(field[(j0+1)*nc+i0]*(1-fu)+field[(j0+1)*nc+i0+1]*fu)*fv;}
function sampleFaceU(field,nc,x,y){const a=Math.min(Math.max(x*nc,0),nc),b=Math.min(Math.max(y*nc-.5,0),nc-1),i0=Math.min(Math.floor(a),nc-1),j0=Math.min(Math.floor(b),nc-2),fa=a-i0,fb=b-j0,g=(i,j)=>field[j*(nc+1)+i];return (g(i0,j0)*(1-fa)+g(i0+1,j0)*fa)*(1-fb)+(g(i0,j0+1)*(1-fa)+g(i0+1,j0+1)*fa)*fb;}
function sampleFaceV(field,nc,x,y){const a=Math.min(Math.max(x*nc-.5,0),nc-1),b=Math.min(Math.max(y*nc,0),nc),i0=Math.min(Math.floor(a),nc-2),j0=Math.min(Math.floor(b),nc-1),fa=a-i0,fb=b-j0,g=(i,j)=>field[j*nc+i];return (g(i0,j0)*(1-fa)+g(i0+1,j0)*fa)*(1-fb)+(g(i0,j0+1)*(1-fa)+g(i0+1,j0+1)*fa)*fb;}
try{
 const m=createCavity(config);let warmInfo=null;
 if(warm){
  const src=JSON.parse(readFileSync(opt.from,'utf8')),nc=src.grid;
  const template=m.snapshot(),N=n*n;
  const temperature=new Array(N),pressure=new Array(N);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){temperature[j*n+i]=sampleCell(src.temperature,nc,(i+.5)/n,(j+.5)/n);pressure[j*n+i]=sampleCell(src.pressure,nc,(i+.5)/n,(j+.5)/n);}
  let mean=0;for(let i=0;i<N;i++)mean+=pressure[i];mean/=N;for(let i=0;i<N;i++)pressure[i]-=mean;
  const us=new Float64Array((n+1)*n),vs=new Float64Array(n*(n+1));
  for(let j=0;j<n;j++)for(let i=1;i<n;i++)us[j*(n+1)+i]=sampleFaceU(src.u,nc,i/n,(j+.5)/n);
  for(let j=1;j<n;j++)for(let i=0;i<n;i++)vs[j*n+i]=sampleFaceV(src.v,nc,(i+.5)/n,j/n);
  const projected=projectFaces(us,vs,{nx:n,ny:n,dx:1/n,dy:1/n,rho:1,dt:template.safeDt,tolerance:1e-11,maxIterations:4000,preconditioner:createNeumannMultigrid({nx:n,ny:n,dx:1/n,dy:1/n})});
  const cellCapacity=1*1*(1/n)*(1/n)*1;let eWarm=0,eUniform=0;for(let i=0;i<N;i++){eWarm+=temperature[i]-273.15;eUniform+=300-273.15;}
  const state={...template,temperature,u:Array.from(projected.u),v:Array.from(projected.v),pressure,time:0,steps:0,lastDt:0,lastPower:0,netInput:cellCapacity*eWarm-cellCapacity*eUniform,totalPressureIterations:0,pressureIterations:0,pressureResidual:0,pressureRhsNorm:0};
  const restored=m.restore(state);
  warmInfo={fromGrid:nc,fromRayleigh:src.rayleigh,fromNusselt:src.nusselt,projectedDivergence:projected.divergence,segmentStartNusselt:restored.nusselt,segmentStartRelativeEnergyError:restored.relativeEnergyError};
  out.warmStart=warmInfo;
 }
 const history=[];let steady=false,finalDrift=null;
 while(m.time<maxTau-1e-12){
  const target=Math.min(maxTau,m.time+.01);
  while(m.time<target-1e-12)m.step(Math.min(m.safeDt,target-m.time),false);
  const s=m.snapshot();history.push({tau:+s.time.toFixed(6),nusselt:s.nusselt});
  if(s.time>=minTau){
   const past=history.findLast(h=>h.tau<=s.time-.1+1e-9);
   if(past){const drift=Math.abs(s.nusselt-past.nusselt)/s.nusselt;finalDrift=drift;
    if(drift<2e-5&&(warmInfo.fromRayleigh!==Ra||Math.abs(s.nusselt-warmInfo.fromNusselt)/warmInfo.fromNusselt<=.005)){steady=true;break;}}
  }
  if(history.length%10===0)console.error(JSON.stringify({ra:Ra,n,tau:+s.time.toFixed(3),nusselt:+s.nusselt.toFixed(6),drift:finalDrift,elapsedMin:+((performance.now()-start)/6e4).toFixed(2)}));
 }
 const s=m.snapshot();
 let maxLocalNu=0;for(let j=0;j<n;j++)maxLocalNu=Math.max(maxLocalNu,2*(300.5-s.temperature[j*n])/(1/n));
 Object.assign(out,{steady,tau:+s.time.toFixed(6),steps:s.steps,nusselt:s.nusselt,maxLocalWallNu:+maxLocalNu.toFixed(6),relativeEnergyError:s.relativeEnergyError,energyError:s.energyError,divergence:s.divergence,normalizedDivergence:s.normalizedDivergence,maxAbsU:+Math.max(...s.u.map(Math.abs)).toFixed(4),maxAbsV:+Math.max(...s.v.map(Math.abs)).toFixed(4),minTemperature:s.min,maxTemperature:s.max,totalPressureIterations:s.totalPressureIterations,finalDrift,historyTail:history.slice(-12),elapsedMs:Math.round(performance.now()-start),msPerStep:+((performance.now()-start)/s.steps).toFixed(4)});
 if(opt['save-state'])writeFileSync(opt['save-state'],JSON.stringify({grid:n,rayleigh:Ra,nusselt:s.nusselt,temperature:s.temperature,u:s.u,v:s.v,pressure:s.pressure}));
 console.log(JSON.stringify(out,null,2));process.exitCode=steady?0:2;
}catch(error){
 Object.assign(out,{error:String(error?.message??error),elapsedMs:Math.round(performance.now()-start)});
 console.log(JSON.stringify(out,null,2));process.exitCode=1;
}
