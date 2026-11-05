// Explicit reduced model: one uniform temperature, prescribed convection only.
// This is not a coarse one-cell discretization of the radial PDE.
const finite=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error(name+'は有限値です。');return v;};
const positive=(v,name)=>{finite(v,name);if(v<=0)throw Error(name+'は正の値です。');return v;};
export function createLumpedRadial(config){
 const c=structuredClone(config),{geometry}=c,dimension=geometry==='sphere'?3:2;
 if(!['sphere','cylinder'].includes(geometry)||c.approximation!=='lumped')throw Error('集中近似は中実球/端面断熱円筒で明示的に選んでください。');
 for(const key of ['radius','k','rho','cp','initial'])positive(c[key],key);
 if(geometry==='cylinder')positive(c.length,'円筒の長さ');
 if(c.boundary?.type!=='convection'||c.materials||c.regions||c.outline||c.kTable||c.cpTable||(c.source??0)!==0)throw Error('集中近似は一様初期温度・一定物性・発熱なし・指定hの対流だけです。');
 positive(c.boundary.temperature,'流体絶対温度');finite(c.boundary.h,'h');if(c.boundary.h<0)throw Error('hは0以上です。');
 const R=c.radius,area=geometry==='sphere'?4*Math.PI*R*R:2*Math.PI*R*c.length,volume=geometry==='sphere'?4*Math.PI*R**3/3:Math.PI*R*R*c.length,
  Lc=volume/area,Bi=c.boundary.h*Lc/c.k,capacity=c.rho*c.cp*volume,conductance=c.boundary.h*area,rate=conductance/capacity;
 if(![area,volume,Lc,capacity].every(v=>Number.isFinite(v)&&v>0)||![Bi,conductance,rate].every(Number.isFinite))throw Error('集中近似の寸法/熱容量が数値範囲外です。');
 if(c.boundary.h>0&&!(conductance>0&&rate>0))throw Error('集中近似の熱流/応答率が浮動小数点で解像できません。');
 if(Bi>.1+8*Number.EPSILON)throw Error(`集中熱容量近似の適用基準Bi=h(V/A)/k≤0.1を超えています（Bi=${Bi.toPrecision(5)}）。半径方向の分布モデルを選んでください。`);
 const ambient=c.boundary.temperature,initialEnergy=capacity*(c.initial-273.15),signature=JSON.stringify([geometry,R,c.length??null,c.k,c.rho,c.cp,c.initial,c.boundary]);finite(initialEnergy,'初期顕熱');
 if(!Number.isFinite(conductance*(ambient-c.initial)))throw Error('集中近似の初期熱移動率が数値範囲外です。');
 let temperature=c.initial,time=0,steps=0,lastDt=0,lastPower=0,netInput=0;
 const temperatureAt=t=>{const x=-rate*t,decay=Math.exp(x);return decay>.5?c.initial+(ambient-c.initial)*(-Math.expm1(x)):ambient+(c.initial-ambient)*decay;};
 function snapshot(){const energy=capacity*(temperature-273.15),error=energy-initialEnergy-netInput;return {modelType:'lumped-radial-v1',signature,approximation:'lumped',temperature:[temperature],surfaceTemperature:temperature,outerInwardWatts:conductance===0?0:conductance*(ambient-temperature),time,steps,lastDt,lastPower,energy,energyReference:'273.15 K',netInput,energyError:error,relativeEnergyError:Math.abs(error)/Math.max(1,Math.abs(initialEnergy),Math.abs(netInput)),min:temperature,max:temperature,safeDt:null,BiLc:Bi,characteristicLength:Lc,uniformTemperatureAssumption:true};}
 function step(dt,returnState=true){
  positive(dt,'進行時間');const nextTime=time+dt;if(!Number.isFinite(nextTime)||nextTime<=time||steps>=Number.MAX_SAFE_INTEGER)throw Error('集中近似の時刻/更新回数が数値範囲外です。');
  const next=temperatureAt(nextTime),input=capacity*(next-c.initial),power=capacity*(next-temperature)/dt;
  if(![next,input,power,capacity*(next-273.15),conductance*(ambient-next)].every(Number.isFinite)||next<=0)throw Error('集中近似の温度/収支が数値範囲外です。');
  temperature=next;time=nextTime;steps++;lastDt=dt;lastPower=power;netInput=input;return returnState?snapshot():undefined;
 }
 function restore(s){
  if(!s||s.modelType!=='lumped-radial-v1'||s.signature!==signature||!Array.isArray(s.temperature)||s.temperature.length!==1||![s.temperature[0],s.time,s.lastDt,s.lastPower,s.netInput].every(Number.isFinite)||s.temperature[0]<=0||s.time<0||s.lastDt<0||!Number.isSafeInteger(s.steps)||s.steps<0)throw Error('復元する集中近似の状態が不正です。');
  const expected=temperatureAt(s.time),energy=capacity*(s.temperature[0]-273.15),error=energy-initialEnergy-s.netInput;
  if(![energy,error,conductance*(ambient-s.temperature[0])].every(Number.isFinite)||Math.abs(s.temperature[0]-expected)>256*Number.EPSILON*Math.max(1,c.initial,ambient)||Math.abs(error)>256*Number.EPSILON*Math.max(1,Math.abs(initialEnergy),Math.abs(s.netInput)))throw Error('集中近似の復元温度/保存則が指定条件と一致しません。');
  temperature=s.temperature[0];time=s.time;steps=s.steps;lastDt=s.lastDt;lastPower=s.lastPower;netInput=s.netInput;return snapshot();
 }
 function flux(){const watts=-snapshot().outerInwardWatts||0;return {radius:[0,R],outwardWatts:[0,watts],outwardFlux:[0,watts/area],surfaceOnly:true,centreConvention:'集中近似：表面の交換熱流のみ。内部勾配は計算していません。'};}
 snapshot();return {step,snapshot,restore,flux,initialFlux:flux,config:c,mesh:{geometry,n:1,radius:R,length:geometry==='cylinder'?c.length:null,dr:R,centres:[dimension*R/(dimension+1)],faces:[0,R],volumes:[volume],areas:[0,area],count:1,dimension,approximation:'lumped'},get time(){return time;},safeDt:Infinity};
}
