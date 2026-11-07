// Read-only view: cell means, interpolated MAC velocity and RK-stage pressure.
import {createMacVelocityField} from './cavity-fields.mjs';
const cache=new WeakMap();
export function thermalWallFieldData(s,m){
 const old=cache.get(s);if(old?.mesh===m)return old.data;
 const N=m.nx*m.ny;
 if(!Array.isArray(s.temperature)||s.temperature.length!==N||!Array.isArray(s.pressureStageMeanPa)||s.pressureStageMeanPa.length!==N||[...s.temperature,...s.pressureStageMeanPa].some(x=>!Number.isFinite(x)))throw Error('壁連成の実温度/段圧力場が必要です。');
 const field=createMacVelocityField(m,s),speed=Array.from({length:N},(_,n)=>Math.hypot(...field.at((n%m.nx+.5)*m.dx,(Math.floor(n/m.nx)+.5)*m.dy)));
 const data={field,temperature:s.temperature,speed,pressure:s.steps===0?null:s.pressureStageMeanPa};cache.set(s,{mesh:m,data});return data;
}
export function sampleThermalWall(s,m,probe){
 if(!Array.isArray(probe)||probe.length!==2||probe.some(x=>!Number.isFinite(x)||x<0||x>1))throw Error('測定点は正方形の範囲内です。');
 const i=Math.min(m.nx-1,Math.floor(probe[0]*m.nx)),j=Math.min(m.ny-1,Math.floor(probe[1]*m.ny)),n=j*m.nx+i,data=thermalWallFieldData(s,m),x=probe[0]*m.width,y=probe[1]*m.height;
 return {index:n,i,j,x,y,cellCenterX:(i+.5)*m.dx,cellCenterY:(j+.5)*m.dy,temperatureK:s.temperature[n],offsetTemperatureK:s.offsetTemperature[n],velocity:data.field.at(x,y),pressureStageMeanPa:data.pressure?.[n]??null,wallTemperatureK:s.wallTemperature,interfaceRowPowerW:s.interfaceHeatW[j],interfaceRowCenterY:(j+.5)*m.dy};
}
export function thermalWallLayout(width){const W=Math.max(300,width),w=W-100;return {left:66,top:90,width:w,height:w,base:90+w,logicalWidth:W,logicalHeight:90+w+65};}
export function drawThermalWall(canvas,s,m,{quantity='temperature',range,velocityScale,probe=[.5,.5],arrows=true}={}){
 if(!['temperature','speed','pressure'].includes(quantity)||!Array.isArray(range)||range.length!==2||range.some(x=>!Number.isFinite(x))||range[1]<=range[0]||!Number.isFinite(velocityScale)||velocityScale<0)throw Error('壁連成の共通表示範囲が不正です。');
 canvas.style.width='100%';const p=thermalWallLayout(canvas.clientWidth),ratio=devicePixelRatio||1,ctx=canvas.getContext('2d'),data=thermalWallFieldData(s,m),r=sampleThermalWall(s,m,probe),values=data[quantity],fg=getComputedStyle(document.body).getPropertyValue('--fg').trim()||'#152538',px=x=>p.left+x/m.width*p.width,py=y=>p.base-y/m.height*p.height;
 canvas.width=Math.round(p.logicalWidth*ratio);canvas.height=Math.round(p.logicalHeight*ratio);canvas.dataset.plot=JSON.stringify(p);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,p.logicalWidth,p.logicalHeight);
 const color=value=>`hsl(${240*(1-Math.max(0,Math.min(1,(value-range[0])/(range[1]-range[0]))))} 72% 43%)`;
 if(values)for(let j=0;j<m.ny;j++)for(let i=0;i<m.nx;i++){ctx.fillStyle=color(values[j*m.nx+i]);ctx.fillRect(px(i*m.dx),py((j+1)*m.dy),p.width/m.nx+.3,p.height/m.ny+.3);}
 else {ctx.fillStyle='#7a818b';ctx.fillRect(p.left,p.top,p.width,p.height);ctx.fillStyle='#fff';ctx.font='14px system-ui';ctx.fillText('時刻0：段圧力は未計算',p.left+8,p.top+24);}
 const arrow=(x,y,dx,dy)=>{if(Math.hypot(dx,dy)<.2)return;const a=Math.atan2(dy,dx);for(const [stroke,width]of [['#fff',4],['#111',1.4]]){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.lineTo(x+dx-4*Math.cos(a-.6),y+dy-4*Math.sin(a-.6));ctx.moveTo(x+dx,y+dy);ctx.lineTo(x+dx-4*Math.cos(a+.6),y+dy-4*Math.sin(a+.6));ctx.stroke();}};
 if(arrows&&velocityScale>0){const stride=Math.max(1,Math.ceil(m.nx/8));for(let j=0;j<m.ny;j+=stride)for(let i=0;i<m.nx;i+=stride){const x=(i+.5)*m.dx,y=(j+.5)*m.dy,[u,v]=data.field.at(x,y);arrow(px(x),py(y),.075*p.width*u/velocityScale,-.075*p.width*v/velocityScale);}}
 ctx.strokeStyle=fg;ctx.lineWidth=2;ctx.strokeRect(p.left,p.top,p.width,p.height);ctx.fillStyle=fg;ctx.font='13px system-ui';ctx.fillText(quantity==='temperature'?'流体FVセル平均温度 [K]':quantity==='speed'?'MAC補間速さ [m/s]':'最後のRK2段平均圧力 [Pa]',4,18);ctx.font='12px system-ui';ctx.fillText(`壁 W=${s.wallTemperature.toFixed(5)} K（1ノード）`,4,40);ctx.fillText(`界面 → 流体 ${s.instantaneousPowersW.interfaceIntoFluid.toExponential(4)} W`,4,59);ctx.fillText(`右壁 ${s.referenceTemperatureK} K・上下断熱`,4,77);ctx.fillText('y [mm]',2,p.top-2);ctx.fillText(String(m.height*1000),8,p.top+14);ctx.fillText('0',34,p.base+3);ctx.fillText('0',p.left,p.base+24);ctx.textAlign='right';ctx.fillText(`${m.width*1000} mm`,p.left+p.width,p.base+24);ctx.textAlign='left';ctx.fillText('x →（流体の実寸比）',p.left,p.base+45);
 // Wall node is a boundary marker, not a drawn spatially resolved solid layer.
 ctx.setLineDash([4,3]);ctx.strokeRect(p.left-10,p.top,5,p.height);ctx.setLineDash([]);
 for(const [stroke,width]of [['#fff',5],['#111',2]]){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.arc(px(r.x),py(r.y),5,0,2*Math.PI);ctx.stroke();}
 canvas.setAttribute('aria-label',`アプリ作成の図。t=${s.time}秒、左は厚さを解かない一様温度壁${s.wallTemperature}K、右壁${s.referenceTemperatureK}K、上下断熱、全壁静止。色は${quantity==='temperature'?'流体セル平均温度':quantity==='speed'?'実MAC補間速度':s.steps?'最後の二つのRK2段の投影圧力の平均':'段圧力未計算'}。速度評価点x=${r.x}m、y=${r.y}mと温度/圧力セル中心は別です。`);
 return {plot:p,reading:r};
}
