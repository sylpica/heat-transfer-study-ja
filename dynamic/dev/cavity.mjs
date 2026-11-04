import {createNeumannMultigrid} from './poisson-multigrid.mjs';
import {createMacMomentumStencil} from './mac-momentum.mjs';
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
 if(verification){if(verification.id!==undefined&&(typeof verification.id!=='string'||!verification.id||verification.id.length>512))throw Error('製造解の識別子が不正です。');if(verification.parameters&&['rho','cp','nu','alpha','width','height','leftTemperature','rightTemperature'].some(key=>verification.parameters[key]!==undefined&&verification.parameters[key]!==c[key]))throw Error('製造解の物性/領域/境界が計算条件と一致しません。');verification={...verification,id:verification.id??('anonymous:'+(globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random()}`))};}
 const {nx,ny}=c;if(!Number.isInteger(nx)||!Number.isInteger(ny)||nx<4||ny<4||nx>96||ny>96)throw Error('キャビティ格子は4〜96です。');
 for(const key of ['width','height','rho','cp','nu','alpha','initial'])if(!Number.isFinite(c[key])||c[key]<=0)throw Error(`${key}は正の有限値です。`);
 if(c.pressurePreconditioner&&!['jacobi','multigrid'].includes(c.pressurePreconditioner))throw Error('圧力前処理の指定が不正です。');
 if(c.outline||c.regions?.length)throw Error('この開発用CFDは障害物のない矩形だけです。自由形状は未対応です。');if(c.scalarScheme&&!['central','upwind'].includes(c.scalarScheme))throw Error('温度の移流法が不正です。');
 if(c.momentumScheme!==undefined&&!['conservative2','polynomial4'].includes(c.momentumScheme))throw Error('運動量差分が不正です。');
 const highOrder=c.momentumScheme==='polynomial4';if(highOrder&&(nx<8||ny<8))throw Error('高次運動量差分は8格子以上です。');
 const L=c.width,H=c.height,depth=c.depth??1,dx=L/nx,dy=H/ny,rho=c.rho,cp=c.cp,nu=c.nu,alpha=c.alpha,lid=c.lidVelocity??0,gb=c.gravityBeta??0,Tref=c.referenceTemperature??c.initial;
 if(!Number.isFinite(depth)||depth<=0)throw Error('評価する奥行きは正の有限値です。横壁のモデルではありません。');
 if(![lid,gb,Tref].every(Number.isFinite)||Tref<=0)throw Error('壁速度・浮力・基準温度が不正です。');
 if(verification&&(lid||gb))throw Error('製造解検証は静止壁・浮力なしの専用条件です。');
 if(!Number.isFinite(1/dx**2)||!Number.isFinite(1/dy**2))throw Error('格子寸法が数値計算の範囲を超えています。');
 const hot=c.leftTemperature??null,cold=c.rightTemperature??null;for(const T of [hot,cold])if(T!==null&&(!Number.isFinite(T)||T<=0))throw Error('壁温は正のKです。');
 if(gb&&(!Number.isFinite(c.beta)||c.beta<=0))throw Error('Boussinesq監視に正のβを指定してください。');if(Math.abs(lid)*L/nu>100)throw Error('開発用の移動壁キャビティはRe≤100の検証に限定しています。');
 if(gb&&Math.max(Math.abs((hot??Tref)-Tref),Math.abs((cold??Tref)-Tref),Math.abs(c.initial-Tref))*Math.abs(c.beta??0)>0.1)throw Error('指定条件はBoussinesq近似の監視範囲を超えます。');
 const Ra=hot!==null&&cold!==null?Math.abs(gb*(hot-cold)*H**3/(nu*alpha)):0;if(!Number.isFinite(Ra)||Ra>1000*(1+1e-12))throw Error('開発用自然対流はRa≤1000の検証に限定しています。');
 let u=new Float64Array((nx+1)*ny),v=new Float64Array(nx*(ny+1)),T=new Float64Array(nx*ny).fill(c.initial),pressure=Array(nx*ny).fill(0),time=0,steps=0,netInput=0,lastDt=0,lastPower=0,totalPressureIterations=0,projection=null;
 const U=(i,j)=>j*(nx+1)+i,V=(i,j)=>j*nx+i,k=rho*cp*alpha,cellCapacity=rho*cp*dx*dy*depth;
 if(verification){
  for(let j=0;j<ny;j++)for(let i=1;i<nx;i++)u[U(i,j)]=verification.velocity(i*dx,(j+.5)*dy,0)[0];
  for(let j=1;j<ny;j++)for(let i=0;i<nx;i++)v[V(i,j)]=verification.velocity((i+.5)*dx,j*dy,0)[1];
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){T[j*nx+i]=verification.temperature((i+.5)*dx,(j+.5)*dy,0);pressure[j*nx+i]=verification.pressure((i+.5)*dx,(j+.5)*dy,0);}
  if([...u,...v,...T,...pressure].some(x=>!Number.isFinite(x))||T.some(x=>x<=0))throw Error('製造解の初期場が不正です。');
  const mean=pressure.reduce((a,b)=>a+b,0)/pressure.length;pressure=pressure.map(p=>p-mean);
 }
 const initialEnergy=cellCapacity*T.reduce((s,t)=>s+t-273.15,0);
 if(!Number.isFinite(k)||k<=0||!Number.isFinite(cellCapacity)||cellCapacity<=0||!Number.isFinite(initialEnergy))throw Error('物性/セル熱容量が数値範囲を超えています。');
 const signature=JSON.stringify([nx,ny,L,H,depth,rho,cp,nu,alpha,lid,gb,Tref,hot,cold,c.beta??null,c.scalarScheme||'upwind',c.pressurePreconditioner||'jacobi',c.pressureTolerance??1e-10,c.maxPressureIterations??2000,initialEnergy,verification?.id??null,...(highOrder?['polynomial4']:[])]);
 const pressurePreconditioner=c.pressurePreconditioner==='multigrid'?createNeumannMultigrid({nx,ny,dx,dy}):null;
 function divergence(uu=u,vv=v){let value=0;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)value=Math.max(value,Math.abs((uu[U(i+1,j)]-uu[U(i,j)])/dx+(vv[V(i,j+1)]-vv[V(i,j)])/dy));return value;}
 const momentum=highOrder?createMacMomentumStencil({nx,ny,dx,dy}):null;
 function continuityScale(uu=u,vv=v){return Math.max(1,Math.abs(lid)/Math.min(L,H),maxAbs(uu)/Math.min(L,H),maxAbs(vv)/Math.min(L,H));}
 function checkContinuity(uu,vv,d=divergence(uu,vv)){if(!Number.isFinite(d)||d>1e-8*continuityScale(uu,vv))throw Error('連続の式の誤差が許容範囲を超えたため、更新前の状態で停止しました。圧力許容値を厳しくしてください。');}
 function timestep(uu=u,vv=v){const speed=Math.max(Math.abs(lid),maxAbs(uu),maxAbs(vv),1e-9),body=gb?Math.sqrt(Math.abs(gb)*Math.max(Math.abs((hot??Tref)-Tref),Math.abs((cold??Tref)-Tref))*H):0;return Math.min((highOrder ? .12 : .2)/(Math.max(nu,alpha)*(1/dx**2+1/dy**2)),(highOrder ? .25 : .4)/(Math.max(speed,body)*(1/dx+1/dy)));}
 function snapshot(){const energy=cellCapacity*T.reduce((s,t)=>s+t-273.15,0),meanHot=hot===null?0:T.reduce((s,t,n)=>s+(n%nx===0?2*k*(hot-t)/dx:0),0)/ny;
  const error=energy-initialEnergy-netInput,d=divergence();return {modelType:'rectangular-cavity-v1',signature,time,steps,lastDt,lastPower,temperature:Array.from(T),u:Array.from(u),v:Array.from(v),pressure:[...pressure],energy,energyReference:'273.15 K',netInput,energyError:error,relativeEnergyError:Math.abs(error)/Math.max(1,Math.abs(initialEnergy),Math.abs(netInput)),divergence:d,normalizedDivergence:d/continuityScale(),pressurePreconditioner:c.pressurePreconditioner||'jacobi',totalPressureIterations,pressureIterations:projection?.iterations??0,pressureResidual:projection?.residual??0,pressureRhsNorm:projection?.rhsNorm??0,scalarScheme:c.scalarScheme||'upwind',momentumScheme:c.momentumScheme||'conservative2',nusselt:hot!==null&&cold!==null&&hot!==cold?meanHot*H/(k*(hot-cold)):null,safeDt:timestep(),min:Math.min(...T),max:Math.max(...T)};}
 function step(dt,returnState=true){if(!Number.isFinite(dt)||dt<=0||dt>timestep()*(1+1e-12))throw Error('拡散/CFLの時間刻みを超えています。');const us=new Float64Array(u),vs=new Float64Array(v),operators=momentum?.evaluate(u,v,lid);
  const getU=(i,j)=>j<0?-u[U(i,0)]:j>=ny?2*lid-u[U(i,ny-1)]:u[U(i,j)];
  const getV=(i,j)=>i<0?-v[V(0,j)]:i>=nx?-v[V(nx-1,j)]:v[V(i,j)];
  for(let j=0;j<ny;j++)for(let i=1;i<nx;i++){
   const n=U(i,j),a=u[n],east=u[U(i+1,j)],west=u[U(i-1,j)],north=getU(i,j+1),south=getU(i,j-1),vn=(v[V(i-1,j+1)]+v[V(i,j+1)])/2,vsouth=(v[V(i-1,j)]+v[V(i,j)])/2;
   const adv=(((a+east)/2)**2-((a+west)/2)**2)/dx+((a+north)/2*vn-(a+south)/2*vsouth)/dy;
   us[n]=a+dt*(nu*(operators?operators.laplacianU[n]:((east-2*a+west)/dx**2+(north-2*a+south)/dy**2))-(operators?operators.advectionU[n]:adv));
   if(verification){const force=verification.bodyForce(i*dx,(j+.5)*dy,time);if(!Array.isArray(force)||force.length!==2||force.some(x=>!Number.isFinite(x)))throw Error('製造解の体積力が不正です。');us[n]+=dt*force[0];}
  }
  for(let j=1;j<ny;j++)for(let i=0;i<nx;i++){
   const n=V(i,j),a=v[n],east=getV(i+1,j),west=getV(i-1,j),north=v[V(i,j+1)],south=v[V(i,j-1)],ue=(u[U(i+1,j-1)]+u[U(i+1,j)])/2,uw=(u[U(i,j-1)]+u[U(i,j)])/2;
   const adv=((a+east)/2*ue-(a+west)/2*uw)/dx+(((a+north)/2)**2-((a+south)/2)**2)/dy;
   vs[n]=a+dt*(nu*(operators?operators.laplacianV[n]:((east-2*a+west)/dx**2+(north-2*a+south)/dy**2))-(operators?operators.advectionV[n]:adv)+gb*((T[(j-1)*nx+i]+T[j*nx+i])/2-Tref));
   if(verification){const force=verification.bodyForce((i+.5)*dx,j*dy,time);if(!Array.isArray(force)||force.length!==2||force.some(x=>!Number.isFinite(x)))throw Error('製造解の体積力が不正です。');vs[n]+=dt*force[1];}
  }
  const projected=projectFaces(us,vs,{nx,ny,dx,dy,rho,dt,pressure,tolerance:c.pressureTolerance??1e-10,maxIterations:c.maxPressureIterations??2000,preconditioner:pressurePreconditioner});
  checkContinuity(projected.u,projected.v,projected.divergence);
  const P=new Float64Array(nx*ny);let external=0;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   const n=j*nx+i;
   if(verification){const source=verification.heatSource((i+.5)*dx,(j+.5)*dy,time),watts=source*dx*dy*depth;if(!Number.isFinite(source)||!Number.isFinite(watts))throw Error('製造解の体積発熱が不正です。');P[n]+=watts;external+=watts;}
   if(i+1<nx){const m=n+1,vel=projected.u[U(i+1,j)];if(c.scalarScheme==='central'&&Math.abs(vel)*dx/alpha>2)throw Error('中心差分のセルPe上限を超えます。');const transported=c.scalarScheme==='central'?(T[n]+T[m])/2:(vel>=0?T[n]:T[m]),q=(k*dy/dx*(T[m]-T[n])-rho*cp*vel*dy*(transported-273.15))*depth;P[n]+=q;P[m]-=q;}
   if(j+1<ny){const m=n+nx,vel=projected.v[V(i,j+1)];if(c.scalarScheme==='central'&&Math.abs(vel)*dy/alpha>2)throw Error('中心差分のセルPe上限を超えます。');const transported=c.scalarScheme==='central'?(T[n]+T[m])/2:(vel>=0?T[n]:T[m]),q=(k*dx/dy*(T[m]-T[n])-rho*cp*vel*dx*(transported-273.15))*depth;P[n]+=q;P[m]-=q;}
   if(i===0&&hot!==null){const q=2*k*dy/dx*(hot-T[n])*depth;P[n]+=q;external+=q;}
   if(i===nx-1&&cold!==null){const q=2*k*dy/dx*(cold-T[n])*depth;P[n]+=q;external+=q;}
  }
  const next=Float64Array.from(T,(t,n)=>t+dt*P[n]/cellCapacity);if([...projected.u,...projected.v,...next].some(x=>!Number.isFinite(x))||next.some(x=>x<=0))throw Error('CFDに非有限値/無効温度が生じたため停止しました。');
  if(gb&&maxAbs(next.map(t=>t-Tref))*c.beta>.1+1e-12)throw Error('更新温度がBoussinesq近似の範囲を超えるため停止しました。');
  const nextInput=netInput+external*dt,nextTime=time+dt,nextEnergy=cellCapacity*next.reduce((s,t)=>s+t-273.15,0);if(![nextInput,nextTime,nextEnergy].every(Number.isFinite)||nextTime<=time)throw Error('CFDの時間・エネルギーが数値範囲を超えています。');
  u=projected.u;v=projected.v;pressure=projected.pressure;projection=projected;T=next;netInput=nextInput;time=nextTime;lastDt=dt;lastPower=external;steps++;totalPressureIterations+=projected.iterations;return returnState?snapshot():undefined;
 }
 function restore(s){
  if(!s||s.modelType!=='rectangular-cavity-v1'||s.signature!==signature)throw Error('復元状態のCFDモデル・格子・条件が一致しません。');
  for(const [key,size]of [['u',u.length],['v',v.length],['temperature',T.length],['pressure',pressure.length]])if(!Array.isArray(s[key])||s[key].length!==size||s[key].some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('CFD復元の場の寸法/値が不正です。');
  if(s.temperature.some(x=>x<=0)||![s.time,s.lastDt,s.lastPower,s.netInput,s.pressureResidual,s.pressureRhsNorm].every(Number.isFinite)||s.time<0||s.lastDt<0||s.pressureResidual<0||s.pressureRhsNorm<0||![s.steps,s.totalPressureIterations,s.pressureIterations].every(x=>Number.isSafeInteger(x)&&x>=0)||s.totalPressureIterations<s.pressureIterations)throw Error('CFD復元の温度・時間・反復情報が不正です。');
  const uu=Float64Array.from(s.u),vv=Float64Array.from(s.v),tt=Float64Array.from(s.temperature),pp=[...s.pressure];for(let j=0;j<ny;j++)if(uu[U(0,j)]!==0||uu[U(nx,j)]!==0)throw Error('閉壁の法線速度が0ではありません。');for(let i=0;i<nx;i++)if(vv[V(i,0)]!==0||vv[V(i,ny)]!==0)throw Error('閉壁の法線速度が0ではありません。');
  if(gb&&maxAbs(tt.map(t=>t-Tref))*c.beta>.1+1e-12)throw Error('復元温度がBoussinesq近似の範囲を超えます。');checkContinuity(uu,vv);
  const mean=pp.reduce((a,b)=>a+b,0)/pp.length,energy=cellCapacity*tt.reduce((sum,t)=>sum+t-273.15,0),nextDt=timestep(uu,vv);if(![mean,energy,energy-initialEnergy-s.netInput,nextDt].every(Number.isFinite)||nextDt<=0||Math.abs(mean)>1e-10*Math.max(1,maxAbs(pp)))throw Error('復元の圧力ゲージ・顕熱・時間尺度が不正です。');
  u=uu;v=vv;T=tt;pressure=pp;time=s.time;steps=s.steps;lastDt=s.lastDt;lastPower=s.lastPower;netInput=s.netInput;totalPressureIterations=s.totalPressureIterations;projection={iterations:s.pressureIterations,residual:s.pressureResidual,rhsNorm:s.pressureRhsNorm,divergence:divergence()};return snapshot();
 }
 const safe=timestep();if(!Number.isFinite(safe)||safe<=0)throw Error('CFDの安定時間刻みが数値範囲を超えています。');
 return {step,snapshot,restore,config:{...structuredClone(c),depth},mesh:{nx,ny,width:L,height:H,depth,dx,dy,mask:Array(nx*ny).fill(1),material:Array(nx*ny).fill(0),count:nx*ny,area:L*H,geometricArea:L*H,repaired:[]},pressureHierarchy:pressurePreconditioner?.levels??null,get time(){return time;},get safeDt(){return timestep();}};
}
