// Development-only estimation of the forced-convection heat transfer
// coefficient h from a free-stream velocity, using only the correlations
// printed in A Heat Transfer Textbook, 6th ed. (Lienhard):
//   flat plate (isothermal, average over the plate length)
//     laminar:            Nu_L = 0.664 Re_L^(1/2) Pr^(1/3)          (6.68)
//     liquid metal:       Nu_L = 1.13 Pe_L^(1/2)                    (6.69)
//     three-region (gas): Nu_L = 0.037 Pr^0.6 (Re_L^0.8 - Re_u^0.8)
//                         + 0.664 Re_l^(1/2) Pr^(1/3)
//                         + (1/c)[0.0296 Re_u^0.8 Pr^0.6
//                         - 0.332 Re_l^(1/2) Pr^(1/3)]              (6.120)
//                         with c = 0.9922 log10(Re_l) - 3.013       (6.115)
//     abrupt transition:  the reduction of (6.120) used in Example 6.11;
//                         for liquids the turbulent part is developed from
//                         the local power law (6.113), as the text suggests.
//   circular cylinder in cross flow (circumference average)
//     Pe_D <= 0.2:        Nu_D = 1 / (0.8237 - ln Pe_D^(1/2))       (7.67)
//     Re_D < 4000:        Nu_D = 0.3 + 0.62 Re_D^(1/2) Pr^(1/3)
//                              / [1 + (0.4/Pr)^(2/3)]^(1/4)         (7.66)
//     40000 < Re_D < 400000: same numerator times
//                              [1 + (Re_D/282000)^(1/2)]            (7.68)
//     otherwise:          Churchill-Bernstein full form             (7.65)
//                         (evaluated by the shared static model so the two
//                         implementations cannot drift apart)
// All properties are user-supplied values evaluated at the film temperature
// Tf = (Ts + Tinf)/2, exactly as in the textbook and the static models.
// Nothing is extrapolated: any input outside the printed range of the
// selected correlation is rejected with a Japanese reason, and h is never
// rescaled in proportion to velocity.  Fin surfaces are represented by a
// flat plate (plate fin) or a cylinder (pin fin); fin-to-fin interference,
// bypass flow, roughness, buoyancy and radiation are not modelled.
import {churchillBernsteinNu} from '../../cylinder-crossflow.mjs';

const LAW='wind-heat-transfer-correlation-v1';
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v;};

export function flatPlateLaminarNu(reynolds,prandtl){
 finite(reynolds,'平板のReynolds数',true);finite(prandtl,'Prandtl数',true);
 if(prandtl<0.6)throw Error('式(6.68)はPr≧0.6の範囲です。Pr<0.6の平均相関は教科書に示されていないため推定しません。');
 return finite(0.664*Math.sqrt(reynolds)*Math.cbrt(prandtl),'式(6.68)のNusselt数',true);
}

export function flatPlateLiquidMetalNu(peclet){
 finite(peclet,'平板のPéclet数',true);
 if(peclet<=100)throw Error('式(6.69)は式(6.62)と同条件でPe>100の範囲です。境界層近似が成立しないため推定しません。');
 return finite(1.13*Math.sqrt(peclet),'式(6.69)のNusselt数',true);
}

// transition: {type:'abrupt', reynolds} or {type:'observed', start, end}.
// 'observed' follows eqns. (6.115)/(6.120) and is presented by the textbook
// for gases only.
export function flatPlateMixedNu(reynolds,prandtl,fluidKind,transition){
 finite(reynolds,'平板のReynolds数',true);finite(prandtl,'Prandtl数',true);
 if(!['gas','liquid'].includes(fluidKind))throw Error('混合境界層の平均相関では流体種別（gas／liquid）が必要です。');
 if(prandtl<0.6)throw Error('混合平均の層流部分は式(6.68)と同じくPr≧0.6を必要とします。');
 if(!transition||typeof transition!=='object'||Array.isArray(transition))throw Error('遷移条件はオブジェクトで指定してください。');
 if(transition.type==='abrupt'){
  const rt=finite(transition.reynolds,'急峻遷移のReynolds数');
  if(rt<0||rt>=reynolds)throw Error('急峻遷移のReynolds数は0以上で板全体のReynolds数未満を指定してください。');
  const laminar=0.664*Math.sqrt(rt)*Math.cbrt(prandtl);
  const turbulent=fluidKind==='gas'
   ?0.037*prandtl**0.6*(reynolds**0.8-rt**0.8)
   :0.04*prandtl**0.43*(reynolds**0.8-rt**0.8);
  return {nusselt:finite(laminar+turbulent,'混合平均Nusselt数',true),
   correlation:fluidKind==='gas'?'6.120-abrupt':'6.120-abrupt-liquid',
   transitionSlope:null};
 }
 if(transition.type==='observed'){
  if(fluidKind!=='gas')throw Error('式(6.120)は気体について示された3領域平均です。液体の観測遷移には対応しません。');
  const start=finite(transition.start,'遷移開始Reynolds数',true),end=finite(transition.end,'遷移終了Reynolds数',true);
  if(start>500000)throw Error('式(6.115)は遷移開始Reynolds数が500,000以下の範囲です。');
  if(end<=start)throw Error('遷移終了Reynolds数は遷移開始Reynolds数より大きく指定してください。');
  if(end>reynolds)throw Error('遷移終了Reynolds数は板全体のReynolds数以下で指定してください。');
  const c=finite(0.9922*Math.log10(start)-3.013,'式(6.115)の遷移勾配c',true);
  const turbulent=0.037*prandtl**0.6*(reynolds**0.8-end**0.8);
  const laminar=0.664*Math.sqrt(start)*Math.cbrt(prandtl);
  const transitional=(0.0296*end**0.8*prandtl**0.6-0.332*Math.sqrt(start)*Math.cbrt(prandtl))/c;
  return {nusselt:finite(turbulent+laminar+transitional,'式(6.120)のNusselt数',true),
   correlation:'6.120',transitionSlope:c};
 }
 throw Error('遷移条件の型は abrupt（急峻遷移）または observed（観測された遷移開始・終了）です。');
}

// Churchill-Bernstein component selection exactly as printed in §7.6.
// The full form (7.65) is delegated to the static model implementation.
export function cylinderCrossflowNu(reynolds,prandtl){
 finite(reynolds,'円柱のReynolds数',true);finite(prandtl,'Prandtl数',true);
 if(reynolds>1e7)throw Error('円柱横流れ相関の確認範囲はRe_D≦10⁷です（教科書Fig. 7.11のデータ範囲と既存静的モデルの教育用制限に合わせた保守的上限）。');
 const peclet=finite(reynolds*prandtl,'円柱のPéclet数',true);
 if(peclet<=0.2)return {nusselt:finite(1/(0.8237-Math.log(Math.sqrt(peclet))),'式(7.67)のNusselt数',true),correlation:'7.67'};
 const numerator=0.62*Math.sqrt(reynolds)*Math.cbrt(prandtl)/(1+(0.4/prandtl)**(2/3))**0.25;
 if(reynolds<4000)return {nusselt:finite(0.3+numerator,'式(7.66)のNusselt数',true),correlation:'7.66'};
 if(reynolds>40000&&reynolds<400000)return {nusselt:finite(0.3+numerator*(1+Math.sqrt(reynolds/282000)),'式(7.68)のNusselt数',true),correlation:'7.68'};
 return {nusselt:finite(churchillBernsteinNu(reynolds,prandtl),'式(7.65)のNusselt数',true),correlation:'7.65'};
}

const GEOMETRIES=new Set(['flat-plate','cylinder','fin-plate','fin-pin']);
const REGIMES=new Set(['laminar','liquid-metal','mixed-abrupt','mixed-observed']);

export function estimateWindHeatTransfer(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('風速からの熱伝達率推定の条件はオブジェクトで指定してください。');
 const c=structuredClone(input);
 const allowed=new Set(['geometry','velocity','density','viscosity','cp','conductivity','characteristicLength','surfaceTemperature','freeStreamTemperature','regime','fluidKind','transitionReynolds','transitionStartReynolds','transitionEndReynolds']);
 if(Object.keys(c).some(key=>!allowed.has(key)))throw Error('未対応の物理条件を暗黙に無視しません。');
 if(!GEOMETRIES.has(c.geometry))throw Error('形状は flat-plate（平板）／cylinder（円柱）／fin-plate（平板フィン代表）／fin-pin（ピンフィン代表）です。');
 for(const key of ['velocity','density','viscosity','cp','conductivity','characteristicLength','surfaceTemperature','freeStreamTemperature'])finite(c[key],key,true);
 const representative=(c.geometry==='flat-plate'||c.geometry==='fin-plate')?'flat-plate':'cylinder';
 const nu=c.viscosity/c.density,alpha=c.conductivity/(c.density*c.cp);
 const reynolds=finite(c.density*c.velocity*c.characteristicLength/c.viscosity,'Reynolds数',true);
 const prandtl=finite(c.viscosity*c.cp/c.conductivity,'Prandtl数',true);
 const peclet=finite(reynolds*prandtl,'Péclet数',true);
 const warnings=[];
 let nusselt,correlation,transitionSlope=null;
 if(representative==='cylinder'){
  if(c.regime!==undefined||c.fluidKind!==undefined||c.transitionReynolds!==undefined||c.transitionStartReynolds!==undefined||c.transitionEndReynolds!==undefined)
   throw Error('円柱形状では境界層レジームや遷移条件は使用しません。Churchill–Bernstein系の構成式を教科書の範囲選択で適用します。');
  ({nusselt,correlation}=cylinderCrossflowNu(reynolds,prandtl));
 }else{
  let regime=c.regime;
  if(regime===undefined){
   if(peclet<=100)throw Error('Pe≦100では境界層近似が成立しないため、平板の平均相関は適用できません。');
   if(prandtl<0.6)throw Error('Pr<0.6では層流平均の式(6.68)は使えません。液体金属の場合は regime に liquid-metal を明示してください。');
   if(reynolds>500000)throw Error('Re_L>500,000では平板全体が層流とは言えません。regime に mixed-abrupt（遷移Reynolds数）または mixed-observed（観測された遷移開始・終了）を指定してください。根拠なく外挿しません。');
   regime='laminar';
  }
  if(!REGIMES.has(regime))throw Error('平板のレジームは laminar／liquid-metal／mixed-abrupt／mixed-observed です。');
  if(regime==='laminar'){
   if(peclet<=100)throw Error('Pe≦100では境界層近似が成立しないため、式(6.68)は適用できません。');
   if(reynolds>500000)throw Error('式(6.68)は平板全体が層流の範囲です。Re_L>500,000では遷移を含むレジームを指定してください。');
   nusselt=flatPlateLaminarNu(reynolds,prandtl);correlation='6.68';
   if(reynolds>200000)warnings.push('遷移はRe_x=2×10⁵〜5×10⁵で始まることが多い領域です（教科書§6.9）。流入乱れが大きいと層流相関は実測より低くなる場合があります。');
  }else if(regime==='liquid-metal'){
   if(c.fluidKind!==undefined&&c.fluidKind!=='liquid')throw Error('液体金属レジームは液体に対してのみ指定できます。');
   nusselt=flatPlateLiquidMetalNu(peclet);correlation='6.69';
  }else{
   const transition=regime==='mixed-abrupt'
    ?{type:'abrupt',reynolds:c.transitionReynolds}
    :{type:'observed',start:c.transitionStartReynolds,end:c.transitionEndReynolds};
   ({nusselt,correlation,transitionSlope}=flatPlateMixedNu(reynolds,prandtl,c.fluidKind,transition));
   if(regime==='mixed-abrupt')warnings.push('遷移域を省略した近似です。教科書の例題6.11が示すように、遷移Reynolds数の取り方で結果は±20%程度変わり得ます。');
  }
 }
 if(c.velocity>100)warnings.push('高速流では圧縮性（Mach数）の影響確認が必要です。本相関群は非圧縮境界層を前提とします。');
 if(c.geometry==='fin-plate'||c.geometry==='fin-pin')warnings.push('フィン面は代表形状（平板／円柱）として扱っています。フィン間干渉・バイパス流れ・フィン効率は含みません。推定hは表面の対流熱伝達率そのものです。');
 const h=finite(nusselt*c.conductivity/c.characteristicLength,'熱伝達率h',true);
 return {law:LAW,geometry:c.geometry,representativeGeometry:representative,
  filmTemperatureK:(c.surfaceTemperature+c.freeStreamTemperature)/2,
  kinematicViscosityM2PerS:nu,thermalDiffusivityM2PerS:alpha,
  reynolds,prandtl,peclet,nusselt,h,correlation,transitionSlope,
  inRange:true,warnings,
  assumptions:{propertiesAtFilmTemperature:true,constantProperties:true,isothermalSurface:true,smoothSurface:true,incompressibleFlow:true,radiationIncluded:false,buoyancyIncluded:false,finInterferenceResolved:false,fluidSolved:false},
  releaseApproved:false};
}

// Adapter: the estimated h is the uniform prescribed h that the fin and
// heat-sink development models accept.  This helper changes no existing
// file; it only extracts h together with its full estimation record.
export function heatSinkHFromWind(input){
 const estimate=estimateWindHeatTransfer(input);
 return {h:estimate.h,estimate};
}
