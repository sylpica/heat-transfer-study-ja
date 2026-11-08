// Development-only fin-gap channel model: one passage between adjacent
// heat-sink fins, idealized as parallel plates (gap s, length L, span W =
// fin height, W >> s). The velocity is the prescribed developed plane
// Poiseuille profile; only the thermal-entrance (Graetz) problem is solved,
// delegated to dynamic/dev/graetz-channel.mjs so the discretization is not
// duplicated. Pressure loss is the fully developed laminar analytic law
// dp/dx = -12*mu*U/s^2 (Darcy f = 96/Re_Dh, Dh = 2s); entrance/exit losses
// are excluded. No hydrodynamic entrance, side walls, 3D fin array, fin
// conduction conjugate, or flow distribution is solved.
// Formulation basis: support request 3 part B (FIN_GAP_FORMULATION.md).
// releaseApproved=false.
import {solveGraetzChannel} from './graetz-channel.mjs';
const LAW='fin-gap-developed-channel-v1';
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v===0?0:v;};

export function solveFinGapFlow(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('フィン間流路の条件はオブジェクトです。');
 const c=structuredClone(input),allowed=new Set(['gap','finHeight','length','rho','cp','k','nu','inletTemperature','drive','boundary','nx','ny','dxGrowth','maxTemperature']);
 if(Object.keys(c).some(key=>!allowed.has(key)))throw Error('未対応の物理条件を暗黙に無視しません。');
 const s=finite(c.gap,'フィン間隔[m]',true),W=finite(c.finHeight,'フィン高さ（流路幅）[m]',true),L=finite(c.length,'流路長さ[m]',true);
 for(const key of ['rho','cp','k','nu'])finite(c[key],key,true);
 const Tin=finite(c.inletTemperature,'入口温度[K]',true);
 const mu=c.rho*c.nu,area=s*W,Dh=2*s;
 // Drive: exactly one of volume flow / mass flow / mean velocity / pressure
 // difference. The pressure-difference drive inverts the developed friction
 // law only; it is not a prediction of the real (entrance-inclusive) loss.
 const d=c.drive;if(!d||typeof d!=='object'||Array.isArray(d))throw Error('駆動条件はオブジェクトです。');
 let U,driveType,driveValue;
 if(d.type==='volume-flow'){
  if(Object.keys(d).some(key=>!['type','volumeFlowRate'].includes(key)))throw Error('未対応の駆動条件を暗黙に無視しません。');
  driveType='volume-flow';driveValue=finite(d.volumeFlowRate,'体積流量[m3/s]',true);U=driveValue/area;
 }else if(d.type==='mass-flow'){
  if(Object.keys(d).some(key=>!['type','massFlowRate'].includes(key)))throw Error('未対応の駆動条件を暗黙に無視しません。');
  driveType='mass-flow';driveValue=finite(d.massFlowRate,'質量流量[kg/s]',true);U=driveValue/(c.rho*area);
 }else if(d.type==='mean-velocity'){
  if(Object.keys(d).some(key=>!['type','bulkVelocity'].includes(key)))throw Error('未対応の駆動条件を暗黙に無視しません。');
  driveType='mean-velocity';driveValue=finite(d.bulkVelocity,'平均流速[m/s]',true);U=driveValue;
 }else if(d.type==='pressure-difference'){
  if(Object.keys(d).some(key=>!['type','pressureDifference'].includes(key)))throw Error('未対応の駆動条件を暗黙に無視しません。');
  driveType='pressure-difference';driveValue=finite(d.pressureDifference,'圧力差[Pa]',true);U=driveValue*s*s/(12*mu*L);
 }else throw Error('駆動条件はvolume-flow、mass-flow、mean-velocityまたはpressure-differenceです。');
 finite(U,'平均流速[m/s]',true);
 // Wall conditions: both fin faces share one condition (constant wall
 // temperature or constant inflow heat flux). The one-sided Graetz boundary
 // of the base solver is not a fin-gap condition here and is rejected.
 const bnd=c.boundary;if(!bnd||typeof bnd!=='object'||Array.isArray(bnd))throw Error('境界条件はオブジェクトです。');
 let boundary;
 if(bnd.type==='wall-temperature'){
  if(Object.keys(bnd).some(key=>!['type','wallTemperature'].includes(key)))throw Error('未対応の境界条件を暗黙に無視しません。');
  boundary={type:'wall-temperature',wallTemperature:finite(bnd.wallTemperature,'壁温[K]',true)};
 }else if(bnd.type==='wall-heat-flux'){
  if(Object.keys(bnd).some(key=>!['type','wallHeatFlux'].includes(key)))throw Error('未対応の境界条件を暗黙に無視しません。');
  boundary={type:'wall-heat-flux',wallHeatFlux:finite(bnd.wallHeatFlux,'両フィン面の流入熱流束')};
 }else throw Error('フィン間流路の境界条件は両フィン面同一のwall-temperatureまたはwall-heat-fluxです。');
 const g=solveGraetzChannel({width:L,height:s,depth:W,nx:c.nx??400,ny:c.ny??64,dxGrowth:c.dxGrowth??1.02,rho:c.rho,cp:c.cp,k:c.k,nu:c.nu,bulkVelocity:U,inletTemperature:Tin,boundary,...(c.maxTemperature!==undefined?{maxTemperature:c.maxTemperature}:{})});
 // Pressure loss from the base solver's developed gradient (identical law),
 // so the reported value cannot drift from the solver's own pressure law.
 const gradient=g.meanFlow.pressureGradientPaPerM,drop=Math.abs(gradient)*L;
 const Re=g.meanFlow.reynoldsDh,Pr=g.meanFlow.prandtl,Pe=g.meanFlow.pecletDh;
 const friction=drop*Dh/(L*(c.rho*U*U/2));
 const meanNusselt=g.meanNusselt;
 return {
  law:LAW,releaseApproved:false,
  config:structuredClone(c),
  geometry:{gapM:s,finHeightM:W,lengthM:L,crossSectionAreaM2:area,hydraulicDiameterM:Dh,spanToGapRatio:W/s,heatedWallAreaM2:2*L*W},
  drive:{type:driveType,value:driveValue,bulkVelocityMPerS:U,volumeFlowRateM3PerS:U*area,massFlowRateKgPerS:c.rho*U*area},
  flow:{reynoldsDh:Re,prandtl:Pr,pecletDh:Pe,outletDimensionlessLength:L/(Dh*Pe),entranceLengthEstimatesM:{hydrodynamic:0.05*Re*Dh,thermal:0.05*Re*Pr*Dh,basis:'Representative 0.05*Re_Dh*Dh and 0.05*Re_Dh*Pr*Dh estimates only; not acceptance boundaries.'}},
  pressure:{gradientPaPerM:gradient,dropPa:drop,darcyFrictionFactor:friction,frictionReynoldsProduct:friction*Re,law:'Fully developed laminar parallel plates: dp/dx=-12*mu*U/s^2, Darcy f*Re_Dh=96 (Dh=2s). Entrance/exit/local losses excluded.'},
  thermal:{boundaryType:boundary.type,meanNusselt,meanNusseltDefinition:'Length average of the local Nusselt number over the stations where it is defined (base Graetz solver definition); not the overall-heat/LMTD definition.',meanHeatTransferCoefficientWPerM2K:meanNusselt===null?null:meanNusselt*c.k/Dh,outletLocalNusselt:g.outlet.localNusselt,outletBulkTemperatureK:g.outlet.bulkTemperature,totalHeatRateW:g.totalWallHeatRateW,fluidHeatRateW:g.fluidHeatRateW,energyBalanceRelativeResidual:g.energyBalanceRelativeResidual},
  graetz:{mesh:g.mesh,localNusselt:g.localNusselt,bulkTemperature:g.bulkTemperature,dimensionlessLength:g.dimensionlessLength,lowerWallTemperature:g.lowerWallTemperature,upperWallTemperature:g.upperWallTemperature},
  assumptions:{steadyState:true,velocityIsPrescribedDevelopedPoiseuille:true,thermalEntranceResolved:true,hydrodynamicEntranceResolved:false,axialConductionOmitted:true,constantProperties:true,infiniteWidthParallelPlateIdealization:true,finiteWidthHydraulicDiameterCorrectionApplied:false,sideTipAndBaseEffectsResolved:false,finConductionConjugateResolved:false,entranceAndExitPressureLossesIncluded:false,multiplePassageDistributionResolved:false,turbulenceResolved:false}
 };
}
