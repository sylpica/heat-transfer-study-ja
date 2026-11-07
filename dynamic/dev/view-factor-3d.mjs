// Development-only view factors for a three-dimensional enclosure made of
// six axis-aligned rectangular faces (a rectangular box).  General shapes,
// curved surfaces, openings and participating media are out of scope.
//
// Method: the defining double area integral, eqn. (10.17a) of A Heat
// Transfer Textbook, 6th ed.,
//   F_i-j = (1/(pi A_i)) ∬ cos(beta_i) cos(beta_j) / S^2 dA_j dA_i,
// is evaluated numerically.  For a pair of rectangles the kernel depends
// on the in-plane point coordinates only through their separations, so
// the integrations along each translation-invariant direction are carried
// out exactly (an exact reduction of the same integral, not an
// approximation and not a tabulated formula):
//   * Opposite (parallel) faces: with separations (dx, dy) the integral
//     becomes a 2D integral with tent weights (a-|dx|)(b-|dy|) and kernel
//     c^2/(dx^2+dy^2+c^2)^2, evaluated by tensor Gauss-Legendre panels
//     whose widths grow geometrically away from dx=dy=0, where the kernel
//     is concentrated on the scale of the separation c.
//   * Adjacent (perpendicular) faces sharing an edge of length L: exact
//     reduction along the edge replaces the kernel by atan(L/rho)/rho^3
//     over the two extents (v, w) from the edge, rho = hypot(v, w), and
//     the radial integral in polar coordinates about the shared corner is
//     also exact, leaving a single integral over the polar angle phi of
//     cos(phi) sin(phi) r_max(phi) G(L/r_max(phi)), with
//     G(a) = atan(a) + (a/2) ln(1 + a^-2) = ∫_0^1 atan(a/t) dt.
//     It is evaluated by Gauss-Legendre panels graded toward the diagonal
//     angle phi* = atan2(eTo, eFrom), where r_max switches faces and
//     G has a logarithmic kink.  The corner singularity of the original
//     kernel is removed analytically by these reductions.
// A direct tensor-product quadrature of the unreduced 4D integral was
// measured during development to stagnate at ~1e-2 error for edge-sharing
// pairs (the near-edge peak is narrower than any affordable panel), which
// is why the exact reductions above are used.  No summation-rule
// renormalisation or clipping is applied to the results; the residuals
// are reported in the diagnostics exactly as computed.
const EPS=Number.EPSILON;
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v===0?0:v;};
const sum=values=>{let s=0,c=0;for(const v of values){const y=v-c,t=s+y;c=(t-s)-y;s=t;}return finite(s,'合計');};
function keys(input,allowed){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('直方体形態係数の対応した条件だけを指定してください。');}
function integerIn(v,name,min,max){if(!Number.isSafeInteger(v)||v<min||v>max)throw Error(`${name}は${min}〜${max}の整数です。`);return v;}

// Gauss-Legendre nodes/weights on [-1, 1] by Newton iteration on P_n.
function gaussLegendre(order){
 const nodes=new Float64Array(order),weights=new Float64Array(order);
 for(let i=0;i<Math.ceil(order/2);i++){
  let z=Math.cos(Math.PI*(i+.75)/(order+.5));
  for(let it=0;it<100;it++){
   let p0=1,p1=0;for(let j=0;j<order;j++){const p2=p1;p1=p0;p0=((2*j+1)*z*p1-j*p2)/(j+1);}
   const dp=order*(z*p0-p1)/(z*z-1),dz=-p0/dp;z+=dz;if(Math.abs(dz)<4*EPS)break;
  }
  let p0=1,p1=0;for(let j=0;j<order;j++){const p2=p1;p1=p0;p0=((2*j+1)*z*p1-j*p2)/(j+1);}
  const dp=order*(z*p0-p1)/(z*z-1),w=2/((1-z*z)*dp*dp);
  nodes[i]=-z;nodes[order-1-i]=z;weights[i]=w;weights[order-1-i]=w;
 }
 return {nodes,weights};
}
function panelPoints(edges,order){
 const {nodes,weights}=gaussLegendre(order),points=[],wts=[];
 for(let p=0;p<edges.length-1;p++){
  const mid=(edges[p]+edges[p+1])/2,half=(edges[p+1]-edges[p])/2;
  for(let i=0;i<order;i++){points.push(mid+half*nodes[i]);wts.push(half*weights[i]);}
 }
 return {points,wts};
}
function uniformEdges(a,b,panels){const e=[];for(let p=0;p<=panels;p++)e.push(a+(b-a)*p/panels);return e;}
// Panel edges on [a, b] with panel widths shrinking toward one end
// (power grading with exponent 3): 'hi' clusters near b, 'lo' near a.
function gradedEdges(a,b,panels,toward){
 const e=[];
 for(let p=0;p<=panels;p++){
  const s=p/panels,mapped=toward==='hi'?1-Math.pow(1-s,3):Math.pow(s,3);
  e.push(a+(b-a)*mapped);
 }
 return e;
}
// Separation axis on [0, L] for the parallel-pair kernel, whose width is
// set by the face separation c: panel widths grow geometrically from
// ~c/6, then the widest panels are bisected until `panels` panels exist.
function separationEdges(L,c,panels){
 const edges=[0];let width=Math.min(L,c)/6;
 while(edges.at(-1)<L&&edges.length<512){
  edges.push(Math.min(L,edges.at(-1)+width));width*=1.45;
 }
 while(edges.length-1<panels){
  let widest=0;for(let p=1;p<edges.length-1;p++)if(edges[p+1]-edges[p]>edges[widest+1]-edges[widest])widest=p;
  edges.splice(widest+1,0,(edges[widest]+edges[widest+1])/2);
 }
 return edges;
}

function parallelPair(a,b,c,{separationPanels,gaussOrder}){
 const X=panelPoints(separationEdges(a,c,separationPanels),gaussOrder),
       Y=panelPoints(separationEdges(b,c,separationPanels),gaussOrder);
 let s=0,evaluations=0;
 for(let i=0;i<X.points.length;i++){
  const dx=X.points[i],wx=X.wts[i]*(a-dx);
  for(let j=0;j<Y.points.length;j++){
   const dy=Y.points[j],s2=dx*dx+dy*dy+c*c;
   s+=wx*Y.wts[j]*(b-dy)*(c*c/(s2*s2));evaluations++;
  }
 }
 // Separations are folded from [-a, a] x [-b, b] to the positive quadrant.
 return {value:finite(4*s/(Math.PI*a*b),'形態係数'),evaluations};
}

// G(a) = ∫_0^1 atan(a/t) dt = atan(a) + (a/2) ln(1 + a^-2), a > 0.
const radialIntegral=a=>Math.atan(a)+(a/2)*Math.log1p(1/(a*a));
function perpendicularPair(shared,eFrom,eTo,{polarPanels,gaussOrder}){
 const phiStar=Math.atan2(eTo,eFrom);
 const regions=[
  [0,phiStar,phi=>eFrom/Math.cos(phi),'hi'],
  [phiStar,Math.PI/2,phi=>eTo/Math.sin(phi),'lo'],
 ];
 let s=0,evaluations=0;
 for(const [lo,hi,rmaxOf,toward] of regions){
  const PHI=panelPoints(gradedEdges(lo,hi,polarPanels,toward),gaussOrder);
  for(let i=0;i<PHI.points.length;i++){
   const phi=PHI.points[i],rm=rmaxOf(phi);
   s+=PHI.wts[i]*Math.cos(phi)*Math.sin(phi)*rm*radialIntegral(shared/rm);evaluations++;
  }
 }
 return {value:finite(s/(Math.PI*eFrom),'形態係数'),evaluations};
}

const FACE_DEFS=[
 {id:'bottom',normal:[0,0,1]},
 {id:'top',normal:[0,0,-1]},
 {id:'front',normal:[0,1,0]},
 {id:'back',normal:[0,-1,0]},
 {id:'left',normal:[1,0,0]},
 {id:'right',normal:[-1,0,0]},
];

export function createBoxViewFactors3D(input){
 keys(input,['dimensions','integration']);
 const d=input.dimensions;keys(d,['x','y','z']);
 const X=finite(d.x,'x方向の内法[m]',true),Y=finite(d.y,'y方向の内法[m]',true),Z=finite(d.z,'z方向の内法[m]',true);
 const opt=input.integration??{};keys(opt,['separationPanels','polarPanels','gaussOrder']);
 const resolution={
  separationPanels:integerIn(opt.separationPanels??10,'分離軸のパネル数',1,64),
  polarPanels:integerIn(opt.polarPanels??16,'極座標の角度パネル数',1,64),
  gaussOrder:integerIn(opt.gaussOrder??6,'Gauss求積の次数',2,8),
 };
 const areas=[X*Y,X*Y,X*Z,X*Z,Y*Z,Y*Z].map((v,i)=>finite(v,`${FACE_DEFS[i].id}の面積[m²]`,true));
 // View factors are scale invariant; integrate on the normalised box so
 // that extreme aspect ratios share one well-conditioned computation.
 const scale=Math.max(X,Y,Z),x=X/scale,y=Y/scale,z=Z/scale;
 let evaluations=0;
 const par=(a,b,c)=>{const r=parallelPair(a,b,c,resolution);evaluations+=r.evaluations;return r.value;};
 const perp=(l,ef,et)=>{const r=perpendicularPair(l,ef,et,resolution);evaluations+=r.evaluations;return r.value;};
 const parXY=par(x,y,z),parXZ=par(x,z,y),parYZ=par(y,z,x);
 const pXYz=perp(x,y,z),pXZy=perp(x,z,y),pYXz=perp(y,x,z),
       pYZx=perp(y,z,x),pZXy=perp(z,x,y),pZYx=perp(z,y,x);
 const F=Array.from({length:6},()=>Array(6).fill(0));
 F[0][1]=F[1][0]=parXY;F[2][3]=F[3][2]=parXZ;F[4][5]=F[5][4]=parYZ;
 for(const i of [0,1]){F[i][2]=F[i][3]=pXYz;F[i][4]=F[i][5]=pYXz;}
 for(const i of [2,3]){F[i][0]=F[i][1]=pXZy;F[i][4]=F[i][5]=pZXy;}
 for(const i of [4,5]){F[i][0]=F[i][1]=pYZx;F[i][2]=F[i][3]=pZYx;}
 for(let i=0;i<6;i++)for(let j=0;j<6;j++){
  if(i!==j&&(F[i][j]<0||F[i][j]>1))throw Error('形態係数が[0, 1]の範囲外になりました。寸法の偏りが数値積分の解像範囲を超えています。');
 }
 const rowResidual=F.map(row=>finite(sum(row)-1,'形態係数の総和差'));
 const maximumRowResidual=Math.max(...rowResidual.map(Math.abs));
 let reciprocityRelativeResidual=0;
 for(let i=0;i<6;i++)for(let j=0;j<i;j++){
  const a=areas[i]*F[i][j],b=areas[j]*F[j][i];
  reciprocityRelativeResidual=Math.max(reciprocityRelativeResidual,Math.abs(a-b)/Math.max(a,b));
 }
 if(maximumRowResidual>1e-9||reciprocityRelativeResidual>1e-9)throw Error('形態係数の総和則・相反則を数値積分の精度で解像できません。解像度を上げてください。');
 return {
  kind:'axis-aligned-box-view-factors-3d',
  dimensions:{x:X,y:Y,z:Z},
  faces:FACE_DEFS.map((f,i)=>({id:f.id,area:areas[i],inwardNormal:[...f.normal]})),
  areas,
  viewFactors:F,
  diagnostics:{
   rowResidual,maximumRowResidual,reciprocityRelativeResidual,
   renormalized:false,clipped:false,
   integration:{...resolution,grading:'separation-geometric-from-sixth-separation; polar-cubic-toward-diagonal',kernelEvaluations:evaluations},
  },
  scope:{
   axisAlignedRectangularBox:true,sixFlatFaces:true,convexEnclosure:true,
   allFacePairsVisible:true,generalGeometry:false,curvedSurfaces:false,
   openings:false,participatingMedium:false,radiationNetworkConnected:false,
  },
  releaseApproved:false,
 };
}
