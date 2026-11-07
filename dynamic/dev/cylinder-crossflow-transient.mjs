// Development-only transient model of a solid circular cylinder placed in
// a uniform cross flow: radial (1-D) conduction inside the cylinder solved
// by the existing radial model (dynamic/radial.mjs, geometry 'cylinder'),
// with a uniform convective surface boundary whose coefficient h is either
// prescribed directly or estimated from the free-stream velocity by the
// textbook cross-flow correlations of Sec. 7.6 (wind-heat-transfer.mjs,
// itself verified against the textbook examples, including Example 7.8).
//
// Stated assumptions (anything outside them is rejected, not extrapolated):
//   - Solid: solid circular cylinder, constant properties (k, rho, cp),
//     no heat generation, no axial or angular temperature variation.
//     Only the lateral surface exchanges heat; the end faces are not
//     modelled (the radial model's area is 2*pi*R*L for the given length).
//   - Flow: uniform, constant-temperature free stream.  h is the
//     circumference-averaged value of the Sec. 7.6 correlations, uniform
//     over the surface and constant in time.  The local distribution of h
//     around the circumference (stagnation point to wake) is NOT solved,
//     and neither is the flow field itself.
//   - Fluid properties are user-supplied values at the film temperature
//     Tf = (Ts + Tinf)/2, exactly as in the wind module; they are held
//     constant during the transient, and h is evaluated once, with the
//     film surface temperature taken as filmSurfaceTemperature (default:
//     the initial solid temperature).
//   - Development-range limit on the Biot number, Bi = h*R/k <= 10: for
//     larger Bi the circumferential non-uniformity of the local h would
//     appear inside the solid as an angular temperature distribution,
//     which breaks the 1-D radial + uniform-average-h premise of this
//     model.  This is a stated model limit, not a textbook bound.
//   - Not modelled: radiation, buoyancy / mixed convection, temperature-
//     dependent properties, phase change, roughness, tube banks.
// Verification is recorded in
// docs/dynamic/CYLINDER_CROSSFLOW_TRANSIENT_DEVELOPMENT.md: lumped-limit
// exponential decay, steady-state energy balance, and an internal-gradient
// case collated with an independent Python reference (fine radial grid,
// exact matrix-exponential time propagation).
import {createRadial} from '../radial.mjs';
import {estimateWindHeatTransfer} from './wind-heat-transfer.mjs';

const LAW='cylinder-crossflow-transient-v1';
const BIOT_LIMIT=10;
const finite=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error(`${name}は有限値で指定してください。`);return v;};
const positive=(v,name)=>{finite(v,name);if(v<=0)throw Error(`${name}は正の値で指定してください。`);return v;};

export function createCylinderCrossflowTransient(config){
 if(!config||typeof config!=='object'||Array.isArray(config))throw Error('円柱横流れ過渡の条件はオブジェクトで指定してください。');
 const c=structuredClone(config);
 const allowed=new Set(['diameter','length','solidConductivity','solidDensity','solidCp','initialTemperature','fluidTemperature','cells','heatTransferCoefficient','flow']);
 if(Object.keys(c).some(key=>!allowed.has(key)))throw Error('未対応の物理条件を暗黙に無視しません。対応するキーだけを指定してください。');
 const diameter=positive(c.diameter,'円柱の直径'),length=positive(c.length,'円柱の長さ');
 const k=positive(c.solidConductivity,'固体の熱伝導率'),rho=positive(c.solidDensity,'固体の密度'),cp=positive(c.solidCp,'固体の比熱');
 const initialTemperature=positive(c.initialTemperature,'初期温度'),fluidTemperature=positive(c.fluidTemperature,'流体温度');
 const cells=c.cells??32;
 if(!Number.isSafeInteger(cells)||cells<4||cells>512)throw Error('半径方向セル数は4〜512の整数です。');
 const hasDirect=c.heatTransferCoefficient!==undefined,hasFlow=c.flow!==undefined;
 if(hasDirect===hasFlow)throw Error('熱伝達率hは heatTransferCoefficient の直接指定か flow（風速からの推定）のどちらか一方で指定してください。');
 let h,estimate=null,hSource;
 if(hasDirect){
  h=positive(c.heatTransferCoefficient,'熱伝達率h');hSource='direct';
 }else{
  const f=c.flow;
  if(!f||typeof f!=='object'||Array.isArray(f))throw Error('flow はオブジェクトで指定してください。');
  const flowAllowed=new Set(['velocity','density','viscosity','cp','conductivity','filmSurfaceTemperature']);
  if(Object.keys(f).some(key=>!flowAllowed.has(key)))throw Error('flow の未対応キーを暗黙に無視しません。');
  for(const key of ['velocity','density','viscosity','cp','conductivity'])positive(f[key],`flow.${key}`);
  const filmSurface=f.filmSurfaceTemperature===undefined?initialTemperature:positive(f.filmSurfaceTemperature,'flow.filmSurfaceTemperature');
  estimate=estimateWindHeatTransfer({geometry:'cylinder',velocity:f.velocity,density:f.density,viscosity:f.viscosity,cp:f.cp,conductivity:f.conductivity,characteristicLength:diameter,surfaceTemperature:filmSurface,freeStreamTemperature:fluidTemperature});
  h=estimate.h;hSource='wind-correlation';
 }
 const radius=diameter/2,biot=h*radius/k;
 if(biot>BIOT_LIMIT)throw Error(`Bi=hR/k=${biot} が本モデルの開発範囲上限 ${BIOT_LIMIT} を超えます。局所hの周方向分布が内部の角度方向温度分布として現れる領域であり、1次元放射＋周方向平均hの前提が崩れるため計算しません。`);
 const radial=createRadial({geometry:'cylinder',n:cells,radius,length,k,rho,cp,initial:initialTemperature,boundary:{type:'convection',h,temperature:fluidTemperature}});
 const area=Math.PI*diameter*length,volume=Math.PI*radius*radius*length,volumes=radial.mesh.volumes;
 const lumpedTimeConstant=rho*cp*volume/(h*area);
 function enrich(snap){
  let mean=0;for(let i=0;i<snap.temperature.length;i++)mean+=volumes[i]*snap.temperature[i];
  mean/=volume;
  return {modelType:LAW,law:LAW,releaseApproved:false,
   time:snap.time,steps:snap.steps,lastDt:snap.lastDt,
   temperature:snap.temperature,centres:[...radial.mesh.centres],
   surfaceTemperature:snap.surfaceTemperature,meanTemperature:mean,
   minTemperature:snap.min,maxTemperature:snap.max,
   surfaceInwardWatts:snap.outerInwardWatts,surfaceInwardFluxWPerM2:snap.outerInwardWatts/area,
   cumulativeInwardJoules:snap.netInput,energyJoules:snap.energy,energyReference:snap.energyReference,
   energyErrorJoules:snap.energyError,relativeEnergyError:snap.relativeEnergyError,
   heatTransferCoefficient:h,heatTransferSource:hSource,windEstimate:estimate,
   biotNumber:biot,lumpedTimeConstantSeconds:lumpedTimeConstant,
   surfaceAreaM2:area,volumeM3:volume,diameter,length,radius,
   solidConductivity:k,solidDensity:rho,solidCp:cp,
   initialTemperature,fluidTemperature,cells,safeDt:radial.safeDt,
   radialSnapshot:snap};
 }
 function snapshot(){return enrich(radial.snapshot());}
 function step(dt){
  positive(dt,'時間刻み');
  const sub=Math.max(1,Math.ceil(dt/radial.safeDt*(1+1e-9))),hstep=dt/sub;
  for(let i=0;i<sub;i++)radial.step(hstep,false);
  return snapshot();
 }
 function restore(s){
  if(!s||s.modelType!==LAW||!s.radialSnapshot)throw Error('復元する円柱横流れ過渡の状態が不正です。');
  return enrich(radial.restore(s.radialSnapshot));
 }
 function radialFlux(){return radial.flux();}
 return {step,snapshot,restore,radialFlux,
  config:{diameter,length,solidConductivity:k,solidDensity:rho,solidCp:cp,initialTemperature,fluidTemperature,cells,heatTransferCoefficient:h,heatTransferSource:hSource},
  get time(){return radial.time;},get safeDt(){return radial.safeDt;}};
}
