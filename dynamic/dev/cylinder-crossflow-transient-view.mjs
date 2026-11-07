// App-created display for the cylinder cross-flow transient core.  The
// cross-section is a top-view schematic: each concentric ring is coloured
// by that radial cell's mean temperature.  Because h is the circumference
// average taken as uniform, the solved field depends on r only; this is a
// display of the 1D radial solution, not a 2D conduction solution.
const ACCENT='#ba7300';
function setup(canvas,height){
 const W=Math.max(300,canvas.clientWidth||600),H=height,ratio=devicePixelRatio||1,ctx=canvas.getContext('2d');
 canvas.style.width='100%';canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);
 ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,W,H);return {ctx,W,H};
}
function fg(ctx){return getComputedStyle(document.body).getPropertyValue('--fg').trim()||'#152538';}
export function temperatureColor(t,lo,hi){
 const f=hi>lo?Math.max(0,Math.min(1,(t-lo)/(hi-lo))):0;
 return `hsl(${240*(1-f)} 65% 50%)`;
}
export function drawCylinderField(canvas,s,probe,lo,hi){
 const {ctx,W,H}=setup(canvas,300);
 const n=s.cells,dr=s.radius/n,cx=W/2,cy=H/2-6,Rpx=Math.min(W,H)*.42,scale=Rpx/s.radius;
 ctx.font='15px system-ui';ctx.fillStyle=fg(ctx);
 ctx.fillText('円柱断面の模式図（色はセル平均温度）',8,20);
 // Free-stream arrows where the margins leave room (schematic of the setup
 // only; the temperature field itself carries no angular variation).
 if(cx-Rpx>110){
  ctx.strokeStyle=fg(ctx);ctx.fillStyle=fg(ctx);ctx.lineWidth=2;
  for(const x0 of [cx-Rpx-96,cx+Rpx+16]){
   ctx.beginPath();ctx.moveTo(x0,cy);ctx.lineTo(x0+64,cy);ctx.stroke();
   ctx.beginPath();ctx.moveTo(x0+64,cy);ctx.lineTo(x0+52,cy-6);ctx.lineTo(x0+52,cy+6);ctx.closePath();ctx.fill();
  }
  ctx.font='12px system-ui';ctx.fillText('一様流',cx-Rpx-96,cy-14);
  ctx.font='15px system-ui';
 }
 for(let i=n-1;i>=1;i--){
  const r0=i*dr*scale,r1=(i+1)*dr*scale;
  ctx.beginPath();ctx.arc(cx,cy,r1,0,Math.PI*2);ctx.arc(cx,cy,r0,0,Math.PI*2,true);
  ctx.fillStyle=temperatureColor(s.temperature[i],lo,hi);ctx.fill();
 }
 ctx.beginPath();ctx.arc(cx,cy,dr*scale,0,Math.PI*2);ctx.fillStyle=temperatureColor(s.temperature[0],lo,hi);ctx.fill();
 ctx.beginPath();ctx.arc(cx,cy,Rpx,0,Math.PI*2);ctx.strokeStyle=fg(ctx);ctx.lineWidth=1;ctx.stroke();
 if(Number.isInteger(probe)&&probe>=0&&probe<n){
  const rm=(probe+.5)*dr*scale;
  ctx.beginPath();ctx.arc(cx,cy,rm,0,Math.PI*2);ctx.strokeStyle=ACCENT;ctx.lineWidth=3;ctx.stroke();
 }
 ctx.fillStyle=fg(ctx);
 ctx.fillText(`直径 ${(s.diameter*1000).toFixed(2)} mm（中心 r=0 〜 表面 r=R）`,8,H-28);
 ctx.fillText(`表面温度 ${s.surfaceTemperature.toFixed(2)} K、流体温度 ${s.fluidTemperature.toFixed(2)} K`,8,H-8);
 canvas.setAttribute('aria-label',`円柱断面の模式図。中心セルの平均${s.temperature[0].toFixed(2)} Kから最外セルの${s.temperature[n-1].toFixed(2)} Kまで半径方向に変化します。角度方向の分布は解いていません。`);
 return [lo,hi];
}
export function drawCylinderProfile(canvas,s,probe,lo,hi){
 const {ctx,W,H}=setup(canvas,200),l=58,r=12,t=12,b=26,pw=W-l-r,ph=H-t-b;
 const X=v=>l+v/s.radius*pw,Y=v=>t+(hi-v)/(hi-lo)*ph;
 ctx.font='12px system-ui';ctx.strokeStyle=fg(ctx);ctx.fillStyle=fg(ctx);ctx.lineWidth=1;
 ctx.strokeRect(l,t,pw,ph);
 for(const f of [0,.5,1]){const v=lo+(hi-lo)*f,y=Y(v);ctx.fillText(v.toFixed(1),6,y+4);ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(l+pw,y);ctx.strokeStyle='rgba(128,145,165,.35)';ctx.stroke();ctx.strokeStyle=fg(ctx);}
 ctx.fillText('中心 0',l,H-8);const xEnd=`表面 ${(s.radius*1000).toFixed(1)} mm`;ctx.fillText(xEnd,l+pw-ctx.measureText(xEnd).width,H-8);
 ctx.fillText('温度 [K]',l+4,t+14);
 ctx.beginPath();s.centres.forEach((c,i)=>{const x=X(c),y=Y(s.temperature[i]);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
 ctx.strokeStyle=ACCENT;ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle=fg(ctx);ctx.lineWidth=1;
 if(Number.isInteger(probe)&&probe>=0&&probe<s.cells){
  const x=X(s.centres[probe]);ctx.beginPath();ctx.moveTo(x,t);ctx.lineTo(x,t+ph);ctx.strokeStyle=ACCENT;ctx.stroke();
  ctx.beginPath();ctx.arc(x,Y(s.temperature[probe]),4,0,Math.PI*2);ctx.fillStyle=ACCENT;ctx.fill();
 }
 canvas.setAttribute('aria-label',`半径方向の温度分布グラフ。横軸は半径[mm]（中心0から表面まで）、縦軸は温度[K]です。`);
}
