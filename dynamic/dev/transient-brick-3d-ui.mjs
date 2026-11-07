import {createTransientBrick3d} from './transient-brick-3d.mjs';
import {BRICK_FACES,BOUNDARY_TYPES,BRICK_PRESETS,DEFAULT_PRESET,buildBrickInput,sliceField,sliceCell,probeTemperature} from './transient-brick-3d-ui-config.mjs';
import {drawBrickSlice,sliceCellAtPoint} from './transient-brick-3d-view.mjs';
const $=id=>document.getElementById(id);
const els={form:$('settings'),status:$('status'),error:$('error'),clock:$('clock'),readout:$('readout'),diag:$('diagnostic-values'),legend:$('legend'),summary:$('summary'),field:$('field'),interval:$('interval'),preset:$('preset'),plane:$('plane'),slice:$('slice'),slicePos:$('slice-pos'),probeCol:$('probe-col'),probeRow:$('probe-row')};
const fmt=(v,d=4)=>v===null||v===undefined?'—':Number(v).toFixed(d);
const FACE_PARAM_DEFAULTS={temperature:350,flux:1000,h:25,fluidTemperature:300};
let model=null,history=[],frame=0,timer=null,range=[300,300],viewSize={W:600,H:340};
function stop(){if(timer){clearInterval(timer);timer=null;}}
function showError(e){els.error.textContent=e.message;els.error.hidden=false;}
function clearError(){els.error.hidden=true;els.error.textContent='';}
const faceParamLabels={};
// Build the six face editors (one compact fieldset per face).
for(const face of BRICK_FACES){
 const fs=document.createElement('fieldset');
 const legend=document.createElement('legend');legend.textContent=face.label;fs.appendChild(legend);
 const typeLabel=document.createElement('label');typeLabel.textContent='種別';
 const select=document.createElement('select');select.id=`f-${face.key}-type`;
 for(const t of BOUNDARY_TYPES){const o=document.createElement('option');o.value=t.value;o.textContent=t.label;select.appendChild(o);}
 typeLabel.appendChild(select);fs.appendChild(typeLabel);
 faceParamLabels[face.key]=[];
 const params=[['temperature','temperature','温度 [K]'],['flux','flux','熱流束 [W/m²]'],['convection','h','熱伝達率 h [W/(m² K)]'],['convection','fluidTemperature','流体温度 [K]']];
 for(const [kind,param,labelText] of params){
  const label=document.createElement('label');label.dataset.kind=kind;label.textContent=labelText;
  const input=document.createElement('input');input.type='number';input.step='any';input.id=`f-${face.key}-${param}`;input.value=String(FACE_PARAM_DEFAULTS[param]);
  label.appendChild(input);fs.appendChild(label);faceParamLabels[face.key].push(label);
 }
 select.addEventListener('change',()=>syncFaceParams(face.key));
 $('faces').appendChild(fs);
}
function syncFaceParams(key){
 const type=$(`f-${key}-type`).value;
 for(const label of faceParamLabels[key])label.hidden=label.dataset.kind!==type;
}
function syncAllFaceParams(){for(const f of BRICK_FACES)syncFaceParams(f.key);}
for(const p of BRICK_PRESETS){const o=document.createElement('option');o.value=p.id;o.textContent=p.label;els.preset.appendChild(o);}
els.preset.value=DEFAULT_PRESET;
function num(id){const x=$(id).valueAsNumber;if(!Number.isFinite(x))throw Error('入力に数値でない項目があります。');return x;}
function int(id){const x=num(id);if(!Number.isInteger(x))throw Error('入力に数値でない項目があります。');return x;}
function readValues(){
 const faces={};
 for(const f of BRICK_FACES)faces[f.key]={type:$(`f-${f.key}-type`).value,
  temperature:num(`f-${f.key}-temperature`),flux:num(`f-${f.key}-flux`),h:num(`f-${f.key}-h`),fluidTemperature:num(`f-${f.key}-fluidTemperature`)};
 return {sizeMm:{x:num('sx'),y:num('sy'),z:num('sz')},cells:{nx:int('nx'),ny:int('ny'),nz:int('nz')},
  k:num('k'),rho:num('rho'),cp:num('cp'),initial:num('t0'),faces};
}
function fillForm(v){
 $('sx').value=v.sizeMm.x;$('sy').value=v.sizeMm.y;$('sz').value=v.sizeMm.z;
 $('nx').value=v.cells.nx;$('ny').value=v.cells.ny;$('nz').value=v.cells.nz;
 $('k').value=v.k;$('rho').value=v.rho;$('cp').value=v.cp;$('t0').value=v.initial;
 els.interval.value=v.frameSeconds;
 for(const f of BRICK_FACES){
  const src=v.faces[f.key];$(`f-${f.key}-type`).value=src.type;
  for(const param of ['temperature','flux','h','fluidTemperature'])
   if(src[param]!==undefined)$(`f-${f.key}-${param}`).value=src[param];
 }
 syncAllFaceParams();
}
function summaryText(input){
 const bc=input.boundaries,short={insulated:'断熱',temperature:'温度',flux:'流束',convection:'対流'};
 const faces=BRICK_FACES.map(f=>`${f.key}=${short[bc[f.key].type]}`).join('、');
 return `寸法 ${(input.size.x*1000).toFixed(1)}×${(input.size.y*1000).toFixed(1)}×${(input.size.z*1000).toFixed(1)} mm、格子 ${input.cells.nx}×${input.cells.ny}×${input.cells.nz}（合計 ${input.cells.nx*input.cells.ny*input.cells.nz} セル）、k=${input.k} W/(m K)、ρ=${input.rho} kg/m³、cp=${input.cp} J/(kg K)（一定物性）、初期 ${input.initial} K。境界：${faces}。`;
}
function currentSlice(s){
 return sliceField(s,els.plane.value,Number(els.slice.value)||0);
}
function render(){
 const s=history[frame];if(!s)return;
 const counts={xy:s.nz,xz:s.ny,yz:s.nx};
 els.slice.max=String(counts[els.plane.value]-1);
 if(Number(els.slice.value)>counts[els.plane.value]-1)els.slice.value='0';
 const slice=currentSlice(s);
 els.slicePos.textContent=`${slice.fixedName} = ${(slice.fixedCentre*1000).toFixed(2)} mm（${slice.fixedIndex+1} / ${counts[els.plane.value]} 層）`;
 els.probeCol.max=String(slice.nCol-1);els.probeRow.max=String(slice.nRow-1);
 const pcol=Math.min(slice.nCol-1,Math.max(0,Number(els.probeCol.value)||0)),prow=Math.min(slice.nRow-1,Math.max(0,Number(els.probeRow.value)||0));
 els.probeCol.value=String(pcol);els.probeRow.value=String(prow);
 els.clock.textContent=`${s.time.toFixed(3)} s`;
 viewSize={W:els.field.clientWidth||600,H:340};
 drawBrickSlice(els.field,slice,{row:prow,col:pcol},range[0],range[1]);
 els.legend.textContent=`色の範囲：${range[0].toFixed(1)} K（青）〜 ${range[1].toFixed(1)} K（赤）。橙の枠は測定セルです。`;
 const cell=sliceCell(slice,prow,pcol);
 els.readout.textContent=[
  `測定セル（i=${cell.i+1}, j=${cell.j+1}, l=${cell.l+1}／中心 x=${(s.centres.x[cell.i]*1000).toFixed(2)} mm, y=${(s.centres.y[cell.j]*1000).toFixed(2)} mm, z=${(s.centres.z[cell.l]*1000).toFixed(2)} mm）：${fmt(probeTemperature(s,cell))} K`,
  `全体：平均 ${fmt(s.mean)} K、最小 ${fmt(s.min)} K、最大 ${fmt(s.max)} K`
 ].join('\n');
 els.diag.textContent=[
  `法則 ${s.law}（releaseApproved=${s.releaseApproved}）`,
  `格子 ${s.nx}×${s.ny}×${s.nz}（合計 ${s.nx*s.ny*s.nz} セル）、セル体積=${model.grid.cellVolume.toExponential(4)} m³`,
  `安定刻み safeDt=${s.safeDt===null?'制限なし（断熱のみ）':s.safeDt.toExponential(4)+' s'}、ステップ数=${s.steps}、最終刻み=${fmt(s.lastDt,6)} s`,
  `内部エネルギー=${fmt(s.energy,3)} J、初期からの変化=${fmt(s.energyChange,3)} J、境界からの累積入熱=${fmt(s.netInput,3)} J`,
  `収支誤差=${s.energyError.toExponential(3)} J（相対 ${s.relativeEnergyError.toExponential(3)}）、直近の境界入熱率=${fmt(s.lastPower,3)} W`,
  `仮定：一定物性・一様初期温度・流束面は温度に依存しない・放射なし・体積発熱なし`
 ].join('\n');
 $('back').disabled=frame<=0;$('restart').disabled=frame<=0&&history.length<=1;
}
function apply(){
 stop();
 try{
  const input=buildBrickInput(readValues());
  model=createTransientBrick3d(input);history=[model.snapshot()];frame=0;
  const temps=[input.initial];
  for(const f of BRICK_FACES){const b=input.boundaries[f.key];if(b.type==='temperature'||b.type==='convection')temps.push(b.temperature);}
  const s=history[0];range=[Math.min(...temps,s.min),Math.max(...temps,s.max)];if(range[0]===range[1]){range[0]-=.5;range[1]+=.5;}
  const fixedCount=els.plane.value==='xy'?input.cells.nz:els.plane.value==='xz'?input.cells.ny:input.cells.nx;
  els.slice.max=String(fixedCount-1);
  els.slice.value=String(Math.floor(fixedCount/2));
  els.probeCol.value='0';els.probeRow.value='0';
  els.summary.textContent=summaryText(input);clearError();render();els.status.textContent='準備完了';
 }catch(e){showError(e);els.status.textContent='条件を受け付けませんでした';}
}
function advanceFrame(){
 const target=els.interval.valueAsNumber;
 if(!Number.isFinite(target)||target<=0){showError(Error('1コマの物理時間は正の数で指定してください。'));return;}
 if(frame<history.length-1){frame++;model.restore(history[frame]);render();els.status.textContent='計算済み';return;}
 const before=model.snapshot();let remaining=target;
 try{
  let guard=0;
  while(remaining>1e-12){
   if(++guard>200000)throw Error('1コマに必要な分割数が上限を超えています。1コマの物理時間を短くするか、格子を粗くしてください。');
   const dt=Number.isFinite(model.safeDt)?Math.min(model.safeDt,remaining):remaining;
   model.step(dt,false);remaining-=dt;
  }
 }catch(e){model.restore(before);stop();showError(e);els.status.textContent='一時停止';return;}
 history.push(model.snapshot());if(history.length>1200)history.splice(1,history.length-1200);
 frame=history.length-1;
 const s=history[frame];range=[Math.min(range[0],s.min),Math.max(range[1],s.max)];
 clearError();render();els.status.textContent=timer?'再生中':'計算済み';
}
els.preset.addEventListener('change',()=>{
 const p=BRICK_PRESETS.find(x=>x.id===els.preset.value);
 if(p&&p.values){fillForm(p.values);apply();}
});
els.form.addEventListener('submit',e=>{e.preventDefault();apply();});
$('run').addEventListener('click',()=>{if(!model||timer)return;timer=setInterval(advanceFrame,100);els.status.textContent='再生中';});
$('pause').addEventListener('click',()=>{stop();els.status.textContent='一時停止';});
$('step').addEventListener('click',()=>{stop();advanceFrame();});
$('back').addEventListener('click',()=>{stop();if(frame>0){frame--;model.restore(history[frame]);render();}els.status.textContent='計算済み';});
$('restart').addEventListener('click',()=>{stop();frame=0;model.restore(history[0]);render();els.status.textContent='計算済み';});
for(const el of [els.plane,els.slice,els.probeCol,els.probeRow])el.addEventListener('input',render);
els.field.addEventListener('click',e=>{
 const s=history[frame];if(!s)return;
 const rect=els.field.getBoundingClientRect();
 const px=(e.clientX-rect.left)/rect.width*viewSize.W,py=(e.clientY-rect.top)/rect.height*viewSize.H;
 const hit=sliceCellAtPoint(currentSlice(s),viewSize.W,viewSize.H,px,py);
 if(hit){els.probeRow.value=String(hit.row);els.probeCol.value=String(hit.col);render();}
});
let resizeQueued=false;
addEventListener('resize',()=>{if(resizeQueued)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;if(model)render();});});
fillForm(BRICK_PRESETS.find(p=>p.id===DEFAULT_PRESET).values);
apply();
