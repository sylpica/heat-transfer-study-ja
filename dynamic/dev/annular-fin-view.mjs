// App-created display for the annular fin core. The ring is a top-view
// schematic: each radial band is coloured by that cell's mean temperature.
// It is a display of the 1D radial solution, not a 2D conduction solution.
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
export function drawAnnularField(canvas,s,mesh,probe,lo,hi){
 const {ctx,W,H}=setup(canvas,300);
 const range=[lo,hi];
 const cx=W/2,cy=H/2-6,Rpx=Math.min(W,H)*.42,scale=Rpx/mesh.faces[mesh.cells];
 ctx.font='15px system-ui';ctx.fillStyle=fg(ctx);
 ctx.fillText('環状フィン上面の模式図（色はセル平均温度）',8,20);
 for(let i=mesh.cells-1;i>=0;i--){
  const r0=mesh.faces[i]*scale,r1=mesh.faces[i+1]*scale;
  ctx.beginPath();ctx.arc(cx,cy,r1,0,Math.PI*2);ctx.arc(cx,cy,r0,0,Math.PI*2,true);
  ctx.fillStyle=temperatureColor(s.temperature[i],range[0],range[1]);ctx.fill();
 }
 const rb=mesh.innerRadius*scale;
 ctx.beginPath();ctx.arc(cx,cy,rb,0,Math.PI*2);ctx.fillStyle=temperatureColor(s.temperature[0],range[0],range[1]);ctx.fill();
 ctx.beginPath();ctx.arc(cx,cy,rb,0,Math.PI*2);ctx.strokeStyle=fg(ctx);ctx.lineWidth=1;ctx.stroke();
 if(Number.isInteger(probe)&&probe>=0&&probe<mesh.cells){
  const r0=mesh.faces[probe]*scale,r1=mesh.faces[probe+1]*scale;
  ctx.beginPath();ctx.arc(cx,cy,(r0+r1)/2,0,Math.PI*2);ctx.strokeStyle=ACCENT;ctx.lineWidth=3;ctx.stroke();
 }
 ctx.fillStyle=fg(ctx);
 ctx.fillText(`内半径 ${(mesh.innerRadius*1000).toFixed(1)} mm（基部）`,8,H-28);
 ctx.fillText(`解いた外半径 ${(mesh.solvedOuterRadius*1000).toFixed(2)} mm`,8,H-8);
 canvas.setAttribute('aria-label',`環状フィンの上面模式図。基部側のセル平均${s.temperature[0].toFixed(2)} Kから先端セルの${s.temperature[mesh.cells-1].toFixed(2)} Kまで半径方向に変化します。2D解析ではありません。`);
 return range;
}
export function drawAnnularProfile(canvas,s,mesh,probe,lo,hi){
 const {ctx,W,H}=setup(canvas,200),l=58,r=12,t=12,b=26,pw=W-l-r,ph=H-t-b;
 const x0=mesh.faces[0],x1=mesh.faces[mesh.cells],X=v=>l+(v-x0)/(x1-x0)*pw,Y=v=>t+(hi-v)/(hi-lo)*ph;
 ctx.font='12px system-ui';ctx.strokeStyle=fg(ctx);ctx.fillStyle=fg(ctx);ctx.lineWidth=1;
 ctx.strokeRect(l,t,pw,ph);
 for(const f of [0,.5,1]){const v=lo+(hi-lo)*f,y=Y(v);ctx.fillText(v.toFixed(1),6,y+4);ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(l+pw,y);ctx.strokeStyle='rgba(128,145,165,.35)';ctx.stroke();ctx.strokeStyle=fg(ctx);}
 ctx.fillText(`${(x0*1000).toFixed(0)}`,l,H-8);const xEnd=`${(x1*1000).toFixed(0)} mm`;ctx.fillText(xEnd,l+pw-ctx.measureText(xEnd).width,H-8);
 ctx.fillText('温度 [K]',l+4,t+14);
 ctx.beginPath();mesh.centres.forEach((c,i)=>{const x=X(c),y=Y(s.temperature[i]);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
 ctx.strokeStyle=ACCENT;ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle=fg(ctx);ctx.lineWidth=1;
 if(Number.isInteger(probe)&&probe>=0&&probe<mesh.cells){
  const x=X(mesh.centres[probe]);ctx.beginPath();ctx.moveTo(x,t);ctx.lineTo(x,t+ph);ctx.strokeStyle=ACCENT;ctx.stroke();
  ctx.beginPath();ctx.arc(x,Y(s.temperature[probe]),4,0,Math.PI*2);ctx.fillStyle=ACCENT;ctx.fill();
 }
 canvas.setAttribute('aria-label',`半径方向の温度分布グラフ。横軸は半径[mm]、縦軸は温度[K]です。`);
}
