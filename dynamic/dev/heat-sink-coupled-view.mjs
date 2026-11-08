// Per-channel flow allocation chart for the coupled heat-sink dev screen.
// Bars are drawn from the solver's own channelFlowsM3PerS; the numeric
// values are also printed as text next to the chart by the UI module.
export function drawChannelFlows(canvas,flowsLMin){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const W=canvas.width,H=canvas.height,n=flowsLMin.length;
 const fg=getComputedStyle(document.documentElement).getPropertyValue('--fg').trim()||'#152538';
 ctx.clearRect(0,0,W,H);
 if(!n)return;
 const top=26,bottom=22,left=8,right=8,max=Math.max(...flowsLMin,0);
 const bw=(W-left-right)/n,scale=max>0?(H-top-bottom)/max:0;
 ctx.font='12px system-ui,sans-serif';ctx.textAlign='center';
 for(let i=0;i<n;i++){
  const h=flowsLMin[i]*scale,x=left+i*bw;
  ctx.fillStyle='#3f7fbf';
  ctx.fillRect(x+bw*0.18,H-bottom-h,bw*0.64,h);
  ctx.fillStyle=fg;
  ctx.fillText(flowsLMin[i].toFixed(2),x+bw/2,H-bottom-h-6);
  ctx.fillText(String(i+1),x+bw/2,H-6);
 }
 ctx.fillStyle=fg;ctx.textAlign='left';
 ctx.fillText('流路ごとの流量 [L/min]（横軸は流路番号）',left,14);
}
