// Development-only radiation exchange in an axis-aligned rectangular box
// enclosure: the verified 3D view-factor kernel
// (dynamic/dev/view-factor-3d.mjs) connected to the verified transient
// radiation network (dynamic/radiation-network.mjs).  Neither kernel is
// modified here; this module is the connection layer plus its admission
// control.  General shapes, curved surfaces, openings and participating
// media are out of scope and refused.
//
// Face order is the kernel's: bottom (z=0), top (z=Z), front (y=0),
// back (y=Y), left (x=0), right (x=X).  Each face carries a temperature,
// an emissivity, a heat capacity and an external power input, the last
// given either directly as power [W] or as heatFlux [W/m^2] converted
// with the kernel-computed face area.
//
// Admission: the network accepts a closed view-factor matrix only when
// every row sums to 1 within 1e-12 under naive summation and reciprocity
// A_i F_ij = A_j F_ji holds within 1e-12 relative, while the view-factor
// kernel only guarantees its own 1e-9 residual guard.  This layer
// re-checks the matrix with the network's exact expressions and, when
// the caller did not fix an integration resolution, escalates the
// kernel resolution until admission holds.  No summation-rule
// renormalisation or clipping is applied at any point; a box whose
// factors cannot be resolved to the network tolerance even at the
// highest resolution is refused.
import {createBoxViewFactors3D} from './view-factor-3d.mjs';
import {createRadiationNetwork} from '../radiation-network.mjs';
const EPS=Number.EPSILON;
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v===0?0:v;};
const sum=values=>{let s=0,c=0;for(const v of values){const y=v-c,t=s+y;c=(t-s)-y;s=t;}return finite(s,'合計');};
function keys(input,allowed){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('直方体放射の対応した条件だけを指定してください。');}

export const BOX_RADIATION_3D_FACE_IDS=Object.freeze(['bottom','top','front','back','left','right']);
const NETWORK_TOLERANCE=1e-12;
const RESOLUTION_LADDER=[null,
 {separationPanels:20,polarPanels:32,gaussOrder:7},
 {separationPanels:32,polarPanels:48,gaussOrder:8},
 {separationPanels:48,polarPanels:64,gaussOrder:8},
 {separationPanels:64,polarPanels:64,gaussOrder:8}];

function networkAdmission(F,areas){
 // The network's own closed-system checks, expression for expression:
 // naive row sums and reciprocity relative to the larger exchange area.
 let maximumRowResidual=0,reciprocityRelativeResidual=0;
 for(let i=0;i<6;i++)maximumRowResidual=Math.max(maximumRowResidual,Math.abs(F[i].reduce((a,b)=>a+b,0)-1));
 for(let i=0;i<6;i++)for(let j=0;j<i;j++){
  const a=areas[i]*F[i][j],b=areas[j]*F[j][i];
  reciprocityRelativeResidual=Math.max(reciprocityRelativeResidual,Math.abs(a-b)/Math.max(a,b,Number.MIN_VALUE));
 }
 return {maximumRowResidual,reciprocityRelativeResidual,admitted:maximumRowResidual<=NETWORK_TOLERANCE&&reciprocityRelativeResidual<=NETWORK_TOLERANCE};
}

function resolveGeometry(dimensions,integration){
 if(integration!==undefined&&integration!==null){
  const geometry=createBoxViewFactors3D({dimensions,integration}),admission=networkAdmission(geometry.viewFactors,geometry.areas);
  if(!admission.admitted)throw Error('指定された積分解像度では、形態係数の総和則・相反則を放射ネットワークの受入精度（1e-12）まで解像できません。解像度を上げてください。再正規化による補正はしません。');
  return {geometry,admission,resolutionEscalated:false};
 }
 let lastAdmission=null;
 for(const rung of RESOLUTION_LADDER){
  const geometry=createBoxViewFactors3D(rung?{dimensions,integration:rung}:{dimensions}),admission=networkAdmission(geometry.viewFactors,geometry.areas);
  lastAdmission=admission;
  if(admission.admitted)return {geometry,admission,resolutionEscalated:rung!==null};
 }
 throw Error(`形態係数の総和則・相反則を放射ネットワークの受入精度（1e-12）まで解像できません（最大解像度でも行和残差 ${lastAdmission.maximumRowResidual}、相反残差 ${lastAdmission.reciprocityRelativeResidual}）。寸法の偏りが数値積分の解像範囲を超えています。再正規化による補正はしません。`);
}

export function createBoxRadiation3D(input){
 keys(input,['dimensions','faces','integration','maxTemperature']);
 const c=structuredClone(input),{geometry,admission,resolutionEscalated}=resolveGeometry(c.dimensions,c.integration);
 if(!Array.isArray(c.faces)||c.faces.length!==6)throw Error('直方体の6面すべてに面条件を、面の順序（bottom, top, front, back, left, right）で指定してください。');
 const surfaces=c.faces.map((f,i)=>{
  keys(f,['temperature','emissivity','capacity','power','heatFlux']);
  const hasPower=f.power!==undefined,hasFlux=f.heatFlux!==undefined;
  if(hasPower&&hasFlux)throw Error('面の外部入力は power[W] か heatFlux[W/m²] のどちらか一方で指定してください。');
  let power=0;
  if(hasFlux)power=finite(finite(f.heatFlux,'面の熱流束[W/m²]')*geometry.areas[i],'外部入力[W]');
  else if(hasPower)power=finite(f.power,'外部入力[W]');
  return {id:geometry.faces[i].id,area:geometry.areas[i],capacity:f.capacity,power,temperature:f.temperature,emissivity:f.emissivity};
 });
 const network=createRadiationNetwork({surfaces,viewFactors:geometry.viewFactors,maxTemperature:c.maxTemperature});
 const geometryView=structuredClone(geometry);
 geometryView.scope={...geometryView.scope,radiationNetworkConnected:true};
 geometryView.diagnostics={...geometryView.diagnostics,networkAdmission:{maximumRowResidual:admission.maximumRowResidual,reciprocityRelativeResidual:admission.reciprocityRelativeResidual,tolerance:NETWORK_TOLERANCE,resolutionEscalated,renormalized:false}};
 const enrich=s=>({...s,faceOutwardFlux:s.outwardPower.map((v,i)=>finite(v/geometry.areas[i],'面の正味放射熱流束[W/m²]')),scope:{...geometry.scope,radiationNetworkConnected:true,isothermalFaces:true,conductionWithinFaces:false},releaseApproved:false});
 enrich(network.snapshot());
 const atomic=operation=>{const before=network.snapshot();try{return enrich(operation());}catch(error){network.restore(before);throw error;}};
 function restore(s){
  if(!s||!Array.isArray(s.temperature)||s.temperature.length!==surfaces.length||!Number.isSafeInteger(s.steps)||s.steps<0)throw Error('直方体放射の復元データが不正です。');
  finite(s.time,'復元時間');finite(s.netInput,'復元外部入力');const dt=finite(s.lastDt??0,'復元刻み');if(s.time<0||(s.steps===0)!==(s.time===0)||dt<0||dt>network.safeDt*(1+1e-12)||dt>s.time||(s.steps>0&&dt===0)||(s.steps===0&&dt!==0))throw Error('復元する時計・刻み・回数が一致しません。');
  const maximumElapsed=s.steps*network.safeDt;if(Number.isFinite(maximumElapsed)&&s.time>maximumElapsed*(1+1e-12))throw Error('復元時間が回数と刻み上限を超えています。');
  if(s.steps===0&&s.temperature.some((t,i)=>t!==surfaces[i].temperature))throw Error('時刻0の温度は初期値です。');
  const expected=finite(sum(surfaces.map(v=>v.power))*s.time,'既知の外部入力積分'),inputBudget=finite(128*EPS*(s.steps+1)*Math.max(Math.abs(expected),Math.abs(s.netInput)),'入力積分の丸め予算');if(Math.abs(s.netInput-expected)>inputBudget)throw Error('累積入力が既知の外部入力と時間に一致しません。');
  const delta=sum(s.temperature.map((t,i)=>finite(surfaces[i].capacity*(finite(t,'復元絶対温度',true)-surfaces[i].temperature),'復元蓄熱差'))),scale=sum(s.temperature.map((t,i)=>finite(surfaces[i].capacity*Math.max(Math.abs(t),surfaces[i].temperature),'復元熱収支スケール'))),budget=finite(512*EPS*(s.steps+1)*scale,'復元熱収支の丸め予算');if(Math.abs(delta-s.netInput)>budget)throw Error('復元する蓄熱と累積外部入力が一致しません。');
  return atomic(()=>network.restore(s));
 }
 return {get geometry(){return structuredClone(geometryView);},get config(){return structuredClone(c);},safeDt:network.safeDt,get time(){return network.time;},snapshot:()=>enrich(network.snapshot()),step:(dt,returnState=true)=>{const state=atomic(()=>network.step(dt));return returnState?state:undefined;},restore};
}
