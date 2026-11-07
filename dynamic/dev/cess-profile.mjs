// Development-only constant-property, fully developed plane-channel mean flow.
// Independently implemented quadrature of the published algebraic closure;
// no third-party RANS solver, code, figures or DNS tables are redistributed.
export const CESS_PARAMETERS=Object.freeze({kappa:.426,dampingAPlus:25.4});
export const CESS_DNS_CASES=Object.freeze([
 Object.freeze({id:'MKM180',nominalReTau:180,reTau:178.12}),
 Object.freeze({id:'MKM395',nominalReTau:395,reTau:392.24}),
 Object.freeze({id:'MKM590',nominalReTau:590,reTau:587.19})
]);
const positive=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<=0)throw Error(name+'は正の有限値です。');return v;};
export function cessEddyRatio(distanceOverHalfGap,reTau){
 const d=distanceOverHalfGap;if(typeof d!=='number'||!Number.isFinite(d)||d<0||d>1||typeof reTau!=='number'||!Number.isFinite(reTau)||reTau<0||reTau>1e4)throw Error('Cess式の壁距離は0〜1、Reτは0〜10000です。式の定義域と検証範囲は別です。');
 const r=1-d,shape=d*(2-d)*(1+2*r*r),damping=-Math.expm1(-d*reTau/CESS_PARAMETERS.dampingAPlus),s=CESS_PARAMETERS.kappa*reTau*shape*damping/3;
 // Rationalize (sqrt(1+s²)-1)/2 to retain small positive eddy viscosity.
 return s*s/(2*(Math.hypot(1,s)+1));
}
function gaussRule(order){
 const nodes=Array(order),weights=Array(order),polynomial=x=>{let prev=1,current=x;for(let k=2;k<=order;k++){const next=((2*k-1)*x*current-(k-1)*prev)/k;prev=current;current=next;}return {value:current,derivative:order*(x*current-prev)/(x*x-1)};};
 for(let i=0;i<order/2;i++){
  let root=Math.cos(Math.PI*(i+.75)/(order+.5));for(let k=0;k<32;k++){const p=polynomial(root),next=root-p.value/p.derivative;if(Math.abs(next-root)<=4*Number.EPSILON){root=next;break;}if(k===31)throw Error('Gauss積分点が収束しません。');root=next;}
  const p=polynomial(root),weight=2/((1-root*root)*p.derivative*p.derivative);nodes[i]=-root;nodes[order-1-i]=root;weights[i]=weights[order-1-i]=weight;
 }return {nodes,weights};
}
const rules=new Map([8,16].map(order=>[order,gaussRule(order)]));
export function createCessProfile({caseId,halfGap,nu,rho,rows=64,direction=1,quadratureOrder=16}){
 const selected=CESS_DNS_CASES.find(c=>c.id===caseId);if(!selected)throw Error('開発用Cess平均流はMKM180/MKM395/MKM590の3条件だけです。');
 for(const [name,value]of Object.entries({halfGap,nu,rho}))positive(value,name);
 if(!Number.isSafeInteger(rows)||rows<8||rows>128||rows%2||![-1,1].includes(direction)||!rules.has(quadratureOrder))throw Error('平均流の全高さは偶数8〜128行、向きは±1、積分次数は8/16です。');
 const {reTau}=selected,H=2*halfGap,uTau=reTau*(nu/halfGap),acceleration=direction*uTau*(uTau/halfGap),wallShearMagnitude=rho*uTau*uTau,{nodes,weights}=rules.get(quadratureOrder);
 if(![H,uTau,Math.abs(acceleration),wallShearMagnitude].every(v=>Number.isFinite(v)&&v>0))throw Error('平均流の寸法・壁面せん断・圧力勾配が数値範囲外です。');
 const effective=d=>1+cessEddyRatio(d,reTau),shearPlus=d=>reTau*(1-d)/effective(d);
 function integrate(f,a,b){
  if(a===b)return 0;const count=Math.max(1,Math.ceil((b-a)*reTau/4));let value=0;
  for(let j=0;j<count;j++){const lo=a+(b-a)*j/count,hi=a+(b-a)*(j+1)/count,mid=(lo+hi)/2,half=(hi-lo)/2;for(let k=0;k<nodes.length;k++)value+=half*weights[k]*f(mid+half*nodes[k]);}return value;
 }
 const velocityPlus=d=>integrate(shearPlus,0,d),bulkPlus=integrate(s=>(1-s)*shearPlus(s),0,1),bulkVelocity=direction*uTau*bulkPlus;
 const rowVelocity=Array(rows),eddyRatioAtCenters=Array(rows);
 for(let j=0;j<rows/2;j++){
  const a=2*j/rows,b=2*(j+1)/rows,averagePlus=velocityPlus(a)+integrate(s=>(b-s)*shearPlus(s),a,b)/(b-a),u=direction*uTau*averagePlus,e=cessEddyRatio((a+b)/2,reTau);
  rowVelocity[j]=rowVelocity[rows-1-j]=u;eddyRatioAtCenters[j]=eddyRatioAtCenters[rows-1-j]=e;
 }
 function wallDistance(y){if(typeof y!=='number'||!Number.isFinite(y)||y< -16*Number.EPSILON*H||y>H*(1+16*Number.EPSILON))throw Error('平均流の位置は0〜全高さです。');const bounded=Math.max(0,Math.min(H,y));return Math.min(bounded,H-bounded)/halfGap;}
 function pointVelocity(y){return direction*uTau*velocityPlus(wallDistance(y))||0;}
 function velocityGradient(y){const d=wallDistance(y),slope=direction*(uTau/halfGap)*shearPlus(d)*Math.sign(halfGap-y);return slope||0;}
 const faces=Array.from({length:rows+1},(_,j)=>H*j/rows),effectiveNuAtFaces=faces.map(y=>nu*effective(wallDistance(y))),totalShearAtFaces=faces.map((y,j)=>rho*effectiveNuAtFaces[j]*velocityGradient(y)),bulkFromCellMeans=rowVelocity.reduce((s,u)=>s+u/rows,0),pressureGradient=-rho*acceleration;
 if(!Number.isFinite(pressureGradient)||pressureGradient===0)throw Error('平均流の駆動圧力勾配が浮動小数点で解像できません。');
 const meta={caseId,nominalReTau:selected.nominalReTau,reTau,halfGap,fullHeight:H,nu,rho,rows,direction,quadratureOrder,maximumQuadratureWallUnitSpan:4,uTau,bulkVelocity,centerVelocity:pointVelocity(halfGap),bulkVelocityPlus:bulkPlus,wallShearMagnitude,pressureGradientPaPerM:pressureGradient,acceleration,meanMechanicalPowerDensityWPerM3:-pressureGradient*bulkVelocity,bulkReynoldsFullGap:2*reTau*bulkPlus,bulkReynoldsHydraulicDiameter:4*reTau*bulkPlus,skinFrictionCoefficient:2/bulkPlus**2,DarcyFrictionFactor:8/bulkPlus**2,cellMeanBulkDifference:bulkFromCellMeans-bulkVelocity};
 if([...Object.values(meta).filter(v=>typeof v==='number'),...rowVelocity,...eddyRatioAtCenters,...effectiveNuAtFaces,...totalShearAtFaces].some(v=>!Number.isFinite(v)))throw Error('Cess平均流の出力が数値範囲外です。');
 return {meta,faces,rowVelocity,eddyRatioAtCenters,effectiveNuAtFaces,totalShearAtFaces,pointVelocity,velocityGradient,eddyRatioAt:y=>cessEddyRatio(wallDistance(y),reTau),meanFlowSteady:true,fluctuationsResolved:false,releaseApproved:false};
}
