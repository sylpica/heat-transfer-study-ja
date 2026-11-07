// App-created meridional half-section. Every colored rectangle represents a
// complete circular annular control volume, not a planar or pointwise field.
const finite=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error(`${name}は有限値が必要です。`);return v;};
export function heatedPipeLayout(mesh,width){
 const W=Math.max(300,finite(width,'表示幅')),plotWidth=W-112,physicalHeight=plotWidth*mesh.radius/mesh.width;
 if(!(physicalHeight>0&&Number.isFinite(physicalHeight)))throw Error('円管の表示寸法が不正です。');
 const height=Math.max(110,physicalHeight);return {left:58,top:92,width:plotWidth,height,base:92+height,logicalWidth:W,logicalHeight:height+205,verticalExaggeration:height/physicalHeight};
}
export function sampleHeatedPipe(s,m,probe){
 if(!Array.isArray(probe)||probe.length!==2||probe.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))throw Error('測定位置は0〜1の割合2つです。');
 if(!Number.isSafeInteger(m.nx)||!Number.isSafeInteger(m.nr)||m.nx<1||m.nr<1||s.temperature.length!==m.nx*m.nr||s.offsetTemperature.length!==m.nx*m.nr||m.rowAreaMeanVelocityMPerS.length!==m.nr)throw Error('円管の環帯格子が一致しません。');
 const i=Math.min(m.nx-1,Math.floor(probe[0]*m.nx)),j=Math.min(m.nr-1,Math.floor(probe[1]*m.nr)),index=j*m.nx+i;
 const r={i,j,index,selectedX:probe[0]*m.width,selectedRadius:probe[1]*m.radius,x:(i+.5)*m.dx,areaCentroidRadius:m.radialAreaCentroidsM[j],innerRadius:m.radialEdgesM[j],outerRadius:m.radialEdgesM[j+1],temperatureK:s.temperature[index],offsetK:s.offsetTemperature[index],velocity:m.rowAreaMeanVelocityMPerS[j],bulkK:s.bulkTemperature[i],wallK:s.wallTemperature[i],wallBulkNu:s.wallToBulkNusselt[i]??null,nuUndefinedReason:s.nusseltUndefinedReasons[i]};
 for(const [k,v]of Object.entries(r))if(k!=='nuUndefinedReason'&&v!==null)finite(v,k);return r;
}
const compact=v=>v!==0&&(Math.abs(v)<.001||Math.abs(v)>=1e4)?v.toExponential(2):Number(v.toPrecision(4)).toString();
export function drawHeatedPipe(canvas,s,m,{range,probe=[.75,.5],velocityScale,wallHeatFlux,arrows=true}={}){
 const reading=sampleHeatedPipe(s,m,probe),p=heatedPipeLayout(m,canvas.clientWidth),[low,high]=range||[];
 finite(low,'色下限');finite(high,'色上限');finite(velocityScale,'速度基準');finite(wallHeatFlux,'壁熱流束');if(!(high>low&&velocityScale>0))throw Error('色/速度スケールが不正です。');
 const ratio=devicePixelRatio||1,W=p.logicalWidth,H=p.logicalHeight;canvas.style.width='100%';canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);canvas.dataset.plot=JSON.stringify(p);const ctx=canvas.getContext('2d'),fg=getComputedStyle(document.body).getPropertyValue('--fg').trim()||'#152538';ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,W,H);
 const color=t=>`hsl(${240*(1-Math.max(0,Math.min(1,(t-low)/(high-low))))} 68% 52%)`;
 for(let j=0;j<m.nr;j++)for(let i=0;i<m.nx;i++){ctx.fillStyle=color(s.temperature[j*m.nx+i]);ctx.fillRect(p.left+p.width*i/m.nx,p.top+p.height*(1-(j+1)/m.nr),p.width/m.nx+.5,p.height/m.nr+.5);}
 for(let i=0;i<m.nx;i++){ctx.fillStyle=color(s.wallTemperature[i]);ctx.fillRect(p.left+p.width*i/m.nx,p.top-4,p.width/m.nx+.5,4);}
 ctx.strokeStyle=fg;ctx.lineWidth=1;ctx.strokeRect(p.left,p.top,p.width,p.height);ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(p.left-20,p.base);ctx.lineTo(p.left+p.width+20,p.base);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=fg;ctx.font='14px system-ui';ctx.fillText('環帯平均温度 [K]・指定発達速度',8,20);ctx.fillText(`円周壁 q″=${compact(wallHeatFlux)} W/m²`,8,43);ctx.font='12px system-ui';ctx.fillText('r≥0 の半径断面（全周一様・アプリ作成）',8,64);ctx.fillText('r [m]',3,p.top-12);ctx.fillText(compact(m.radius),2,p.top+12);ctx.fillText('0',28,p.base);ctx.fillText('対称軸：面積0、熱流0（壁ではない）',p.left,p.base+22);ctx.fillText('0',p.left,p.base+46);ctx.textAlign='right';ctx.fillText(`${compact(m.width)} m`,p.left+p.width,p.base+46);ctx.textAlign='left';ctx.fillText('x → 入口から出口',p.left,p.base+66);ctx.fillText(p.verticalExaggeration>1.0001?`半径方向×${p.verticalExaggeration.toFixed(2)}拡大、軸は実寸`:'図の縦横は実寸比',8,H-9);
 function arrow(x,y,dx,dy){if(dx===0&&dy===0)return;const angle=Math.atan2(dy,dx);for(const [stroke,width]of [['#fff',4],['#111',1.6]]){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.moveTo(x+dx-5*Math.cos(angle-.6),y+dy-5*Math.sin(angle-.6));ctx.lineTo(x+dx,y+dy);ctx.lineTo(x+dx-5*Math.cos(angle+.6),y+dy-5*Math.sin(angle+.6));ctx.stroke();}}
 if(arrows){const stride=Math.max(1,Math.floor(m.nr/4));for(let j=0;j<m.nr;j+=stride)for(const x of [.15,.45,.75])arrow(p.left+p.width*x,p.base-p.height*(j+.5)/m.nr,.1*p.width*m.rowAreaMeanVelocityMPerS[j]/velocityScale,0);if(wallHeatFlux!==0)for(const x of [.25,.55,.85])arrow(p.left+p.width*x,p.top+(wallHeatFlux>0?-24:5),0,wallHeatFlux>0?25:-25);}
 // Mark the actual annular representative, not the pointer as a pointwise T.
 const x=p.left+reading.x/m.width*p.width,y=p.base-reading.areaCentroidRadius/m.radius*p.height;for(const [stroke,width]of [['#fff',5],['#111',2]]){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x-6,y);ctx.lineTo(x+6,y);ctx.moveTo(x,y-6);ctx.lineTo(x,y+6);ctx.stroke();}
 canvas.setAttribute('aria-label',`時刻${s.time}秒。全円管のr≥0半径断面、各色は全周環帯体積平均。対称軸r=0の熱流0、外周壁r=${m.radius}mの熱流束${wallHeatFlux}W/m²。測定環帯平均温度${reading.temperatureK.toFixed(7)}K。半径方向表示倍率${p.verticalExaggeration.toFixed(2)}。流速は指定放物線の環帯平均で、流れの時間変化や3Dを計算しません。矢印キーで隣のセルへ移動。`);
 return {plot:p,reading};
}
