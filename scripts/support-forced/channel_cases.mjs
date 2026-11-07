// Support measurements only. Read Muse implementation without copying it into
// this branch; retrieve its pinned commit to work/ before running (see README).
import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createDevelopedChannel} from '../../dynamic/developed-channel.mjs';
import {createHeatedChannel} from '../../dynamic/dev/heated-channel.mjs';
import {createHeatedPipe} from '../../dynamic/dev/heated-pipe.mjs';
import {createWallTemperaturePipe} from '../../dynamic/dev/pipe-wall-temperature.mjs';
import {createCessProfile} from '../../dynamic/dev/cess-profile.mjs';
const root=new URL('../../',import.meta.url),out=new URL('docs/dynamic/support-forced/',root);
const pressure=[];
for(const [rho,nu,H,U] of [[1.177,1.575e-5,.01,.5],[1000,1e-6,.002,.1],[.7,.01,1,1]]){
 const cp=100,k=rho*cp*nu,L=10*H,base={width:L,height:H,depth:H,nx:8,ny:16,rho,cp,k,nu,bulkVelocity:U,initial:300,inlet:300},acceleration=12*nu*U/H**2;
 const plane=createHeatedChannel({...base,wallHeatFlux:0}).snapshot();
 for(const sign of [-1,1]){
  const c={width:L,height:H,depth:H,nx:8,ny:16,rho,cp,k,nu,initial:300,acceleration:sign*acceleration};
  pressure.push({model:'developed-channel',config:c,gradientPaPerM:createDevelopedChannel(c).snapshot().pressureGradient});
 }
 pressure.push({model:'heated-channel',config:base,gradientPaPerM:plane.meanFlow.pressureGradientPaPerM,shearPa:plane.meanFlow.wallShearMagnitudePa});
 const pipe={width:L,radius:H/2,nx:8,nr:8,rho,cp,k,nu,bulkVelocity:U,initial:300,inlet:300};
 for(const [model,m] of [['heated-pipe',createHeatedPipe({...pipe,wallHeatFlux:0})],['wall-temperature-pipe',createWallTemperaturePipe({...pipe,wallTemperature:300})]]){
  const s=m.snapshot();pressure.push({model,config:pipe,gradientPaPerM:s.pressureGradientPaPerM,shearPa:s.wallShearMagnitudePa});
 }
}
for(const direction of [-1,1]){const config={caseId:'MKM180',halfGap:.05,nu:1.5e-5,rho:1.2,rows:16,direction},m=createCessProfile(config);pressure.push({model:'cess-imposed-closure',config,output:m.meanFlow??m});}
const source=readFileSync(new URL('work/support3-muse-graetz-channel.mjs',root),'utf8');
if(createHash('sha256').update(source).digest('hex')!=='43a60f18d20653b328a51e6137c8d10a22b33d443088b0228df647d265be544b')throw Error('Pinned Muse source differs; do not label a different implementation as the reviewed commit.');
const {solveGraetzChannel}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const graetz=[];
for(const ny of [16,32,64,128])for(const type of ['wall-heat-flux','wall-temperature']){
 const config={width:type==='wall-heat-flux'?30:.5,height:.01,depth:.01,nx:type==='wall-heat-flux'?400:512,ny,dxGrowth:type==='wall-heat-flux'?1.03:1.02,rho:1.177,cp:1006,k:.0264,nu:1.575e-5,bulkVelocity:.5,inletTemperature:300,boundary:type==='wall-heat-flux'?{type,wallHeatFlux:50}:{type,wallTemperature:320}};
 const s=solveGraetzChannel(config);
 graetz.push({config,outlet:s.outlet,meanFlow:s.meanFlow,totalWallHeatRateW:s.totalWallHeatRateW,fluidHeatRateW:s.fluidHeatRateW,energyBalanceRelativeResidual:s.energyBalanceRelativeResidual,
  outletRowTemperatures:Array.from({length:ny},(_,j)=>s.temperature[j*s.mesh.nx+s.mesh.nx-1]),rowVelocity:s.rowVelocity,assumptions:s.assumptions,releaseApproved:s.releaseApproved});
}
const files=['dynamic/developed-channel.mjs','dynamic/dev/heated-channel.mjs','dynamic/dev/heated-pipe.mjs','dynamic/dev/pipe-wall-temperature.mjs','dynamic/dev/cess-profile.mjs'];
writeFileSync(new URL('CHANNEL_CASES.json',out),JSON.stringify({pressure,graetz,museSource:{branch:'feiris/graetz-channel-2',commit:'1eb670ba4eec9caa85ad678904b8de0371d6e91e',file:'dynamic/dev/graetz-channel.mjs',sha256:createHash('sha256').update(source).digest('hex'),readOnly:true,implementationCopiedIntoBranch:false},sourceSHA256:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(new URL(p,root))).digest('hex')])),releaseApproved:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pressureCases:pressure.length,graetz:graetz.map(c=>({ny:c.config.ny,boundary:c.config.boundary.type,nu:c.outlet.localNusselt,energy:c.energyBalanceRelativeResidual}))}));
