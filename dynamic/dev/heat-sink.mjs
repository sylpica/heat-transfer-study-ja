// Development-only symmetric heat sink: one uniform-capacity base and N
// identical 1D rectangular fins. No fluid calculation or 3D temperature solve.
const LAW='uniform-base-identical-adiabatic-fins-v1';
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v;};
const sum=values=>{let s=0,e=0;for(const v of values){const y=v-e,t=s+y;e=(t-s)-y;s=t;}return s;};
export function createHeatSink(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('熱シンク条件はオブジェクトで指定してください。');
 const c=structuredClone(input),allowed=new Set(['baseWidth','baseDepth','baseThickness','finLength','finThickness','finCount','finCells','k','rho','cp','h','ambient','initialBase','initialFin','power','contactResistance','maxTemperature']);
 if(Object.keys(c).some(key=>!allowed.has(key)))throw Error('未対応の物理条件を暗黙に無視しません。');
 for(const key of ['baseWidth','baseDepth','baseThickness','finLength','finThickness','k','rho','cp','ambient','initialBase'])finite(c[key],key,true);
 for(const key of ['h','power'])finite(c[key],key);if(c.h<0)throw Error('hは0以上です。');
 const N=c.finCount,n=c.finCells;if(!Number.isSafeInteger(N)||N<0||N>64||!Number.isSafeInteger(n)||n<4||n>256)throw Error('フィン本数は0〜64、1本の格子は4〜256です。');
 const rc=finite(c.contactResistance??0,'面積接触熱抵抗[m²K/W]'),limit=finite(c.maxTemperature??10000,'監視温度上限[K]',true);if(rc<0)throw Error('接触抵抗は0以上です。');
 const occupied=finite(N*c.finThickness,'フィン占有幅'),gap=c.baseWidth-occupied,tolerance=16*Number.EPSILON*c.baseWidth;
 if(gap< -tolerance||(N>1&&gap<=tolerance))throw Error('フィンが重なるか接触しています。複数フィン間には正の隙間が必要です。');
 const Ac=finite(c.finThickness*c.baseDepth,'フィン根元断面積',true),P=finite(2*(c.finThickness+c.baseDepth),'フィン周長',true),dx=finite(c.finLength/n,'フィンセル長',true),Vb=finite(c.baseWidth*c.baseDepth*c.baseThickness,'基部体積',true),Vf=finite(Ac*dx,'フィンセル体積',true),Ab=finite(Math.max(0,gap)*c.baseDepth,'露出基部面積');
 const Cb=finite(c.rho*c.cp*Vb,'基部熱容量',true),Cf=finite(c.rho*c.cp*Vf,'1本1セルの熱容量',true),totalCapacity=finite(Cb+N*n*Cf,'全熱容量',true),Bi=finite(c.h*(Ac/P)/c.k,'断面Bi数');
 if(N&&Bi>.1)throw Error('h(A/P)/k>0.1のため断面一様の1Dフィン近似の開発範囲を超えます。');
 const G0=finite(Ac/(rc+dx/(2*c.k)),'基部と最初のフィンセルのコンダクタンス',true),Gi=finite(c.k*Ac/dx,'フィン内部コンダクタンス',true),Gs=finite(c.h*P*dx,'1セルの側面コンダクタンス'),Gb=finite(c.h*Ab,'露出基部コンダクタンス');
 const baseRate=finite((Gb+N*G0)/Cb,'基部の流出率'),finRate=N?finite(Math.max(G0+Gi+Gs,2*Gi+Gs)/Cf,'フィンの流出率'):0,maxRate=Math.max(baseRate,finRate),safeDt=maxRate>0?finite(.8/maxRate,'安定時間刻み',true):Infinity;
 const parsedFin=Array.isArray(c.initialFin)?c.initialFin:Array(n).fill(c.initialFin);if(parsedFin.length!==n)throw Error('初期フィン温度の格子数が一致しません。');
 parsedFin.forEach(v=>{finite(v,'初期フィン絶対温度[K]',true);if(v>limit)throw Error('初期フィン温度が監視上限を超えます。');});if(c.initialBase>limit)throw Error('初期基部温度が監視上限を超えます。');
 const initialFin=N?[...parsedFin]:[],T=Float64Array.from(initialFin),signature=JSON.stringify([LAW,c]),initialBase=c.initialBase;
 let Tb=initialBase,time=0,steps=0,lastDt=0,lastPower=0,netInput=0,netInputCompensation=0;
 const energy=(base,fins)=>finite(Cb*(base-273.15)+N*Cf*sum(Array.from(fins,v=>v-273.15)),'顕熱[J]'),initialEnergy=energy(Tb,T);
 const energyChange=(base,fins)=>finite(Cb*(base-initialBase)+N*Cf*sum(Array.from(fins,(v,i)=>v-initialFin[i])),'初期状態からの蓄熱[J]');
 const budget=(base,fins,input,atStep)=>finite(128*Number.EPSILON*(Cb*Math.abs(base)+N*Cf*sum(Array.from(fins,Math.abs))+Math.abs(input))*(1+Math.sqrt(atStep)),'収支丸め誤差予算',true);
 function powers(base,fins){
  const baseConvectionOutwardW=Gb*(base-c.ambient),finSideConvectionOutwardPerFinW=Gs*sum(Array.from(fins,v=>v-c.ambient)),baseToFinPerFinW=N?G0*(base-fins[0]):0,finTotalConvectionOutwardW=N*finSideConvectionOutwardPerFinW,baseToAllFinsW=N*baseToFinPerFinW,netExternalPowerW=c.power-baseConvectionOutwardW-finTotalConvectionOutwardW;
  const out={sourcePowerW:c.power,baseConvectionOutwardW,finSideConvectionOutwardPerFinW,finTotalConvectionOutwardW,baseToFinPerFinW,baseToAllFinsW,netExternalPowerW,baseStoragePowerW:c.power-baseConvectionOutwardW-baseToAllFinsW,finStoragePowerPerFinW:baseToFinPerFinW-finSideConvectionOutwardPerFinW};for(const [key,value]of Object.entries(out))finite(value,key);return out;
 }
 function validate(base,fins,input,correction,atStep){
  finite(base,'受理基部温度[K]',true);if(base>limit)throw Error('基部温度が監視上限を超えました。');for(const v of fins){finite(v,'受理フィン温度[K]',true);if(v>limit)throw Error('フィン温度が監視上限を超えました。');}
  finite(input,'累積外部熱入力[J]');finite(correction,'累積熱の補償値');energy(base,fins);const error=energyChange(base,fins)-input,allowance=budget(base,fins,input,atStep);if(Math.abs(error)>allowance||Math.abs(correction)>allowance)throw Error('熱シンク全体のエネルギー収支に失敗したため受理しません。');powers(base,fins);
 }
 const mesh={kind:'uniform-base-identical-1d-fins',finCells:n,finCount:N,baseWidth:c.baseWidth,baseDepth:c.baseDepth,baseThickness:c.baseThickness,finLength:c.finLength,finThickness:c.finThickness,dx,finCrossSection:Ac,finPerimeter:P,baseExposedArea:Ab,baseVolume:Vb,finCellVolume:Vf,uniformGap:Math.max(0,gap)/(N+1),baseCapacity:Cb,finCellCapacity:Cf,totalCapacity,representativeOnly:true};
 function snapshot(){return {law:LAW,signature,time,steps,lastDt,lastPower,safeDt,baseTemperature:Tb,finTemperature:Array.from(T),temperature:[Tb,...T],finCount:N,energy:energy(Tb,T),initialEnergy,netInput,netInputCompensation,energyError:energyChange(Tb,T)-netInput,energyRoundoffBudgetJ:budget(Tb,T,netInput,steps),min:Math.min(Tb,...T),max:Math.max(Tb,...T),transverseBiot:Bi,contactResistanceAreaM2KPerW:rc,contactResistancePerFinKPerW:rc/Ac,...powers(Tb,T),assumptions:{uniformBaseTemperature:true,identicalFins:true,uniformFinCrossSectionTemperature:true,prescribedUniformH:true,adiabaticTips:true,otherBaseFacesAdiabatic:true,fluidInteractionsResolved:false,baseSpreadingResolved:false,radiationIncluded:false,threeDimensionalConductionResolved:false},releaseApproved:false};}
 function step(dt,returnState=true){
  finite(dt,'時間刻み',true);if(dt>safeDt*(1+1e-12))throw Error('熱シンクの陽解法安定条件を超えます。');const nextTime=finite(time+dt,'物理時刻');if(nextTime<=time||!Number.isSafeInteger(steps+1))throw Error('時刻またはステップ数をこれ以上解像できません。');
  const p=powers(Tb,T),rates=Float64Array.from(T,v=>-Gs*(v-c.ambient));if(N){rates[0]+=p.baseToFinPerFinW;for(let i=0;i+1<n;i++){const q=Gi*(T[i]-T[i+1]);rates[i]-=q;rates[i+1]+=q;}}
  const nextBase=Tb+dt*p.baseStoragePowerW/Cb,nextFin=Float64Array.from(T,(v,i)=>v+dt*rates[i]/Cf),increment=finite(dt*p.netExternalPowerW,'1刻みの外部熱量'),y=increment-netInputCompensation,nextInput=finite(netInput+y,'累積外部熱量'),nextCorrection=(nextInput-netInput)-y;
  validate(nextBase,nextFin,nextInput,nextCorrection,steps+1);Tb=nextBase;T.set(nextFin);time=nextTime;steps++;lastDt=dt;lastPower=p.netExternalPowerW;netInput=nextInput;netInputCompensation=nextCorrection;return returnState?snapshot():undefined;
 }
 function restore(s){
  if(!s||s.law!==LAW||s.signature!==signature||!Array.isArray(s.finTemperature)||s.finTemperature.length!==T.length)throw Error('熱シンクの復元モデル/条件/格子が一致しません。');finite(s.time,'復元時刻');finite(s.lastDt,'復元刻み');finite(s.lastPower,'復元最終入力率');
  if(!Number.isSafeInteger(s.steps)||s.steps<0||s.time<0||s.lastDt<0||s.lastDt>safeDt*(1+1e-12)||(s.steps===0?(s.time!==0||s.lastDt!==0||s.lastPower!==0||s.netInput!==0):(s.time<=0||s.lastDt<=0||s.time<s.lastDt||Number.isFinite(safeDt)&&s.time>s.steps*safeDt*(1+1e-10))))throw Error('復元の時計または積分履歴が不正です。');
  if(s.steps===0&&(s.baseTemperature!==initialBase||s.finTemperature.some((v,i)=>v!==initialFin[i])))throw Error('初期時計と初期温度が一致しません。');validate(s.baseTemperature,s.finTemperature,s.netInput,s.netInputCompensation,s.steps);
  Tb=s.baseTemperature;T.set(s.finTemperature);time=s.time;steps=s.steps;lastDt=s.lastDt;lastPower=s.lastPower;netInput=s.netInput;netInputCompensation=s.netInputCompensation;return snapshot();
 }
 validate(Tb,T,0,0,0);
 return {step,snapshot,restore,safeDt,mesh,get config(){return structuredClone(c);},get time(){return time;}};
}
