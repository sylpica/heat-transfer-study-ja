// Ephemeral comparisons of volume means; separate from quiz grading/history.
export const RADIAL_CHOICES=Object.freeze({sphere:'球の平均温度が高い',cylinder:'円筒の平均温度が高い',equal:'ほぼ同じ平均温度になる'});
export function radialCoolingConfigs(n=64){
 if(![32,64].includes(n))throw Error('学習用の格子は32または64殻です。');
 return ['sphere','cylinder'].map(geometry=>({geometry,n,radius:.025,...(geometry==='cylinder'?{length:.1}:{}),k:167,rho:2700,cp:896,initial:353.15,source:0,boundary:{type:'temperature',temperature:293.15}}));
}
export class RadialJourney{
 constructor(path='tutorial'){if(!['tutorial','prediction'].includes(path))throw Error('学習の進め方が不正です。');this.path=path;this.invalidate('');}
 invalidate(reason){this.prepared=false;this.prediction=null;this.result=null;this.located=false;this.rewound=false;this.reason=reason;}
 prepare({configs,meshes,snapshots}){
  this.invalidate('');
  if(![configs,meshes,snapshots].every(a=>Array.isArray(a)&&a.length===2))throw Error('球Aと円筒Bの専用条件を準備してください。');
  const expected=radialCoolingConfigs(configs[0]?.n);
  for(let i=0;i<2;i++){
   const c=configs[i],m=meshes[i],s=snapshots[i],e=expected[i];
   if(!c||Object.entries(e).some(([k,v])=>k!=='boundary'&&c[k]!==v)||c.boundary?.type!=='temperature'||c.boundary.temperature!==293.15||c.kTable||c.cpTable||c.materials||c.regions||c.outline||m?.geometry!==e.geometry||m.n!==e.n||m.radius!==e.radius||m.volumes?.length!==e.n||m.volumes.some(v=>!Number.isFinite(v)||v<=0)||!Number.isFinite(m.volumes.reduce((a,b)=>a+b,0))||m.centres?.length!==e.n||m.centres.some(r=>!Number.isFinite(r)||r<=0||r>=e.radius)||m.areas?.length!==e.n+1||m.areas[0]!==0||m.areas.at(-1)<=0||m.areas.some(a=>!Number.isFinite(a)||a<0)||s?.time!==0||s.temperature?.length!==e.n||s.temperature.some(t=>t!==353.15)||s.surfaceTemperature!==293.15)throw Error('学習実験の条件/初期状態が一致しません。');
  }
  this.meshes=structuredClone(meshes);this.prepared=true;
 }
 locate(fraction){if(this.prepared&&Number.isFinite(fraction)&&fraction>=0&&fraction<=.3)this.located=true;}
 predict(choice,time){if(this.path!=='prediction'||!this.prepared||this.prediction||time!==0||!Object.hasOwn(RADIAL_CHOICES,choice))throw Error('初期状態で予想を選んで確定してください。');this.prediction=choice;}
 observe(snapshots){
  if(!this.prepared)return;
  if(!Array.isArray(snapshots)||snapshots.length!==2||snapshots.some(s=>!Number.isFinite(s.time)||s.time<0)||Math.abs(snapshots[0].time-snapshots[1].time)>1e-10)throw Error('観察する2条件の時刻が一致しません。');
  const time=snapshots[0].time;
  if(this.path==='prediction'&&time>0&&!this.prediction){this.invalidate('予想の確定前に時間が進みました。初期条件を準備し直してください。');return;}
  if(this.result||time<1-1e-10)return;
  if(time>1+1e-10){this.invalidate('1秒を過ぎたため、この学習の初期条件を準備し直してください。');return;}
  const measurements=snapshots.map((s,i)=>{const m=this.meshes[i],V=m.volumes.reduce((a,b)=>a+b,0),cell=Math.floor(m.n*.25);if(s.temperature?.length!==m.n||s.temperature.some(t=>!Number.isFinite(t)||t<=0))throw Error('学習の温度場が不正です。');return {mean:s.temperature.reduce((sum,t,j)=>sum+t*m.volumes[j]/V,0)-273.15,inner:s.temperature[cell]-273.15,radius:m.centres[cell],volume:V,area:m.areas.at(-1)};});
  const [sphere,cylinder]=measurements,difference=cylinder.mean-sphere.mean,observed=Math.abs(difference)<=.01?'equal':difference>0?'cylinder':'sphere';this.result={time,sphere,cylinder,difference,observed,toleranceK:.01};
 }
 rewind(snapshots){if(this.prepared&&this.result&&snapshots.length===2&&snapshots.every(s=>s.time===0))this.rewound=true;}
 get canRun(){return this.prepared&&!this.result&&(this.path==='prediction'?!!this.prediction:this.located);}
 get complete(){return this.prepared&&!!this.result&&(this.path==='prediction'||this.located&&this.rewound);}
}
