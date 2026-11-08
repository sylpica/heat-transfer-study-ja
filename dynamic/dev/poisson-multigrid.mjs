// Fixed symmetric Galerkin V-cycle for the rectangular Neumann graph Laplacian.
// Development-only preconditioner: the outer PCG retains the original operator.
const zeroMean=a=>{let mean=0;for(let i=0;i<a.length;i++)mean+=a[i];mean/=a.length;for(let i=0;i<a.length;i++)a[i]-=mean;return a;};
const add=(map,j,v)=>map.set(j,(map.get(j)||0)+v);
function matrix(rows){
 const n=rows.length;
 for(let i=0;i<n;i++)for(const [j,value]of rows[i])if(j>i){const v=.5*(value+(rows[j].get(i)||0));rows[i].set(j,v);rows[j].set(i,v);}
 // Enforce only the exact constant nullspace after floating-point RAP assembly.
 for(let i=0;i<n;i++)rows[i].set(i,-[...rows[i]].reduce((sum,[j,v])=>sum+(j===i?0:v),0));
 const offsets=new Int32Array(n+1),columns=[],values=[],diagonal=new Float64Array(n);let bound=0;
 rows.forEach((row,i)=>{offsets[i]=columns.length;for(const [j,v]of [...row].sort((a,b)=>a[0]-b[0])){if(!Number.isFinite(v))throw Error('多重格子行列が数値範囲を超えています。');columns.push(j);values.push(v);}diagonal[i]=row.get(i);if(!(diagonal[i]>0))throw Error('多重格子行列の対角が不正です。');bound=Math.max(bound,[...row.values()].reduce((s,v)=>s+Math.abs(v),0)/diagonal[i]);});offsets[n]=columns.length;
 if(!Number.isFinite(bound)||bound<=0)throw Error('多重格子の平滑化尺度が悪条件です。');
 const col=Int32Array.from(columns),val=Float64Array.from(values),omega=1.2/bound;
 function multiply(x){const y=new Float64Array(n);for(let i=0;i<n;i++){let sum=0;for(let k=offsets[i];k<offsets[i+1];k++)sum+=val[k]*x[col[k]];y[i]=sum;}return y;}
 function smooth(x,b){for(let sweep=0;sweep<2;sweep++){const Ax=multiply(x);for(let i=0;i<n;i++)x[i]+=omega*(b[i]-Ax[i])/diagonal[i];}zeroMean(x);}
 return {n,rows,multiply,smooth,nonzeros:values.length,omega};
}
function prolongation(nx,ny,cx,cy){
 function weights(i,n,c){if(n===c)return [[i,1]];const p=(i+.5)*c/n-.5,j=Math.floor(p),f=p-j,low=Math.max(0,Math.min(c-1,j)),high=Math.max(0,Math.min(c-1,j+1));return low===high?[[low,1]]:[[low,1-f],[high,f]];}
 return Array.from({length:nx*ny},(_,n)=>{const row=new Map();for(const [i,wx]of weights(n%nx,nx,cx))for(const [j,wy]of weights(Math.floor(n/nx),ny,cy))add(row,j*cx+i,wx*wy);return [...row];});
}
function coarseMatrix(A,P,n){const rows=Array.from({length:n},()=>new Map());for(let i=0;i<A.n;i++)for(const [j,a]of A.rows[i])for(const [ci,wi]of P[i])for(const [cj,wj]of P[j])add(rows[ci],cj,wi*a*wj);return matrix(rows);}
function inverseOnMeanFree(A){
 const m=A.n-1,L=Array.from({length:m},()=>new Float64Array(m));
 for(let i=0;i<m;i++)for(let j=0;j<=i;j++){let value=A.rows[i].get(j)||0;for(let k=0;k<j;k++)value-=L[i][k]*L[j][k];if(i===j){if(!Number.isFinite(value)||value<=0)throw Error('粗格子のCholesky分解が悪条件です。');L[i][j]=Math.sqrt(value);}else L[i][j]=value/L[j][j];}
 return b=>{const y=new Float64Array(m),x=new Float64Array(A.n);for(let i=0;i<m;i++){let v=b[i];for(let j=0;j<i;j++)v-=L[i][j]*y[j];y[i]=v/L[i][i];}for(let i=m-1;i>=0;i--){let v=y[i];for(let j=i+1;j<m;j++)v-=L[j][i]*x[j];x[i]=v/L[i][i];}return zeroMean(x);};
}
export function createNeumannMultigrid({nx,ny,dx,dy}){
 if(!Number.isInteger(nx)||!Number.isInteger(ny)||nx<2||ny<2||nx>256||ny>256||![dx,dy].every(v=>Number.isFinite(v)&&v>0))throw Error('多重格子の寸法が不正です。');
 const rows=Array.from({length:nx*ny},()=>new Map()),wx=1/dx**2,wy=1/dy**2;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)for(const [m,w]of [[i+1<nx?j*nx+i+1:-1,wx],[j+1<ny?(j+1)*nx+i:-1,wy]])if(m>=0){const n=j*nx+i;add(rows[n],n,w);add(rows[m],m,w);add(rows[n],m,-w);add(rows[m],n,-w);}
 const levels=[];
 function build(A,x,y){const info={nx:x,ny:y,size:A.n,nonzeros:A.nonzeros,omega:A.omega};levels.push(info);if(A.n<=16){const solve=inverseOnMeanFree(A);return b=>solve(zeroMean(Float64Array.from(b)));}
  const cx=x>2?Math.ceil(x/2):x,cy=y>2?Math.ceil(y/2):y,P=prolongation(x,y,cx,cy),coarse=build(coarseMatrix(A,P,cx*cy),cx,cy);
  // Flat copy of P in the same pair order: the cycle loops below accumulate
  // in exactly the same order as the pair form, so results are unchanged.
  const pOffsets=new Int32Array(A.n+1),pIndex=new Int32Array(P.reduce((s,row)=>s+row.length,0)),pWeight=new Float64Array(pIndex.length);
  for(let i=0;i<A.n;i++){pOffsets[i+1]=pOffsets[i]+P[i].length;for(let k=0;k<P[i].length;k++){pIndex[pOffsets[i]+k]=P[i][k][0];pWeight[pOffsets[i]+k]=P[i][k][1];}}
  return b=>{const x=new Float64Array(A.n);A.smooth(x,b);const Ax=A.multiply(x),r=zeroMean(Float64Array.from(b,(v,i)=>v-Ax[i])),rhs=new Float64Array(cx*cy);for(let i=0;i<A.n;i++){const ri=r[i];for(let k=pOffsets[i];k<pOffsets[i+1];k++)rhs[pIndex[k]]+=pWeight[k]*ri;}const correction=coarse(zeroMean(rhs));for(let i=0;i<A.n;i++)for(let k=pOffsets[i];k<pOffsets[i+1];k++)x[i]+=pWeight[k]*correction[pIndex[k]];A.smooth(x,b);return zeroMean(x);};
 }
 const cycle=build(matrix(rows),nx,ny);
 return {size:nx*ny,levels,apply(rhs){if(rhs?.length!==nx*ny||Array.from(rhs).some(v=>!Number.isFinite(v)))throw Error('前処理の残差ベクトルが不正です。');const x=cycle(zeroMean(Float64Array.from(rhs)));if(x.some(v=>!Number.isFinite(v)))throw Error('多重格子の前処理が非有限値になりました。');return x;}};
}
