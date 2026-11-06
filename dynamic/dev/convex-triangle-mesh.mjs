// Development-only conforming fan subdivision plus local Delaunay flips.
// No stiffness matrix or transient solution is implied by a mesh result.
import {orientation2D,inCircle2D} from './planar-predicates.mjs';
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v===0?0:v;};
function sum(values){let s=0,e=0;for(const v of values){const y=v-e,t=s+y;e=(t-s)-y;s=t;}return finite(s,'集約値');}
const equal=(a,b)=>a[0]===b[0]&&a[1]===b[1],edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
export function createConvexTriangleMesh(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['outline','subdivisions'].includes(k)))throw Error('凸輪郭と辺の分割数だけを指定してください。');
 const p=structuredClone(input.outline),n=input.subdivisions??4,repaired=[];if(!Number.isSafeInteger(n)||n<1||n>16)throw Error('分割数は1〜16です。');
 if(!Array.isArray(p)||p.length<3||p.length>33||p.some(a=>!Array.isArray(a)||a.length!==2||a.some(v=>typeof v!=='number'||!Number.isFinite(v))))throw Error('有限座標の3〜32頂点が必要です。');if(p.length>3&&equal(p[0],p.at(-1))){p.pop();repaired.push('同じ閉終点を1点除去しました。');}if(p.length>32)throw Error('輪郭は32頂点までです。');
 if(p.length*n*n>1024||1+p.length*n*(n+1)/2>600)throw Error('開発メッシュは1024三角形・600節点までです。');
 const origin=[0,1].map(k=>Math.min(...p.map(a=>a[k]))),scale=finite(Math.max(...[0,1].map(k=>finite(Math.max(...p.map(a=>a[k]))-origin[k],'輪郭の幅'))),'長さ尺度',true),areaScale=finite(scale*scale,'面積尺度',true);let q=p.map(a=>a.map((v,k)=>finite((v-origin[k])/scale,'正規化座標'))),predicateCounts={orientation:0,inCircle:0,orientationExactFallback:0,inCircleExactFallback:0};
 function orient(a,b,c){const r=orientation2D(a,b,c);predicateCounts.orientation++;if(r.exactFallback)predicateCounts.orientationExactFallback++;return r.sign;}
 function circle(a,b,c,d){const r=inCircle2D(a,b,c,d);predicateCounts.inCircle++;if(r.exactFallback)predicateCounts.inCircleExactFallback++;return r.sign;}
 let direction=0;for(let i=0;i<q.length;i++){for(let j=0;j<i;j++)if(equal(q[i],q[j]))throw Error('重複または正規化で一致した頂点があります。');for(let j=0;j<q.length;j++){if(j===i||j===(i+1)%q.length)continue;const s=orient(q[i],q[(i+1)%q.length],q[j]);if(!s)throw Error('一直線の頂点はこの厳密凸メッシュの対象外です。');if(direction&&direction!==s)throw Error('凹・交差輪郭はこのメッシュの対象外です。');direction=s;}}
 if(direction<0){p.reverse();q.reverse();repaired.push('同じ輪郭を反時計回りへ並べ替えました。');}
 const center=[0,1].map(k=>sum(q.map(a=>a[k]/q.length))),nodes=[],indices=new Map(),triangles=[],boundaryEdges=new Map();
 function node(sector,a,b){
  const next=(sector+1)%q.length,c=n-a-b;let id,position,boundary=false;
  if(a===0&&b===0){id='center';position=center;}
  else if(a===n||b===n){const v=a===n?sector:next;id=`vertex:${v}`;position=q[v];boundary=true;}
  else if(c===0){id=`boundary:${sector}:${b}`;position=q[sector].map((v,k)=>v+b/n*(q[next][k]-v));boundary=true;}
  else if(b===0||a===0){const v=b===0?sector:next,t=b===0?a:b;id=`radial:${v}:${t}`;position=center.map((x,k)=>x+t/n*(q[v][k]-x));}
  else{id=`sector:${sector}:${a}:${b}`;position=center.map((x,k)=>x+a/n*(q[sector][k]-x)+b/n*(q[next][k]-x));}
  if(indices.has(id))return indices.get(id);const index=nodes.length;indices.set(id,index);const physical=id.startsWith('vertex:')?[...p[Number(id.split(':')[1])]]:position.map((v,k)=>finite(origin[k]+v*scale,'物理座標'));nodes.push({id:index,stableId:id,point:physical,normalized:[...position],boundary});return index;
 }
 function ccw(t){const s=orient(...t.map(i=>nodes[i].normalized));if(s===0)throw Error('正の三角形を解像できません。');return s>0?t:[t[0],t[2],t[1]];}
 for(let sector=0;sector<q.length;sector++){
  for(let a=0;a<n;a++)for(let b=0;a+b<n;b++){triangles.push(ccw([node(sector,a,b),node(sector,a+1,b),node(sector,a,b+1)]));if(a+b<=n-2)triangles.push(ccw([node(sector,a+1,b),node(sector,a+1,b+1),node(sector,a,b+1)]));}
  for(let t=0;t<n;t++)boundaryEdges.set(edgeKey(node(sector,n-t,t),node(sector,n-t-1,t+1)),sector);
 }
 function connectivity(){const edges=new Map();triangles.forEach((t,triangle)=>{for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],key=edgeKey(a,b);if(!edges.has(key))edges.set(key,[]);edges.get(key).push({triangle,a,b,opposite:t[(i+2)%3]});}});for(const [key,e]of edges)if(e.length!==(boundaryEdges.has(key)?1:2))throw Error('三角形の境界・隣接が一致しません。');for(const key of boundaryEdges.keys())if(!edges.has(key))throw Error('輪郭辺がメッシュから失われています。');return edges;}
 let flips=0,edges;
 for(;;){edges=connectivity();let changed=false;for(const [key,e]of edges){if(e.length===1)continue;const first=e[0],other=e[1],a=nodes[first.a].normalized,b=nodes[first.b].normalized,c=nodes[first.opposite].normalized,d=nodes[other.opposite].normalized;if(circle(a,b,c,d)<=0)continue;
   // Only a strictly convex quadrilateral can exchange its diagonal.
   if(orient(c,d,a)*orient(c,d,b)>=0)throw Error('Delaunay条件を満たす凸な辺交換を解像できません。');
   const nextKey=edgeKey(first.opposite,other.opposite);if(edges.has(nextKey))throw Error('重複する対角線への交換です。');triangles[first.triangle]=ccw([first.opposite,other.opposite,first.a]);triangles[other.triangle]=ccw([other.opposite,first.opposite,first.b]);if(++flips>100*triangles.length)throw Error('Delaunay辺交換が上限までに収束しません。');changed=true;break;
  }if(!changed)break;
 }
 const elements=triangles.map((t,id)=>{const [a,b,c]=t.map(i=>nodes[i].normalized),twice=finite((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),'三角形の向き付き面積',true),area=finite(twice/2*areaScale,'三角形面積',true),sides=[Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1]),Math.hypot(a[0]-b[0],a[1]-b[1])],quality=finite(2*Math.sqrt(3)*twice/sum(sides.map(v=>v*v)),'三角形品質',true);return {id,nodes:[...t],area,normalizedTwiceArea:twice,quality};}),area=sum(elements.map(e=>e.area)),fanArea=sum(q.map((a,i)=>{const b=q[(i+1)%q.length];return finite(((a[0]-center[0])*(b[1]-center[1])-(a[1]-center[1])*(b[0]-center[0]))/2*areaScale,'元輪郭面積',true);})),areaResidual=finite(area-fanArea,'輪郭と全要素の面積差');
 if(Math.abs(areaResidual)>4096*Number.EPSILON*fanArea)throw Error('輪郭と全三角形の面積が一致しません。');
 const outputEdges=[];for(const [key,e]of edges){const a=e[0].a,b=e[0].b,isBoundary=boundaryEdges.has(key);if(isBoundary&&(!nodes[a].boundary||!nodes[b].boundary))throw Error('輪郭の節点状態が不正です。');outputEdges.push({nodes:[a,b],triangles:e.map(v=>v.triangle),oppositeNodes:e.map(v=>v.opposite),boundary:isBoundary,outlineEdge:isBoundary?boundaryEdges.get(key):null,exactlyCocircular:e.length===2?circle(...triangles[e[0].triangle].map(i=>nodes[i].normalized),nodes[e[1].opposite].normalized)===0:false});}
 const maximumBoundaryLineResidual=Math.max(...nodes.filter(v=>v.boundary).map(v=>Math.min(...q.map((a,i)=>{const b=q[(i+1)%q.length];return Math.abs((b[0]-a[0])*(v.normalized[1]-a[1])-(b[1]-a[1])*(v.normalized[0]-a[0]))/Math.hypot(b[0]-a[0],b[1]-a[1]);}))));
 return {kind:'convex-conforming-delaunay-development-mesh',outline:p,nodes,elements,edges:outputEdges,subdivisions:n,repaired,numerics:{normalizationOrigin:origin,normalizationScale:scale,area,referencePolygonArea:fanArea,areaResidual,maximumNormalizedBoundaryLineResidual:maximumBoundaryLineResidual,minimumTriangleQuality:Math.min(...elements.map(e=>e.quality)),flips,predicates:predicateCounts,allLocalInteriorEdgesDelaunay:true,sourceBoundaryCornersPreserved:true,zeroAreaElementsRemoved:0},scope:{strictConvexOnly:true,piecewiseLinearGeometry:true,exactArithmeticOnRoundedNormalizedCoordinates:true,stiffnessAssembled:false,temperaturePDEImplemented:false,monotonicityVerified:false,temporalStabilityVerified:false,generalAccuracyVerified:false},releaseApproved:false};
}
