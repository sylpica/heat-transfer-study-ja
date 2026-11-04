import {rasterize,contains,polygon} from './geometry.mjs';
export const SIGMA=5.670374419e-8;
const pos=(v,name,zero=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(zero?v<0:v<=0))throw Error(`${name}は${zero?'0以上':'正'}の有限値で指定してください。`);return v;};
const num=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error(`${name}が有限値ではありません。`);return v;};
const sides=['left','right','bottom','top'];
function boundary(b={type:'insulated'}){
 if(!['insulated','temperature','flux','convection','radiation'].includes(b.type))throw Error('未対応の境界条件です。');
 if(['temperature','convection','radiation'].includes(b.type))pos(b.temperature,'境界の絶対温度[K]');
 if(b.type==='convection')pos(b.h,'熱伝達率',true);
 if(b.type==='radiation'){if(!Number.isFinite(b.temperature**4))throw Error('放射境界温度が計算範囲を超えています。');num(b.emissivity,'放射率');if(b.emissivity<0||b.emissivity>1)throw Error('放射率は0〜1です。');}
 if(b.type==='flux')num(b.flux,'内向き熱流束');return {...b};
}
export function createThermal(config){
 const c=structuredClone(config),{nx,ny}=c;
 if(!Number.isInteger(nx)||!Number.isInteger(ny)||nx<1||ny<1||nx>256||ny>256||nx*ny>16384)throw Error('格子は各1〜256、合計16384セル以下です。');
 const w=pos(c.width,'幅'),h=pos(c.height,'高さ'),z=pos(c.depth??.01,'奥行き'),dx=w/nx,dy=h/ny,V=pos(dx*dy*z,'セル体積');
 if(!Array.isArray(c.materials)||!c.materials.length)throw Error('物性値がありません。');
 c.materials.forEach(m=>{pos(m.k,'熱伝導率');pos(m.rho,'密度');pos(m.cp,'比熱');});
 const mesh=rasterize({...c,width:w,height:h}),mask=mesh.mask,N=nx*ny,material=new Uint16Array(N),source=new Float64Array(N),T=new Float64Array(N),C=new Float64Array(N),k=new Float64Array(N);
 for(const region of c.regions||[]){
  const p=polygon(region.points).points;if(region.material!==undefined&&(!Number.isInteger(region.material)||!c.materials[region.material]))throw Error('材料領域の物性がありません。');if(region.material===undefined&&region.source===undefined)throw Error('領域に材料または熱源を指定してください。');
  let hit=0;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const n=j*nx+i;if(mask[n]&&contains(p,(i+.5)*dx,(j+.5)*dy)){if(region.material!==undefined)material[n]=region.material;if(region.source!==undefined)source[n]=num(region.source,'体積発熱');hit++;}}
  if(!hit)throw Error('材料/発熱領域を格子が解像していません。');
 }
 const initial=c.initial; if(!Array.isArray(initial))pos(initial,'初期絶対温度[K]');else if(initial.length!==N)throw Error('初期温度場のセル数が一致しません。');
 for(let n=0;n<N;n++)if(mask[n]){const m=c.materials[material[n]];k[n]=m.k;C[n]=pos(m.rho*m.cp*V,'セル熱容量');T[n]=pos(Array.isArray(initial)?initial[n]:initial,'初期絶対温度[K]');source[n]+=num(c.source??0,'体積発熱');}
 const boundaries=Object.fromEntries(sides.map(s=>[s,boundary(c.boundaries?.[s])])),edge=boundary(c.edge),contacts=pos(c.contactResistance??0,'接触熱抵抗[m²K/W]',true),pairs=[],faces=[],sumG=new Float64Array(N);
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const n=j*nx+i;if(!mask[n])continue;
  for(const [di,dj,side,A,dist] of [[-1,0,'left',dy*z,dx],[1,0,'right',dy*z,dx],[0,-1,'bottom',dx*z,dy],[0,1,'top',dx*z,dy]]){
   const x=i+di,y=j+dj,m=y*nx+x,out=x<0||x>=nx||y<0||y>=ny;
   if(out||!mask[m]){const bc=out?boundaries[side]:edge,conductance=pos(2*k[n]*A/dist,'境界熱コンダクタンス');faces.push({n,bc,A,dist,side,conductance});
    sumG[n]+=bc.type==='temperature'||bc.type==='radiation'?conductance:bc.type==='convection'&&bc.h>0?A/(dist/(2*k[n])+1/bc.h):0;
   }else if(m>n){const R=material[n]===material[m]?0:contacts,G=pos(A/(dist/(2*k[n])+dist/(2*k[m])+R),'内部熱コンダクタンス');pairs.push({n,m,G,A,dist,di,dj});sumG[n]+=G;sumG[m]+=G;}
  }
 }
 const loss=c.distributedConvection;
 if(loss){pos(loss.h,'側面のh',true);pos(loss.areaPerVolume,'側面積/体積',true);pos(loss.temperature,'流体絶対温度');for(let n=0;n<N;n++)if(mask[n])sumG[n]+=loss.h*loss.areaPerVolume*V;}
 const safeDt=Math.min(...Array.from(C,(v,n)=>mask[n]&&sumG[n]>0?.8*v/sumG[n]:Infinity));
 if(!(safeDt>0))throw Error('格子/物性による安定時間刻みが不正です。');
 const initialEnergy=num(T.reduce((s,t,n)=>s+C[n]*(t-273.15),0),'初期エネルギー');let time=0,netInput=0,steps=0,lastDt=0,lastPower=0;
 function power(){
  const P=new Float64Array(N);let external=0;
  for(let n=0;n<N;n++)if(mask[n]){P[n]=source[n]*V;if(loss)P[n]+=loss.h*loss.areaPerVolume*V*(loss.temperature-T[n]);external+=P[n];}
  for(const {n,m,G} of pairs){const q=G*(T[m]-T[n]);P[n]+=q;P[m]-=q;}
  for(const {n,bc,A,dist,conductance} of faces){let q=0;
   if(bc.type==='temperature')q=conductance*(bc.temperature-T[n]);
   else if(bc.type==='flux')q=bc.flux*A;
   else if(bc.type==='convection'&&bc.h>0)q=A*(bc.temperature-T[n])/(dist/(2*k[n])+1/bc.h);
   else if(bc.type==='radiation'&&bc.emissivity>0){
    let a=Math.min(T[n],bc.temperature),b=Math.max(T[n],bc.temperature);
    for(let it=0;it<52;it++){const face=(a+b)/2,F=conductance*(T[n]-face)-bc.emissivity*SIGMA*A*(face**4-bc.temperature**4);if(!Number.isFinite(F))throw Error('放射の反復計算が有限範囲を超えました。');if(F>0)a=face;else b=face;}
    const face=(a+b)/2;q=conductance*(face-T[n]);
   }
   P[n]+=q;external+=q;
  }
  return {P,external};
 }
 function step(dt,returnState=true){
  pos(dt,'時間刻み');if(dt>safeDt*(1+1e-12))throw Error(`時間刻みが安定性の上限${safeDt.toPrecision(4)} sを超えています。`);
  const {P,external}=power(),next=new Float64Array(T);
  for(let n=0;n<N;n++)if(mask[n]){next[n]+=dt*P[n]/C[n];if(!Number.isFinite(next[n])||next[n]<=0)throw Error('温度が非有限値または0 K以下となるため、更新前に計算を停止しました。時間刻みと熱源を見直してください。');}
  num(next.reduce((sum,t,n)=>sum+C[n]*(t-273.15),0),'更新後のエネルギー');num(netInput+external*dt,'累積の熱流入');num(time+dt,'物理時間');
  T.set(next);time+=dt;netInput+=external*dt;steps++;lastDt=dt;lastPower=external;return returnState?snapshot():undefined;
 }
 function snapshot(){const energy=T.reduce((s,t,n)=>s+C[n]*(t-273.15),0),values=T.filter((_,n)=>mask[n]),error=energy-initialEnergy-netInput;return {temperature:Array.from(T),time,energy,netInput,energyError:error,relativeEnergyError:Math.abs(error)/Math.max(1,Math.abs(initialEnergy),Math.abs(netInput)),min:Math.min(...values),max:Math.max(...values),steps,lastDt,lastPower,safeDt:Number.isFinite(safeDt)?safeDt:null};}
 function restore(s){if(!s||s.temperature?.length!==N||![s.time,s.netInput,s.steps].every(Number.isFinite)||s.time<0||s.steps<0)throw Error('再生状態が不正です。');const next=Float64Array.from(s.temperature);for(let n=0;n<N;n++)if(mask[n])pos(next[n],'再生温度');T.set(next);time=s.time;netInput=s.netInput;steps=s.steps;lastDt=s.lastDt??0;lastPower=s.lastPower??0;return snapshot();}
 function flux(){const qx=new Float64Array(N),qy=new Float64Array(N),cx=new Uint8Array(N),cy=new Uint8Array(N);for(const {n,m,G,A,di,dj} of pairs){const q=G*(T[n]-T[m])/A;for(const cell of [n,m])if(di){qx[cell]+=q;cx[cell]++;}else{qy[cell]+=q;cy[cell]++;}}
  for(let n=0;n<N;n++){if(cx[n])qx[n]/=cx[n];if(cy[n])qy[n]/=cy[n];}return {x:Array.from(qx),y:Array.from(qy)};}
 return {step,snapshot,restore,flux,safeDt,get time(){return time;},mesh:{...mesh,nx,ny,width:w,height:h,depth:z,dx,dy,mask:Array.from(mask),material:Array.from(material)},config:c};
}
