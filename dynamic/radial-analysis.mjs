// Isotherm radii of the radial 1D field. The solved data are shell-centre
// averages plus a separate physical surface temperature; isotherms are the
// radii where the piecewise-linear profile through those points crosses a
// level. No centre point temperature is invented and nothing is extrapolated
// inside the innermost shell centre or beyond the surface.
function validate(mesh,state,levels){
 const centres=mesh?.centres,temperature=state?.temperature;
 if(!Array.isArray(centres)||centres.length<2||!Array.isArray(temperature)||temperature.length!==centres.length||!Number.isFinite(mesh?.radius)||mesh.radius<=0||!Number.isFinite(state?.surfaceTemperature))throw Error('半径方向の格子と温度の寸法が一致しません。');
 if(centres.some((r,i)=>!Number.isFinite(r)||r<0||(i&&r<=centres[i-1]))||centres.at(-1)>=mesh.radius)throw Error('殻中心の半径が単調ではありません。');
 if(temperature.some(t=>!Number.isFinite(t)))throw Error('殻温度が有限値ではありません。');
 if(!Array.isArray(levels)||levels.length>12||levels.some(v=>!Number.isFinite(v)))throw Error('等温線は有限の温度で12本以下にしてください。');
}
export function radialIsothermRadii(mesh,state,levels){
 validate(mesh,state,levels);
 const points=mesh.centres.map((r,i)=>[r,state.temperature[i]]);points.push([mesh.radius,state.surfaceTemperature]);
 const result=[];
 for(const level of levels){
  const radii=[];
  for(let i=0;i<points.length-1;i++){
   const [r0,t0]=points[i],[r1,t1]=points[i+1];
   if((t0<level&&t1>=level)||(t1<level&&t0>=level)){const r=r0+(level-t0)/(t1-t0)*(r1-r0);if(!radii.some(v=>Math.abs(v-r)<=1e-12*Math.max(1,r)))radii.push(r);}
  }
  for(const radius of radii)result.push({level,radius});
 }
 return result;
}
