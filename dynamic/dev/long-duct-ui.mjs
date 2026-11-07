import {Actor} from '../actor.mjs';import {Experiment} from '../experiment.mjs';import {drawTraces} from '../trace-plot.mjs';import {createLongDuctRadiation,createLongDuctViewFactors} from './long-duct-radiation.mjs';import {longDuctDiagram} from './long-duct-view.mjs';
const $=id=>document.getElementById(id),powerText=v=>v!==0&&Math.abs(v)<1e-5?v.toExponential(3):v.toFixed(6);let fixedB=null,scheduled=false,accepted=[];
const experiment=new Experiment({actorFactory:options=>new Actor({...options,workerURL:new URL('./long-duct-worker.mjs',import.meta.url)}),changed:({type,experiment:e})=>{if(type==='state')accepted=structuredClone(e.configs);const labels={initializing:'初期化中',ready:'準備完了',calculating:'計算中',advanced:'計算済み',rewound:'保存コマに戻りました',paused:'一時停止',error:'停止しました'};if(labels[type])$('status').textContent=labels[type];if(type==='progress'){if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}}else render();}});
const presetOutline=(shape,w,h)=>shape==='triangle'?[[0,0],[w,0],[w/2,h]]:shape==='rectangle'?[[0,0],[w,0],[w,h],[0,h]]:Array.from({length:6},(_,i)=>[w/2+w/2*Math.cos(2*Math.PI*i/6),h/2+h/Math.sqrt(3)*Math.sin(2*Math.PI*i/6)]);
let outline=presetOutline('triangle',1,0.8660254037844386);
function configuration(){
 if(!$('settings').reportValidity())throw Error('入力範囲を確認してください。');const hot=Number($('hot').value)+273.15,cold=Number($('cold').value)+273.15,eh=Number($('epsilon-hot').value),ec=Number($('epsilon-cold').value),capacity=Number($('capacity').value),shape=$('shape').value;
 if(![hot,cold,eh,ec,capacity].every(Number.isFinite)||hot<173.15||hot>1273.15||cold<173.15||cold>1273.15||eh<.01||eh>1||ec<.01||ec>1||capacity<10||capacity>1e5||!['triangle','rectangle','hexagon','custom'].includes(shape))throw Error('この開発画面の入力範囲を超えます。');
 let shapeOutline;
 if(shape==='custom')shapeOutline=outline;
 else{const w=Number($('width').value),h=Number($('height').value);if(![w,h].every(Number.isFinite)||w<.1||w>5||h<.1||h>5)throw Error('この開発画面の入力範囲を超えます。');shapeOutline=presetOutline(shape,w,h);}
 const g=createLongDuctViewFactors({outline:shapeOutline,span:1});
 return {outline:structuredClone(shapeOutline),span:1,walls:g.lengths.map((L,i)=>({temperature:i?cold:hot,emissivity:i?ec:eh,capacityPerLength:capacity*L})),maxTemperature:1500};
}
function markChanged(){experiment.invalidate();$('status').textContent='条件が変わりました。初期状態から計算してください。';}
// Free vertex editing for condition A. The accepted outline is always a
// kernel-valid strictly convex polygon; a candidate that fails the extent
// bound or the kernel's own validation is refused on the spot with its
// reason, and the previous outline is kept untouched.
let editorMap=null,rowInputs=[],drag=null;
const fmtCoord=v=>String(Math.round(v*1e6)/1e6),vertexSvg=$('vertex-svg');
function showVertexError(message){const e=$('vertex-error');e.textContent=message;e.hidden=false;}
function clearVertexError(){const e=$('vertex-error');e.textContent='';e.hidden=true;}
function extentError(candidate){const xs=candidate.map(p=>p[0]),ys=candidate.map(p=>p[1]),bw=Math.max(...xs)-Math.min(...xs),bh=Math.max(...ys)-Math.min(...ys);return bw>=.05&&bw<=5&&bh>=.05&&bh<=5?null:'断面の幅・高さは0.05〜5 mの範囲に収めてください。';}
function validateCandidate(candidate){const e=extentError(candidate);if(e)return {error:new Error(e)};try{return {geometry:createLongDuctViewFactors({outline:candidate,span:1})};}catch(error){return {error};}}
function buildVertexRows(){
 $('vertex-rows').replaceChildren(...outline.map((p,i)=>{
  const row=document.createElement('div');row.className='vertex-row',row.dataset.vertexRow=String(i);
  const name=document.createElement('span');name.textContent=`頂点${i+1}`;
  const x=document.createElement('input');x.type='number';x.step='any';x.inputMode='decimal';x.value=fmtCoord(p[0]);x.setAttribute('aria-label',`頂点${i+1}のx座標 [m]`);
  const xLabel=document.createElement('label');xLabel.append('x [m]',x);
  const y=document.createElement('input');y.type='number';y.step='any';y.inputMode='decimal';y.value=fmtCoord(p[1]);y.setAttribute('aria-label',`頂点${i+1}のy座標 [m]`);
  const yLabel=document.createElement('label');yLabel.append('y [m]',y);
  const del=document.createElement('button');del.type='button';del.textContent='削除';del.disabled=outline.length<=3;del.setAttribute('aria-label',`頂点${i+1}を削除`);
  x.onchange=()=>onVertexCoord(i);y.onchange=()=>onVertexCoord(i);del.onclick=()=>deleteVertex(i);
  row.append(name,xLabel,yLabel,del);return row;
 }));
 rowInputs=outline.map((_,i)=>{const row=$('vertex-rows').children[i];return {x:row.querySelectorAll('input')[0],y:row.querySelectorAll('input')[1]};});
 $('vertex-add').disabled=outline.length>=12;
}
function syncVertexInputs(){rowInputs.forEach((inputs,i)=>{inputs.x.value=fmtCoord(outline[i][0]);inputs.y.value=fmtCoord(outline[i][1]);});}
function computeEditorMap(){
 const W=360,H=260,pad=34,xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]),minX=Math.min(...xs),minY=Math.min(...ys),bw=Math.max(Math.max(...xs)-minX,1e-9),bh=Math.max(Math.max(...ys)-minY,1e-9),scale=Math.min((W-2*pad)/bw,(H-2*pad)/bh);
 return {scale,offsetX:(W-bw*scale)/2,offsetY:(H-bh*scale)/2,minX,minY,H};
}
function drawEditor(frozenMap){
 const m=frozenMap??computeEditorMap();if(!frozenMap)editorMap=m;
 const {scale,offsetX,offsetY,minX,minY,H}=m;
 const X=x=>offsetX+(x-minX)*scale,Y=y=>H-offsetY-(y-minY)*scale,pts=outline.map(p=>[X(p[0]),Y(p[1])]);
 let markup=`<polygon points="${pts.map(p=>p.map(v=>v.toFixed(2)).join(',')).join(' ')}" fill="rgba(110,150,200,.16)" stroke="currentColor" stroke-width="2"/>`;
 outline.forEach((_,i)=>{const a=pts[i],b=pts[(i+1)%pts.length];markup+=`<text x="${((a[0]+b[0])/2).toFixed(1)}" y="${((a[1]+b[1])/2).toFixed(1)}" text-anchor="middle" font-size="11" fill="currentColor">壁${i+1}</text>`;});
 outline.forEach((_,i)=>{markup+=`<circle data-vertex="${i}" cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="13" fill="transparent" style="cursor:grab;touch-action:none"/><circle cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="5.5" fill="currentColor" pointer-events="none"/><text x="${pts[i][0].toFixed(1)}" y="${(pts[i][1]-14).toFixed(1)}" text-anchor="middle" font-size="11" fill="currentColor" pointer-events="none">${i+1}</text>`;});
 vertexSvg.innerHTML=markup;
}
function updatePreview(withExchange=true){
 let g;try{g=createLongDuctViewFactors({outline,span:1});}catch{$('vertex-preview').textContent='';return;}
 let exchange='';
 if(withExchange)try{
  const hot=Number($('hot').value)+273.15,cold=Number($('cold').value)+273.15,eh=Number($('epsilon-hot').value),ec=Number($('epsilon-cold').value),capacity=Number($('capacity').value),s=createLongDuctRadiation({outline,span:1,walls:g.lengths.map((L,i)=>({temperature:i?cold:hot,emissivity:i?ec:eh,capacityPerLength:capacity*L})),maxTemperature:1500}).snapshot();
  exchange=`\n初期の正味放射（外向き+、軸1 mあたり）: ${s.wallOutwardPowerPerLength.map((v,i)=>`壁${i+1} ${powerText(v)} W/m`).join('、')}`;
 }catch{exchange='';}
 $('vertex-preview').textContent=`壁${outline.length}面、辺長 [m]: ${g.lengths.map(v=>v.toFixed(4)).join(', ')}\n形態係数 F（行=出る壁、列=当たる壁）:\n${g.viewFactors.map(row=>row.map(v=>v.toPrecision(5)).join(' ')).join('\n')}\n総和の最大差=${g.diagnostics.maximumRowResidual}、相反の相対差=${g.diagnostics.reciprocityRelativeResidual}${exchange}`;
}
function acceptOutline(candidate,structural){
 outline=candidate;clearVertexError();if(structural)buildVertexRows();drawEditor();updatePreview();markChanged();
}
function onVertexCoord(i){
 const x=Number(rowInputs[i].x.value),y=Number(rowInputs[i].y.value);
 if(!Number.isFinite(x)||!Number.isFinite(y)){showVertexError(`頂点${i+1}の座標は有限の数値で指定してください。`);syncVertexInputs();return;}
 const candidate=structuredClone(outline);candidate[i]=[x,y];const {error}=validateCandidate(candidate);
 if(error){showVertexError(`頂点${i+1}は受け付けません: ${error.message}`);syncVertexInputs();return;}
 // On success the inputs already hold the accepted values as typed; do not
 // rewrite them with rounded display values while the row is being edited.
 acceptOutline(candidate,false);
}
function addVertex(){
 if(outline.length>=12)return;
 let best=-1,bestLen=-1;for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L>bestLen){bestLen=L;best=i;}}
 const a=outline[best],b=outline[(best+1)%outline.length],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
 let area2=0;for(let i=0;i<outline.length;i++){const p=outline[i],q=outline[(i+1)%outline.length];area2+=p[0]*q[1]-q[0]*p[1];}
 const dx=b[0]-a[0],dy=b[1]-a[1],out=area2>0?[dy,-dx]:[-dy,dx],norm=Math.hypot(out[0],out[1]);let accepted=null;
 for(const f of [.04,.01,.1]){const point=[mid[0]+out[0]/norm*f*bestLen,mid[1]+out[1]/norm*f*bestLen],candidate=[...outline.slice(0,best+1),point,...outline.slice(best+1)];if(!validateCandidate(candidate).error){accepted=candidate;break;}}
 if(!accepted){showVertexError('頂点を追加できません: 追加後の形状が厳密な凸形になりません。');return;}
 acceptOutline(accepted,true);$('vertex-status').textContent=`頂点${best+2}を追加し、頂点は${outline.length}個になりました。`;
}
function deleteVertex(i){
 if(outline.length<=3)return;
 const candidate=outline.filter((_,j)=>j!==i),{error}=validateCandidate(candidate);
 if(error){showVertexError(`頂点${i+1}は削除できません: ${error.message}`);return;}
 acceptOutline(candidate,true);$('vertex-status').textContent=`頂点${i+1}を削除し、頂点は${outline.length}個になりました。`;
}
function syncFromPreset(){
 const shape=$('shape').value,custom=shape==='custom';$('width').disabled=custom;$('height').disabled=custom;if(custom)return;
 const w=Number($('width').value),h=Number($('height').value);if(![w,h].every(Number.isFinite))return;
 outline=presetOutline(shape,w,h);clearVertexError();buildVertexRows();drawEditor();updatePreview();
}
function svgToPhysical(e,map){
 const m=vertexSvg.getScreenCTM();if(!m||!map)return null;
 const pt=vertexSvg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const loc=pt.matrixTransform(m.inverse());
 return [map.minX+(loc.x-map.offsetX)/map.scale,map.minY+(map.H-loc.y-map.offsetY)/map.scale];
}
vertexSvg.addEventListener('pointerdown',e=>{
 const index=e.target?.dataset?.vertex;if(index===undefined)return;
 // Freeze the fit map for the whole drag: the outline's bounding box (and
 // therefore the fitted scale) changes as a vertex moves, and refitting
 // mid-drag would shift the physical point under the pointer.
 e.preventDefault();drag={index:Number(index),moved:false,map:editorMap};
 try{vertexSvg.setPointerCapture(e.pointerId);}catch{}
});
vertexSvg.addEventListener('pointermove',e=>{
 if(!drag)return;const point=svgToPhysical(e,drag.map);if(!point)return;
 const candidate=structuredClone(outline);candidate[drag.index]=[Math.round(point[0]*1e6)/1e6,Math.round(point[1]*1e6)/1e6];
 const {error}=validateCandidate(candidate);
 if(error){showVertexError(`頂点${drag.index+1}はそこへ動かせません: ${error.message}`);return;}
 clearVertexError();drag.moved=true;outline=candidate;drawEditor(drag.map);syncVertexInputs();updatePreview(false);
});
const endDrag=()=>{if(!drag)return;const moved=drag.moved;drag=null;if(moved){drawEditor();updatePreview();markChanged();}};
vertexSvg.addEventListener('pointerup',endDrag);vertexSvg.addEventListener('pointercancel',endDrag);
$('vertex-add').onclick=addVertex;
function parameters(){const duration=Number($('interval').value),dt=$('dt').value===''?undefined:Number($('dt').value);if(!Number.isFinite(duration)||duration<.001||duration>10||(dt!==undefined&&(!Number.isFinite(dt)||dt<=0)))throw Error('時間と刻みを正の対応範囲で指定してください。');return {duration,dt};}
async function initialize(){try{const a=configuration();await experiment.initialize({kind:'long-duct-radiation',configs:fixedB?[a,fixedB]:[a]});}catch(e){experiment.invalidate(e);}}
function render(){
 const blocked=!experiment.ready||experiment.busy;$('error').hidden=!experiment.error;$('error').textContent=experiment.error?.message||'';$('progress').value=experiment.progress||0;for(const id of ['step','run','restart'])$(id).disabled=blocked;$('back').disabled=blocked||experiment.index===0;$('compare').disabled=blocked||!!fixedB;$('uncompare').disabled=experiment.busy||!fixedB;$('history').max=Math.max(0,experiment.history.length-1);$('history').value=experiment.index;$('history').disabled=blocked||experiment.history.length<2;
 if(!experiment.states.length)return;const states=experiment.states,meshes=experiment.meshes,maximumWalls=Math.max(...states.map(s=>s.temperature.length));$('panel-b').hidden=states.length<2;if($('wall').options.length!==maximumWalls){const previous=Number($('wall').value);$('wall').replaceChildren(...Array.from({length:maximumWalls},(_,i)=>new Option(`壁${i+1}`,i)));$('wall').value=String(Math.min(previous,maximumWalls-1));}
 const selected=Number($('wall').value),values=states.flatMap(s=>s.temperature),lo=Math.min(...values),hi=Math.max(lo+1,...values),points=meshes.flatMap(g=>g.outline),bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))],panelWidth=Math.max(280,Math.min(...meshes.map((g,i)=>$('figure-'+(i?'b':'a')).clientWidth||600))),texts=[],details=[],rows=[];
 $('clock').textContent=states[0].time.toFixed(3)+' s';$('panel-b').hidden=states.length<2;$('legend').textContent=`共通温度色：${(lo-273.15).toFixed(2)}〜${(hi-273.15).toFixed(2)}℃。図は断面、熱量は軸長さ1 mあたり。`;
 states.forEach((s,i)=>{const g=meshes[i],letter=i?'b':'a',label=i?'B':'A',wall=Math.min(selected,s.temperature.length-1),diagram=longDuctDiagram({geometry:g,state:s,width:panelWidth,height:340,range:[lo,hi],selectedWall:wall,idPrefix:'duct-'+letter,bounds});$('figure-'+letter).innerHTML=diagram.markup;$('caption-'+letter).textContent=`${label}：${g.outline.length}壁、t=${s.time.toFixed(3)} s、${experiment.ready?'受理済み':'前回状態（変更条件は未適用）'}。実寸倍率${diagram.pixelsPerMetre.toFixed(2)} px/m。`;
  texts.push(`${label}・壁${wall+1}: ${(s.temperature[wall]-273.15).toFixed(6)}℃ / ${s.temperature[wall].toFixed(6)} K\n正味放射（外向き+） ${powerText(s.wallOutwardPowerPerLength[wall])} W/m\n他壁との正味交換: `+s.pairPower[wall].map((q,j)=>j===wall?'':`壁${j+1}へ ${powerText(q)} W/m`).filter(Boolean).join('、'));
  s.temperature.forEach((t,j)=>rows.push(`<tr><th>${label}・壁${j+1}</th><td>${(t-273.15).toFixed(6)}</td><td>${s.radiosity[j].toFixed(6)}</td><td>${powerText(s.wallOutwardPowerPerLength[j])}</td></tr>`));
  details.push(`${label}: Fの各行\n${g.viewFactors.map(row=>row.map(v=>v.toPrecision(7)).join(' ')).join('\n')}\n矢印の表示分解能=${diagram.arrowNumericalDisplayThresholdW} W、非ゼロの省略矢印=${diagram.omittedRoundoffArrowCount}本\n総和の最大差=${g.diagnostics.maximumRowResidual}、相反の相対差=${g.diagnostics.reciprocityRelativeResidual}\n顕熱=${s.energy} J、外部累積入力=${s.netInput} J、熱収支差=${s.energyError} J\n放射収支=${s.radiationBalance} W、射度の相対残差=${s.linearResidual}\nsteps=${s.steps}、最終刻み=${s.lastDt} s、自動刻み上限=${s.safeDt} s\n面積 ${g.areas.join(', ')} m²、壁熱容量 ${accepted[i].walls.map(w=>w.capacityPerLength).join(', ')} J/K（軸1 m）`);
 });$('readout').textContent=texts.join('\n\n');$('wall-values').querySelector('tbody').innerHTML=rows.join('');$('diagnostic-values').textContent=details.join('\n\n');drawTraces($('graph'),states.map((s,i)=>({points:experiment.history.map(frame=>({x:frame[i].time,y:frame[i].temperature[Math.min(selected,frame[i].temperature.length-1)]-273.15}))})),states[0].time,{yLabel:'選択壁の温度 [℃]'});
}
$('settings').onsubmit=e=>{e.preventDefault();initialize();};for(const id of ['hot','cold','epsilon-hot','epsilon-cold','capacity'])$(id).oninput=()=>{markChanged();updatePreview();};for(const id of ['shape','width','height'])$(id).oninput=()=>{syncFromPreset();markChanged();};$('wall').onchange=render;for(const id of ['interval','dt'])$(id).onchange=()=>experiment.pause();$('step').onclick=()=>{try{experiment.advance(parameters());}catch(e){experiment.fail(e);}};$('run').onclick=()=>experiment.play(parameters);$('pause').onclick=()=>experiment.pause();$('back').onclick=()=>experiment.rewind(experiment.index-1);$('restart').onclick=()=>experiment.restart();$('history').oninput=()=>experiment.rewind(Number($('history').value));$('compare').onclick=()=>{fixedB=structuredClone(experiment.configs[0]);initialize();};$('uncompare').onclick=()=>{fixedB=null;initialize();};window.addEventListener('resize',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}});matchMedia('(prefers-color-scheme: dark)').addEventListener('change',render);window.addEventListener('pagehide',()=>experiment.close());buildVertexRows();drawEditor();updatePreview();initialize();
