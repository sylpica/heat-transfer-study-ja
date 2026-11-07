// App-created 3D shape display of a uniform base plus identical 1D fin solutions.
// Extruding/repeating a solved 1D field is not a 3D numerical solution.
export function heatSinkScene(s,m){
 const items=[{kind:'base',temperature:s.baseTemperature,bounds:[-m.baseWidth/2,m.baseWidth/2,-m.baseThickness,0,-m.baseDepth/2,m.baseDepth/2]}];
 const gap=(m.baseWidth-m.finCount*m.finThickness)/(m.finCount+1);
 for(let f=0;f<m.finCount;f++)for(let j=0;j<m.finCells;j++){
  const x=-m.baseWidth/2+gap+f*(m.finThickness+gap);items.push({kind:'fin',fin:f,cell:j,temperature:s.finTemperature[j],bounds:[x,x+m.finThickness,j*m.dx,(j+1)*m.dx,-m.baseDepth/2,m.baseDepth/2]});
 }return items;
}
export function drawHeatSink(canvas,s,m,{yaw=.55,pitch=.45,zoom=1,range=[290,350]}={}){
 const W=Math.max(300,canvas.clientWidth),H=300,ratio=devicePixelRatio||1,ctx=canvas.getContext('2d');canvas.style.width='100%';canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,W,H);
 const scene=heatSinkScene(s,m),scale=.57*Math.min(W,H)/Math.max(m.baseWidth,m.baseDepth,m.finLength+m.baseThickness)*zoom,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 function project([x,y,z]){const a=x*cy-z*sy,b=x*sy+z*cy;return [W/2+scale*a,H*.62-scale*(y*cp-b*sp),y*sp+b*cp];}
 const faces=[];for(const item of scene){const [a,b,c,d,e,f]=item.bounds,vertices=[[a,c,e],[b,c,e],[b,d,e],[a,d,e],[a,c,f],[b,c,f],[b,d,f],[a,d,f]].map(project);
  for(const indices of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]]){const points=indices.map(i=>vertices[i]);faces.push({points,depth:points.reduce((v,p)=>v+p[2]/4,0),temperature:item.temperature});}}
 faces.sort((a,b)=>a.depth-b.depth);for(const face of faces){const f=Math.max(0,Math.min(1,(face.temperature-range[0])/(range[1]-range[0])));ctx.fillStyle=`hsl(${240*(1-f)} 65% 50%)`;ctx.strokeStyle='#152538';ctx.lineWidth=.4;ctx.beginPath();face.points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();ctx.stroke();}
 ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--fg').trim()||'#152538';ctx.font='15px system-ui';ctx.fillText('同じ1D温度場を各フィンへ配置',8,20);ctx.fillText(`基部 ${(m.baseWidth*1000).toFixed(1)}×${(m.baseDepth*1000).toFixed(1)} mm`,8,H-30);ctx.fillText(`フィン ${m.finCount}本・長さ ${(m.finLength*1000).toFixed(1)} mm`,8,H-10);
 canvas.setAttribute('aria-label',`均一温度の基部${s.baseTemperature.toFixed(4)} Kと、同じ1D温度分布のフィン${m.finCount}本の形状表示。3D解析ではありません。回転は表示だけを変えます。`);
}
