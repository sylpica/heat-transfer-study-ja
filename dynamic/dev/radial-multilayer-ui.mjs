import {createRadialMultilayer} from './radial-multilayer.mjs';
import {drawMultilayerField,drawMultilayerProfile} from './radial-multilayer-view.mjs';
import {BC_PARAMS,buildMultilayerConfig,MULTILAYER_PRESETS,defaultLayerValues} from './radial-multilayer-ui-config.mjs';
const $=id=>document.getElementById(id);
const els={form:$('settings'),status:$('status'),error:$('error'),clock:$('clock'),readout:$('readout'),diag:$('diagnostic-values'),legend:$('legend'),summary:$('summary'),field:$('field'),graph:$('graph'),probe:$('probe'),interval:$('interval'),layers:$('layers'),interfaces:$('interfaces'),preset:$('preset')};
const fmt=(v,d=4)=>v===null||v===undefined?'—':Number(v).toFixed(d);
let model=null,history=[],frame=0,timer=null,range=[300,400];
let layerValues=[{thicknessMm:3,cells:32,k:8,rho:100,cp:1000,source:0},{thicknessMm:4,cells:32,k:2,rho:100,cp:1000,source:0}];
let contactValues=[0.005];
function stop(){if(timer){clearInterval(timer);timer=null;}}
function showError(e){els.error.textContent=e.message;els.error.hidden=false;}
function clearError(){els.error.hidden=true;els.error.textContent='';}
// ---- layer / interface editors (state is the source of truth) ----
const LAYER_FIELDS=[['thicknessMm','厚さ [mm]'],['cells','セル数'],['k','k [W/(m K)]'],['rho','ρ [kg/m³]'],['cp','cp [J/(kg K)]'],['source','発熱 [W/m³]']];
function syncLayersFromDom(){
 els.layers.querySelectorAll('.layer-row').forEach((row,i)=>{
  for(const [key] of LAYER_FIELDS){const input=row.querySelector(`[data-layer-field="${key}"]`);layerValues[i][key]=key==='cells'?Number(input.value):input.valueAsNumber;}
 });
}
function syncContactFromDom(){
 els.interfaces.querySelectorAll('[data-contact-index]').forEach(input=>{contactValues[Number(input.dataset.contactIndex)]=input.valueAsNumber;});
}
function renderLayerRows(){
 els.layers.textContent='';
 layerValues.forEach((layer,i)=>{
  const row=document.createElement('div');row.className='layer-row';
  const head=document.createElement('div');head.className='layer-row-head';
  const title=document.createElement('strong');title.textContent=`第${i+1}層`;head.append(title);
  const mk=(text,fn,label)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',`第${i+1}層を${label}`);b.addEventListener('click',fn);return b;};
  head.append(
   mk('↑',()=>{syncLayersFromDom();syncContactFromDom();if(i>0){[layerValues[i-1],layerValues[i]]=[layerValues[i],layerValues[i-1]];renderLayerRows();renderInterfaceInputs();}},'上へ'),
   mk('↓',()=>{syncLayersFromDom();syncContactFromDom();if(i<layerValues.length-1){[layerValues[i+1],layerValues[i]]=[layerValues[i],layerValues[i+1]];renderLayerRows();renderInterfaceInputs();}},'下へ'),
   mk('削除',()=>{syncLayersFromDom();syncContactFromDom();if(layerValues.length>1){layerValues.splice(i,1);contactValues.splice(Math.min(i,contactValues.length-1),1);renderLayerRows();renderInterfaceInputs();}},'削除')
  );
  const grid=document.createElement('div');grid.className='layer-grid';
  for(const [key,labelText] of LAYER_FIELDS){
   const label=document.createElement('label');label.textContent=`${labelText} `;
   const input=document.createElement('input');input.type='number';input.step='any';input.required=true;input.value=String(layer[key]);input.dataset.layerField=key;
   if(key==='cells'){input.min='1';input.max='512';input.step='1';}
   label.append(input);grid.append(label);
  }
  row.append(head,grid);els.layers.append(row);
 });
 $('add-layer').disabled=layerValues.length>=8;
}
function renderInterfaceInputs(){
 // Renders from state only. Callers that rebuild the inputs after user
 // edits (layer add/remove/reorder) sync the DOM values into state first;
 // syncing here would resurrect stale values when a preset is loaded.
 while(contactValues.length<layerValues.length-1)contactValues.push(0);
 contactValues.length=Math.max(0,layerValues.length-1);
 els.interfaces.textContent='';
 contactValues.forEach((v,i)=>{
  const label=document.createElement('label');label.textContent=`界面${i+1}（第${i+1}層 | 第${i+2}層） `;
  const input=document.createElement('input');input.type='number';input.step='any';input.min='0';input.value=String(v);input.dataset.contactIndex=String(i);
  label.append(input);els.interfaces.append(label);
 });
 if(!contactValues.length)els.interfaces.textContent='界面はありません（単層）。';
}
// ---- boundary-condition editors ----
function bcValues(prefix){
 const num=id=>$(id).valueAsNumber;
 return {type:$(`${prefix}-bc-type`).value,temperature:num(`${prefix}-bc-temperature`),flux:num(`${prefix}-bc-flux`),h:num(`${prefix}-bc-h`),emissivity:num(`${prefix}-bc-emissivity`),radiationTemperature:num(`${prefix}-bc-radiation-temperature`)};
}
function refreshBcParams(prefix){
 const type=$(`${prefix}-bc-type`).value,params=BC_PARAMS[type]||[];
 $(`${prefix}-bc-params`).querySelectorAll('[data-bc-param]').forEach(label=>{label.hidden=!params.includes(label.dataset.bcParam);});
}
function setBc(prefix,bc){
 $(`${prefix}-bc-type`).value=bc.type;
 const fill=(id,v)=>{if(v!==undefined)$(id).value=String(v);};
 fill(`${prefix}-bc-temperature`,bc.temperature);fill(`${prefix}-bc-flux`,bc.flux);fill(`${prefix}-bc-h`,bc.h);fill(`${prefix}-bc-emissivity`,bc.emissivity);fill(`${prefix}-bc-radiation-temperature`,bc.radiationTemperature);
 refreshBcParams(prefix);
}
// ---- form <-> config ----
function readValues(){
 syncLayersFromDom();syncContactFromDom();
 const num=id=>$(id).valueAsNumber;
 return {geometry:$('geometry').value,lengthMm:num('length'),innerRadiusMm:num('inner-radius'),initialK:num('initial'),
  layers:layerValues.map(l=>({...l})),contact:[...contactValues],innerBC:bcValues('inner'),outerBC:bcValues('outer')};
}
function fillForm(v){
 $('geometry').value=v.geometry;$('length').value=String(v.lengthMm);$('inner-radius').value=String(v.innerRadiusMm);$('initial').value=String(v.initialK);
 layerValues=v.layers.map(l=>({...l}));contactValues=[...(v.contact||[])];
 renderLayerRows();renderInterfaceInputs();setBc('inner',v.innerBC);setBc('outer',v.outerBC);
 $('length').disabled=v.geometry==='sphere';
}
function summaryText(config,mesh){
 const shape=config.geometry==='cylinder'?`円筒（長さ ${(config.length*1000).toFixed(1)} mm）`:'球';
 const layers=mesh.layers.map(l=>`第${l.index+1}層 k=${l.k}`).join('、');
 return `${shape}、内半径 ${(mesh.innerRadius*1000).toFixed(1)} mm・外半径 ${(mesh.outerRadius*1000).toFixed(1)} mm、${mesh.layers.length}層（${layers}）、総セル数 ${mesh.count}。`;
}
function render(){
 const s=history[frame];if(!s)return;const mesh=model.mesh,fluxData=model.flux(),n=mesh.count,probe=Math.min(n-1,Math.max(0,Number(els.probe.value)||0));
 els.probe.max=String(n-1);els.probe.value=String(probe);
 if(s.min<range[0])range[0]=s.min;if(s.max>range[1])range[1]=s.max;
 els.clock.textContent=`${s.time.toFixed(3)} s`;
 drawMultilayerField(els.field,s,mesh,probe,range[0],range[1]);
 drawMultilayerProfile(els.graph,s,mesh,fluxData,probe,range[0],range[1]);
 els.legend.textContent=`色の範囲：${range[0].toFixed(1)} K（青）〜 ${range[1].toFixed(1)} K（赤）。橙の輪は測定セル、太線は材料界面です。`;
 const probeLayer=mesh.layers.find(l=>probe>=l.firstCell&&probe<l.firstCell+l.cells);
 const lines=[
  `測定位置 r=${(mesh.centres[probe]*1000).toFixed(2)} mm（セル ${probe+1}/${n}、第${probeLayer.index+1}層）：${fmt(s.temperature[probe])} K`,
  `内面温度=${fmt(s.innerSurfaceTemperature)} K、外面温度=${fmt(s.outerSurfaceTemperature)} K`,
  `外面の外向き熱流=${fmt(fluxData.outwardWatts.at(-1))} W`
 ];
 fluxData.interfaces.forEach((it,j)=>{
  lines.push(`界面${j+1}（r=${(it.radius*1000).toFixed(2)} mm、第${it.leftLayer+1}層|第${it.rightLayer+1}層）：左面 ${fmt(it.leftSurfaceTemperature)} K、右面 ${fmt(it.rightSurfaceTemperature)} K、ジャンプ ${fmt(it.temperatureJump)} K、熱流 ${fmt(it.outwardWatts)} W`);
 });
 if(!fluxData.interfaces.length)lines.push('界面はありません（単層）。');
 els.readout.textContent=lines.join('\n');
 const volume=mesh.volumes.reduce((a,b)=>a+b,0);
 els.diag.textContent=[
  `法則 ${s.law}（releaseApproved=${s.releaseApproved}）`,
  `総セル数=${n}、総体積=${volume.toExponential(4)} m³、安定刻み safeDt=${model.safeDt.toExponential(4)} s、ステップ数=${s.steps}`,
  `内面境界の流入=${fmt(s.innerInwardWatts)} W、外面境界の流入=${fmt(s.outerInwardWatts)} W、直近の正味外部入力=${fmt(s.lastPower)} W`,
  `内部エネルギー=${fmt(s.energy,3)} J（基準 273.15 K）、正味入力の積算=${fmt(s.netInput,3)} J、収支誤差=${s.energyError.toExponential(3)} J（相対 ${s.relativeEnergyError.toExponential(3)}）`,
  ...mesh.layers.map(l=>`第${l.index+1}層：r ${(l.innerRadius*1000).toFixed(2)}〜${(l.outerRadius*1000).toFixed(2)} mm、k=${l.k} W/(m K)、ρ=${l.rho} kg/m³、cp=${l.cp} J/(kg K)、発熱=${l.source} W/m³、セル数=${l.cells}（dr=${(l.dr*1000).toFixed(3)} mm）`),
  ...fluxData.interfaces.map((it,j)=>`界面${j+1}：Rc″=${it.contactResistance} m² K/W、熱流束=${fmt(it.outwardFlux,1)} W/m²、左面 ${fmt(it.leftSurfaceTemperature)} K、右面 ${fmt(it.rightSurfaceTemperature)} K、ジャンプ ${fmt(it.temperatureJump)} K`)
 ].join('\n');
 $('back').disabled=frame<=0;$('restart').disabled=frame<=0&&history.length<=1;
}
function apply(){
 stop();
 try{
  const config=buildMultilayerConfig(readValues());
  model=createRadialMultilayer(config);history=[model.snapshot()];frame=0;
  const temps=[config.initial];
  for(const bc of [config.boundary,config.innerBoundary]){if(Number.isFinite(bc.temperature))temps.push(bc.temperature);if(Number.isFinite(bc.radiationTemperature))temps.push(bc.radiationTemperature);}
  range=[Math.min(...temps),Math.max(...temps)];if(range[0]===range[1]){range[0]-=1;range[1]+=1;}
  els.summary.textContent=summaryText(config,model.mesh);clearError();render();els.status.textContent='準備完了';
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
$('add-layer').addEventListener('click',()=>{syncLayersFromDom();syncContactFromDom();if(layerValues.length<8){layerValues.push(defaultLayerValues());contactValues.push(0);renderLayerRows();renderInterfaceInputs();}});
$('geometry').addEventListener('change',()=>{$('length').disabled=$('geometry').value==='sphere';});
$('inner-bc-type').addEventListener('change',()=>refreshBcParams('inner'));
$('outer-bc-type').addEventListener('change',()=>refreshBcParams('outer'));
for(const [key,preset] of Object.entries(MULTILAYER_PRESETS)){const option=document.createElement('option');option.value=key;option.textContent=preset.label;els.preset.append(option);}
els.preset.addEventListener('change',()=>{const preset=MULTILAYER_PRESETS[els.preset.value];if(preset){fillForm(structuredClone(preset.values));apply();}});
let resizeQueued=false;
addEventListener('resize',()=>{if(resizeQueued)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;if(model)render();});});
fillForm(structuredClone(MULTILAYER_PRESETS.contact.values));
els.preset.value='contact';
apply();
