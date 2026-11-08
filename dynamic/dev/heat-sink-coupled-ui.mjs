import {COUPLED_GUI_PRESETS,buildCoupledInput,formatTemperatureK,formatPressurePa,formatRadiationW,formatFlowLMin,formatWatt,formatPercent} from './heat-sink-coupled-ui-config.mjs';
import {drawChannelFlows} from './heat-sink-coupled-view.mjs';
const $=id=>document.getElementById(id);
const els={form:$('settings'),preset:$('preset'),status:$('status'),error:$('error'),summary:$('summary'),readout:$('readout'),flowlist:$('flowlist'),flows:$('flows'),diag:$('diagnostic-values'),apply:$('apply')};
const FIELD_IDS={finCount:'fincount',finThicknessMm:'fthick',gapMm:'gap',finHeightMm:'fheight',lengthMm:'length',baseThicknessMm:'bthick',solidK:'solidk',fluidRho:'frho',fluidCp:'fcp',fluidK:'fk',fluidNuMicro:'fnu',ambient:'ambient',flowLMin:'flow',power:'power',emissivity:'emissivity',patchLengthMm:'patchl',patchWidthMm:'patchw'};
let worker=null,busy=false,lastFlows=null,sentAt=0;
for(const [key,p] of Object.entries(COUPLED_GUI_PRESETS)){const o=document.createElement('option');o.value=key;o.textContent=p.label;els.preset.append(o);}
function showError(e){els.error.textContent=e.message;els.error.hidden=false;}
function clearError(){els.error.hidden=true;els.error.textContent='';}
function applyPreset(key){
 const p=COUPLED_GUI_PRESETS[key];if(!p)return;
 for(const [field,id] of Object.entries(FIELD_IDS))$(id).value=String(p.fields[field]);
 $('refinement').value=String(p.refinement);$('hrefinement').value=String(p.hydraulicRefinement);
}
function readFields(){
 const v=id=>{const x=$(id).valueAsNumber;if(!Number.isFinite(x))throw Error('入力に数値でない項目があります。');return x;};
 const fields={};
 for(const [field,id] of Object.entries(FIELD_IDS))fields[field]=v(id);
 return {fields,options:{refinement:Number($('refinement').value),hydraulicRefinement:Number($('hrefinement').value)}};
}
function render(result,elapsedS){
 const c=result.conditions,ng=c.finCount+1;
 const flows=result.channelFlowsM3PerS.map(q=>q*60000);
 lastFlows=flows;
 els.summary.textContent=`幅 ${(c.width*1000).toFixed(1)} mm（フィン ${c.finCount} 本×${(c.finThickness*1000).toFixed(1)} mm＋流路 ${ng} 本×${(c.gap*1000).toFixed(1)} mm）、流路数 ${ng}、水力直径 ${(4*c.gap*c.finHeight/(c.gap+2*c.finHeight)*1000).toFixed(2)} mm、フィン端面の規定 h_ref = ${c.hReference.toFixed(2)} W/(m² K)。格子 r=${result.refinement}・速度副格子 ${result.hydraulicRefinement}、放射率 ε=${c.emissivity}。`;
 els.readout.textContent=[
  `発熱面平均温度 = ${formatTemperatureK(result.sourceAverageTemperatureK)} K（周囲 ${c.ambient} K から +${(result.sourceAverageTemperatureK-c.ambient).toFixed(4)} K）`,
  `圧損 = ${formatPressurePa(result.pressureDropPa)} Pa`,
  `放射（開口から周囲へ） = ${formatRadiationW(result.radiationApertureW)} W（発熱の ${formatPercent(c.power?100*result.radiationApertureW/c.power:0)} %）`,
  `流体への熱（界面） = ${formatWatt(result.heatToFluidW)} W、流体のエンタルピー増加 = ${formatWatt(result.fluidEnthalpyIncreaseW)} W`,
  `フィン端面の対流 = ${formatWatt(result.endConvectionW)} W`,
  `基部セル最大温度 = ${formatTemperatureK(result.maximumBaseCellTemperatureK)} K、発熱面最大温度 = ${formatTemperatureK(result.sourceFaceMaximumTemperatureK)} K、基部体積平均 = ${formatTemperatureK(result.baseVolumeMeanTemperatureK)} K`,
  `全熱収支の残差 = ${result.energyResidualW.toExponential(3)} W（相対 ${result.relativeEnergyResidual.toExponential(2)}）`,
  `平均流速 = ${result.meanChannelSpeedMPerS.toFixed(4)} m/s、Re（隙間の2倍基準） = ${result.RePlanar.toFixed(1)}、Re（水力直径） = ${result.ReWetted.toFixed(1)}、Pe = ${result.PePlanar.toFixed(1)}`,
 ].join('\n');
 els.flowlist.textContent=result.channelFlowsM3PerS.map((q,j)=>
  `流路 ${j+1}：流量 ${formatFlowLMin(q*60000)} L/min、出口バルク温度 ${formatTemperatureK(result.bulkTemperaturesK[j][result.nx-1])} K`).join('\n');
 drawChannelFlows(els.flows,flows);
 const hist=result.nonlinearHistory,last=hist[hist.length-1];
 els.diag.textContent=[
  `法則 ${result.law}（releaseApproved=${result.releaseApproved}、一般CFDではありません）`,
  `未知数 ${result.unknowns}（Nx=${result.nx}、基部 Ny=${result.nyBase}×Nz=${result.nzBase}、流体 Ny=${result.nyFluid}×Nz=${result.nzFin}）`,
  `線形反復の総数 ${result.linearIterations}、放射の固定点反復 ${hist.length} 回（最終の更新差 ${last?last.maximumChangeK.toExponential(3):'—'} K・残差 ${last?last.maximumResidualW.toExponential(3):'—'} W）`,
  `非線形残差最大：固体 ${result.solidResidualMaximumW.toExponential(3)} W、流体 ${result.fluidResidualMaximumW.toExponential(3)} W`,
  `固体‐流体の内部収支差 = ${result.fluidInternalBalanceW.toExponential(3)} W、放射の内部収支差 = ${result.radiationInternalBalanceW.toExponential(3)} W`,
  `流量係数の連続級数に対する相対差 = ${formatPercent(100*result.hydraulicMobilityRelativeError)} %、断面 Poisson 残差最大 ${result.maximumPoissonResidual.toExponential(3)}`,
  `形態係数の閉包誤差 ${result.radiationViewClosure.toExponential(3)}、射度演算子の相反性（相対） ${result.radiationReciprocity.toExponential(3)}`,
  `境界温度の近似（モジュールの注記）：${result.boundaryTemperatureApproximation}`,
  `計算時間（この画面の実測） ${elapsedS.toFixed(1)} s`,
 ].join('\n');
}
function solve(){
 if(busy)return;
 let parsed;
 try{parsed=readFields();}catch(e){showError(e);els.status.textContent='条件を受け付けませんでした';return;}
 const input=buildCoupledInput(parsed.fields);
 if(!worker){
  worker=new Worker(new URL('./heat-sink-coupled-worker.mjs',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
   busy=false;els.apply.disabled=false;
   if(data.type==='result'){clearError();render(data.result,(performance.now()-sentAt)/1000);els.status.textContent='計算済み';}
   else{showError(Error(data.message));els.status.textContent='条件を受け付けませんでした';}
  };
  worker.onerror=e=>{busy=false;els.apply.disabled=false;showError(Error(e.message||'計算ワーカーでエラーが発生しました。'));els.status.textContent='計算できませんでした';};
 }
 busy=true;els.apply.disabled=true;clearError();
 els.status.textContent=`計算中…（格子 r=${parsed.options.refinement} の定常連成解。r=4 では十数秒かかることがあります）`;
 sentAt=performance.now();
 worker.postMessage({input,options:parsed.options});
}
els.preset.addEventListener('change',()=>{applyPreset(els.preset.value);solve();});
els.form.addEventListener('submit',e=>{e.preventDefault();solve();});
let resizeQueued=false;
addEventListener('resize',()=>{if(resizeQueued)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;if(lastFlows)drawChannelFlows(els.flows,lastFlows);});});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(lastFlows)drawChannelFlows(els.flows,lastFlows);});
applyPreset('standard');
solve();
