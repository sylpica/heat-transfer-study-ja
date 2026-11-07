// Original qualitative illustration only. No bubble dynamics or heat-flux prediction.
export const stages=['気泡の発生','加熱面での成長','加熱面からの離脱','液体中の上昇'];
export function bubbleScene(phase){if(!Number.isFinite(phase))throw Error('模式図の進行が不正です。');return Array.from({length:5},(_,i)=>{const p=((phase+i*.19)%1+1)%1;return {x:.12+i*.18,y:p<.5?.79:.79-(p-.5)*1.3,r:p<.25?.008+.08*p:p<.5?.028+.04*(p-.25):.038,stage:Math.floor(p*4)};});}
export function startBoilingPanel(root){
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),slider=root.querySelector('input'),label=root.querySelector('output');let phase=0,playing=false,last=0,raf;
 function draw(){const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);ctx.fillStyle='#cde7f1';ctx.fillRect(0,0,W,H*.85);ctx.fillStyle='#ac492e';ctx.fillRect(0,H*.85,W,H*.15);
  ctx.strokeStyle='#18516c';ctx.lineWidth=3;ctx.fillStyle='#f9fdff';for(const b of bubbleScene(phase)){ctx.beginPath();ctx.arc(W*b.x,H*b.y,H*b.r,0,Math.PI*2);ctx.fill();ctx.stroke();}
  ctx.fillStyle='#193b4a';ctx.font='22px system-ui';ctx.fillText('液体',18,30);ctx.fillStyle='#fff';ctx.fillText('加熱面',18,H*.95);slider.value=phase;label.textContent=stages[Math.floor(phase*4)%4];
 }
 function tick(now){if(!playing)return;if(last)phase=(phase+Math.min(100,now-last)/5000)%1;last=now;draw();raf=requestAnimationFrame(tick);}
 function stop(){playing=false;last=0;cancelAnimationFrame(raf);}
 root.querySelector('[data-boil-play]').onclick=()=>{if(!playing){playing=true;last=0;raf=requestAnimationFrame(tick);}};root.querySelector('[data-boil-pause]').onclick=stop;root.querySelector('[data-boil-step]').onclick=()=>{stop();phase=(phase+.25)%1;draw();};slider.oninput=()=>{stop();phase=Number(slider.value);draw();};draw();return {stop};
}
