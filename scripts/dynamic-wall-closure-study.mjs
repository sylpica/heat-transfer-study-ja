// Diagnostic only: shadow copies under ignored work/, never a public model.
// No reference/threshold is fitted. Use the second-order operator precisely
// where the composite fourth-order flux stencil needs a one-sided closure.
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import {createCavity} from '../dynamic/dev/cavity.mjs';
const root=new URL('..',import.meta.url),smoke=process.argv.includes('--smoke'),advectionOnly=process.argv.includes('--advection-only'),viscosityOnly=process.argv.includes('--viscosity-only'),variant=advectionOnly?'wall-advection-study':viscosityOnly?'wall-diffusion-study':'wall-local-study',sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=['dynamic/dev/cavity.mjs','dynamic/dev/mac-momentum.mjs','dynamic/dev/poisson-multigrid.mjs','scripts/dynamic-wall-closure-study.mjs'],hash=value=>createHash('sha256').update(value).digest('hex'),started=performance.now();
if(advectionOnly&&viscosityOnly)throw Error('Select one component at a time');
await mkdir(new URL('work/',root),{recursive:true});const scratch=await mkdtemp(new URL('work/wall-closure-',root).pathname),source=await readFile(new URL('dynamic/dev/mac-momentum.mjs',root),'utf8'),marker='    return {advectionU, advectionV, laplacianU, laplacianV};';if(!source.includes(marker))throw Error('Momentum source changed: review the diagnostic transformation');
const wallOverride=`
    // Composite interpolation + derivative reaches one layer beyond each
    // component stencil. Keep centered fourth-order support only in the core.
    const getU=(i,j)=>j<0?-u[U(i,0)]:j>=ny?2*lid-u[U(i,ny-1)]:u[U(i,j)];
    const getV=(i,j)=>i<0?-v[V(0,j)]:i>=nx?-v[V(nx-1,j)]:v[V(i,j)];
    for(let j=0;j<ny;j++)for(let i=1;i<nx;i++)if(i<3||i>nx-3||j<3||j>=ny-3){
      const k=U(i,j),a=u[k],east=u[U(i+1,j)],west=u[U(i-1,j)],north=getU(i,j+1),south=getU(i,j-1),vn=(v[V(i-1,j+1)]+v[V(i,j+1)])/2,vs=(v[V(i-1,j)]+v[V(i,j)])/2;
      if(${!viscosityOnly})advectionU[k]=(((a+east)/2)**2-((a+west)/2)**2)/dx+((a+north)/2*vn-(a+south)/2*vs)/dy;
      if(${!advectionOnly})laplacianU[k]=(east-2*a+west)/dx**2+(north-2*a+south)/dy**2;
    }
    for(let j=1;j<ny;j++)for(let i=0;i<nx;i++)if(i<3||i>=nx-3||j<3||j>ny-3){
      const k=V(i,j),a=v[k],east=getV(i+1,j),west=getV(i-1,j),north=v[V(i,j+1)],south=v[V(i,j-1)],ue=(u[U(i+1,j-1)]+u[U(i+1,j)])/2,uw=(u[U(i,j-1)]+u[U(i,j)])/2;
      if(${!viscosityOnly})advectionV[k]=((a+east)/2*ue-(a+west)/2*uw)/dx+(((a+north)/2)**2-((a+south)/2)**2)/dy;
      if(${!advectionOnly})laplacianV[k]=(east-2*a+west)/dx**2+(north-2*a+south)/dy**2;
    }
`;
const hybridMomentum=source.replace(marker,wallOverride+marker),cavitySource=await readFile(new URL('dynamic/dev/cavity.mjs',root),'utf8'),hybridCavity=cavitySource.replaceAll("'polynomial4'",JSON.stringify(variant)).replace("from './poisson-multigrid.mjs'",'from '+JSON.stringify(new URL('dynamic/dev/poisson-multigrid.mjs',root).href));
await writeFile(scratch+'/mac-momentum.mjs',hybridMomentum);await writeFile(scratch+'/cavity.mjs',hybridCavity);const {createCavity:studyCavity}=await import(new URL('file://'+scratch+'/cavity.mjs'));
const configuration=(n,momentumScheme)=>({nx:n,ny:n,momentumScheme,pressurePreconditioner:'multigrid',width:1,height:1,rho:1,cp:1,nu:.01,alpha:.01,initial:300,lidVelocity:1});
// Source transformation must not alter the default equations at all.
const control=createCavity(configuration(8,'conservative2')),shadow=studyCavity(configuration(8,'conservative2'));assert.deepEqual(control.step(.001),shadow.step(.001));
const previous=JSON.parse(await readFile(new URL('docs/dynamic/WALL_CLOSURE_STUDY_20261105.json',root),'utf8'));for(const file of files.slice(0,3))assert.equal(hash(readFileSync(new URL(file,root))),previous.sourceFilesSHA256[file],'Do not mix changed base operators with the earlier control');
const out={generatedAtUTC:new Date().toISOString(),sourceCommit,sourceTreeDirty:!!execFileSync('git',['status','--porcelain','--',...files],{encoding:'utf8'}).trim(),sourceFilesSHA256:Object.fromEntries(files.map(path=>[path,hash(readFileSync(new URL(path,root)))])),transformedSourcesSHA256:{momentum:hash(hybridMomentum),cavity:hash(hybridCavity)},environment:{node:process.version,platform:process.platform,arch:process.arch},scope:'Controlled diagnostic of existing second-order, polynomial4 and a stencil-support-defined wall-local second-order shadow. No production registration or parameter fit. Same nominal dt at a given mesh; pointwise mixing is not a proof of global momentum conservation.',smoke,variant,componentIsolation:{advectionSecondOrder:!viscosityOnly,viscositySecondOrder:!advectionOnly},baselineComparisonFile:'WALL_CLOSURE_STUDY_20261105.json',physicsGateEvaluated:!smoke,threshold:.005,referenceY:[.2813,.5,.6172,.8516],referenceU:[-.15662,-.20581,-.13641,.23151],cases:[],releaseApproved:false};
for(const n of smoke?[8]:(advectionOnly||viscosityOnly)?[32]:[16,32])for(const scheme of advectionOnly||viscosityOnly?[variant]:['conservative2','polynomial4',variant]){
 const begin=performance.now(),m=(scheme===variant?studyCavity:createCavity)(configuration(n,scheme)),nominalDt=.5*Math.min(.12/(.01*2*n*n),.25/(2*n)),end=smoke?.01:30;let beforeFinalSecond=null,clippedSteps=0;
 while(m.time<end){if(!smoke&&!beforeFinalSecond&&m.time>=29)beforeFinalSecond=m.snapshot();const dt=Math.min(nominalDt,m.safeDt,end-m.time);if(dt<nominalDt&&end-m.time>nominalDt)clippedSteps++;m.step(dt,false);}
 const s=m.snapshot(),samples=out.referenceY.map(y=>{const pos=y*n-.5,j=Math.floor(pos),a=pos-j;return (1-a)*s.u[j*(n+1)+n/2]+a*s.u[(j+1)*(n+1)+n/2];}),maxError=Math.max(...samples.map((u,i)=>Math.abs(u-out.referenceU[i]))),lastSecondChange=beforeFinalSecond?Math.max(...s.u.map((u,i)=>Math.abs(u-beforeFinalSecond.u[i])),...s.v.map((v,i)=>Math.abs(v-beforeFinalSecond.v[i]))):null;
 const row={n,scheme,time:s.time,steps:s.steps,nominalDt,clippedSteps,samples,maxReferenceError:maxError,lidGatePassed:!smoke&&n===32?maxError<out.threshold:null,lastSecondMaxVelocityChange:lastSecondChange,divergence:s.divergence,normalizedDivergence:s.normalizedDivergence,energyErrorJ:s.energyError,pressureResidual:s.pressureResidual,totalPressureIterations:s.totalPressureIterations,elapsedMs:performance.now()-begin};out.cases.push(row);console.error(JSON.stringify(row));
}
out.numericalGatesPassed=out.cases.every(row=>row.divergence<1e-8&&Math.abs(row.energyErrorJ)<1e-8);out.variantPhysicalGatePassed=smoke?null:out.cases.find(row=>row.n===32&&row.scheme===variant).lidGatePassed;out.passed=out.numericalGatesPassed&&(smoke||out.variantPhysicalGatePassed);out.elapsedMs=performance.now()-started;console.log(JSON.stringify(out,null,2));if(!out.passed)process.exitCode=1;
