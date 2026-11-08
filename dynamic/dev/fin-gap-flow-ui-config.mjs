// Form presets and unit conversion for the fin-gap flow dev screen.
// Field values are kept in the units shown on the screen; buildFinGapInput
// converts them to the SI keys that solveFinGapFlow accepts (and only
// those keys: the core rejects unknown keys instead of ignoring them).
// Presets reproduce the pre-registered acceptance cases A1/A2/A4 and the
// A3/A5 drive cases of docs/dynamic/FINGAP_FLOW_JS_20261107.md.
const AIR_FIELDS=Object.freeze({
 gapMm:10,finHeightMm:10,lengthMm:30000,rho:1.177,cp:1006,k:0.0264,nuMicro:15.75,
 inletTemperature:300,driveType:'mean-velocity',driveValue:0.5,
 boundaryType:'wall-heat-flux',boundaryValue:50,nx:400,ny:128,dxGrowth:1.03});
export const FINGAP_GUI_PRESETS=Object.freeze({
 developedFlux:Object.freeze({label:'発達極限・一定熱流束（A1）',fields:AIR_FIELDS}),
 developedTemp:Object.freeze({label:'発達極限・一定壁温（A2）',
  fields:Object.freeze({...AIR_FIELDS,lengthMm:500,boundaryType:'wall-temperature',boundaryValue:320,nx:512,dxGrowth:1.02})}),
 entranceFlux:Object.freeze({label:'短い流路・入口効果（A6）',
  fields:Object.freeze({...AIR_FIELDS,lengthMm:50,nx:128,ny:32,dxGrowth:1})}),
 pressureDrive:Object.freeze({label:'圧力差駆動（A4）',
  fields:Object.freeze({...AIR_FIELDS,lengthMm:100,driveType:'pressure-difference',driveValue:0.1,ny:64,dxGrowth:1.02})}),
 volumeFlow:Object.freeze({label:'体積流量・一定壁温（A3）',
  fields:Object.freeze({...AIR_FIELDS,gapMm:2,finHeightMm:25,lengthMm:60,
   driveType:'volume-flow',driveValue:12,boundaryType:'wall-temperature',boundaryValue:330,ny:64,dxGrowth:1.02})}),
});
// Screen drive values: mean velocity [m/s], volume flow [L/min],
// mass flow [g/s], pressure difference [Pa].
const DRIVE_KEYS=Object.freeze({
 'mean-velocity':f=>({type:'mean-velocity',bulkVelocity:f.driveValue}),
 'volume-flow':f=>({type:'volume-flow',volumeFlowRate:f.driveValue/60000}),
 'mass-flow':f=>({type:'mass-flow',massFlowRate:f.driveValue/1000}),
 'pressure-difference':f=>({type:'pressure-difference',pressureDifference:f.driveValue})});
export function buildFinGapInput(f){
 const driveBuilder=DRIVE_KEYS[f.driveType];
 if(!driveBuilder)throw Error('駆動条件の種別が不正です。');
 const boundary=f.boundaryType==='wall-temperature'
  ?{type:'wall-temperature',wallTemperature:f.boundaryValue}
  :f.boundaryType==='wall-heat-flux'
   ?{type:'wall-heat-flux',wallHeatFlux:f.boundaryValue}
   :null;
 if(!boundary)throw Error('境界条件の種別が不正です。');
 return {
  gap:f.gapMm/1000,finHeight:f.finHeightMm/1000,length:f.lengthMm/1000,
  rho:f.rho,cp:f.cp,k:f.k,nu:f.nuMicro*1e-6,inletTemperature:f.inletTemperature,
  drive:driveBuilder(f),boundary,nx:f.nx,ny:f.ny,dxGrowth:f.dxGrowth};
}
// Display formats shared by the screen and its tests.  The verified
// acceptance values render as 8.235294 / 7.540486 (outlet local Nusselt).
export const formatTemperatureK=v=>v.toFixed(4);
export const formatNusselt=v=>v===null||v===undefined?'—':v.toFixed(6);
export const formatHeatTransfer=v=>v===null||v===undefined?'—':v.toFixed(4);
export const formatPressurePa=v=>v.toFixed(4);
export const formatWatt=v=>v.toFixed(5);
export const formatVelocity=v=>v.toFixed(6);
export const formatFlowLMin=v=>v.toFixed(4);
export const formatMassFlowGS=v=>(v*1000).toFixed(4);
