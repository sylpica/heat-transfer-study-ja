// Development-only. Not on the public build allowlist. Fully developed 1D momentum
// plus a periodic 2D temperature field; no general 2D pressure/velocity coupling.
function finite(v,name,positive=false){if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が不正です。`);return v;}
export function scalarRates({temperature,u,nx,ny,dx,dy,depth,rho,cp,k}){
 const V=dx*dy*depth,C=rho*cp*V,P=new Float64Array(nx*ny);
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const n=j*nx+i,m=j*nx+(i+1)%nx,A=dy*depth,velocity=u[j];
  // A constant enthalpy datum cancels exactly around each periodic row.
  const adv=rho*cp*velocity*A*((velocity>=0?temperature[n]:temperature[m])-273.15),cond=k*A/dx*(temperature[m]-temperature[n]);
  P[n]+=cond-adv;P[m]-=cond-adv;
  if(j+1<ny){const next=n+nx,q=k*dx*depth/dy*(temperature[next]-temperature[n]);P[n]+=q;P[next]-=q;}
 }
 return Float64Array.from(P,v=>v/C);
}
export function createDevelopedChannel(c){
 const {nx,ny}=c;if(!Number.isInteger(nx)||!Number.isInteger(ny)||nx<4||ny<8||nx>128||ny>128)throw Error('流路格子は横4〜128、縦8〜128です。');
 for(const key of ['width','height','depth','rho','cp','k','nu'])finite(c[key],key,true);const G=finite(c.acceleration,'圧力勾配に相当する加速度'),L=c.width,H=c.height,dx=L/nx,dy=H/ny,z=c.depth,rho=c.rho,cp=c.cp,alpha=c.k/(rho*cp),N=nx*ny,V=dx*dy*z;
 const steadyRe=Math.abs(G)*H**3/(6*c.nu**2);if(!Number.isFinite(steadyRe)||steadyRe>1000)throw Error('この発達層流モデルの保守的なRe_Dh上限1000を超えます。');
 const u=Float64Array.from(c.initialVelocity??Array(ny).fill(0));if(u.length!==ny||u.some(v=>!Number.isFinite(v)))throw Error('初期速度分布が不正です。');
 const T=Float64Array.from(Array.isArray(c.initial)?c.initial:Array(N).fill(c.initial));if(T.length!==N||T.some(v=>!Number.isFinite(v)||v<=0))throw Error('温度は正の絶対温度[K]です。');
 const uBound=Math.max(...u.map(Math.abs),1.1*Math.abs(G)*H*H/(8*c.nu));if(2*H*uBound/c.nu>1600)throw Error('初期速度がこの層流モデルの範囲を超えます。');
 const safeDt=.8/Math.max(3*c.nu/dy**2,2*alpha/dx**2+2*alpha/dy**2+uBound/dx);
 let time=0,steps=0,momentumInput=0,lastDt=0;const mass=nx*rho*V,initialMomentum=mass*u.reduce((s,v)=>s+v,0),initialEnergy=rho*cp*V*T.reduce((s,v)=>s+v-273.15,0);
 function acceleration(){return Float64Array.from(u,(v,j)=>G+c.nu*((j>0?u[j-1]-v:-2*v)+(j+1<ny?u[j+1]-v:-2*v))/dy**2);}
 function snapshot(){const energy=rho*cp*V*T.reduce((s,v)=>s+v-273.15,0),momentum=mass*u.reduce((s,v)=>s+v,0),error=energy-initialEnergy;return {time,steps,lastDt,safeDt,temperature:Array.from(T),velocity:Array.from(u),energy,netInput:0,energyError:error,relativeEnergyError:Math.abs(error)/Math.max(1,Math.abs(initialEnergy)),momentum,momentumInput,momentumError:momentum-initialMomentum-momentumInput,steadyMomentumResidual:Math.max(...acceleration().map(Math.abs)),massDivergence:0,steadyReynoldsDh:steadyRe,min:Math.min(...T),max:Math.max(...T),cellPeclet:uBound*dx/alpha,pressureGradient:-rho*G};}
 function step(dt,returnState=true){finite(dt,'時間刻み',true);if(dt>safeDt*(1+1e-12))throw Error('流路の拡散/CFL安定条件を超えます。');const a=acceleration(),rate=scalarRates({temperature:T,u,nx,ny,dx,dy,depth:z,rho,cp,k:c.k}),un=Float64Array.from(u,(v,i)=>v+dt*a[i]),tn=Float64Array.from(T,(v,i)=>v+dt*rate[i]);
  if(un.some(v=>!Number.isFinite(v))||tn.some(v=>!Number.isFinite(v)||v<=0))throw Error('非有限値または不正な絶対温度のため停止しました。');
  const wallForce=-2*rho*c.nu*(u[0]+u[ny-1])/dy*L*z,drive=rho*G*L*H*z;momentumInput+=(wallForce+drive)*dt;u.set(un);T.set(tn);time+=dt;steps++;lastDt=dt;return returnState?snapshot():undefined;}
 return {step,snapshot,safeDt,get time(){return time;},mesh:{nx,ny,width:L,height:H,depth:z,dx,dy,mask:Array(N).fill(1),count:N,area:L*H,geometricArea:L*H,material:Array(N).fill(0),repaired:[]}};
}
