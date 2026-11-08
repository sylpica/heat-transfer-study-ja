// Streamwise profiles for the fin-gap flow dev screen, drawn from the
// solver's own graetz arrays.  The abscissa is log10 of the dimensionless
// length x* because the mesh stations are geometrically spaced and the
// thermal entrance spans decades.  The local Nusselt panel uses a log10
// ordinate because the entrance value is singular (O(100)) while the
// developed limit is O(10); the temperature panel is linear.  Numeric
// values are also printed as text by the UI module.
export function drawFinGapProfiles(canvas,result){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const W=canvas.width,H=canvas.height;
 const fg=getComputedStyle(document.documentElement).getPropertyValue('--fg').trim()||'#152538';
 ctx.clearRect(0,0,W,H);
 const g=result&&result.graetz;if(!g)return;
 const xs=g.dimensionlessLength,n=xs.length;if(!n)return;
 const lx=Array.from(xs,v=>Math.log10(Math.max(v,1e-12)));
 const lxMin=lx[0],lxMax=lx[n-1],lxSpan=(lxMax-lxMin)||1;
 const left=8,right=8;
 const X=v=>left+(v-lxMin)/lxSpan*(W-left-right);
 ctx.font='12px system-ui,sans-serif';
 const panel=(top,height,title,series,logY)=>{
  ctx.fillStyle=fg;ctx.textAlign='left';
  ctx.fillText(title,left,top+12);
  const plotTop=top+20,plotBottom=top+height-16;
  const usable=v=>typeof v==='number'&&Number.isFinite(v)&&(!logY||v>0);
  const finite=series.flatMap(s=>Array.from(s.values)).filter(usable);
  if(!finite.length){ctx.fillText('（定義されません）',left,plotTop+14);return;}
  const tr=logY?v=>Math.log10(v):v=>v;
  const tMin=tr(Math.min(...finite)),tMax=tr(Math.max(...finite)),tSpan=(tMax-tMin)||1;
  const Y=v=>plotBottom-(tr(v)-tMin)/tSpan*(plotBottom-plotTop);
  ctx.strokeStyle=fg;ctx.globalAlpha=0.35;
  ctx.beginPath();ctx.moveTo(left,plotBottom);ctx.lineTo(W-right,plotBottom);ctx.stroke();
  ctx.globalAlpha=1;
  let legendX=left+8;
  for(const s of series){
   ctx.strokeStyle=s.color;ctx.beginPath();let started=false;
   for(let i=0;i<n;i++){
    const v=s.values[i];
    if(!usable(v)){started=false;continue;}
    const x=X(lx[i]),y=Y(v);
    if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);
   }
   ctx.stroke();
   ctx.fillStyle=s.color;ctx.fillText(s.label,legendX,plotTop+12);
   legendX+=ctx.measureText(s.label).width+16;
  }
  ctx.fillStyle=fg;ctx.textAlign='right';
  ctx.fillText(`最大 ${Math.max(...finite).toPrecision(4)}`,W-right,plotTop+12);
  ctx.textAlign='left';
  ctx.fillText(`最小 ${Math.min(...finite).toPrecision(4)}`,left,top+height-3);
 };
 panel(0,H/2,'温度 [K]（横軸は無次元長 x* の対数）',[
  {label:'バルク温度',color:'#3f7fbf',values:g.bulkTemperature},
  {label:'下壁温度',color:'#c2543a',values:g.lowerWallTemperature},
  {label:'上壁温度',color:'#2e8b6e',values:g.upperWallTemperature}],false);
 panel(H/2,H/2,'局所 Nusselt 数（縦軸も対数）',[
  {label:'局所 Nu',color:'#7a4fbf',values:g.localNusselt}],true);
}
