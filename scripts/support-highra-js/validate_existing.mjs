// Diagnostic harness only: execute original pressure / SSPRK2 equations.
// No production module is edited; no standalone JS port or public model added.
import {readFileSync,writeFileSync} from 'node:fs';import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';import {performance} from 'node:perf_hooks';
import {projectFaces} from '../../dynamic/dev/cavity.mjs';
import {createNeumannMultigrid as originalMg} from '../../dynamic/dev/poisson-multigrid.mjs';
const root=new URL('../../',import.meta.url),dir=new URL('docs/dynamic/support-highra-js/',root),sha=x=>createHash('sha256').update(x).digest('hex');
const pack=JSON.parse(readFileSync(new URL('PACK.json',dir))),patches=[];
function change(raw,needle,replacement,label){if(raw.split(needle).length!==2)throw Error('Source changed: '+label);patches.push({label,needle,replacement});return raw.replace(needle,replacement);}
const mgRaw=readFileSync(new URL('dynamic/dev/poisson-multigrid.mjs',root),'utf8');
const mgDiagnostic=change(mgRaw,'nx>128||ny>128','nx>192||ny>192','MG dimension admission only');
const mgUrl='data:text/javascript;base64,'+Buffer.from(mgDiagnostic).toString('base64');
const {createNeumannMultigrid}=await import(mgUrl);
const raw=readFileSync(new URL('dynamic/dev/thermal-wall-cavity.mjs',root),'utf8');
let diagnosed=change(raw,'[4,8,16,32,64].includes(nx)','[4,8,16,32,64,128,192].includes(nx)','RK2 grid admission only');
diagnosed=change(diagnosed,'Ra>1000*(1+32*EPS)','Ra>1e6*(1+32*EPS)','RK2 Ra admission only');
diagnosed=change(diagnosed,'snapshot();return {step,snapshot,restore,mesh,',
 'snapshot();return {_supportPrime(s){u=Float64Array.from(s.u);v=Float64Array.from(s.v);pressure=Float64Array.from(s.pressure);inspect(theta,wall,u,v);},step,snapshot,restore,mesh,','diagnostic velocity/pressure initial-state hook only');
diagnosed=diagnosed.replaceAll("'./cavity.mjs'",JSON.stringify(new URL('dynamic/dev/cavity.mjs',root).href)).replaceAll("'./poisson-multigrid.mjs'",JSON.stringify(mgUrl));
const {createThermalWallCavity}=await import('data:text/javascript;base64,'+Buffer.from(diagnosed).toString('base64'));
const maxAbs=a=>a.reduce((m,x)=>Math.max(m,Math.abs(x)),0),maxDiff=(a,b)=>a.reduce((m,x,i)=>Math.max(m,Math.abs(x-b[i])),0);
function open(row){const bytes=readFileSync(new URL(row.file,dir));if(sha(bytes)!==row.sha256)throw Error('Pack hash mismatch');return JSON.parse(gunzipSync(bytes));}
function hydro(n,ra){return Array.from({length:n*n},(_,i)=>.5*.71*ra*((Math.floor(i/n)+.5)/n-.5));}
function model(data){const {n,ra}=data,th=data.initial.temperatureOffset;
 const c={nx:n,ny:n,width:1,height:1,depth:1,rho:1,cp:1,nu:.71,alpha:1,beta:.01,gravityBeta:.71*ra,initial:th.map(x=>300+x),wallInitialTemperature:301,coldTemperature:300,wallCapacityJPerK:1,wallMode:'isothermal-thermostat',scalarScheme:'central',pressureTolerance:1e-12,maxPressureIterations:4000};
 const m=createThermalWallCavity(c),h=hydro(n,ra);m._supportPrime({u:data.initial.u,v:data.initial.v,pressure:data.initial.pressureCenteredMean.map((x,i)=>x+h[i])});return m;
}
function metrics(s,n){const t=s.offsetTemperature,u=s.u,v=s.v;let hot=0,cold=0,mid=0,interior=0,local=-Infinity;
 for(let j=0;j<n;j++){hot+=2*(1-t[j*n]);cold+=2*t[j*n+n-1];local=Math.max(local,2*n*(1-t[j*n]));for(let i=1;i<n;i++){const flux=-(t[j*n+i]-t[j*n+i-1])+u[j*(n+1)+i]*(t[j*n+i]+t[j*n+i-1])/(2*n);interior+=flux;if(i===n/2)mid+=flux;}}
 return {Nu0:hot,NuCold:cold,NuMidplane:mid,NuVolume:(interior+(hot+cold)/2)/n,NuLocalMaximum:local};
}
function difference(s,expected,n,ra){const h=hydro(n,ra),adjusted=s.pressureStageMeanPa.map((x,i)=>x-h[i]),nu=metrics(s,n),ref=expected.metrics;
 return {temperatureMaximum:maxDiff(s.offsetTemperature,expected.temperatureOffset),velocityMaximum:Math.max(maxDiff(s.u,expected.u),maxDiff(s.v,expected.v)),
  centeredStageMeanPressureMaximum:maxDiff(adjusted,expected.pressureCenteredMean),
  NuMaximumDifference:Math.max(...['Nu0','NuCold','NuMidplane','NuVolume','NuLocalMaximum'].map(k=>Math.abs(nu[k]-ref[k]))),nu,
  maximumPe:s.maximumCellPeclet,divergence:s.divergence,relativeEnergyError:s.relativeEnergyError,
  pressureStages:s.pressureStageDiagnostics};
}
const results=[];
for(const item of pack.cases){
 const data=open(item),{n,ra,dt}=data,p=data.projection,start=performance.now(),mg=createNeumannMultigrid({nx:n,ny:n,dx:1/n,dy:1/n}),buildMs=performance.now()-start,projections=[];
 for(const [tol,warm] of [[1e-12,false],[1e-12,true],[1e-10,false]]){
  const t=performance.now(),s=projectFaces(p.tentativeU,p.tentativeV,{nx:n,ny:n,dx:1/n,dy:1/n,rho:1,dt,tolerance:tol,maxIterations:4000,preconditioner:mg,...(warm?{pressure:p.warmPressure}:{})});
  projections.push({tolerance:tol,warm,elapsedMs:performance.now()-t,iterations:s.iterations,residualL2:s.residual,rhsL2:s.rhsNorm,relativeResidualL2:s.residual/s.rhsNorm,divergence:s.divergence,
   velocityMaximumDifference:Math.max(maxDiff(s.u,p.expectedU),maxDiff(s.v,p.expectedV)),pressureMaximumDifference:maxDiff(s.pressure,p.expectedPhysicalGaugePressure),
   pressureToleranceBudget:Math.max(pack.tolerances.projectionPressureMaxFloor,pack.tolerances.projectionPressureRelativeToMax*maxAbs(p.expectedPhysicalGaugePressure))});
 }
 const t=performance.now(),m=model(data),setupMs=performance.now()-t;let elapsed=0;const checkpoints=[];
 if(Math.abs(m.safeDt-dt)>1e-14*Math.max(1,dt))throw Error('Independent dt formula differs from original JS');
 for(let step=1;step<=16;step++){const clock=performance.now();m.step(dt,false);elapsed+=performance.now()-clock;const ref=data.checkpoints.find(x=>x.step===step);if(ref)checkpoints.push({step,...difference(m.snapshot(),ref.state,n,ra)});}
 const final=m.snapshot(),file=`JS_RA${ra}_N${n}_tail.json.gz`,bytes=gzipSync(Buffer.from(JSON.stringify(final)));writeFileSync(new URL(file,dir),bytes,{flag:'wx'});
 let originalRejects192=false;try{if(n===192)originalMg({nx:n,ny:n,dx:1/n,dy:1/n});}catch{originalRejects192=true;}
 const peak=Math.max(1,maxAbs(data.initial.u),maxAbs(data.initial.v));
 const row={ra,n,dt,mgBuildMs:buildMs,levels:mg.levels,projections,rk2SetupMs:setupMs,measuredSixteenStepsMs:elapsed,meanMeasuredStepMs:elapsed/16,checkpoints,
  dctColdStartDt:item.originalDctDt,dctSteadyStateSafeDt:Math.min(.12/n**2,.1/(n*peak)),
  originalMgRejectsThisSize:originalRejects192,originalGridAndRaGatesLiftedForDiagnostics:true,
  actualTailFile:file,actualTailSHA256:sha(bytes),heapUsedBytes:process.memoryUsage().heapUsed};results.push(row);
 console.error(JSON.stringify({ra,n,mgBuildMs:buildMs,projectionIterations:projections.map(x=>x.iterations),stepMs:elapsed/16,last:checkpoints.at(-1)}));
}
const failureData=open(pack.failureReplay),replays=[];
for(const expected of failureData.trials){const m=model(failureData),dt=expected.dt;let accepted=0,failure=null,atomic=null;
 for(let i=0;i<64;i++){const before=JSON.stringify(m.snapshot());try{m.step(dt,false);accepted++;}catch(e){failure=e.message;atomic=before===JSON.stringify(m.snapshot());break;}}
 const last=m.snapshot();replays.push({factor:expected.factor,dt,acceptedSteps:accepted,expectedAcceptedSteps:expected.acceptedSteps,failure,atomic,
  final:difference(last,expected.last,128,1e6),scope:failureData.scope});console.error(JSON.stringify({replay:replays.at(-1)}));
}
const files=['dynamic/dev/cavity.mjs','dynamic/dev/poisson-multigrid.mjs','dynamic/dev/thermal-wall-cavity.mjs'];
writeFileSync(new URL('JS_RESULTS.json',dir),JSON.stringify({cases:results,failureReplays:replays,patches,sourceSHA256:Object.fromEntries(files.map(p=>[p,sha(readFileSync(new URL(p,root)))])),diagnosticSHA256:{mg:sha(mgDiagnostic),rk2:sha(diagnosed)},
 generatorSHA256:sha(readFileSync(new URL(import.meta.url))),fullJsColdToSteadyVerified:false,releaseApproved:false},null,2)+'\n',{flag:'wx'});
