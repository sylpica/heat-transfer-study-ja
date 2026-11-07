// Ephemeral reflection, separate from quiz answers and persistent study data.
export const HEATING_CHOICES=Object.freeze({left:'左側の方が高温になる',right:'右側の方が高温になる',equal:'左右がほぼ同じ温度になる'});
export class HeatingJourney{
 constructor(path='tutorial'){if(!['tutorial','prediction'].includes(path))throw Error('学習の進め方が不正です。');this.path=path;this.prepared=false;this.located=false;this.prediction=null;this.result=null;this.rewound=false;this.reason='';}
 prepare({config,mesh,snapshot}){
  const left=config?.boundaries?.left,material=config?.materials?.[0];
  if(snapshot?.time!==0||config.initial!==293.15||left?.type!=='temperature'||left.temperature!==333.15||config.width!==.1||config.height!==.05||config.depth!==.005||config.source||config.contactResistance||config.outline||config.regions?.length||config.materials?.length!==1||material.k!==167||material.rho!==2700||material.cp!==896||material.kTable||material.cpTable||config.distributedConvection||['right','top','bottom'].some(k=>config.boundaries[k]&&config.boundaries[k].type!=='insulated')||!mesh||mesh.nx<24||mesh.ny<2||mesh.count!==mesh.nx*mesh.ny)throw Error('学習実験には専用の初期条件を準備してください。');
  if(![mesh.dx,mesh.dy].every(x=>Number.isFinite(x)&&x>0)||snapshot.temperature?.length!==mesh.count)throw Error('学習実験の格子または温度場が不正です。');
  this.mesh=structuredClone(mesh);this.prepared=true;this.located=false;this.prediction=null;this.result=null;this.rewound=false;this.reason='';
 }
 invalidate(reason){this.prepared=false;this.prediction=null;this.result=null;this.located=false;this.rewound=false;this.reason=reason;}
 locate(probe){if(this.prepared&&Number.isFinite(probe.x)&&Number.isFinite(probe.y)&&probe.x<=.35&&probe.x>=0&&probe.y>=0&&probe.y<1)this.located=true;}
 predict(choice,time){if(this.path!=='prediction'||!this.prepared||this.prediction||time!==0||!Object.hasOwn(HEATING_CHOICES,choice))throw Error('初期状態で予想を選んで確定してください。');this.prediction=choice;}
 observe(snapshot){
  if(!this.prepared)return;
  if(this.path==='prediction'&&snapshot.time>0&&!this.prediction){this.invalidate('予想の確定前に時間が進みました。もう一度、初期条件を準備してください。');return;}
  if(this.result||snapshot.time<5-1e-10)return;
  const {nx,ny,dx,dy}=this.mesh,j=Math.floor(ny/2),il=Math.floor(nx*.25),ir=Math.floor(nx*.75),left=snapshot.temperature[j*nx+il]-273.15,right=snapshot.temperature[j*nx+ir]-273.15;
  if(![left,right,snapshot.time].every(Number.isFinite))throw Error('学習実験の測定値が不正です。');
  const difference=left-right,observed=Math.abs(difference)<=.01?'equal':difference>0?'left':'right';this.result={time:snapshot.time,left,right,difference,observed,toleranceK:.01,leftPosition:[(il+.5)*dx,(j+.5)*dy],rightPosition:[(ir+.5)*dx,(j+.5)*dy]};
 }
 rewind(snapshot){if(this.prepared&&this.result&&snapshot.time===0)this.rewound=true;}
 get canRun(){return this.prepared&&!this.result&&(this.path==='tutorial'?this.located:!!this.prediction);}
 get complete(){return this.prepared&&!!this.result&&(this.path==='prediction'||this.located&&this.rewound);}
}
