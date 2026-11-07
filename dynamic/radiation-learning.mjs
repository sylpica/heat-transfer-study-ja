// Two uniform ideal surfaces; reflection is solved by the existing network.
export const RADIATION_CHOICES=Object.freeze({weighted:'80℃へ近づく',arithmetic:'110℃へ近づく',cold:'20℃へ近づく'});
export function radiationLearningConfig(){return {surfaces:[{id:'surface-1',area:1,capacity:200,temperature:473.15,emissivity:.8,power:0},{id:'surface-2',area:1,capacity:400,temperature:293.15,emissivity:.6,power:0}],viewFactors:[[0,1],[1,0]],maxTemperature:600};}
export class RadiationJourney{
 constructor(path='tutorial'){if(!['tutorial','prediction'].includes(path))throw Error('学習の進め方が不正です。');this.path=path;this.invalidate('');}
 invalidate(reason){this.prepared=false;this.prediction=null;this.result=null;this.located=false;this.rewound=false;this.reason=reason;}
 prepare({configs,snapshots}){
  this.invalidate('');const expected=radiationLearningConfig(),c=configs?.[0],s=snapshots?.[0];
  if(configs?.length!==1||snapshots?.length!==1||c?.surfaces?.length!==2||c.maxTemperature!==600||JSON.stringify(c.viewFactors)!==JSON.stringify(expected.viewFactors)||c.surfaces.some((surface,i)=>Object.entries(expected.surfaces[i]).some(([key,value])=>surface[key]!==value))||s?.time!==0||s.temperature?.length!==2||s.temperature[0]!==473.15||s.temperature[1]!==293.15)throw Error('学習用の2面と初期状態を準備してください。');
  this.prepared=true;
 }
 locate(face){if(this.prepared&&face===0)this.located=true;}
 predict(choice,time){if(this.path!=='prediction'||!this.prepared||this.prediction||time!==0||!Object.hasOwn(RADIATION_CHOICES,choice))throw Error('初期状態で予想を選び、確定してください。');this.prediction=choice;}
 observe(snapshots){
  if(!this.prepared)return;const s=snapshots?.[0];if(snapshots?.length!==1||!Number.isFinite(s?.time)||s.time<0)throw Error('観察状態が不正です。');
  if(this.path==='prediction'&&s.time>0&&!this.prediction){this.invalidate('予想の確定前に時間が進みました。初期条件を準備し直してください。');return;}
  if(this.result||s.time<20-1e-10)return;
  if(s.time>20+1e-10){this.invalidate('20秒を過ぎたため、初期条件を準備し直してください。');return;}
  if(s.temperature?.length!==2||s.temperature.some(t=>!Number.isFinite(t)||t<=0)||s.outwardPower?.length!==2||s.outwardPower.some(q=>!Number.isFinite(q)))throw Error('観察する温度/出力が不正です。');
  const hot=s.temperature[0]-273.15,cold=s.temperature[1]-273.15,weighted=(200*hot+400*cold)/600,lost=200*(200-hot),gained=400*(cold-20);
  if(Math.abs(weighted-80)>1e-7||Math.abs(lost-gained)>1e-5||hot<cold||hot>200||cold<20||s.outwardPower[0]<0||s.outwardPower[1]>0)throw Error('学習用の閉鎖系の温度/保存則/向きが一致しません。');
  this.result={time:s.time,hot,cold,weighted,lost,gained,outwardPower:[...s.outwardPower],observed:'weighted',equilibriumC:80};
 }
 rewind(snapshots){if(this.prepared&&this.result&&snapshots?.length===1&&snapshots[0].time===0)this.rewound=true;}
 get canRun(){return this.prepared&&!this.result&&(this.path==='prediction'?!!this.prediction:this.located);}
 get complete(){return this.prepared&&!!this.result&&(this.path==='prediction'||this.located&&this.rewound);}
}
