// Measured verification tables for dynamic/dev/radial-multilayer.mjs.
// Run: node scripts/dynamic-radial-multilayer-benchmarks.mjs
// Writes docs/dynamic/RADIAL_MULTILAYER_BENCHMARKS_20261107.json and prints a
// summary. Steady values are marched with the product core until the two
// boundary powers balance; analytic values come from the independent
// Python generator (RADIAL_MULTILAYER_REFERENCE_20261107.json).
import {createRadialMultilayer} from '../dynamic/dev/radial-multilayer.mjs';
import {readFileSync,writeFileSync} from 'node:fs';

const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/RADIAL_MULTILAYER_REFERENCE_20261107.json',import.meta.url)));
const advance=(m,end)=>{while(m.time<end)m.step(Math.min(m.safeDt,end-m.time),false);return m.snapshot();};
function toSteady(m){
 let steps=0;
 for(;;){
  for(let i=0;i<500;i++)m.step(m.safeDt,false);
  steps+=500;const s=m.snapshot(),scale=Math.max(1,Math.abs(s.innerInwardWatts),Math.abs(s.outerInwardWatts));
  if(Math.abs(s.innerInwardWatts+s.outerInwardWatts)/scale<1e-8)return {snapshot:s,steps};
  if(steps>8e6)throw Error('steady state not reached');
 }
}
const configOf=(name,cells)=>{
 const st=reference.steady[name].config;
 return {geometry:st.geometry,...(st.length?{length:st.length}:{}),innerRadius:st.radii[0],
  layers:st.ks.map((k,j)=>({thickness:st.radii[j+1]-st.radii[j],cells,k,rho:100,cp:1000})),
  ...(st.contact.some(v=>v>0)?{contactResistance:st.contact}:{}),
  initial:(st.innerBC[1]+st.outerBC.at(-1))/2,
  innerBoundary:st.innerBC[0]==='temperature'?{type:'temperature',temperature:st.innerBC[1]}:{type:'convection',h:st.innerBC[1],temperature:st.innerBC[2]},
  boundary:st.outerBC[0]==='temperature'?{type:'temperature',temperature:st.outerBC[1]}:{type:'convection',h:st.outerBC[1],temperature:st.outerBC[2]}};
};
const steady={};
const steadyGrids={'cylinderThreeLayer':[8,16,32,64],'sphereTwoLayerConvection':[8,16,32],'cylinderContactResistance':[8,16,32]};
for(const name of Object.keys(steadyGrids)){
 const ref=reference.steady[name],rows=[];
 for(const cells of steadyGrids[name]){
  const m=createRadialMultilayer(configOf(name,cells)),{snapshot:s,steps}=toSteady(m),f=m.flux();
  const ifaceErr=f.interfaces.map((it,j)=>Math.max(Math.abs(it.leftSurfaceTemperature-ref.interfaceLeftTemperaturesK[j]),Math.abs(it.rightSurfaceTemperature-ref.interfaceRightTemperaturesK[j])));
  rows.push({cellsPerLayer:cells,steps,heatRateRelativeError:Math.abs(-s.outerInwardWatts/ref.heatRateW-1),maxInterfaceTemperatureErrorK:Math.max(...ifaceErr),outerSurfaceTemperatureErrorK:Math.abs(s.outerSurfaceTemperature-ref.outerSurfaceTemperatureK),energyErrorJ:s.energyError});
 }
 steady[name]={analyticHeatRateW:ref.heatRateW,rows};
 console.log(name,rows.map(r=>`${r.cellsPerLayer}: dQ=${r.heatRateRelativeError.toExponential(2)} dTif=${r.maxInterfaceTemperatureErrorK.toExponential(2)}`).join(' | '));
}
// Transient field comparison against the independent fine-grid reference.
const transient={};
for(const [name,caseRef] of Object.entries(reference.transient)){
 const cfg=caseRef.config,rows=[];
 for(const cells of [8,16,32]){
  const m=createRadialMultilayer({geometry:cfg.geometry,...(cfg.length?{length:cfg.length}:{}),innerRadius:cfg.radii[0],
   layers:cfg.layers.map((l,j)=>({thickness:cfg.radii[j+1]-cfg.radii[j],cells,...l})),initial:cfg.initialK,
   innerBoundary:cfg.innerBC[0]==='temperature'?{type:'temperature',temperature:cfg.innerBC[1]}:{type:'insulated'},
   boundary:cfg.outerBC[0]==='convection'?{type:'convection',h:cfg.outerBC[1],temperature:cfg.outerBC[2]}:{type:'temperature',temperature:cfg.outerBC[1]}});
  const s=advance(m,cfg.timeS),refT=caseRef.samples[String(cells)],weights=m.mesh.volumes,total=weights.reduce((a,b)=>a+b,0);
  const rms=Math.sqrt(s.temperature.reduce((sum,t,i)=>sum+weights[i]*(t-refT[i])**2,0)/total);
  rows.push({cellsPerLayer:cells,volumeWeightedRmsK:rms,maxShellErrorK:Math.max(...s.temperature.map((t,i)=>Math.abs(t-refT[i]))),energyErrorJ:s.energyError,relativeEnergyError:s.relativeEnergyError});
 }
 transient[name]={referenceSelfConvergence:caseRef.selfConvergence,rows};
 console.log(name,rows.map(r=>`${r.cellsPerLayer}: RMS=${r.volumeWeightedRmsK.toExponential(3)}K`).join(' | '));
}
// Interface flux consistency during a transient: the conservative solver
// transfer vs one-sided quadratic-extrapolation fluxes from each layer.
function oneSidedFlux(temps,centres,dr,k,side){
 // temps/centres: the three cells nearest the interface within one layer.
 const [T1,T2,T3]=temps;
 return side==='left'?k*(-2*T1+3*T2-T3)/dr:k*(2*T1-3*T2+T3)/dr;
}
const interfaceFlux={};
for(const [name,caseRef] of Object.entries(reference.transient)){
 const cfg=caseRef.config,rows=[];
 for(const cells of [16,32,64]){
  const m=createRadialMultilayer({geometry:cfg.geometry,...(cfg.length?{length:cfg.length}:{}),innerRadius:cfg.radii[0],
   layers:cfg.layers.map((l,j)=>({thickness:cfg.radii[j+1]-cfg.radii[j],cells,...l})),initial:cfg.initialK,
   innerBoundary:cfg.innerBC[0]==='temperature'?{type:'temperature',temperature:cfg.innerBC[1]}:{type:'insulated'},
   boundary:cfg.outerBC[0]==='convection'?{type:'convection',h:cfg.outerBC[1],temperature:cfg.outerBC[2]}:{type:'temperature',temperature:cfg.outerBC[1]}});
  const samples=[];
  for(const tEnd of [cfg.timeS/4,cfg.timeS/2,cfg.timeS]){
   advance(m,tEnd-m.time>0?tEnd:m.time);const s=m.snapshot(),f=m.flux(),it=f.interfaces[0];
   const li=m.mesh.layers[0],ri=m.mesh.layers[1],lastL=li.firstCell+li.cells-1,firstR=ri.firstCell;
   const qL=oneSidedFlux([s.temperature[lastL],s.temperature[lastL-1],s.temperature[lastL-2]],null,li.dr,li.k,'left')*it.area;
   const qR=oneSidedFlux([s.temperature[firstR],s.temperature[firstR+1],s.temperature[firstR+2]],null,ri.dr,ri.k,'right')*it.area;
   samples.push({timeS:tEnd,solverWatts:it.outwardWatts,leftRelativeDifference:Math.abs(qL-it.outwardWatts)/Math.abs(it.outwardWatts),rightRelativeDifference:Math.abs(qR-it.outwardWatts)/Math.abs(it.outwardWatts),sidesRelativeDifference:Math.abs(qL-qR)/Math.abs(it.outwardWatts)});
  }
  rows.push({cellsPerLayer:cells,samples});
 }
 interfaceFlux[name]=rows;
 const fine=rows.at(-1).samples;
 console.log(name,'interface flux rel diffs (64/layer):',fine.map(s=>`t=${s.timeS}: L=${s.leftRelativeDifference.toExponential(2)} R=${s.rightRelativeDifference.toExponential(2)}`).join(' | '));
}
const out={generatedAtUTC:new Date().toISOString(),module:'dynamic/dev/radial-multilayer.mjs',releaseApproved:false,steady,transient,interfaceFlux};
writeFileSync(new URL('../docs/dynamic/RADIAL_MULTILAYER_BENCHMARKS_20261107.json',import.meta.url),JSON.stringify(out,null,1)+'\n');
console.log('wrote docs/dynamic/RADIAL_MULTILAYER_BENCHMARKS_20261107.json');
