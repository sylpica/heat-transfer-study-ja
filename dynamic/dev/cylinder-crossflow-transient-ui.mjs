// Development-only screen for cylinder-crossflow-transient.mjs.  The model
// core and the wind-heat-transfer module are unchanged: this file only
// collects inputs, passes exactly the keys the core accepts, and renders
// its snapshots (or its Japanese rejection reason, verbatim).
import {createCylinderCrossflowTransient} from './cylinder-crossflow-transient.mjs';
import {drawCylinderField,drawCylinderProfile} from './cylinder-crossflow-transient-view.mjs';
const $=id=>document.getElementById(id);
const els={form:$('settings'),status:$('status'),error:$('error'),clock:$('clock'),readout:$('readout'),warnings:$('warnings'),diag:$('diagnostic-values'),legend:$('legend'),summary:$('summary'),field:$('field'),graph:$('graph'),probe:$('probe'),interval:$('interval')};
const fmt=(v,d=4)=>v===null||v===undefined?'—':Number(v).toFixed(d);
const fmt10=v=>String(Number(v.toPrecision(10)));
let model=null,history=[],frame=0,timer=null,range=[300,400];
function stop(){if(timer){clearInterval(timer);timer=null;}}
function showError(e){els.error.textContent=e.message;els.error.hidden=false;}
function clearError(){els.error.hidden=true;els.error.textContent='';}
function syncHSource(){
 const wind=$('hsource').value==='wind';
 $('h').disabled=wind;
 for(const id of ['velocity','fdensity','fviscosity','fcp','fk','film'])$(id).disabled=!wind;
}
function readConfig(){
 const v=id=>{const x=$(id).valueAsNumber;if(!Number.isFinite(x))throw Error('入力に数値でない項目があります。');return x;};
 const c={diameter:v('diameter')/1000,length:v('length')/1000,
  solidConductivity:v('k'),solidDensity:v('rho'),solidCp:v('cp'),
  initialTemperature:v('t0'),fluidTemperature:v('tinf'),cells:Number($('cells').value)};
 if($('hsource').value==='wind'){
  const flow={velocity:v('velocity'),density:v('fdensity'),viscosity:v('fviscosity'),cp:v('fcp'),conductivity:v('fk')};
  if($('film').value!=='')flow.filmSurfaceTemperature=v('film');
  c.flow=flow;
 }else c.heatTransferCoefficient=v('h');
 return c;
}
function summaryText(c,s){
 const hPart=s.heatTransferSource==='wind-correlation'
  ?`h=${fmt10(s.heatTransferCoefficient)} W/(m² K)（風速から推定：式(${s.windEstimate.correlation})、Re_D=${fmt(s.windEstimate.reynolds,1)}）`
  :`h=${fmt10(s.heatTransferCoefficient)} W/(m² K)（直接指定）`;
 return `直径 ${(c.diameter*1000).toFixed(2)} mm・長さ ${(c.length*1000).toFixed(1)} mm、k=${c.solidConductivity} W/(m K)、ρ=${c.solidDensity} kg/m³、cp=${c.solidCp} J/(kg K)（一定物性）、${hPart}、Bi=${fmt(s.biotNumber,6)}。`;
}
function render(){
 const s=history[frame];if(!s)return;const n=s.cells,probe=Math.min(n-1,Math.max(0,Number(els.probe.value)||0));
 els.probe.max=String(n-1);els.probe.value=String(probe);
 els.clock.textContent=`${s.time.toFixed(3)} s`;
 drawCylinderField(els.field,s,probe,range[0],range[1]);
 drawCylinderProfile(els.graph,s,probe,range[0],range[1]);
 els.legend.textContent=`色の範囲：${range[0].toFixed(1)} K（青）〜 ${range[1].toFixed(1)} K（赤）。橙の輪は測定セルです。`;
 els.readout.textContent=[
  `測定位置 r=${(s.centres[probe]*1000).toFixed(2)} mm（セル ${probe+1}/${n}）：${fmt(s.temperature[probe])} K`,
  `中心セル（r=${(s.centres[0]*1000).toFixed(2)} mm）：${fmt(s.temperature[0])} K`,
  `表面温度（半セル抵抗で再構成）：${fmt(s.surfaceTemperature)} K`,
  `体積平均温度：${fmt(s.meanTemperature)} K`,
  `熱伝達率 h=${fmt10(s.heatTransferCoefficient)} W/(m² K)（${s.heatTransferSource==='wind-correlation'?'風速から推定':'直接指定'}）`
 ].join('\n');
 const lines=[
  `法則 ${s.law}（releaseApproved=${s.releaseApproved}）`,
  `Bi = hR/k = ${fmt(s.biotNumber,6)}（本モデルの開発範囲上限 10）`,
  `集中定数時定数 τ = ρcpR/(2h) = ${fmt(s.lumpedTimeConstantSeconds)} s（内部勾配がある条件では、平均温度の減衰はこの単一指数にはなりません）`,
  `表面積 A = ${s.surfaceAreaM2.toExponential(4)} m²、体積 V = ${s.volumeM3.toExponential(4)} m³`,
  `表面熱流束（内向き正） = ${fmt(s.surfaceInwardFluxWPerM2,1)} W/m²`,
  `表面熱流（内向き正） = ${fmt(s.surfaceInwardWatts)} W`,
  `表面からの積算熱量（内向き正） = ${fmt(s.cumulativeInwardJoules,3)} J`,
  `内部エネルギー = ${fmt(s.energyJoules,3)} J、収支誤差 = ${s.energyErrorJoules.toExponential(3)} J（相対 ${s.relativeEnergyError.toExponential(3)}）`,
  `最小／最大セル温度 = ${fmt(s.minTemperature)} K／${fmt(s.maxTemperature)} K`,
  `安定刻み safeDt = ${s.safeDt.toExponential(4)} s、ステップ数 = ${s.steps}、セル数 = ${n}`
 ];
 if(s.windEstimate){
  const w=s.windEstimate;
  lines.push(`風速推定の内訳：式(${w.correlation})（円柱横流れ・周方向平均）、Re_D = ${fmt(w.reynolds,2)}、Pr = ${fmt(w.prandtl,6)}、Pe_D = ${fmt(w.peclet,2)}、Nu_D = ${fmt(w.nusselt,6)}、膜温度 Tf = ${fmt(w.filmTemperatureK)} K`);
 }
 els.diag.textContent=lines.join('\n');
 const warnings=s.windEstimate?s.windEstimate.warnings:[];
 if(warnings.length){els.warnings.textContent='警告：\n'+warnings.map(w=>'・'+w).join('\n');els.warnings.hidden=false;}
 else{els.warnings.hidden=true;els.warnings.textContent='';}
 $('back').disabled=frame<=0;$('restart').disabled=frame<=0&&history.length<=1;
}
function apply(){
 stop();
 try{
  const c=readConfig();model=createCylinderCrossflowTransient(c);history=[model.snapshot()];frame=0;
  range=[Math.min(c.initialTemperature,c.fluidTemperature),Math.max(c.initialTemperature,c.fluidTemperature)];
  if(range[1]-range[0]<1)range=[range[0]-0.5,range[1]+0.5];
  els.summary.textContent=summaryText(c,history[0]);clearError();render();els.status.textContent='準備完了';
 }catch(e){showError(e);els.status.textContent='条件を受け付けませんでした';}
}
function advanceFrame(){
 const target=els.interval.valueAsNumber;
 if(!Number.isFinite(target)||target<=0){showError(Error('1コマの物理時間は正の数で指定してください。'));return;}
 if(frame<history.length-1){frame++;model.restore(history[frame]);render();els.status.textContent='計算済み';return;}
 const before=model.snapshot();
 try{model.step(target);}
 catch(e){model.restore(before);stop();showError(e);els.status.textContent='一時停止';return;}
 history.push(model.snapshot());if(history.length>1200)history.splice(1,history.length-1200);
 frame=history.length-1;clearError();render();els.status.textContent=timer?'再生中':'計算済み';
}
// Textbook-verified presets.  Property sets are built exactly as in the
// model regression tests, so the screen reproduces the verified values:
// the gradient case (docs/dynamic/CYLINDER_CROSSFLOW_REFERENCE_20261107.json),
// the lumped case (tau = 342.65 s), and Example 7.8 through the wind module
// (h = 2833.9817356038657 W/(m2 K), correlation 7.66).
const PRESETS={
 gradient:{hsource:'direct',diameter:'20',length:'100',k:'15',rho:'8000',cp:'500',h:'500',t0:'400',tinf:'300',cells:'32',velocity:'',fdensity:'',fviscosity:'',fcp:'',fk:'',film:'',interval:'2'},
 lumped:{hsource:'direct',diameter:'20',length:'100',k:'400',rho:'8900',cp:'385',h:'50',t0:'400',tinf:'300',cells:'16',velocity:'',fdensity:'',fviscosity:'',fcp:'',fk:'',film:'',interval:'60'},
 ex78:{hsource:'wind',diameter:'0.1',length:'1',k:'15',rho:'8000',cp:'500',h:'',t0:'383.15',tinf:'293.15',cells:'32',velocity:String(457*1.602e-5/0.0001),fdensity:'1',fviscosity:'0.00001602',fcp:String(0.712*0.0265/1.602e-5),fk:'0.0265',film:'',interval:'0.005'},
};
function applyPreset(key){
 const p=PRESETS[key];if(!p)return;
 $('hsource').value=p.hsource;
 for(const id of ['diameter','length','k','rho','cp','h','t0','tinf','velocity','fdensity','fviscosity','fcp','fk','film','interval'])$(id).value=p[id];
 $('cells').value=p.cells;
 syncHSource();apply();
}
els.form.addEventListener('submit',e=>{e.preventDefault();apply();});
$('hsource').addEventListener('change',syncHSource);
$('preset').addEventListener('change',e=>{if(e.target.value)applyPreset(e.target.value);});
for(const id of ['diameter','length','k','rho','cp','h','t0','tinf','cells','velocity','fdensity','fviscosity','fcp','fk','film'])
 $(id).addEventListener('input',()=>{$('preset').value='';});
$('run').addEventListener('click',()=>{if(!model||timer)return;timer=setInterval(advanceFrame,100);els.status.textContent='再生中';});
$('pause').addEventListener('click',()=>{stop();els.status.textContent='一時停止';});
$('step').addEventListener('click',()=>{stop();advanceFrame();});
$('back').addEventListener('click',()=>{stop();if(frame>0){frame--;model.restore(history[frame]);render();}els.status.textContent='計算済み';});
$('restart').addEventListener('click',()=>{stop();frame=0;model.restore(history[0]);render();els.status.textContent='計算済み';});
els.probe.addEventListener('input',render);
let resizeQueued=false;
addEventListener('resize',()=>{if(resizeQueued)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;if(model)render();});});
syncHSource();apply();
