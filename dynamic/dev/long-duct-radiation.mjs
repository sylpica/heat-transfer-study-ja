// Development-only radiation in an infinitely long, convex polygonal duct.
// A span converts per-length heat/capacity to totals; it adds no end walls.
import {createRadiationNetwork} from '../radiation-network.mjs';
const EPS=Number.EPSILON;
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v===0?0:v;};
const sum=values=>{let s=0,c=0;for(const v of values){const y=v-c,t=s+y;c=(t-s)-y;s=t;}return finite(s,'合計');};
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const difference=(a,b)=>a.map((v,k)=>finite(v-b[k],'座標差'));
const length=v=>finite(Math.hypot(...v),'辺/弦の長さ');
function keys(input,allowed){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('長い凸ダクトの対応した条件だけを指定してください。');}
// |p-a|-|p-b|, rationalized before subtracting nearly equal long strings.
function normDifference(p,a,b){
 const u=difference(p,a),v=difference(p,b),edge=difference(b,a),products=edge.map((x,k)=>finite(x*(u[k]+v[k]),'弦長差の分子')),denominator=finite(length(u)+length(v),'弦長差の分母',true),value=finite(sum(products)/denominator,'弦長差');
 return {value,errorBound:finite(32*EPS*(sum(products.map(Math.abs))/denominator+Math.abs(value)),'弦長差の丸め予算')};
}
export function createLongDuctViewFactors(input){
 keys(input,['outline','span']);const span=finite(input.span??1,'換算スパン[m]',true),original=structuredClone(input.outline),repaired=[];
 if(!Array.isArray(original)||original.length<3||original.length>13||original.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=='number'||!Number.isFinite(v))))throw Error('長い凸ダクトは3〜12頂点の有限座標です。');
 if(original.length>3&&same(original[0],original.at(-1))){original.pop();repaired.push('同じ閉終点を1点除去しました。壁の順番は保持します。');}if(original.length>12)throw Error('壁面は3〜12面です。');
 const local=original.map(p=>difference(p,original[0])),scale=finite(Math.max(...local.flat().map(Math.abs)),'輪郭の長さスケール',true),points=local.map(p=>p.map(v=>finite(v/scale,'正規化座標'))),n=points.length;
 let orientation=0;for(let i=0;i<n;i++){
  for(let j=0;j<i;j++)if(same(original[i],original[j]))throw Error('重複頂点があります。');
  const a=points[i],b=points[(i+1)%n],edge=difference(b,a);finite(length(edge),'正の輪郭辺',true);
  for(let j=0;j<n;j++){if(j===i||j===(i+1)%n)continue;const d=difference(points[j],a),p=edge[0]*d[1],q=edge[1]*d[0],cross=finite(p-q,'凸性の外積'),roundoff=128*EPS*(Math.abs(p)+Math.abs(q));if(Math.abs(cross)<=roundoff)throw Error('一直線または数値的に未解像な頂点です。厳密な凸多角形だけが対象です。');const sign=Math.sign(cross);if(orientation&&sign!==orientation)throw Error('凹形状・自己交差・障害物は長い凸ダクトの対象外です。');orientation=sign;}
 }
 const normalizedLengths=points.map((p,i)=>finite(length(difference(points[(i+1)%n],p)),'正の壁長',true)),lengths=normalizedLengths.map(v=>finite(v*scale,'壁長[m]',true)),areas=lengths.map(v=>finite(v*span,'スパン当たりの面積[m²]',true)),F=Array.from({length:n},()=>Array(n).fill(0)),exchangeLengths=Array.from({length:n},()=>Array(n).fill(0));let maximumStringRoundoffBound=0;
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
  const a=points[i],b=points[(i+1)%n],c=points[j],d=points[(j+1)%n];let crossedMinusUncrossed,bound;
  if(j===i+1||(i===0&&j===n-1)){
   // Adjacent strings form a triangle. Rationalize Li+Lj-diagonal as
   // 2 Li Lj (1-cos(turn))/(Li+Lj+diagonal); never subtract two unit
   // strings to resolve the contribution of a much shorter wall.
   const u=difference(b,a).map(v=>v/normalizedLengths[i]),v=difference(d,c).map(v=>v/normalizedLengths[j]),dot=sum(u.map((x,k)=>x*v[k])),cross=u[0]*v[1]-u[1]*v[0],angleTerm=dot>0?cross*cross/(1+dot):1-dot,diagonal=j===i+1?length(difference(d,a)):length(difference(c,b));
   crossedMinusUncrossed=finite(2*normalizedLengths[i]*normalizedLengths[j]*angleTerm/(normalizedLengths[i]+normalizedLengths[j]+diagonal),'隣接壁の交差弦差');
   bound=finite(crossedMinusUncrossed*(128*EPS+32*EPS*(Math.abs(u[0]*v[1])+Math.abs(u[1]*v[0]))/Math.abs(cross)),'隣接壁の丸め予算');
  }else{
   const first=normDifference(a,c,d),second=normDifference(b,d,c);crossedMinusUncrossed=finite(first.value+second.value,'交差弦差');bound=finite(first.errorBound+second.errorBound+4*EPS*(Math.abs(first.value)+Math.abs(second.value)),'交差弦差の丸め予算');
  }
  if(!(crossedMinusUncrossed>bound))throw Error('壁間の正の形態係数が弦長差から解像できません。形状を見直してください。');maximumStringRoundoffBound=Math.max(maximumStringRoundoffBound,bound);
  const half=crossedMinusUncrossed/2,exchange=finite(half*scale,'相反交換長[m]',true);exchangeLengths[i][j]=exchangeLengths[j][i]=exchange;
  F[i][j]=finite(half/normalizedLengths[i],'形態係数',true);F[j][i]=finite(half/normalizedLengths[j],'形態係数',true);if(F[i][j]>1||F[j][i]>1)throw Error('形態係数が1を超えています。');
 }
 const rowResidual=F.map(row=>finite(sum(row)-1,'形態係数の総和差'));if(Math.max(...rowResidual.map(Math.abs))>1e-12)throw Error('形態係数の総和則を満たす精度で形状を解像できません。正規化で補正はしません。');
 let reciprocityRelativeResidual=0;for(let i=0;i<n;i++)for(let j=0;j<i;j++){const a=finite(areas[i]*F[i][j],'面積×形態係数',true),b=finite(areas[j]*F[j][i],'面積×形態係数',true);reciprocityRelativeResidual=Math.max(reciprocityRelativeResidual,Math.abs(a-b)/Math.max(a,b));}if(reciprocityRelativeResidual>1e-12)throw Error('面積×形態係数の相反則を数値的に解像できません。');
 return {kind:'infinite-convex-polygon-duct-view-factors',outline:original,span,lengths,areas,viewFactors:F,exchangeLengths,orientation:orientation>0?'counterclockwise':'clockwise',inwardNormals:points.map((p,i)=>{const d=difference(points[(i+1)%n],p);return [-orientation*d[1]/normalizedLengths[i],orientation*d[0]/normalizedLengths[i]].map(v=>v||0);}),repaired,diagnostics:{rowResidual,maximumRowResidual:Math.max(...rowResidual.map(Math.abs)),reciprocityRelativeResidual,maximumNormalizedStringRoundoffBound:maximumStringRoundoffBound,renormalized:false,clipped:false},scope:{infinitelyLongDuct:true,spanIsHeatAccountingOnly:true,flatIsothermalWalls:true,convexOnly:true,participatingMedium:false,finiteLengthEndEffects:false,arbitrary3D:false},releaseApproved:false};
}

export function createLongDuctRadiation(input){
 keys(input,['outline','span','walls','maxTemperature']);const c=structuredClone(input),g=createLongDuctViewFactors({outline:c.outline,span:c.span});
 if(!Array.isArray(c.walls)||c.walls.length!==g.lengths.length)throw Error('頂点から次の頂点への各辺に壁条件を1つ指定してください。');
 const surfaces=c.walls.map((w,i)=>{keys(w,['temperature','emissivity','capacityPerLength','powerPerLength']);const capacity=finite(finite(w.capacityPerLength,'壁の長さ当たり熱容量[J/(m K)]',true)*g.span,'壁熱容量[J/K]',true),power=finite(finite(w.powerPerLength??0,'壁の長さ当たり入力[W/m]')*g.span,'外部入力[W]');return {id:`wall-${i+1}`,area:g.areas[i],capacity,power,temperature:w.temperature,emissivity:w.emissivity};});
 const network=createRadiationNetwork({surfaces,viewFactors:g.viewFactors,maxTemperature:c.maxTemperature});
 const enrich=s=>({...s,wallOutwardPowerPerLength:s.outwardPower.map(v=>finite(v/g.span,'正味放射[W/m]')),scope:{...g.scope,constantIsothermalWallCapacity:true,conductionWithinWalls:false},releaseApproved:false});
 enrich(network.snapshot());
 const atomic=operation=>{const before=network.snapshot();try{return enrich(operation());}catch(error){network.restore(before);throw error;}};
 function restore(s){
  if(!s||!Array.isArray(s.temperature)||s.temperature.length!==surfaces.length||!Number.isSafeInteger(s.steps)||s.steps<0)throw Error('ダクトの復元データが不正です。');
  finite(s.time,'復元時間');finite(s.netInput,'復元外部入力');const dt=finite(s.lastDt??0,'復元刻み');if(s.time<0||(s.steps===0)!==(s.time===0)||dt<0||dt>network.safeDt*(1+1e-12)||dt>s.time||(s.steps>0&&dt===0)||(s.steps===0&&dt!==0))throw Error('復元する時計・刻み・回数が一致しません。');
  const maximumElapsed=s.steps*network.safeDt;if(Number.isFinite(maximumElapsed)&&s.time>maximumElapsed*(1+1e-12))throw Error('復元時間が回数と刻み上限を超えています。');
  if(s.steps===0&&s.temperature.some((t,i)=>t!==surfaces[i].temperature))throw Error('時刻0の温度は初期値です。');
  const expected=finite(sum(surfaces.map(v=>v.power))*s.time,'既知の外部入力積分'),inputBudget=finite(128*EPS*(s.steps+1)*Math.max(Math.abs(expected),Math.abs(s.netInput)),'入力積分の丸め予算');if(Math.abs(s.netInput-expected)>inputBudget)throw Error('累積入力が既知の外部入力と時間に一致しません。');
  const delta=sum(s.temperature.map((t,i)=>finite(surfaces[i].capacity*(finite(t,'復元絶対温度',true)-surfaces[i].temperature),'復元蓄熱差'))),scale=sum(s.temperature.map((t,i)=>finite(surfaces[i].capacity*Math.max(Math.abs(t),surfaces[i].temperature),'復元熱収支スケール'))),budget=finite(512*EPS*(s.steps+1)*scale,'復元熱収支の丸め予算');if(Math.abs(delta-s.netInput)>budget)throw Error('復元する蓄熱と累積外部入力が一致しません。');
  return atomic(()=>network.restore(s));
 }
 return {get geometry(){return structuredClone(g);},get config(){return structuredClone(c);},safeDt:network.safeDt,get time(){return network.time;},snapshot:()=>enrich(network.snapshot()),step:(dt,returnState=true)=>{const state=atomic(()=>network.step(dt));return returnState?state:undefined;},restore};
}
