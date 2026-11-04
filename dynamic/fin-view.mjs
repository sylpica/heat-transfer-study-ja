export function rotatePoint([x,y,z],yaw,pitch){const a=Math.cos(yaw)*x+Math.sin(yaw)*z,b=-Math.sin(yaw)*x+Math.cos(yaw)*z;return [a,Math.cos(pitch)*y-Math.sin(pitch)*b,Math.sin(pitch)*y+Math.cos(pitch)*b];}
export function finFaces(temperature,{width,height,depth},yaw,pitch){
 if(!temperature?.length||temperature.some(t=>!Number.isFinite(t)||t<=0)||[width,height,depth].some(v=>!Number.isFinite(v)||v<=0))throw Error('フィンの表示形状/温度が不正です。');
 const faces=[],N=temperature.length;
 for(let i=0;i<N;i++){
  const x0=width*(i/N-.5),x1=width*((i+1)/N-.5),y0=-height/2,y1=height/2,z0=-depth/2,z1=depth/2;
  const corners=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]].map(p=>rotatePoint(p,yaw,pitch));
  const indices=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[3,2,6,7],...(i===0?[[0,3,7,4]]:[]),...(i===N-1?[[1,2,6,5]]:[])];
  for(const ids of indices){const points=ids.map(id=>corners[id]);faces.push({points,temperature:temperature[i],depth:points.reduce((s,p)=>s+p[2],0)/4});}
 }
 return faces.sort((a,b)=>a.depth-b.depth);
}
export function drawFin(canvas,temperature,dimensions,{yaw=.5,pitch=.4,zoom=1,range=[20,60]}={}){
 const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,scale=Math.min(W,H)*.8/Math.max(dimensions.width,dimensions.height,dimensions.depth)*zoom;
 ctx.clearRect(0,0,W,H);for(const face of finFaces(temperature,dimensions,yaw,pitch)){const t=face.temperature-273.15,position=Math.max(0,Math.min(1,(t-range[0])/(range[1]-range[0])));ctx.fillStyle=`hsl(${240*(1-position)} 80% 45%)`;ctx.strokeStyle='#30434a';ctx.lineWidth=.5;ctx.beginPath();face.points.forEach(([x,y],i)=>i?ctx.lineTo(W/2+x*scale,H/2-y*scale):ctx.moveTo(W/2+x*scale,H/2-y*scale));ctx.closePath();ctx.fill();ctx.stroke();}
}
