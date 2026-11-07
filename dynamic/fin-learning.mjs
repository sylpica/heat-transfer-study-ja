// One-dimensional rectangular fins, prescribed lateral h, adiabatic tips.
export const FIN_INITIAL_POSE=Object.freeze({yaw:Math.PI/6,pitch:Math.PI/9});
export const FIN_CHOICES=Object.freeze({tradeoff:'長いほうは熱移動率が大きく、効率は小さい',both:'長いほうは熱移動率も効率も大きい',equal:'熱移動率も効率も同じになる'});
export function finLearningConfigs(n=48){
 if(![32,48].includes(n))throw Error('学習用の長いフィンは32または48セルです。');
 return [.1,.05].map((length,i)=>({nx:i?n/2:n,ny:1,width:length,height:.01,depth:.01,materials:[{k:200,rho:2700,cp:896}],initial:293.15,boundaries:{left:{type:'temperature',temperature:353.15},right:{type:'insulated'},top:{type:'insulated'},bottom:{type:'insulated'}},source:0,distributedConvection:{h:25,areaPerVolume:400,temperature:293.15}}));
}
export function finObservation(config,snapshot){
 const n=config.nx,L=config.width,A=config.height*config.depth,P=2*(config.height+config.depth),k=config.materials[0].k,h=config.distributedConvection.h,ambient=config.distributedConvection.temperature,base=config.boundaries.left.temperature,delta=base-ambient,dx=L/n;
 if(snapshot.temperature?.length!==n||snapshot.temperature.some(t=>!Number.isFinite(t)||t<=0)||![A,P,k,h,delta,dx].every(x=>Number.isFinite(x)&&x>0))throw Error('フィンの観察条件が不正です。');
 const basePower=2*k*A/dx*(base-snapshot.temperature[0]),sidePower=h*P*dx*snapshot.temperature.reduce((sum,t)=>sum+t-ambient,0),idealPower=h*P*L*delta,bareBasePower=h*A*delta;
 return {lengthM:L,basePowerW:basePower,sidePowerW:sidePower,efficiency:sidePower/idealPower,effectiveness:sidePower/bareBasePower,bareBasePowerW:bareBasePower,nearTipCellC:snapshot.temperature.at(-1)-273.15,nearTipPositionM:L-dx/2,netStoragePowerW:snapshot.lastPower};
}
export function steadyFinPrediction(config){
 const A=config.height*config.depth,P=2*(config.height+config.depth),L=config.width,k=config.materials[0].k,h=config.distributedConvection.h,delta=config.boundaries.left.temperature-config.distributedConvection.temperature;
 if(![A,P,L,k,h,delta].every(x=>Number.isFinite(x)&&x>0))throw Error('解析フィン条件が不正です。');
 const m=Math.sqrt(h*P/(k*A)),power=k*A*m*delta*Math.tanh(m*L);
 return {mPerM:m,mL:m*L,powerW:power,efficiency:power/(h*P*L*delta),effectiveness:power/(h*A*delta),crossSectionBi:h*A/(k*P)};
}
export class FinJourney{
 constructor(path='tutorial'){if(!['tutorial','prediction'].includes(path))throw Error('学習の進め方が不正です。');this.path=path;this.invalidate('');}
 invalidate(reason){this.prepared=false;this.prediction=null;this.result=null;this.located=false;this.rewound=false;this.reason=reason;}
 prepare({configs,snapshots}){
  this.invalidate('');if(configs?.length!==2||snapshots?.length!==2)throw Error('長短2条件のフィンを準備してください。');const expected=finLearningConfigs(configs[0]?.nx);
  for(let i=0;i<2;i++){const c=configs[i],e=expected[i],s=snapshots[i];if(['nx','ny','width','height','depth','initial','source'].some(k=>c[k]!==e[k])||c.materials?.length!==1||Object.entries(e.materials[0]).some(([k,v])=>c.materials[0][k]!==v)||c.materials[0].kTable||c.materials[0].cpTable||c.regions||c.outline||c.contactResistance||['left','right','top','bottom'].some(side=>c.boundaries?.[side]?.type!==e.boundaries[side].type||(side==='left'&&c.boundaries[side].temperature!==353.15))||Object.entries(e.distributedConvection).some(([k,v])=>c.distributedConvection?.[k]!==v)||s?.time!==0||s.temperature?.length!==e.nx||s.temperature.some(t=>t!==293.15))throw Error('学習用のフィン条件/初期状態が一致しません。');}
  this.configs=structuredClone(configs);this.prepared=true;
 }
 locate(pose){if(this.prepared&&[pose?.yaw,pose?.pitch].every(Number.isFinite)&&Math.hypot(Math.atan2(Math.sin(pose.yaw-FIN_INITIAL_POSE.yaw),Math.cos(pose.yaw-FIN_INITIAL_POSE.yaw)),Math.atan2(Math.sin(pose.pitch-FIN_INITIAL_POSE.pitch),Math.cos(pose.pitch-FIN_INITIAL_POSE.pitch)))>=.1)this.located=true;}
 predict(choice,time){if(this.path!=='prediction'||!this.prepared||this.prediction||time!==0||!Object.hasOwn(FIN_CHOICES,choice))throw Error('初期状態で予想を選び確定してください。');this.prediction=choice;}
 observe(snapshots){
  if(!this.prepared)return;if(snapshots?.length!==2||snapshots.some(s=>!Number.isFinite(s.time)||s.time<0)||Math.abs(snapshots[0].time-snapshots[1].time)>1e-9)throw Error('フィンを比較する時刻が一致しません。');const time=snapshots[0].time;
  if(this.path==='prediction'&&time>0&&!this.prediction){this.invalidate('予想の確定前に時間が進みました。専用条件を準備し直してください。');return;}
  if(this.result||time<600-1e-9)return;if(time>600+1e-9){this.invalidate('600秒を過ぎたため、専用条件を準備し直してください。');return;}
  const [long,short]=snapshots.map((s,i)=>finObservation(this.configs[i],s));
  if([long,short].some(r=>!Number.isFinite(r.netStoragePowerW)||Math.abs(r.netStoragePowerW)>1e-4||Math.abs(r.basePowerW-r.sidePowerW)>1e-4||r.efficiency<=0||r.efficiency>1)||long.sidePowerW<=short.sidePowerW||long.efficiency>=short.efficiency)throw Error('近似定常の熱収支/フィン効率を確認できませんでした。');
  this.result={time,long,short,observed:'tradeoff'};
 }
 rewind(snapshots){if(this.prepared&&this.result&&snapshots?.length===2&&snapshots.every(s=>s.time===0))this.rewound=true;}
 get canRun(){return this.prepared&&!this.result&&(this.path==='prediction'?!!this.prediction:this.located);}
 get complete(){return this.prepared&&!!this.result&&(this.path==='prediction'||this.located&&this.rewound);}
}
