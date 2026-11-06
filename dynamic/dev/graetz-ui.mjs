import {solveGraetzChannel} from './graetz-channel.mjs';
import {drawGraetzField,drawGraetzProfiles,sampleGraetz} from './graetz-view.mjs';
const $=id=>document.querySelector(id),form=$('#settings'),status=$('#status'),errorBox=$('#error'),field=$('#field'),graph=$('#graph'),readout=$('#readout'),diagnostics=$('#diagnostic-values');
const AIR={rho:'1.177',cp:'1006',k:'0.0264',nu:'0.00001575'};
let result=null,probe=[.5,.5];
const fmt=(v,d=9)=>v===null||v===undefined?'未定義':Number(v).toPrecision(d);
function syncBoundary(){
 const flux=$('#bc').value==='wall-heat-flux';
 $('#wall-temperature-row').hidden=flux;$('#wall-flux-row').hidden=!flux;
}
function syncPreset(){
 if($('#preset').value==='air300')for(const [id,v]of Object.entries(AIR))$('#'+id).value=v;
}
function readInput(){
 const [nx,ny,dxGrowth]=$('#grid').value.split(',').map(Number);
 const boundary=$('#bc').value==='wall-heat-flux'
  ?{type:'wall-heat-flux',wallHeatFlux:Number($('#wall-flux').value)}
  :{type:'wall-temperature',wallTemperature:Number($('#wall-temperature').value)};
 return {width:Number($('#length').value),height:Number($('#height-mm').value)/1000,depth:Number($('#depth').value),nx,ny,dxGrowth,
  rho:Number($('#rho').value),cp:Number($('#cp').value),k:Number($('#k').value),nu:Number($('#nu').value),
  bulkVelocity:Number($('#speed').value),inletTemperature:Number($('#inlet').value),boundary};
}
function show(){
 const s=sampleGraetz(result,probe);
 drawGraetzField(field,result,{probe});drawGraetzProfiles(graph,result,{probe});
 readout.textContent=
  `x=${fmt(s.x)} m（セル中心）、x*=${fmt(s.dimensionlessLength)}、y=${fmt(s.y*1000,4)} mm\n`+
  `セル温度=${fmt(s.temperature)} K、行平均速度=${fmt(s.velocity)} m/s\n`+
  `バルク温度=${fmt(s.bulkTemperature)} K、下壁=${fmt(s.lowerWallTemperature)} K、上壁=${fmt(s.upperWallTemperature)} K\n`+
  `局所Nu_Dh=${fmt(s.localNusselt)}（未定義の場合は温度差または熱流束が0）`;
 const mf=result.meanFlow;
 diagnostics.textContent=
  `Dh=${fmt(mf.hydraulicDiameter)} m、Re_Dh=${fmt(mf.reynoldsDh)}、Pr=${fmt(mf.prandtl)}、Pe_Dh=${fmt(mf.pecletDh)}\n`+
  `質量流量=${fmt(mf.massFlowKgPerS)} kg/s、駆動圧力勾配=${fmt(mf.pressureGradientPaPerM)} Pa/m、壁せん断=${fmt(mf.wallShearMagnitudePa)} Pa\n`+
  `出口バルク温度=${fmt(result.outlet.bulkTemperature)} K、出口局所Nu=${fmt(result.outlet.localNusselt)}\n`+
  `長さ平均Nu（定義域内のdx加重平均）=${fmt(result.meanNusselt)}\n`+
  `壁からの総熱移動率=${fmt(result.totalWallHeatRateW)} W、流体の顕熱増加=${fmt(result.fluidHeatRateW)} W\n`+
  `収支残差=${fmt(result.energyBalanceResidualW)} W（相対 ${fmt(result.energyBalanceRelativeResidual,3)}）`;
 field.setAttribute('aria-label',field.getAttribute('aria-label')+` 測定点 x=${fmt(s.x)} m、バルク温度${fmt(s.bulkTemperature)} K。`);
}
function compute(){
 errorBox.hidden=true;status.textContent='計算中';
 try{result=solveGraetzChannel(readInput());probe=[.5,.5];show();status.textContent='計算済み';}
 catch(e){status.textContent='計算できません（直前の受理結果を保持）';errorBox.textContent=e.message;errorBox.hidden=false;}
}
form.addEventListener('submit',e=>{e.preventDefault();compute();});
$('#bc').addEventListener('change',syncBoundary);
$('#preset').addEventListener('change',syncPreset);
field.addEventListener('pointerdown',e=>{if(!result)return;const r=field.getBoundingClientRect();probe=[Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,1-(e.clientY-r.top)/r.height))];show();});
field.addEventListener('keydown',e=>{if(!result)return;const step=e.shiftKey?.1:.02;let used=true;
 if(e.key==='ArrowLeft')probe[0]=Math.max(0,probe[0]-step);else if(e.key==='ArrowRight')probe[0]=Math.min(1,probe[0]+step);
 else if(e.key==='ArrowUp')probe[1]=Math.min(1,probe[1]+step);else if(e.key==='ArrowDown')probe[1]=Math.max(0,probe[1]-step);else used=false;
 if(used){e.preventDefault();show();}});
addEventListener('resize',()=>{if(result)show();});
syncBoundary();syncPreset();compute();
