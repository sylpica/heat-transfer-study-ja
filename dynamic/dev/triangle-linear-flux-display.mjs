// A display-only roundoff estimate, not a rigorous field error bound. It never
// changes recovered vectors or their numeric diagnostics.
export function triangleLinearFluxDisplayEstimate(mesh,state,k){
 if(!mesh?.elements?.length||!Array.isArray(state?.temperatureExcess)||state.temperatureExcess.length!==mesh.nodes.length||!state.temperatureExcess.every(Number.isFinite)||!Number.isSafeInteger(state.steps)||state.steps<0||!Number.isFinite(k)||k<=0)throw Error('実メッシュ/保持温度差/回数/kが必要です。');
 const thetaScale=Math.max(...state.temperatureExcess.map(Math.abs)),altitudes=mesh.elements.map(t=>{const p=t.nodes.map(i=>mesh.nodes[i].normalized),longest=Math.max(...p.map((a,i)=>Math.hypot(a[0]-p[(i+1)%3][0],a[1]-p[(i+1)%3][1])));return t.normalizedTwiceArea*mesh.numerics.normalizationScale/longest;}),minimumAltitude=Math.min(...altitudes),estimate=128*Number.EPSILON*(state.steps+1)*(k*thetaScale/minimumAltitude);
 if(!Number.isFinite(estimate)||estimate<0||!Number.isFinite(minimumAltitude)||minimumAltitude<=0)throw Error('流束の表示上の丸め目安が数値範囲外です。');return estimate;
}
