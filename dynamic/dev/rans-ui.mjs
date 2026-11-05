import {Actor} from '../actor.mjs';import {Experiment} from '../experiment.mjs';import {drawTraces} from '../trace-plot.mjs';import {drawRans} from './rans-view.mjs';
const $=id=>document.getElementById(id),probe=[.5,.5];let fixedB=null,scheduled=false,acceptedConfigs=[];
const experiment=new Experiment({actorFactory:options=>new Actor({...options,workerURL:new URL('./rans-worker.mjs',import.meta.url)}),changed:({type,experiment:e})=>{
 if(type==='state')acceptedConfigs=structuredClone(e.configs);
 const statuses={initializing:'初期化中',ready:'準備完了',calculating:'計算中',advanced:'計算済み',rewound:'保存コマへ戻りました',error:'停止しました',paused:'一時停止'};if(statuses[type])$('status').textContent=statuses[type];
 if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}
}});
function config(){
 if(!$('settings').reportValidity())throw Error('入力範囲を確認してください。');const nx=Number($('grid').value),ny=nx/2,caseId=$('case').value,direction=Number($('direction').value),turbulentPrandtl=Number($('prt').value);
 if(![32,64,128].includes(nx)||!['MKM180','MKM395','MKM590'].includes(caseId)||![-1,1].includes(direction)||!Number.isFinite(turbulentPrandtl)||turbulentPrandtl<.5||turbulentPrandtl>2)throw Error('開発用の条件範囲を超えます。');
 const sx=Math.sin(Math.PI/nx)/(Math.PI/nx),sy=Math.sin(Math.PI/ny)/(Math.PI/ny),initial=Array.from({length:nx*ny},(_,n)=>300+sx*Math.cos(2*Math.PI*((n%nx)+.5)/nx)*(1+.25*sy*Math.cos(2*Math.PI*(Math.floor(n/nx)+.5)/ny)));
 return {nx,ny,caseId,direction,turbulentPrandtl,halfGap:.1,width:1,depth:.01,nu:1.575e-5,rho:1.177,cp:1006,k:.0264,initial};
}
function timeParameters(){const duration=Number($('interval').value),dt=$('dt').value===''?.1*Math.min(...experiment.states.map(s=>s.safeDt)):Number($('dt').value);if(!Number.isFinite(duration)||duration<=0||duration>10||!Number.isFinite(dt)||dt<=0)throw Error('進行時間と刻みは正の範囲で指定してください。');return {duration,dt};}
async function initialize(){try{const a=config();await experiment.initialize({kind:'rans-channel',configs:fixedB?[a,fixedB]:[a]});}catch(error){experiment.invalidate(error);}}
const rms=s=>Math.sqrt(s.temperature.reduce((sum,t)=>sum+(t-s.meanTemperature)**2,0)/s.temperature.length);
function render(){
 $('error').hidden=!experiment.error;$('error').textContent=experiment.error?.message||'';$('progress').value=experiment.progress||0;
 const blocked=!experiment.ready||experiment.busy;for(const id of ['run','step','restart'])$(id).disabled=blocked;$('back').disabled=blocked||experiment.index===0;$('compare').disabled=blocked||!!fixedB;$('uncompare').disabled=experiment.busy||!fixedB;
 $('history').max=Math.max(0,experiment.history.length-1);$('history').value=experiment.index;$('history').disabled=blocked||experiment.history.length<2;
 if(!experiment.states.length)return;$('clock').textContent=experiment.states[0].time.toFixed(4)+' s';$('panel-b').hidden=experiment.states.length<2;
 const scale=Math.max(...experiment.states.flatMap(s=>s.velocity.map(Math.abs))),readings=[],details=[];$('legend').textContent=`A/B共通：温度298.75〜301.25 K、矢印の最大基準${scale.toPrecision(6)} m/s。計算した平均値を表示。`;
 experiment.states.forEach((s,index)=>{
  const letter=index?'b':'a',label=index?'B':'A',mesh=experiment.meshes[index],c=acceptedConfigs[index],i=Math.min(mesh.nx-1,Math.floor(probe[0]*mesh.nx)),j=Math.min(mesh.ny-1,Math.floor(probe[1]*mesh.ny)),T=s.temperature[j*mesh.nx+i],eddy=s.rowEffectiveThermalDiffusivity[j]-c.k/(c.rho*c.cp),f=x=>x.toExponential(7);
  drawRans($('field-'+letter),s,mesh,{probe,velocityScale:scale});$('caption-'+letter).textContent=`${label}：実Reτ=${s.meanFlow.reTau}、Prt=${s.turbulentPrandtl}、${mesh.nx}×${mesh.ny}、t=${s.time.toFixed(4)} s。${experiment.ready?'受理した計算状態':'前回受理した状態（変更条件は未適用）'}`;
  readings.push(`${label}: x=${(probe[0]*mesh.width).toFixed(4)} m、y=${(probe[1]*mesh.height).toFixed(4)} m\nT=${T.toFixed(7)} K、U=${s.velocity[j].toFixed(8)} m/s、νt=${f(eddy*c.turbulentPrandtl)} m²/s\n平均T=${s.meanTemperature.toFixed(8)} K、温度のRMS変動=${rms(s).toFixed(7)} K`);
  details.push(`${label}: ${s.meanFlow.caseId} / 実Reτ=${s.meanFlow.reTau}\nUb=${f(s.meanFlow.bulkVelocity)} m/s、uτ=${f(s.meanFlow.uTau)} m/s\ndp/dx=${f(s.meanFlow.pressureGradientPaPerM)} Pa/m、p(0)−p(L)=${f(-s.meanFlow.pressureGradientPaPerM*c.width)} Pa（駆動）\nPrt=${s.turbulentPrandtl}（仮定）、αeff範囲=${f(Math.min(...s.rowEffectiveThermalDiffusivity))}〜${f(Math.max(...s.rowEffectiveThermalDiffusivity))} m²/s\n時刻=${s.time} s、steps=${s.steps}、dt=${s.lastDt} s、safeDt=${s.safeDt} s、CFL=${s.advectionCfl}\n顕熱=${f(s.energy)} J（基準273.15 K）、境界入力=0 J\n収支差=${f(s.energyError)} J、丸め誤差予算=${f(s.energyRoundoffBudgetJ)} J\n温度範囲=${s.min.toFixed(7)}〜${s.max.toFixed(7)} K\n省略仕事の温度換算=${f(s.omittedMeanHeatingRateKPerS)} K/s、累積目安=${f(s.omittedMeanHeatingEstimateK)} K\n定常平均流のみ。瞬間変動と粘性発熱を解かず、公開承認なし。`);
 });
 $('readout').textContent=readings.join('\n\n');$('diagnostic-values').textContent=details.join('\n\n');$('heating-warning').hidden=!experiment.states.some(s=>s.omittedMeanHeatingEstimateK>.01);
 drawTraces($('graph'),experiment.states.map((s,i)=>({points:experiment.history.map(frame=>({x:frame[i].time,y:1000*rms(frame[i])}))})),experiment.states[0].time,{yLabel:'温度のRMS変動 [mK]'});
}
$('settings').onsubmit=e=>{e.preventDefault();initialize();};for(const id of ['case','direction','prt','grid'])$(id).onchange=()=>{experiment.invalidate();render();$('status').textContent='条件を変更しました。初期状態から計算してください。';};for(const id of ['interval','dt'])$(id).onchange=()=>experiment.pause();
$('step').onclick=async()=>{try{await experiment.advance(timeParameters());}catch(e){experiment.fail(e);}};$('run').onclick=()=>experiment.play(timeParameters);$('pause').onclick=()=>experiment.pause();$('back').onclick=()=>experiment.rewind(experiment.index-1);$('restart').onclick=()=>experiment.restart();$('history').oninput=()=>experiment.rewind(Number($('history').value));
$('compare').onclick=()=>{fixedB=structuredClone(experiment.configs[0]);initialize();};$('uncompare').onclick=()=>{fixedB=null;initialize();};
for(const id of ['field-a','field-b']){const canvas=$(id);canvas.onpointerdown=e=>{const r=canvas.getBoundingClientRect(),p=JSON.parse(canvas.dataset.plot),x=(e.clientX-r.left)*p.logicalWidth/r.width,y=(e.clientY-r.top)*p.logicalHeight/r.height;probe[0]=Math.max(0,Math.min(1,(x-p.left)/p.width));probe[1]=Math.max(0,Math.min(1,1-(y-p.top)/p.height));canvas.focus();render();};canvas.onkeydown=e=>{const d={ArrowRight:[.025,0],ArrowLeft:[-.025,0],ArrowUp:[0,.05],ArrowDown:[0,-.05]}[e.key];if(!d)return;e.preventDefault();probe.forEach((p,i)=>probe[i]=Math.max(0,Math.min(1,p+d[i])));render();};}
window.addEventListener('resize',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}});matchMedia('(prefers-color-scheme: dark)').addEventListener('change',render);window.addEventListener('pagehide',()=>experiment.close());initialize();
