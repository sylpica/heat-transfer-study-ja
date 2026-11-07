import {createMacVelocityField,traceFrozenStreamline} from './cavity-fields.mjs';
const cache=new WeakMap();
export function cavityViewData(state,mesh){
 if(cache.has(state))return cache.get(state);
 const velocity=createMacVelocityField(mesh,state),speed=state.temperature.map((_,n)=>Math.hypot(...velocity.at((n%mesh.nx+.5)*mesh.dx,(Math.floor(n/mesh.nx)+.5)*mesh.dy))),data={velocity,speed,temperature:state.temperature.map(t=>t-273.15),pressure:state.pressure};cache.set(state,data);return data;
}
export function drawCavity(canvas,state,mesh,{quantity='temperature',range,velocityScale,arrows=true,streamlines=false,probe=[.5,.5]}={}){
 const data=cavityViewData(state,mesh),ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,pad=25,fit=Math.min((W-2*pad)/mesh.width,(H-2*pad)/mesh.height),plot={left:(W-mesh.width*fit)/2,top:(H-mesh.height*fit)/2,width:mesh.width*fit,height:mesh.height*fit},px=x=>plot.left+x*fit,py=y=>plot.top+plot.height-y*fit,cw=mesh.dx*fit,ch=mesh.dy*fit;
 canvas.dataset.plot=JSON.stringify(plot);ctx.clearRect(0,0,W,H);
 for(let n=0;n<mesh.nx*mesh.ny;n++){const a=Math.max(0,Math.min(1,(data[quantity][n]-range[0])/(range[1]-range[0])));ctx.fillStyle=`hsl(${240*(1-a)} 80% 43%)`;ctx.fillRect(px((n%mesh.nx)*mesh.dx),py((Math.floor(n/mesh.nx)+1)*mesh.dy),cw+.3,ch+.3);}
 if(streamlines){
  if(!data.lines)data.lines=[[.25,.25],[.25,.5],[.25,.75],[.5,.25],[.5,.5],[.5,.75],[.75,.25],[.75,.5],[.75,.75]].map(p=>traceFrozenStreamline(data.velocity,[p[0]*mesh.width,p[1]*mesh.height],{maxPoints:500,maxLength:4*Math.hypot(mesh.width,mesh.height)}));
  ctx.strokeStyle='#fff';ctx.lineWidth=1.6;ctx.setLineDash([4,2]);for(const line of data.lines){ctx.beginPath();line.points.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.stroke();}ctx.setLineDash([]);
 }
 if(arrows&&velocityScale>0){ctx.strokeStyle='#101923';ctx.lineWidth=3;const stride=Math.max(1,Math.ceil(mesh.nx/8)),scale=Math.min(plot.width,plot.height)/12/velocityScale;for(let j=0;j<mesh.ny;j+=stride)for(let i=0;i<mesh.nx;i+=stride){const x=(i+.5)*mesh.dx,y=(j+.5)*mesh.dy,[u,v]=data.velocity.at(x,y),a=px(x),b=py(y),dx=u*scale,dy=-v*scale;if(Math.hypot(dx,dy)<.25)continue;const angle=Math.atan2(dy,dx),tip=[a+dx,b+dy];ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(...tip);ctx.lineTo(tip[0]-4*Math.cos(angle-.6),tip[1]-4*Math.sin(angle-.6));ctx.moveTo(...tip);ctx.lineTo(tip[0]-4*Math.cos(angle+.6),tip[1]-4*Math.sin(angle+.6));ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#101923';ctx.lineWidth=2;ctx.stroke();}}
 const x=px(probe[0]*mesh.width),y=py(probe[1]*mesh.height);ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,7,0,2*Math.PI);ctx.stroke();ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.stroke();
 return data;
}
