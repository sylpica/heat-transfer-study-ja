// Development-only steady Graetz-type thermal entrance solver. Momentum is a
// prescribed steady plane-Poiseuille profile, not a general 2D CFD solution.
// The temperature field is marched downstream with first-order upwind cell
// balances in x and an implicit (tridiagonal) transverse diffusion solve.
// Axial conduction is omitted by model assumption. releaseApproved=false.
const LAW='graetz-steady-poiseuille-two-wall-v2';
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v===0?0:v;};
function sum(values){let s=0,e=0;for(const v of values){const y=v-e,t=s+y;e=(t-s)-y;s=t;}return s;}
// Thomas algorithm for a tridiagonal system. a: sub-diagonal (a[0] unused),
// b: diagonal, c: super-diagonal (c[n-1] unused), d: right-hand side.
function solveTridiagonal(a,b,c,d){
 const n=b.length,cp=new Float64Array(n),dp=new Float64Array(n);
 cp[0]=c[0]/b[0];dp[0]=d[0]/b[0];
 for(let j=1;j<n;j++){const m=b[j]-a[j]*cp[j-1];if(m===0||!Number.isFinite(m))throw Error('横断方向の陰的解法が破綻しました。');cp[j]=j<n-1?c[j]/m:0;dp[j]=(d[j]-a[j]*dp[j-1])/m;}
 const x=new Float64Array(n);x[n-1]=dp[n-1];for(let j=n-2;j>=0;j--)x[j]=dp[j]-cp[j]*x[j+1];return x;
}
export function solveGraetzChannel(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('流路条件はオブジェクトです。');
 const c=structuredClone(input),allowed=new Set(['width','height','depth','nx','ny','dxGrowth','rho','cp','k','nu','bulkVelocity','inletTemperature','boundary','maxTemperature']);
 if(Object.keys(c).some(key=>!allowed.has(key)))throw Error('未対応の物理条件を暗黙に無視しません。');
 const {nx,ny}=c;if(!Number.isSafeInteger(nx)||nx<4||nx>2048||!Number.isSafeInteger(ny)||ny<4||ny>256)throw Error('流路格子は流れ方向4〜2048、横断方向4〜256です。');
 for(const key of ['width','height','depth','rho','cp','k','nu','bulkVelocity'])finite(c[key],key,true);
 const growth=c.dxGrowth??1;if(typeof growth!=='number'||!Number.isFinite(growth)||growth<1||growth>1.25)throw Error('dxGrowthは1〜1.25です。');
 const L=c.width,H=c.height,depth=c.depth,U=c.bulkVelocity,Dh=finite(2*H,'水力直径',true),alpha=finite(c.k/(c.rho*c.cp),'熱拡散率',true),Re=finite(U*Dh/c.nu,'Re_Dh',true),Pr=finite(c.nu/alpha,'Pr',true),Pe=finite(Re*Pr,'Pe_Dh',true);
 if(Re>2300)throw Error('層流域の目安として設定したRe_Dh上限2300を超えます。');
 if(Pe<100)throw Error('軸方向熱伝導を省略する開発モデルはPe_Dh≥100に限定します。');
 const Tin=finite(c.inletTemperature,'入口温度[K]',true),limit=finite(c.maxTemperature??10000,'温度監視上限',true);
 if(Tin>limit)throw Error('入口温度が監視上限を超えます。');
 const bnd=c.boundary;if(!bnd||typeof bnd!=='object'||Array.isArray(bnd))throw Error('境界条件はオブジェクトです。');
 let bcType,wallTemperature=null,wallHeatFlux=null;
 if(bnd.type==='wall-temperature'){
  if(Object.keys(bnd).some(key=>!['type','wallTemperature'].includes(key)))throw Error('未対応の境界条件を暗黙に無視しません。');
  bcType='wall-temperature';wallTemperature=finite(bnd.wallTemperature,'壁温[K]',true);if(wallTemperature>limit)throw Error('壁温が監視上限を超えます。');
 }else if(bnd.type==='wall-heat-flux'){
  if(Object.keys(bnd).some(key=>!['type','wallHeatFlux'].includes(key)))throw Error('未対応の境界条件を暗黙に無視しません。');
  bcType='wall-heat-flux';wallHeatFlux=finite(bnd.wallHeatFlux,'両壁の流入熱流束');
 }else if(bnd.type==='wall-heat-flux-insulated'){
  if(Object.keys(bnd).some(key=>!['type','wallHeatFlux'].includes(key)))throw Error('未対応の境界条件を暗黙に無視しません。');
  bcType='wall-heat-flux-insulated';wallHeatFlux=finite(bnd.wallHeatFlux,'下壁の流入熱流束');
 }else throw Error('境界条件はwall-temperature、wall-heat-fluxまたはwall-heat-flux-insulatedです。');
 // x grid: uniform when growth=1, otherwise geometric with ratio growth.
 const dxWidths=new Float64Array(nx);
 if(growth===1)dxWidths.fill(L/nx);
 else{const first=L*(growth-1)/(growth**nx-1);if(!Number.isFinite(first)||first<=0)throw Error('流れ方向の格子幅を構成できません。');for(let i=0;i<nx;i++)dxWidths[i]=first*growth**i;}
 const xFaces=new Float64Array(nx+1),xCenters=new Float64Array(nx);
 for(let i=0;i<nx;i++){xCenters[i]=xFaces[i]+dxWidths[i]/2;xFaces[i+1]=xFaces[i]+dxWidths[i];}
 const dy=H/ny;
 // Analytic cell means of u=6U z(1-z) over each transverse cell (z=y/H).
 const rowVelocity=Float64Array.from({length:ny},(_,j)=>{const a=j/ny,bb=(j+1)/ny;return finite(6*U*((a+bb)/2-(a*a+a*bb+bb*bb)/3),'Poiseuille行平均速度',true);});
 const rowCapacityFlow=Float64Array.from(rowVelocity,u=>finite(c.rho*c.cp*u*dy*depth,'行の熱容量流量',true));
 const totalCapacityFlow=finite(sum(rowCapacityFlow),'全熱容量流量',true);
 const massFlow=finite(c.rho*dy*depth*sum(rowVelocity),'質量流量',true);
 const T=new Float64Array(nx*ny);
 let previous=Float64Array.from({length:ny},()=>Tin);
 const bulkTemperature=new Float64Array(nx),localNusselt=new Array(nx).fill(null);
 const lowerWallTemperature=new Float64Array(nx),upperWallTemperature=new Float64Array(nx);
 const lowerWallHeatFlux=new Float64Array(nx),upperWallHeatFlux=new Float64Array(nx);
 let wallHeatTotal=0;
 const a=new Float64Array(ny),bb=new Float64Array(ny),cc=new Float64Array(ny),dd=new Float64Array(ny);
 for(let i=0;i<nx;i++){
  const dx=dxWidths[i];
  for(let j=0;j<ny;j++){
   const r=alpha*dx/(rowVelocity[j]*dy*dy);
   a[j]=j>0?-r:0;cc[j]=j<ny-1?-r:0;bb[j]=1+r*((j>0?1:0)+(j<ny-1?1:0));dd[j]=previous[j];
   if(j===0||j===ny-1){
    if(bcType==='wall-heat-flux'){dd[j]+=wallHeatFlux*dx/(c.rho*c.cp*rowVelocity[j]*dy);}
    else if(bcType==='wall-heat-flux-insulated'){if(j===0)dd[j]+=wallHeatFlux*dx/(c.rho*c.cp*rowVelocity[j]*dy);}
    else{bb[j]+=2*r;dd[j]+=2*r*wallTemperature;}
   }
  }
  const solved=solveTridiagonal(a,bb,cc,dd);
  for(let j=0;j<ny;j++){const t=solved[j];if(!Number.isFinite(t)||t<=0||t>limit)throw Error('流路温度が監視範囲を外れたため受理しません。');T[j*nx+i]=t;}
  previous=solved;
  const tb=finite(sum(Array.from({length:ny},(_,j)=>rowCapacityFlow[j]*solved[j]))/totalCapacityFlow,'断面バルク温度',true);
  bulkTemperature[i]=tb;
  let qLower,qUpper,tLower,tUpper;
  if(bcType==='wall-heat-flux'){
   qLower=qUpper=wallHeatFlux;
   tLower=finite(solved[0]+wallHeatFlux*dy/(2*c.k),'下壁の再構成温度',true);
   tUpper=finite(solved[ny-1]+wallHeatFlux*dy/(2*c.k),'上壁の再構成温度',true);
  }else if(bcType==='wall-heat-flux-insulated'){
   qLower=wallHeatFlux;qUpper=0;
   tLower=finite(solved[0]+wallHeatFlux*dy/(2*c.k),'下壁の再構成温度',true);
   // Adiabatic wall: zero transverse gradient, so the wall-face value is the
   // adjacent cell mean to O(dy^3) in the developed profile (T_yy=0 at the
   // wall because u=0 there); no half-cell conduction step is applied.
   tUpper=finite(solved[ny-1],'断熱上壁の温度（隣接セル値）',true);
  }else{
   tLower=tUpper=wallTemperature;
   qLower=finite(c.k*(wallTemperature-solved[0])/(dy/2),'下壁熱流束');
   qUpper=finite(c.k*(wallTemperature-solved[ny-1])/(dy/2),'上壁熱流束');
  }
  if(tLower>limit||tUpper>limit)throw Error('再構成した壁温が監視上限を超えました。');
  lowerWallTemperature[i]=tLower;upperWallTemperature[i]=tUpper;lowerWallHeatFlux[i]=qLower;upperWallHeatFlux[i]=qUpper;
  wallHeatTotal=finite(wallHeatTotal+(qLower+qUpper)*dx*depth,'壁からの累積熱量率');
  // Nusselt number (Dh basis). Symmetric cases use the two-wall mean flux and
  // mean wall temperature; the one-sided case uses the heated (lower) wall
  // only, matching the textbook definition behind eq. (7.63) Nu=5.385.
  let nuFlux,nuDeltaT;
  if(bcType==='wall-heat-flux-insulated'){nuFlux=qLower;nuDeltaT=tLower-tb;}
  else{nuFlux=(qLower+qUpper)/2;nuDeltaT=bcType==='wall-heat-flux'?(tLower+tUpper)/2-tb:wallTemperature-tb;}
  if(nuFlux!==0&&nuDeltaT!==0&&Math.abs(nuDeltaT)>1e-12*Math.max(1,Math.abs(Tin),wallTemperature??0))localNusselt[i]=finite(nuFlux*Dh/(c.k*nuDeltaT),'局所Nu');
 }
 const outletBulk=bulkTemperature[nx-1];
 const fluidHeat=finite(totalCapacityFlow*(outletBulk-Tin),'流体の顕熱増加率');
 const balanceResidual=finite(wallHeatTotal-fluidHeat,'収支残差');
 const heatScale=Math.max(Math.abs(wallHeatTotal),Math.abs(fluidHeat));
 const definedNu=localNusselt.map((v,i)=>[v,i]).filter(([v])=>v!==null);
 const meanNusselt=definedNu.length?finite(sum(definedNu.map(([v,i])=>v*dxWidths[i]))/sum(definedNu.map(([,i])=>dxWidths[i])),'平均Nu'):null;
 return {
  law:LAW,releaseApproved:false,
  config:structuredClone(c),
  mesh:{kind:'steady-poiseuille-x-marching',nx,ny,width:L,height:H,depth,dy,dxWidths:Array.from(dxWidths),xCenters:Array.from(xCenters),count:nx*ny},
  meanFlow:{bulkVelocity:U,hydraulicDiameter:Dh,reynoldsDh:Re,prandtl:Pr,pecletDh:Pe,massFlowKgPerS:massFlow,analyticMassFlowKgPerS:finite(c.rho*U*H*depth,'解析質量流量',true),pressureGradientPaPerM:finite(-12*c.rho*c.nu*U/H**2,'既知の駆動圧力勾配'),wallShearMagnitudePa:finite(6*c.rho*c.nu*U/H,'壁せん断応力',true)},
  boundary:{type:bcType,wallTemperature,wallHeatFlux,heatedWall:bcType==='wall-heat-flux-insulated'?'lower':null,adiabaticWall:bcType==='wall-heat-flux-insulated'?'upper':null},
  temperature:Array.from(T),rowVelocity:Array.from(rowVelocity),
  bulkTemperature:Array.from(bulkTemperature),localNusselt,
  lowerWallTemperature:Array.from(lowerWallTemperature),upperWallTemperature:Array.from(upperWallTemperature),
  lowerWallHeatFlux:Array.from(lowerWallHeatFlux),upperWallHeatFlux:Array.from(upperWallHeatFlux),
  dimensionlessLength:Array.from(xCenters,x=>x/(Dh*Pe)),
  outlet:{bulkTemperature:outletBulk,localNusselt:localNusselt[nx-1],wallTemperatureMean:(lowerWallTemperature[nx-1]+upperWallTemperature[nx-1])/2},
  meanNusselt,totalWallHeatRateW:wallHeatTotal,fluidHeatRateW:fluidHeat,
  energyBalanceResidualW:balanceResidual,energyBalanceRelativeResidual:heatScale>0?Math.abs(balanceResidual)/heatScale:Math.abs(balanceResidual),
  assumptions:{steadyState:true,steadyFullyDevelopedPoiseuille:true,thermalEntranceResolved:true,axialConductionOmitted:true,constantProperties:true,hydrodynamicEntranceResolved:false,generalTwoDimensionalMomentumResolved:false,bulkTemperatureUsesProductOfRowMeans:true,wallTemperatureHalfCellReconstruction:bcType!=='wall-temperature',wallFluxHalfCellDifference:bcType==='wall-temperature',wallsAreSymmetric:bcType!=='wall-heat-flux-insulated',adiabaticWallTemperatureIsAdjacentCellValue:bcType==='wall-heat-flux-insulated',inletIsPrescribedFaceValue:true}
 };
}
