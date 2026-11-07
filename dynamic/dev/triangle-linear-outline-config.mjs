// Development-only custom convex outlines. No automatic boundary reassignment.
import {createConvexOutlineDraft} from './convex-outline-draft.mjs';
import {createBoundaryRefinedTriangleMesh} from './boundary-refined-triangle-mesh.mjs';
const finite=(v,name,lo,hi)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error(`${name}は${lo}〜${hi}です。`);return v;};
export function buildTriangleLinearOutlineExperiment(input){
 const v=structuredClone(input),outline=createConvexOutlineDraft(v.outline).outline,n=v.subdivisions==='auto'?(v.mobile?4:8):v.subdivisions;if(![4,8,16].includes(n))throw Error('初期分割は4/8/16です。');
 if(!Array.isArray(v.boundaryInputs)||v.boundaryInputs.length!==outline.length)throw Error('全ての輪郭辺に境界条件を設定してください。');
 const boundaries=v.boundaryInputs.map((b,i)=>{if(!b||typeof b!=='object')throw Error(`辺${i}の境界が不正です。`);if(b.type==='adiabatic')return {type:'adiabatic'};if(b.type==='temperature')return {type:'temperature',temperatureK:finite(b.temperatureC,`辺${i}の温度[℃]`,-100,1000)+273.15};if(b.type==='flux')return {type:'flux',outwardFluxWPerM2:finite(b.outwardFlux,`辺${i}の外向き熱流束[W/m²]`,-1e5,1e5)};if(b.type==='convection')return {type:'convection',h:finite(b.h,`辺${i}のh`,0,1000),ambientK:finite(b.ambientC,`辺${i}の流体温度[℃]`,-100,1000)+273.15};throw Error(`辺${i}は固定温度/断熱/指定流束/対流だけです。`);});
 // Fixed corner temperatures may not be averaged to make an input compatible.
 for(let i=0;i<boundaries.length;i++){const a=boundaries[i],b=boundaries[(i+1)%boundaries.length];if(a.type==='temperature'&&b.type==='temperature'&&a.temperatureK!==b.temperatureK)throw Error(`辺${i}と辺${(i+1)%boundaries.length}の固定温度が共有頂点で一致しません。`);}
 const k=finite(v.k,'k',.01,500),rho=finite(v.rho,'ρ',100,20000),cp=finite(v.cp,'cp',50,10000),depth=finite(v.depth,'奥行き[m]',.001,1),initial=finite(v.initialC,'初期内部温度[℃]',-100,1000)+273.15,reference=finite(v.referenceC,'蓄熱基準[℃]',-100,1000)+273.15,source=finite(v.source,'体積発熱[W/m³]',-1e6,1e6),mesh=createBoundaryRefinedTriangleMesh({outline,subdivisions:n});
 return {config:{outline,subdivisions:n,boundaryRefinement:true,k,rho,cp,depth,initial,referenceTemperatureK:reference,source,boundaries,maxTemperature:2000},info:{shape:'custom-convex',reference:null,initialMode:'uniform-with-fixed-overrides',boundaryFaceCount:outline.length,actualNodeCount:mesh.nodes.length,actualTriangleCount:mesh.elements.length,actualBoundarySegments:mesh.numerics.boundaryRefinement.boundarySegmentCountByOutlineEdge.slice()}};
}
