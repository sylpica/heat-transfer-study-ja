// Development UI conditions and independently expressed continuous rectangle
// reference. Reference metadata never changes the numerical kernel inputs.
import {createConvexTriangleMesh} from './convex-triangle-mesh.mjs';
const check=(v,name,lo,hi)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error(`${name}は${lo}〜${hi}の範囲です。`);return v;};
export function buildTriangleExperiment(values){
 const v=structuredClone(values),w=check(v.width,'幅[m]',.02,5),h=check(v.height,'高さ[m]',.02,5),angle=check(v.angleRadians,'回転[rad]',-Math.PI,Math.PI),hot=check(v.hotC,'初期内部温度[℃]',-100,1000)+273.15,wall=check(v.wallC,'固定境界温度[℃]',-100,1000)+273.15,k=check(v.k,'k',.01,500),rho=check(v.rho,'ρ',100,20000),cp=check(v.cp,'cp',50,10000),depth=check(v.depth,'奥行き[m]',.001,1),source=check(v.source,'体積発熱[W/m³]',-1e6,1e6),co=Math.cos(angle),si=Math.sin(angle),center=[.53,.47];
 if(!['rectangle','triangle','pentagon','custom'].includes(v.shape)||!['sine','uniform'].includes(v.initialMode))throw Error('対応する形状/初期分布を選んでください。');if(v.initialMode==='sine'&&v.shape!=='rectangle')throw Error('正弦初期分布は長方形だけです。');
 let local;if(v.shape==='rectangle')local=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];else if(v.shape==='triangle')local=[[-w/2,-h/2],[w/2,-h/2],[0,h/2]];else if(v.shape==='pentagon'){const p=Array.from({length:5},(_,i)=>[Math.cos(-Math.PI/2+2*Math.PI*i/5),Math.sin(-Math.PI/2+2*Math.PI*i/5)]),lo=[0,1].map(k=>Math.min(...p.map(a=>a[k]))),hi=[0,1].map(k=>Math.max(...p.map(a=>a[k])));local=p.map(a=>[-w/2+w*(a[0]-lo[0])/(hi[0]-lo[0]),-h/2+h*(a[1]-lo[1])/(hi[1]-lo[1])]);}
 const outline=v.shape==='custom'?v.outline:local.map(([x,y])=>[center[0]+co*x-si*y,center[1]+si*x+co*y]);if(!Array.isArray(outline)||outline.length>12)throw Error('開発画面は12頂点までです。');
 const allowed=[4,8,16].filter(n=>outline.length*n*n<=1024&&1+outline.length*n*(n+1)/2<=600),n=v.subdivisions==='auto'?Math.max(...allowed.filter(n=>!v.mobile||n<=8)):v.subdivisions;if(!allowed.includes(n))throw Error('この輪郭と分割数は計算上限を超えます。分割数を下げてください。');const mesh=createConvexTriangleMesh({outline,subdivisions:n});
 const info={shape:v.shape,initialMode:v.initialMode,subdivisions:n,automatic:v.subdivisions==='auto',reference:null};let initial=hot;
 if(v.initialMode==='sine'){
  const amplitude=hot-wall,mode=p=>Math.sin(Math.PI*((p[0]-center[0])*co+(p[1]-center[1])*si+w/2)/w)*Math.sin(Math.PI*(-(p[0]-center[0])*si+(p[1]-center[1])*co+h/2)/h);initial=mesh.nodes.map(node=>node.boundary?wall:wall+amplitude*mode(node.point));
  if(source===0)info.reference={kind:'continuous-rectangle-sine',width:w,height:h,center,co,si,amplitude,wall,alpha:k/(rho*cp),rho,cp,depth};
 }
 return {config:{outline,subdivisions:n,k,depth,rho,cp,wallTemperature:wall,initial,source,maxTemperature:2000},info};
}
export function triangleReferenceAt(info,time,point){
 const r=info?.reference;if(!r)return null;check(time,'参照時刻',0,Number.MAX_VALUE);if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))throw Error('参照点の座標が不正です。');const x=(point[0]-r.center[0])*r.co+(point[1]-r.center[1])*r.si+r.width/2,y=-(point[0]-r.center[0])*r.si+(point[1]-r.center[1])*r.co+r.height/2,lambda=r.alpha*Math.PI**2*(1/r.width**2+1/r.height**2),decay=Math.exp(-lambda*time),excess=r.amplitude*decay,heat=r.rho*r.cp*r.depth*excess*4*r.width*r.height/Math.PI**2;return {temperature:x<0||x>r.width||y<0||y>r.height?null:r.wall+excess*Math.sin(Math.PI*x/r.width)*Math.sin(Math.PI*y/r.height),heatJ:heat,boundaryPowerW:lambda*heat,decayUnderflow:decay===0};
}
