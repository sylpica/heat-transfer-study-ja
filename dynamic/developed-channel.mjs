// Fully developed 1D momentum plus a periodic 2D temperature field.
// No general 2D pressure/velocity coupling, buoyancy, side walls or viscous heat.
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
 c=structuredClone(c);
 if(c.outline||c.regions?.length||c.boundaries)throw Error('この発達流モデルの境界は平行平板のno-slip・断熱と温度の周期条件に固定されています。');
 const {nx,ny}=c;if(!Number.isInteger(nx)||!Number.isInteger(ny)||nx<4||ny<8||nx>128||ny>128)throw Error('流路格子は横4〜128、縦8〜128です。');
 for(const key of ['width','height','depth','rho','cp','k','nu'])finite(c[key],key,true);const G=finite(c.acceleration,'圧力勾配に相当する加速度'),L=c.width,H=c.height,dx=L/nx,dy=H/ny,z=c.depth,rho=c.rho,cp=c.cp,alpha=c.k/(rho*cp),N=nx*ny,V=dx*dy*z;
 const steadyRe=Math.abs(G)*H**3/(6*c.nu**2);if(!Number.isFinite(steadyRe)||steadyRe>1000)throw Error('この発達層流モデルの保守的なRe_Dh上限1000を超えます。');
 for(const [v,name]of[[dx,'横セル幅'],[dy,'縦セル幅'],[V,'セル体積'],[alpha,'熱拡散率'],[rho*cp*V,'セル熱容量']])finite(v,name,true);
 const initialU=c.initialVelocity??Array(ny).fill(0);if(!Array.isArray(initialU)||initialU.length!==ny||initialU.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('初期速度分布が不正です。');const u=Float64Array.from(initialU);
 const initialT=Array.isArray(c.initial)?c.initial:Array(N).fill(c.initial);if(initialT.length!==N||initialT.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<=0))throw Error('温度は正の絶対温度[K]です。');const T=Float64Array.from(initialT);
 // u = steady + exp(Lt)(initial-steady). The sum, rather than the maximum
 // of initial/steady speeds, bounds startup overshoot of a nonzero profile.
 const uBound=finite(Math.max(...u.map(Math.abs))+1.1*Math.abs(G)*H*H/(8*c.nu),'移流速度の上界');if(2*H*uBound/c.nu>1800)throw Error('初期速度と駆動を合わせた速度がこの層流モデルの範囲を超えます。');
 const safeDt=finite(.8/Math.max(3*c.nu/dy**2,2*alpha/dx**2+2*alpha/dy**2+uBound/dx),'安定時間刻み',true);
 const mass=finite(nx*rho*V,'1セル列の質量',true),thermalCapacity=finite(rho*cp*V,'セル熱容量',true),energy=values=>finite(thermalCapacity*values.reduce((s,v)=>s+v-273.15,0),'顕熱'),momentum=values=>finite(mass*values.reduce((s,v)=>s+v,0),'運動量');
 let time=0,steps=0,momentumInput=0,lastDt=0,lastAdvectionCfl=0,maxAdvectionCfl=0;const initialMomentum=momentum(u),initialEnergy=energy(T);
 function acceleration(){return Float64Array.from(u,(v,j)=>G+c.nu*((j>0?u[j-1]-v:-2*v)+(j+1<ny?u[j+1]-v:-2*v))/dy**2);}
 function snapshot(){const E=energy(T),M=momentum(u),error=E-initialEnergy;return {time,steps,lastDt,safeDt,temperature:Array.from(T),velocity:Array.from(u),energy:E,netInput:0,energyError:error,relativeEnergyError:Math.abs(error)/Math.max(1,Math.abs(initialEnergy)),momentum:M,momentumInput,momentumError:M-initialMomentum-momentumInput,steadyMomentumResidual:Math.max(...acceleration().map(Math.abs)),massDivergence:0,steadyReynoldsDh:steadyRe,min:Math.min(...T),max:Math.max(...T),velocityBound:uBound,maxVelocity:Math.max(...u.map(Math.abs)),cellPeclet:Math.max(...u.map(Math.abs))*dx/alpha,cellPecletBound:uBound*dx/alpha,advectionCfl:lastAdvectionCfl,maxAdvectionCfl,pressureGradient:-rho*G};}
 function step(dt,returnState=true){finite(dt,'時間刻み',true);if(dt>safeDt*(1+1e-12))throw Error('流路の拡散/CFL安定条件を超えます。');const a=acceleration(),rate=scalarRates({temperature:T,u,nx,ny,dx,dy,depth:z,rho,cp,k:c.k}),un=Float64Array.from(u,(v,i)=>v+dt*a[i]),tn=Float64Array.from(T,(v,i)=>v+dt*rate[i]);
  if(un.some(v=>!Number.isFinite(v)||Math.abs(v)>uBound*(1+1e-12))||tn.some(v=>!Number.isFinite(v)||v<=0))throw Error('温度・速度の範囲または有限値の検査に失敗したため停止しました。');
  const wallForce=-2*rho*c.nu*(u[0]+u[ny-1])/dy*L*z,drive=rho*G*L*H*z,nextMomentumInput=finite(momentumInput+(wallForce+drive)*dt,'累積力積'),nextTime=finite(time+dt,'物理時間');if(nextTime<=time)throw Error('時間刻みが浮動小数点で区別できません。');energy(tn);momentum(un);const cfl=finite(Math.max(...u.map(Math.abs))*dt/dx,'移流CFL');
  lastAdvectionCfl=cfl;maxAdvectionCfl=Math.max(maxAdvectionCfl,cfl);momentumInput=nextMomentumInput;u.set(un);T.set(tn);time=nextTime;steps++;lastDt=dt;return returnState?snapshot():undefined;}
 function restore(s){if(!s||!Array.isArray(s.temperature)||!Array.isArray(s.velocity)||s.temperature.length!==N||s.velocity.length!==ny||!Number.isSafeInteger(s.steps)||s.steps<0)throw Error('流路の再生状態が不正です。');s.temperature.forEach(v=>finite(v,'再生温度',true));s.velocity.forEach(v=>{finite(v,'再生速度');if(Math.abs(v)>uBound*(1+1e-12))throw Error('再生速度が安定性の上界を超えています。');});finite(s.time,'再生時間');if(s.time<0)throw Error('再生時間は0以上です。');finite(s.momentumInput,'再生力積');finite(s.lastDt??0,'再生刻み');for(const v of[s.advectionCfl??0,s.maxAdvectionCfl??0]){finite(v,'再生CFL');if(v<0||v>1+1e-12)throw Error('再生CFLが不正です。');}if((s.maxAdvectionCfl??0)<(s.advectionCfl??0)||(s.lastDt??0)<0)throw Error('再生刻み/CFLの履歴が不正です。');energy(s.temperature);momentum(s.velocity);T.set(s.temperature);u.set(s.velocity);time=s.time;steps=s.steps;momentumInput=s.momentumInput;lastDt=s.lastDt??0;lastAdvectionCfl=s.advectionCfl??0;maxAdvectionCfl=s.maxAdvectionCfl??0;return snapshot();}
 finite(uBound*dx/alpha,'セルPeの上界');finite(-rho*G,'圧力勾配');finite(L*H,'流路面積',true);
 return {step,snapshot,restore,safeDt,config:c,get time(){return time;},mesh:{nx,ny,width:L,height:H,depth:z,dx,dy,mask:Array(N).fill(1),count:N,area:L*H,geometricArea:L*H,material:Array(N).fill(0),repaired:[]}};
}
