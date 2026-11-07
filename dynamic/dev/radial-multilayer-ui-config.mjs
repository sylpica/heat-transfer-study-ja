// DOM-independent input layer for the radial-multilayer development screen.
// Converts form values (mm units, plain numbers) into the exact config
// object accepted by createRadialMultilayer. Only fields relevant to the
// chosen boundary type are forwarded, mirroring the core's strict key
// checks; range validation itself stays in the core so its Japanese
// refusal messages reach the screen unchanged.
export const BC_TYPE_LABELS={
 insulated:'断熱',
 temperature:'指定温度',
 flux:'指定熱流束（内向き）',
 convection:'対流',
 radiation:'放射',
 'convection-radiation':'対流＋放射'
};
export const BC_PARAMS={
 insulated:[],
 temperature:['temperature'],
 flux:['flux'],
 convection:['h','temperature'],
 radiation:['emissivity','temperature'],
 'convection-radiation':['h','emissivity','temperature','radiationTemperature']
};
export function buildBoundary(values,label){
 if(!values||!(values.type in BC_PARAMS))throw Error(`${label}境界条件の種類が不正です。`);
 const out={type:values.type};
 for(const key of BC_PARAMS[values.type]){
  const v=values[key];
  if(typeof v!=='number'||!Number.isFinite(v))throw Error(`${label}境界条件の入力に数値でない項目があります。`);
  out[key]=v;
 }
 return out;
}
function finiteField(v,message){
 if(typeof v!=='number'||!Number.isFinite(v))throw Error(message);
 return v;
}
export function buildMultilayerConfig(values){
 if(!values||typeof values!=='object')throw Error('入力が不正です。');
 const geometry=values.geometry;
 if(!['cylinder','sphere'].includes(geometry))throw Error('形状は円筒/球です。');
 const numericMessage='入力に数値でない項目があります。';
 const config={geometry};
 if(geometry==='cylinder')config.length=finiteField(values.lengthMm,numericMessage)/1000;
 config.innerRadius=finiteField(values.innerRadiusMm,numericMessage)/1000;
 if(!Array.isArray(values.layers)||values.layers.length<1)throw Error('層は1層以上です。');
 config.layers=values.layers.map((layer,i)=>{
  const m=`第${i+1}層の入力に数値でない項目があります。`;
  return {
   thickness:finiteField(layer.thicknessMm,m)/1000,
   cells:layer.cells,
   k:finiteField(layer.k,m),
   rho:finiteField(layer.rho,m),
   cp:finiteField(layer.cp,m),
   source:finiteField(layer.source??0,m)
  };
 });
 if(Array.isArray(values.contact))config.contactResistance=values.contact.map(v=>finiteField(v,'接触熱抵抗の入力に数値でない項目があります。'));
 config.initial=finiteField(values.initialK,numericMessage);
 config.boundary=buildBoundary(values.outerBC,'外面');
 config.innerBoundary=buildBoundary(values.innerBC,'内面');
 return config;
}
// Verified-case presets, in screen units (mm). The steady references are
// docs/dynamic/RADIAL_MULTILAYER_REFERENCE_20261107.json (independent
// resistance-network / fine-grid references).
export const MULTILAYER_PRESETS={
 contact:{
  label:'接触抵抗の検証ケース（円筒2層）',
  values:{geometry:'cylinder',lengthMm:100,innerRadiusMm:3,initialK:350,
   layers:[{thicknessMm:3,cells:32,k:8,rho:100,cp:1000,source:0},{thicknessMm:4,cells:32,k:2,rho:100,cp:1000,source:0}],
   contact:[0.005],
   innerBC:{type:'temperature',temperature:390},outerBC:{type:'temperature',temperature:310}}
 },
 threeLayer:{
  label:'円筒3層の検証ケース（抵抗網照合）',
  values:{geometry:'cylinder',lengthMm:100,innerRadiusMm:2,initialK:350,
   layers:[{thicknessMm:3,cells:32,k:10,rho:100,cp:1000,source:0},{thicknessMm:3,cells:32,k:1,rho:100,cp:1000,source:0},{thicknessMm:4,cells:32,k:5,rho:100,cp:1000,source:0}],
   contact:[0,0],
   innerBC:{type:'temperature',temperature:400},outerBC:{type:'temperature',temperature:300}}
 },
 sphereConvection:{
  label:'球2層・外面対流の検証ケース',
  values:{geometry:'sphere',lengthMm:100,innerRadiusMm:4,initialK:335,
   layers:[{thicknessMm:3,cells:32,k:5,rho:100,cp:1000,source:0},{thicknessMm:4,cells:32,k:0.5,rho:100,cp:1000,source:0}],
   contact:[0],
   innerBC:{type:'temperature',temperature:380},outerBC:{type:'convection',h:100,temperature:290}}
 },
 hollowFlux:{
  label:'中空円筒・内面熱流束のケース',
  values:{geometry:'cylinder',lengthMm:100,innerRadiusMm:4,initialK:320,
   layers:[{thicknessMm:4,cells:32,k:5,rho:100,cp:1000,source:0},{thicknessMm:4,cells:32,k:0.8,rho:100,cp:1000,source:0}],
   contact:[0],
   innerBC:{type:'flux',flux:2000},outerBC:{type:'temperature',temperature:300}}
 }
};
export function defaultLayerValues(){
 return {thicknessMm:3,cells:16,k:10,rho:1000,cp:1000,source:0};
}
