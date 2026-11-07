// App-created display for the radial-multilayer core. The ring figure is a
// top view (cylinder) / cross-section (sphere) schematic: each radial band
// is coloured by that cell's mean temperature. It displays the 1D radial
// solution; it is not a 2D conduction solution.
const ACCENT='#ba7300';
function setup(canvas,height){
 const W=Math.max(300,canvas.clientWidth||600),H=height,ratio=devicePixelRatio||1,ctx=canvas.getContext('2d');
 canvas.style.width='100%';canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);
 ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,W,H);return {ctx,W,H};
}
function fg(){return getComputedStyle(document.body).getPropertyValue('--fg').trim()||'#152538';}
export function temperatureColor(t,lo,hi){
 const f=hi>lo?Math.max(0,Math.min(1,(t-lo)/(hi-lo))):0;
 return `hsl(${240*(1-f)} 65% 50%)`;
}
export function drawMultilayerField(canvas,s,mesh,probe,lo,hi){
 const {ctx,W,H}=setup(canvas,300),colour=fg();
 const cx=W/2,cy=H/2-6,Rpx=Math.min(W,H)*.42,scale=Rpx/mesh.outerRadius;
 ctx.font='15px system-ui';ctx.fillStyle=colour;
 ctx.fillText(mesh.geometry==='sphere'?'球の断面模式図（色はセル平均温度）':'円筒の上面模式図（色はセル平均温度）',8,20);
 const n=mesh.count,faces=mesh.faces;
 for(let i=n-1;i>=0;i--){
  const r0=faces[i]*scale,r1=faces[i+1]*scale;
  ctx.beginPath();ctx.arc(cx,cy,Math.max(r1,.6),0,Math.PI*2);
  if(r0>0)ctx.arc(cx,cy,r0,0,Math.PI*2,true);
  ctx.fillStyle=temperatureColor(s.temperature[i],lo,hi);ctx.fill();
 }
 // Material interfaces are drawn as emphasised circles.
 ctx.strokeStyle=colour;ctx.lineWidth=2;
 for(const it of mesh.interfaces){ctx.beginPath();ctx.arc(cx,cy,it.radius*scale,0,Math.PI*2);ctx.stroke();}
 ctx.lineWidth=1;
 if(mesh.innerRadius===0){ctx.beginPath();ctx.arc(cx,cy,1.5,0,Math.PI*2);ctx.fillStyle=colour;ctx.fill();}
 if(Number.isInteger(probe)&&probe>=0&&probe<n){
  const r0=faces[probe]*scale,r1=faces[probe+1]*scale;
  ctx.beginPath();ctx.arc(cx,cy,(r0+r1)/2,0,Math.PI*2);ctx.strokeStyle=ACCENT;ctx.lineWidth=3;ctx.stroke();ctx.lineWidth=1;
 }
 ctx.fillStyle=colour;
 ctx.fillText(`内半径 ${(mesh.innerRadius*1000).toFixed(1)} mm`,8,H-28);
 ctx.fillText(`外半径 ${(mesh.outerRadius*1000).toFixed(1)} mm（太線は材料界面）`,8,H-8);
 canvas.setAttribute('aria-label',`${mesh.geometry==='sphere'?'球の断面':'円筒の上面'}模式図。中心側のセル平均${s.temperature[0].toFixed(2)} Kから外側セルの${s.temperature[n-1].toFixed(2)} Kまで半径方向に変化します。2D解析ではありません。`);
}
export function drawMultilayerProfile(canvas,s,mesh,fluxData,probe,lo,hi){
 const {ctx,W,H}=setup(canvas,220),colour=fg(),l=58,r=12,t=12,b=26,pw=W-l-r,ph=H-t-b;
 const x0=mesh.faces[0],x1=mesh.faces.at(-1),X=v=>l+(v-x0)/(x1-x0)*pw,Y=v=>t+(hi-v)/(hi-lo)*ph;
 ctx.font='12px system-ui';ctx.strokeStyle=colour;ctx.fillStyle=colour;ctx.lineWidth=1;
 ctx.strokeRect(l,t,pw,ph);
 for(const f of [0,.5,1]){const v=lo+(hi-lo)*f,y=Y(v);ctx.fillText(v.toFixed(1),6,y+4);ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(l+pw,y);ctx.strokeStyle='rgba(128,145,165,.35)';ctx.stroke();ctx.strokeStyle=colour;}
 ctx.fillText(`${(x0*1000).toFixed(0)}`,l,H-8);const xEnd=`${(x1*1000).toFixed(0)} mm`;ctx.fillText(xEnd,l+pw-ctx.measureText(xEnd).width,H-8);
 ctx.fillText('温度 [K]',l+4,t+14);
 // Interface positions: dashed verticals, with the two surface
 // temperatures joined by a segment so the contact jump stays visible.
 for(const it of fluxData.interfaces){
  const x=X(it.radius);
  ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(x,t);ctx.lineTo(x,t+ph);ctx.strokeStyle=colour;ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(x,Y(it.leftSurfaceTemperature));ctx.lineTo(x,Y(it.rightSurfaceTemperature));ctx.strokeStyle=ACCENT;ctx.lineWidth=3;ctx.stroke();ctx.lineWidth=1;
  ctx.fillStyle=ACCENT;
  ctx.beginPath();ctx.arc(x,Y(it.leftSurfaceTemperature),3.5,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x,Y(it.rightSurfaceTemperature),3.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=colour;
 }
 // Surface points and the cell-centre profile.
 ctx.beginPath();ctx.arc(X(x0),Y(s.innerSurfaceTemperature),3.5,0,Math.PI*2);ctx.fillStyle=ACCENT;ctx.fill();ctx.fillStyle=colour;
 ctx.beginPath();mesh.centres.forEach((c,i)=>{const x=X(c),y=Y(s.temperature[i]);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
 ctx.strokeStyle=ACCENT;ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle=colour;ctx.lineWidth=1;
 ctx.beginPath();ctx.arc(X(x1),Y(s.outerSurfaceTemperature),3.5,0,Math.PI*2);ctx.fillStyle=ACCENT;ctx.fill();ctx.fillStyle=colour;
 if(Number.isInteger(probe)&&probe>=0&&probe<mesh.count){
  const x=X(mesh.centres[probe]);ctx.beginPath();ctx.moveTo(x,t);ctx.lineTo(x,t+ph);ctx.strokeStyle=ACCENT;ctx.stroke();
  ctx.beginPath();ctx.arc(x,Y(s.temperature[probe]),4,0,Math.PI*2);ctx.fillStyle=ACCENT;ctx.fill();
 }
 canvas.setAttribute('aria-label','半径方向の温度分布グラフ。横軸は半径[mm]、縦軸は温度[K]です。材料界面では接触熱抵抗による温度ジャンプを縦の線分で示します。');
}
