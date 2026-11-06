// Unpublished steady boundary-layer approximation, NOT an unsteady NS solver.
const ETA_MAX=12, INTERVALS=8192, finite=(v,name,positive=false)=>{
 if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v===0?0:v;
};
const sum=values=>{let value=0,correction=0;for(const term of values){const y=term-correction,next=value+y;correction=(next-value)-y;value=next;}return finite(value,'積分');};
let table=null;
function integrate(wallCurvature,collect=false){
 const h=ETA_MAX/INTERVALS;let f=0,g=0,s=wallCurvature;const fs=collect?[0]:null,gs=collect?[0]:null;
 for(let i=0;i<INTERVALS;i++){
  const a=g,b=s,c=-.5*f*s,f2=f+h*a/2,g2=g+h*b/2,s2=s+h*c/2,
   a2=g2,b2=s2,c2=-.5*f2*s2,f3=f+h*a2/2,g3=g+h*b2/2,s3=s+h*c2/2,
   a3=g3,b3=s3,c3=-.5*f3*s3,f4=f+h*a3,g4=g+h*b3,s4=s+h*c3,
   a4=g4,b4=s4,c4=-.5*f4*s4;
  f+=h*(a+2*a2+2*a3+a4)/6;g+=h*(b+2*b2+2*b3+b4)/6;s+=h*(c+2*c2+2*c3+c4)/6;
  if(collect){fs.push(f);gs.push(g);}
 }
 return {f,fp:g,fpp:s,fs,gs};
}
function similarityTable(){
 if(table)return table;
 let low=.2,high=.5;for(let i=0;i<60;i++){const middle=(low+high)/2;if(middle===low||middle===high)break;if(integrate(middle).fp>1)high=middle;else low=middle;}
 const wallCurvature=(low+high)/2,result=integrate(wallCurvature,true);
 if(!Number.isFinite(result.fp)||Math.abs(result.fp-1)>1e-12||result.fs.some(x=>!Number.isFinite(x)))throw Error('Blasius射撃の終端条件を満たしません。');
 table={...result,wallCurvature,h:ETA_MAX/INTERVALS};return table;
}
export function blasiusSimilarity(eta){
 finite(eta,'相似座標η');if(eta<0)throw Error('相似座標ηは0以上です。');const t=similarityTable();
 if(eta>=ETA_MAX)return {f:finite(t.f+(eta-ETA_MAX),'遠方の相似関数'),fp:1};
 const i=Math.floor(eta/t.h),z=eta/t.h-i,f0=t.fs[i],f1=t.fs[i+1],g0=t.gs[i],g1=t.gs[i+1],a=t.h*g0,b=3*(f1-f0)-t.h*(2*g0+g1),c=2*(f0-f1)+t.h*(g0+g1);
 return {f:f0+z*(a+z*(b+z*c)),fp:(a+z*(2*b+3*z*c))/t.h};
}
export function createBlasiusBoundaryFlow(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('平板外部流れの条件が必要です。');
 const c=structuredClone(input),allowed=new Set(['width','height','depth','nx','ny','nu','rho','freeStreamVelocity']);
 if(Object.keys(c).some(key=>!allowed.has(key)))throw Error('未対応の流れ条件を暗黙に無視しません。');
 const {nx,ny}=c;if(!Number.isSafeInteger(nx)||nx<4||nx>512||!Number.isSafeInteger(ny)||ny<8||ny>128)throw Error('流れ格子は横4〜512、縦8〜128です。');
 for(const key of ['width','height','depth','nu','rho','freeStreamVelocity'])finite(c[key],key,true);
 const L=c.width,H=c.height,D=c.depth,U=c.freeStreamVelocity,Re=finite(U*L/c.nu,'Re_L',true),outerEta=finite(H*Math.sqrt(U/(c.nu*L)),'外側η',true);
 const inside=(x,low,high)=>x>=low*(1-8*Number.EPSILON)&&x<=high*(1+8*Number.EPSILON);
 if(!inside(Re,1e4,1e5)||H/L>.2*(1+8*Number.EPSILON)||!inside(outerEta,10,24))throw Error('平板の開発範囲は10⁴≤Re_L≤10⁵、H/L≤.2、外端η=10〜24です。');
 const dx=finite(L/nx,'dx',true),dy=finite(H/ny,'dy',true),volume=finite(dx*dy*D,'セル体積',true),t=similarityTable(),psi=[];
 for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
  const x=i*dx,y=j*dy;
  psi.push(finite(i===0?U*y:j===0?0:Math.sqrt(finite(c.nu*U*x,'ψの尺度',true))*blasiusSimilarity(finite(y*Math.sqrt(U/(c.nu*x)),'η')).f,'流れ関数'));
 }
 const qx=[],qy=[],u=[],v=[];
 for(let j=0;j<ny;j++)for(let i=0;i<=nx;i++){
  const q=finite((psi[(j+1)*(nx+1)+i]-psi[j*(nx+1)+i])*D,'x面体積流量');qx.push(q);u.push(finite(q/finite(dy*D,'x面積',true),'x面平均速度'));
 }
 for(let j=0;j<=ny;j++)for(let i=0;i<nx;i++){
  const q=finite(-(psi[j*(nx+1)+i+1]-psi[j*(nx+1)+i])*D,'y面体積流量');qy.push(q);v.push(finite(q/finite(dx*D,'y面積',true),'y面平均速度'));
 }
 const inlet=sum(Array.from({length:ny},(_,j)=>qx[j*(nx+1)])),outlet=sum(Array.from({length:ny},(_,j)=>qx[j*(nx+1)+nx])),upper=sum(qy.slice(ny*nx)),boundaryScale=finite(Math.abs(inlet)+Math.abs(outlet)+Math.abs(upper),'領域流量尺度',true),gradientScale=finite(U/dx+v.reduce((m,x)=>Math.max(m,Math.abs(x)),0)/dy,'流れの勾配尺度',true);
 let maximumCellVolumeFluxImbalance=0;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)maximumCellVolumeFluxImbalance=Math.max(maximumCellVolumeFluxImbalance,Math.abs(qx[j*(nx+1)+i+1]-qx[j*(nx+1)+i]+qy[(j+1)*nx+i]-qy[j*nx+i]));
 const normalizedDivergence=finite(maximumCellVolumeFluxImbalance/volume/gradientScale,'正規化発散'),boundaryResidual=finite(inlet-outlet-upper,'領域流量差'),boundaryRelativeResidual=Math.abs(boundaryResidual)/boundaryScale;
 if(normalizedDivergence>1e-12||boundaryRelativeResidual>1e-12||u.some(x=>x<0)||v.some(x=>x<0))throw Error('平板流れの流量・方向の検査を満たしません。');
 // These are cell means of the similarity wall shear; the point value at x=0
 // is singular and is never assigned a finite number or used as a maximum.
 const shear=Array.from({length:nx},(_,i)=>finite(2*c.rho*U*U*t.wallCurvature*Math.sqrt(c.nu/U)/(Math.sqrt((i+1)*dx)+Math.sqrt(i*dx)),'板区間平均の壁せん断',true)),wallForce=finite(sum(shear)*dx*D,'壁せん断力',true),meanCf=finite(wallForce/(L*D*(.5*c.rho*U*U)),'平均摩擦係数',true);
 return Object.freeze({
  kind:'steady-Blasius-boundary-layer-development-flow',config:Object.freeze(c),mesh:Object.freeze({nx,ny,width:L,height:H,depth:D,dx,dy,cellVolume:volume}),
  u:Object.freeze(u),v:Object.freeze(v),xVolumeFluxM3PerS:Object.freeze(qx),yVolumeFluxM3PerS:Object.freeze(qy),streamfunctionM2PerS:Object.freeze(psi),wallShearCellMeansPa:Object.freeze(shear),
  diagnostics:Object.freeze({Re_L:Re,outerEta,inputRangeRelativeRoundoffBudget:8*Number.EPSILON,wallCurvature:t.wallCurvature,finiteEtaMax:ETA_MAX,similarityIntervals:INTERVALS,shootingTerminalSlopeError:t.fp-1,finiteTailCurvature:t.fpp,inletVolumeFlowM3PerS:inlet,outletVolumeFlowM3PerS:outlet,upperOutflowM3PerS:upper,positiveBoundaryFlowL1ScaleM3PerS:boundaryScale,boundaryVolumeFlowResidualM3PerS:boundaryResidual,boundaryRelativeResidual,maximumCellVolumeFluxImbalanceM3PerS:maximumCellVolumeFluxImbalance,normalizedDivergence,wallShearForceN:wallForce,meanFrictionCoefficient:meanCf}),
  assumptions:Object.freeze({steadyBoundaryLayerApproximation:true,zeroPressureGradient:true,laminar:true,uniformExternalVelocity:true,constantProperties:true,finiteOuterBoundary:true,leadingEdgeVelocityLimitIsSingular:true,unsteadyMomentumSolved:false,fullNavierStokesSolved:false,temperatureTransportImplemented:false,wallShearIsSimilarityIntervalAverage:true,generalCFDAccuracyVerified:false}),releaseApproved:false,
 });
}
