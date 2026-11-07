// Read-only P1 field diagnostics for the independently advanced nonlinear surface model.
export function triangleSurfaceField(mesh,state,k){
 if(state?.kind!=='convex-P1-nodal-surface-SSPRK2-development-state'||!Number.isFinite(k)||k<=0||!Array.isArray(state.temperatureExcess)||state.temperatureExcess.length!==mesh?.nodes?.length||!state.temperatureExcess.every(Number.isFinite))throw Error('実混合境界状態と一定kが必要です。');
 const gradient=mesh.elements.map(t=>{const [i,j,l]=t.nodes,[a,b,c]=[i,j,l].map(id=>mesh.nodes[id].normalized),u=state.temperatureExcess[j]-state.temperatureExcess[i],v=state.temperatureExcess[l]-state.temperatureExcess[i],den=t.normalizedTwiceArea*mesh.numerics.normalizationScale;return [(u*(c[1]-a[1])-v*(b[1]-a[1]))/den,((b[0]-a[0])*v-(c[0]-a[0])*u)/den];}),flux=gradient.map(g=>g.map(x=>-k*x));if([...gradient,...flux].some(v=>v.some(x=>!Number.isFinite(x))))throw Error('実勾配/流束が数値範囲外です。');
 return {...structuredClone(state),elementGradientsKPerM:gradient,elementHeatFluxWPerM2:flux};
}
