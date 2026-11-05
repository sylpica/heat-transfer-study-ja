// App-created display of solved cell-average temperature and prescribed mean U.
// No entrance momentum layer, instantaneous eddies or 3D field is invented.
function finite(value,name){if(typeof value!=='number'||!Number.isFinite(value))throw Error(`${name}が有限値ではありません。`);return value;}
export function heatedChannelLayout(mesh,logicalWidth){
 const W=Math.max(300,finite(logicalWidth,'表示幅')),physicalHeight=(W-110)*finite(mesh.height,'高さ')/finite(mesh.width,'長さ');
 if(!(mesh.width>0&&mesh.height>0&&physicalHeight>0))throw Error('表示形状の寸法は正です。');
 const height=Math.max(110,physicalHeight);return {left:58,top:92,width:W-110,height,logicalWidth:W,logicalHeight:height+188,verticalExaggeration:height/physicalHeight};
}
export function sampleHeatedChannel(state,mesh,probe){
 if(!Array.isArray(probe)||probe.length!==2||probe.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))throw Error('測定点は0〜1の割合2つです。');
 const {nx,ny}=mesh;if(!Number.isSafeInteger(nx)||!Number.isSafeInteger(ny)||nx<1||ny<1||state.temperature.length!==nx*ny||state.velocity.length!==ny)throw Error('測定対象の格子/配列が一致しません。');
 const i=Math.min(nx-1,Math.floor(probe[0]*nx)),j=Math.min(ny-1,Math.floor(probe[1]*ny)),index=j*nx+i,nu=state.wallToBulkNusselt[i]??null;
 const result={i,j,index,x:probe[0]*mesh.width,y:probe[1]*mesh.height,cellCenterX:(i+.5)*mesh.dx,cellCenterY:(j+.5)*mesh.dy,temperature:state.temperature[index],velocity:state.velocity[j],bulkTemperature:state.bulkTemperature[i],lowerWallTemperature:state.lowerWallTemperature[i],upperWallTemperature:state.upperWallTemperature[i],wallToBulkNusselt:nu};
 for(const [key,value]of Object.entries(result))if(value!==null)finite(value,key);return result;
}
const compact=v=>v!==0&&(Math.abs(v)<.001||Math.abs(v)>=1e4)?v.toExponential(2):Number(v.toPrecision(4)).toString();
export function drawHeatedChannel(canvas,state,mesh,{range,probe=[.5,.5],velocityScale,wallHeatFlux}={}){
 const sample=sampleHeatedChannel(state,mesh,probe),p=heatedChannelLayout(mesh,canvas.clientWidth),ratio=devicePixelRatio||1,W=p.logicalWidth,H=p.logicalHeight;
 const lower=range?.[0]??state.min,upper=range?.[1]??Math.max(lower+1,state.max);finite(lower,'色スケール下限');finite(upper,'色スケール上限');if(!(upper>lower))throw Error('色スケール上限は下限より大きくしてください。');
 finite(velocityScale,'共通平均速度スケール');finite(wallHeatFlux,'壁熱流束');if(velocityScale<0)throw Error('速度スケールは0以上です。');
 canvas.style.width='100%';canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);canvas.dataset.plot=JSON.stringify(p);const ctx=canvas.getContext('2d'),fg=getComputedStyle(document.body).getPropertyValue('--fg').trim()||'#152538';ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,W,H);
 const color=t=>`hsl(${240*(1-Math.max(0,Math.min(1,(t-lower)/(upper-lower))))} 68% 52%)`;
 const {nx,ny}=mesh;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){ctx.fillStyle=color(state.temperature[j*nx+i]);ctx.fillRect(p.left+p.width*i/nx,p.top+p.height*(1-(j+1)/ny),p.width/nx+.5,p.height/ny+.5);}
 // Reconstructed wall temperatures use the same A/B scale as fluid cells.
 for(let i=0;i<nx;i++){ctx.fillStyle=color(state.lowerWallTemperature[i]);ctx.fillRect(p.left+p.width*i/nx,p.top+p.height,p.width/nx+.5,4);ctx.fillStyle=color(state.upperWallTemperature[i]);ctx.fillRect(p.left+p.width*i/nx,p.top-4,p.width/nx+.5,4);}
 ctx.strokeStyle=fg;ctx.lineWidth=1;ctx.strokeRect(p.left,p.top,p.width,p.height);ctx.fillStyle=fg;ctx.font='15px system-ui';ctx.fillText('セル平均温度 [K]・定常平均速度',8,19);ctx.fillText(`両壁 q″=${compact(wallHeatFlux)} W/m²`,8,42);ctx.font='13px system-ui';ctx.fillText('正：流体へ、負：流体から',8,60);
 ctx.font='14px system-ui';ctx.fillText('y [m]',4,p.top-18);ctx.fillText(compact(mesh.height),3,p.top+12);ctx.fillText('0',28,p.top+p.height);ctx.fillText('0',p.left,p.top+p.height+43);ctx.textAlign='right';ctx.fillText(`${compact(mesh.width)} m`,p.left+p.width,p.top+p.height+43);ctx.textAlign='left';ctx.fillText('x → 入口から出口',p.left,p.top+p.height+66);ctx.font='12px system-ui';ctx.fillText(p.verticalExaggeration>1.0001?`縦×${p.verticalExaggeration.toFixed(2)}拡大（軸は実寸）`:'図の縦横は実寸比',8,H-9);
 function arrow(x1,y1,x2,y2,{outline=true,head=5}={}){
  if(x1===x2&&y1===y2)return;const angle=Math.atan2(y2-y1,x2-x1);for(const [stroke,width]of outline?[['#fff',4],['#111',1.6]]:[[fg,1.8]]){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.moveTo(x2-head*Math.cos(angle-.6),y2-head*Math.sin(angle-.6));ctx.lineTo(x2,y2);ctx.lineTo(x2-head*Math.cos(angle+.6),y2-head*Math.sin(angle+.6));ctx.stroke();}}
 const stride=Math.max(1,Math.floor(ny/4));for(let j=stride/2|0;j<ny;j+=stride){const u=state.velocity[j],length=velocityScale>0?.1*p.width*u/velocityScale:0,y=p.top+p.height*(1-(j+.5)/ny);for(const f of [.15,.45,.75]){const x=p.left+p.width*f;arrow(x,y,x+length,y);}}
 ctx.fillStyle=fg;ctx.font='13px system-ui';ctx.fillText('入口',3,p.top+p.height/2-7);ctx.textAlign='right';ctx.fillText('出口',W-3,p.top+p.height/2-7);ctx.textAlign='left';arrow(p.left-28,p.top+p.height/2,p.left-3,p.top+p.height/2,{outline:false});arrow(p.left+p.width+3,p.top+p.height/2,p.left+p.width+28,p.top+p.height/2,{outline:false});
 if(wallHeatFlux!==0)for(const f of [.25,.55,.85]){const x=p.left+p.width*f;for(const side of [-1,1]){const wall=side===-1?p.top:p.top+p.height,outside=wall+side*23,inside=wall-side*4;if(wallHeatFlux>0)arrow(x,outside,x,inside,{outline:false});else arrow(x,inside,x,outside,{outline:false});}}
 const px=p.left+probe[0]*p.width,py=p.top+(1-probe[1])*p.height;for(const [stroke,width]of [['#fff',5],['#111',2]]){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(px-7,py);ctx.lineTo(px+7,py);ctx.moveTo(px,py-7);ctx.lineTo(px,py+7);ctx.stroke();}
 canvas.setAttribute('aria-label',`左の指定入口から右の対流出口へ流れる定常Poiseuille平均流。温度${state.min.toFixed(4)}〜${state.max.toFixed(4)} K。両壁熱流束${compact(wallHeatFlux)} W/m²、${wallHeatFlux>0?'流体へ加熱':wallHeatFlux<0?'流体から冷却':'壁断熱'}。測定セル${sample.temperature.toFixed(5)} K。${p.verticalExaggeration>1.0001?`縦を${p.verticalExaggeration.toFixed(2)}倍に拡大。`:''}入口発達する速度や3D流れは計算していません。クリックまたは矢印キーで測定点を移動。`);
}
