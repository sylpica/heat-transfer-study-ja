// Form presets and unit conversion for the coupled heat-sink dev screen.
// Field values are kept in the units shown on the screen; buildCoupledInput
// converts them to the SI keys that solveHeatSinkCoupled accepts (and only
// those keys: the core rejects unknown keys instead of ignoring them).
const STANDARD_FIELDS=Object.freeze({
 finCount:7,finThicknessMm:1,gapMm:3,finHeightMm:30,lengthMm:120,baseThicknessMm:3,
 solidK:167,fluidRho:1.177,fluidCp:1006,fluidK:0.0264,fluidNuMicro:15.75,
 ambient:300,flowLMin:43.2,power:10,emissivity:0.8,patchLengthMm:30,patchWidthMm:9});
export const COUPLED_GUI_PRESETS=Object.freeze({
 standard:Object.freeze({label:'標準条件（参照計算と同一）',
  fields:STANDARD_FIELDS,refinement:4,hydraulicRefinement:2}),
 noRadiation:Object.freeze({label:'放射なし（ε=0）',
  fields:Object.freeze({...STANDARD_FIELDS,emissivity:0}),refinement:4,hydraulicRefinement:2}),
 highPower:Object.freeze({label:'高発熱・大流量（20 W・86.4 L/min）',
  fields:Object.freeze({...STANDARD_FIELDS,power:20,flowLMin:86.4}),refinement:2,hydraulicRefinement:2}),
});
export function buildCoupledInput(f){
 return {
  length:f.lengthMm/1000,finCount:f.finCount,finThickness:f.finThicknessMm/1000,
  gap:f.gapMm/1000,finHeight:f.finHeightMm/1000,baseThickness:f.baseThicknessMm/1000,
  solidK:f.solidK,fluidRho:f.fluidRho,fluidCp:f.fluidCp,fluidK:f.fluidK,
  fluidNu:f.fluidNuMicro*1e-6,ambient:f.ambient,totalFlow:f.flowLMin/60000,
  power:f.power,emissivity:f.emissivity,
  patchLength:f.patchLengthMm/1000,patchWidth:f.patchWidthMm/1000};
}
// Display formats shared by the screen and its tests.  The verified r=4
// reference values render as 316.6867 K / 3.0417 Pa / 0.22714 W.
export const formatTemperatureK=v=>v.toFixed(4);
export const formatPressurePa=v=>v.toFixed(4);
export const formatRadiationW=v=>v.toFixed(5);
export const formatFlowLMin=v=>v.toFixed(4);
export const formatWatt=v=>v.toFixed(5);
export const formatPercent=v=>v.toFixed(2);
