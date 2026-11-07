import {cavityUIConfig} from './cavity-ui-config.mjs';
import {cavityHeatFluxSections} from './cavity-heat-flux.mjs';
import {macKineticDiagnostics} from './kinetic-energy.mjs';
import {Actor} from '../actor.mjs';import {Experiment} from '../experiment.mjs';import {drawTraces} from '../trace-plot.mjs';import {cavityViewData,drawCavity} from './cavity-view.mjs';
const $=id=>document.getElementById(id),probe=[.5,.5];let savedB=null,scheduled=false,acceptedConfigs=[];
const experiment=new Experiment({actorFactory:options=>new Actor({...options,workerURL:new URL('./cavity-worker.mjs',import.meta.url)}),changed:({type,experiment:active})=>{
 if(type==='state')acceptedConfigs=structuredClone(active.configs);
 const status={initializing:'初期化中',ready:'準備完了',calculating:'計算中',advanced:'計算済み',rewound:'保存コマへ戻りました',error:'停止しました',paused:'一時停止'}[type];if(status)$('status').textContent=status;
 if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}
}});
function fail(error){experiment.fail(error);}
function config(){
 if(!$('settings').reportValidity())throw Error('条件の入力範囲を確認してください。');
 return cavityUIConfig({difference:Number($('difference').value),gravity:Number($('gravity').value),grid:Number($('grid').value),prandtl:Number($('prandtl').value),aspectRatio:Number($('aspect').value)});
}
function timeParameters(){const duration=Number($('interval').value),dt=$('dt').value===''?undefined:Number($('dt').value);if(!Number.isFinite(duration)||duration<=0||duration>1||(dt!==undefined&&(!Number.isFinite(dt)||dt<=0)))throw Error('進行時間/時間刻みは正の範囲で指定してください。');return {duration,dt};}
async function initialize(){try{const a=config();await experiment.initialize({kind:'cavity',configs:savedB?[a,savedB]:[a]});}catch(error){experiment.invalidate(error);}}
function render(){
 $('error').hidden=!experiment.error;$('error').textContent=experiment.error?.message||'';$('progress').value=experiment.progress||0;
 const blocked=!experiment.ready||experiment.busy;for(const id of ['run','step','restart'])$(id).disabled=blocked;
 $('back').disabled=blocked||experiment.index===0;$('compare').disabled=blocked||!!savedB;$('uncompare').disabled=experiment.busy||!savedB;
 $('history').max=Math.max(0,experiment.history.length-1);$('history').value=experiment.index;$('history').disabled=blocked||experiment.history.length<2;
 if(!experiment.states.length)return;
 const data=experiment.states.map((s,i)=>cavityViewData(s,experiment.meshes[i])),quantity=$('quantity').value,unit={temperature:'℃',pressure:'Pa',speed:'m/s'}[quantity],values=data.flatMap(d=>d[quantity]),min=Math.min(...values),max=Math.max(...values),range=max>min?[min,max]:[min-.5,max+.5],velocityScale=Math.max(...data.flatMap(d=>d.speed));
 $('legend').textContent=`共通色スケール ${range[0].toPrecision(5)}〜${range[1].toPrecision(5)} ${unit}。矢印の共通基準：最大 ${velocityScale.toPrecision(5)} m/s。xは右、yは上。`;
 $('panel-b').hidden=experiment.states.length<2;$('clock').textContent=experiment.states[0].time.toFixed(3)+' s';
 const readings=[],diagnostics=[],mechanical=[],heatValues=[];
 experiment.states.forEach((s,i)=>{
  const mesh=experiment.meshes[i],c=acceptedConfigs[i],letter=i?'b':'a',label=i?'B':'A';
  drawCavity($('field-'+letter),s,mesh,{quantity,range,velocityScale,arrows:$('arrows').checked,streamlines:$('streamlines').checked,probe});
  const x=probe[0]*mesh.width,y=probe[1]*mesh.height,index=Math.min(mesh.ny-1,Math.floor(probe[1]*mesh.ny))*mesh.nx+Math.min(mesh.nx-1,Math.floor(probe[0]*mesh.nx)),[u,v]=data[i].velocity.at(x,y),Ra=Math.abs(c.gravityBeta*(c.leftTemperature-c.rightTemperature)*c.height**3/(c.nu*c.alpha));
  $('caption-'+letter).textContent=`${label}：t=${s.time.toFixed(3)} s、壁温 ${(c.leftTemperature-273.15).toFixed(2)}/${(c.rightTemperature-273.15).toFixed(2)} ℃、Ra=${Ra.toFixed(3)}、Pr=${(c.nu/c.alpha).toFixed(2)}、幅/高さ=${(mesh.width/mesh.height).toFixed(1)}（${(mesh.width*1000).toFixed(0)}×${(mesh.height*1000).toFixed(0)} mm）、${mesh.nx}×${mesh.ny}。${experiment.ready?'計算済み':'前回受理した計算結果（新条件は未適用）'}`;
  readings.push(`${label}: x=${(x*1000).toFixed(2)}, y=${(y*1000).toFixed(2)} mm、T=${(s.temperature[index]-273.15).toFixed(5)} ℃、p=${s.pressure[index].toExponential(5)} Pa、u=${u.toExponential(5)}, v=${v.toExponential(5)} m/s`);
  try{const r=macKineticDiagnostics(s,c),e=x=>x.toExponential(6),difference=Math.abs(c.leftTemperature-c.rightTemperature),maximumSpeed=Math.max(...data[i].speed),Ec=difference>0?maximumSpeed**2/(c.cp*difference):null;mechanical.push(`${label}\nMAC運動エネルギー=${e(r.kineticEnergyJ)} J\n圧力仕事（面から）=${e(r.pressurePowerByFacesW)} W\n圧力仕事（セルのp div uから）=${e(r.pressurePowerByCellsW)} W\n離散部分積分の差=${e(r.integrationByPartsResidualW)} W\n再構成した圧力補正の減少量=${e(r.projectionImpliedLossJ)} J\n直交投影での減少量=${e(r.orthogonalProjectionLossJ)} J\n直交との差=${e(r.projectionOrthogonalityDefectJ)} J\n投影の恒等式の差=${e(r.projectionIdentityResidualJ)} J\nEc=${Ec===null?'未定義（基準温度差0）':e(Ec)}（表示セル中心の最大速度基準、U²/(cp ΔT)）`);}catch(error){mechanical.push(`${label}：運動エネルギー診断を表示できません。${error.message}`);}
  try{const heat=cavityHeatFluxSections(mesh,s,c),f=x=>x===null?'未定義（壁温差0）':x.toExponential(8);heatValues.push(`${label}\n左壁の高さ平均 Nu₀=${f(heat.leftWallNu)}\n鉛直中央面平均 Nu₁/₂=${f(heat.verticalMidplaneNu)}\n体積平均 Nu=${f(heat.volumeMeanNu)}\n左壁から正x方向の熱=${f(heat.sections[0].totalPowerPositiveXW)} W\n右壁から正x方向の熱=${f(heat.sections.at(-1).totalPowerPositiveXW)} W\n断面間Nuの最大差=${f(heat.maximumNuSectionSpread)}\n断面質量流量の最大絶対値=${f(heat.maximumSectionMassFlowMagnitudeKgPerS)} kg/s`);}catch(error){heatValues.push(`${label}：熱流診断を表示できません。${error.message}`);}
  diagnostics.push(`${label}\nRa=${Ra}、Pr=${c.nu/c.alpha}\n物理時刻=${s.time} s、ステップ数=${s.steps}、最終dt=${s.lastDt} s、自動上限=${s.safeDt} s\n瞬間左壁平均Nu=${s.nusselt===null?'未定義（温度差0）':s.nusselt}\n顕熱=${s.energy} J（奥行き1 mあたり）\n境界からの累積熱=${s.netInput} J、収支誤差=${s.energyError} J\n発散最大=${s.divergence} s⁻¹、正規化発散=${s.normalizedDivergence}\nPoisson残差=${s.pressureResidual}、右辺ノルム=${s.pressureRhsNorm}、最終反復=${s.pressureIterations}\nρ=${c.rho} kg/m³、cp=${c.cp} J/(kg K)、ν=${c.nu}、α=${c.alpha} m²/s\n運動量=${s.momentumScheme}、温度=${s.scalarScheme}`);
 });
 $('heat-flux-values').textContent=heatValues.join('\n\n');$('mechanical-values').textContent=mechanical.join('\n\n');$('readout').textContent=readings.join('\n');$('diagnostic-values').textContent=diagnostics.join('\n\n');
 drawTraces($('graph'),experiment.states.map((_,i)=>({name:i?'B':'A',color:i?'#ca6300':'#1872c9',points:experiment.history.map(frame=>({x:frame[i].time,y:frame[i].nusselt})).filter(p=>p.y!==null)})),experiment.states[0].time,{yLabel:'左壁平均Nu [−]'});
}
$('settings').onsubmit=e=>{e.preventDefault();initialize();};
for(const id of ['difference','gravity','grid','prandtl','aspect'])$(id).onchange=()=>{experiment.invalidate();$('status').textContent='条件を変更しました。初期状態から計算してください。';};
for(const id of ['interval','dt'])$(id).onchange=()=>experiment.pause();
$('step').onclick=async()=>{try{await experiment.advance(timeParameters());}catch(error){fail(error);}};
$('run').onclick=()=>experiment.play(timeParameters);$('pause').onclick=()=>experiment.pause();$('restart').onclick=()=>experiment.restart();$('back').onclick=()=>experiment.rewind(experiment.index-1);$('history').oninput=()=>experiment.rewind(Number($('history').value));
$('compare').onclick=()=>{savedB=structuredClone(experiment.configs[0]);initialize();};$('uncompare').onclick=()=>{savedB=null;initialize();};
for(const id of ['quantity','arrows','streamlines'])$(id).onchange=render;
for(const id of ['field-a','field-b']){
 const canvas=$(id);canvas.onpointerdown=e=>{const box=canvas.getBoundingClientRect(),p=JSON.parse(canvas.dataset.plot),x=(e.clientX-box.left)*canvas.width/box.width,y=(e.clientY-box.top)*canvas.height/box.height;probe[0]=Math.max(0,Math.min(1,(x-p.left)/p.width));probe[1]=Math.max(0,Math.min(1,1-(y-p.top)/p.height));canvas.focus();render();};
 canvas.onkeydown=e=>{const delta={ArrowLeft:[-.05,0],ArrowRight:[.05,0],ArrowUp:[0,.05],ArrowDown:[0,-.05]}[e.key];if(!delta)return;e.preventDefault();for(let i=0;i<2;i++)probe[i]=Math.max(0,Math.min(1,probe[i]+delta[i]));render();};
}
window.addEventListener('resize',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',render);
window.addEventListener('pagehide',()=>experiment.close());initialize();
