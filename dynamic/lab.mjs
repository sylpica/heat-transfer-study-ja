import {surfaceExchangeReport} from './surface-exchange-report.mjs';
import {thermalLaunchFromSearch} from '../dynamic-navigation.mjs';
import {attachLearningJourney} from './learning-ui.mjs';
import {fieldFrame} from './field-frame.mjs';
import {temperatureContours} from './field-analysis.mjs';
import {renderCrossSections} from './field-plots.mjs';
import {Experiment} from './experiment.mjs';
import {startBoilingPanel} from './boiling.mjs';
import {drawFin} from './fin-view.mjs';
import {attachTermPanel} from './term-panel.mjs';
import {MODEL_MANUALS} from './model-manuals.mjs';
import {MODEL_TUTORIALS} from './model-tutorials.mjs';
import {initLabGuide} from './lab-guide.mjs';
import {linkTermTextNodes} from '../term-links.mjs';
import {MATERIALS,preset} from './presets.mjs';
import {rectangle,circle,transformPolygon} from './geometry.mjs';
const $=id=>document.getElementById(id),number=id=>{const input=$(id);if(!input.value.trim())throw Error(`${input.labels?.[0]?.textContent||id}を入力してください。`);const n=Number(input.value);if(!Number.isFinite(n))throw Error('有限の数値を入力してください。');return n;},fmt=(v,n=3)=>Number.isFinite(v)?v.toFixed(n):'—';
const boiling=startBoilingPanel($('boiling-panel'));
let selection='heating',configA,configB=null,stateA,stateB,meshA,meshB,fluxA,fluxB,history=[],historyIndex=0,probe={x:.5,y:.5},drawPoints=[],initialScale=[20,60],graphIndex=0;
let learning;
const experiment=new Experiment({changed:({type,experiment:e})=>{readyControls();$('progress').value=e.progress||0;$('error').hidden=!e.error;if(e.error)$('error').textContent=e.error.message;
 if(type==='state'){[configA,configB]=e.configs;configB??=null;[stateA,stateB]=e.states;[meshA,meshB]=e.meshes;[fluxA,fluxB]=e.fluxes;history=e.history.map(states=>({a:states[0],b:states[1]}));historyIndex=e.index;graphIndex=e.index;render();}
 if(type==='ready'){initialScale=[Math.min(stateA.min,stateB?.min??Infinity)-273.15,Math.max(stateA.max,stateB?.max??-Infinity,configA.boundaries.left.temperature??0)-273.15];if(initialScale[1]-initialScale[0]<1)initialScale[1]=initialScale[0]+1;$('model-label').textContent=selection==='fin'?'1D非定常フィン・一定h・'+propertyLabel(configA)+'・CPU':'2D熱伝導・'+propertyLabel(configA)+'・ρ一定・CPU';render();}
 learning?.event(type);
 const labels={initializing:'実験を準備しています。',ready:'準備完了。再生すると数値計算が進みます。',advanced:'計算済みの状態を表示中。巻き戻しは保存状態の再生です。',paused:'一時停止',calculating:'数値計算中。',rewinding:'保存した状態を読み出しています。',rewound:'保存した状態を表示中。',error:'計算停止。表示中は最後の有効な状態です。'};if(labels[type])$('status').textContent=labels[type];
}});
const media=matchMedia('(prefers-color-scheme:dark)');
function theme(){document.body.dataset.theme=$('theme').value;render();}media.addEventListener('change',theme);$('theme').onchange=theme;
function error(e){experiment.fail(e);}
function clearError(){experiment.error=null;$('error').hidden=true;}
function materialInputs(){$('use-k-table').checked=$('use-cp-table').checked=false;const m=MATERIALS[+$('material').value];for(const key of ['k','rho','cp'])$(key).value=m[key];$('property-source').textContent=m.source+'。'+m.limitation;}
for(const id of ['material','material2'])MATERIALS.forEach((m,i)=>{const option=document.createElement('option');option.value=i;option.textContent=m.name;$(id).append(option);});$('material').value='1';$('material2').value='2';$('boundary').addEventListener('change',()=>{$('radiation-temperature-label').hidden=$('boundary').value!=='convection-radiation';});$('material').onchange=materialInputs;for(const key of ['k','rho','cp'])$(key).oninput=()=>{$('property-source').textContent='手動指定の一定物性です。出典・単位・温度範囲を確認してください。';};
function propertyLabel(c){return [c.materials.some(m=>m.kTable)?'k(T)':'',c.materials.some(m=>m.cpTable)?'cp(T)':''].filter(Boolean).join('・')||'一定物性';}
function readConfig(){
 const nx=number('nx');if(!Number.isInteger(nx)||nx<4||nx>96)throw Error('横方向セル数は4〜96の整数です。');
 const c=preset(selection,nx);Object.assign(c,{width:number('width'),height:number('height'),depth:number('depth'),initial:number('initial')+273.15,materials:[{k:number('k'),rho:number('rho'),cp:number('cp')}],source:number('source'),contactResistance:number('contact')});
 if($('use-k-table').checked){const text=$('k-table').value.trim();if(!text)throw Error('出典を確認したk(T)表を入力してください。');c.materials[0].kTable=text.split(/\n/).map(line=>line.split(',').map(v=>v.trim()?Number(v):NaN));$('property-source').textContent='手動指定のk(T)を線形補間。表の範囲外では停止します。';}
 if($('use-cp-table').checked){const text=$('cp-table').value.trim();if(!text)throw Error('出典を確認したcp(T)表を入力してください。');c.materials[0].cpTable=text.split(/\n/).map(line=>line.split(',').map(v=>v.trim()?Number(v):NaN));$('property-source').textContent='手動指定のcp(T)を積分してエンタルピーで更新。密度は一定です。表の範囲外では停止します。';}
 if(selection!=='fin'){const ny=number('ny');if(!Number.isInteger(ny)||ny<0||ny>96)throw Error('縦方向セル数は0〜96の整数です。');c.ny=ny||Math.max(1,Math.min(96,Math.round(c.nx*c.height/c.width)));}
 const shape=$('shape').value;if(selection==='fin'&&shape!=='rectangle')throw Error('1Dフィンは一定断面です。自由形状には「板を加熱」等を選んでください。');
 if(shape==='circle')c.outline=circle(c.width/2,c.height/2,Math.min(c.width,c.height)*.45);
 if(shape==='free'){if($('vertices').value.trim()){drawPoints=$('vertices').value.trim().split(';').map(part=>part.trim().split(',').map(v=>v.trim()?Number(v):NaN));if(drawPoints.some(p=>p.length!==2||p.some(x=>!Number.isFinite(x))))throw Error('輪郭はx,yをセミコロンで区切って指定してください。');}if(drawPoints.length<3)throw Error('輪郭を3点以上描いてください。');c.outline=drawPoints.map(p=>[p[0]*c.width,p[1]*c.height]);}
 const angle=number('rotation')*Math.PI/180,scale=number('geom-scale'),offsetX=number('offset-x')*c.width,offsetY=number('offset-y')*c.height;if(selection==='fin'&&(angle!==0||scale!==1||offsetX||offsetY))throw Error('現在の1Dフィンは直線形状です。回転は立体表示の操作を使ってください。');if(c.outline||angle||scale!==1||offsetX||offsetY)c.outline=transformPolygon(c.outline||rectangle(0,0,c.width,c.height),{angle,scale,offsetX,offsetY,center:[c.width/2,c.height/2]});
 c.boundaries.left={type:$('boundary').value,temperature:number('boundary-temperature')+273.15,h:number('h'),emissivity:number('emissivity'),flux:number('heat-flux')};
 if(c.boundaries.left.type==='convection-radiation'){if(selection==='fin')throw Error('同時境界は板を選んでください。フィン側面の対流・放射連成は検証待ちです。');c.boundaries.left.radiationTemperature=number('radiation-temperature')+273.15;}
 if(c.outline){c.edge={...c.boundaries.left};for(const side of ['right','top','bottom'])c.boundaries[side]={...c.boundaries.left};}
 if(selection==='cooling'||selection==='radiation')for(const side of ['right','top','bottom'])c.boundaries[side]={...c.boundaries.left};
 if(selection==='fin'){c.distributedConvection={h:number('h'),areaPerVolume:2*(c.height+c.depth)/(c.height*c.depth),temperature:number('fin-ambient')+273.15};if($('fin-ambient-step-time').value.trim())c.distributedConvection.temperatureSchedule=[{at:number('fin-ambient-step-time'),temperature:number('fin-ambient-step-temperature')+273.15}];}
 c.regions=[];
 if($('composite').checked){c.materials.push({...MATERIALS[+$('material2').value]});c.regions.push({points:rectangle(c.width/2,0,c.width/2,c.height),material:1});}
 if($('local-source').checked){const x=number('source-x'),y=number('source-y');if(x<.1||x>.9||y<.1||y>.9)throw Error('熱源中心は各寸法の0.1〜0.9倍です。');c.regions.push({points:rectangle((x-.1)*c.width,(y-.1)*c.height,.2*c.width,.2*c.height),source:number('source-value')});}
 if(selection==='fin'&&(c.regions.length||c.contactResistance>0))throw Error('現在の1Dフィン検証は単一材料です。複合材料には2D板を選んでください。');c.modelLabel=selection==='fin'?'1Dフィン・側面h一定':'2D伝導・'+propertyLabel(c);return c;
}
function readyControls(){for(const id of ['play','step','back','stop','timeline','compare'])$(id).disabled=!experiment.ready||experiment.busy;}
function pause(){experiment.pause();}
async function initialize(){try{const next=readConfig();return await experiment.initialize({kind:'thermal',configs:configB?[next,configB]:[next]});}catch(error){experiment.invalidate(error);return false;}}
function parameters(){bounds();const duration=number('interval')*number('speed'),dt=$('dt').value.trim()?number('dt'):undefined;if(duration<=0||duration>1000)throw Error('1コマの時間と倍率を見直してください。');return {duration,dt};}
async function frame(){try{return await experiment.advance(parameters());}catch(e){error(e);return false;}}
function rewind(index){return experiment.rewind(index);}
function sample(state,mesh){if(!state||!mesh)return null;const i=Math.min(mesh.nx-1,Math.floor(probe.x*mesh.nx)),j=Math.min(mesh.ny-1,Math.floor(probe.y*mesh.ny)),n=j*mesh.nx+i;return mesh.mask[n]?state.temperature[n]-273.15:null;}
function bounds(){let lo,hi;if($('scale').value==='manual'){lo=number('scale-min');hi=number('scale-max');if(!(hi>lo))throw Error('色の上限は下限より大きくしてください。');}else if($('scale').value==='fixed')[lo,hi]=initialScale;else{lo=Math.min(stateA.min,stateB?.min??Infinity)-273.15;hi=Math.max(stateA.max,stateB?.max??-Infinity)-273.15;if(hi-lo<1)hi=lo+1;}return [lo,hi];}
function draw(canvas,state,mesh,flux,range,vectorScale){if(!state||!mesh)return;const {ctx,px,py}=fieldFrame(canvas,state,mesh,range,{grid:$('show-grid').checked}),X=x=>px(x*mesh.width),Y=y=>py(y*mesh.height);
 if($('show-contours').checked){const levels=[.25,.5,.75].map(f=>273.15+range[0]+f*(range[1]-range[0])),lines=temperatureContours(mesh,state.temperature,levels);ctx.beginPath();for(const line of lines){ctx.moveTo(X(line.from[0]/mesh.width),Y(line.from[1]/mesh.height));ctx.lineTo(X(line.to[0]/mesh.width),Y(line.to[1]/mesh.height));}ctx.strokeStyle='#142c34';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}
 if(flux){const scale=vectorScale||1,stride=Math.max(1,Math.floor(mesh.nx/12));ctx.strokeStyle='#fff';ctx.lineWidth=2;for(let j=0;j<mesh.ny;j+=stride)for(let i=0;i<mesh.nx;i+=stride){const n=j*mesh.nx+i;if(!mesh.mask[n])continue;const x=X((i+.5)/mesh.nx),y=Y((j+.5)/mesh.ny),vx=flux.x[n]/scale*25,vy=-flux.y[n]/scale*25;if(Math.hypot(vx,vy)<.1)continue;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+vx,y+vy);const a=Math.atan2(vy,vx);ctx.moveTo(x+vx-6*Math.cos(a-.5),y+vy-6*Math.sin(a-.5));ctx.lineTo(x+vx,y+vy);ctx.lineTo(x+vx-6*Math.cos(a+.5),y+vy-6*Math.sin(a+.5));ctx.strokeStyle='#12313b';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}}
 ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(X(probe.x)-9,Y(probe.y));ctx.lineTo(X(probe.x)+9,Y(probe.y));ctx.moveTo(X(probe.x),Y(probe.y)-9);ctx.lineTo(X(probe.x),Y(probe.y)+9);ctx.stroke();
 if(canvas.id==='field-a'&&drawPoints.length){ctx.strokeStyle='#fff';ctx.setLineDash([5,4]);ctx.beginPath();drawPoints.forEach(([x,y],i)=>i?ctx.lineTo(X(x),Y(y)):ctx.moveTo(X(x),Y(y)));ctx.closePath();ctx.stroke();ctx.setLineDash([]);}
}
function graph(){const canvas=$('graph'),ratio=devicePixelRatio||1,rect=canvas.getBoundingClientRect();canvas.width=Math.max(280,Math.round(rect.width*ratio));canvas.height=Math.round(200*ratio);const ctx=canvas.getContext('2d'),W=canvas.width/ratio,H=200;ctx.setTransform(ratio,0,0,ratio,0,0);const dark=getComputedStyle(document.body).getPropertyValue('--fg');ctx.clearRect(0,0,W,H);ctx.fillStyle=dark;ctx.strokeStyle=dark;ctx.font='16px system-ui';ctx.fillText('温度 [℃]',8,20);
 const samples=history.map(p=>sample(p.a,meshA)),samplesB=history.map(p=>sample(p.b,meshB)),values=[...samples,...samplesB].filter(v=>v!==null);if(!values.length)return;const lo=Math.min(...values),hi=Math.max(...values,lo+1),end=history.at(-1)?.a.time||1,start=history[0]?.a.time||0,span=Math.max(1e-12,end-start),X=t=>55+(W-80)*(t-start)/span,Y=t=>H-40-(H-70)*(t-lo)/(hi-lo);
 ctx.beginPath();ctx.moveTo(55,30);ctx.lineTo(55,H-40);ctx.lineTo(W-20,H-40);ctx.stroke();ctx.fillText(fmt(lo,1),3,H-35);ctx.fillText(fmt(hi,1),3,38);ctx.fillText(fmt(start,1),55,H-20);ctx.textAlign='right';ctx.fillText(fmt(end,1),W-20,H-20);ctx.fillText('物理時間 [s]',W-20,H-3);ctx.textAlign='left';
 for(const [data,color] of [[samples,'#006ed5'],[samplesB,'#e85b10']]){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();let open=false;data.forEach((v,i)=>{if(v===null){open=false;return;}open?ctx.lineTo(X(history[i].a.time),Y(v)):ctx.moveTo(X(history[i].a.time),Y(v));open=true;});ctx.stroke();}
 graphIndex=Math.min(graphIndex,history.length-1);const entry=history[graphIndex];$('graph-value').textContent=entry?`t=${fmt(entry.a.time)} s　A ${fmt(samples[graphIndex])} ℃${stateB?'　B '+fmt(samplesB[graphIndex])+' ℃':''}（各セルの平均温度）`:'';
}
function sectionGraph(){if($('section-view').open&&stateA)renderCrossSections({canvas:$('section-graph'),table:$('section-table'),caption:$('section-value'),axis:$('section-axis').value,probe,series:[{label:'A',state:stateA,mesh:meshA},{label:'B',state:stateB,mesh:meshB}]});}
function render(){if(!stateA)return;try{const range=bounds();$('contour-legend').textContent=$('show-contours').checked?'等温線 '+[.25,.5,.75].map(f=>fmt(range[0]+f*(range[1]-range[0]),2)+' ℃').join(' / ')+'。セル中心間の区分線形補間。物体外・一様場・1D領域には線を描きません。':'';$('fin-3d').hidden=selection!=='fin';if(selection==='fin')drawFin($('fin-canvas'),stateA.temperature,{width:meshA.width,height:meshA.height,depth:meshA.depth},{yaw:number('yaw')*Math.PI/180,pitch:number('pitch')*Math.PI/180,zoom:number('zoom'),range,baseTemperature:configA.boundaries?.left?.type==='temperature'?configA.boundaries.left.temperature:undefined});const maximum=flux=>flux?flux.x.reduce((m,x,i)=>Math.max(m,Math.hypot(x,flux.y[i])),0):0,vectorScale=Math.max(maximum(fluxA),maximum(fluxB));draw($('field-a'),stateA,meshA,fluxA,range,vectorScale);draw($('field-b'),stateB,meshB,fluxB,range,vectorScale);$('vector-legend').textContent=fluxA?'熱流束の矢印：共通の基準 '+(vectorScale>0&&(vectorScale<.001||vectorScale>1e5)?vectorScale.toExponential(3):fmt(vectorScale))+' W/m²（相対長さ）':'';$('caption-a').textContent='実験A：'+(configA.modelLabel||'熱伝導')+'・t='+fmt(stateA.time)+' s';if(configB)$('caption-b').textContent='比較B：'+(configB.modelLabel||'熱伝導')+'・t='+fmt(stateB.time)+' s';$('comparison').hidden=!stateB;$('uncompare').hidden=!configB;$('low').textContent=fmt(range[0],1)+' ℃';$('high').textContent=fmt(range[1],1)+' ℃';$('clock').textContent=fmt(stateA.time)+' s';$('timeline').max=history.length-1;$('timeline').value=historyIndex;
 $('readout').textContent=`測定点 x=${fmt(probe.x*meshA.width,4)} m、y=${fmt(probe.y*meshA.height,4)} m　A ${fmt(sample(stateA,meshA))} ℃${stateB?' ／B '+fmt(sample(stateB,meshB))+' ℃（x='+fmt(probe.x*meshB.width,4)+' m、y='+fmt(probe.y*meshB.height,4)+' m）':''}　最小/最大 ${fmt(stateA.min-273.15,1)} / ${fmt(stateA.max-273.15,1)} ℃`;
 $('diagnostic-values').textContent=`格子 ${meshA.nx} × ${meshA.ny}（有効 ${meshA.count}セル）\n${propertyLabel(configA)}（ρ一定、cp(T)はエンタルピー更新）・直交格子FVM・前進Euler\n時間刻み ${fmt(stateA.lastDt,7)} s\n安定上限 ${stateA.safeDt===null?'制限なし（熱伝導等の結合なし）':fmt(stateA.safeDt,7)+' s'}\n内部更新 ${stateA.steps}回\n顕熱（基準：${stateA.energyReference}） ${fmt(stateA.energy,6)} J\n累積の流入熱 ${fmt(stateA.netInput,6)} J\nエネルギー収支誤差 ${stateA.energyError.toExponential(3)} J\n無次元収支誤差 ${stateA.relativeEnergyError.toExponential(3)}\n輪郭面積 ${fmt(meshA.geometricArea,7)} m²\n格子面積 ${fmt(meshA.area,7)} m²\n形状面積誤差 ${fmt(100*(meshA.area-meshA.geometricArea)/meshA.geometricArea,2)} %\nGPU/流体CFD：未実装\n${meshA.repaired.join('\n')}`;const exchange=surfaceExchangeReport(stateB?[stateA,stateB]:[stateA],meshB?[meshA,meshB]:[meshA]);$('surface-exchange-panel').hidden=!exchange;$('surface-exchange-values').textContent=exchange;graph();sectionGraph();}catch(e){error(e);}}
$('conditions').onsubmit=e=>{e.preventDefault();initialize();};$('play').onclick=()=>experiment.play(parameters);$('pause').onclick=pause;$('step').onclick=()=>{pause();frame();};$('back').onclick=()=>rewind(Math.max(0,historyIndex-1));$('stop').onclick=()=>experiment.restart();$('reset').onclick=initialize;$('timeline').oninput=()=>rewind(+$('timeline').value);
$('compare').onclick=()=>{if(configA){configB=structuredClone(configA);initialize();}};$('uncompare').onclick=()=>{configB=null;initialize();};for(const id of ['scale','scale-min','scale-max'])$(id).onchange=render;
$('mode').onchange=()=>{document.body.dataset.mode=$('mode').value;};$('mode').onchange();$('manual-toggle').onclick=()=>{const open=$('manual').hidden;$('manual').hidden=!open;$('manual-toggle').setAttribute('aria-expanded',String(open));};$('clear-shape').onclick=()=>{drawPoints=[];$('vertices').value='';$('shape-info').textContent='輪郭を消去しました。';render();};
function canvasPosition(event,canvas){const r=canvas.getBoundingClientRect(),style=getComputedStyle(canvas),left=parseFloat(style.borderLeftWidth)||0,right=parseFloat(style.borderRightWidth)||0,top=parseFloat(style.borderTopWidth)||0,bottom=parseFloat(style.borderBottomWidth)||0;return {x:(event.clientX-r.left-left)/(r.width-left-right)*canvas.width,y:(event.clientY-r.top-top)/(r.height-top-bottom)*canvas.height};}
function position(event,canvas){const raw=canvasPosition(event,canvas),p=canvas.dataset.plot?JSON.parse(canvas.dataset.plot):{left:0,top:0,width:canvas.width,height:canvas.height};return [Math.max(0,Math.min(.9999,(raw.x-p.left)/p.width)),Math.max(0,Math.min(.9999,1-(raw.y-p.top)/p.height))];}
let dragging=false;
function point(event){const [x,y]=position(event,$('field-a'));if($('tool').value==='draw'){const last=drawPoints.at(-1);if(!last||Math.hypot(x-last[0],y-last[1])>.025)drawPoints.push([x,y]);$('shape').value='free';$('shape-info').textContent=`${drawPoints.length}点。適用すると始点と終点を結んで閉じます。`;}else if($('tool').value==='source'){$('source-x').value=Math.max(.1,Math.min(.9,x)).toFixed(2);$('source-y').value=Math.max(.1,Math.min(.9,y)).toFixed(2);$('local-source').checked=true;$('status').textContent='熱源位置を変更しました。「条件を適用」で再計算します。';}else{probe={x,y};learning?.probeMoved(probe);}render();}
$('field-a').onpointerdown=e=>{dragging=true;$('field-a').setPointerCapture(e.pointerId);if($('tool').value==='draw')drawPoints=[];point(e);};$('field-a').onpointermove=e=>{if(dragging)point(e);};$('field-a').onpointerup=()=>{dragging=false;if($('tool').value==='draw')$('vertices').value=drawPoints.map(p=>p.map(v=>v.toFixed(4)).join(',')).join(';');};$('field-a').onpointercancel=()=>{dragging=false;};
$('field-a').onkeydown=e=>{const moves={ArrowLeft:[-.02,0],ArrowRight:[.02,0],ArrowUp:[0,.02],ArrowDown:[0,-.02]};if(moves[e.key]){e.preventDefault();const [x,y]=moves[e.key];probe.x=Math.max(0,Math.min(.9999,probe.x+x));probe.y=Math.max(0,Math.min(.9999,probe.y+y));learning?.probeMoved(probe);render();}};
$('graph').onclick=e=>{const raw=canvasPosition(e,$('graph')),ratio=devicePixelRatio||1,W=$('graph').width/ratio,fraction=Math.max(0,Math.min(1,(raw.x/ratio-55)/(W-80))),target=(history[0]?.a.time||0)+fraction*((history.at(-1)?.a.time||0)-(history[0]?.a.time||0));const index=history.reduce((best,h,i)=>Math.abs(h.a.time-target)<Math.abs(history[best].a.time-target)?i:best,0);rewind(index);};$('graph').onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();rewind(Math.max(0,Math.min(history.length-1,graphIndex+(e.key==='ArrowLeft'?-1:1))));}};
for(const button of document.querySelectorAll('[data-preset]'))button.onclick=()=>loadPreset(button.dataset.preset);
function loadPreset(id,learningNx,launch=null){$('launch-context').hidden=true;boiling.stop();$('boiling-panel').hidden=true;$('thermal-layout').hidden=false;$('boiling-select').setAttribute('aria-pressed','false');selection=id;drawPoints=[];$('vertices').value='';for(const [key,value] of Object.entries({rotation:0,'geom-scale':1,'offset-x':0,'offset-y':0,ny:0}))$(key).value=value;const c=preset(id,learningNx||(matchMedia('(max-width:600px)').matches?16:24)),left=c.boundaries.left;for(const [key,value] of Object.entries({width:c.width,height:c.height,depth:c.depth,initial:c.initial-273.15,'boundary-temperature':left.temperature-273.15,boundary:left.type,source:0,h:c.distributedConvection?.h??left.h??80,'fin-ambient':(c.distributedConvection?.temperature??293.15)-273.15,contact:0,nx:c.nx,shape:'rectangle'}))$(key).value=value;$('fin-ambient-step-time').value='';$('fin-ambient-step-temperature').value='';$('composite').checked=$('local-source').checked=false;$('tool').value='probe';$('dt').value='';document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===id)));materialInputs();if(launch?.fields){for(const [key,value]of Object.entries(launch.fields))$(key).value=value;$('property-source').textContent='物性値の出典と仮定は上の補足条件に書かれています。';}if(launch){$('launch-description').textContent=launch.description;$('launch-context').hidden=false;}$('radiation-temperature-label').hidden=$('boundary').value!=='convection-radiation';$('related-lesson').href='../index.html#reader/'+(launch?.sectionId||(id==='fin'?'4.5':id==='radiation'?'10.1':'5.3'));$('launch-lesson').href=$('related-lesson').href;$('launch-lesson').hidden=!launch;return initialize();}
if('serviceWorker' in navigator)navigator.serviceWorker.register('../sw.js').catch(()=>{$('status').textContent='オフラインの準備に失敗しました。接続中の計算は利用できます。';});
let receivedLaunch,launchError;try{receivedLaunch=thermalLaunchFromSearch(location.search);}catch(error){launchError=error;}
loadPreset(receivedLaunch?.preset||'heating',receivedLaunch?.caseId?48:undefined,receivedLaunch);if(launchError){$('launch-description').textContent=launchError.message;$('launch-context').hidden=false;}

// §21 model manuals: docs/dynamic/*.md are the source of truth and
// dynamic/model-manuals.mjs is generated from them by
// scripts/generate-model-manuals.mjs. Only the selected model is rendered,
// each of its 16 items behind a closed <details>, so opening the manual
// never pushes the workspace down.
const manualSelect=$('manual-model'),manualBox=$('model-manual');
const appendManualInline=(parent,text)=>{
  let last=0;
  for(const m of text.matchAll(/\*\*([^*]+)\*\*|`([^`]+)`/g)){
    if(m.index>last)parent.append(document.createTextNode(text.slice(last,m.index)));
    const el=document.createElement(m[1]!==undefined?'strong':'code');
    el.textContent=m[1]??m[2];parent.append(el);last=m.index+m[0].length;
  }
  if(last<text.length)parent.append(document.createTextNode(text.slice(last)));
};
const renderManualList=block=>{
  const list=document.createElement(block.t);
  for(const item of block.items){
    const li=document.createElement('li');
    appendManualInline(li,item.x);
    if(item.sub)li.append(renderManualList(item.sub));
    list.append(li);
  }
  return list;
};
const renderManualBlocks=(parent,blocks)=>{
  for(const block of blocks){
    if(block.t==='p'){const p=document.createElement('p');appendManualInline(p,block.x);parent.append(p);}
    else if(block.t==='h'){const h=document.createElement('h4');appendManualInline(h,block.x);parent.append(h);}
    else if(block.t==='ul'||block.t==='ol')parent.append(renderManualList(block));
    else if(block.t==='table'){
      const wrap=document.createElement('div');wrap.className='field-table';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','表');
      const table=document.createElement('table'),thead=document.createElement('thead'),headRow=document.createElement('tr');
      for(const cell of block.head){const th=document.createElement('th');appendManualInline(th,cell);headRow.append(th);}
      thead.append(headRow);table.append(thead);
      const tbody=document.createElement('tbody');
      for(const row of block.rows){const tr=document.createElement('tr');for(const cell of row){const td=document.createElement('td');appendManualInline(td,cell);tr.append(td);}tbody.append(tr);}
      table.append(tbody);wrap.append(table);parent.append(wrap);
    }
  }
};
let manualTerms=null;
const renderModelManual=()=>{
  const manual=MODEL_MANUALS.find(m=>m.id===manualSelect.value)||MODEL_MANUALS[0];
  manualBox.replaceChildren();
  const screenLine=document.createElement('p');screenLine.className='hint';
  if(manual.screen){
    screenLine.append(document.createTextNode('対象画面：'));
    if(manual.screen.href){const a=document.createElement('a');a.href=manual.screen.href;a.textContent=manual.screen.label;screenLine.append(a);}
    else screenLine.append(document.createTextNode(manual.screen.label));
  }else screenLine.textContent='対象画面：開発専用（公開ビルドには含まれません）';
  manualBox.append(screenLine);
  for(const lead of manual.lead){
    const p=document.createElement('p'),strong=document.createElement('strong');
    strong.textContent=`${lead.label}：`;p.append(strong);appendManualInline(p,lead.x);manualBox.append(p);
  }
  const tutorial=MODEL_TUTORIALS.find(t=>t.id===manual.id);
  if(tutorial){
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent='手順案内（チュートリアル）';details.append(summary);
    const body=document.createElement('div');
    renderManualBlocks(body,[
      {t:'h',x:'1. まず触る'},{t:'ul',items:tutorial.touch.map(x=>({x}))},
      {t:'h',x:'2. 観察する'},{t:'ul',items:tutorial.observe.map(x=>({x}))},
      {t:'h',x:'3. 確認する'},{t:'ul',items:tutorial.check.map(x=>({x}))},
    ]);
    details.append(body);manualBox.append(details);
  }
  for(const item of manual.items){
    const details=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent=`${item.n}. ${item.title}`;details.append(summary);
    const body=document.createElement('div');renderManualBlocks(body,item.blocks);details.append(body);manualBox.append(details);
  }
  const sourceLine=document.createElement('p');sourceLine.className='hint';
  sourceLine.append(document.createTextNode('正本：'));
  const code=document.createElement('code');code.textContent=manual.source;sourceLine.append(code);manualBox.append(sourceLine);
  if(manualTerms)linkTermTextNodes(manualBox,manualTerms,{limit:2});
};
for(const manual of MODEL_MANUALS){const option=document.createElement('option');option.value=manual.id;option.textContent=manual.name;manualSelect.append(option);}
manualSelect.addEventListener('change',renderModelManual);
renderModelManual();
fetch('../data/glossary.json').then(r=>r.ok?r.json():null).then(data=>{if(Array.isArray(data)){manualTerms=data;linkTermTextNodes(manualBox,manualTerms,{limit:2});}}).catch(()=>{});
attachTermPanel({root:$('manual'),additionalRoots:[$('learning-result')],dialog:$('term-dialog'),title:$('term-title'),body:$('term-body'),close:$('term-close')});
initLabGuide();

for(const id of ['yaw','pitch','zoom'])$(id).oninput=render;

$('boiling-select').onclick=()=>{pause();learning?.event('left-thermal');clearError();$('thermal-layout').hidden=true;$('boiling-panel').hidden=false;$('model-label').textContent='模式アニメーション（数値解析ではありません）';$('status').textContent='気泡の数・大きさ・速度は計算値ではありません。';$('boiling-select').setAttribute('aria-pressed','true');document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));};

window.addEventListener('resize',render);

for(const id of ['show-grid','show-contours','section-axis'])$(id).onchange=render;$('section-view').ontoggle=render;

learning=attachLearningJourney({root:$('learning'),context:()=>({config:configA,mesh:meshA,snapshot:stateA}),prepare:async()=>{configB=null;$('material').value='1';$('interval').value='.5';$('speed').value='1';$('scale').value='auto';probe={x:.5,y:.5};return loadPreset('heating',matchMedia('(max-width:600px)').matches?24:32);},advance:duration=>{pause();return experiment.advanceSamples({duration,spacing:.25});},rewind:()=>experiment.restart(),locate:p=>{probe=p;render();}});
