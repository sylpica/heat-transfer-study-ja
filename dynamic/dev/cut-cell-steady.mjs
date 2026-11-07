// Development-only small, all-Dirichlet steady diffusion solve. This module
// does not advance time or assert monotonicity, symmetry, or general accuracy.
import {evaluateCutCellFlux} from './cut-cell-flux.mjs';
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v===0?0:v;};
function sum(values){let s=0,e=0;for(const v of values){const y=v-e,t=s+y;e=(t-s)-y;s=t;}return finite(s,'集約値');}
function scaledLU(matrix,right){
 const n=right.length,scales=matrix.map(row=>finite(Math.max(...row.map(Math.abs)),'行スケール',true)),a=matrix.map((row,i)=>row.map(v=>finite(v/scales[i],'行正規化係数'))),b=right.map((v,i)=>finite(v/scales[i],'行正規化右辺')),threshold=64*Number.EPSILON*n;let minPivot=Infinity,maxGrowth=1;
 for(let k=0;k<n;k++){
  let pivot=k;for(let i=k+1;i<n;i++)if(Math.abs(a[i][k])>Math.abs(a[pivot][k]))pivot=i;
  const magnitude=Math.abs(a[pivot][k]);if(!(magnitude>threshold))throw Error('定常行列が特異または数値的に解像できません。');minPivot=Math.min(minPivot,magnitude);
  if(pivot!==k){[a[pivot],a[k]]=[a[k],a[pivot]];[b[pivot],b[k]]=[b[k],b[pivot]];}
  for(let i=k+1;i<n;i++){
   const factor=finite(a[i][k]/a[k][k],'消去係数');a[i][k]=0;
   for(let j=k+1;j<n;j++){a[i][j]=finite(a[i][j]-factor*a[k][j],'LU消去');maxGrowth=Math.max(maxGrowth,Math.abs(a[i][j]));}
   b[i]=finite(b[i]-factor*b[k],'LU右辺消去');
  }
 }
 const x=Array(n).fill(0);for(let i=n-1;i>=0;i--)x[i]=finite((b[i]-sum(a[i].slice(i+1).map((v,j)=>v*x[i+1+j])))/a[i][i],'定常温度差');
 let backwardError=0;const normX=Math.max(...x.map(Math.abs));
 for(let i=0;i<n;i++){
  const row=matrix[i].map(v=>v/scales[i]),r=right[i]/scales[i],reference=Math.max(normX,Math.abs(r));if(reference===0)continue;
  const residual=Math.abs(sum(row.map((v,j)=>v*(x[j]/reference)))-r/reference),denominator=sum(row.map(Math.abs))*(normX/reference)+Math.abs(r)/reference;
  backwardError=Math.max(backwardError,finite(residual/denominator,'後退誤差'));
 }
 if(backwardError>1e-10)throw Error('定常線形解の後退誤差が予算を超えます。');
 return {x,diagnostics:{method:'row-scaled partial-pivot Gaussian elimination',minimumScaledPivot:minPivot,pivotThreshold:threshold,scaledEliminationGrowth:maxGrowth,relativeBackwardError:backwardError,conditionNumberVerified:false}};
}
export function solveCutCellSteady(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['geometry','k','depth','wallTemperature','source','scheme'].includes(k)))throw Error('定常cut-cellの幾何・物性・壁値・熱源だけを指定してください。');
 const {geometry:g,k,depth,wallTemperature}=input,scheme=input.scheme??'corrected';finite(k,'熱伝導率',true);finite(depth,'奥行き',true);
 if(!g||g.kind!=='convex-polygon-cut-cell-geometry'||!Array.isArray(g.cells)||!Array.isArray(g.wallFragments))throw Error('凸cut-cell幾何が必要です。');
 if(!['twoPoint','corrected'].includes(scheme))throw Error('流束の選択が不正です。');
 const active=g.cells.filter(c=>c?.active);if(active.length<1||active.length>256)throw Error('密行列の開発定常解は正面積セル1〜256個です。');
 if(!Array.isArray(wallTemperature)||wallTemperature.length!==g.wallFragments.length||wallTemperature.length===0)throw Error('全壁片のDirichlet温度を指定してください。');wallTemperature.forEach(v=>finite(v,'壁絶対温度[K]',true));
 // A nearby fixed boundary value is the datum, never an arbitrary distant
 // reference supplied by the caller. Retain the resolved excess separately.
 const datum=wallTemperature[0],wallDelta=wallTemperature.map(v=>finite(v-datum,'壁温度差')),zeroWall=wallTemperature.map(()=>0),zero=Array(g.cells.length).fill(0),rawSource=input.source??0;
 const source=Array.isArray(rawSource)?rawSource:Array(g.cells.length).fill(rawSource);if(source.length!==g.cells.length)throw Error('体積熱源のセル数が一致しません。');
 const powers=active.map(c=>finite(finite(source[c.id],'体積熱源[W/m³]')*finite(c.area*depth,'セル体積',true),'セル発熱[W]'));
 const evaluate=(temperature,wall)=>evaluateCutCellFlux({geometry:g,k,depth,temperature,wallTemperature:wall});
 const boundary=evaluate(zero,wallDelta),offset=active.map(c=>boundary.cells[c.id].outwardFluxW[scheme]),right=powers.map((v,i)=>finite(v-offset[i],'定常右辺'));
 const matrix=active.map(()=>Array(active.length).fill(0));
 for(let j=0;j<active.length;j++){
  zero[active[j].id]=1;const response=evaluate(zero,zeroWall);zero[active[j].id]=0;
  active.forEach((c,i)=>matrix[i][j]=finite(response.cells[c.id].outwardFluxW[scheme],'定常演算子係数'));
 }
 const solution=scaledLU(matrix,right),excess=Array(g.cells.length).fill(null),temperature=Array(g.cells.length).fill(null);
 active.forEach((c,i)=>{excess[c.id]=solution.x[i];temperature[c.id]=finite(datum+solution.x[i],'定常絶対温度[K]',true);});
 // Fluxes use resolved excess values; adding a large absolute datum first can
 // erase a physically finite small gradient. No field is clipped or shifted.
 const flux=evaluate(excess,wallDelta),outward=active.map(c=>flux.cells[c.id].outwardFluxW[scheme]),residual=outward.map((v,i)=>finite(v-powers[i],'セル定常熱収支'));
 let coefficientScale=0,asymmetry=0,maximumPositiveOffDiagonal=0,positiveOffDiagonalCount=0;
 for(const row of matrix)for(const v of row)coefficientScale=Math.max(coefficientScale,Math.abs(v));
 const signTolerance=1024*Number.EPSILON*coefficientScale;
 for(let i=0;i<active.length;i++)for(let j=0;j<active.length;j++)if(i!==j){asymmetry=Math.max(asymmetry,finite(Math.abs(matrix[i][j]-matrix[j][i]),'行列非対称量'));if(matrix[i][j]>signTolerance)positiveOffDiagonalCount++;maximumPositiveOffDiagonal=Math.max(maximumPositiveOffDiagonal,matrix[i][j]);}
 const scaleByRow=matrix.map((row,i)=>finite(sum(row.map((a,j)=>Math.abs(a*solution.x[j])))+Math.abs(offset[i])+Math.abs(powers[i]),'熱収支の丸めスケール'));
 const allowance=finite(4096*Number.EPSILON*active.length*Math.max(...scaleByRow),'熱収支の丸め予算');
 if(Math.max(...residual.map(Math.abs))>allowance)throw Error('全体定常解を面流束へ戻した熱収支が一致しません。');
 const sourceTotal=sum(powers),wallOutward=sum(flux.wallFaces.map(f=>f[scheme].fluxW)),globalError=finite(wallOutward-sourceTotal,'全境界と熱源の差'),globalAllowance=finite(active.length*allowance,'全体熱収支の丸め予算');if(Math.abs(globalError)>globalAllowance)throw Error('定常の全境界と熱源の収支が一致しません。');
 const absoluteRoundingErrors=active.map(c=>finite((temperature[c.id]-datum)-excess[c.id],'絶対温度へ戻す丸め差'));
 return {kind:'small-convex-cut-cell-steady-development',scheme,datum,temperature,temperatureExcess:excess,activeCellIds:active.map(c=>c.id),matrix,rightHandSideW:right,sourcePowerW:powers,cellOutwardFluxW:outward,cellResidualW:residual,maximumCellResidualW:Math.max(...residual.map(Math.abs)),energyRoundoffBudgetW:allowance,globalEnergyRoundoffBudgetW:globalAllowance,totalSourceW:sourceTotal,totalWallOutwardW:wallOutward,globalBalanceErrorW:globalError,fluxEvaluationUsesExcess:true,absoluteTemperatureResolution:{maximumRoundingErrorK:Math.max(...absoluteRoundingErrors.map(Math.abs)),lostNonzeroExcessCount:active.filter(c=>excess[c.id]!==0&&temperature[c.id]===datum).length},linearSolve:solution.diagnostics,matrixProperties:{maximumCoefficientWPerK:coefficientScale,maximumAsymmetryWPerK:asymmetry,positiveOffDiagonalCount,offDiagonalSignTolerance:signTolerance,maximumPositiveOffDiagonalWPerK:maximumPositiveOffDiagonal,allDiagonalEntriesPositive:matrix.every((row,i)=>row[i]>0),symmetryVerified:false,mMatrixVerified:false,spectrumVerified:false},scope:{steadyAllDirichletOnly:true,maximumActiveCells:256,manufacturedAccuracyOnly:true,transientImplemented:false,cflVerified:false,positivityPreservationVerified:false,generalSecondOrderVerified:false},releaseApproved:false};
}
