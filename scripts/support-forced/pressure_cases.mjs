// Support only. Original pressure solvers and physics gates are unchanged.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';
import {projectFaces,createCavity} from '../../dynamic/dev/cavity.mjs';import {createNeumannMultigrid} from '../../dynamic/dev/poisson-multigrid.mjs';import {manufacturedCavity} from '../../dynamic/dev/manufactured-cavity.mjs';
const out=new URL('../../docs/dynamic/support-forced/PRESSURE_CASES.json',import.meta.url);if(existsSync(out))throw Error('Protect saved result');
const projection=[];
for(const [n,rho,kind]of [[8,.7,'cos'],[16,1,'cos'],[32,1000,'cos'],[64,1,'cos'],[16,.7,'hydrostatic'],[16,1000,'hydrostatic']]){
 const dt=.0027,h=1/n,psi=Array.from({length:(n+1)**2},(_,i)=>.01*Math.sin(Math.PI*(i%(n+1))/n)**2*Math.sin(Math.PI*Math.floor(i/(n+1))/n)**2),expectedP=Array.from({length:n*n},(_,i)=>kind==='cos'?.3*Math.cos(2*Math.PI*(i%n+.5)/n)*Math.cos(4*Math.PI*(Math.floor(i/n)+.5)/n):rho*3.7*((Math.floor(i/n)+.5)/n-.5)),u=new Float64Array((n+1)*n),v=new Float64Array(n*(n+1));
 for(let j=0;j<n;j++)for(let i=1;i<n;i++)u[j*(n+1)+i]=kind==='cos'?(psi[(j+1)*(n+1)+i]-psi[j*(n+1)+i])/h:0;
 for(let j=1;j<n;j++)for(let i=0;i<n;i++)v[j*n+i]=kind==='cos'?-(psi[j*(n+1)+i+1]-psi[j*(n+1)+i])/h:0;
 const us=u.slice(),vs=v.slice();for(let j=0;j<n;j++)for(let i=1;i<n;i++)us[j*(n+1)+i]+=dt/rho*(expectedP[j*n+i]-expectedP[j*n+i-1])/h;
 for(let j=1;j<n;j++)for(let i=0;i<n;i++)vs[j*n+i]+=dt/rho*(expectedP[j*n+i]-expectedP[(j-1)*n+i])/h;
 const outputs=[];
 for(const pc of ['jacobi','multigrid'])for(const offset of [0,17]){
  const p=projectFaces(us,vs,{nx:n,ny:n,dx:h,dy:h,rho,dt,tolerance:1e-12,maxIterations:4000,pressure:expectedP.map(x=>x+offset),...(pc==='multigrid'?{preconditioner:createNeumannMultigrid({nx:n,ny:n,dx:h,dy:h})}:{})});
  outputs.push({preconditioner:pc,initialPressureOffset:offset,...p,u:Array.from(p.u),v:Array.from(p.v),maximumPressureError:Math.max(...p.pressure.map((x,i)=>Math.abs(x-expectedP[i]))),maximumVelocityError:Math.max(...p.u.map((x,i)=>Math.abs(x-u[i])),...p.v.map((x,i)=>Math.abs(x-v[i])))});
 }
 projection.push({n,rho,dt,kind,expectedP,expectedU:Array.from(u),expectedV:Array.from(v),tentativeU:Array.from(us),tentativeV:Array.from(vs),outputs});
}
const manufactured=[];for(const [n,A,steps]of [[16,0,2048],[32,0,2048],[64,0,2048],[16,1,2048],[32,1,2048],[64,1,2048],[32,1,4096]]){
 const c={nx:n,ny:n,width:1,height:1,rho:1,cp:1,nu:1,alpha:.2,initial:300,leftTemperature:300,rightTemperature:300,scalarScheme:'central',pressurePreconditioner:'multigrid',pressureTolerance:1e-12,maxPressureIterations:4000},f=manufacturedCavity({velocityAmplitude:A}),m=createCavity(c,f),dt=.025/steps;let previous;
 for(let i=0;i<steps;i++){if(i===steps-1)previous=m.snapshot();m.step(dt,false);}const last=m.snapshot();manufactured.push({n,velocityAmplitude:A,steps,dt,config:c,previous,last});console.error(JSON.stringify({manufactured:n,A,steps,pressureRms:Math.sqrt(last.pressure.reduce((s,p)=>s+p*p,0)/last.pressure.length),divergence:last.divergence}));
}
const files=['dynamic/dev/cavity.mjs','dynamic/dev/manufactured-cavity.mjs','dynamic/dev/poisson-multigrid.mjs','scripts/support-forced/pressure_cases.mjs'];writeFileSync(out,JSON.stringify({projection,manufactured,sourceSHA256:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../../'+p,import.meta.url))).digest('hex')])),releaseApproved:false},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output:out.pathname,projectionCases:projection.length,manufacturedCases:manufactured.length}));
