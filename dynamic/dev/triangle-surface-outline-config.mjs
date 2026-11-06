// Validated boundary-draft conversion; old linear-only configurations stay exact.
import {buildTriangleLinearOutlineExperiment} from './triangle-linear-outline-config.mjs';
const check=(v,name,lo,hi)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error(`${name}は${lo}〜${hi}です。`);return v;};
export function buildTriangleSurfaceOutlineExperiment(input){
 const v=structuredClone(input);if(!Array.isArray(v?.boundaryInputs))return buildTriangleLinearOutlineExperiment(v);
 const converted=v.boundaryInputs.map((b,i)=>{if(b?.type!=='surface-exchange')return b;check(b.emissivity,`辺${i}の放射率`,0,1);check(b.radiationC,`辺${i}の黒い放射周囲温度[℃]`,-100,1000);return {type:'convection',h:b.h,ambientC:b.ambientC};}),built=buildTriangleLinearOutlineExperiment({...v,boundaryInputs:converted});
 if(!v.boundaryInputs.some(b=>b.type==='surface-exchange'))return built;
 built.config.boundaries=built.config.boundaries.map((b,i)=>v.boundaryInputs[i].type==='surface-exchange'?{...b,type:'surface-exchange',emissivity:v.boundaryInputs[i].emissivity,radiationTemperatureK:v.boundaryInputs[i].radiationC+273.15}:b);
 built.info.nonlinearSurface=true;built.info.radiationEnclosure='prescribed-black';return built;
}
