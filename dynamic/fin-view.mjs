export function rotatePoint([x,y,z],yaw,pitch){const a=Math.cos(yaw)*x+Math.sin(yaw)*z,b=-Math.sin(yaw)*x+Math.cos(yaw)*z;return [a,Math.cos(pitch)*y-Math.sin(pitch)*b,Math.sin(pitch)*y+Math.cos(pitch)*b];}
export function finFaces(temperature,{width,height,depth},yaw,pitch,{baseTemperature}={}){
 if(!temperature?.length||temperature.some(t=>!Number.isFinite(t)||t<=0)||[width,height,depth].some(v=>!Number.isFinite(v)||v<=0))throw Error('フィンの表示形状/温度が不正です。');
 if(baseTemperature!==undefined&&(!Number.isFinite(baseTemperature)||baseTemperature<=0))throw Error('基部の表示温度が不正です。');
 const faces=[],N=temperature.length;
 for(let i=0;i<N;i++){
  const x0=width*(i/N-.5),x1=width*((i+1)/N-.5),y0=-height/2,y1=height/2,z0=-depth/2,z1=depth/2;
  const corners=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]].map(p=>rotatePoint(p,yaw,pitch));
  const indices=[{ids:[0,1,2,3],kind:'side'},{ids:[4,5,6,7],kind:'side'},{ids:[0,1,5,4],kind:'side'},{ids:[3,2,6,7],kind:'side'},...(i===0?[{ids:[0,3,7,4],kind:'base'}]:[]),...(i===N-1?[{ids:[1,2,6,5],kind:'tip'}]:[])];
  for(const {ids,kind} of indices){const points=ids.map(id=>corners[id]);faces.push({points,kind,temperature:kind==='base'&&baseTemperature!==undefined?baseTemperature:temperature[i],depth:points.reduce((s,p)=>s+p[2],0)/4});}
 }
 return faces.sort((a,b)=>a.depth-b.depth);
}
export function finViewScale(dimensions,{widthPx,heightPx,yaw,pitch,zoom=1}){
 if(![dimensions?.width,dimensions?.height,dimensions?.depth,widthPx,heightPx,zoom].every(v=>Number.isFinite(v)&&v>0)||![yaw,pitch].every(Number.isFinite))throw Error('フィンの共通表示尺度が不正です。');
 const points=[];for(const x of [-dimensions.width/2,dimensions.width/2])for(const y of [-dimensions.height/2,dimensions.height/2])for(const z of [-dimensions.depth/2,dimensions.depth/2])points.push(rotatePoint([x,y,z],yaw,pitch));
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),scale=.75*Math.min(widthPx/(Math.max(...xs)-Math.min(...xs)),heightPx/(Math.max(...ys)-Math.min(...ys)))*zoom;
 if(!Number.isFinite(scale)||scale<=0)throw Error('フィンの表示尺度が数値範囲外です。');return scale;
}
export function drawFin(canvas,temperature,dimensions,{yaw=.5,pitch=.4,zoom=1,range=[20,60],referenceDimensions,baseTemperature}={}){
 const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,faces=finFaces(temperature,dimensions,yaw,pitch,{baseTemperature}),points=faces.flatMap(f=>f.points),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),scale=referenceDimensions?finViewScale(referenceDimensions,{widthPx:W,heightPx:H,yaw,pitch,zoom}):.75*Math.min(W/(Math.max(...xs)-Math.min(...xs)),H/(Math.max(...ys)-Math.min(...ys)))*zoom;
 ctx.clearRect(0,0,W,H);for(const face of faces){const t=face.temperature-273.15,position=Math.max(0,Math.min(1,(t-range[0])/(range[1]-range[0])));ctx.fillStyle=`hsl(${240*(1-position)} 80% 45%)`;ctx.strokeStyle='#30434a';ctx.lineWidth=.5;ctx.beginPath();face.points.forEach(([x,y],i)=>i?ctx.lineTo(W/2+x*scale,H/2-y*scale):ctx.moveTo(W/2+x*scale,H/2-y*scale));ctx.closePath();ctx.fill();ctx.stroke();}
 return {pixelsPerMetre:scale};
}
