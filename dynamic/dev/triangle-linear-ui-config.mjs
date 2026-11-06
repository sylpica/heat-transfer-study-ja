// Narrow square presets; reference metadata never changes the integrator.
import {createConvexTriangleMesh} from './convex-triangle-mesh.mjs';
const check=(x,name,lo,hi)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<lo||x>hi)throw Error(`${name}は${lo}〜${hi}です。`);return x;};
export function robinFirstRoot(biot){
 check(biot,'Bi',0,1e8);if(biot===0)return 0;let lo=0,hi=Math.min(Math.PI/2,Math.sqrt(biot));for(let i=0;i<80;i++){const x=(lo+hi)/2;if(Math.tan(x)<biot/x)lo=x;else hi=x;}return (lo+hi)/2;
}
export function buildTriangleLinearExperiment(values){
 const v=structuredClone(values),length=check(v.length,'一辺[m]',.1,2),hot=check(v.initialC,'初期分布の値[℃]',-100,1000)+273.15,ambient=check(v.ambientC,'固定温度/周囲温度[℃]',-100,1000)+273.15,k=check(v.k,'k',.01,500),rho=check(v.rho,'ρ',100,20000),cp=check(v.cp,'cp',50,10000),depth=check(v.depth,'奥行き[m]',.001,1),h=check(v.h,'h',0,1000),inwardFlux=check(v.inwardFlux,'底面入熱[W/m²]',-1e5,1e5),source=check(v.source,'体積発熱[W/m³]',-1e6,1e6),n=v.subdivisions==='auto'?(v.mobile?8:16):v.subdivisions;
 if(!['dirichlet-neumann','robin-neumann','flux-robin','adiabatic-source'].includes(v.preset)||![4,8,16].includes(n))throw Error('対応するプリセットと分割数が必要です。');
 const outline=[[0,0],[length,0],[length,length],[0,length]],mesh=createConvexTriangleMesh({outline,subdivisions:n}),boundaries=Array.from({length:4},()=>({type:'adiabatic'})),amplitude=hot-ambient,alpha=k/(rho*cp),info={preset:v.preset,length,depth,rho,cp,k,ambient,hot,amplitude,alpha,reference:null};let initial=hot,bodySource=0;
 if(v.preset==='dirichlet-neumann'){boundaries[0]={type:'temperature',temperatureK:ambient};initial=mesh.nodes.map(p=>p.point[1]===0?ambient:ambient+amplitude*Math.sin(Math.PI*p.point[1]/(2*length)));info.reference={kind:'mode',mu:Math.PI/2,mode:'sin'};}
 if(v.preset==='robin-neumann'){boundaries[2]={type:'convection',h,ambientK:ambient};const mu=robinFirstRoot(h*length/k);initial=mesh.nodes.map(p=>ambient+amplitude*Math.cos(mu*p.point[1]/length));info.reference={kind:'mode',mu,mode:'cos'};}
 if(v.preset==='flux-robin'){boundaries[0]={type:'flux',outwardFluxWPerM2:-inwardFlux};boundaries[2]={type:'convection',h,ambientK:ambient};info.reference=h>0?{kind:'steady-linear',h,inwardFlux}:null;}
 if(v.preset==='adiabatic-source'){bodySource=source;info.reference={kind:'uniform-source',source};}
 return {config:{outline,subdivisions:n,k,depth,rho,cp,boundaries,referenceTemperatureK:ambient,initial,source:bodySource,maxTemperature:2000},info};
}
function checkedReference(result){if(Object.entries(result).some(([key,value])=>key!=='kind'&&value!==null&&!Number.isFinite(value)))throw Error('解析参照が有限な数値範囲を超えています。');return result;}
export function triangleLinearReferenceAt(info,time,point){
 check(time,'参照時計',0,Number.MAX_VALUE);if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))throw Error('測定点が不正です。');const r=info?.reference;if(!r)return null;const L=info.length,inside=point[0]>=0&&point[0]<=L&&point[1]>=0&&point[1]<=L;
 if(r.kind==='steady-linear')return checkedReference({kind:'steady-only',temperature:inside?info.ambient+r.inwardFlux/r.h+r.inwardFlux/info.k*(L-point[1]):null,boundaryPowerW:null,heatJ:null});
 if(r.kind==='uniform-source'){const theta=info.amplitude+r.source/(info.rho*info.cp)*time;return checkedReference({kind:'transient',temperature:inside?info.ambient+theta:null,heatJ:info.rho*info.cp*info.depth*L**2*theta,boundaryPowerW:0});}
 const lambda=info.alpha*(r.mu/L)**2,amplitude=info.amplitude*Math.exp(-lambda*time),average=r.mode==='sin'?2/Math.PI:r.mu===0?1:Math.sin(r.mu)/r.mu,heat=info.rho*info.cp*info.depth*L**2*amplitude*average;return checkedReference({kind:'transient',temperature:inside?info.ambient+amplitude*(r.mode==='sin'?Math.sin(r.mu*point[1]/L):Math.cos(r.mu*point[1]/L)):null,heatJ:heat,boundaryPowerW:lambda*heat});
}
