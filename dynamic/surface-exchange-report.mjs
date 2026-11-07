const f=(value,digits=6)=>Number.isFinite(value)?value.toFixed(digits):'—';
const sides={left:'左面',right:'右面',top:'上面',bottom:'下面'};
export function surfaceExchangeReport(states,meshes){
 const blocks=[];
 states.forEach((state,i)=>{
  const value=state.surfaceExchange;if(!value)return;
  const rows=Array.isArray(value)?value:[{...value,side:'外面',area:meshes[i].areas.at(-1),surfaceTemperatureMinK:value.surfaceTemperature,surfaceTemperatureMaxK:value.surfaceTemperature}];
  for(const r of rows)blocks.push(`${i?'B':'A'} ${sides[r.side]||r.side}、面積 ${r.area.toExponential(6)} m²\n表面温度 ${f(r.surfaceTemperatureMinK-273.15)}〜${f(r.surfaceTemperatureMaxK-273.15)} ℃\n対流（外向き正） ${f(r.convectionOutwardWatts)} W\n放射（外向き正） ${f(r.radiationOutwardWatts)} W\n物体への合計流入 ${f(r.inwardWatts)} W\n面の収支残差 ${r.balanceResidualW.toExponential(6)} W`);
 });
 return blocks.length?'表示時刻の瞬間値です。累積の熱量ではありません。\n\n'+blocks.join('\n\n'):'';
}
