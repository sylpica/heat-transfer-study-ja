// Separate development geometry: exact axis-aligned simple outlines only.
// Concave orthogonal polygons are tiled conformingly, never stair-approximated.
// No temperature PDE, temporal stability or general free-shape approval implied.
import {orientation2D,inCircle2D,edgeCotangentDyadic} from './planar-predicates.mjs';
import {trianglePhysicalFidelity} from './convex-triangle-mesh.mjs';
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v===0?0:v;};
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1],key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`,between=(x,a,b)=>x>=Math.min(a,b)&&x<=Math.max(a,b);
function sum(xs){let s=0,e=0;for(const x of xs){const y=x-e,t=s+y;e=(t-s)-y;s=t;}return finite(s,'集約値');}
function on(a,b,p){return orientation2D(a,b,p).sign===0&&between(p[0],a[0],b[0])&&between(p[1],a[1],b[1]);}
function intersects(a,b,c,d){const x=orientation2D(a,b,c).sign,y=orientation2D(a,b,d).sign,z=orientation2D(c,d,a).sign,w=orientation2D(c,d,b).sign;return x*y<0&&z*w<0||x===0&&on(a,b,c)||y===0&&on(a,b,d)||z===0&&on(c,d,a)||w===0&&on(c,d,b);}
export function createOrthogonalTriangleMesh(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['outline','subdivisions'].includes(k)))throw Error('直交単純輪郭と分割数だけを指定してください。');
 const p=structuredClone(input.outline),n=input.subdivisions??2,repaired=[];
 if(![1,2,4,8].includes(n))throw Error('直交メッシュの区間分割は1/2/4/8です。');
 if(!Array.isArray(p)||p.length<4||p.length>33||p.some(a=>!Array.isArray(a)||a.length!==2||a.some(v=>typeof v!=='number'||!Number.isFinite(v))))throw Error('有限な4〜32頂点の単一直交輪郭が必要です。');
 if(same(p[0],p.at(-1))){p.pop();repaired.push('同じ閉終点を1点除去しました。');}if(p.length<4||p.length>32)throw Error('直交輪郭は4〜32頂点です。');
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length],c=p[(i+2)%p.length];
  for(let j=0;j<i;j++)if(same(a,p[j]))throw Error('重複頂点・接触輪郭は未対応です。');
  if(same(a,b)||!((a[0]===b[0])!==(a[1]===b[1])))throw Error('正の長さの軸平行辺だけに対応します。形状を丸めません。');
  if(orientation2D(a,b,c).sign===0){const k=a[0]===b[0]?1:0;if((b[k]>a[k])!==(c[k]>b[k]))throw Error('隣接辺の後戻り・重なりは未対応です。');}
  for(let j=i+1;j<p.length;j++){if(j===(i+1)%p.length||i===(j+1)%p.length)continue;if(intersects(a,b,p[j],p[(j+1)%p.length]))throw Error('自己交差・非隣接辺の接触は未対応です。');}
 }
 const origin=[0,1].map(k=>Math.min(...p.map(v=>v[k]))),scale=finite(Math.max(...[0,1].map(k=>finite(Math.max(...p.map(v=>v[k]))-origin[k],'輪郭幅'))),'長さ尺度',true),areaScale=finite(scale*scale,'面積尺度',true);
 let q=p.map(v=>v.map((x,k)=>finite((x-origin[k])/scale,'正規化座標')));
 if(new Set(q.map(v=>v.join(','))).size!==q.length)throw Error('正規化で頂点を区別できません。');
 let signedArea=sum(q.map((a,i)=>{const b=q[(i+1)%q.length];return (a[0]*b[1]-a[1]*b[0])/2;}));if(!signedArea)throw Error('正の輪郭面積を解像できません。');if(signedArea<0){p.reverse();q.reverse();signedArea=-signedArea;repaired.push('同じ輪郭を反時計回りへ並べ替えました。');}
 const polygonArea=finite(signedArea*areaScale,'輪郭面積',true),coordinateMaps=[0,1].map(k=>new Map(q.map((v,i)=>[v[k],p[i][k]])));
 function grid(k){const source=[...coordinateMaps[k].keys()].sort((a,b)=>a-b),out=[];for(let i=0;i<source.length-1;i++)for(let j=0;j<n;j++)out.push(j===0?source[i]:finite(source[i]+j/n*(source[i+1]-source[i]),'格子線'));out.push(source.at(-1));if(out.some((v,i)=>i&&v<=out[i-1]))throw Error('格子線の精度が不足しています。');return out;}
 const xs=grid(0),ys=grid(1),nodes=[],indices=new Map(),triangles=[],physicalSet=new Set();
 function inside(x,y){let yes=false;for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length];if(a[0]===b[0]&&(a[1]>y)!==(b[1]>y)&&a[0]>x)yes=!yes;}return yes;}
 function node(i,j){const id=`${i}:${j}`;if(indices.has(id))return indices.get(id);const normalized=[xs[i],ys[j]],point=normalized.map((v,k)=>coordinateMaps[k].has(v)?coordinateMaps[k].get(v):finite(origin[k]+v*scale,'物理座標'));if(physicalSet.has(point.join(',')))throw Error('物理座標の精度で節点が一致します。原点/分割を変更してください。');physicalSet.add(point.join(','));const index=nodes.length;nodes.push({id:index,stableId:`orthogonal-grid:${id}`,point,normalized,boundary:false});indices.set(id,index);return index;}
 let rectangles=0;
 for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
  const x=xs[i]+(xs[i+1]-xs[i])/2,y=ys[j]+(ys[j+1]-ys[j])/2;if(!(x>xs[i]&&x<xs[i+1]&&y>ys[j]&&y<ys[j+1]))throw Error('格子区間の内部を解像できません。');if(!inside(x,y))continue;
  const a=node(i,j),b=node(i+1,j),c=node(i+1,j+1),d=node(i,j+1);if((i+j)%2)triangles.push([a,b,d],[b,c,d]);else triangles.push([a,b,c],[a,c,d]);rectangles++;
  if(nodes.length>600||triangles.length>1024)throw Error('直交メッシュは600節点/1024三角形までです。分割数を減らしてください。');
 }
 if(!rectangles)throw Error('輪郭内の正のセルがありません。');
 const elements=triangles.map((t,id)=>{const [a,b,c]=t.map(i=>nodes[i].normalized);if(orientation2D(a,b,c).sign<=0||orientation2D(...t.map(i=>nodes[i].point)).sign<=0)throw Error('正の三角形を正規化/物理座標で解像できません。');const twice=finite((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),'正の要素面積',true),area=finite(twice/2*areaScale,'物理要素面積',true),side2=[[a,b],[b,c],[c,a]].map(([u,v])=>(u[0]-v[0])**2+(u[1]-v[1])**2);return {id,nodes:t.slice(),area,normalizedTwiceArea:twice,quality:finite(2*Math.sqrt(3)*twice/sum(side2),'三角形品質',true)};});
 const connectivity=new Map();triangles.forEach((t,triangle)=>{for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],k=key(a,b);if(!connectivity.has(k))connectivity.set(k,[]);connectivity.get(k).push({a,b,triangle,opposite:t[(i+2)%3]});}});
 const edgeLengthParts=p.map(()=>[]),edges=[];let maximumLineResidual=0;
 for(const rows of connectivity.values()){
  if(rows.length<1||rows.length>2)throw Error('三角形辺の隣接数が不正です。');const first=rows[0],a=nodes[first.a].normalized,b=nodes[first.b].normalized,isBoundary=rows.length===1;let outlineEdge=null;
  if(isBoundary){const matches=q.flatMap((u,i)=>on(u,q[(i+1)%q.length],a)&&on(u,q[(i+1)%q.length],b)?[i]:[]);if(matches.length!==1)throw Error('境界辺と元輪郭の対応が一意ではありません。');outlineEdge=matches[0];nodes[first.a].boundary=true;nodes[first.b].boundary=true;edgeLengthParts[outlineEdge].push(finite(Math.hypot(b[0]-a[0],b[1]-a[1])*scale,'境界区間長',true));if(edgeCotangentDyadic(a,b,nodes[first.opposite].normalized).numerator.n<0n)throw Error('直交境界に負の余接があります。');}
  else if(inCircle2D(a,b,nodes[first.opposite].normalized,nodes[rows[1].opposite].normalized).sign>0)throw Error('内部辺が局所Delaunayではありません。');
  edges.push({nodes:[first.a,first.b],triangles:rows.map(r=>r.triangle),oppositeNodes:rows.map(r=>r.opposite),boundary:isBoundary,outlineEdge,exactlyCocircular:!isBoundary&&inCircle2D(a,b,nodes[first.opposite].normalized,nodes[rows[1].opposite].normalized).sign===0});
 }
 if(nodes.length-edges.length+elements.length!==1)throw Error('穴なし円板の位相が一致しません。');
 const lengthResiduals=edgeLengthParts.map((parts,i)=>{const a=p[i],b=p[(i+1)%p.length],expected=finite(Math.hypot(b[0]-a[0],b[1]-a[1]),'元輪郭長',true),relative=Math.abs(sum(parts)/expected-1);if(relative>4096*Number.EPSILON)throw Error('全境界長と元輪郭長が一致しません。');return relative;}),area=sum(elements.map(e=>e.area)),areaResidual=area-polygonArea;if(Math.abs(areaResidual)>4096*Number.EPSILON*polygonArea)throw Error('要素面積と輪郭面積が一致しません。');
 for(const v of q)if(!nodes.some(n=>same(n.normalized,v)))throw Error('元の輪郭角が失われています。');
 return {kind:'orthogonal-conforming-delaunay-development-mesh',outline:p,nodes,elements,edges,subdivisions:n,repaired,numerics:{normalizationOrigin:origin,normalizationScale:scale,area,referencePolygonArea:polygonArea,areaResidual,rectangleCount:rectangles,gridLineCountX:xs.length,gridLineCountY:ys.length,maximumNormalizedBoundaryLineResidual:maximumLineResidual,maximumOutlineEdgeLengthRelativeResidual:Math.max(...lengthResiduals),minimumTriangleQuality:Math.min(...elements.map(e=>e.quality)),allLocalInteriorEdgesDelaunay:true,sourceBoundaryCornersPreserved:true,physicalNodesDistinct:true,physicalElementOrientationsPositive:true,boundaryCotangentsNonnegative:true,eulerDiskCharacteristic:1,...trianglePhysicalFidelity(nodes,elements,origin,scale)},scope:{axisAlignedOrthogonalOnly:true,simplePolygonWithoutHoles:true,concaveAllowed:true,piecewiseLinearGeometry:true,noStaircaseApproximation:true,stiffnessAssembled:false,temperaturePDEImplemented:false,monotonicityVerified:false,temporalStabilityVerified:false,generalAccuracyVerified:false},releaseApproved:false};
}
