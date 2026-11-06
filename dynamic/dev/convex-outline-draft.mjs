// An atomic geometry draft, separate from every accepted mesh/thermal state.
import {createConvexTriangleMesh} from './convex-triangle-mesh.mjs';
import {orientation2D} from './planar-predicates.mjs';

function validated(points){
 if(!Array.isArray(points)||points.length<3||points.length>12||points.some(p=>!Array.isArray(p)||p.length!==2||p.some(x=>!Number.isFinite(x)||Math.abs(x)>10)))throw Error('編集輪郭は3〜12頂点、各座標−10〜10 mの有限値です。');
 if(orientation2D(points[0],points[1],points[2]).sign<=0)throw Error('編集では反時計回りの凸輪郭を保ってください。');
 const mesh=createConvexTriangleMesh({outline:points,subdivisions:1});
 if(mesh.repaired.length)throw Error('頂点の削除・並べ替えで編集を自動修復しません。');
 return {outline:structuredClone(points),area:mesh.numerics.area};
}
export function createConvexOutlineDraft(points){
 let value=validated(points),selected=0;
 const index=i=>{if(!Number.isSafeInteger(i)||i<0||i>=value.outline.length)throw Error('実在する頂点を選択してください。');return i;};
 return {
  get outline(){return structuredClone(value.outline);},
  get selected(){return selected;},
  get area(){return value.area;},
  select(i){selected=index(i);},
  move(i,point){index(i);const candidate=structuredClone(value.outline);candidate[i]=structuredClone(point);const accepted=validated(candidate);value=accepted;selected=i;},
  insertAfter(i){
   index(i);if(value.outline.length===12)throw Error('編集輪郭は12頂点までです。');
   const p=value.outline[i],q=value.outline[(i+1)%value.outline.length],dx=q[0]-p[0],dy=q[1]-p[1];
   // Explicitly change the physical outline: midpoint displaced outward by
   // 5% of this edge length. Never add a collinear vertex and then delete it.
   const point=[p[0]+dx/2+.05*dy,p[1]+dy/2-.05*dx],candidate=structuredClone(value.outline);candidate.splice(i+1,0,point);
   const accepted=validated(candidate);value=accepted;selected=i+1;
  },
  remove(i){index(i);if(value.outline.length===3)throw Error('三角形の頂点は削除できません。');const candidate=structuredClone(value.outline);candidate.splice(i,1);const accepted=validated(candidate);value=accepted;selected=Math.min(i,value.outline.length-1);}
 };
}

export function outlineDraftBounds(points){
 const p=validated(points).outline,lo=[0,1].map(k=>Math.min(...p.map(v=>v[k]))),hi=[0,1].map(k=>Math.max(...p.map(v=>v[k]))),pad=.3*Math.max(hi[0]-lo[0],hi[1]-lo[1]);
 return [lo[0]-pad,lo[1]-pad,hi[0]+pad,hi[1]+pad];
}
