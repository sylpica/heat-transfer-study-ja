import {validateSurfaceExchange,surfaceExchange} from '../surface-exchange.mjs';
// Development-only radial-symmetry conduction in concentric multilayer
// cylinders and spheres, including hollow shapes (inner radius > 0).
// Each layer has constant k/rho/cp and its own uniform shells. Material
// interfaces use the series resistance of the two half shells plus an
// optional contact resistance, so one conservative face transfer carries
// both temperature continuity and flux continuity. No fluid, angular,
// axial, phase-change or temperature-dependent-property solution.
const LAW='radial-multilayer-conduction-v1';
const SIGMA=5.670374419e-8,finite=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error(`${name}は有限値です。`);return v;},positive=(v,name)=>{finite(v,name);if(v<=0)throw Error(`${name}は正の値です。`);return v;};
const TOP_KEYS=['geometry','length','innerRadius','layers','contactResistance','initial','boundary','innerBoundary'],LAYER_KEYS=['thickness','cells','k','rho','cp','source'];
const BC_FIELDS={insulated:[],'temperature':['temperature'],'flux':['flux'],'convection':['h','temperature'],'radiation':['emissivity','temperature'],'convection-radiation':['h','emissivity','temperature','radiationTemperature']};
function validateBoundary(raw,label){
 const bc=structuredClone(raw??{type:'insulated'});
 if(!bc||typeof bc!=='object'||Array.isArray(bc)||!(bc.type in BC_FIELDS))throw Error(`${label}境界条件が不正です。`);
 if(Object.keys(bc).some(k=>k!=='type'&&!BC_FIELDS[bc.type].includes(k)))throw Error(`${label}境界条件は未対応の条件を暗黙に無視しません。`);
 if(['temperature','convection','radiation'].includes(bc.type))positive(bc.temperature,'表面/周囲絶対温度');
 if(bc.type==='flux')finite(bc.flux,'内向き表面熱流束');
 if(bc.type==='convection'&&(finite(bc.h,'熱伝達率')<0))throw Error('hは0以上です。');
 if(bc.type==='radiation'&&(finite(bc.emissivity,'放射率')<0||bc.emissivity>1||!Number.isFinite(bc.temperature**4)))throw Error('放射率/周囲温度が計算範囲外です。');
 if(bc.type==='convection-radiation')validateSurfaceExchange(bc);
 const out={type:bc.type};for(const k of BC_FIELDS[bc.type])out[k]=bc[k];return out;
}
function surfaceEvaluator(bc,Gh,A){
 // Returns adjacent cell-centre temperature -> {watts (into the material), surface, exchange?}.
 if(bc.type==='insulated')return t=>({watts:0,surface:t});
 if(bc.type==='temperature')return t=>{const watts=Gh*(bc.temperature-t);finite(watts,'表面熱移動率');return {watts,surface:bc.temperature};};
 if(bc.type==='flux')return t=>{const watts=bc.flux*A,surface=t+watts/Gh;finite(watts,'表面熱移動率');positive(surface,'表面温度');return {watts,surface};};
 if(bc.type==='convection'&&bc.h===0)return t=>({watts:0,surface:t});
 if(bc.type==='convection'){const bound=1/(1/Gh+1/(bc.h*A));return t=>{const watts=bound*(bc.temperature-t),surface=t+watts/Gh;finite(watts,'表面熱移動率');positive(surface,'表面温度');return {watts,surface};};}
 if(bc.type==='radiation'&&bc.emissivity===0)return t=>({watts:0,surface:t});
 if(bc.type==='radiation')return t=>{let lo=Math.min(t,bc.temperature),hi=Math.max(t,bc.temperature);for(let i=0;i<60;i++){const s=lo+(hi-lo)/2,residual=Gh*(t-s)-bc.emissivity*SIGMA*A*(s-bc.temperature)*(s+bc.temperature)*(s*s+bc.temperature*bc.temperature);finite(residual,'放射面の反復');if(residual>0)lo=s;else hi=s;}const surface=lo+(hi-lo)/2,watts=Gh*(surface-t);finite(watts,'表面熱移動率');positive(surface,'表面温度');return {watts,surface};};
 if(bc.type==='convection-radiation')return t=>{const exchange=surfaceExchange(t,Gh,A,bc);return {watts:exchange.inwardWatts,surface:exchange.surfaceTemperature,exchange};};
 throw Error('表面境界条件が不正です。');
}
function stabilityConductance(bc,Gh,A){
 if(bc.type==='temperature')return Gh;
 if(bc.type==='convection')return bc.h>0?1/(1/Gh+1/(bc.h*A)):0;
 if(bc.type==='radiation')return bc.emissivity>0?Gh:0;
 if(bc.type==='convection-radiation')return (bc.h>0||bc.emissivity>0)?Gh:0;
 return 0;
}
export function createRadialMultilayer(config){
 if(!config||typeof config!=='object'||Array.isArray(config))throw Error('多層半径方向の条件が不正です。');
 if(Object.keys(config).some(k=>!TOP_KEYS.includes(k)))throw Error('多層半径方向は未対応の条件を暗黙に無視しません。');
 const c=structuredClone(config),{geometry}=c;
 if(!['cylinder','sphere'].includes(geometry))throw Error('多層半径方向は円筒/球です。');
 if(geometry==='cylinder')positive(c.length,'円筒の長さ');else if(c.length!==undefined)throw Error('球では円筒の長さは使いません。');
 if(c.approximation)throw Error('分布モデルは集中近似を解きません。対応するモデルを選んでください。');
 const innerRadius=c.innerRadius===undefined?0:finite(c.innerRadius,'内半径');if(innerRadius<0)throw Error('内半径は0以上の有限値です。');
 if(!Array.isArray(c.layers)||c.layers.length<1||c.layers.length>8)throw Error('層は1〜8層です。');
 const layers=c.layers.map((raw,i)=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!LAYER_KEYS.includes(k)))throw Error(`第${i+1}層の条件が不正です。`);
  const layer={thickness:positive(raw.thickness,'層の厚さ'),cells:raw.cells,k:positive(raw.k,'熱伝導率'),rho:positive(raw.rho,'密度'),cp:positive(raw.cp,'比熱'),source:finite(raw.source??0,'体積発熱')};
  if(!Number.isSafeInteger(layer.cells)||layer.cells<1||layer.cells>512)throw Error('層のセル数は1〜512の整数です。');
  return layer;
 });
 const totalCells=layers.reduce((s,l)=>s+l.cells,0);
 if(totalCells<4||totalCells>1024)throw Error('総セル数は4〜1024です。');
 const contactRaw=c.contactResistance,contactList=contactRaw===undefined?layers.slice(1).map(()=>0):Array.isArray(contactRaw)?contactRaw:layers.slice(1).map(()=>contactRaw);
 if(contactList.length!==layers.length-1||contactList.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))throw Error('接触熱抵抗は界面ごとに0以上の有限値です。');
 const boundary=validateBoundary(c.boundary,'表面'),innerBoundary=validateBoundary(c.innerBoundary,'内面');
 if(innerRadius===0&&innerBoundary.type!=='insulated')throw Error('中実形状には内面の境界条件を指定できません。');
 const dim=geometry==='sphere'?3:2,factor=geometry==='sphere'?4*Math.PI:2*Math.PI*c.length;
 // Mesh: per-layer uniform faces; exact shell volumes in the stable product form.
 const faces=[innerRadius],centres=[],volumes=[],cellLayer=[],layerStart=[];
 layers.forEach((layer,j)=>{
  layerStart.push(centres.length);const r0=faces.at(-1),dr=layer.thickness/layer.cells;layer.dr=dr;layer.innerRadius=r0;layer.outerRadius=r0+layer.thickness;
  for(let i=0;i<layer.cells;i++){const a=r0+i*dr,b=a+dr;faces.push(b);centres.push((a+b)/2);volumes.push(dim===2?factor*dr*(a+b)/2:factor*dr*(a*a+a*b+b*b)/3);cellLayer.push(j);}
 });
 const outerRadius=faces.at(-1),area=faces.map(r=>factor*r**(dim-1)),C=volumes.map((v,i)=>layers[cellLayer[i]].rho*layers[cellLayer[i]].cp*v);
 // Face conductances between adjacent centres. Interior faces of one layer
 // use k*A/dr; a material interface uses the series half-shell resistances
 // plus the contact resistance, which is what enforces one shared interface
 // transfer (flux continuity) and a shared interface temperature.
 const G=[],interfaceFaces=[];
 for(let i=0;i<totalCells-1;i++){
  const j=cellLayer[i],faceR=faces[i+1],A=area[i+1];
  if(cellLayer[i+1]===j)G.push(layers[j].k*A/layers[j].dr);
  else{const next=layers[j+1],resistance=(layers[j].dr/2)/layers[j].k+contactList[j]+(next.dr/2)/next.k;G.push(A/resistance);interfaceFaces.push({cell:i,radius:faceR,area:A,leftLayer:j,rightLayer:j+1,contactResistance:contactList[j]});}
 }
 const innerGh=innerRadius>0?2*layers[0].k*area[0]/layers[0].dr:0,outerGh=2*layers.at(-1).k*area.at(-1)/layers.at(-1).dr;
 if(![...centres,...volumes,...C,...G,outerGh].every(x=>Number.isFinite(x)&&x>0)||(innerRadius>0&&!(innerGh>0&&Number.isFinite(innerGh))))throw Error('多層半径方向の格子/熱容量/抵抗が数値範囲外です。');
 if(Array.isArray(c.initial)){if(c.initial.length!==totalCells||c.initial.some(t=>typeof t!=='number'||!Number.isFinite(t)||t<=0))throw Error('初期温度は正のKで全セルを指定してください。');}else positive(c.initial,'初期温度');
 let T=Array.isArray(c.initial)?Float64Array.from(c.initial):new Float64Array(totalCells).fill(c.initial);
 const innerEval=innerRadius>0?surfaceEvaluator(innerBoundary,innerGh,area[0]):null,outerEval=surfaceEvaluator(boundary,outerGh,area.at(-1));
 const innerBound=innerRadius>0?stabilityConductance(innerBoundary,innerGh,area[0]):0,outerBound=stabilityConductance(boundary,outerGh,area.at(-1));
 const limits=C.map((cap,i)=>cap/((i?G[i-1]:innerBound)+(i<totalCells-1?G[i]:outerBound))),safeDt=.8*Math.min(...limits);if(!(safeDt>0)||!Number.isFinite(safeDt))throw Error('多層半径方向の安定時間刻みが数値範囲外です。');
 const energy=tt=>tt.reduce((sum,t,i)=>sum+C[i]*(t-273.15),0),initialEnergy=energy(T);finite(initialEnergy,'初期顕熱');let time=0,steps=0,lastDt=0,lastPower=0,netInput=0;
 const normLayers=layers.map(l=>({thickness:l.thickness,cells:l.cells,k:l.k,rho:l.rho,cp:l.cp,source:l.source}));
 const signature=JSON.stringify([LAW,geometry,geometry==='cylinder'?c.length:null,innerRadius,normLayers,contactList,boundary,innerBoundary,Array.from(T)]);
 const normConfig={geometry,...(geometry==='cylinder'?{length:c.length}:{}),innerRadius,layers:normLayers,contactResistance:contactList,initial:Array.from(T),boundary,innerBoundary};
 function snapshot(){
  const e=energy(T),error=e-initialEnergy-netInput,bin=innerEval?innerEval(T[0]):{watts:0,surface:T[0]},bout=outerEval(T[totalCells-1]);
  return {modelType:'radial-multilayer-conduction-v1',law:LAW,signature,time,steps,lastDt,lastPower,temperature:Array.from(T),innerSurfaceTemperature:bin.surface,outerSurfaceTemperature:bout.surface,innerInwardWatts:bin.watts,outerInwardWatts:bout.watts,...(bin.exchange?{innerSurfaceExchange:bin.exchange}:{}),...(bout.exchange?{outerSurfaceExchange:bout.exchange}:{}),energy:e,energyReference:'273.15 K',netInput,energyError:error,relativeEnergyError:Math.abs(error)/Math.max(1,Math.abs(initialEnergy),Math.abs(netInput)),min:Math.min(...T),max:Math.max(...T),safeDt,releaseApproved:false,assumptions:{radialSymmetryOnly:true,constantPropertiesPerLayer:true,interfaceFluxContinuous:true,contactResistancePerInterface:true,temperatureDependentPropertiesSolved:false,fluidCouplingSolved:false,phaseChangeSolved:false,timeIntegrator:'forward-Euler'}};
 }
 function step(dt,returnState=true){
  positive(dt,'時間刻み');if(dt>safeDt*(1+1e-12))throw Error('多層半径方向の安定上限を超えました。');if(steps>=Number.MAX_SAFE_INTEGER)throw Error('計算回数の保存範囲を超えました。');
  const P=new Float64Array(totalCells);let external=0;for(let i=0;i<totalCells;i++){P[i]=layers[cellLayer[i]].source*volumes[i];external+=P[i];}
  for(let i=0;i<totalCells-1;i++){const q=G[i]*(T[i+1]-T[i]);P[i]+=q;P[i+1]-=q;}
  const bin=innerEval?innerEval(T[0]):{watts:0};P[0]+=bin.watts;external+=bin.watts;
  const bout=outerEval(T[totalCells-1]);P[totalCells-1]+=bout.watts;external+=bout.watts;
  const next=Float64Array.from(T,(t,i)=>t+dt*P[i]/C[i]),nextTime=time+dt,nextInput=netInput+dt*external,nextEnergy=energy(next);
  if(next.some(t=>!Number.isFinite(t)||t<=0)||![nextTime,nextInput,nextEnergy,nextEnergy-initialEnergy-nextInput].every(Number.isFinite)||nextTime<=time)throw Error('温度/顕熱/時間が範囲外のため、更新前の状態で停止しました。');
  if(innerEval)innerEval(next[0]);outerEval(next[totalCells-1]);
  T=next;time=nextTime;netInput=nextInput;lastDt=dt;lastPower=external;steps++;return returnState?snapshot():undefined;
 }
 function restore(s){
  if(!s||s.modelType!=='radial-multilayer-conduction-v1'||s.signature!==signature||!Array.isArray(s.temperature)||s.temperature.length!==totalCells||s.temperature.some(t=>typeof t!=='number'||!Number.isFinite(t)||t<=0)||![s.time,s.lastDt,s.lastPower,s.netInput].every(Number.isFinite)||s.time<0||s.lastDt<0||!Number.isSafeInteger(s.steps)||s.steps<0||![energy(s.temperature),energy(s.temperature)-initialEnergy-s.netInput].every(Number.isFinite))throw Error('復元する多層半径方向の状態が不正です。');
  if(innerEval)innerEval(s.temperature[0]);outerEval(s.temperature[totalCells-1]);
  const next=Float64Array.from(s.temperature);T=next;time=s.time;steps=s.steps;lastDt=s.lastDt;lastPower=s.lastPower;netInput=s.netInput;return snapshot();
 }
 function flux(){
  const bin=innerEval?innerEval(T[0]):{watts:0},bout=outerEval(T[totalCells-1]);
  const outwardWatts=[innerRadius>0?-bin.watts:0,...G.map((g,i)=>g*(T[i]-T[i+1])),-bout.watts];
  const outwardFlux=outwardWatts.map((q,i)=>area[i]>0?q/area[i]:0);
  if([...outwardWatts,...outwardFlux].some(x=>!Number.isFinite(x)))throw Error('多層半径方向の熱流束が数値範囲外です。');
  const interfaces=interfaceFaces.map(f=>{
   const q=G[f.cell]*(T[f.cell]-T[f.cell+1]),left=layers[f.leftLayer],right=layers[f.rightLayer];
   const leftSurface=T[f.cell]-q*(left.dr/2)/(left.k*f.area),rightSurface=T[f.cell+1]+q*(right.dr/2)/(right.k*f.area);
   return {radius:f.radius,area:f.area,outwardWatts:q,outwardFlux:q/f.area,leftLayer:f.leftLayer,rightLayer:f.rightLayer,contactResistance:f.contactResistance,leftSurfaceTemperature:leftSurface,rightSurfaceTemperature:rightSurface,temperatureJump:leftSurface-rightSurface};
  });
  return {radius:[...faces],outwardWatts,outwardFlux,interfaces,centreConvention:'r=0: symmetry, zero radial derivative; no division by zero'};
 }
 const meshLayers=layers.map((l,j)=>({index:j,innerRadius:l.innerRadius,outerRadius:l.outerRadius,thickness:l.thickness,cells:l.cells,dr:l.dr,firstCell:layerStart[j],k:l.k,rho:l.rho,cp:l.cp,source:l.source}));
 outerEval(T[totalCells-1]);if(innerEval)innerEval(T[0]);
 return {step,snapshot,restore,flux,initialFlux:flux,config:structuredClone(normConfig),mesh:structuredClone({geometry,dimension:dim,innerRadius,outerRadius,length:geometry==='cylinder'?c.length:null,layers:meshLayers,interfaces:interfaceFaces.map(f=>({radius:f.radius,area:f.area,leftLayer:f.leftLayer,rightLayer:f.rightLayer,contactResistance:f.contactResistance})),centres,faces,volumes,areas:area,count:totalCells}),releaseApproved:false,get time(){return time;},get safeDt(){return safeDt;}};
}
