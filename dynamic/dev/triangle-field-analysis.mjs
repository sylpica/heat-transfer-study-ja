// Isotherms and straight cross sections of the P1 field, computed from the
// same nodal temperatures the solver produced. Within one element the P1
// field is linear, so an isotherm is a straight segment per element and a
// cross section is the piecewise-linear profile along a straight line.
// Points outside the meshed region report null; nothing is extrapolated.
import {createTriangleFieldSampler} from './triangle-field-view.mjs';
function validateField(mesh,field){
 if(!mesh||!Array.isArray(mesh.nodes)||!Array.isArray(mesh.elements)||!field||!Array.isArray(field.temperature)||field.temperature.length!==mesh.nodes.length)throw Error('P1メッシュと節点温度の寸法が一致しません。');
 for(const node of mesh.nodes)if(!Array.isArray(node?.point)||node.point.length!==2||!node.point.every(Number.isFinite))throw Error('節点座標が有限値ではありません。');
 for(const element of mesh.elements)if(!Array.isArray(element?.nodes)||element.nodes.length!==3||element.nodes.some(i=>!Number.isInteger(i)||i<0||i>=mesh.nodes.length))throw Error('要素の節点参照が不正です。');
 if(field.temperature.some(t=>!Number.isFinite(t)))throw Error('節点温度が有限値ではありません。');
}
export function triangleContours(mesh,field,levels){
 validateField(mesh,field);if(!Array.isArray(levels)||levels.length>12||levels.some(v=>!Number.isFinite(v)))throw Error('等温線は有限の温度で12本以下にしてください。');
 const segments=[],seen=new Set();
 for(const element of mesh.elements){
  const points=element.nodes.map(i=>mesh.nodes[i].point),values=element.nodes.map(i=>field.temperature[i]);
  for(const level of levels){
   const hits=[];
   for(let e=0;e<3;e++){const v=values[e],w=values[(e+1)%3];if((v<level&&w>=level)||(w<level&&v>=level)){const p=points[e],q=points[(e+1)%3],t=(level-v)/(w-v);hits.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}
   if(hits.length!==2)continue;
   const keys=hits.map(p=>p.map(v=>v.toPrecision(14)).join(','));if(keys[0]===keys[1])continue;
   const key=level+':'+keys.sort().join(';');if(seen.has(key))continue;seen.add(key);segments.push({level,from:hits[0],to:hits[1]});
  }
 }
 return segments;
}
export function triangleCrossSection(mesh,field,{axis='x',at,extent,samples=161}={}){
 validateField(mesh,field);
 if(!['x','y'].includes(axis)||!Number.isFinite(at)||!Array.isArray(extent)||extent.length!==2||!extent.every(Number.isFinite)||!(extent[1]>extent[0])||!Number.isSafeInteger(samples)||samples<2||samples>2001)throw Error('断面の軸・位置・範囲・標本数が不正です。');
 const sample=createTriangleFieldSampler(mesh,field);
 const points=Array.from({length:samples},(_,i)=>{const position=extent[0]+(extent[1]-extent[0])*i/(samples-1),found=sample(axis==='x'?[position,at]:[at,position]);return {position,temperature:found?found.temperature:null};});
 return {axis,at,length:extent[1]-extent[0],points};
}
