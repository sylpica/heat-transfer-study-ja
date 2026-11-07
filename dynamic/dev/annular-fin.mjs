// Development-only annular (circular) fin on a tube: radial 1D transient
// conduction with uniform face convection on both sides. The base at the
// inner radius is held at a prescribed temperature. Tip treatment is either
// an explicitly convecting tip face or the Schmidt corrected radius
// (r2c = r2 + t/2) with an insulated tip. No tube-wall, fluid, radiation,
// temperature-dependent-property or 2D conduction solution.
const LAW='annular-fin-radial-1d-v1';
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v;};
const sum=values=>{let s=0,e=0;for(const v of values){const y=v-e,t=s+y;e=(t-s)-y;s=t;}return s;};
const cleanZero=v=>v===0?0:v;
export function createAnnularFin(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('環状フィン条件はオブジェクトで指定してください。');
 const c=structuredClone(input),allowed=new Set(['innerRadius','outerRadius','thickness','cells','k','rho','cp','h','baseTemperature','ambient','initial','tipCondition','maxTemperature']);
 if(Object.keys(c).some(key=>!allowed.has(key)))throw Error('未対応の物理条件を暗黙に無視しません。');
 for(const key of ['innerRadius','outerRadius','thickness','k','rho','cp','baseTemperature','ambient'])finite(c[key],key,true);
 finite(c.h,'h');if(c.h<0)throw Error('hは0以上です。');
 const n=c.cells;if(!Number.isSafeInteger(n)||n<4||n>256)throw Error('環状フィンの格子は4〜256です。');
 if(!(c.outerRadius>c.innerRadius))throw Error('外半径は内半径より大きい値です。');
 const tipCondition=c.tipCondition??'convection';if(!['convection','corrected'].includes(tipCondition))throw Error('先端条件は convection（先端面対流）または corrected（修正半径・断熱先端）です。');
 const limit=finite(c.maxTemperature??10000,'監視温度上限[K]',true);
 if(c.baseTemperature>limit)throw Error('基部温度が監視上限を超えます。');
 const r1=c.innerRadius,r2=c.outerRadius,t=c.thickness,r2c=r2+t/2,R=tipCondition==='corrected'?r2c:r2;
 const Bi=finite(c.h*(t/2)/c.k,'厚さ方向Bi数');if(Bi>.1)throw Error('h(t/2)/k>0.1のため厚さ方向一様の1Dフィン近似の開発範囲を超えます。');
 const dr=finite((R-r1)/n,'セル幅',true),faces=Array.from({length:n+1},(_,i)=>r1+i*dr);faces[n]=R;
 const centres=faces.slice(0,n).map((a,i)=>{const b=faces[i+1];return (2/3)*(a*a+a*b+b*b)/(a+b);});
 const volumes=faces.slice(0,n).map((a,i)=>Math.PI*(faces[i+1]-a)*(faces[i+1]+a)*t);
 const faceAreas=volumes.map(v=>2*v/t),C=volumes.map(v=>finite(c.rho*c.cp*v,'セル熱容量',true));
 const logRatio=(a,b)=>Math.log1p((b-a)/a);
 const G0=finite(2*Math.PI*c.k*t/logRatio(r1,centres[0]),'基部コンダクタンス',true);
 const G=centres.slice(1).map((r,i)=>finite(2*Math.PI*c.k*t/logRatio(centres[i],r),'内部コンダクタンス',true));
 const Gs=faceAreas.map(a=>finite(c.h*a,'側面コンダクタンス')),Gt=tipCondition==='convection'?finite(c.h*2*Math.PI*r2*t,'先端コンダクタンス'):0;
 const Acb=finite(2*Math.PI*r1*t,'基部断面積',true),tipArea=tipCondition==='convection'?2*Math.PI*r2*t:0;
 const finArea=tipCondition==='corrected'?2*Math.PI*(r2c*r2c-r1*r1):2*Math.PI*(r2*r2-r1*r1)+tipArea;
 if(![...centres,...volumes,...faceAreas,...Gs].every(x=>Number.isFinite(x)&&x>0))throw Error('環状フィンの格子/熱容量/面積が数値範囲外です。');
 const m=finite(Math.sqrt(2*c.h/(c.k*t)),'フィン定数m'),thetaB=c.baseTemperature-c.ambient;
 const rates=C.map((cap,i)=>( (i?G[i-1]:G0)+ (i<n-1?G[i]:Gt) + Gs[i] )/cap),maxRate=Math.max(...rates),safeDt=finite(.8/maxRate,'安定時間刻み',true);
 const parsedInitial=Array.isArray(c.initial)?c.initial:Array(n).fill(c.initial);if(parsedInitial.length!==n)throw Error('初期温度の格子数が一致しません。');
 parsedInitial.forEach(v=>{finite(v,'初期絶対温度[K]',true);if(v>limit)throw Error('初期温度が監視上限を超えます。');});
 const initial=Float64Array.from(parsedInitial),signature=JSON.stringify([LAW,{...c,tipCondition,maxTemperature:limit,initial:Array.from(initial)}]);
 let T=Float64Array.from(initial),time=0,steps=0,lastDt=0,lastPower=0,netInput=0,netInputCompensation=0;
 const energy=tt=>finite(sum(Array.from(tt,(v,i)=>C[i]*(v-273.15))),'顕熱[J]'),initialEnergy=energy(T);
 const energyChange=tt=>finite(sum(Array.from(tt,(v,i)=>C[i]*(v-initial[i]))),'初期状態からの蓄熱[J]');
 const budget=(tt,input,atStep)=>finite(128*Number.EPSILON*(sum(Array.from(tt,(v,i)=>C[i]*Math.abs(v)))+Math.abs(input))*(1+Math.sqrt(atStep)),'収支丸め誤差予算',true);
 function powers(tt){
  const baseHeatRateW=G0*(c.baseTemperature-tt[0]),surfaceLossW=sum(Array.from(tt,(v,i)=>Gs[i]*(v-c.ambient))),tipLossW=Gt*(tt[n-1]-c.ambient),totalLossW=surfaceLossW+tipLossW;
  const out={baseHeatRateW,baseHeatFluxWPerM2:baseHeatRateW/Acb,surfaceLossW,tipLossW,totalLossW,netExternalPowerW:baseHeatRateW-totalLossW,
   efficiency:(c.h>0&&thetaB!==0)?totalLossW/(c.h*finArea*thetaB):null,effectiveness:(c.h>0&&thetaB!==0)?totalLossW/(c.h*Acb*thetaB):null};
  for(const [key,value]of Object.entries(out)){if(value!==null){finite(value,key);if(value===0)out[key]=0;}}return out;
 }
 function validate(tt,input,correction,atStep){
  for(const v of tt){finite(v,'受理温度[K]',true);if(v>limit)throw Error('温度が監視上限を超えました。');}
  finite(input,'累積外部熱入力[J]');finite(correction,'累積熱の補償値');energy(tt);const error=energyChange(tt)-input,allowance=budget(tt,input,atStep);
  if(Math.abs(error)>allowance||Math.abs(correction)>allowance)throw Error('環状フィン全体のエネルギー収支に失敗したため受理しません。');powers(tt);
 }
 const mesh={kind:'annular-fin-radial-1d',cells:n,innerRadius:r1,outerRadius:r2,solvedOuterRadius:R,correctedOuterRadius:tipCondition==='corrected'?r2c:null,thickness:t,dr,centres:[...centres],faces:[...faces],volumes:[...volumes],faceAreas:[...faceAreas],totalVolume:sum(volumes),finSurfaceAreaM2:finArea,baseCrossSectionM2:Acb,tipAreaM2:tipArea,mPerM:m,transverseBiot:Bi,tipCondition};
 function snapshot(){const p=powers(T);return {law:LAW,signature,time,steps,lastDt,lastPower,safeDt,temperature:Array.from(T),radii:[...centres],outerCellTemperature:T[n-1],energy:energy(T),initialEnergy,energyChange:energyChange(T),netInput,netInputCompensation,energyError:energyChange(T)-netInput,energyRoundoffBudgetJ:budget(T,netInput,steps),min:Math.min(...T),max:Math.max(...T),...p,assumptions:{constantProperties:true,prescribedUniformH:true,baseTemperatureFixed:true,tipCondition,correctedRadiusApproximation:tipCondition==='corrected',radiationIncluded:false,tubeWallResistanceIncluded:false,fluidInteractionResolved:false,twoDimensionalConductionResolved:false},releaseApproved:false};}
 function step(dt,returnState=true){
  finite(dt,'時間刻み',true);if(dt>safeDt*(1+1e-12))throw Error('環状フィンの陽解法安定条件を超えます。');const nextTime=finite(time+dt,'物理時刻');if(nextTime<=time||!Number.isSafeInteger(steps+1))throw Error('時刻またはステップ数をこれ以上解像できません。');
  const p=powers(T),next=Float64Array.from(T,(v,i)=>{
   let rate=(i?G[i-1]*(T[i-1]-v):G0*(c.baseTemperature-v))+(i<n-1?G[i]*(T[i+1]-v):0)-Gs[i]*(v-c.ambient);if(i===n-1)rate-=Gt*(v-c.ambient);return v+dt*rate/C[i];});
  const increment=finite(dt*p.netExternalPowerW,'1刻みの外部熱量'),y=increment-netInputCompensation,nextInput=finite(netInput+y,'累積外部熱量'),nextCorrection=(nextInput-netInput)-y;
  validate(next,nextInput,nextCorrection,steps+1);T=next;time=nextTime;steps++;lastDt=dt;lastPower=p.netExternalPowerW;netInput=nextInput;netInputCompensation=nextCorrection;return returnState?snapshot():undefined;
 }
 function restore(s){
  if(!s||s.law!==LAW||s.signature!==signature||!Array.isArray(s.temperature)||s.temperature.length!==n)throw Error('環状フィンの復元モデル/条件/格子が一致しません。');finite(s.time,'復元時刻');finite(s.lastDt,'復元刻み');finite(s.lastPower,'復元最終入力率');
  if(!Number.isSafeInteger(s.steps)||s.steps<0||s.time<0||s.lastDt<0||s.lastDt>safeDt*(1+1e-12)||(s.steps===0?(s.time!==0||s.lastDt!==0||s.lastPower!==0||s.netInput!==0):(s.time<=0||s.lastDt<=0||s.time<s.lastDt||s.time>s.steps*safeDt*(1+1e-10))))throw Error('復元の時計または積分履歴が不正です。');
  if(s.steps===0&&s.temperature.some((v,i)=>v!==initial[i]))throw Error('初期時計と初期温度が一致しません。');validate(s.temperature,s.netInput,s.netInputCompensation,s.steps);
  T=Float64Array.from(s.temperature);time=s.time;steps=s.steps;lastDt=s.lastDt;lastPower=s.lastPower;netInput=s.netInput;netInputCompensation=s.netInputCompensation;return snapshot();
 }
 validate(T,0,0,0);
 return {step,snapshot,restore,safeDt,mesh,get config(){return structuredClone({...c,tipCondition,maxTemperature:limit});},get time(){return time;}};
}
