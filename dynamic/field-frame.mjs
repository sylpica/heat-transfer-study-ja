// Common scalar-field raster with a physical aspect ratio and explicit gaps.
export function fieldFrame(canvas,state,mesh,range,{grid=false}={}){
 canvas.height=Math.max(160,Math.min(640,Math.round(canvas.width*mesh.height/mesh.width)));
 const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,fit=Math.min(W/mesh.width,H/mesh.height),plot={left:(W-mesh.width*fit)/2,top:(H-mesh.height*fit)/2,width:mesh.width*fit,height:mesh.height*fit},cw=plot.width/mesh.nx,ch=plot.height/mesh.ny,px=x=>plot.left+x*fit,py=y=>plot.top+plot.height-y*fit;
 canvas.dataset.plot=JSON.stringify(plot);ctx.clearRect(0,0,W,H);
 for(let n=0;n<mesh.mask.length;n++)if(mesh.mask[n]){const v=state.temperature[n]-273.15,t=Math.max(0,Math.min(1,(v-range[0])/(range[1]-range[0])));ctx.fillStyle=`hsl(${240*(1-t)} 80% 45%)`;ctx.fillRect(plot.left+(n%mesh.nx)*cw,plot.top+plot.height-(Math.floor(n/mesh.nx)+1)*ch,cw+.3,ch+.3);}
 if(grid){ctx.strokeStyle='#ffffff80';ctx.lineWidth=1;ctx.beginPath();for(let n=0;n<mesh.mask.length;n++)if(mesh.mask[n])ctx.rect(plot.left+(n%mesh.nx)*cw,plot.top+plot.height-(Math.floor(n/mesh.nx)+1)*ch,cw,ch);ctx.stroke();}
 return {ctx,plot,cw,ch,px,py};
}
