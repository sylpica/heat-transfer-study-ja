// Dev screen wiring for the fin-gap flow model.  The core solve is a
// fast x-marching Graetz sweep (tens of ms at the acceptance meshes), so
// it runs synchronously and no worker is needed; the core module is used
// unchanged and its refusal messages are shown verbatim.
import {solveFinGapFlow} from './fin-gap-flow.mjs';
import {FINGAP_GUI_PRESETS,buildFinGapInput,formatTemperatureK,formatNusselt,formatHeatTransfer,formatPressurePa,formatWatt,formatVelocity,formatFlowLMin,formatMassFlowGS} from './fin-gap-flow-ui-config.mjs';
import {drawFinGapProfiles} from './fin-gap-flow-view.mjs';
const $=id=>document.getElementById(id);
const els={form:$('settings'),preset:$('preset'),status:$('status'),error:$('error'),summary:$('summary'),readout:$('readout'),profiles:$('profiles'),diag:$('diagnostic-values'),driveType:$('drivetype'),driveValueLabel:$('drivevaluelabel'),boundaryType:$('boundarytype'),boundaryValueLabel:$('boundaryvaluelabel')};
const FIELD_IDS={gapMm:'gap',finHeightMm:'fheight',lengthMm:'length',rho:'frho',cp:'fcp',k:'fk',nuMicro:'fnu',inletTemperature:'inlet',driveValue:'drivevalue',boundaryValue:'boundaryvalue',nx:'nx',ny:'ny',dxGrowth:'dxgrowth'};
const DRIVE_LABELS={'mean-velocity':'平均流速 [m/s]','volume-flow':'体積流量 [L/min]','mass-flow':'質量流量 [g/s]','pressure-difference':'圧力差 [Pa]'};
const BOUNDARY_LABELS={'wall-heat-flux':'両フィン面の熱流束 q″ [W/m²]','wall-temperature':'壁温 Tw [K]'};
const DRIVE_NAMES={'mean-velocity':'平均流速','volume-flow':'体積流量','mass-flow':'質量流量','pressure-difference':'圧力差'};
const BOUNDARY_NAMES={'wall-heat-flux':'一定熱流束','wall-temperature':'一定壁温'};
let lastResult=null;
for(const [key,p] of Object.entries(FINGAP_GUI_PRESETS)){const o=document.createElement('option');o.value=key;o.textContent=p.label;els.preset.append(o);}
function showError(e){els.error.textContent=e.message;els.error.hidden=false;}
function clearError(){els.error.hidden=true;els.error.textContent='';}
function syncValueLabels(){
 els.driveValueLabel.textContent=DRIVE_LABELS[els.driveType.value];
 els.boundaryValueLabel.textContent=BOUNDARY_LABELS[els.boundaryType.value];
}
function applyPreset(key){
 const p=FINGAP_GUI_PRESETS[key];if(!p)return;
 for(const [field,id] of Object.entries(FIELD_IDS))$(id).value=String(p.fields[field]);
 els.driveType.value=p.fields.driveType;els.boundaryType.value=p.fields.boundaryType;
 syncValueLabels();
}
function readFields(){
 const v=id=>{const x=$(id).valueAsNumber;if(!Number.isFinite(x))throw Error('入力に数値でない項目があります。');return x;};
 const fields={};
 for(const [field,id] of Object.entries(FIELD_IDS))fields[field]=v(id);
 fields.driveType=els.driveType.value;fields.boundaryType=els.boundaryType.value;
 return fields;
}
function render(result,fields,elapsedMs){
 const geo=result.geometry,drv=result.drive,flw=result.flow,prs=result.pressure,th=result.thermal;
 els.summary.textContent=`隙間 ${(geo.gapM*1000).toFixed(3)} mm × 幅（フィン高さ） ${(geo.finHeightM*1000).toFixed(3)} mm × 長さ ${(geo.lengthM*1000).toFixed(1)} mm の流路1本（水力直径 Dh = ${(geo.hydraulicDiameterM*1000).toFixed(3)} mm、幅／隙間 = ${geo.spanToGapRatio.toFixed(2)}）。駆動：${DRIVE_NAMES[drv.type]}、壁条件：${BOUNDARY_NAMES[th.boundaryType]}（両フィン面同一）。`;
 els.readout.textContent=[
  `平均流速 U = ${formatVelocity(drv.bulkVelocityMPerS)} m/s（体積流量 ${formatFlowLMin(drv.volumeFlowRateM3PerS*60000)} L/min、質量流量 ${formatMassFlowGS(drv.massFlowRateKgPerS)} g/s）`,
  `Re_Dh = ${flw.reynoldsDh.toFixed(1)}、Pr = ${flw.prandtl.toFixed(4)}、Pe_Dh = ${flw.pecletDh.toFixed(1)}、出口の無次元長 x* = ${flw.outletDimensionlessLength.toFixed(4)}`,
  `圧力損失 Δp = ${formatPressurePa(prs.dropPa)} Pa（圧力勾配 ${prs.gradientPaPerM.toFixed(4)} Pa/m、Darcy f = ${prs.darcyFrictionFactor.toFixed(5)}、f·Re_Dh = ${prs.frictionReynoldsProduct.toFixed(4)}）`,
  `出口バルク温度 = ${formatTemperatureK(th.outletBulkTemperatureK)} K（入口 ${result.config.inletTemperature} K から ${(th.outletBulkTemperatureK-result.config.inletTemperature)>=0?'+':''}${(th.outletBulkTemperatureK-result.config.inletTemperature).toFixed(4)} K）`,
  `出口局所 Nu = ${formatNusselt(th.outletLocalNusselt)}、平均 Nu = ${formatNusselt(th.meanNusselt)}、平均熱伝達率 h = ${formatHeatTransfer(th.meanHeatTransferCoefficientWPerM2K)} W/(m² K)`,
  `総熱移動率 = ${formatWatt(th.totalHeatRateW)} W、流体の熱量増加 = ${formatWatt(th.fluidHeatRateW)} W、収支の相対残差 = ${th.energyBalanceRelativeResidual.toExponential(2)}`,
 ].join('\n');
 els.diag.textContent=[
  `法則 ${result.law}（releaseApproved=${result.releaseApproved}、開発専用・限定モデル）`,
  `格子 nx=${result.graetz.mesh.nx} × ny=${result.graetz.mesh.ny}（セル数 ${result.graetz.mesh.count}）、dxGrowth = ${result.config.dxGrowth??1}、格子種別 ${result.graetz.mesh.kind}`,
  `流路断面積 = ${geo.crossSectionAreaM2.toExponential(4)} m²、加熱壁面積（両面） = ${geo.heatedWallAreaM2.toFixed(5)} m²`,
  `平均 Nu の定義：${th.meanNusseltDefinition}`,
  `圧力法則：${prs.law}`,
  `入口発達長の目安：流体力学的 約 ${flw.entranceLengthEstimatesM.hydrodynamic.toFixed(4)} m、熱的 約 ${flw.entranceLengthEstimatesM.thermal.toFixed(4)} m（目安であり受理境界ではありません）`,
  `計算時間（この画面の実測） ${elapsedMs.toFixed(0)} ms`,
 ].join('\n');
 drawFinGapProfiles(els.profiles,result);
}
function solve(){
 let fields;
 try{fields=readFields();}catch(e){showError(e);els.status.textContent='条件を受け付けませんでした';return;}
 const started=performance.now();
 try{
  const result=solveFinGapFlow(buildFinGapInput(fields));
  lastResult=result;clearError();render(result,fields,performance.now()-started);
  els.status.textContent='計算済み';
 }catch(e){showError(e);els.status.textContent='条件を受け付けませんでした';}
}
els.preset.addEventListener('change',()=>{applyPreset(els.preset.value);solve();});
els.driveType.addEventListener('change',syncValueLabels);
els.boundaryType.addEventListener('change',syncValueLabels);
els.form.addEventListener('submit',e=>{e.preventDefault();solve();});
let resizeQueued=false;
addEventListener('resize',()=>{if(resizeQueued)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;if(lastResult)drawFinGapProfiles(els.profiles,lastResult);});});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(lastResult)drawFinGapProfiles(els.profiles,lastResult);});
applyPreset('developedFlux');
solve();
