// App-created display of actual FV cell temperatures and conservative face flow.
const finite=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error(`${name}は有限値です。`);return v;},cache=new WeakMap();
export function flatPlateFlowView(mesh){
 if(cache.has(mesh))return cache.get(mesh);const {nx,ny}=mesh??{};
 if(!Number.isSafeInteger(nx)||!Number.isSafeInteger(ny)||nx<1||ny<1||!Array.isArray(mesh.flowU)||!Array.isArray(mesh.flowV)||mesh.flowU.length!==(nx+1)*ny||mesh.flowV.length!==nx*(ny+1))throw Error('実際の平板面速度と格子が必要です。');
 const u=[],v=[],speed=[];let maximum=0;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=finite((mesh.flowU[j*(nx+1)+i]+mesh.flowU[j*(nx+1)+i+1])/2,'再構成u'),b=finite((mesh.flowV[j*nx+i]+mesh.flowV[(j+1)*nx+i])/2,'再構成v'),m=finite(Math.hypot(a,b),'速さ');u.push(a);v.push(b);speed.push(m);maximum=Math.max(maximum,m);}
 const result=Object.freeze({u:Object.freeze(u),v:Object.freeze(v),speed:Object.freeze(speed),maximumSpeed:maximum});cache.set(mesh,result);return result;
}
export function flatPlateLayout(mesh,logicalWidth,commonHeight=mesh.height,exaggerate=true){
 const W=Math.max(280,finite(logicalWidth,'表示幅')),L=finite(mesh.width,'長さ'),H=finite(mesh.height,'高さ');finite(commonHeight,'共通高さ');
 if(L<=0||H<=0||commonHeight<H)throw Error('共通の物理表示範囲が不正です。');
 const width=W-76,xScale=width/L,yScale=exaggerate?Math.min(180/commonHeight,6*xScale):xScale,base=48+commonHeight*yScale;
 return {left:50,top:base-H*yScale,width,height:H*yScale,base,xScale,yScale,logicalWidth:W,logicalHeight:base+74,verticalExaggeration:yScale/xScale};
}
export function sampleFlatPlate(state,mesh,probe){
 if(!Array.isArray(probe)||probe.length!==2||probe.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0||x>1)||!Array.isArray(state?.temperature)||state.temperature.length!==mesh.nx*mesh.ny||!Array.isArray(state.wallHeatFluxWPerM2)||state.wallHeatFluxWPerM2.length!==mesh.nx||state.wallHeatFluxWPerM2.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('平板の実セル温度/板熱流/測定点が不正です。');
 const i=Math.min(mesh.nx-1,Math.floor(probe[0]*mesh.nx)),j=Math.min(mesh.ny-1,Math.floor(probe[1]*mesh.ny)),n=j*mesh.nx+i,flow=flatPlateFlowView(mesh);
 return {i,j,index:n,cellCenterX:finite((i+.5)*mesh.dx,'セル中心x'),cellCenterY:finite((j+.5)*mesh.dy,'セル中心y'),temperatureK:finite(state.temperature[n],'セル平均絶対温度'),u:flow.u[n],v:flow.v[n],wallIntervalHeatFluxWPerM2:finite(state.wallHeatFluxWPerM2[i],'板区間熱流束')};
}
const compact=v=>v!==0&&(Math.abs(v)<.001||Math.abs(v)>1e4)?v.toExponential(2):Number(v.toPrecision(4)).toString();
export function drawFlatPlate(canvas,state,mesh,{range,velocityScale,wallHeatScale,wallTemperatureK,commonHeight=mesh.height,quantity='temperature',arrows=true,exaggerate=true,probe=[.5,.5]}={}){
 if(!['temperature','speed'].includes(quantity)||!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||range[1]<=range[0])throw Error('平板の表示量/共通スケールが不正です。');
 for(const [name,value]of Object.entries({velocityScale,wallHeatScale,wallTemperatureK}))finite(value,name);if(velocityScale<0||wallHeatScale<0||wallTemperatureK<=0)throw Error('速度/熱スケール/板温が不正です。');
 canvas.style.width='100%';
 const reading=sampleFlatPlate(state,mesh,probe),flow=flatPlateFlowView(mesh),p=flatPlateLayout(mesh,canvas.clientWidth,commonHeight,exaggerate),ratio=devicePixelRatio||1,W=p.logicalWidth,H=p.logicalHeight,ctx=canvas.getContext('2d'),fg=getComputedStyle(document.body).getPropertyValue('--fg').trim()||'#152538';
 const values=quantity==='temperature'?state.temperature:flow.speed;if(values.some(x=>!Number.isFinite(x)||(quantity==='temperature'&&x<=0)))throw Error('描画する実場に非有限値があります。');
 canvas.style.width='100%';canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);canvas.dataset.plot=JSON.stringify(p);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,W,H);
 const color=x=>`hsl(${240*(1-Math.max(0,Math.min(1,(x-range[0])/(range[1]-range[0]))))} 72% 45%)`,px=x=>p.left+x*p.xScale,py=y=>p.base-y*p.yScale;
 ctx.save();ctx.beginPath();ctx.rect(p.left,p.top,p.width,p.height);ctx.clip();
 for(let j=0;j<mesh.ny;j++)for(let i=0;i<mesh.nx;i++){ctx.fillStyle=color(values[j*mesh.nx+i]);ctx.fillRect(p.left+i*p.width/mesh.nx,p.top+(mesh.ny-j-1)*p.height/mesh.ny,p.width/mesh.nx+.3,p.height/mesh.ny+.3);}ctx.restore();
 ctx.strokeStyle=fg;ctx.lineWidth=1;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(p.left,p.top);ctx.lineTo(p.left+p.width,p.top);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=4;ctx.strokeStyle=quantity==='temperature'?color(wallTemperatureK):fg;ctx.beginPath();ctx.moveTo(p.left,p.base);ctx.lineTo(p.left+p.width,p.base);ctx.stroke();
 const arrow=(x,y,dx,dy,bold=false)=>{if(Math.hypot(dx,dy)<.25)return;const angle=Math.atan2(dy,dx);for(const [stroke,width]of [['#fff',bold?5:4],['#111',bold?2.5:1.5]]){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.lineTo(x+dx-4*Math.cos(angle-.6),y+dy-4*Math.sin(angle-.6));ctx.moveTo(x+dx,y+dy);ctx.lineTo(x+dx-4*Math.cos(angle+.6),y+dy-4*Math.sin(angle+.6));ctx.stroke();}};
 if(arrows&&velocityScale>0){const sx=Math.max(1,Math.ceil(mesh.nx/10)),sy=Math.max(1,Math.ceil(mesh.ny/5)),seconds=.04*mesh.width/velocityScale;
  for(let j=Math.floor(sy/2);j<mesh.ny;j+=sy)for(let i=Math.floor(sx/2);i<mesh.nx;i+=sx){const n=j*mesh.nx+i;arrow(px((i+.5)*mesh.dx),py((j+.5)*mesh.dy),flow.u[n]*seconds*p.xScale,-flow.v[n]*seconds*p.yScale);}}
 for(const fraction of [.2,.5,.8]){const i=Math.min(mesh.nx-1,Math.floor(fraction*mesh.nx)),q=state.wallHeatFluxWPerM2[i],length=wallHeatScale>0?18*Math.abs(q)/wallHeatScale:0;if(length<.25)continue;const x=px((i+.5)*mesh.dx);q>0?arrow(x,p.base+length/2,0,-length,true):arrow(x,p.base-length/2,0,length,true);}
 const x=px(reading.cellCenterX),y=py(reading.cellCenterY);for(const [stroke,width]of [['#fff',5],['#111',2]]){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x-6,y);ctx.lineTo(x+6,y);ctx.moveTo(x,y-6);ctx.lineTo(x,y+6);ctx.stroke();}
 ctx.fillStyle=fg;ctx.font='14px system-ui';ctx.fillText(quantity==='temperature'?'実セル平均温度 [K]':'面流量から再構成した速さ [m/s]',8,20);ctx.font='12px system-ui';ctx.fillText(`y [mm] ${compact(mesh.height*1000)}`,3,p.top-8);ctx.fillText('0',25,p.base+3);ctx.fillText('0',p.left,p.base+30);ctx.textAlign='right';ctx.fillText(`${compact(mesh.width*1000)} mm`,p.left+p.width,p.base+30);ctx.textAlign='left';ctx.fillText('x → 先端から下流へ',p.left,p.base+48);ctx.fillText(`縦の表示倍率 ×${p.verticalExaggeration.toFixed(2)}（軸は実寸）`,8,H-6);
 canvas.setAttribute('aria-label',`時刻${state.time}秒。平板上の流体の${quantity==='temperature'?'セル平均温度':'再構成した速さ'}。下辺が一定温度の板、破線は遠方温度の計算上端です。流速矢印は定常Blasius面流量から再構成、太い板矢印は実際の板熱流の符号です。測定セル温度${reading.temperatureK.toFixed(5)} K、板熱流${compact(reading.wallIntervalHeatFluxWPerM2)} W/m²。縦の表示倍率${p.verticalExaggeration.toFixed(2)}。クリックまたは矢印キーで測定セルを移動。`);
 return {plot:p,reading};
}
