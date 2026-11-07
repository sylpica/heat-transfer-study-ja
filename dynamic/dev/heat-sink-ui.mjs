import {Actor} from '../actor.mjs';import {Experiment} from '../experiment.mjs';import {drawTraces} from '../trace-plot.mjs';import {drawHeatSink} from './heat-sink-view.mjs';import {MATERIALS} from '../presets.mjs';import {windHandoffFromSearch,WIND_HANDOFF_CORRELATIONS,WIND_HANDOFF_GEOMETRIES} from './wind-heatsink-handoff.mjs';
const $=id=>document.getElementById(id);let fixedB=null,acceptedConfigs=[],scheduled=false;
const VIRTUAL={id:'virtual',name:'仮想の一定物性（実在合金の保証値ではない）',k:200,rho:2700,cp:900,limitation:'実在合金の物性保証ではありません。'};
const MATERIAL_CHOICES=[VIRTUAL,...MATERIALS];
const SHORT_NAMES={virtual:'仮想の一定物性',copper:'純銅',al6061:'アルミニウム6061-T6',iron:'純鉄'};
for(const m of MATERIAL_CHOICES){const o=document.createElement('option');o.value=m.id;o.textContent=SHORT_NAMES[m.id]||m.name;$('material').appendChild(o);}
const trim=x=>String(Number(x.toPrecision(10)));
function formNumbers(){const ids=['count','flen','fthick','bwidth','bdepth','bthick','h','power','contact','ambient','initial','cells'],out={};for(const id of ids){const raw=$(id).value;out[id]=raw===''?NaN:Number(raw);}return out;}
function derivedGapMm(v){return v.count>=1?(v.bwidth-v.count*v.fthick)/(v.count+1):null;}
function syncGapFromGeometry(){const v=formNumbers(),gap=derivedGapMm(v);$('gap').disabled=gap===null||!Number.isFinite(gap);if(gap!==null&&Number.isFinite(gap))$('gap').value=trim(gap);}
function syncWidthFromGap(){const v=formNumbers();if(v.count<1||!Number.isFinite(v.count))return;const gap=Number($('gap').value);if(!Number.isFinite(gap)||gap<0)return;$('bwidth').value=trim(v.count*v.fthick+(v.count+1)*gap);}
const experiment=new Experiment({actorFactory:options=>new Actor({...options,workerURL:new URL('./heat-sink-worker.mjs',import.meta.url)}),changed:({type,experiment:e})=>{
 if(type==='state')acceptedConfigs=structuredClone(e.configs);const status={initializing:'初期化中',ready:'準備完了',calculating:'計算中',advanced:'計算済み',rewound:'保存コマへ戻りました',error:'停止しました',paused:'一時停止'};if(status[type])$('status').textContent=status[type];if(type!=='progress'){render();return;}if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}
}});
function config(){
 const v=formNumbers();if(Object.values(v).some(x=>!Number.isFinite(x)))throw Error('入力範囲を確認してください。');
 if(!Number.isInteger(v.count)||v.count<0||v.count>64)throw Error('フィン本数は0〜64の整数です。');
 if(!(v.flen>=1&&v.flen<=500))throw Error('フィン長さは1〜500 mmです。');
 if(!(v.fthick>=0.1&&v.fthick<=50))throw Error('フィン厚さは0.1〜50 mmです。');
 if(!(v.bwidth>=5&&v.bwidth<=1000))throw Error('基部幅は5〜1000 mmです。');
 if(!(v.bdepth>=5&&v.bdepth<=1000))throw Error('基部奥行は5〜1000 mmです。');
 if(!(v.bthick>=0.5&&v.bthick<=100))throw Error('基部厚さは0.5〜100 mmです。');
 if(!(v.h>=0&&v.h<=1000))throw Error('指定hは0〜1000 W/(m² K)です。');
 if(!(v.power>=0&&v.power<=100))throw Error('基部発熱は0〜100 Wです。');
 if(!(v.contact>=0&&v.contact<=1))throw Error('接触熱抵抗は0〜1 m² K/Wです。');
 if(!(v.ambient>0))throw Error('周囲温度は0 Kより大きい絶対温度で指定してください。');
 if(!(v.initial>0))throw Error('初期温度は0 Kより大きい絶対温度で指定してください。');
 if(![8,16,32,64,128].includes(v.cells))throw Error('セル数は8・16・32・64・128のいずれかです。');
 const occupied=v.count*v.fthick;if(occupied>v.bwidth)throw Error(`フィン${v.count}本×厚さ${trim(v.fthick)} mm＝${trim(occupied)} mmが基部幅${trim(v.bwidth)} mmを超えます。幅・厚さ・本数のいずれかを変えてください。`);
 if(v.count>1&&occupied>=v.bwidth)throw Error('フィン同士の隙間が0以下になります。基部幅を広げるか、本数・厚さを減らしてください。');
 const material=MATERIAL_CHOICES.find(m=>m.id===$('material').value);if(!material)throw Error('材料を選んでください。');
 return {baseWidth:v.bwidth/1000,baseDepth:v.bdepth/1000,baseThickness:v.bthick/1000,finLength:v.flen/1000,finThickness:v.fthick/1000,finCount:v.count,finCells:v.cells,k:material.k,rho:material.rho,cp:material.cp,h:v.h,ambient:v.ambient,initialBase:v.initial,initialFin:v.initial,power:v.power,contactResistance:v.contact};
}
function updateSummary(){const v=formNumbers();if(Object.values(v).some(x=>!Number.isFinite(x)))return;const material=MATERIAL_CHOICES.find(m=>m.id===$('material').value);if(!material)return;const gap=derivedGapMm(v),gapText=v.count>=1&&gap!==null?`、フィン同士の隙間は均等に${trim(gap)} mm`:'';
 $('summary').textContent=`基部${trim(v.bwidth)}×${trim(v.bdepth)}×${trim(v.bthick)} mm、各フィン長さ${trim(v.flen)} mm・厚さ${trim(v.fthick)} mm・奥行${trim(v.bdepth)} mm（基部奥行と同じ）${gapText}。材料「${material.name}」の一定物性k=${material.k} W/(m K)、ρ=${material.rho} kg/m³、cp=${material.cp} J/(kg K)で計算します。${material.limitation}周囲温度${trim(v.ambient)} K、初期温度${trim(v.initial)} K。露出した基部上面とフィン側面だけが指定hで対流し、先端と基部の他面は断熱です。`;}
function timeParameters(){const duration=Number($('interval').value),dt=$('dt').value===''?undefined:Number($('dt').value);if(!Number.isFinite(duration)||duration<=0||duration>100||(dt!==undefined&&(!Number.isFinite(dt)||dt<=0)))throw Error('時間と刻みは正の範囲で指定してください。');return {duration,dt};}
async function initialize(){try{const a=config();await experiment.initialize({kind:'heat-sink',configs:fixedB?[a,fixedB]:[a]});}catch(e){experiment.invalidate(e);}}
function render(){
 $('error').hidden=!experiment.error;$('error').textContent=experiment.error?.message||'';$('progress').value=experiment.progress||0;const blocked=!experiment.ready||experiment.busy;for(const id of ['run','step','restart'])$(id).disabled=blocked;$('back').disabled=blocked||experiment.index===0;$('compare').disabled=blocked||!!fixedB;$('uncompare').disabled=experiment.busy||!fixedB;$('history').max=Math.max(0,experiment.history.length-1);$('history').value=experiment.index;$('history').disabled=blocked||experiment.history.length<2;
 if(!experiment.states.length)return;$('clock').textContent=experiment.states[0].time.toFixed(3)+' s';$('panel-b').hidden=experiment.states.length<2;const min=Math.min(...experiment.states.flatMap(s=>s.temperature)),max=Math.max(min+1,...experiment.states.flatMap(s=>s.temperature)),range=[min,max];$('legend').textContent=`A/B共通色スケール ${min.toFixed(4)}〜${max.toFixed(4)} K。基部1温度＋各フィンの同一1Dセル温度。`;
 const readings=[],diagnostics=[],point=Number($('probe').value);experiment.states.forEach((s,i)=>{
  const m=experiment.meshes[i],c=acceptedConfigs[i],label=i?'B':'A',letter=i?'b':'a';drawHeatSink($('field-'+letter),s,m,{range,yaw:Number($('yaw').value)*Math.PI/180,pitch:Number($('pitch').value)*Math.PI/180,zoom:Number($('zoom').value)});
  $('caption-'+letter).textContent=`${label}：${s.finCount}本、h=${c.h} W/(m² K)、発熱${c.power} W、t=${s.time.toFixed(3)} s。${experiment.ready?'受理した状態':'前回状態（変更条件は未適用）'}`;
  const n=Math.min(m.finCells-1,Math.floor(point*m.finCells)),fin=s.finCount>0?`x=${(point*m.finLength*1000).toFixed(3)} mmの所属セル：${s.finTemperature[n].toFixed(7)} K`:'フィンなし（測定対象なし）';readings.push(`${label}: 基部=${s.baseTemperature.toFixed(7)} K\n${fin}`);
  const f=x=>x.toExponential(7);diagnostics.push(`${label}\n基部→各フィン=${f(s.baseToFinPerFinW)} W、全フィンへ=${f(s.baseToAllFinsW)} W\n基部上面の対流放熱=${f(s.baseConvectionOutwardW)} W\n側面放熱：1本=${f(s.finSideConvectionOutwardPerFinW)} W、全体=${f(s.finTotalConvectionOutwardW)} W\n蓄熱速度：基部=${f(s.baseStoragePowerW)} W、フィン1本=${f(s.finStoragePowerPerFinW)} W\n外部正味入力=${f(s.netExternalPowerW)} W、指定発熱=${f(s.sourcePowerW)} W\n顕熱=${f(s.energy)} J、累積入力=${f(s.netInput)} J\n全体の収支差=${f(s.energyError)} J、丸め誤差予算=${f(s.energyRoundoffBudgetJ)} J\n露出基部面積=${f(m.baseExposedArea)} m²、フィン断面=${f(m.finCrossSection)} m²${s.finCount>0?`、均等なフィン間隔=${trim(m.uniformGap*1000)} mm`:''}\n時刻=${s.time} s、steps=${s.steps}、dt=${s.lastDt} s、safeDt=${s.safeDt} s\n仮定：基部一様、同一フィン1D、指定h、先端/基部他面断熱。3D解析・実ヒートシンク性能の承認ではない。`);
 });$('readout').textContent=readings.join('\n\n');$('diagnostic-values').textContent=diagnostics.join('\n\n');drawTraces($('graph'),experiment.states.map((s,i)=>({points:experiment.history.map(frame=>({x:frame[i].time,y:frame[i].baseTemperature-273.15}))})),experiment.states[0].time,{yLabel:'基部温度 [℃]'});
}
const SETTING_IDS=['count','flen','fthick','gap','bwidth','bdepth','bthick','material','h','power','contact','ambient','initial','cells'];
$('settings').onsubmit=e=>{e.preventDefault();initialize();};for(const id of SETTING_IDS)$(id).onchange=()=>{experiment.invalidate();render();updateSummary();$('status').textContent='条件を変更しました。初期状態から計算してください。';};
for(const id of ['count','flen','fthick','bwidth','bdepth','bthick'])$(id).addEventListener('input',()=>{syncGapFromGeometry();updateSummary();});
$('gap').addEventListener('input',()=>{syncWidthFromGap();updateSummary();});
for(const id of ['material','ambient','initial'])$(id).addEventListener('input',updateSummary);
for(const id of ['interval','dt'])$(id).onchange=()=>experiment.pause();
$('step').onclick=async()=>{try{await experiment.advance(timeParameters());}catch(e){experiment.fail(e);}};$('run').onclick=()=>experiment.play(timeParameters);$('pause').onclick=()=>experiment.pause();$('back').onclick=()=>experiment.rewind(experiment.index-1);$('restart').onclick=()=>experiment.restart();$('history').oninput=()=>experiment.rewind(Number($('history').value));$('compare').onclick=()=>{fixedB=structuredClone(experiment.configs[0]);initialize();};$('uncompare').onclick=()=>{fixedB=null;initialize();};
for(const id of ['yaw','pitch','zoom','probe'])$(id).oninput=render;window.addEventListener('resize',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}});matchMedia('(prefers-color-scheme: dark)').addEventListener('change',render);window.addEventListener('pagehide',()=>experiment.close());
// Wind-estimation handoff: an allowlisted URL query carries the estimated
// h and its computation conditions.  The h is applied through the ordinary
// prescribed-h field, and the note under the form keeps the provenance
// visible across reloads until the user edits h by hand.
let windHandoff=null,windHandoffError=null;
try{windHandoff=windHandoffFromSearch(location.search);}catch(error){windHandoffError=error;}
if(windHandoff)$('h').value=String(windHandoff.h);
function syncWindNote(){
 const note=$('wind-h-note');
 if(windHandoffError){note.textContent=`風速推定からの受け渡し条件を読み取れませんでした（${windHandoffError.message}）既定の条件で開いています。`;note.hidden=false;return;}
 if(!windHandoff){note.hidden=true;note.textContent='';return;}
 const conditions=`相関：${WIND_HANDOFF_CORRELATIONS[windHandoff.correlation]}、形状：${WIND_HANDOFF_GEOMETRIES[windHandoff.geometry]}、主流速度 ${trim(windHandoff.velocity)} m/s、代表長さ ${trim(windHandoff.characteristicLength)} m、Re=${trim(windHandoff.reynolds)}、Pr=${trim(windHandoff.prandtl)}、Nu=${trim(windHandoff.nusselt)}、膜温度 ${trim(windHandoff.filmTemperatureK)} K`;
 if(Number($('h').value)===windHandoff.h)note.textContent=`風速から推定した h を使用中：h = ${trim(windHandoff.h)} W/(m² K)。${conditions}。`;
 else note.textContent=`指定hが手入力で変更されたため、風速推定の受け渡しは解除されました（受け渡された値：h = ${trim(windHandoff.h)} W/(m² K)。${conditions}）。`;
 note.hidden=false;
}
$('h').addEventListener('input',syncWindNote);$('h').addEventListener('change',syncWindNote);syncWindNote();
syncGapFromGeometry();updateSummary();initialize();
