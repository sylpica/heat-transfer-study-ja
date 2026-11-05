// Development only: steady algebraic RANS mean U(y), unsteady passive mean T.
// This does not evolve momentum or resolve turbulent fluctuations.
import {createCessProfile} from './cess-profile.mjs';
const LAW='cess-steady-passive-temperature-v1';
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v;};
function sum(values){let s=0,e=0;for(const x of values){const y=x-e,t=s+y;e=(t-s)-y;s=t;}return s;}
export function createRansChannel(input){
 const c=structuredClone(input),allowed=new Set(['caseId','halfGap','nu','rho','cp','k','depth','width','nx','ny','direction','turbulentPrandtl','initial','timeIntegrator']);
 if(!c||Object.keys(c).some(key=>!allowed.has(key)))throw Error('開発用平均流の境界は周期x・断熱yに固定され、追加物理を暗黙に無視しません。');
 const timeIntegrator=c.timeIntegrator??'euler';if(!['euler','ssprk2'].includes(timeIntegrator))throw Error('時間積分はeulerまたはssprk2です。');
 const {nx,ny}=c;if(!Number.isSafeInteger(nx)||nx<4||nx>128||!Number.isSafeInteger(ny)||ny<8||ny>128||ny%2)throw Error('格子は横4〜128、縦は偶数8〜128です。');
 for(const name of ['width','depth','cp','k'])finite(c[name],name,true);
 finite(c.turbulentPrandtl,'仮定した乱流Pr数',true);if(c.turbulentPrandtl<.5||c.turbulentPrandtl>2)throw Error('乱流Pr数の開発用入力域は0.5〜2です。検証済み物性値ではありません。');
 const profile=createCessProfile({caseId:c.caseId,halfGap:c.halfGap,nu:c.nu,rho:c.rho,rows:ny,direction:c.direction??1}),meta=profile.meta;
 const N=nx*ny,H=meta.fullHeight,dx=finite(c.width/nx,'dx',true),dy=finite(H/ny,'dy',true),volume=finite(dx*dy*c.depth,'セル体積',true),capacity=finite(c.rho*c.cp*volume,'セル熱容量',true),totalCapacity=finite(N*capacity,'全熱容量',true),alpha=finite(c.k/(c.rho*c.cp),'分子熱拡散率',true);
 const velocity=Float64Array.from(profile.rowVelocity),rowAlpha=Float64Array.from(profile.eddyRatioAtCenters,e=>finite(alpha+c.nu*e/c.turbulentPrandtl,'行熱拡散率',true)),faceAlpha=Float64Array.from(profile.effectiveNuAtFaces,nu=>finite(alpha+(nu-c.nu)/c.turbulentPrandtl,'面熱拡散率',true));
 const initial=Array.isArray(c.initial)?c.initial:Array(N).fill(c.initial);
 if(initial.length!==N)throw Error('初期温度のセル数が一致しません。');initial.forEach(t=>finite(t,'初期絶対温度[K]',true));
 const initialMean=finite(sum(initial.map(v=>v/N)),'初期平均温度',true),T=Float64Array.from(initial),lo=Math.min(...initial),hi=Math.max(...initial),temperatureRoundoff=64*Number.EPSILON*hi;
 const sensibleEnergy=values=>finite(capacity*sum(Array.from(values,v=>v-273.15)),'基準273.15 Kの顕熱[J]');
 const excessEnergy=values=>finite(capacity*sum(Array.from(values,v=>v-initialMean)),'初期平均からの顕熱[J]'),initialExcess=excessEnergy(T),initialEnergy=sensibleEnergy(T);
 const rates=Float64Array.from(rowAlpha,(a,j)=>finite(Math.abs(velocity[j])/dx+2*a/dx**2+((j>0?faceAlpha[j]:0)+(j+1<ny?faceAlpha[j+1]:0))/dy**2,'陽解法の流出率',true));
 const safeDt=finite(.8/Math.max(...rates),'安定時間刻み',true),maxSpeed=Math.max(...velocity.map(Math.abs));
 const omittedHeatingRate=finite(meta.acceleration*meta.bulkVelocity/c.cp,'省略した平均仕事の温度換算[K/s]',true);
 const signature=JSON.stringify([LAW,c]),energyBudget=steps=>finite(totalCapacity*temperatureRoundoff*(1+Math.sqrt(steps)),'丸め誤差の収支予算',true);
 let time=0,steps=0,lastDt=0;
 function validateField(values,atStep){
  for(const t of values){finite(t,'受理温度[K]',true);if(t<lo-temperatureRoundoff||t>hi+temperatureRoundoff)throw Error('受動温度の最大原理に失敗したため受理しません。');}
  sensibleEnergy(values);const err=excessEnergy(values)-initialExcess;if(Math.abs(err)>energyBudget(atStep))throw Error('周期/断熱の温度収支に失敗したため受理しません。');return err;
 }
 function snapshot(){
  const error=excessEnergy(T)-initialExcess;
  return {law:LAW,signature,time,steps,lastDt,safeDt,timeIntegrator,stagesPerStep:timeIntegrator==='ssprk2'?2:1,temperature:Array.from(T),velocity:Array.from(velocity),rowEffectiveThermalDiffusivity:Array.from(rowAlpha),faceEffectiveThermalDiffusivity:Array.from(faceAlpha),min:Math.min(...T),max:Math.max(...T),meanTemperature:initialMean+excessEnergy(T)/totalCapacity,energy:sensibleEnergy(T),initialEnergy,energyError:error,netInput:0,energyRoundoffBudgetJ:energyBudget(steps),advectionCfl:maxSpeed*lastDt/dx,omittedMeanHeatingRateKPerS:omittedHeatingRate,omittedMeanHeatingEstimateK:finite(omittedHeatingRate*time,'省略した仕事の累積温度換算'),meanFlow:{...meta},turbulentPrandtl:c.turbulentPrandtl,meanFlowSteady:true,fluctuationsResolved:false,viscousHeatingIncluded:false,releaseApproved:false};
 }
 function temperatureRate(values){
  // Every face contributes equal and opposite temperature-volume rates.
  // Subtracting a fixed enthalpy datum makes a uniform field exactly stationary.
  const rate=new Float64Array(N);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   const n=j*nx+i,m=j*nx+(i+1)%nx,u=velocity[j],flux=rowAlpha[j]*(values[m]-values[n])/dx**2-u*((u>=0?values[n]:values[m])-initialMean)/dx;
   rate[n]+=flux;rate[m]-=flux;
   if(j+1<ny){const next=n+nx,q=faceAlpha[j+1]*(values[next]-values[n])/dy**2;rate[n]+=q;rate[next]-=q;}
  }
  return rate;
 }
 function step(dt,returnState=true){
  finite(dt,'時間刻み',true);if(dt>safeDt*(1+1e-12))throw Error('移流/渦拡散の陽解法安定条件を超えます。');
  const nextTime=finite(time+dt,'物理時間');if(nextTime<=time||!Number.isSafeInteger(steps+1))throw Error('時間/ステップ数をこれ以上解像できません。');finite(omittedHeatingRate*nextTime,'省略仕事の累積温度換算');
  const first=temperatureRate(T),predictor=Float64Array.from(T,(v,i)=>v+dt*first[i]);validateField(predictor,steps+1);
  let next=predictor;
  if(timeIntegrator==='ssprk2'){
   const second=temperatureRate(predictor);
   // Algebraic SSP convex combination of two admissible Euler steps. The
   // increment form avoids adding two large absolute-temperature baselines.
   next=Float64Array.from(T,(v,i)=>v+.5*dt*(first[i]+second[i]));validateField(next,steps+1);
  }
  T.set(next);time=nextTime;steps++;lastDt=dt;return returnState?snapshot():undefined;
 }
 function restore(s){
  if(!s||s.law!==LAW||s.signature!==signature||!Array.isArray(s.temperature)||s.temperature.length!==N)throw Error('復元状態のモデル/条件が一致しません。');
  finite(s.time,'復元時刻');finite(s.lastDt,'復元刻み');
  if(!Number.isSafeInteger(s.steps)||s.steps<0||s.time<0||s.lastDt<0||s.lastDt>safeDt*(1+1e-12)||(s.steps===0?(s.time!==0||s.lastDt!==0):(s.time<=0||s.lastDt<=0||s.time<s.lastDt||s.time>s.steps*safeDt*(1+1e-10))))throw Error('復元状態の時計/刻みが不正です。');
  if(s.steps===0&&s.temperature.some((v,i)=>v!==initial[i]))throw Error('初期時計の温度が初期条件と一致しません。');
  validateField(s.temperature,s.steps);finite(omittedHeatingRate*s.time,'復元省略仕事の温度換算');
  T.set(s.temperature);time=s.time;steps=s.steps;lastDt=s.lastDt;return snapshot();
 }
 validateField(T,0);
 return {step,snapshot,restore,safeDt,get time(){return time;},get config(){return structuredClone(c);},mesh:{nx,ny,width:c.width,height:H,depth:c.depth,dx,dy,count:N,mask:Array(N).fill(1)}};
}
