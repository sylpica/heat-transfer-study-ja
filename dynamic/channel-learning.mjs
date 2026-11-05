// Learning state for the restricted developed channel, never general CFD.
export const CHANNEL_CHOICES=Object.freeze({opposite:'Aは右、Bは左へ運ばれる',same:'AもBも右へ運ばれる',stationary:'温度分布は移動しない'});
export function channelInitialTemperature(nx,ny,base,amplitude){
 if(!Number.isInteger(nx)||!Number.isInteger(ny)||nx<4||ny<8||nx>128||ny>128||![base,amplitude].every(Number.isFinite))throw Error('初期温度分布の格子/数値が不正です。');
 return Array.from({length:nx*ny},(_,n)=>{const x=(n%nx+.5)/nx,y=(Math.floor(n/nx)+.5)/ny,distance=Math.min(Math.abs(x-.25),1-Math.abs(x-.25));return base+amplitude*Math.exp(-((distance/.08)**2))*Math.sin(Math.PI*y)**2;});
}
export function channelLearningConfigs(nx=64,ny=24){
 if(!(nx===64&&ny===24||nx===32&&ny===12))throw Error('学習用の格子は64×24または32×12です。');
 return [1,-1].map(sign=>({nx,ny,width:.04,height:.01,depth:1,rho:1.177,cp:1006,k:.0264,nu:1.575e-5,acceleration:sign*.02/(1.177*.04),initial:channelInitialTemperature(nx,ny,300,1),sourceLabel:'空気300 Kの一定参考物性',warning:'浮力・粘性発熱なしの理想モデル。実際の入口/出口や、加熱壁からの熱伝達率は求めません。'}));
}
export function channelThermalHarmonic(config,snapshot){
 const {nx,ny,width}=config;if(!Number.isInteger(nx)||!Number.isInteger(ny)||nx<4||ny<8||!Number.isFinite(width)||width<=0||snapshot.temperature?.length!==nx*ny||snapshot.temperature.some(t=>!Number.isFinite(t)||t<=0))throw Error('温度分布の第1調和成分を計算できません。');
 const rows=[];let real=0,imaginary=0,mean=0;
 for(let j=0;j<ny;j++){
  const row=snapshot.temperature.slice(j*nx,(j+1)*nx),average=row.reduce((a,b)=>a+b,0)/nx;let re=0,im=0;mean+=average/ny;
  for(let i=0;i<nx;i++){const angle=2*Math.PI*(i+.5)/nx;re+=2/nx*(row[i]-average)*Math.cos(angle);im-=2/nx*(row[i]-average)*Math.sin(angle);}
  rows.push({realK:re,imaginaryK:im});real+=re/ny;imaginary+=im/ny;
 }
 const amplitude=Math.hypot(real,imaginary);if(!Number.isFinite(amplitude)||amplitude<1e-10)throw Error('温度の第1調和成分が小さすぎて向きを定義できません。');
 const angle=Math.atan2(-imaginary,real)-Math.PI/2,phase=Math.atan2(Math.sin(angle),Math.cos(angle));
 return {rows,realK:real,imaginaryK:imaginary,amplitudeK:amplitude,phaseRad:phase,equivalentDisplacementM:phase*width/(2*Math.PI),volumeMeanTemperatureK:mean};
}
export class ChannelJourney{
 constructor(path='tutorial'){if(!['tutorial','prediction'].includes(path))throw Error('学習の進め方が不正です。');this.path=path;this.invalidate('');}
 invalidate(reason){this.prepared=false;this.prediction=null;this.result=null;this.located=false;this.rewound=false;this.reason=reason;}
 prepare({configs,snapshots}){
  this.invalidate('');if(configs?.length!==2||snapshots?.length!==2)throw Error('A/Bの専用条件を準備してください。');
  const expected=channelLearningConfigs(configs[0]?.nx,configs[0]?.ny);
  for(let i=0;i<2;i++){const c=configs[i],s=snapshots[i],e=expected[i];if(Object.entries(e).some(([key,value])=>!['initial','warning','sourceLabel'].includes(key)&&c[key]!==value)||c.initial?.length!==e.initial.length||c.initial.some((t,j)=>t!==e.initial[j])||s?.time!==0||s.temperature?.length!==e.initial.length||s.temperature.some((t,j)=>t!==e.initial[j])||s.velocity?.length!==e.ny||s.velocity.some(u=>u!==0))throw Error('学習用の物性/圧力/初期状態が一致しません。');}
  this.configs=structuredClone(configs);this.initialMeans=snapshots.map((s,i)=>channelThermalHarmonic(configs[i],s).volumeMeanTemperatureK);this.prepared=true;
 }
 locate(probe){if(this.prepared&&Number.isFinite(probe?.x)&&Number.isFinite(probe?.y)&&probe.x>=.2&&probe.x<=.3&&probe.y>=.4&&probe.y<=.6)this.located=true;}
 predict(choice,time){if(this.path!=='prediction'||!this.prepared||this.prediction||time!==0||!Object.hasOwn(CHANNEL_CHOICES,choice))throw Error('初期状態で予想を選び確定してください。');this.prediction=choice;}
 observe(snapshots){
  if(!this.prepared)return;if(snapshots?.length!==2||snapshots.some(s=>!Number.isFinite(s.time)||s.time<0)||Math.abs(snapshots[0].time-snapshots[1].time)>1e-10)throw Error('観察する時刻が一致しません。');const time=snapshots[0].time;
  if(this.path==='prediction'&&time>0&&!this.prediction){this.invalidate('予想の確定前に時間が進みました。専用条件を準備し直してください。');return;}
  if(this.result||time<.125-1e-10)return;if(time>.125+1e-10){this.invalidate('0.125秒を過ぎたため、専用条件を準備し直してください。');return;}
  const measurements=snapshots.map((s,i)=>{if(s.velocity?.length!==this.configs[i].ny||s.velocity.some(u=>!Number.isFinite(u)))throw Error('速度分布が不正です。');return {...channelThermalHarmonic(this.configs[i],s),meanVelocityMPerS:s.velocity.reduce((a,b)=>a+b,0)/s.velocity.length};});
  if(measurements.some((m,i)=>Math.abs(m.volumeMeanTemperatureK-this.initialMeans[i])>1e-7)||measurements[0].phaseRad<=.01||measurements[1].phaseRad>=-.01||measurements[0].meanVelocityMPerS<=0||measurements[1].meanVelocityMPerS>=0)throw Error('学習用の顕熱/流れ/温度分布の向きが一致しません。');
  this.result={time,a:measurements[0],b:measurements[1],observed:'opposite'};
 }
 rewind(snapshots){if(this.prepared&&this.result&&snapshots?.length===2&&snapshots.every(s=>s.time===0))this.rewound=true;}
 get canRun(){return this.prepared&&!this.result&&(this.path==='prediction'?!!this.prediction:this.located);}
 get complete(){return this.prepared&&!!this.result&&(this.path==='prediction'||this.located&&this.rewound);}
}
