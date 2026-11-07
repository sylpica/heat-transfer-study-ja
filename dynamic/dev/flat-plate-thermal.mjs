// Development-only passive temperature in a prescribed steady Blasius flow.
import {createBlasiusBoundaryFlow} from './blasius-boundary-flow.mjs';
const LAW='Blasius-passive-boundary-layer-FV-SSPRK2-v1';
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v===0?0:v;};
const sum=values=>{let s=0,e=0;for(const x of values){const y=x-e,t=s+y;e=(t-s)-y;s=t;}return finite(s,'積分');};
export function createFlatPlateThermal(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('平板の熱輸送条件が必要です。');
 const c=structuredClone(input),flowKeys=['width','height','depth','nx','ny','nu','rho','freeStreamVelocity'],allowed=new Set([...flowKeys,'cp','k','inletTemperature','wallTemperature','initial','maxTemperature']);
 if(Object.keys(c).some(key=>!allowed.has(key)))throw Error('未対応の温度/流れ条件を暗黙に無視しません。');
 for(const name of ['cp','k','inletTemperature','wallTemperature'])finite(c[name],name,true);
 c.maxTemperature=finite(c.maxTemperature??2000,'絶対温度の監視上限',true);c.initial??=c.inletTemperature;
 const flow=createBlasiusBoundaryFlow(Object.fromEntries(flowKeys.map(k=>[k,c[k]]))),{nx,ny,dx,dy,cellVolume}=flow.mesh,N=nx*ny,rhoCp=finite(c.rho*c.cp,'体積熱容量',true),C=finite(rhoCp*cellVolume,'セル熱容量',true),alpha=finite(c.k/rhoCp,'熱拡散率',true),Pr=finite(c.nu/alpha,'Pr',true);
 if(Pr<.6*(1-8*Number.EPSILON)||Pr>2*(1+8*Number.EPSILON))throw Error('温度の開発範囲はPr=.6〜2です。');
 const ambient=c.inletTemperature,wallOffset=c.wallTemperature-ambient,initial=Array.isArray(c.initial)?c.initial.slice():Array(N).fill(c.initial);
 if(initial.length!==N)throw Error('全セルの初期温度が必要です。');
 for(const t of [c.wallTemperature,ambient,...initial]){finite(t,'入力絶対温度',true);if(t>c.maxTemperature||Math.abs(t-ambient)>ambient*.1*(1+8*Number.EPSILON))throw Error('監視上限または基準温度から10%の小温度差範囲を超えます。');}
 const theta0=Float64Array.from(initial,t=>t-ambient),theta=theta0.slice(),lower=theta0.reduce((m,x)=>Math.min(m,x),Math.min(0,wallOffset)),upper=theta0.reduce((m,x)=>Math.max(m,x),Math.max(0,wallOffset)),thetaScale=Math.max(Math.abs(lower),Math.abs(upper)),G=finite(c.k*dx*c.depth/dy,'y熱伝導コンダクタンス',true),Fx=Float64Array.from(flow.xVolumeFluxM3PerS,q=>finite(rhoCp*q,'x熱容量流量')),Fy=Float64Array.from(flow.yVolumeFluxM3PerS,q=>finite(rhoCp*q,'y熱容量流量'));
 let maximumRate=0;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)maximumRate=Math.max(maximumRate,finite((Fx[j*(nx+1)+i+1]+Fy[(j+1)*nx+i]+G*((j===0||j===ny-1)?3:2))/C,'セル流出/伝導率',true));
 const safeDt=finite(.8/maximumRate,'安定時間刻み',true),totalCapacity=finite(C*N,'全熱容量',true),signature=JSON.stringify(Object.fromEntries(Object.keys(c).sort().map(k=>[k,c[k]]))),mesh=Object.freeze({...flow.mesh,cellCapacity:C,flowU:flow.u,flowV:flow.v}),scratch1=new Float64Array(N),scratch2=new Float64Array(N),stage=new Float64Array(N),next=new Float64Array(N);
 if(thetaScale>0){finite(totalCapacity*thetaScale,'保持温度差の全熱量尺度',true);finite(G*thetaScale,'伝導熱量尺度',true);finite(Math.max(Fx.reduce((a,b)=>Math.max(a,b),0),Fy.reduce((a,b)=>Math.max(a,b),0))*thetaScale,'移流熱量尺度',true);finite(2*maximumRate*thetaScale,'温度変化率の上界',true);finite(4*c.k*thetaScale/dy,'壁熱流束の上界',true);finite(4*G*thetaScale*nx,'板/上端熱の上界',true);finite(flow.diagnostics.positiveBoundaryFlowL1ScaleM3PerS*rhoCp*thetaScale,'全境界移流熱の上界',true);}
 let time=0,steps=0,lastDt=0,lastPower=0,cumulative=Array(5).fill(0),correction=Array(5).fill(0);
 // Components: plate in, upper diffusion in, right advection out, upper
 // advection out, signed net in. Enthalpy reference is the inlet temperature.
 function evaluate(values,rates){
  rates.fill(0);const plate=[],topDiff=[],right=[],topAdv=[];
  for(let j=0;j<ny;j++){
   const last=j*nx+nx-1,out=Fx[j*(nx+1)+nx]*values[last];rates[last]-=out;right.push(out);
   for(let i=0;i<nx-1;i++){const n=j*nx+i,f=Fx[j*(nx+1)+i+1]*values[n];rates[n]-=f;rates[n+1]+=f;}
  }
  for(let j=0;j<ny-1;j++)for(let i=0;i<nx;i++){const n=j*nx+i,up=n+nx,adv=Fy[(j+1)*nx+i]*values[n],diff=G*(values[up]-values[n]);rates[n]-=adv;rates[up]+=adv;rates[n]+=diff;rates[up]-=diff;}
  for(let i=0;i<nx;i++){
   const top=(ny-1)*nx+i,a=2*G*(wallOffset-values[i]),b=-2*G*values[top],adv=Fy[ny*nx+i]*values[top];rates[i]+=a;rates[top]+=b-adv;plate.push(a);topDiff.push(b);topAdv.push(adv);
  }
  if(rates.some(x=>!Number.isFinite(x)))throw Error('熱流または温度変化率が非有限です。');
  const components=[sum(plate),sum(topDiff),sum(right),sum(topAdv)];components.push(sum([components[0],components[1],-components[2],-components[3]]));return components;
 }
 function storage(values){return finite(C*sum(Array.from(values,(t,i)=>t-theta0[i])),'蓄熱変化');}
 function energyBudget(values,parts,count){return finite(1024*Number.EPSILON*(C*(sum(Array.from(values,Math.abs))+sum(Array.from(theta0,Math.abs)))+sum(parts.map(Math.abs)))*(1+Math.sqrt(count)),'収支丸め予算');}
 function validateTheta(values,count){
  const tolerance=128*Number.EPSILON*thetaScale*(1+Math.sqrt(count));
  for(const t of values)if(!Number.isFinite(t)||!Number.isFinite(ambient+t)||ambient+t<=0||ambient+t>c.maxTemperature||t<lower-tolerance||t>upper+tolerance)throw Error('温度の有限性・絶対温度・離散最大原理を満たしません。');
 }
 function validateState(values,parts,errors,count){
  validateTheta(values,count);if(parts.length!==5||errors.length!==5||[...parts,...errors].some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('全成分の積算熱が必要です。');
  const budget=energyBudget(values,parts,count);if(errors.some(x=>Math.abs(x)>budget)||Math.abs(storage(values)-parts[4])>budget||Math.abs(parts[0]+parts[1]-parts[2]-parts[3]-parts[4])>budget)throw Error('温度と全境界の積算熱収支が一致しません。');
 }
 function describe(values,parts,errors,count,clock,dt,power){
  const p=evaluate(values,scratch1),wallFlux=Array.from({length:nx},(_,i)=>finite(2*c.k*(wallOffset-values[i])/dy,'板の区間平均熱流束')),meanNu=wallOffset===0?null:finite(2*dx/dy*sum(Array.from({length:nx},(_,i)=>(wallOffset-values[i])/wallOffset)),'板平均Nu_L');
  return {law:LAW,signature,time:clock,steps:count,lastDt:dt,lastPower:power,safeDt,temperature:Array.from(values,t=>ambient+t),offsetTemperature:Array.from(values),temperatureRatesKPerS:Array.from(scratch1,r=>finite(r/C,'温度変化率')),cumulativeComponentJ:parts.slice(),cumulativeCompensationJ:errors.slice(),energyRelativeToInletJ:finite(C*sum(values),'基準相対熱量'),storageChangeJ:storage(values),netInputJ:parts[4],energyErrorJ:storage(values)-parts[4],relativeEnergyError:(C*(sum(Array.from(values,Math.abs))+sum(Array.from(theta0,Math.abs)))+sum(parts.map(Math.abs)))===0?0:Math.abs(storage(values)-parts[4])/(C*(sum(Array.from(values,Math.abs))+sum(Array.from(theta0,Math.abs)))+sum(parts.map(Math.abs))),energyRoundoffBudgetJ:energyBudget(values,parts,count),instantaneousPowersW:{plateInput:p[0],upperDiffusiveInput:p[1],rightAdvectiveOutput:p[2],upperAdvectiveOutput:p[3],inletReferenceEnthalpy:0,netInput:p[4]},wallHeatFluxWPerM2:wallFlux,meanPlateNusselt:meanNu,localNusseltUsingIntervalMeanHeat:wallOffset===0?Array(nx).fill(null):wallFlux.map((q,i)=>finite(2*((wallOffset-values[i])/wallOffset)*(i+.5)*dx/dy,'区間平均熱流束からの局所Nu')),outletFlowMeanTemperatureK:finite(ambient+p[2]/finite(rhoCp*flow.diagnostics.outletVolumeFlowM3PerS,'出口熱容量流量',true),'流量平均出口絶対温度',true),flowDiagnostics:{...flow.diagnostics},Pr,alpha,referenceTemperatureK:ambient,assumptions:{prescribedSteadyBlasius:true,passiveTemperature:true,axialConductionOmitted:true,buoyancyOmitted:true,viscousHeatingOmitted:true,upperAdvectionIncluded:true,finiteOuterTemperatureBoundary:true,fullNavierStokesSolved:false,timeIntegrator:'SSPRK2',temperatureSpatialScheme:'upwind-advection-central-y-diffusion',generalCFDAccuracyVerified:false},releaseApproved:false};
 }
 function snapshot(){return describe(theta,cumulative,correction,steps,time,lastDt,lastPower);}
 function step(dt,returnState=true){
  finite(dt,'時間刻み',true);if(dt>safeDt*(1+8*Number.EPSILON))throw Error('移流/拡散の安定時間刻みを超えます。');const target=finite(time+dt,'次の時刻');if(target<=time||!Number.isSafeInteger(steps+1))throw Error('時刻/ステップをこれ以上解像できません。');
  const p1=evaluate(theta,scratch1);for(let i=0;i<N;i++)stage[i]=theta[i]+dt*scratch1[i]/C;validateTheta(stage,steps+1);const p2=evaluate(stage,scratch2);for(let i=0;i<N;i++)next[i]=theta[i]+dt*(scratch1[i]+scratch2[i])/(2*C);
  const parts=[],errors=[];for(let i=0;i<5;i++){const increment=finite(dt*(p1[i]/2+p2[i]/2),'成分の熱量'),y=increment-correction[i],value=finite(cumulative[i]+y,'積算成分熱量');parts.push(value);errors.push((value-cumulative[i])-y);}
  validateState(next,parts,errors,steps+1);const nextPower=finite(p1[4]/2+p2[4]/2,'刻み平均入力'),report=returnState?describe(next,parts,errors,steps+1,target,dt,nextPower):null;theta.set(next);cumulative=parts;correction=errors;time=target;steps++;lastDt=dt;lastPower=nextPower;return returnState?report:undefined;
 }
 function restore(s){
  if(!s||s.law!==LAW||s.signature!==signature||!Array.isArray(s.offsetTemperature)||s.offsetTemperature.length!==N||!Array.isArray(s.temperature)||s.temperature.length!==N||!Array.isArray(s.cumulativeComponentJ)||!Array.isArray(s.cumulativeCompensationJ))throw Error('復元のモデル/条件/格子/全履歴が一致しません。');
  for(const name of ['time','lastDt','lastPower'])finite(s[name],'復元'+name);if(!Number.isSafeInteger(s.steps)||s.steps<0||s.time<0||s.lastDt<0||s.lastDt>safeDt*(1+8*Number.EPSILON)||(s.steps===0?(s.time!==0||s.lastDt!==0||s.lastPower!==0||s.cumulativeComponentJ.some(x=>x!==0)||s.cumulativeCompensationJ.some(x=>x!==0)||s.offsetTemperature.some((t,i)=>t!==theta0[i])):(s.time<=0||s.lastDt<=0||s.time<s.lastDt||s.time>s.steps*safeDt*(1+1e-10))))throw Error('復元時計/初期状態が不正です。');
  if(s.temperature.some((t,i)=>t!==ambient+s.offsetTemperature[i]))throw Error('保持温度差と絶対温度表示が一致しません。');validateState(s.offsetTemperature,s.cumulativeComponentJ,s.cumulativeCompensationJ,s.steps);
  // Validate output diagnostics before accepting the candidate state.
  const report=describe(s.offsetTemperature,s.cumulativeComponentJ,s.cumulativeCompensationJ,s.steps,s.time,s.lastDt,s.lastPower);theta.set(s.offsetTemperature);cumulative=s.cumulativeComponentJ.slice();correction=s.cumulativeCompensationJ.slice();time=s.time;steps=s.steps;lastDt=s.lastDt;lastPower=s.lastPower;return report;
 }
 validateState(theta,cumulative,correction,0);snapshot();finite(totalCapacity,'全熱容量',true);
 return {step,snapshot,restore,safeDt,mesh,get config(){return structuredClone(c);},get time(){return time;}};
}
