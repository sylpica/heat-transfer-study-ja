import {createStraightFin} from './fin-convective-tip.mjs';
import {drawStraightField,drawStraightProfile} from './fin-convective-tip-view.mjs';
const $=id=>document.getElementById(id);
const els={form:$('settings'),status:$('status'),error:$('error'),clock:$('clock'),readout:$('readout'),diag:$('diagnostic-values'),legend:$('legend'),summary:$('summary'),field:$('field'),graph:$('graph'),probe:$('probe'),interval:$('interval')};
const fmt=(v,d=4)=>v===null||v===undefined?'—':Number(v).toFixed(d);
let model=null,history=[],frame=0,timer=null,range=[293.15,353.15];
function stop(){if(timer){clearInterval(timer);timer=null;}}
function showError(e){els.error.textContent=e.message;els.error.hidden=false;}
function clearError(){els.error.hidden=true;els.error.textContent='';}
function readConfig(){
 const v=id=>{const x=$(id).valueAsNumber;if(!Number.isFinite(x))throw Error('入力に数値でない項目があります。');return x;};
 return {length:v('flen')/1000,thickness:v('fthick')/1000,depth:v('fdepth')/1000,cells:Number($('cells').value),
  k:v('k'),rho:v('rho'),cp:v('cp'),h:v('h'),baseTemperature:v('tb'),ambient:v('tinf'),initial:v('t0'),tipCondition:$('tip').value};
}
function summaryText(c){
 const tip=c.tipCondition==='convection'?'先端面も同じhで対流':'先端は断熱';
 return `長さ ${(c.length*1000).toFixed(1)} mm・厚さ ${(c.thickness*1000).toFixed(1)} mm・奥行 ${(c.depth*1000).toFixed(1)} mm（断面積 ${(c.thickness*c.depth*1e6).toFixed(1)} mm²、周長 ${(2*(c.thickness+c.depth)*1000).toFixed(1)} mm）、k=${c.k} W/(m K)、ρ=${c.rho} kg/m³、cp=${c.cp} J/(kg K)（一定物性）、h=${c.h} W/(m² K)。先端条件：${tip}。`;
}
function render(){
 const s=history[frame];if(!s)return;const mesh=model.mesh,n=mesh.cells,probe=Math.min(n-1,Math.max(0,Number(els.probe.value)||0));
 els.probe.max=String(n-1);els.probe.value=String(probe);
 els.clock.textContent=`${s.time.toFixed(3)} s`;
 drawStraightField(els.field,s,mesh,probe,range[0],range[1]);
 drawStraightProfile(els.graph,s,mesh,probe,range[0],range[1]);
 els.legend.textContent=`色の範囲：${range[0].toFixed(1)} K（青）〜 ${range[1].toFixed(1)} K（赤）。橙の枠は測定セルです。`;
 els.readout.textContent=[
  `測定位置 x=${(mesh.centres[probe]*1000).toFixed(2)} mm（セル ${probe+1}/${n}）：${fmt(s.temperature[probe])} K`,
  `先端セル（x=${(mesh.centres[n-1]*1000).toFixed(2)} mm）：${fmt(s.temperature[n-1])} K`,
  `基部熱流=${fmt(s.baseHeatRateW)} W`,
  `効率 η=${fmt(s.efficiency,6)}、有効度 ε=${fmt(s.effectiveness)}`
 ].join('\n');
 els.diag.textContent=[
  `法則 ${s.law}（releaseApproved=${s.releaseApproved}）`,
  `フィン定数 m=${fmt(model.mesh.mPerM)} 1/m、断面Bi=${fmt(model.mesh.transverseBiot,6)}`,
  `フィン表面積=${mesh.finSurfaceAreaM2.toExponential(4)} m²、断面積=${mesh.crossSectionM2.toExponential(4)} m²、周長=${(mesh.perimeterM*1000).toFixed(2)} mm`,
  `基部からの熱流=${fmt(s.baseHeatRateW)} W（基部熱流束 ${fmt(s.baseHeatFluxWPerM2,1)} W/m²）`,
  `側面からの放熱=${fmt(s.sideLossW)} W、先端からの放熱=${fmt(s.tipLossW)} W、合計=${fmt(s.totalLossW)} W`,
  `正味の外部入力=${fmt(s.netExternalPowerW)} W`,
  `蓄熱の変化=${fmt(s.energyChange)} J、収支誤差=${s.energyError.toExponential(3)} J（丸め予算 ${s.energyRoundoffBudgetJ.toExponential(3)} J）`,
  `安定刻み safeDt=${model.safeDt.toExponential(4)} s、ステップ数=${s.steps}`
 ].join('\n');
 $('back').disabled=frame<=0;$('restart').disabled=frame<=0&&history.length<=1;
}
function apply(){
 stop();
 try{
  const c=readConfig();model=createStraightFin(c);history=[model.snapshot()];frame=0;
  range=[Math.min(c.ambient,c.initial),Math.max(c.baseTemperature,c.initial)];
  els.summary.textContent=summaryText(c);clearError();render();els.status.textContent='準備完了';
 }catch(e){showError(e);els.status.textContent='条件を受け付けませんでした';}
}
function advanceFrame(){
 const target=els.interval.valueAsNumber;
 if(!Number.isFinite(target)||target<=0){showError(Error('1コマの物理時間は正の数で指定してください。'));return;}
 if(frame<history.length-1){frame++;model.restore(history[frame]);render();els.status.textContent='計算済み';return;}
 const before=model.snapshot();let remaining=target;
 try{
  while(remaining>1e-12){const dt=Math.min(model.safeDt,remaining);model.step(dt,false);remaining-=dt;}
 }catch(e){model.restore(before);stop();showError(e);els.status.textContent='一時停止';return;}
 history.push(model.snapshot());if(history.length>1200)history.splice(1,history.length-1200);
 frame=history.length-1;clearError();render();els.status.textContent=timer?'再生中':'計算済み';
}
els.form.addEventListener('submit',e=>{e.preventDefault();apply();});
$('run').addEventListener('click',()=>{if(!model||timer)return;timer=setInterval(advanceFrame,100);els.status.textContent='再生中';});
$('pause').addEventListener('click',()=>{stop();els.status.textContent='一時停止';});
$('step').addEventListener('click',()=>{stop();advanceFrame();});
$('back').addEventListener('click',()=>{stop();if(frame>0){frame--;model.restore(history[frame]);render();}els.status.textContent='計算済み';});
$('restart').addEventListener('click',()=>{stop();frame=0;model.restore(history[0]);render();els.status.textContent='計算済み';});
els.probe.addEventListener('input',render);
let resizeQueued=false;
addEventListener('resize',()=>{if(resizeQueued)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;if(model)render();});});
apply();
