import {createOrthogonalTriangleMesh} from './orthogonal-triangle-mesh.mjs';
const shapes={L:[[0,0],[1,0],[1,.5],[.5,.5],[.5,1],[0,1]],T:[[.25,0],[.75,0],[.75,.5],[1,.5],[1,.75],[0,.75],[0,.5],[.25,.5]],C:[[0,0],[1,0],[1,.25],[.25,.25],[.25,.75],[1,.75],[1,1],[0,1]],rectangle:[[0,0],[1,0],[1,1],[0,1]],stair:[[0,0],[1,0],[1,.25],[.75,.25],[.75,.5],[.5,.5],[.5,.75],[.25,.75],[.25,1],[0,1]]};
export function buildOrthogonalExperiment(input={}){
 const allowed=['shape','width','height','subdivisions','initialMode','amplitude','wallTemperature','source'];if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('未対応の直交凹形状の画面条件です。');
 const v={shape:'L',width:1,height:1,subdivisions:4,initialMode:'sine',amplitude:20,wallTemperature:300,source:0,...input};
 for(const [key,lo,hi]of [['width',.2,2],['height',.2,2],['amplitude',-30,30],['wallTemperature',280,330],['source',-10000,10000]])if(typeof v[key]!=='number'||!Number.isFinite(v[key])||v[key]<lo||v[key]>hi)throw Error('直交画面の寸法/温度/発熱範囲を超えます。');
 if(!Object.hasOwn(shapes,v.shape)||![2,4,8].includes(v.subdivisions)||!['sine','uniform'].includes(v.initialMode))throw Error('対応する直交形状・分割・初期分布を選択してください。');if(v.initialMode==='sine'&&v.shape!=='L')throw Error('この滑らかな正弦初期場はL形だけです。他形状では内部同温度を選択してください。');
 const maximum=[0,1].map(k=>Math.max(...shapes[v.shape].map(p=>p[k]))),outline=shapes[v.shape].map(([x,y])=>[x*v.width/maximum[0],y*v.height/maximum[1]]),mesh=createOrthogonalTriangleMesh({outline,subdivisions:v.subdivisions}),config={outline,subdivisions:v.subdivisions,k:15,rho:1000,cp:1000,depth:.03,source:v.source,wallTemperature:v.wallTemperature,maxTemperature:1000};
 config.initial=v.initialMode==='uniform'?v.wallTemperature+v.amplitude:mesh.nodes.map(n=>n.boundary?v.wallTemperature:v.wallTemperature+v.amplitude*Math.sin(2*Math.PI*n.point[0]/v.width)*Math.sin(2*Math.PI*n.point[1]/v.height));
 return {config,info:{...v,reference:v.shape==='L'&&v.initialMode==='sine'&&v.source===0?{width:v.width,height:v.height,amplitude:v.amplitude,wall:v.wallTemperature,alpha:15e-6,rhoCp:1e6,depth:.03}:null}};
}
export function orthogonalReferenceAt(info,time,point){
 const r=info?.reference;if(!r)return null;if(typeof time!=='number'||!Number.isFinite(time)||time<0||!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))throw Error('参照時刻/測定点が不正です。');
 const [x,y]=point,inside=x>=0&&x<=r.width&&y>=0&&y<=r.height&&(x<=r.width/2||y<=r.height/2),lambda=4*Math.PI**2*r.alpha*(1/r.width**2+1/r.height**2),decay=Math.exp(-lambda*time),energy=-r.rhoCp*r.depth*r.amplitude*r.width*r.height*decay/Math.PI**2;
 return {temperatureK:inside?r.wall+r.amplitude*Math.sin(2*Math.PI*x/r.width)*Math.sin(2*Math.PI*y/r.height)*decay:null,heatJ:energy,boundaryOutwardPowerW:lambda*energy,decay};
}
