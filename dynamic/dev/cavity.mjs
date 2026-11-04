import {createNeumannMultigrid} from './poisson-multigrid.mjs';
// Development-only staggered finite-volume projection solver. Not distributed.
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),maxAbs=a=>Math.max(...a.map(Math.abs));
export function projectFaces(us,vs,{nx,ny,dx,dy,rho=1,dt,tolerance=1e-10,maxIterations=2000,pressure,preconditioner}){
 if(!Number.isInteger(nx)||!Number.isInteger(ny)||nx<2||ny<2||![dx,dy,rho,dt].every(x=>Number.isFinite(x)&&x>0)||us.length!==(nx+1)*ny||vs.length!==nx*(ny+1)||[...us,...vs].some(x=>!Number.isFinite(x)))throw Error('投影法の格子・速度・刻みが不正です。');
 const N=nx*ny,U=(i,j)=>j*(nx+1)+i,V=(i,j)=>j*nx+i,diagonal=new Float64Array(N),rhs=new Float64Array(N),p=pressure?Float64Array.from(pressure,x=>x/rho):new Float64Array(N);
 for(let j=0;j<ny;j++)if(Math.abs(us[U(0,j)])>1e-12||Math.abs(us[U(nx,j)])>1e-12)throw Error('閉境界の法線速度がゼロではありません。');for(let i=0;i<nx;i++)if(Math.abs(vs[V(i,0)])>1e-12||Math.abs(vs[V(i,ny)])>1e-12)throw Error('閉境界の法線速度がゼロではありません。');
 if(preconditioner&&(preconditioner.size!==N||typeof preconditioner.apply!=='function'))throw Error('圧力の前処理が格子と一致しません。');
 if(pressure&&(pressure.length!==N||pressure.some(x=>!Number.isFinite(x))||p.some(x=>!Number.isFinite(x))))throw Error('圧力場のセル数/値が不正です。');if(!Number.isFinite(tolerance)||tolerance<=0||!Number.isInteger(maxIterations)||maxIterations<1)throw Error('圧力反復の許容値/上限が不正です。');
 function apply(x){const y=new Float64Array(N);for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const n=j*nx+i;if(i)y[n]+=(x[n]-x[n-1])/dx**2;if(i+1<nx)y[n]+=(x[n]-x[n+1])/dx**2;if(j)y[n]+=(x[n]-x[n-nx])/dy**2;if(j+1<ny)y[n]+=(x[n]-x[n+nx])/dy**2;}return y;}
 function zeroMean(x){const mean=x.reduce((a,b)=>a+b,0)/N;for(let i=0;i<N;i++)x[i]-=mean;return x;}
 const condition=r=>{const z=preconditioner?Float64Array.from(preconditioner.apply(r)):Float64Array.from(r,(x,i)=>x/diagonal[i]);if(z.length!==N||z.some(x=>!Number.isFinite(x)))throw Error('圧力前処理の出力が不正です。');return zeroMean(z);};
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const n=j*nx+i;rhs[n]=-1/dt*((us[U(i+1,j)]-us[U(i,j)])/dx+(vs[V(i,j+1)]-vs[V(i,j)])/dy);diagonal[n]=(Number(i>0)+Number(i+1<nx))/dx**2+(Number(j>0)+Number(j+1<ny))/dy**2;}
 if(rhs.some(x=>!Number.isFinite(x))||diagonal.some(x=>!Number.isFinite(x)||x<=0))throw Error('圧力方程式が浮動小数点の範囲を超えています。');zeroMean(rhs);zeroMean(p);const rhsNorm=Math.sqrt(dot(rhs,rhs)),Ap=apply(p);let r=Float64Array.from(rhs,(b,i)=>b-Ap[i]),residualNorm=Math.sqrt(dot(r,r)),iterations=0;
 if(![rhsNorm,residualNorm].every(Number.isFinite))throw Error('圧力方程式のノルムが数値範囲を超えています。');
 const threshold=Math.max(1e-12,tolerance*rhsNorm);let z=residualNorm>threshold?condition(r):new Float64Array(N),direction=new Float64Array(z),rz=dot(r,z);
 if(residualNorm>threshold&&(!Number.isFinite(rz)||rz<=0))throw Error('圧力前処理の内積が悪条件です。');
 while(residualNorm>threshold){
  if(iterations++>=maxIterations)throw Error('圧力Poisson反復が収束しませんでした。');const Ad=apply(direction),denom=dot(direction,Ad);if(!Number.isFinite(denom)||denom<=0)throw Error('圧力反復の行列が不正です。');const a=rz/denom;if(!Number.isFinite(a)||a<=0)throw Error('圧力反復の更新量が数値範囲を超えています。');
  for(let i=0;i<N;i++){p[i]+=a*direction[i];r[i]-=a*Ad[i];}zeroMean(r);residualNorm=Math.sqrt(dot(r,r));if(!Number.isFinite(residualNorm))throw Error('圧力残差が数値範囲を超えています。');if(residualNorm<=threshold)break;z=condition(r);const next=dot(r,z),beta=next/rz;if(!Number.isFinite(next)||next<=0||!Number.isFinite(beta))throw Error('圧力反復の内積が悪条件です。');for(let i=0;i<N;i++)direction[i]=z[i]+beta*direction[i];rz=next;
 }
 const u=new Float64Array(us),v=new Float64Array(vs);for(let j=0;j<ny;j++)for(let i=1;i<nx;i++)u[U(i,j)]-=dt*(p[j*nx+i]-p[j*nx+i-1])/dx;for(let j=1;j<ny;j++)for(let i=0;i<nx;i++)v[V(i,j)]-=dt*(p[j*nx+i]-p[(j-1)*nx+i])/dy;
 let divergence=0;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)divergence=Math.max(divergence,Math.abs((u[U(i+1,j)]-u[U(i,j)])/dx+(v[V(i,j+1)]-v[V(i,j)])/dy));
 const physicalGaugePressure=Array.from(zeroMean(p),x=>x*rho);if(physicalGaugePressure.some(x=>!Number.isFinite(x)))throw Error('圧力の値が数値範囲を超えました。');
 return {u,v,pressure:physicalGaugePressure,iterations,residual:residualNorm,rhsNorm,divergence};
}
export function createCavity(c,verification=null){
 c=structuredClone(c);
 if(verification&&['velocity','temperature','pressure','bodyForce','heatSource'].some(key=>typeof verification[key]!=='function'))throw Error('製造解検証には全ての場・外力・発熱関数が必要です。');
 const {nx,ny}=c;if(!Number.isInteger(nx)||!Number.isInteger(ny)||nx<4||ny<4||nx>96||ny>96)throw Error('キャビティ格子は4〜96です。');
 for(const key of ['width','height','rho','cp','nu','alpha','initial'])if(!Number.isFinite(c[key])||c[key]<=0)throw Error(`${key}は正の有限値です。`);
 if(c.pressurePreconditioner&&!['jacobi','multigrid'].includes(c.pressurePreconditioner))throw Error('圧力前処理の指定が不正です。');
 if(c.outline||c.regions?.length)throw Error('この開発用CFDは障害物のない矩形だけです。自由形状は未対応です。');if(c.scalarScheme&&!['central','upwind'].includes(c.scalarScheme))throw Error('温度の移流法が不正です。');
 const L=c.width,H=c.height,dx=L/nx,dy=H/ny,rho=c.rho,cp=c.cp,nu=c.nu,alpha=c.alpha,lid=c.lidVelocity??0,gb=c.gravityBeta??0,Tref=c.referenceTemperature??c.initial;
 if(![lid,gb,Tref].every(Number.isFinite)||Tref<=0)throw Error('壁速度・浮力・基準温度が不正です。');
 if(verification&&(lid||gb))throw Error('製造解検証は静止壁・浮力なしの専用条件です。');
 if(!Number.isFinite(1/dx**2)||!Number.isFinite(1/dy**2))throw Error('格子寸法が数値計算の範囲を超えています。');
 const hot=c.leftTemperature??null,cold=c.rightTemperature??null;for(const T of [hot,cold])if(T!==null&&(!Number.isFinite(T)||T<=0))throw Error('壁温は正のKです。');
 if(gb&&(!Number.isFinite(c.beta)||c.beta<=0))throw Error('Boussinesq監視に正のβを指定してください。');if(Math.abs(lid)*L/nu>100)throw Error('開発用の移動壁キャビティはRe≤100の検証に限定しています。');
 if(gb&&Math.max(Math.abs((hot??Tref)-Tref),Math.abs((cold??Tref)-Tref),Math.abs(c.initial-Tref))*Math.abs(c.beta??0)>0.1)throw Error('指定条件はBoussinesq近似の監視範囲を超えます。');
 const Ra=hot!==null&&cold!==null?Math.abs(gb*(hot-cold)*H**3/(nu*alpha)):0;if(!Number.isFinite(Ra)||Ra>1000*(1+1e-12))throw Error('開発用自然対流はRa≤1000の検証に限定しています。');
 let u=new Float64Array((nx+1)*ny),v=new Float64Array(nx*(ny+1)),T=new Float64Array(nx*ny).fill(c.initial),pressure=Array(nx*ny).fill(0),time=0,steps=0,netInput=0,totalPressureIterations=0,projection=null;
 const U=(i,j)=>j*(nx+1)+i,V=(i,j)=>j*nx+i,k=rho*cp*alpha,cellCapacity=rho*cp*dx*dy;
 if(verification){
  for(let j=0;j<ny;j++)for(let i=1;i<nx;i++)u[U(i,j)]=verification.velocity(i*dx,(j+.5)*dy,0)[0];
  for(let j=1;j<ny;j++)for(let i=0;i<nx;i++)v[V(i,j)]=verification.velocity((i+.5)*dx,j*dy,0)[1];
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){T[j*nx+i]=verification.temperature((i+.5)*dx,(j+.5)*dy,0);pressure[j*nx+i]=verification.pressure((i+.5)*dx,(j+.5)*dy,0);}
  if([...u,...v,...T,...pressure].some(x=>!Number.isFinite(x))||T.some(x=>x<=0))throw Error('製造解の初期場が不正です。');
  const mean=pressure.reduce((a,b)=>a+b,0)/pressure.length;pressure=pressure.map(p=>p-mean);
 }
 const initialEnergy=cellCapacity*T.reduce((s,t)=>s+t-273.15,0);
 if(!Number.isFinite(k)||k<=0||!Number.isFinite(cellCapacity)||cellCapacity<=0||!Number.isFinite(initialEnergy))throw Error('物性/セル熱容量が数値範囲を超えています。');
 const pressurePreconditioner=c.pressurePreconditioner==='multigrid'?createNeumannMultigrid({nx,ny,dx,dy}):null;
 function divergence(){let value=0;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)value=Math.max(value,Math.abs((u[U(i+1,j)]-u[U(i,j)])/dx+(v[V(i,j+1)]-v[V(i,j)])/dy));return value;}
 function timestep(){const speed=Math.max(Math.abs(lid),maxAbs(u),maxAbs(v),1e-9),body=gb?Math.sqrt(Math.abs(gb)*Math.max(Math.abs((hot??Tref)-Tref),Math.abs((cold??Tref)-Tref))*H):0;return Math.min(.2/(Math.max(nu,alpha)*(1/dx**2+1/dy**2)),.4/(Math.max(speed,body)*(1/dx+1/dy)));}
 function snapshot(){const energy=cellCapacity*T.reduce((s,t)=>s+t-273.15,0),meanHot=hot===null?0:T.reduce((s,t,n)=>s+(n%nx===0?2*k*(hot-t)/dx:0),0)/ny;
  return {time,steps,temperature:Array.from(T),u:Array.from(u),v:Array.from(v),pressure:[...pressure],energy,netInput,energyError:energy-initialEnergy-netInput,divergence:divergence(),pressurePreconditioner:c.pressurePreconditioner||'jacobi',totalPressureIterations,pressureIterations:projection?.iterations??0,pressureResidual:projection?.residual??0,pressureRhsNorm:projection?.rhsNorm??0,scalarScheme:c.scalarScheme||'upwind',nusselt:hot!==null&&cold!==null&&hot!==cold?meanHot*H/(k*(hot-cold)):null,safeDt:timestep()};}
 function step(dt,returnState=true){if(!Number.isFinite(dt)||dt<=0||dt>timestep()*(1+1e-12))throw Error('拡散/CFLの時間刻みを超えています。');const us=new Float64Array(u),vs=new Float64Array(v);
  const getU=(i,j)=>j<0?-u[U(i,0)]:j>=ny?2*lid-u[U(i,ny-1)]:u[U(i,j)];
  const getV=(i,j)=>i<0?-v[V(0,j)]:i>=nx?-v[V(nx-1,j)]:v[V(i,j)];
  for(let j=0;j<ny;j++)for(let i=1;i<nx;i++){
   const n=U(i,j),a=u[n],east=u[U(i+1,j)],west=u[U(i-1,j)],north=getU(i,j+1),south=getU(i,j-1),vn=(v[V(i-1,j+1)]+v[V(i,j+1)])/2,vsouth=(v[V(i-1,j)]+v[V(i,j)])/2;
   const adv=(((a+east)/2)**2-((a+west)/2)**2)/dx+((a+north)/2*vn-(a+south)/2*vsouth)/dy;
   us[n]=a+dt*(nu*((east-2*a+west)/dx**2+(north-2*a+south)/dy**2)-adv);
   if(verification){const force=verification.bodyForce(i*dx,(j+.5)*dy,time);if(!Array.isArray(force)||force.length!==2||force.some(x=>!Number.isFinite(x)))throw Error('製造解の体積力が不正です。');us[n]+=dt*force[0];}
  }
  for(let j=1;j<ny;j++)for(let i=0;i<nx;i++){
   const n=V(i,j),a=v[n],east=getV(i+1,j),west=getV(i-1,j),north=v[V(i,j+1)],south=v[V(i,j-1)],ue=(u[U(i+1,j-1)]+u[U(i+1,j)])/2,uw=(u[U(i,j-1)]+u[U(i,j)])/2;
   const adv=((a+east)/2*ue-(a+west)/2*uw)/dx+(((a+north)/2)**2-((a+south)/2)**2)/dy;
   vs[n]=a+dt*(nu*((east-2*a+west)/dx**2+(north-2*a+south)/dy**2)-adv+gb*((T[(j-1)*nx+i]+T[j*nx+i])/2-Tref));
   if(verification){const force=verification.bodyForce((i+.5)*dx,j*dy,time);if(!Array.isArray(force)||force.length!==2||force.some(x=>!Number.isFinite(x)))throw Error('製造解の体積力が不正です。');vs[n]+=dt*force[1];}
  }
  const projected=projectFaces(us,vs,{nx,ny,dx,dy,rho,dt,pressure,tolerance:c.pressureTolerance??1e-10,maxIterations:c.maxPressureIterations??2000,preconditioner:pressurePreconditioner});
  const P=new Float64Array(nx*ny);let external=0;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   const n=j*nx+i;
   if(verification){const source=verification.heatSource((i+.5)*dx,(j+.5)*dy,time),watts=source*dx*dy;if(!Number.isFinite(source)||!Number.isFinite(watts))throw Error('製造解の体積発熱が不正です。');P[n]+=watts;external+=watts;}
   if(i+1<nx){const m=n+1,vel=projected.u[U(i+1,j)];if(c.scalarScheme==='central'&&Math.abs(vel)*dx/alpha>2)throw Error('中心差分のセルPe上限を超えます。');const transported=c.scalarScheme==='central'?(T[n]+T[m])/2:(vel>=0?T[n]:T[m]),q=k*dy/dx*(T[m]-T[n])-rho*cp*vel*dy*(transported-273.15);P[n]+=q;P[m]-=q;}
   if(j+1<ny){const m=n+nx,vel=projected.v[V(i,j+1)];if(c.scalarScheme==='central'&&Math.abs(vel)*dy/alpha>2)throw Error('中心差分のセルPe上限を超えます。');const transported=c.scalarScheme==='central'?(T[n]+T[m])/2:(vel>=0?T[n]:T[m]),q=k*dx/dy*(T[m]-T[n])-rho*cp*vel*dx*(transported-273.15);P[n]+=q;P[m]-=q;}
   if(i===0&&hot!==null){const q=2*k*dy/dx*(hot-T[n]);P[n]+=q;external+=q;}
   if(i===nx-1&&cold!==null){const q=2*k*dy/dx*(cold-T[n]);P[n]+=q;external+=q;}
  }
  const next=Float64Array.from(T,(t,n)=>t+dt*P[n]/cellCapacity);if([...projected.u,...projected.v,...next].some(x=>!Number.isFinite(x))||next.some(x=>x<=0))throw Error('CFDに非有限値/無効温度が生じたため停止しました。');
  const nextInput=netInput+external*dt,nextTime=time+dt,nextEnergy=cellCapacity*next.reduce((s,t)=>s+t-273.15,0);if(![nextInput,nextTime,nextEnergy].every(Number.isFinite)||nextTime<=time)throw Error('CFDの時間・エネルギーが数値範囲を超えています。');
  u=projected.u;v=projected.v;pressure=projected.pressure;projection=projected;T=next;netInput=nextInput;time=nextTime;steps++;totalPressureIterations+=projected.iterations;return returnState?snapshot():undefined;
 }
 return {step,snapshot,pressureHierarchy:pressurePreconditioner?.levels??null,get time(){return time;},get safeDt(){return timestep();}};
}
