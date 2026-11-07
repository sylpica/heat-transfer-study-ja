// App-created display of the steady Graetz solver's cell-average field.
// The prescribed Poiseuille profile is shown as row-mean arrows only; no
// entrance momentum layer, eddies or 3D field is invented.
function finite(value,name){if(typeof value!=='number'||!Number.isFinite(value))throw Error(`${name}が有限値ではありません。`);return value;}
export function graetzLayout(mesh,logicalWidth){
 const W=Math.max(300,finite(logicalWidth,'表示幅')),physicalHeight=(W-110)*finite(mesh.height,'高さ')/finite(mesh.width,'長さ');
 if(!(mesh.width>0&&mesh.height>0&&physicalHeight>0))throw Error('表示形状の寸法は正です。');
 const height=Math.max(110,Math.min(320,physicalHeight));return {left:58,top:86,width:W-110,height,logicalWidth:W,logicalHeight:height+172,verticalExaggeration:height/physicalHeight};
}
export function sampleGraetz(result,probe){
 if(!Array.isArray(probe)||probe.length!==2||probe.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))throw Error('測定点は0〜1の割合2つです。');
 const {nx,ny}=result.mesh;if(result.temperature.length!==nx*ny)throw Error('測定対象の格子/配列が一致しません。');
 // Columns can be non-uniform (geometric dx); locate by physical x fraction.
 const target=probe[0]*result.mesh.width;let i=nx-1,acc=0;for(let n=0;n<nx;n++){acc+=result.mesh.dxWidths[n];if(target<=acc){i=n;break;}}
 const j=Math.min(ny-1,Math.floor(probe[1]*ny)),index=j*nx+i;
 const out={i,j,index,x:result.mesh.xCenters[i],y:(j+.5)*result.mesh.dy,temperature:result.temperature[index],velocity:result.rowVelocity[j],bulkTemperature:result.bulkTemperature[i],lowerWallTemperature:result.lowerWallTemperature[i],upperWallTemperature:result.upperWallTemperature[i],localNusselt:result.localNusselt[i],dimensionlessLength:result.dimensionlessLength[i]};
 for(const [key,value]of Object.entries(out))if(value!==null)finite(value,key);return out;
}
const compact=v=>v!==0&&(Math.abs(v)<.001||Math.abs(v)>=1e4)?v.toExponential(2):Number(v.toPrecision(4)).toString();
export function drawGraetzField(canvas,result,{probe=[.5,.5]}={}){
 const sample=sampleGraetz(result,probe),mesh=result.mesh,p=graetzLayout(mesh,canvas.clientWidth),ratio=devicePixelRatio||1,W=p.logicalWidth,H=p.logicalHeight;
 const all=[...result.temperature,...result.lowerWallTemperature,...result.upperWallTemperature],lower=Math.min(...all),upper=Math.max(...all);finite(lower,'色スケール下限');finite(upper,'色スケール上限');
 canvas.style.width='100%';canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);canvas.dataset.plot=JSON.stringify(p);const ctx=canvas.getContext('2d'),fg=getComputedStyle(document.body).getPropertyValue('--fg').trim()||'#152538';ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,W,H);
 const color=t=>upper>lower?`hsl(${240*(1-Math.max(0,Math.min(1,(t-lower)/(upper-lower))))} 68% 52%)`:'hsl(240 68% 52%)';
 const {nx,ny}=mesh;let fx=p.left;for(let i=0;i<nx;i++){const w=p.width*mesh.dxWidths[i]/mesh.width;for(let j=0;j<ny;j++){ctx.fillStyle=color(result.temperature[j*nx+i]);ctx.fillRect(fx,p.top+p.height*(1-(j+1)/ny),w+.5,p.height/ny+.5);}ctx.fillStyle=color(result.lowerWallTemperature[i]);ctx.fillRect(fx,p.top+p.height,w+.5,4);ctx.fillStyle=color(result.upperWallTemperature[i]);ctx.fillRect(fx,p.top-4,w+.5,4);fx+=w;}
 ctx.strokeStyle=fg;ctx.lineWidth=1;ctx.strokeRect(p.left,p.top,p.width,p.height);ctx.fillStyle=fg;ctx.font='15px system-ui';
 ctx.fillText(result.boundary.type==='wall-heat-flux'?`セル平均温度 [K]・両壁 q″=${compact(result.boundary.wallHeatFlux)} W/m²`:result.boundary.type==='wall-heat-flux-insulated'?`セル平均温度 [K]・下壁 q″=${compact(result.boundary.wallHeatFlux)} W/m²、上壁は断熱`:`セル平均温度 [K]・両壁 Tw=${compact(result.boundary.wallTemperature)} K`,8,19);
 ctx.font='13px system-ui';ctx.fillText(`色範囲 ${compact(lower)}〜${compact(upper)} K（壁の再構成/指定温度を含む）`,8,42);
 ctx.font='14px system-ui';ctx.fillText('y [m]',4,p.top-18);ctx.fillText(compact(mesh.height),3,p.top+12);ctx.fillText('0',28,p.top+p.height);ctx.fillText('0',p.left,p.top+p.height+24);ctx.textAlign='right';ctx.fillText(`${compact(mesh.width)} m`,p.left+p.width,p.top+p.height+24);ctx.textAlign='left';ctx.fillText('x → 入口から出口',p.left,p.top+p.height+46);ctx.font='12px system-ui';ctx.fillText(p.verticalExaggeration>1.0001?`縦×${p.verticalExaggeration.toFixed(2)}拡大（軸は実寸）`:'図の縦横は実寸比',8,H-9);
 function arrow(x1,y1,x2,y2){if(x1===x2&&y1===y2)return;const angle=Math.atan2(y2-y1,x2-x1),head=5;ctx.strokeStyle=fg;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.moveTo(x2-head*Math.cos(angle-.6),y2-head*Math.sin(angle-.6));ctx.lineTo(x2,y2);ctx.lineTo(x2-head*Math.cos(angle+.6),y2-head*Math.sin(angle+.6));ctx.stroke();}
 const umax=Math.max(...result.rowVelocity),stride=Math.max(1,Math.floor(ny/4));for(let j=(stride/2|0);j<ny;j+=stride){const u=result.rowVelocity[j],length=umax>0?.1*p.width*u/umax:0,y=p.top+p.height*(1-(j+.5)/ny);for(const f of [.15,.45,.75]){const x=p.left+p.width*f;arrow(x,y,x+length,y);}}
 const px=p.left+probe[0]*p.width,py=p.top+(1-probe[1])*p.height;for(const [stroke,width]of [['#fff',5],['#111',2]]){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(px-7,py);ctx.lineTo(px+7,py);ctx.moveTo(px,py-7);ctx.lineTo(px,py+7);ctx.stroke();}
 canvas.setAttribute('aria-label',`左の指定入口から右の対流出口へ流れる定常Poiseuille平均流の定常温度場。温度${lower.toFixed(4)}〜${upper.toFixed(4)} K。測定セル${sample.temperature.toFixed(5)} K。${p.verticalExaggeration>1.0001?`縦を${p.verticalExaggeration.toFixed(2)}倍に拡大。`:''}速度の入口発達や3D流れは計算していません。クリックまたは矢印キーで測定点を移動。`);
}
export function drawGraetzProfiles(canvas,result,{probe=[.5,.5]}={}){
 const W=Math.max(300,finite(canvas.clientWidth,'表示幅')),H=300,ratio=devicePixelRatio||1;
 canvas.style.width='100%';canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);const ctx=canvas.getContext('2d'),fg=getComputedStyle(document.body).getPropertyValue('--fg').trim()||'#152538';ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,W,H);
 const left=58,right=14,pw=W-left-right;
 function panel(top,ph,title){ctx.strokeStyle=fg;ctx.lineWidth=1;ctx.strokeRect(left,top,pw,ph);ctx.fillStyle=fg;ctx.font='13px system-ui';ctx.fillText(title,left,top-6);return {top,ph};}
 // Bulk temperature vs x (linear).
 {const {top,ph}=panel(24,104,'バルク温度 Tb(x) [K]'),tb=result.bulkTemperature,lo=Math.min(...tb),hi=Math.max(...tb),pad=(hi-lo)*.05+1e-9,a=lo-pad,b=hi+pad;
  ctx.beginPath();tb.forEach((v,i)=>{const x=left+pw*result.mesh.xCenters[i]/result.mesh.width,y=top+ph*(1-(v-a)/(b-a));i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle='#2563eb';ctx.lineWidth=1.8;ctx.stroke();
  ctx.fillStyle=fg;ctx.font='12px system-ui';ctx.fillText(compact(b),4,top+12);ctx.fillText(compact(a),4,top+ph);ctx.fillText('x [m] →',left,H-158);}
 // Local Nusselt vs x* (log-log), with the fully developed limit.
 {const {top,ph}=panel(178,104,'局所 Nu_Dh（横軸 x*、両対数）'),dev=result.boundary.type==='wall-heat-flux'?140/17:result.boundary.type==='wall-heat-flux-insulated'?70/13:7.541;
  const pts=result.localNusselt.map((nu,i)=>[result.dimensionlessLength[i],nu]).filter(([,nu])=>nu!==null&&nu>0);
  if(pts.length){const xs=pts.map(p=>p[0]),ns=pts.map(p=>p[1]),x0=Math.log10(Math.min(...xs)),x1=Math.log10(Math.max(...xs)),n0=Math.log10(Math.min(Math.min(...ns),dev)*.9),n1=Math.log10(Math.max(Math.max(...ns),dev)*1.1);
   const X=v=>left+pw*(Math.log10(v)-x0)/(x1-x0),Y=v=>top+ph*(1-(Math.log10(v)-n0)/(n1-n0));
   ctx.setLineDash([5,4]);ctx.strokeStyle='#ba7300';ctx.beginPath();ctx.moveTo(left,Y(dev));ctx.lineTo(left+pw,Y(dev));ctx.stroke();ctx.setLineDash([]);
   ctx.beginPath();pts.forEach(([xs,nu],i)=>{i?ctx.lineTo(X(xs),Y(nu)):ctx.moveTo(X(xs),Y(nu));});ctx.strokeStyle='#2563eb';ctx.lineWidth=1.8;ctx.stroke();
   ctx.fillStyle=fg;ctx.font='12px system-ui';ctx.fillText(`発達限界 ${dev===140/17?'140/17≈8.235':dev===70/13?'70/13≈5.385':'7.541'}`,left+6,Y(dev)-5);ctx.fillText(`x* ${compact(Math.min(...xs))}〜${compact(Math.max(...xs))}`,left,H-4);ctx.textAlign='right';ctx.fillText(`Nu ${compact(Math.min(...ns))}〜${compact(Math.max(...ns))}`,left+pw-6,top+14);ctx.textAlign='left';}
  const sample=sampleGraetz(result,probe),px=left+pw*probe[0];ctx.strokeStyle='#d04d39';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,178);ctx.lineTo(px,178+104);ctx.stroke();}
 canvas.setAttribute('aria-label','バルク温度の流れ方向変化と、無次元長さx*に対する局所ヌセルト数の両対数グラフ。破線は十分発達した限界値。');
}
