// Development-only screen for wind-heat-transfer.mjs.  The estimation core
// is unchanged: this file only collects inputs, passes exactly the keys the
// core accepts, and renders its record (or its Japanese rejection reason).
import {estimateWindHeatTransfer} from './wind-heat-transfer.mjs';
import {windHeatSinkHandoffHref} from './wind-heatsink-handoff.mjs';

const $=id=>document.querySelector(id);
const form=$('#settings'),errorBox=$('#error'),readout=$('#readout'),warningsBox=$('#warnings'),handoffBox=$('#handoff'),handoffLink=$('#handoff-link');

const CORRELATIONS={
 '6.68':['式(6.68)：平板・層流の平均（等温壁）','Pr≧0.6、Pe_L＞100、Re_L≦5×10⁵（平板全体が層流）'],
 '6.69':['式(6.69)：平板・液体金属の平均','Pe_L＞100（液体金属）'],
 '6.120':['式(6.120)：3領域平均（観測遷移、気体）','気体、遷移開始Re_l≦5×10⁵、Re_l＜Re_u≦Re_L、Pr≧0.6'],
 '6.120-abrupt':['式(6.120)の例題6.11による縮約（急峻遷移、気体）','0≦Re_trans＜Re_L、Pr≧0.6（遷移域を省略した近似）'],
 '6.120-abrupt-liquid':['式(6.113)から導出した急峻遷移形（液体）','0≦Re_trans＜Re_L、Pr≧0.6（教科書に印刷された完成形ではなく導出形）'],
 '7.65':['式(7.65)：Churchill–Bernstein全体式（円柱横流れ）','Re_D≦10⁷のうち構成式(7.66)／(7.67)／(7.68)の選択範囲外'],
 '7.66':['式(7.66)：円柱横流れの構成式','Pe_D＞0.2、Re_D＜4000'],
 '7.67':['式(7.67)：Nakai–Okazaki（円柱横流れ）','Pe_D≦0.2'],
 '7.68':['式(7.68)：円柱横流れの構成式（高Re帯）','40,000＜Re_D＜400,000'],
};
const GEOMETRY_NAMES={'flat-plate':'平板','cylinder':'円柱（横流れ）','fin-plate':'平板フィン面','fin-pin':'ピンフィン面'};
const REPRESENTATIVE_NAMES={'flat-plate':'平板','cylinder':'円柱'};
const fmt=x=>String(Number(x.toPrecision(10)));

// Textbook example presets.  Properties are built exactly as in the module's
// regression test (density 1, viscosity = kinematic viscosity,
// cp = Pr * k / nu), so the screen reproduces the verified values.
const PRESETS={
 ex65:{geometry:'flat-plate',nu:1.95e-5,k:0.0292,prandtl:0.703,velocity:15,length:0.5,surface:383.15,free:293.15,regime:'',fluid:'',tre:'',tstart:'',tend:''},
 ex69:{geometry:'flat-plate',nu:1.575e-5,k:0.0264,prandtl:0.708,velocity:10,length:2,surface:383.15,free:293.15,regime:'mixed-observed',fluid:'gas',tre:'',tstart:'400000',tend:'870000'},
 ex611:{geometry:'flat-plate',nu:1.575e-5,k:0.0264,prandtl:0.708,velocity:10,length:2,surface:383.15,free:293.15,regime:'mixed-abrupt',fluid:'gas',tre:'400000',tstart:'',tend:''},
 ex78:{geometry:'cylinder',nu:1.602e-5,k:0.0265,prandtl:0.712,velocity:457*1.602e-5/0.0001,length:0.0001,surface:383.15,free:293.15,regime:'',fluid:'',tre:'',tstart:'',tend:''},
};

const isPlate=()=>['flat-plate','fin-plate'].includes($('#geometry').value);

function syncEnabled(){
 const plate=isPlate(),regime=$('#regime').value;
 $('#regime').disabled=!plate;
 $('#fluid').disabled=!plate;
 $('#tre').disabled=!(plate&&regime==='mixed-abrupt');
 $('#tstart').disabled=!(plate&&regime==='mixed-observed');
 $('#tend').disabled=!(plate&&regime==='mixed-observed');
}

const num=id=>{const v=$(id).value;return v===''?NaN:Number(v);};

function buildInput(){
 const input={
  geometry:$('#geometry').value,
  velocity:num('#velocity'),
  density:num('#density'),
  viscosity:num('#viscosity'),
  cp:num('#cp'),
  conductivity:num('#conductivity'),
  characteristicLength:num('#length'),
  surfaceTemperature:num('#surface'),
  freeStreamTemperature:num('#free'),
 };
 if(isPlate()){
  const regime=$('#regime').value,fluid=$('#fluid').value;
  if(regime)input.regime=regime;
  if(fluid)input.fluidKind=fluid;
  if(regime==='mixed-abrupt')input.transitionReynolds=num('#tre');
  if(regime==='mixed-observed'){input.transitionStartReynolds=num('#tstart');input.transitionEndReynolds=num('#tend');}
 }
 return input;
}

function estimate(){
 let result,input;
 try{input=buildInput();result=estimateWindHeatTransfer(input);}
 catch(e){
  errorBox.textContent=e.message;errorBox.hidden=false;
  readout.textContent='推定できませんでした。上の理由を確認してください。';
  warningsBox.hidden=true;warningsBox.textContent='';
  handoffBox.hidden=true;
  return;
 }
 errorBox.hidden=true;errorBox.textContent='';
 handoffLink.href=windHeatSinkHandoffHref(result,input);handoffBox.hidden=false;
 const [name,range]=CORRELATIONS[result.correlation];
 const lines=[
  `使用した相関：${name}`,
  `形状：${GEOMETRY_NAMES[result.geometry]}（代表形状：${REPRESENTATIVE_NAMES[result.representativeGeometry]}）`,
  `膜温度 Tf = ${fmt(result.filmTemperatureK)} K`,
  `Reynolds数 Re = ${fmt(result.reynolds)}`,
  `Prandtl数 Pr = ${fmt(result.prandtl)}`,
  `Péclet数 Pe = ${fmt(result.peclet)}`,
 ];
 if(result.transitionSlope!==null&&result.transitionSlope!==undefined)lines.push(`遷移勾配 c（式6.115）= ${fmt(result.transitionSlope)}`);
 lines.push(
  `Nusselt数 Nu = ${fmt(result.nusselt)}`,
  `熱伝達率 h = ${fmt(result.h)} W/(m² K)`,
  `適用範囲：${range}`,
 );
 readout.textContent=lines.join('\n');
 if(result.warnings.length){warningsBox.textContent='警告：\n'+result.warnings.map(w=>'・'+w).join('\n');warningsBox.hidden=false;}
 else{warningsBox.hidden=true;warningsBox.textContent='';}
}

function applyPreset(key){
 const p=PRESETS[key];if(!p)return;
 $('#geometry').value=p.geometry;
 $('#velocity').value=String(p.velocity);
 $('#length').value=String(p.length);
 $('#density').value='1';
 $('#viscosity').value=String(p.nu);
 $('#cp').value=String(p.prandtl*p.k/p.nu);
 $('#conductivity').value=String(p.k);
 $('#surface').value=String(p.surface);
 $('#free').value=String(p.free);
 $('#regime').value=p.regime;
 $('#fluid').value=p.fluid;
 $('#tre').value=p.tre;$('#tstart').value=p.tstart;$('#tend').value=p.tend;
 syncEnabled();estimate();
}

$('#geometry').addEventListener('change',syncEnabled);
$('#regime').addEventListener('change',syncEnabled);
$('#preset').addEventListener('change',e=>{if(e.target.value)applyPreset(e.target.value);});
for(const id of ['#geometry','#velocity','#length','#density','#viscosity','#cp','#conductivity','#surface','#free','#regime','#fluid','#tre','#tstart','#tend'])
 $(id).addEventListener('input',()=>{if(id!=='#preset')$('#preset').value='';});
form.addEventListener('submit',e=>{e.preventDefault();estimate();});
syncEnabled();
