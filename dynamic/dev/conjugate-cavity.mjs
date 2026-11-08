// Development-only DIMENSIONLESS conjugate natural convection: a finite-
// thickness solid slab on the left (back face held at theta=1) bonded without
// contact resistance to a closed square fluid cavity (right wall theta=0,
// adiabatic top/bottom, no-slip everywhere). Temperature is one cell-centred
// FVM field over solid+fluid with harmonic half-cell face conductances, so the
// interface temperature and flux are continuous by construction and no
// separate interface h is inserted. Fluid momentum is the conservative MAC
// form projected by multigrid V-cycle defect correction on the same
// Neumann graph Laplacian, zero-mean gauge and 1e-10 relative tolerance as
// the shared projectFaces; the solver is implemented in-module on typed
// arrays because the shared implementation's measured 46 ms per call at
// n=16 makes full transient verification infeasible, so only the
// implementation differs (a PCG driver was measured to stagnate/break down
// near the 1e-10 floor with this preconditioner; the stationary iteration
// has no breakdown mode and is judged on the true residual every cycle).
// The whole state advances with SSPRK2 and four Kahan-compensated
// heat integrals (back, cold wall, solid source, interface) close three
// storage balances every step. Validated scope: delta=d/H=0.25,
// 0<=Ra<=1000, Pr=0.71 record conditions; the public cavity acceptance
// range is untouched.

const LAW='conjugate-cavity-FVM-MAC-SSPRK2-v1';
const ENERGY_TOLERANCE=1e-9;
const TINY=2.2250738585072014e-308;
const finite=(x,name,positive=false)=>{if(typeof x!=='number'||!Number.isFinite(x)||(positive&&x<=0))throw Error(`${name}が数値範囲外です。`);return x===0?0:x;};
const only=(o,keys,name)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))throw Error(`${name}の未対応条件を無視しません。`);};
const field=(value,length,name)=>{const a=Array.from(value??[]);if(a.length!==length)throw Error(`${name}の要素数が一致しません。`);return Float64Array.from(a,x=>finite(x,name));};

export function createConjugateCavity(input){
 only(input,['n','rayleigh','prandtl','conductivityRatio','capacityRatio','source','initialTemperature','initialVelocity','pressureTolerance','pressurePreconditioner'],'共役キャビティ');
 const c=structuredClone(input);
 const n=c.n;
 if(!Number.isSafeInteger(n)||n<8||n>96||n%4!==0)throw Error('共役キャビティの格子nは8〜96の4の倍数です（固体はn/4列、厚さ比0.25固定）。');
 const ns=n/4,nx=n+ns,N=nx*n,s=ns,delta=ns/n;
 const Ra=finite(c.rayleigh,'Rayleigh数');if(Ra<0||Ra>1000)throw Error('共役キャビティの検証範囲はRa≤1000です。');
 const Pr=finite(c.prandtl??0.71,'Prandtl数',true);
 const K=finite(c.conductivityRatio,'熱伝導率比K',true);
 const C=finite(c.capacityRatio,'体積熱容量比C',true);
 const S=finite(c.source??0,'固体体積源S');if(S<0)throw Error('固体体積源Sは非負です。');
 const pressureTolerance=finite(c.pressureTolerance??1e-10,'圧力許容',true);if(pressureTolerance>=1e-6)throw Error('圧力許容は1e-6未満です。');
 const preKind=c.pressurePreconditioner??'multigrid';if(!['multigrid','none'].includes(preKind))throw Error('圧力前処理はmultigridかnoneです。');
 const gb=Pr*Ra;
 const kcol=Float64Array.from({length:nx},(_,i)=>i<s?K:1),capcol=Float64Array.from({length:nx},(_,i)=>(i<s?C:1)/(n*n));
 const gx=Float64Array.from({length:nx-1},(_,i)=>2*kcol[i]*kcol[i+1]/(kcol[i]+kcol[i+1]));
 let maxDiagRate=0;
 for(let j=0;j<n;j++)for(let i=0;i<nx;i++){let d=(i>0?gx[i-1]:0)+(i<nx-1?gx[i]:0)+(j>0?kcol[i]:0)+(j<n-1?kcol[i]:0)+(i===0?2*K:0)+(i===nx-1?2:0);maxDiagRate=Math.max(maxDiagRate,d/capcol[i]);}
 // State: T is one field over solid+fluid cells (row j = y, column i = x).
 const T0=typeof c.initialTemperature==='number'?new Float64Array(N).fill(finite(c.initialTemperature,'初期温度')):field(c.initialTemperature??new Float64Array(N).fill(.5),N,'初期温度');
 let T=T0.slice(),U=new Float64Array(n*(n+1)),V=new Float64Array((n+1)*n),P=new Float64Array(n*n);
 if(c.initialVelocity!==undefined){only(c.initialVelocity,['u','v'],'初期速度');U=field(c.initialVelocity.u,n*(n+1),'初期u');V=field(c.initialVelocity.v,(n+1)*n,'初期v');}
 let time=0,steps=0,lastDt=0,maxPe=0,lastDivergence=0,lastPressureIterations=0,totalPressureIterations=0;
 let heats=new Float64Array(4),heatComp=new Float64Array(4);
 const F1=new Float64Array(N),F2=new Float64Array(N),FS=new Float64Array(N),T1=new Float64Array(N),T2=new Float64Array(N);
 const aS=new Float64Array(n*(n+1)),bS=new Float64Array((n+1)*n),U1=new Float64Array(n*(n+1)),V1=new Float64Array((n+1)*n),U2=new Float64Array(n*(n+1)),V2=new Float64Array((n+1)*n),PU=new Float64Array(n*(n+1)),PV=new Float64Array((n+1)*n),phi1=new Float64Array(n*n),phi2=new Float64Array(n*n);
 const cu=new Float64Array(n*n),cv=new Float64Array(n*n),uv=new Float64Array((n+1)*(n+1));
 const checksum=a=>{let x=0,y=0;for(const v of a){x+=v;y+=v*v;}return [x,y];};
 const signature=JSON.stringify({law:LAW,n,rayleigh:Ra,prandtl:Pr,conductivityRatio:K,capacityRatio:C,source:S,initial:checksum(T0)});
 const config=Object.freeze({n,rayleigh:Ra,prandtl:Pr,conductivityRatio:K,capacityRatio:C,source:S,thicknessRatio:delta,pressureTolerance,pressurePreconditioner:preKind});
 const mesh=Object.freeze({kind:'solid-slab-closed-cavity-conjugate',n,solidColumns:ns,columns:nx,rows:n,thicknessRatio:delta,count:N,fluidCells:n*n});

 function thermal(Tin,Uin,Vin,Fout,powers,ifaceTemp){
  Fout.fill(0);
  for(let j=0;j<n;j++){const r=j*nx;for(let i=0;i<nx-1;i++){const q=gx[i]*(Tin[r+i+1]-Tin[r+i]);Fout[r+i]+=q;Fout[r+i+1]-=q;}}
  for(let j=0;j<n-1;j++){const r=j*nx,r2=r+nx;for(let i=0;i<nx;i++){const q=kcol[i]*(Tin[r2+i]-Tin[r+i]);Fout[r+i]+=q;Fout[r2+i]-=q;}}
  for(let j=0;j<n;j++){const r=j*nx+s,ru=j*(n+1);for(let f=1;f<n;f++){const a=-Uin[ru+f]*(Tin[r+f-1]+Tin[r+f])/(2*n);Fout[r+f-1]+=a;Fout[r+f]-=a;}}
  for(let g=1;g<n;g++){const rv=g*n,r0=(g-1)*nx+s,r1=g*nx+s;for(let i=0;i<n;i++){const a=-Vin[rv+i]*(Tin[r0+i]+Tin[r1+i])/(2*n);Fout[r0+i]+=a;Fout[r1+i]-=a;}}
  let back=0,cold=0,iface=0;const src=S/(n*n);
  for(let j=0;j<n;j++){const r=j*nx;
   const rb=2*K*(1-Tin[r]);Fout[r]+=rb;back+=rb;
   const rc=-2*Tin[r+nx-1];Fout[r+nx-1]+=rc;cold+=rc;
   const q=gx[s-1]*(Tin[r+s-1]-Tin[r+s]);iface+=q;
   if(ifaceTemp)ifaceTemp[j]=(Tin[r+s-1]-q/(2*K)+Tin[r+s]+q/2)/2;
   if(S!==0)for(let i=0;i<s;i++)Fout[r+i]+=src;}
  for(let j=0;j<n;j++){const r=j*nx;for(let i=0;i<nx;i++)Fout[r+i]/=capcol[i];}
  powers[0]=back;powers[1]=cold;powers[2]=S*delta;powers[3]=iface;
 }
 function momentum(Tin,Uin,Vin){
  aS.fill(0);bS.fill(0);
  if(Ra===0)return;
  for(let j=0;j<n;j++){const ru=j*(n+1),rv=j*n,rc=j*n;
   for(let i=0;i<n;i++){const mu=(Uin[ru+i]+Uin[ru+i+1])/2;cu[rc+i]=mu*mu;const mv=(Vin[rv+i]+Vin[rv+n+i])/2;cv[rc+i]=mv*mv;}}
  uv.fill(0);
  for(let g=1;g<n;g++){const rc=g*(n+1),ru0=(g-1)*(n+1),ru1=g*(n+1),rv=g*n;
   for(let h=1;h<n;h++)uv[rc+h]=(Uin[ru0+h]+Uin[ru1+h])*(Vin[rv+h-1]+Vin[rv+h])/4;}
  const dif=Pr*n*n;
  for(let j=0;j<n;j++){const ru=j*(n+1),rc=j*n,rcuv=j*(n+1);
   for(let f=1;f<n;f++){const up=j+1<n?Uin[(j+1)*(n+1)+f]:-Uin[(n-1)*(n+1)+f],um=j-1>=0?Uin[(j-1)*(n+1)+f]:-Uin[f];
    aS[ru+f]=dif*(Uin[ru+f+1]+Uin[ru+f-1]+up+um-4*Uin[ru+f])-n*(cu[rc+f]-cu[rc+f-1])-n*(uv[rcuv+n+1+f]-uv[rcuv+f]);}}
  for(let g=1;g<n;g++){const rv=g*n,rvm=(g-1)*n,rvp=(g+1)*n,rc=g*(n+1);
   for(let i=0;i<n;i++){const vr=i+1<n?Vin[rv+i+1]:-Vin[rv+n-1],vl=i-1>=0?Vin[rv+i-1]:-Vin[rv];
    bS[rv+i]=dif*(Vin[rvp+i]+Vin[rvm+i]+vr+vl-4*Vin[rv+i])-n*(uv[rc+i+1]-uv[rc+i])-n*(cv[rv+i]-cv[(g-1)*n+i])+gb*((Tin[g*nx+s+i]+Tin[(g-1)*nx+s+i])/2-.5);}}
 }
 function inspect(Tc,Uc,Vc){
  let tmin=Infinity,tmax=-Infinity,speed=0;
  for(let i=0;i<N;i++){const t=Tc[i];if(!Number.isFinite(t))throw Error('温度が非有限です。');if(t<tmin)tmin=t;if(t>tmax)tmax=t;}
  const bound=1+S*(delta+delta*delta/(2*K));
  if(tmin<-1e-9||tmax>bound+1e-9)throw Error(`無次元温度が監視範囲[0, ${bound}]の外へ出ました。状態は進めていません。`);
  for(let i=0;i<Uc.length;i++){const u=Uc[i];if(!Number.isFinite(u))throw Error('速度が非有限です。');const a=Math.abs(u);if(a>speed)speed=a;}
  for(let i=0;i<Vc.length;i++){const v=Vc[i];if(!Number.isFinite(v))throw Error('速度が非有限です。');const a=Math.abs(v);if(a>speed)speed=a;}
  for(let j=0;j<n;j++)if(Uc[j*(n+1)]!==0||Uc[j*(n+1)+n]!==0)throw Error('閉壁の法線速度が0ではありません。');
  for(let i=0;i<n;i++)if(Vc[i]!==0||Vc[n*n+i]!==0)throw Error('閉壁の法線速度が0ではありません。');
  if(Ra===0&&(Uc.some(x=>x!==0)||Vc.some(x=>x!==0)))throw Error('Ra=0では速度は厳密に0でなければなりません。');
  const pe=speed/n;
  if(pe>2)throw Error(`セルPe=${pe}が中心差分の監視上限2を超えました。状態は進めていません。`);
  return pe;
 }
 function storages(Tc){let es=0,ef=0;for(let j=0;j<n;j++){const r=j*nx;for(let i=0;i<nx;i++){const d=(Tc[r+i]-T0[r+i])*capcol[i];if(i<s)es+=d;else ef+=d;}}return [es,ef];}
 function energy(Tc,H){const [es,ef]=storages(Tc);const errors=[es-(H[0]+H[2]-H[3]),ef-(H[1]+H[3]),es+ef-(H[0]+H[1]+H[2])];
  const scale=Math.abs(es)+Math.abs(ef)+Math.abs(H[0])+Math.abs(H[1])+Math.abs(H[2])+Math.abs(H[3]);
  const mx=Math.max(Math.abs(errors[0]),Math.abs(errors[1]),Math.abs(errors[2]));
  return {solidStorage:es,fluidStorage:ef,errors,scale,relativeMaximumError:scale>0?mx/scale:(mx===0?0:Infinity)};}
 function safeDtNow(){let speed=1;for(let i=0;i<U.length;i++)speed=Math.max(speed,Math.abs(U[i]));for(let i=0;i<V.length;i++)speed=Math.max(speed,Math.abs(V[i]));
  return Math.min(.35/maxDiagRate,Math.min(.12/(n*n),.2/(2*n*speed)));}
 // Neumann Poisson projection on the fluid grid: PCG preconditioned by a
 // geometric multigrid V-cycle (cell-centred rediscretisation, averaging
 // restriction, bilinear prolongation, weighted-Jacobi smoothing). The
 // operator, zero-mean gauge and stopping rule match projectFaces.
 const mgLevels=[];{let ln=n;for(;;){mgLevels.push(ln);if(ln<=4||ln%2!==0)break;ln/=2;}}
 const mgX=mgLevels.map(l=>new Float64Array(l*l)),mgB=mgLevels.map(l=>new Float64Array(l*l)),mgR=mgLevels.map(l=>new Float64Array(l*l)),mgP=mgLevels.map(l=>new Float64Array(l*l)),mgQ=mgLevels.map(l=>new Float64Array(l*l));
 function applyA(x,out,ln){const s2=ln*ln;
  for(let j=0;j<ln;j++){const r=j*ln;for(let i=0;i<ln;i++){const c=x[r+i];let deg=0,sum=0;
   if(i>0){deg++;sum+=x[r+i-1];}if(i<ln-1){deg++;sum+=x[r+i+1];}
   if(j>0){deg++;sum+=x[r-ln+i];}if(j<ln-1){deg++;sum+=x[r+ln+i];}
   out[r+i]=s2*(deg*c-sum);}}}
 function jacobi(li,sweeps){const ln=mgLevels[li],x=mgX[li],b=mgB[li],t=mgQ[li],s2=ln*ln;
  for(let sw=0;sw<sweeps;sw++){applyA(x,t,ln);
   for(let j=0;j<ln;j++){const r=j*ln;for(let i=0;i<ln;i++){const deg=(i>0?1:0)+(i<ln-1?1:0)+(j>0?1:0)+(j<ln-1?1:0);t[r+i]=x[r+i]+.8*(b[r+i]-t[r+i])/(s2*deg);}}
   x.set(t);}}
 function coarseSolve(li){const x=mgX[li],b=mgB[li],r=mgR[li],p=mgP[li],q=mgQ[li],ln=mgLevels[li];
  x.fill(0);r.set(b);p.set(b);let rs=0;for(let i=0;i<r.length;i++)rs+=r[i]*r[i];
  if(rs===0)return;const bNorm=Math.sqrt(rs);
  for(let it=0;it<300;it++){applyA(p,q,ln);let pq=0;for(let i=0;i<p.length;i++)pq+=p[i]*q[i];
   if(!(pq>0))break;const al=rs/pq;let nrs=0;
   for(let i=0;i<x.length;i++){x[i]+=al*p[i];r[i]-=al*q[i];nrs+=r[i]*r[i];}
   if(Math.sqrt(nrs)<=1e-12*bNorm)break;const be=nrs/rs;for(let i=0;i<p.length;i++)p[i]=r[i]+be*p[i];rs=nrs;}}
 function vcycle(li){const ln=mgLevels[li];
  if(li===mgLevels.length-1){coarseSolve(li);return;}
  jacobi(li,2);
  applyA(mgX[li],mgR[li],ln);
  const cl=mgLevels[li+1],cb=mgB[li+1],res=mgR[li];
  for(let i=0;i<res.length;i++)res[i]=mgB[li][i]-res[i];
  for(let j=0;j<cl;j++){const fr=2*j*ln;for(let i=0;i<cl;i++){const fi=2*i;cb[j*cl+i]=.25*(res[fr+fi]+res[fr+fi+1]+res[fr+ln+fi]+res[fr+ln+fi+1]);}}
  mgX[li+1].fill(0);vcycle(li+1);
  const cx=mgX[li+1],x=mgX[li];
  for(let j=0;j<ln;j++){const cj=j>>1,joy=j%2;for(let i=0;i<ln;i++){const ci=i>>1,iox=i%2;
   const ax0=iox?ci:ci-1,ax1=iox?ci+1:ci,ay0=joy?cj:cj-1,ay1=joy?cj+1:cj,wx0=iox?.75:.25,wx1=iox?.25:.75,wy0=joy?.75:.25,wy1=joy?.25:.75;
   const gx0=Math.min(Math.max(ax0,0),cl-1),gx1=Math.min(Math.max(ax1,0),cl-1),gy0=Math.min(Math.max(ay0,0),cl-1),gy1=Math.min(Math.max(ay1,0),cl-1);
   x[j*ln+i]+=wx0*wy0*cx[gy0*cl+gx0]+wx1*wy0*cx[gy0*cl+gx1]+wx0*wy1*cx[gy1*cl+gx0]+wx1*wy1*cx[gy1*cl+gx1];}}
  jacobi(li,2);}
 const pSol=new Float64Array(n*n),pRhs=new Float64Array(n*n),pRes=new Float64Array(n*n),pQ=new Float64Array(n*n);
 const projU=new Float64Array(n*(n+1)),projV=new Float64Array((n+1)*n);
 // Defect correction: repeat multigrid V-cycles on the error equation until
 // the TRUE residual meets the tolerance. (A PCG driver was measured to
 // stagnate/break down near the 1e-10 floor with this slightly non-symmetric
 // preconditioner; the stationary iteration has no breakdown mode and its
 // convergence is judged on the recomputed residual every cycle.)
 function project(Uin,Vin,dt,guess){
  let mean=0;
  for(let j=0;j<n;j++){const r=j*n,ru=j*(n+1),rv=j*n;for(let i=0;i<n;i++){pRhs[r+i]=-((Uin[ru+i+1]-Uin[ru+i])+(Vin[rv+n+i]-Vin[rv+i]))*n/dt;mean+=pRhs[r+i];}}
  mean/=pRhs.length;let rhsNorm=0;for(let i=0;i<pRhs.length;i++){pRhs[i]-=mean;rhsNorm+=pRhs[i]*pRhs[i];}rhsNorm=Math.sqrt(rhsNorm);
  pSol.set(guess);let pit=0;
  if(rhsNorm===0)pSol.fill(0);
  else{
   applyA(pSol,pQ,n);let rs=0;for(let i=0;i<pRes.length;i++){pRes[i]=pRhs[i]-pQ[i];rs+=pRes[i]*pRes[i];}
   let converged=Math.sqrt(rs)<=pressureTolerance*rhsNorm;
   while(!converged){
    if(pit>=60)throw Error('圧力投影が収束しませんでした。');
    if(preKind==='none'){mgB[0].set(pRes);mgX[0].fill(0);for(let li=0;li<1;li++)jacobi(0,10);}
    else{mgB[0].set(pRes);mgX[0].fill(0);vcycle(0);}
    let m=0;for(let i=0;i<mgX[0].length;i++)m+=mgX[0][i];m/=mgX[0].length;
    for(let i=0;i<pSol.length;i++)pSol[i]+=mgX[0][i]-m;
    pit++;
    applyA(pSol,pQ,n);rs=0;for(let i=0;i<pRes.length;i++){pRes[i]=pRhs[i]-pQ[i];rs+=pRes[i]*pRes[i];}
    converged=Math.sqrt(rs)<=pressureTolerance*rhsNorm;}
   let m=0;for(let i=0;i<pSol.length;i++)m+=pSol[i];m/=pSol.length;for(let i=0;i<pSol.length;i++)pSol[i]-=m;}
  let div=0;
  for(let j=0;j<n;j++){const r=j*n,ru=j*(n+1);projU[ru]=0;projU[ru+n]=0;
   for(let f=1;f<n;f++)projU[ru+f]=Uin[ru+f]-dt*(pSol[r+f]-pSol[r+f-1])*n;}
  for(let j=0;j<=n;j++){const rv=j*n;for(let i=0;i<n;i++)projV[rv+i]=j===0||j===n?0:Vin[rv+i]-dt*(pSol[rv+i]-pSol[rv-n+i])*n;}
  for(let j=0;j<n;j++){const ru=j*(n+1),rv=j*n;for(let i=0;i<n;i++){const d=Math.abs((projU[ru+i+1]-projU[ru+i])*n+(projV[rv+n+i]-projV[rv+i])*n);if(d>div)div=d;}}
  return {u:projU,v:projV,pressure:pSol,iterations:pit,divergence:div};}
 function step(dt){advance(dt);return snapshot();}
 function stepThermal(dt){advanceThermal(dt);return snapshot();}
 function advanceThermal(dt){
  // Steady-seeking aid: advance ONLY the temperature with the current
  // velocity field frozen (both SSPRK2 stages see the same frozen field).
  // Heat integrals, the per-step energy budget and all guards are identical
  // to the coupled step. The fixed point coincides with the coupled steady
  // state, but a steady claim is only ever made after the coupled
  // runToSteady criterion passes; this method by itself proves nothing
  // about steadiness.
  finite(dt,'刻み',true);
  const limit=safeDtNow();
  if(dt>limit*(1+1e-12))throw Error(`刻み${dt}が安定刻み${limit}を超えています。`);
  const q0=new Float64Array(4),q1=new Float64Array(4);
  thermal(T,U,V,F1,q0,null);
  for(let i=0;i<N;i++)T1[i]=T[i]+dt*F1[i];
  const pe1=inspect(T1,U,V);
  thermal(T1,U,V,F2,q1,null);
  for(let i=0;i<N;i++)T2[i]=T[i]+dt*(F1[i]+F2[i])/2;
  const pe2=inspect(T2,U,V);
  const H=heats.slice(),HC=heatComp.slice();
  for(let k=0;k<4;k++){const inc=dt*(q0[k]+q1[k])/2,y=inc-HC[k],t=H[k]+y;HC[k]=(t-H[k])-y;H[k]=t;}
  const en=energy(T2,H);
  if(!(en.relativeMaximumError<=ENERGY_TOLERANCE))throw Error(`熱収支の相対誤差${en.relativeMaximumError}が監視上限${ENERGY_TOLERANCE}を超えました。状態は進めていません。`);
  T.set(T2);heats=H;heatComp=HC;time+=dt;steps++;lastDt=dt;maxPe=Math.max(maxPe,pe1,pe2);
 }
 function advance(dt){
  finite(dt,'刻み',true);
  const limit=safeDtNow();
  if(dt>limit*(1+1e-12))throw Error(`刻み${dt}が安定刻み${limit}を超えています。`);
  const q0=new Float64Array(4),q1=new Float64Array(4);
  thermal(T,U,V,F1,q0,null);momentum(T,U,V);
  for(let i=0;i<N;i++)T1[i]=T[i]+dt*F1[i];
  let it1=0,it2=0,div=0;
  if(Ra>0){for(let i=0;i<PU.length;i++)PU[i]=U[i]+dt*aS[i];for(let i=0;i<PV.length;i++)PV[i]=V[i]+dt*bS[i];
   const r=project(PU,PV,dt,P);U1.set(r.u);V1.set(r.v);phi1.set(r.pressure);it1=r.iterations;div=Math.max(div,r.divergence);}
  else{U1.set(U);V1.set(V);phi1.fill(0);}
  const pe1=inspect(T1,U1,V1);
  thermal(T1,U1,V1,F2,q1,null);momentum(T1,U1,V1);
  for(let i=0;i<N;i++)T2[i]=T[i]+dt*(F1[i]+F2[i])/2;
  if(Ra>0){for(let i=0;i<PU.length;i++)PU[i]=U1[i]+dt*aS[i];for(let i=0;i<PV.length;i++)PV[i]=V1[i]+dt*bS[i];
   const r=project(PU,PV,dt,phi1);it2=r.iterations;div=Math.max(div,r.divergence);phi2.set(r.pressure);
   for(let i=0;i<U.length;i++)U2[i]=(U[i]+r.u[i])/2;for(let i=0;i<V.length;i++)V2[i]=(V[i]+r.v[i])/2;}
  else{U2.set(U);V2.set(V);phi2.fill(0);}
  const pe2=inspect(T2,U2,V2);
  const H=heats.slice(),HC=heatComp.slice();
  for(let k=0;k<4;k++){const inc=dt*(q0[k]+q1[k])/2,y=inc-HC[k],t=H[k]+y;HC[k]=(t-H[k])-y;H[k]=t;}
  const en=energy(T2,H);
  if(!(en.relativeMaximumError<=ENERGY_TOLERANCE))throw Error(`熱収支の相対誤差${en.relativeMaximumError}が監視上限${ENERGY_TOLERANCE}を超えました。状態は進めていません。`);
  T.set(T2);U.set(U2);V.set(V2);
  for(let i=0;i<P.length;i++)P[i]=(phi1[i]+phi2[i])/2;
  heats=H;heatComp=HC;time+=dt;steps++;lastDt=dt;maxPe=Math.max(maxPe,pe1,pe2);lastDivergence=div;
  lastPressureIterations=it1+it2;totalPressureIterations+=it1+it2;
 }
 function phaseStats(Tc,from,to){let mn=Infinity,mx=-Infinity,sum=0,count=0;
  for(let j=0;j<n;j++){const r=j*nx;for(let i=from;i<to;i++){const t=Tc[r+i];if(t<mn)mn=t;if(t>mx)mx=t;sum+=t;count++;}}
  return {minimum:mn,maximum:mx,mean:sum/count};}
 function snapshot(){
  const powers=new Float64Array(4),ifaceT=new Float64Array(n);
  thermal(T,U,V,FS,powers,ifaceT);
  const en=energy(T,heats);
  let iMean=0,iMin=Infinity,iMax=-Infinity;for(let j=0;j<n;j++){iMean+=ifaceT[j];if(ifaceT[j]<iMin)iMin=ifaceT[j];if(ifaceT[j]>iMax)iMax=ifaceT[j];}iMean/=n;
  let speed=0;for(let i=0;i<U.length;i++)speed=Math.max(speed,Math.abs(U[i]));for(let i=0;i<V.length;i++)speed=Math.max(speed,Math.abs(V[i]));
  const eff=iMean>0?powers[3]/iMean:null;
  return {model:LAW,releaseApproved:false,signature,time,steps,lastDt,safeDt:safeDtNow(),mesh,config,
   temperature:Array.from(T),u:Array.from(U),v:Array.from(V),pressureStageMean:Array.from(P),
   solidTemperature:phaseStats(T,0,s),fluidTemperature:phaseStats(T,s,nx),
   interfaceTemperature:{mean:iMean,minimum:iMin,maximum:iMax,perRow:Array.from(ifaceT)},
   instantaneousPowers:{back:powers[0],cold:powers[1],source:powers[2],interface:powers[3]},
   cumulativeHeats:Array.from(heats),cumulativeCompensation:Array.from(heatComp),
   energy:{solidStorage:en.solidStorage,fluidStorage:en.fluidStorage,totalStorage:en.solidStorage+en.fluidStorage,errors:en.errors,relativeMaximumError:en.relativeMaximumError,scale:en.scale},
   effectiveHeatTransferRatio:eff,solidBiFromInterfaceAverage:eff===null?null:eff*delta/K,
   maximumFaceSpeed:speed,divergence:lastDivergence,maximumObservedCellPe:maxPe,
   lastPressureIterations,totalPressureIterations,
   scope:{geometry:'finite-thickness left solid slab + closed square cavity',contactResistance:0,validatedRayleighMin:0,validatedRayleighMax:1000,gui:false}};
 }
 function restore(snap){
  only(snap,['model','releaseApproved','signature','time','steps','lastDt','safeDt','mesh','config','temperature','u','v','pressureStageMean','solidTemperature','fluidTemperature','interfaceTemperature','instantaneousPowers','cumulativeHeats','cumulativeCompensation','energy','effectiveHeatTransferRatio','solidBiFromInterfaceAverage','maximumFaceSpeed','divergence','maximumObservedCellPe','lastPressureIterations','totalPressureIterations','scope'],'共役スナップショット');
  if(snap.model!==LAW||snap.signature!==signature||snap.releaseApproved!==false)throw Error('共役スナップショットの署名が一致しません。');
  const Tc=field(snap.temperature,N,'復元温度'),Uc=field(snap.u,n*(n+1),'復元u'),Vc=field(snap.v,(n+1)*n,'復元v'),Pc=field(snap.pressureStageMean,n*n,'復元圧力');
  const H=field(snap.cumulativeHeats,4,'復元積算熱'),HC=field(snap.cumulativeCompensation,4,'復元補償');
  finite(snap.time,'復元時刻');if(snap.time<0)throw Error('復元時刻は非負です。');
  if(!Number.isSafeInteger(snap.steps)||snap.steps<0)throw Error('復元ステップ数が不正です。');
  const rDt=finite(snap.lastDt,'復元刻み');if(rDt<0)throw Error('復元刻みは非負です。');
  const rPe=finite(snap.maximumObservedCellPe,'復元最大Pe');if(rPe<0||rPe>2)throw Error('復元最大Peが範囲外です。');
  const rDiv=finite(snap.divergence,'復元発散');if(rDiv<0)throw Error('復元発散は非負です。');
  if(!Number.isSafeInteger(snap.lastPressureIterations)||snap.lastPressureIterations<0||!Number.isSafeInteger(snap.totalPressureIterations)||snap.totalPressureIterations<0)throw Error('復元反復数が不正です。');
  inspect(Tc,Uc,Vc);
  const en=energy(Tc,H);
  if(!(en.relativeMaximumError<=ENERGY_TOLERANCE))throw Error('復元状態の熱収支が監視上限を超えています。');
  T=Tc;U=Uc;V=Vc;P=Pc;heats=H;heatComp=HC;time=snap.time;steps=snap.steps;lastDt=rDt;
  maxPe=rPe;lastDivergence=rDiv;lastPressureIterations=snap.lastPressureIterations;totalPressureIterations=snap.totalPressureIterations;
  return snapshot();
 }
 function evaluate(){
  const powers=new Float64Array(4),ifaceT=new Float64Array(n);
  thermal(T,U,V,FS,powers,ifaceT);
  return {temperatureRate:Array.from(FS),instantaneousPowers:{back:powers[0],cold:powers[1],source:powers[2],interface:powers[3]},interfaceTemperaturePerRow:Array.from(ifaceT)};
 }
 function runToSteady(options={}){
  only(options,['interval','maxTime','onInterval'],'定常駆動');
  const interval=finite(options.interval??.1,'定常判定区間',true),maxTime=finite(options.maxTime??40,'定常駆動上限時刻',true);
  if(options.onInterval!==undefined&&typeof options.onInterval!=='function')throw Error('onIntervalは関数です。');
  let prevT=T.slice(),prevU=U.slice(),prevV=V.slice(),prevQ=evaluate().instantaneousPowers.interface;
  const rows=[];let streak=0;
  while(time<maxTime){
   const target=Math.min(time+interval,maxTime);
   while(time<target){const dt=Math.min(safeDtNow(),target-time);if(!(dt>0))break;advance(dt);}
   let dT=0,dU=0,speedNow=1;
   for(let i=0;i<N;i++)dT=Math.max(dT,Math.abs(T[i]-prevT[i]));
   for(let i=0;i<U.length;i++){dU=Math.max(dU,Math.abs(U[i]-prevU[i]));speedNow=Math.max(speedNow,Math.abs(U[i]));}
   for(let i=0;i<V.length;i++){dU=Math.max(dU,Math.abs(V[i]-prevV[i]));speedNow=Math.max(speedNow,Math.abs(V[i]));}
   const Q=evaluate().instantaneousPowers.interface;
   const row={time,steps,maxTemperatureChange:dT,relativeVelocityChange:dU/speedNow,relativeInterfaceHeatChange:Math.abs(Q-prevQ)/Math.max(Math.abs(prevQ),TINY),interfaceHeat:Q};
   rows.push(row);if(options.onInterval)options.onInterval(row);
   if(row.maxTemperatureChange<1e-7&&row.relativeVelocityChange<1e-6&&row.relativeInterfaceHeatChange<1e-6){streak++;if(streak>=2)return {steady:true,time,steps,rows};}
   else streak=0;
   prevT=T.slice();prevU=U.slice();prevV=V.slice();prevQ=Q;
  }
  return {steady:false,time,steps,rows};
 }
 inspect(T,U,V);
 return {config,mesh,step,stepThermal,advance,advanceThermal,snapshot,restore,evaluate,runToSteady,get safeDt(){return safeDtNow();},get time(){return time;},get steps(){return steps;}};
}
