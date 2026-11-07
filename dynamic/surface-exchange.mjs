// A single solid surface facing a prescribed fluid AND a large black enclosure.
// No fluid CFD or finite enclosure view factors are inferred here.
const SIGMA=5.670374419e-8;
const positive=(x,name)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<=0)throw Error(name+'は正の有限値です。');};
export function validateSurfaceExchange(b){
 positive(b.temperature,'流体絶対温度');positive(b.radiationTemperature,'放射周囲絶対温度');
 if(typeof b.h!=='number'||!Number.isFinite(b.h)||b.h<0)throw Error('熱伝達率は0以上の有限値です。');
 if(typeof b.emissivity!=='number'||!Number.isFinite(b.emissivity)||b.emissivity<0||b.emissivity>1)throw Error('放射率は0〜1の有限値です。');
 if(!Number.isFinite(b.radiationTemperature**4))throw Error('放射周囲温度が数値範囲外です。');
}
export function surfaceExchange(cellTemperature,conductance,area,b){
 positive(cellTemperature,'セル絶対温度');positive(conductance,'表面までの熱コンダクタンス');positive(area,'表面積');validateSurfaceExchange(b);
 if(!b.h&&!b.emissivity)return {surfaceTemperature:cellTemperature,inwardWatts:0,convectionOutwardWatts:0,radiationOutwardWatts:0,balanceResidualW:0};
 if(!Number.isFinite(cellTemperature**4))throw Error('表面の放射温度が数値範囲外です。');
 const hA=b.h*area,rA=b.emissivity*SIGMA*area;
 if(![hA,rA].every(Number.isFinite))throw Error('表面の伝熱係数が数値範囲外です。');
 // Solve the offset from the cell, not Ts itself. For large G the physical
 // offset can be smaller than an absolute temperature ULP; G*offset still
 // resolves the exchanged power instead of spuriously reporting zero heat.
 const exchange=offset=>{
  const t=cellTemperature+offset,convectionOutwardWatts=hA*((cellTemperature-b.temperature)+offset),
   radiationOutwardWatts=rA*((cellTemperature-b.radiationTemperature)+offset)*(cellTemperature+b.radiationTemperature+offset)*(t*t+b.radiationTemperature*b.radiationTemperature),
   inwardWatts=conductance*offset,residual=-inwardWatts-convectionOutwardWatts-radiationOutwardWatts,
   radiationSlope=4*rA*t*t*t;
  if(t<=0||![t,convectionOutwardWatts,radiationOutwardWatts,inwardWatts,residual,radiationSlope].every(Number.isFinite))throw Error('対流・放射の表面収支が数値範囲外です。');
  return {surfaceTemperature:t,convectionOutwardWatts,radiationOutwardWatts,inwardWatts,residual,radiationSlope};
 };
 let lo=Math.min(0,b.temperature-cellTemperature,b.radiationTemperature-cellTemperature),hi=Math.max(0,b.temperature-cellTemperature,b.radiationTemperature-cellTemperature),offset=0;
 // Residual derivative: -G - hA - 4 epsilon sigma A Ts^3 < 0.
 // Safeguarded Newton retains the positive-temperature bracket. Scale the
 // derivative to avoid overflow when individually finite conductances add.
 for(let i=0;i<96;i++){
  const value=exchange(offset),{inwardWatts,convectionOutwardWatts,radiationOutwardWatts,residual,radiationSlope}=value;
  if(Math.abs(residual)<=64*Number.EPSILON*Math.max(1e-300,Math.abs(inwardWatts),Math.abs(convectionOutwardWatts),Math.abs(radiationOutwardWatts)))
   return {surfaceTemperature:value.surfaceTemperature,inwardWatts,convectionOutwardWatts,radiationOutwardWatts,balanceResidualW:residual};
  if(residual>0)lo=offset;else hi=offset;
  const scale=Math.max(conductance,hA,radiationSlope),derivative=-(conductance/scale+hA/scale+radiationSlope/scale),next=offset-(residual/scale)/derivative;
  offset=Number.isFinite(next)&&next>lo&&next<hi?next:lo+(hi-lo)/2;
 }
 throw Error('対流・放射の表面収支が丸め誤差内で収束しません。');
}
