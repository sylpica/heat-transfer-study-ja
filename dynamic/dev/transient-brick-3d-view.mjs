// App-created display for the transient-brick-3d core: one planar
// slice of the 3D cell field drawn as a colour grid. This is a section
// view of the 3D solution at the chosen fixed coordinate, not a 3D
// rendering and not a solution on the plane itself.
const ACCENT='#ba7300';
export const SLICE_LAYOUT={left:52,top:30,right:12,bottom:26};
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
// Plot-area geometry shared by drawing and pointer hit-testing.
export function slicePlotArea(W,H){
 const {left,top,right,bottom}=SLICE_LAYOUT;
 return {x:left,y:top,w:W-left-right,h:H-top-bottom};
}
export function sliceCellAtPoint(slice,W,H,px,py){
 const a=slicePlotArea(W,H);
 if(px<a.x||py<a.y||px>=a.x+a.w||py>=a.y+a.h)return null;
 const col=Math.min(slice.nCol-1,Math.floor((px-a.x)/a.w*slice.nCol));
 const row=Math.min(slice.nRow-1,Math.floor((py-a.y)/a.h*slice.nRow));
 return {row,col};
}
export function drawBrickSlice(canvas,slice,probe,lo,hi){
 const {ctx,W,H}=setup(canvas,340),a=slicePlotArea(W,H),color=fg(ctx);
 const cw=a.w/slice.nCol,ch=a.h/slice.nRow;
 ctx.font='13px system-ui';ctx.fillStyle=color;
 ctx.fillText(`断面 ${slice.colName}–${slice.rowName}（${slice.fixedName} = ${(slice.fixedCentre*1000).toFixed(2)} mm の層）`,8,20);
 for(let r=0;r<slice.nRow;r++)for(let c=0;c<slice.nCol;c++){
  ctx.fillStyle=temperatureColor(slice.values[r][c],lo,hi);
  ctx.fillRect(a.x+c*cw,a.y+r*ch,Math.ceil(cw),Math.ceil(ch));
 }
 ctx.strokeStyle=color;ctx.lineWidth=1;ctx.strokeRect(a.x,a.y,a.w,a.h);
 if(probe&&probe.row>=0&&probe.row<slice.nRow&&probe.col>=0&&probe.col<slice.nCol){
  ctx.strokeStyle=ACCENT;ctx.lineWidth=3;
  ctx.strokeRect(a.x+probe.col*cw+1.5,a.y+probe.row*ch+1.5,cw-3,ch-3);
  ctx.lineWidth=1;
 }
 ctx.font='12px system-ui';ctx.fillStyle=color;
 const colFirst=`${(slice.colCentres[0]*1000).toFixed(1)}`,colLast=`${(slice.colCentres[slice.nCol-1]*1000).toFixed(1)} mm`;
 ctx.fillText(colFirst,a.x,H-8);
 ctx.fillText(colLast,a.x+a.w-ctx.measureText(colLast).width,H-8);
 ctx.fillText(`${slice.colName} [mm]`,a.x+a.w/2-20,H-8);
 const rowTop=`${(slice.rowCentres[0]*1000).toFixed(1)}`,rowBottom=`${(slice.rowCentres[slice.nRow-1]*1000).toFixed(1)}`;
 ctx.fillText(rowTop,4,a.y+12);
 ctx.fillText(rowBottom,4,a.y+a.h);
 ctx.fillText(`${slice.rowName}`,4,a.y+a.h/2);
 canvas.setAttribute('aria-label',`直方体の${slice.fixedName}方向${slice.fixedIndex+1}層目の断面温度分布。${slice.colName}方向${slice.nCol}セル×${slice.rowName}方向${slice.nRow}セルのセル平均温度を色で示します。3次元描画ではありません。`);
}
