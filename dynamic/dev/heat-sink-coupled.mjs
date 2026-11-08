// Development-only coupled heat-sink reference: 3D steady finite-volume
// base conduction, thickness-uniform 2D fins, prescribed fully developed
// channel flow (cross-section Poisson, common-pressure parallel allocation),
// passive fluid temperature transport (first-order upwind in x, no axial
// diffusion) and local long-duct radiosity per x column with shielding,
// mutual reflection, a black aperture and diffuse-reflecting guard walls.
// This is a JS re-implementation of the Python reference recorded in
// docs/dynamic/support-heatsink/ (Codex support request 4, branch
// codex/support-heatsink-performance); the discretisation, interface
// conductances, radiation operator and nonlinear convergence budgets are
// the same.  Only the linear solver differs: CSR + ILU(0)-preconditioned
// BiCGSTAB instead of a sparse direct LU, with the final acceptance made
// on the true nonlinear residual.  It is NOT a general 3D CFD solver:
// no momentum development, no buoyancy (zero flow is refused, never
// relabelled natural convection), no fan/manifold losses, no
// temperature-dependent properties and no 3D radiation.  The existing
// prescribed-h learning model (dynamic/dev/heat-sink.mjs) is untouched.
const LAW='coupled-base3d-thinfin-developed-flow-local-radiosity-v1';
const SIGMA=5.670374419e-8;
const NU_REFERENCE=7.5407008740694379;
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v===0?0:v;};
const only=(o,keys,name)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))throw Error(`${name}の未対応条件を無視しません。`);};

export const HEAT_SINK_COUPLED_STANDARD_CONDITIONS=Object.freeze({
 length:.12,finCount:7,finThickness:.001,gap:.003,finHeight:.03,baseThickness:.003,
 solidK:167,fluidRho:1.177,fluidCp:1006,fluidK:.0264,fluidNu:1.575e-5,
 ambient:300,totalFlow:7.2e-4,power:10,emissivity:.8,patchLength:.03,patchWidth:.009});

// ---------------------------------------------------------------------------
// Sparse CSR toolkit.  Triplets are accumulated, sorted and duplicate-summed
// exactly like the reference COO assembly.
// ---------------------------------------------------------------------------
class Triplets{
 constructor(n){this.n=n;this.rows=[];this.cols=[];this.vals=[];}
 add(r,c,v){this.rows.push(r);this.cols.push(c);this.vals.push(v);}
 edge(a,b,g){this.add(a,a,g);this.add(b,b,g);this.add(a,b,-g);this.add(b,a,-g);}
 diag(a,g){this.add(a,a,g);}
 toCSR(){
  const n=this.n,count=new Int32Array(n+1);
  for(const r of this.rows)count[r+1]++;
  for(let i=0;i<n;i++)count[i+1]+=count[i];
  const m=this.rows.length,order=new Int32Array(m);
  const cursor=count.slice(0,n);
  for(let k=0;k<m;k++)order[cursor[this.rows[k]]++]=k;
  const sRows=new Int32Array(m),sCols=new Int32Array(m),sVals=new Float64Array(m);
  for(let k=0;k<m;k++){const o=order[k];sRows[k]=this.rows[o];sCols[k]=this.cols[o];sVals[k]=this.vals[o];}
  // Sort each row segment by column (insertion sort; rows are short) and merge duplicates.
  const rowPtr=new Int32Array(n+1),colIdx=[],values=[];
  for(let i=0;i<n;i++){
   const a=count[i],b=count[i+1];
   for(let p=a+1;p<b;p++){const c=sCols[p],v=sVals[p];let q=p-1;while(q>=a&&sCols[q]>c){sCols[q+1]=sCols[q];sVals[q+1]=sVals[q];q--;}sCols[q+1]=c;sVals[q+1]=v;}
   rowPtr[i]=colIdx.length;
   let prev=-1;
   for(let p=a;p<b;p++){const c=sCols[p];if(c===prev)values[values.length-1]+=sVals[p];else{colIdx.push(c);values.push(sVals[p]);prev=c;}}
  }
  rowPtr[n]=colIdx.length;
  return {n,rowPtr,colIdx:Int32Array.from(colIdx),values:Float64Array.from(values)};
 }
}
function matVec(A,x,out=new Float64Array(A.n)){
 const {n,rowPtr,colIdx,values}=A;
 for(let i=0;i<n;i++){let s=0;for(let p=rowPtr[i];p<rowPtr[i+1];p++)s+=values[p]*x[colIdx[p]];out[i]=s;}
 return out;
}
// ILU(0) factorisation of a CSR matrix; returns factors packed in one CSR
// value array (unit-diagonal L strictly below, U on/above the diagonal).
function ilu0(A){
 const {n,rowPtr,colIdx}=A,lu=A.values.slice();
 const diagIdx=new Int32Array(n);
 for(let i=0;i<n;i++){diagIdx[i]=-1;for(let p=rowPtr[i];p<rowPtr[i+1];p++)if(colIdx[p]===i){diagIdx[i]=p;break;}}
 const pos=new Map();
 for(let i=0;i<n;i++){
  pos.clear();
  for(let p=rowPtr[i];p<rowPtr[i+1];p++)pos.set(colIdx[p],p);
  for(let p=rowPtr[i];p<rowPtr[i+1];p++){
   const j=colIdx[p];if(j>=i)break;
   if(diagIdx[j]<0||lu[diagIdx[j]]===0)throw Error('ILU(0)の対角ピボットが0です。');
   lu[p]/=lu[diagIdx[j]];
   const lij=lu[p];
   for(let q=rowPtr[j];q<rowPtr[j+1];q++){
    const c=colIdx[q];if(c<=j)continue;
    const target=pos.get(c);if(target!==undefined)lu[target]-=lij*lu[q];
   }
  }
 }
 return {n,rowPtr,colIdx,values:lu};
}
function iluSolve(F,b,out=new Float64Array(F.n)){
 const {n,rowPtr,colIdx,values}=F,y=new Float64Array(n);
 for(let i=0;i<n;i++){let s=b[i];for(let p=rowPtr[i];p<rowPtr[i+1];p++){const j=colIdx[p];if(j>=i)break;s-=values[p]*y[j];}y[i]=s;}
 for(let i=n-1;i>=0;i--){let s=y[i],d=0;for(let p=rowPtr[i];p<rowPtr[i+1];p++){const j=colIdx[p];if(j<i)continue;if(j===i)d=values[p];else s-=values[p]*out[j];}if(d===0)throw Error('ILUの対角ピボットが0です。');out[i]=s/d;}
 return out;
}
// BiCGSTAB with ILU(0) preconditioning.  Convergence is judged on the
// infinity norm of the true residual; failure to converge throws.
function solveLinear(A,F,b,{x0=null,absTol=1e-11,relTol=1e-12,maxIterations=2000}={}){
 const n=A.n,x=x0?x0.slice():new Float64Array(n);
 const r=matVec(A,x,new Float64Array(n));for(let i=0;i<n;i++)r[i]=b[i]-r[i];
 let bMax=0;for(let i=0;i<n;i++)bMax=Math.max(bMax,Math.abs(b[i]));
 const tol=Math.max(absTol,relTol*bMax);
 const maxAbs=v=>{let m=0;for(let i=0;i<n;i++)m=Math.max(m,Math.abs(v[i]));return m;};
 if(maxAbs(r)<=tol)return {x,iterations:0,residual:maxAbs(r)};
 const rHat=r.slice();let rho=1,alpha=1,omega=1;
 const p=new Float64Array(n),v=new Float64Array(n),s=new Float64Array(n),
  pHat=new Float64Array(n),sHat=new Float64Array(n),t=new Float64Array(n),rr=new Float64Array(n);
 const trueResidual=()=>{matVec(A,x,rr);for(let i=0;i<n;i++)rr[i]=b[i]-rr[i];return maxAbs(rr);};
 for(let it=1;it<=maxIterations;it++){
  let rhoNew=0;for(let i=0;i<n;i++)rhoNew+=rHat[i]*r[i];
  if(rhoNew===0)throw Error('線形反復（BiCGSTAB）が破綻しました。');
  const beta=(rhoNew/rho)*(alpha/omega);
  for(let i=0;i<n;i++)p[i]=r[i]+beta*(p[i]-omega*v[i]);
  iluSolve(F,p,pHat);
  matVec(A,pHat,v);
  let rv=0;for(let i=0;i<n;i++)rv+=rHat[i]*v[i];
  if(rv===0)throw Error('線形反復（BiCGSTAB）が破綻しました。');
  alpha=rhoNew/rv;
  for(let i=0;i<n;i++){s[i]=r[i]-alpha*v[i];x[i]+=alpha*pHat[i];}
  if(maxAbs(s)<=tol&&trueResidual()<=tol)return {x,iterations:it,residual:maxAbs(rr)};
  iluSolve(F,s,sHat);
  matVec(A,sHat,t);
  let tt=0,ts=0;for(let i=0;i<n;i++){tt+=t[i]*t[i];ts+=t[i]*s[i];}
  if(tt===0)throw Error('線形反復（BiCGSTAB）が破綻しました。');
  omega=ts/tt;
  for(let i=0;i<n;i++){x[i]+=omega*sHat[i];r[i]=s[i]-omega*t[i];}
  rho=rhoNew;
  if(maxAbs(r)<=tol){if(trueResidual()<=tol)return {x,iterations:it,residual:maxAbs(rr)};r.set(rr);}
 }
 throw Error('線形反復（BiCGSTAB）が収束しませんでした。');
}

// ---------------------------------------------------------------------------
// Channel hydraulics: -laplacian psi = 1 on the cross-section, no slip on
// the sides and bottom, free shear on the top (symmetry Neumann).
// ---------------------------------------------------------------------------
export function channelProfile(s,H,ny,nz){
 if(!(s>0)||!(H>0)||!Number.isSafeInteger(ny)||!Number.isSafeInteger(nz)||ny<2||nz<2)throw Error('流路断面の寸法・格子が不正です。');
 const dy=s/ny,dz=H/nz,N=ny*nz,trip=new Triplets(N);
 const id=(z,y)=>z*ny+y;
 const edge=(a,b,g)=>trip.edge(a,b,g);
 for(let z=0;z<nz;z++)for(let y=0;y<ny-1;y++)edge(id(z,y),id(z,y+1),dz/dy);
 for(let z=0;z<nz-1;z++)for(let y=0;y<ny;y++)edge(id(z,y),id(z+1,y),dy/dz);
 for(let z=0;z<nz;z++){trip.diag(id(z,0),2*dz/dy);trip.diag(id(z,ny-1),2*dz/dy);}
 for(let y=0;y<ny;y++)trip.diag(id(0,y),2*dy/dz);
 const A=trip.toCSR(),F=ilu0(A),rhs=new Float64Array(N).fill(dy*dz);
 const {x}=solveLinear(A,F,rhs,{absTol:0,relTol:1e-12});
 const res=matVec(A,x,new Float64Array(N));let maxResidual=0,integral=0;
 for(let i=0;i<N;i++){maxResidual=Math.max(maxResidual,Math.abs(res[i]-rhs[i]));integral+=x[i]*dy*dz;}
 return {psi:x,integral,maximumPoissonResidual:maxResidual,ny,nz};
}
export function allocateChannelFlow(gaps,H,L,mu,{ny,nz,flow=null,pressure=null,profileRefinement=1}={}){
 if((flow===null)===(pressure===null))throw Error('総流量か圧力差のどちらか一方を指定してください。');
 if(!(H>0)||!(L>0)||!(mu>0))throw Error('流路の高さ・長さ・粘度は正の値です。');
 const given=flow!==null?flow:pressure;
 if(!(given>0))throw Error('流量0または逆流は自然対流モデルが必要であり、この強制対流参照では解きません。');
 if(profileRefinement!==1&&profileRefinement!==2)throw Error('速度副格子細分化は1か2です。');
 const profiles=gaps.map(s=>channelProfile(s,H,ny*profileRefinement,nz*profileRefinement));
 const mobilities=profiles.map(p=>p.integral/(mu*L));
 const mobSum=mobilities.reduce((a,b)=>a+b,0);
 const dp=flow!==null?flow/mobSum:pressure;
 const channelFlows=mobilities.map(m=>dp*m);
 const velocities=profiles.map(p=>{
  const pr=profileRefinement,u=new Float64Array(nz*ny);
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++){
   let ssum=0;for(let dz2=0;dz2<pr;dz2++)for(let dy2=0;dy2<pr;dy2++)ssum+=p.psi[(z*pr+dz2)*(ny*pr)+(y*pr+dy2)];
   u[z*ny+y]=dp/(mu*L)*(ssum/(pr*pr));
  }
  return u;
 });
 return {pressurePa:dp,flowM3PerS:channelFlows.reduce((a,b)=>a+b,0),channelFlows,mobilities,velocities,
  maximumPoissonResidual:Math.max(...profiles.map(p=>p.maximumPoissonResidual))};
}
// Continuum mobility integral of the mirrored no-slip rectangle s x 2H.
export function rectangleMobilitySeries(s,H,terms=2000){
 let sum=0;for(let k=0;k<terms;k++){const n=2*k+1;sum+=Math.tanh(n*Math.PI*H/s)/Math.pow(n,5);}
 return H*Math.pow(s,3)/12*(1-96*s/(Math.PI**5*H)*sum);
}

// ---------------------------------------------------------------------------
// Cross-section radiation: crossed-string view factors and the radiosity
// operator of the reference (per unit x length, times segment length).
// ---------------------------------------------------------------------------
function viewFactors(s,H,ny,nz){
 const starts=[],ends=[];
 for(let i=0;i<ny;i++){starts.push([i*s/ny,0]);ends.push([(i+1)*s/ny,0]);}
 for(let i=0;i<nz;i++){starts.push([s,i*H/nz]);ends.push([s,(i+1)*H/nz]);}
 starts.push([s,H]);ends.push([0,H]);
 for(let i=0;i<nz;i++){starts.push([0,H-i*H/nz]);ends.push([0,H-(i+1)*H/nz]);}
 const n=starts.length,lens=starts.map((a,i)=>Math.hypot(ends[i][0]-a[0],ends[i][1]-a[1]));
 const dist=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
 const F=[];
 for(let i=0;i<n;i++){F.push(new Float64Array(n));
  for(let j=0;j<n;j++){
   if(i===j)continue;
   const ex=(dist(starts[i],starts[j])+dist(ends[i],ends[j])-dist(starts[i],ends[j])-dist(ends[i],starts[j]))/2;
   if(ex< -1e-12*Math.max(s,H))throw Error('交差弦の交換量が負になりました。');
   F[i][j]=Math.max(ex,0)/lens[i];
  }}
 return {F,lens};
}
function radiosityOperator(F,lens,epsilon){
 const n=lens.length;
 // Solve M X = diag(epsilon) with M = I - (1-e) F, Gaussian elimination.
 const A=[];for(let i=0;i<n;i++){A.push(new Float64Array(2*n));for(let j=0;j<n;j++){A[i][j]=(i===j?1:0)-(1-epsilon[i])*F[i][j];if(i===j)A[i][n+j]=epsilon[i];}}
 for(let col=0;col<n;col++){
  let piv=col;for(let r=col+1;r<n;r++)if(Math.abs(A[r][col])>Math.abs(A[piv][col]))piv=r;
  if(Math.abs(A[piv][col])===0)throw Error('射度演算子の行列が特異です。');
  if(piv!==col){const t=A[piv];A[piv]=A[col];A[col]=t;}
  for(let r=col+1;r<n;r++){const f=A[r][col]/A[col][col];if(f===0)continue;for(let c=col;c<2*n;c++)A[r][c]-=f*A[col][c];}
 }
 const X=[];for(let i=0;i<n;i++)X.push(new Float64Array(n));
 for(let col=0;col<n;col++)for(let i=n-1;i>=0;i--){let s=A[i][n+col];for(let j=i+1;j<n;j++)s-=A[i][j]*X[j][col];X[i][col]=s/A[i][i];}
 const R=[];
 for(let i=0;i<n;i++){R.push(new Float64Array(n));
  for(let j=0;j<n;j++){let s=0;for(let k=0;k<n;k++)s+=((i===k?1:0)-F[i][k])*X[k][j];R[i][j]=lens[i]*s*SIGMA;}}
 return R;
}
const fourthDifference=(theta,T)=>theta*(4*T**3+theta*(6*T*T+theta*(4*T+theta)));

// ---------------------------------------------------------------------------
// Coupled steady solve.
// ---------------------------------------------------------------------------
const CONDITION_KEYS=['length','finCount','finThickness','gap','finHeight','baseThickness','solidK','fluidRho','fluidCp','fluidK','fluidNu','ambient','totalFlow','power','emissivity','patchLength','patchWidth'];
export function solveHeatSinkCoupled(input={},options={}){
 only(input,CONDITION_KEYS,'連成ヒートシンク条件');
 only(options,['refinement','hydraulicRefinement'],'連成ヒートシンク選択');
 const c={...HEAT_SINK_COUPLED_STANDARD_CONDITIONS,...input};
 for(const key of ['length','finThickness','gap','finHeight','baseThickness','solidK','fluidRho','fluidCp','fluidK','fluidNu','ambient','patchLength','patchWidth'])finite(c[key],key,true);
 finite(c.power,'発熱量');finite(c.totalFlow,'総流量');finite(c.emissivity,'放射率');
 if(c.power<0)throw Error('発熱量は0以上です。');
 if(!Number.isSafeInteger(c.finCount)||c.finCount<1||c.finCount>64)throw Error('フィン本数は1〜64です。');
 if(c.emissivity<0||c.emissivity>1)throw Error('放射率は0〜1です。');
 if(c.totalFlow<=0)throw Error('流量0または逆流は自然対流モデルが必要であり、この強制対流参照では解きません。');
 const r=options.refinement??4,hr=options.hydraulicRefinement??2;
 if(!Number.isSafeInteger(r)||r<1||r>4)throw Error('細分化は1〜4です（参照格子は1/2/4）。');
 if(hr!==1&&hr!==2)throw Error('速度副格子細分化は1か2です。');
 const ks=c.solidK,kf=c.fluidK,Tamb=c.ambient,mu=c.fluidRho*c.fluidNu;
 const width=c.finCount*c.finThickness+(c.finCount+1)*c.gap;
 const hReference=NU_REFERENCE*kf/(2*c.gap);
 const nx=8*r,nzf=4*r,nyg=3*r,nzb=r,ng=c.finCount+1;
 const dx=c.length/nx,dzf=c.finHeight/nzf,dyF=c.gap/nyg,dzb=c.baseThickness/nzb;
 // Base y grid: alternating gap (nyg cells) and fin footprint (r cells).
 const ye=[0],gapY=[],finY=[];
 for(let j=0;j<ng;j++){
  const start=ye.length-1,idx=[];
  for(let k=1;k<=nyg;k++)ye.push(ye[ye.length-1]+c.gap/nyg);
  for(let y=0;y<nyg;y++)idx.push(start+y);
  gapY.push(idx);
  if(j<c.finCount){const fs=ye.length-1,fidx=[];for(let k=1;k<=r;k++)ye.push(ye[ye.length-1]+c.finThickness/r);for(let y=0;y<r;y++)fidx.push(fs+y);finY.push(fidx);}
 }
 const Y=ye.length-1,dyB=[];for(let y=0;y<Y;y++)dyB.push(ye[y+1]-ye[y]);
 const nb=nzb*Y*nx,nf=c.finCount*nzf*nx,nfluid=ng*nzf*nyg*nx,size=nb+nf+nfluid;
 const baseId=(z,y,x)=>z*(Y*nx)+y*nx+x;
 const finId=(j,z,x)=>nb+j*(nzf*nx)+z*nx+x;
 const fluidId=(j,z,y,x)=>nb+nf+j*(nzf*nyg*nx)+z*(nyg*nx)+y*nx+x;
 // Heat source patch on the bottom face, centred.
 const overlap=(edges,w,center)=>edges.slice(0,-1).map((e,i)=>Math.max(0,Math.min(edges[i+1],center+w/2)-Math.max(e,center-w/2)));
 const xe=[];for(let i=0;i<=nx;i++)xe.push(i*dx);
 const ax=overlap(xe,c.patchLength,c.length/2),ay=overlap(ye,c.patchWidth,width/2);
 const patch=[],source=[];
 let patchSum=0;for(let y=0;y<Y;y++){patch.push([]);source.push([]);for(let x=0;x<nx;x++){const a=ay[y]*ax[x];patch[y].push(a);source[y].push(c.power*a/(c.patchWidth*c.patchLength));patchSum+=a;}}
 if(Math.abs(patchSum-c.patchWidth*c.patchLength)>1e-12)throw Error('発熱パッチが基部下面の外に出ています。');
 const Kt=new Triplets(size),b=new Float64Array(size);
 for(let y=0;y<Y;y++)for(let x=0;x<nx;x++)b[baseId(0,y,x)]=source[y][x];
 // Base conduction.
 for(let z=0;z<nzb;z++)for(let y=0;y<Y;y++)for(let x=0;x<nx-1;x++)Kt.edge(baseId(z,y,x),baseId(z,y,x+1),ks*dyB[y]*dzb/dx);
 for(let z=0;z<nzb;z++)for(let y=0;y<Y-1;y++)for(let x=0;x<nx;x++)Kt.edge(baseId(z,y,x),baseId(z,y+1,x),ks*dx*dzb/((dyB[y]+dyB[y+1])/2));
 if(nzb>1)for(let z=0;z<nzb-1;z++)for(let y=0;y<Y;y++)for(let x=0;x<nx;x++)Kt.edge(baseId(z,y,x),baseId(z+1,y,x),ks*dyB[y]*dx/dzb);
 // Fins: 2D conduction, root coupling, prescribed-h end faces.
 for(let j=0;j<c.finCount;j++){
  for(let z=0;z<nzf;z++)for(let x=0;x<nx-1;x++)Kt.edge(finId(j,z,x),finId(j,z,x+1),ks*c.finThickness*dzf/dx);
  for(let z=0;z<nzf-1;z++)for(let x=0;x<nx;x++)Kt.edge(finId(j,z,x),finId(j,z+1,x),ks*c.finThickness*dx/dzf);
  for(const yidx of finY[j]){const G=ks*(dyB[yidx]*dx)/(dzb/2+dzf/2);for(let x=0;x<nx;x++)Kt.edge(baseId(nzb-1,yidx,x),finId(j,0,x),G);}
  for(let z=0;z<nzf;z++){Kt.diag(finId(j,z,0),hReference*c.finThickness*dzf);Kt.diag(finId(j,z,nx-1),hReference*c.finThickness*dzf);}
 }
 // Hydraulics and fluid transport.
 const hydro=allocateChannelFlow(Array(ng).fill(c.gap),c.finHeight,c.length,mu,{ny:nyg,nz:nzf,flow:c.totalFlow,profileRefinement:hr});
 const Gbf=dx*dyF/(dzb/(2*ks)+dzf/(2*kf)),Gff=dx*dzf/(c.finThickness/(2*ks)+dyF/(2*kf));
 for(let j=0;j<ng;j++){
  const u=hydro.velocities[j];
  for(let z=0;z<nzf;z++)for(let y=0;y<nyg;y++)for(let x=0;x<nx;x++){
   if(y<nyg-1)Kt.edge(fluidId(j,z,y,x),fluidId(j,z,y+1,x),kf*dx*dzf/dyF);
   if(z<nzf-1)Kt.edge(fluidId(j,z,y,x),fluidId(j,z+1,y,x),kf*dx*dyF/dzf);
   const f=c.fluidRho*c.fluidCp*u[z*nyg+y]*dyF*dzf;
   Kt.diag(fluidId(j,z,y,x),f);
   if(x>0)Kt.add(fluidId(j,z,y,x),fluidId(j,z,y,x-1),-f);
  }
  for(let iy=0;iy<nyg;iy++){const by=gapY[j][iy];for(let x=0;x<nx;x++)Kt.edge(baseId(nzb-1,by,x),fluidId(j,0,iy,x),Gbf);}
  if(j>0)for(let z=0;z<nzf;z++)for(let x=0;x<nx;x++)Kt.edge(finId(j-1,z,x),fluidId(j,z,0,x),Gff);
  if(j<c.finCount)for(let z=0;z<nzf;z++)for(let x=0;x<nx;x++)Kt.edge(finId(j,z,x),fluidId(j,z,nyg-1,x),Gff);
 }
 // Radiation per x column (local long-duct cross-section).
 const Rt=new Triplets(size),ambientLinks=[];
 let radiationClosure=0,radiationReciprocity=0;
 const {F:vf,lens}=viewFactors(c.gap,c.finHeight,nyg,nzf),nseg=lens.length;
 for(let i=0;i<nseg;i++){let s=0;for(let j=0;j<nseg;j++)s+=vf[i][j];radiationClosure=Math.max(radiationClosure,Math.abs(s-1));}
 for(let j=0;j<ng;j++){
  const segNodes=[];
  for(let iy=0;iy<nyg;iy++){const by=gapY[j][iy];segNodes.push(Int32Array.from({length:nx},(_,x)=>baseId(nzb-1,by,x)));}
  for(let iz=0;iz<nzf;iz++)segNodes.push(j<c.finCount?Int32Array.from({length:nx},(_,x)=>finId(j,iz,x)):null);
  segNodes.push(null);
  for(let k=0;k<nzf;k++)segNodes.push(j>0?Int32Array.from({length:nx},(_,x)=>finId(j-1,nzf-1-k,x)):null);
  const eps=new Float64Array(nseg).fill(c.emissivity);eps[nyg+nzf]=1;
  if(j===ng-1)for(let iz=0;iz<nzf;iz++)eps[nyg+iz]=0;
  if(j===0)for(let k=0;k<nzf;k++)eps[nseg-1-k]=0;
  const R=radiosityOperator(vf,lens,eps);
  let rMax=0,recip=0;for(let a=0;a<nseg;a++)for(let bb=0;bb<nseg;bb++){rMax=Math.max(rMax,Math.abs(R[a][bb]));recip=Math.max(recip,Math.abs(R[a][bb]-R[bb][a]));}
  if(rMax>0)radiationReciprocity=Math.max(radiationReciprocity,recip/rMax);
  if(c.emissivity===0)continue;
  for(let a=0;a<nseg;a++)for(let bb=a+1;bb<nseg;bb++){
   const g=Math.max(0,-.5*(R[a][bb]+R[bb][a])*dx);if(g<1e-26)continue;
   const na=segNodes[a],nb2=segNodes[bb];
   if(na&&nb2)for(let x=0;x<nx;x++)Rt.edge(na[x],nb2[x],g);
   else if(na||nb2){const ii=na||nb2;for(let x=0;x<nx;x++)Rt.diag(ii[x],g);ambientLinks.push({ids:ii,g});}
  }
 }
 const K=Kt.toCSR(),R=Rt.toCSR(),LU=ilu0(K);
 let linearIterations=0;
 const radF=new Float64Array(size);
 const applyRad=theta=>{for(let i=0;i<size;i++)radF[i]=fourthDifference(theta[i],Tamb);return matVec(R,radF,new Float64Array(size));};
 // Picard iteration on the radiation term, same budgets as the reference.
 const firstSolve=solveLinear(K,LU,b,{absTol:1e-11,relTol:1e-12});
 let theta=firstSolve.x;linearIterations+=firstSolve.iterations;
 const history=[];
 for(let it=1;it<=60;it++){
  const rhs=b.slice(),rf=applyRad(theta);
  for(let i=0;i<size;i++)rhs[i]-=rf[i];
  const step=solveLinear(K,LU,rhs,{x0:theta,absTol:1e-11,relTol:1e-12});
  const next=step.x;linearIterations+=step.iterations;
  let change=0;for(let i=0;i<size;i++)change=Math.max(change,Math.abs(next[i]-theta[i]));
  let tMin=Infinity,tMax=-Infinity;for(let i=0;i<size;i++){tMin=Math.min(tMin,next[i]);tMax=Math.max(tMax,next[i]);}
  if(!Number.isFinite(change)||Tamb+tMin<=0||Tamb+tMax>500)throw Error('放射反復が正の絶対温度・500K以下の予算を外れました。');
  theta=next;
  const res=matVec(K,theta,new Float64Array(size)),rf2=applyRad(theta);
  let maxRes=0;for(let i=0;i<size;i++)maxRes=Math.max(maxRes,Math.abs(res[i]+rf2[i]-b[i]));
  history.push({iteration:it,maximumChangeK:change,maximumResidualW:maxRes});
  if(change<1e-10&&maxRes<1e-10)break;
  if(it===60)throw Error('放射の固定点反復が収束しませんでした。');
 }
 // Measurement, mirroring the reference post-processing.
 const f4=new Float64Array(size);for(let i=0;i<size;i++)f4[i]=fourthDifference(theta[i],Tamb);
 const surf=new Float64Array(Y*nx);let surfWeighted=0;
 for(let y=0;y<Y;y++)for(let x=0;x<nx;x++){surf[y*nx+x]=theta[baseId(0,y,x)]+source[y][x]/(dyB[y]*dx)*dzb/(2*ks);surfWeighted+=surf[y*nx+x]*patch[y][x];}
 const sourceAverageTemperatureK=Tamb+surfWeighted/patchSum;
 let maxBaseTheta=-Infinity,baseWeighted=0,baseMin=Infinity;
 for(let z=0;z<nzb;z++)for(let y=0;y<Y;y++)for(let x=0;x<nx;x++){const v=theta[baseId(z,y,x)];maxBaseTheta=Math.max(maxBaseTheta,v);baseMin=Math.min(baseMin,v);baseWeighted+=v*dyB[y]*dx*dzb;}
 const baseVolumeMeanTemperatureK=Tamb+baseWeighted/(width*c.length*c.baseThickness);
 let sourceFaceMax=-Infinity;for(let y=0;y<Y;y++)for(let x=0;x<nx;x++)if(patch[y][x]>0)sourceFaceMax=Math.max(sourceFaceMax,surf[y*nx+x]);
 let finMin=Infinity,finMax=-Infinity;
 for(let j=0;j<c.finCount;j++)for(let z=0;z<nzf;z++)for(let x=0;x<nx;x++){const v=theta[finId(j,z,x)];finMin=Math.min(finMin,v);finMax=Math.max(finMax,v);}
 let outgoing=0,interfaceHeat=0;const bulkTemperaturesK=[],channelInterfaceHeatsW=[];
 for(let j=0;j<ng;j++){
  const u=hydro.velocities[j];let fSum=0;const fCol=[];
  for(let z=0;z<nzf;z++){fCol.push([]);for(let y=0;y<nyg;y++){const f=c.fluidRho*c.fluidCp*u[z*nyg+y]*dyF*dzf;fCol[z].push(f);fSum+=f;}}
  for(let z=0;z<nzf;z++)for(let y=0;y<nyg;y++)outgoing+=fCol[z][y]*theta[fluidId(j,z,y,nx-1)];
  const bulk=[];for(let x=0;x<nx;x++){let s=0;for(let z=0;z<nzf;z++)for(let y=0;y<nyg;y++)s+=fCol[z][y]*theta[fluidId(j,z,y,x)];bulk.push(Tamb+s/fSum);}
  bulkTemperaturesK.push(bulk);
  let wall=0;
  for(let iy=0;iy<nyg;iy++){const by=gapY[j][iy];for(let x=0;x<nx;x++)wall+=Gbf*(theta[baseId(nzb-1,by,x)]-theta[fluidId(j,0,iy,x)]);}
  if(j>0)for(let z=0;z<nzf;z++)for(let x=0;x<nx;x++)wall+=Gff*(theta[finId(j-1,z,x)]-theta[fluidId(j,z,0,x)]);
  if(j<c.finCount)for(let z=0;z<nzf;z++)for(let x=0;x<nx;x++)wall+=Gff*(theta[finId(j,z,x)]-theta[fluidId(j,z,nyg-1,x)]);
  interfaceHeat+=wall;channelInterfaceHeatsW.push(wall);
 }
 let endTheta=0;for(let j=0;j<c.finCount;j++)for(let z=0;z<nzf;z++)endTheta+=theta[finId(j,z,0)]+theta[finId(j,z,nx-1)];
 const endConvectionW=hReference*c.finThickness*dzf*endTheta;
 const radVec=matVec(R,f4,new Float64Array(size));let radiationOutwardW=0;for(let i=0;i<size;i++)radiationOutwardW+=radVec[i];
 let radiationApertureW=0;for(const {ids,g} of ambientLinks){let s=0;for(let x=0;x<nx;x++)s+=f4[ids[x]];radiationApertureW+=g*s;}
 const energyResidualW=c.power-outgoing-endConvectionW-radiationOutwardW;
 const kres=matVec(K,theta,new Float64Array(size));
 let solidRes=0,fluidRes=0;
 for(let i=0;i<size;i++){const v=Math.abs(kres[i]+radVec[i]-b[i]);if(i<nb+nf)solidRes=Math.max(solidRes,v);else fluidRes=Math.max(fluidRes,v);}
 const analyticMobility=rectangleMobilitySeries(c.gap,c.finHeight);
 const U=c.totalFlow/(ng*c.gap*c.finHeight),Dh=4*c.gap*c.finHeight/(c.gap+2*c.finHeight);
 return {
  law:LAW,releaseApproved:false,generalCFD:false,
  conditions:Object.freeze({...c,width,hReference}),
  refinement:r,hydraulicRefinement:hr,unknowns:size,nx,nyBase:Y,nzBase:nzb,nyFluid:nyg,nzFin:nzf,
  linearIterations,nonlinearHistory:history,
  sourceAverageTemperatureK,maximumBaseCellTemperatureK:Tamb+maxBaseTheta,
  sourceFaceMaximumTemperatureK:Tamb+sourceFaceMax,baseVolumeMeanTemperatureK,
  baseTemperatureRangeK:maxBaseTheta-baseMin,
  finTemperatureRangeK:[Tamb+finMin,Tamb+finMax],
  bulkTemperaturesK,heatToFluidW:interfaceHeat,fluidEnthalpyIncreaseW:outgoing,
  endConvectionW,radiationOutwardW,radiationApertureW,channelInterfaceHeatsW,
  energyResidualW,relativeEnergyResidual:Math.abs(energyResidualW)/Math.max(c.power,1),
  fluidInternalBalanceW:interfaceHeat-outgoing,radiationInternalBalanceW:radiationOutwardW-radiationApertureW,
  solidResidualMaximumW:solidRes,fluidResidualMaximumW:fluidRes,
  radiationViewClosure:radiationClosure,radiationReciprocity,
  pressureDropPa:hydro.pressurePa,totalFlowM3PerS:hydro.flowM3PerS,channelFlowsM3PerS:hydro.channelFlows,
  hydraulicMobilityRelativeError:hydro.mobilities[0]*(mu*c.length)/analyticMobility-1,
  maximumPoissonResidual:hydro.maximumPoissonResidual,
  meanChannelSpeedMPerS:U,RePlanar:U*2*c.gap/c.fluidNu,ReWetted:U*Dh/c.fluidNu,
  PePlanar:U*2*c.gap*c.fluidRho*c.fluidCp/kf,
  transverseFinBi:hReference*c.finThickness/(2*ks),
  approximateRichardsonHeight:9.81/Tamb*(sourceAverageTemperatureK-Tamb)*c.finHeight/(U*U),
  sourceToBaseVolumeMeanResistanceKPerW:c.power?(sourceAverageTemperatureK-baseVolumeMeanTemperatureK)/c.power:null,
  boundaryTemperatureApproximation:'Radiation uses base/fin adjacent cell temperature, not an independently solved surface node',
  theta,baseId,finId,fluidId};
}
