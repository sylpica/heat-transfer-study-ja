// Development-only 3D transient conduction in an axis-aligned brick:
// cell-centred finite volumes on a grid that is uniform along each axis,
// constant properties, a uniform initial temperature, and one boundary
// condition per face chosen from the same kinds as the 2D model in
// dynamic/thermal.mjs (temperature / flux / convection / insulated).
// Time integration is explicit (forward Euler); the stability limit of
// the discrete system is computed at construction and reported as
// safeDt, and step() refuses any larger step. No temperature-dependent
// properties, radiation coupling, volumetric sources, multi-material
// regions or non-brick geometry.
const LAW='transient-brick-3d-fvm-v1';
const REFERENCE_K=273.15;
const MAX_AXIS_CELLS=64,MAX_CELLS=32768;
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v;};
const nonNegative=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error(`${name}が数値範囲外です。`);return v;};
const sum=values=>{let s=0,e=0;for(const v of values){const y=v-e,t=s+y;e=(t-s)-y;s=t;}return s;};
const FACE_DEFS=[
 {key:'xMin',axis:0,side:-1},{key:'xMax',axis:0,side:1},
 {key:'yMin',axis:1,side:-1},{key:'yMax',axis:1,side:1},
 {key:'zMin',axis:2,side:-1},{key:'zMax',axis:2,side:1}];
function boundary(b){
 if(b===undefined)return {type:'insulated'};
 if(!b||typeof b!=='object'||Array.isArray(b))throw Error('境界条件はオブジェクトで指定してください。');
 const allowed={insulated:['type'],temperature:['type','temperature'],flux:['type','flux'],convection:['type','h','temperature']}[b.type];
 if(!allowed)throw Error('未対応の境界条件です。');
 if(Object.keys(b).some(key=>!allowed.includes(key)))throw Error('未対応の境界条件項目を暗黙に無視しません。');
 if(b.type==='temperature')finite(b.temperature,'境界の絶対温度[K]',true);
 if(b.type==='flux')finite(b.flux,'内向き熱流束');
 if(b.type==='convection'){nonNegative(b.h,'熱伝達率');finite(b.temperature,'境界の絶対温度[K]',true);}
 return {...b};
}
export function createTransientBrick3d(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('直方体条件はオブジェクトで指定してください。');
 const c=structuredClone(input),allowed=new Set(['size','cells','k','rho','cp','initial','boundaries']);
 if(Object.keys(c).some(key=>!allowed.has(key)))throw Error('未対応の物理条件を暗黙に無視しません。');
 if(!c.size||typeof c.size!=='object'||Object.keys(c.size).some(key=>!['x','y','z'].includes(key)))throw Error('直方体の寸法は size:{x,y,z} で指定してください。');
 const L=[finite(c.size.x,'x方向の長さ[m]',true),finite(c.size.y,'y方向の長さ[m]',true),finite(c.size.z,'z方向の長さ[m]',true)];
 if(!c.cells||typeof c.cells!=='object'||Object.keys(c.cells).some(key=>!['nx','ny','nz'].includes(key)))throw Error('格子数は cells:{nx,ny,nz} で指定してください。');
 const N3=[c.cells.nx,c.cells.ny,c.cells.nz];
 if(N3.some(n=>!Number.isSafeInteger(n)||n<1||n>MAX_AXIS_CELLS)||N3[0]*N3[1]*N3[2]>MAX_CELLS)throw Error(`直方体の格子は各軸1〜${MAX_AXIS_CELLS}、合計${MAX_CELLS}セル以下です。`);
 const [nx,ny,nz]=N3,N=nx*ny*nz,d=[L[0]/nx,L[1]/ny,L[2]/nz],V=d[0]*d[1]*d[2];
 const k=finite(c.k,'熱伝導率',true),rho=finite(c.rho,'密度',true),cp=finite(c.cp,'比熱',true),C=finite(rho*cp*V,'セル熱容量',true);
 const initial=finite(c.initial,'初期絶対温度[K]',true);
 if(c.boundaries!==undefined&&(!c.boundaries||typeof c.boundaries!=='object'||Array.isArray(c.boundaries)))throw Error('境界条件は面ごとのオブジェクトで指定してください。');
 if(c.boundaries&&Object.keys(c.boundaries).some(key=>!FACE_DEFS.some(f=>f.key===key)))throw Error('境界条件の面名は xMin/xMax/yMin/yMax/zMin/zMax です。');
 const facespec=Object.fromEntries(FACE_DEFS.map(f=>[f.key,boundary(c.boundaries?.[f.key])]));
 // Internal faces join cell centres a distance d[axis] apart, so the
 // conductance is k*A/d. A temperature face puts the boundary node on
 // the face itself, a half cell away: 2kA/d. A convection face puts the
 // half-cell conduction and the film resistance in series.
 const axisG=[k*(d[1]*d[2])/d[0],k*(d[0]*d[2])/d[1],k*(d[0]*d[1])/d[2]],faceArea=[d[1]*d[2],d[0]*d[2],d[0]*d[1]];
 const index=(i,j,l)=>i+nx*(j+ny*l);
 const pairN=[],pairM=[],pairG=[],sumG=new Float64Array(N);
 const addPair=(n,m,G)=>{pairN.push(n);pairM.push(m);pairG.push(G);sumG[n]+=G;sumG[m]+=G;};
 for(let l=0;l<nz;l++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const n=index(i,j,l);
  if(i+1<nx)addPair(n,index(i+1,j,l),axisG[0]);
  if(j+1<ny)addPair(n,index(i,j+1,l),axisG[1]);
  if(l+1<nz)addPair(n,index(i,j,l+1),axisG[2]);
 }
 const faceCell=[],faceKind=[],faceG=[],faceValue=[];
 for(const {key,axis,side} of FACE_DEFS){
  const b=facespec[key];if(b.type==='insulated')continue;
  const A=faceArea[axis],dist=d[axis];
  let G=0,value=0,kind=0;
  if(b.type==='temperature'){G=2*k*A/dist;value=b.temperature;kind=1;}
  else if(b.type==='convection'){if(b.h===0)continue;G=A/(dist/(2*k)+1/b.h);value=b.temperature;kind=2;}
  else if(b.type==='flux'){value=b.flux*A;kind=3;}
  const [na,nb,nc]=[nx,ny,nz],counts=[na,nb,nc];
  for(let a=0;a<counts[(axis+1)%3];a++)for(let e=0;e<counts[(axis+2)%3];e++){
   const coord=[0,0,0];coord[axis]=side<0?0:counts[axis]-1;coord[(axis+1)%3]=a;coord[(axis+2)%3]=e;
   const n=index(coord[0],coord[1],coord[2]);
   faceCell.push(n);faceKind.push(kind);faceG.push(G);faceValue.push(value);
   if(kind!==3)sumG[n]+=G;
  }
 }
 const pairs={n:Uint32Array.from(pairN),m:Uint32Array.from(pairM),G:Float64Array.from(pairG)};
 const faces={n:Uint32Array.from(faceCell),kind:Uint8Array.from(faceKind),G:Float64Array.from(faceG),value:Float64Array.from(faceValue)};
 let safeDt=Infinity;for(let n=0;n<N;n++)if(sumG[n]>0)safeDt=Math.min(safeDt,.8*C/sumG[n]);
 const T=new Float64Array(N).fill(initial),P=new Float64Array(N);
 const initialEnergy=C*N*(initial-REFERENCE_K);
 let time=0,steps=0,lastDt=0,lastPower=0,netInput=0,netInputCompensation=0;
 const energy=()=>C*sum(Array.from(T,v=>v-REFERENCE_K));
 function step(dt,returnState=true){
  finite(dt,'時間刻み',true);
  if(dt>safeDt*(1+1e-12))throw Error(`時間刻みが安定性の上限${safeDt.toPrecision(4)} sを超えています。`);
  P.fill(0);let external=0;
  const {n:pn,m:pm,G:pG}=pairs;
  for(let p=0;p<pG.length;p++){const q=pG[p]*(T[pm[p]]-T[pn[p]]);P[pn[p]]+=q;P[pm[p]]-=q;}
  for(let f=0;f<faces.kind.length;f++){
   const n=faces.n[f];let q;
   if(faces.kind[f]===3)q=faces.value[f];
   else q=faces.G[f]*(faces.value[f]-T[n]);
   P[n]+=q;external+=q;
  }
  const next=new Float64Array(N);
  for(let n=0;n<N;n++){next[n]=T[n]+dt*P[n]/C;if(!Number.isFinite(next[n])||next[n]<=0)throw Error('温度が非有限値または0 K以下となるため、更新前に計算を停止しました。時間刻みと境界条件を見直してください。');}
  const y=external*dt-netInputCompensation,tt=netInput+y;netInputCompensation=(tt-netInput)-y;netInput=tt;
  T.set(next);time+=dt;steps++;lastDt=dt;lastPower=external;
  return returnState?snapshot():undefined;
 }
 function snapshot(){
  const e=energy(),change=e-initialEnergy,error=change-netInput;
  return {law:LAW,signature,time,steps,lastDt,lastPower,safeDt:Number.isFinite(safeDt)?safeDt:null,
   nx,ny,nz,temperature:Array.from(T),centres:{x:Array.from({length:nx},(_,i)=>(i+.5)*d[0]),y:Array.from({length:ny},(_,j)=>(j+.5)*d[1]),z:Array.from({length:nz},(_,l)=>(l+.5)*d[2])},
   energy:e,initialEnergy,energyChange:change,netInput,netInputCompensation,energyError:error,
   relativeEnergyError:Math.abs(error)/Math.max(1,Math.abs(initialEnergy),Math.abs(netInput)),
   mean:sum(T)/N,min:Math.min(...T),max:Math.max(...T),
   assumptions:{constantProperties:true,uniformInitialTemperature:true,prescribedFluxFacesTemperatureIndependent:true,radiationIncluded:false,volumetricSourceIncluded:false},
   releaseApproved:false};
 }
 function restore(s){
  if(!s||!Array.isArray(s.temperature)||s.temperature.length!==N||![s.time,s.netInput,s.steps].every(Number.isFinite)||s.time<0||s.steps<0)throw Error('再生状態が不正です。');
  const next=Float64Array.from(s.temperature);for(const v of next)finite(v,'再生温度',true);
  T.set(next);time=s.time;netInput=s.netInput;netInputCompensation=0;steps=s.steps;lastDt=s.lastDt??0;lastPower=s.lastPower??0;
  return snapshot();
 }
 const signature=JSON.stringify([LAW,{size:c.size,cells:c.cells,k,rho,cp,initial,boundaries:facespec}]);
 return {step,snapshot,restore,safeDt,get time(){return time;},grid:{nx,ny,nz,dx:d[0],dy:d[1],dz:d[2],cellVolume:V,size:{x:L[0],y:L[1],z:L[2]}},config:structuredClone({...c,boundaries:facespec})};
}
