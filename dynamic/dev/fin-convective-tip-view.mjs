// App-created display for the straight fin core. The strip is a side-view
// schematic: each slice is coloured by that cell's mean temperature and the
// thickness is drawn exaggerated. It displays the 1D axial solution; it is
// not a 2D conduction solution.
const ACCENT='#ba7300';
function setup(canvas,height){
 const W=Math.max(300,canvas.clientWidth||600),H=height,ratio=devicePixelRatio||1,ctx=canvas.getContext('2d');
 canvas.style.width='100%';canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);
 ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,W,H);return {ctx,W,H};
}
function fg(ctx){return getComputedStyle(document.body).getPropertyValue('--fg').trim()||'#152538';}
function color(t,lo,hi){const f=hi>lo?Math.max(0,Math.min(1,(t-lo)/(hi-lo))):0;return `hsl(${240*(1-f)} 65% 50%)`;}
export function drawStraightField(canvas,s,mesh,probe,lo,hi){
 const {ctx,W,H}=setup(canvas,300);
 const x0=64,x1=W-16,sw=x1-x0,y0=H/2-52,y1=H/2+52;
 ctx.font='15px system-ui';ctx.fillStyle=fg(ctx);
 ctx.fillText('直線フィンの側面模式図（色はセル平均温度）',8,20);
 ctx.fillStyle=color(hi,lo,hi);ctx.fillRect(14,y0,x0-22,y1-y0);
 ctx.strokeStyle=fg(ctx);ctx.lineWidth=1;ctx.strokeRect(14,y0,x0-22,y1-y0);
 ctx.save();ctx.translate(28,(y0+y1)/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillStyle=fg(ctx);ctx.fillText('基部',0,5);ctx.restore();
 for(let i=0;i<mesh.cells;i++){
  const a=x0+sw*i/mesh.cells,b=x0+sw*(i+1)/mesh.cells;
  ctx.fillStyle=color(s.temperature[i],lo,hi);ctx.fillRect(a,y0,b-a,y1-y0);
  ctx.strokeStyle='rgba(21,37,56,.35)';ctx.strokeRect(a,y0,b-a,y1-y0);
 }
 if(Number.isInteger(probe)&&probe>=0&&probe<mesh.cells){
  const a=x0+sw*probe/mesh.cells,b=x0+sw*(probe+1)/mesh.cells;
  ctx.strokeStyle=ACCENT;ctx.lineWidth=3;ctx.strokeRect(a,y0,b-a,y1-y0);ctx.lineWidth=1;
 }
 ctx.fillStyle=fg(ctx);
 ctx.fillText(`長さ ${(mesh.length*1000).toFixed(1)} mm`,x0,H-64);
 ctx.fillText(`先端は右端（x=${(mesh.length*1000).toFixed(1)} mm）`,x0,H-44);
 canvas.setAttribute('aria-label',`直線フィンの側面模式図。基部側のセル平均${s.temperature[0].toFixed(2)} Kから先端セルの${s.temperature[mesh.cells-1].toFixed(2)} Kまで軸方向に変化します。2D解析ではありません。`);
}
export function drawStraightProfile(canvas,s,mesh,probe,lo,hi){
 const {ctx,W,H}=setup(canvas,200),l=58,r=12,t=12,b=26,pw=W-l-r,ph=H-t-b;
 const X=v=>l+v/mesh.length*pw,Y=v=>t+(hi-v)/(hi-lo)*ph;
 ctx.font='12px system-ui';ctx.strokeStyle=fg(ctx);ctx.fillStyle=fg(ctx);ctx.lineWidth=1;
 ctx.strokeRect(l,t,pw,ph);
 for(const f of [0,.5,1]){const v=lo+(hi-lo)*f,y=Y(v);ctx.fillText(v.toFixed(1),6,y+4);ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(l+pw,y);ctx.strokeStyle='rgba(128,145,165,.35)';ctx.stroke();ctx.strokeStyle=fg(ctx);}
 ctx.fillText('0',l,H-8);const xEnd=`${(mesh.length*1000).toFixed(0)} mm`;ctx.fillText(xEnd,l+pw-ctx.measureText(xEnd).width,H-8);
 ctx.fillText('温度 [K]',l+4,t+14);
 ctx.beginPath();mesh.centres.forEach((c,i)=>{const x=X(c),y=Y(s.temperature[i]);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
 ctx.strokeStyle=ACCENT;ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle=fg(ctx);ctx.lineWidth=1;
 if(Number.isInteger(probe)&&probe>=0&&probe<mesh.cells){
  const x=X(mesh.centres[probe]);ctx.beginPath();ctx.moveTo(x,t);ctx.lineTo(x,t+ph);ctx.strokeStyle=ACCENT;ctx.stroke();
  ctx.beginPath();ctx.arc(x,Y(s.temperature[probe]),4,0,Math.PI*2);ctx.fillStyle=ACCENT;ctx.fill();
 }
 canvas.setAttribute('aria-label','軸方向の温度分布グラフ。横軸は基部からの距離[mm]、縦軸は温度[K]です。');
}
