// Independently written closed diffuse-gray, opaque, isothermal-surface network.
// View factors are supplied, not inferred from the illustrative layout.
import {SIGMA} from './thermal.mjs';
const finite=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error(`${name}は有限値で指定してください。`);return v;};
const positive=(v,name)=>{finite(v,name);if(v<=0)throw Error(`${name}は正の値です。`);return v;};
const fourthDifference=(a,b)=>(a-b)*(a+b)*(a*a+b*b);

function solve(matrix,rhs){
 const a=matrix.map((row,i)=>[...row,rhs[i]]),n=a.length;
 // Row-scaled partial pivoting; reject ill-conditioning rather than invent a radiosity.
 const scale=a.map(row=>Math.max(...row.slice(0,n).map(Math.abs)));
 for(let k=0;k<n;k++){
  let p=k;for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])/scale[i]>Math.abs(a[p][k])/scale[p])p=i;
  if(!scale[p]||Math.abs(a[p][k])<=64*Number.EPSILON*scale[p])throw Error('放射ネットワークが特異または悪条件です。閉じた完全反射面群や極端な放射率を見直してください。');
  [a[p],a[k]]=[a[k],a[p]];[scale[p],scale[k]]=[scale[k],scale[p]];
  for(let i=k+1;i<n;i++){const f=a[i][k]/a[k][k];for(let j=k+1;j<=n;j++)a[i][j]-=f*a[k][j];a[i][k]=0;}
 }
 const x=new Array(n).fill(0);
 for(let i=n-1;i>=0;i--){x[i]=(a[i][n]-a[i].slice(i+1,n).reduce((s,v,j)=>s+v*x[i+1+j],0))/a[i][i];finite(x[i],'射度の連立解');}
 let residual=0,norm=0;
 for(let i=0;i<n;i++){const ax=matrix[i].reduce((s,v,j)=>s+v*x[j],0);residual=Math.max(residual,Math.abs(ax-rhs[i]));norm=Math.max(norm,Math.abs(rhs[i]),matrix[i].reduce((s,v,j)=>s+Math.abs(v*x[j]),0));}
 if(residual>1e-10*Math.max(Number.MIN_VALUE,norm))throw Error('射度の連立方程式の残差が許容範囲を超えました。');
 return {x,relativeResidual:norm?residual/norm:0};
}

export function createRadiationNetwork(config){
 const c=structuredClone(config),surfaces=c.surfaces,F=c.viewFactors;
 if(!Array.isArray(surfaces)||surfaces.length<2||surfaces.length>12)throw Error('放射ネットワークは2〜12面で指定してください。');
 const n=surfaces.length,maxTemperature=positive(c.maxTemperature??2000,'監視上限温度[K]');finite(maxTemperature**4,'監視上限温度の4乗');
 const A=[],C=[],epsilon=[],P=[],initial=[],ids=new Set();
 surfaces.forEach((s,i)=>{const id=s.id??String(i+1);if(typeof id!=='string'||ids.has(id))throw Error('面のIDは一意の文字列にしてください。');ids.add(id);A.push(positive(s.area,'面積[m²]'));C.push(positive(s.capacity,'熱容量[J/K]'));epsilon.push(finite(s.emissivity,'放射率'));if(s.emissivity<0||s.emissivity>1)throw Error('放射率は0〜1です。');P.push(finite(s.power??0,'外部入力[W]'));initial.push(positive(s.temperature,'初期絶対温度[K]'));if(s.temperature>maxTemperature)throw Error('初期温度が監視上限を超えています。');});
 if(!Array.isArray(F)||F.length!==n||F.some(row=>!Array.isArray(row)||row.length!==n))throw Error('形態係数は面数と同じ正方行列で指定してください。');
 for(let i=0;i<n;i++){
  F[i].forEach(f=>{finite(f,'形態係数');if(f<0||f>1)throw Error('形態係数は0〜1です。');});
  if(Math.abs(F[i].reduce((a,b)=>a+b,0)-1)>1e-12)throw Error('閉鎖系の形態係数は各行の総和が1です。');
  for(let j=0;j<i;j++){const a=A[i]*F[i][j],b=A[j]*F[j][i];finite(a,'面積×形態係数');finite(b,'面積×形態係数');if(Math.abs(a-b)>1e-12*Math.max(a,b,Number.MIN_VALUE))throw Error('形態係数の相反関係 AᵢFᵢⱼ=AⱼFⱼᵢ を満たしていません。');}
 }
 const matrix=F.map((row,i)=>row.map((f,j)=>(i===j?1:0)-(1-epsilon[i])*f));
 const safeDt=positive(.2*Math.min(...C.map((v,i)=>v/(4*SIGMA*A[i]*maxTemperature**3))),'安定時間刻み');
 const inputPower=finite(P.reduce((s,p)=>s+p,0),'合計外部入力');
 let temperature=initial.slice(),time=0,netInput=0,steps=0,lastDt=0;
 const energy=t=>finite(t.reduce((s,v,i)=>s+C[i]*(v-273.15),0),'顕熱');
 const initialEnergy=energy(initial);
 function exchange(t){
  // Solve deviations from a common blackbody level, avoiding subtraction of
  // large nearly equal radiosities when surface temperatures almost coincide.
  const base=finite(SIGMA*t[0]**4,'黒体射出能'),rhs=t.map((v,i)=>finite(epsilon[i]*SIGMA*fourthDifference(v,t[0]),'射度方程式の右辺'));
  const {x,relativeResidual}=solve(matrix,rhs),radiosity=x.map(v=>finite(base+v,'射度')),irradiation=F.map(row=>finite(base+row.reduce((s,f,j)=>s+f*x[j],0),'照射量'));
  const pairPower=F.map((row,i)=>row.map((f,j)=>finite(A[i]*f*(x[i]-x[j]),'面間の正味放射[W]'))),outwardPower=pairPower.map(row=>finite(row.reduce((a,b)=>a+b,0),'正味放射出力'));
  return {radiosity,irradiation,pairPower,outwardPower,linearResidual:relativeResidual,radiationBalance:outwardPower.reduce((a,b)=>a+b,0)};
 }
 function validate(t){t.forEach(v=>{positive(v,'絶対温度[K]');if(v>maxTemperature)throw Error('温度が監視上限を超えました。時間刻み・外部入力・監視範囲を見直してください。');});}
 exchange(temperature); // Detect a disconnected all-mirror subsystem at initialization.
 function snapshot(){const e=energy(temperature),error=e-initialEnergy-netInput;return {temperature:temperature.slice(),time,energy:e,netInput,energyError:error,relativeEnergyError:Math.abs(error)/Math.max(1,Math.abs(initialEnergy),Math.abs(netInput)),steps,lastDt,lastPower:inputPower,safeDt,...exchange(temperature)};}
 function step(dt,returnState=true){
  positive(dt,'時間刻み[s]');if(dt>safeDt*(1+1e-12))throw Error('放射の時間刻みが安定性上限を超えています。');
  const q=exchange(temperature).outwardPower,predictor=temperature.map((t,i)=>t+dt*(P[i]-q[i])/C[i]);validate(predictor);
  const q2=exchange(predictor).outwardPower,next=temperature.map((t,i)=>t+dt*(P[i]-.5*(q[i]+q2[i]))/C[i]);validate(next);exchange(next);energy(next);
  const nextTime=finite(time+dt,'物理時間');if(nextTime<=time)throw Error('時間刻みが浮動小数点で区別できません。');const nextInput=finite(netInput+inputPower*dt,'累積外部入力');
  temperature=next;time=nextTime;netInput=nextInput;steps++;lastDt=dt;return returnState?snapshot():undefined;
 }
 function restore(s){
  if(!s||!Array.isArray(s.temperature)||s.temperature.length!==n||!Number.isInteger(s.steps)||s.steps<0)throw Error('放射の再生状態が不正です。');
  positive(s.time+1,'再生時間');if(s.time<0)throw Error('再生時間は0以上です。');finite(s.netInput,'再生の累積入力');finite(s.lastDt??0,'再生の時間刻み');validate(s.temperature);exchange(s.temperature);energy(s.temperature);
  temperature=s.temperature.slice();time=s.time;netInput=s.netInput;steps=s.steps;lastDt=s.lastDt??0;return snapshot();
 }
 return {step,snapshot,restore,safeDt,get time(){return time;},config:c};
}
