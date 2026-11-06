// Development-only RT0 postprocessing. It never changes nodal temperatures,
// time integration or the underlying constitutive approximation.
import {createConvexTriangleMesh} from './convex-triangle-mesh.mjs';
import {orientation2D} from './planar-predicates.mjs';
const finite=(x,name,positive=false)=>{if(typeof x!=='number'||!Number.isFinite(x)||(positive&&x<=0))throw Error(`${name}が数値範囲外です。`);return x===0?0:x;};
const dot=(a,b)=>finite(a.reduce((s,x,i)=>s+x*b[i],0),'内積');
const maximum=a=>Math.max(...a.map(Math.abs));
const sum=a=>finite(a.reduce((s,x)=>s+x,0),'集計');

export function createTriangleFluxRecovery({mesh:input,k,depth,rho,cp,source=0}){
 for(const [name,x]of Object.entries({k,depth,rho,cp}))finite(x,name,true);finite(source,'発熱');
 if(input?.kind!=='convex-conforming-delaunay-development-mesh')throw Error('対応する凸P1メッシュが必要です。');
 const mesh=createConvexTriangleMesh({outline:input.outline,subdivisions:input.subdivisions});
 if(JSON.stringify(mesh)!==JSON.stringify(input))throw Error('正規のメッシュと節点/接続が一致しません。');
 const points=mesh.nodes.map(n=>n.point),centres=mesh.elements.map(t=>[0,1].map(k=>sum(t.nodes.map(i=>points[i][k]/3)))),incident=mesh.elements.map(()=>[]),volumetricCapacity=finite(rho*cp,'体積容量',true);
 const edges=mesh.edges.map((e,id)=>{
  const [a,b]=e.nodes.map(i=>points[i]),dx=b[0]-a[0],dy=b[1]-a[1],length=finite(Math.hypot(dx,dy),'辺長',true),normal=[dy/length,-dx/length],midpoint=[a[0]+dx/2,a[1]+dy/2],first=e.triangles[0],second=e.boundary?null:e.triangles[1],h1=finite(dot(midpoint.map((x,i)=>x-centres[first][i]),normal),'第一側の辺への距離',true),h2=second===null?0:finite(dot(centres[second].map((x,i)=>x-midpoint[i]),normal),'第二側の辺への距離',true),weight=finite(k*depth*length/(h1+h2),'正の回復重み[W/K]',true);
  incident[first].push({edge:id,sign:1,opposite:e.oppositeNodes[0]});if(second!==null)incident[second].push({edge:id,sign:-1,opposite:e.oppositeNodes[1]});return {nodes:[...e.nodes],first,second,normal,midpoint,length,weight};
 });
 if(incident.some(e=>e.length!==3))throw Error('各三角形に3つの辺が必要です。');
 const weightScale=Math.max(...edges.map(e=>e.weight)),weights=edges.map(e=>finite(e.weight/weightScale,'正規化重み',true)),diagonal=incident.map(row=>finite(sum(row.map(e=>weights[e.edge])),'回復対角係数',true));
 function divergence(power){return incident.map(row=>sum(row.map(e=>e.sign*power[e.edge])));}
 function apply(x){const y=mesh.elements.map(()=>0);edges.forEach((e,i)=>{const q=weights[i]*(x[e.first]-(e.second===null?0:x[e.second]));y[e.first]+=q;if(e.second!==null)y[e.second]-=q;});y.forEach(x=>finite(x,'回復行列の出力'));return y;}
 function solve(rhs){
  const scale=maximum(rhs);if(scale===0)return {lambda:rhs.map(()=>0),scale:0,iterations:0,relativeResidual:0};
  const b=rhs.map(x=>x/scale),x=b.map(()=>0);let r=b.slice(),z=r.map((v,i)=>v/diagonal[i]),p=z.slice(),rz=dot(r,z),iterations=0;
  // Predeclared relative residual; no fixed W floor hides small physics.
  const tolerance=1e-11,maxIterations=8*mesh.elements.length;
  while(maximum(r)>tolerance){
   if(iterations++>=maxIterations)throw Error('熱流束回復の反復上限です。温度場は変更していません。');const ap=apply(p),denominator=dot(p,ap);if(!(denominator>0&&rz>0))throw Error('熱流束回復の正定値性を数値的に保てません。');const alpha=finite(rz/denominator,'回復更新係数',true);
   for(let i=0;i<x.length;i++){x[i]=finite(x[i]+alpha*p[i],'回復未知量');r[i]=finite(r[i]-alpha*ap[i],'回復残差');}
   if(maximum(r)<=tolerance){const actual=apply(x).map((v,i)=>b[i]-v);if(maximum(actual)<=tolerance){r=actual;break;}r=actual;z=r.map((v,i)=>v/diagonal[i]);p=z.slice();rz=dot(r,z);continue;}
   z=r.map((v,i)=>v/diagonal[i]);const next=dot(r,z),beta=finite(next/rz,'回復共役係数');p=z.map((v,i)=>finite(v+beta*p[i],'回復方向'));rz=next;
  }
  return {lambda:x,scale,iterations,relativeResidual:maximum(apply(x).map((v,i)=>b[i]-v))};
 }
 return {recover(state){
  if(state?.kind!=='convex-P1-SSPRK2-development-state'||!Array.isArray(state.nodalTemperatureRateKPerS)||state.nodalTemperatureRateKPerS.length!==points.length||!Array.isArray(state.elementHeatFluxWPerM2)||state.elementHeatFluxWPerM2.length!==mesh.elements.length)throw Error('実P1状態の瞬間節点温度率と片側Fourier熱流束が必要です。');
  const signature=JSON.parse(state.modelSignature);if(signature.kind!=='convex-P1-SSPRK2'||JSON.stringify(signature.outline)!==JSON.stringify(mesh.outline)||Object.entries({subdivisions:mesh.subdivisions,k,depth,rho,cp,source}).some(([key,value])=>signature[key]!==value))throw Error('回復条件と実状態のモデル条件が一致しません。');
  const rate=state.nodalTemperatureRateKPerS.map(x=>finite(x,'温度率'));if(mesh.nodes.some((n,i)=>n.boundary&&rate[i]!==0))throw Error('固定温度境界の温度率は0です。');
  const raw=state.elementHeatFluxWPerM2.map(q=>{if(!Array.isArray(q)||q.length!==2)throw Error('実要素熱流束が不正です。');return q.map(x=>finite(x,'片側熱流束'));});
  const storage=mesh.elements.map(t=>finite(t.area*depth*volumetricCapacity*sum(t.nodes.map(i=>rate[i]/3)),'要素蓄熱率')),sources=mesh.elements.map(t=>finite(source*t.area*depth,'要素発熱')),target=sources.map((x,i)=>finite(x-storage[i],'要素の必要出熱'));
  const rawPower=edges.map(e=>finite(depth*e.length*dot(e.second===null?raw[e.first]:raw[e.first].map((x,i)=>x/2+raw[e.second][i]/2),e.normal),'平均片側辺熱')),old=divergence(rawPower),rhs=target.map((v,i)=>finite(v-old[i],'回復右辺')),solution=solve(rhs),correction=edges.map((e,i)=>finite(weights[i]*(solution.lambda[e.first]-(e.second===null?0:solution.lambda[e.second]))*solution.scale,'辺熱補正')),power=rawPower.map((v,i)=>finite(v+correction[i],'回復辺熱')),net=divergence(power),residual=net.map((v,i)=>finite(v-target[i],'要素熱収支差')),scale=Math.max(maximum(target),maximum(rawPower),maximum(power),maximum(rhs)),budget=finite((1e-11+4096*Number.EPSILON)*scale,'要素収支の絶対予算');
  if(maximum(residual)>budget)throw Error('回復した要素収支が相対残差予算を超えました。温度場は変更していません。');
  const elements=mesh.elements.map((t,id)=>{
   const outward=incident[id].map(e=>e.sign*power[e.edge]),volume=finite(t.area*depth,'要素体積',true),slope=finite(sum(outward)/(2*volume),'RT0線形係数'),q=[0,1].map(k=>finite(sum(incident[id].map((e,j)=>outward[j]*(centres[id][k]-points[e.opposite][k])))/(2*volume),'RT0重心流束'));
   return {nodes:t.nodes.map(i=>[...points[i]]),centroidM:centres[id].slice(),fluxAtCentroidWPerM2:q,isotropicSlopeWPerM3:slope,divergenceWPerM3:2*slope,sourcePowerW:sources[id],storageRateW:storage[id],outwardEdgePowerW:outward,netOutwardPowerW:net[id],balanceResidualW:residual[id]};
  });
  return {kind:'convex-P1-RT0-equilibrated-development-field',edges:edges.map((e,i)=>({nodes:e.nodes,first:e.first,second:e.second,midpointM:e.midpoint,normalFromFirst:e.normal,lengthM:e.length,powerOutOfFirstW:power[i],rawAveragePowerW:rawPower[i],correctionW:correction[i],weightWPerK:e.weight})),elements,diagnostics:{iterations:solution.iterations,normalizedLinearResidual:solution.relativeResidual,maximumElementBalanceResidualW:maximum(residual),elementBalanceBudgetW:budget,boundaryOutwardPowerW:sum(edges.map((e,i)=>e.second===null?power[i]:0)),totalSourcePowerW:sum(sources),totalStorageRateW:sum(storage),maximumRawElementImbalanceW:maximum(rhs)},scope:{postprocessOnly:true,elementMeanStorageBalance:true,singleNormalTracePerEdge:true,RT0WithinEachTriangle:true,constitutiveFluxChanged:true,underlyingTemperatureUnchanged:true,physicalFluxAccuracyVerified:false,generalGeometry:false},releaseApproved:false};
 }};
}

export function sampleRecoveredTriangleFlux(field,elementId,point){
 const e=field?.kind==='convex-P1-RT0-equilibrated-development-field'&&field.elements?.[elementId];if(!e||!Number.isSafeInteger(elementId)||!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))throw Error('実在する回復要素と有限な物理座標が必要です。');
 if(e.nodes.some((a,i)=>orientation2D(a,e.nodes[(i+1)%3],point).sign<0))return null;
 return point.map((x,i)=>finite(e.fluxAtCentroidWPerM2[i]+e.isotropicSlopeWPerM3*(x-e.centroidM[i]),'RT0の実流束'));
}
