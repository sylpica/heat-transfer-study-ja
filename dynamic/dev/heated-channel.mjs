// Development-only Graetz-type passive temperature transport. Momentum is a
// prescribed steady plane-Poiseuille profile, not a general 2D CFD solution.
const LAW='poiseuille-inlet-equal-wall-flux-passive-v1';
const finite=(v,name,positive=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||(positive&&v<=0))throw Error(`${name}が数値範囲外です。`);return v===0?0:v;};
function sum(values){let s=0,e=0;for(const v of values){const y=v-e,t=s+y;e=(t-s)-y;s=t;}return s;}
export function createHeatedChannel(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('流路条件はオブジェクトです。');
 const c=structuredClone(input),allowed=new Set(['width','height','depth','nx','ny','rho','cp','k','nu','bulkVelocity','wallHeatFlux','inlet','initial','maxTemperature']);
 if(Object.keys(c).some(key=>!allowed.has(key)))throw Error('未対応の物理条件を暗黙に無視しません。');
 const {nx,ny}=c;if(!Number.isSafeInteger(nx)||nx<4||nx>256||!Number.isSafeInteger(ny)||ny<8||ny>128||ny%2)throw Error('流路格子は横4〜256、縦は偶数8〜128です。');
 for(const key of ['width','height','depth','rho','cp','k','nu','bulkVelocity'])finite(c[key],key,true);
 const L=c.width,H=c.height,Dh=finite(2*H,'水力直径',true),U=c.bulkVelocity,N=nx*ny,alpha=finite(c.k/(c.rho*c.cp),'熱拡散率',true),Re=finite(U*Dh/c.nu,'Re_Dh',true),Pe=finite(U*Dh/alpha,'Pe_Dh',true);
 if(Re>1000)throw Error('この発達層流の保守的なRe_Dh上限1000を超えます。');
 if(Pe<100||L/H<5)throw Error('軸方向熱伝導を省略する開発モデルはPe_Dh≥100、長さ/全高さ≥5に限定します。');
 const q=finite(c.wallHeatFlux,'両壁の流入熱流束'),limit=finite(c.maxTemperature??10000,'温度監視上限',true),dx=finite(L/nx,'dx',true),dy=finite(H/ny,'dy',true),V=finite(dx*dy*c.depth,'セル体積',true),C=finite(c.rho*c.cp*V,'セル熱容量',true),totalCapacity=finite(C*N,'全熱容量',true);
 const initial=Array.isArray(c.initial)?c.initial:Array(N).fill(c.initial),inlet=Array.isArray(c.inlet)?c.inlet:Array(ny).fill(c.inlet);
 if(initial.length!==N||inlet.length!==ny)throw Error('初期温度または入口温度の格子数が一致しません。');
 for(const t of [...initial,...inlet]){finite(t,'絶対温度[K]',true);if(t>limit)throw Error('入力温度が監視上限を超えます。');}
 const velocity=Float64Array.from({length:ny},(_,j)=>{const a=j/ny,b=(j+1)/ny;return finite(6*U*((a+b)/2-(a*a+a*b+b*b)/3),'Poiseuille行平均速度',true);});
 const dxFaceArea=finite(dy*c.depth,'入口/出口1行面積',true),rowCapacityFlow=Float64Array.from(velocity,u=>finite(c.rho*c.cp*u*dxFaceArea,'行の熱容量流量',true)),diffusionConductance=finite(c.k*dx*c.depth/dy,'横断熱伝導コンダクタンス',true),wallPerCell=finite(q*dx*c.depth,'1壁1セルの指定入力');
 const safeDt=finite(.8/Math.max(...Array.from(velocity,(u,j)=>u/dx+((j>0?1:0)+(j+1<ny?1:0))*alpha/dy**2)),'安定時間刻み',true),massFlow=finite(c.rho*dy*c.depth*sum(velocity),'質量流量',true),pressureGradient=finite(-12*c.rho*c.nu*U/H**2,'既知の駆動圧力勾配'),wallShear=finite(6*c.rho*c.nu*U/H,'壁せん断応力',true),omittedHeatingRate=finite(12*c.nu*U*U/(H*H*c.cp),'省略仕事の温度換算',true);
 const inletEnthalpy=finite(sum(inlet.map((t,j)=>rowCapacityFlow[j]*(t-273.15))),'入口エンタルピー流量'),wallInput=finite(2*q*L*c.depth,'全壁熱入力');
 const signature=JSON.stringify([LAW,c]),T=Float64Array.from(initial),initialMean=sum(initial.map(t=>t/N)),initialEnergy=finite(C*sum(initial.map(t=>t-273.15)),'初期顕熱');
 let time=0,steps=0,lastDt=0,lastPower=0,netInput=0,netInputCompensation=0,cumulativeInlet=0,cumulativeOutlet=0,cumulativeWall=0;
 const energy=values=>finite(C*sum(Array.from(values,t=>t-273.15)),'顕熱[J]'),change=values=>finite(C*sum(Array.from(values,(t,i)=>t-initial[i])),'初期からの蓄熱[J]');
 function power(values){const outlet=finite(sum(Array.from({length:ny},(_,j)=>rowCapacityFlow[j]*(values[j*nx+nx-1]-273.15))),'出口エンタルピー流量');return {inletEnthalpyW:inletEnthalpy,outletEnthalpyW:outlet,wallInputW:wallInput,netExternalPowerW:finite(inletEnthalpy-outlet+wallInput,'外部正味熱入力')};}
 function budget(values,input,atStep){return finite(128*Number.EPSILON*(C*sum(Array.from(values,Math.abs))+Math.abs(input))*(1+Math.sqrt(atStep)),'収支丸め誤差予算',true);}
 function wallTemperatures(values){return {lower:Array.from({length:nx},(_,i)=>finite(values[i]+q*dy/(2*c.k),'下壁の再構成温度',true)),upper:Array.from({length:nx},(_,i)=>finite(values[(ny-1)*nx+i]+q*dy/(2*c.k),'上壁の再構成温度',true))};}
 function thermalDiagnostics(values){
  const walls=wallTemperatures(values),rowFlowTotal=sum(rowCapacityFlow),bulk=Array.from({length:nx},(_,i)=>finite(sum(Array.from({length:ny},(_,j)=>rowCapacityFlow[j]*values[j*nx+i]))/rowFlowTotal,'断面バルク温度',true)),nu=bulk.map((tb,i)=>{const delta=(walls.lower[i]+walls.upper[i])/2-tb;if(q===0||delta===0)return null;return finite(q*Dh/(c.k*delta),'瞬間壁/バルク温度差の比');});return {walls,bulk,nu};
 }
 function validate(values,input,correction,atStep){
  for(const t of values){finite(t,'受理温度[K]',true);if(t>limit)throw Error('流路温度が監視上限を超えました。');}
  const {walls}=thermalDiagnostics(values);if([...walls.lower,...walls.upper].some(t=>t>limit))throw Error('再構成した壁温が監視上限を超えました。');
  finite(input,'累積外部熱入力');finite(correction,'補償値');energy(values);const err=change(values)-input,b=budget(values,input,atStep);if(Math.abs(err)>b||Math.abs(correction)>b)throw Error('入口・出口・壁・蓄熱の全収支に失敗したため受理しません。');power(values);
 }
 const meanFlow={bulkVelocity:U,hydraulicDiameter:Dh,reynoldsDh:Re,pecletDh:Pe,pecletLength:finite(U*L/alpha,'Pe_L',true),prandtl:finite(c.nu/alpha,'Pr',true),pressureGradientPaPerM:pressureGradient,wallShearMagnitudePa:wallShear,massFlowKgPerS:massFlow,analyticMassFlowKgPerS:finite(c.rho*U*H*c.depth,'解析質量流量',true)};
 const mesh={kind:'prescribed-poiseuille-inlet-wall-flux',nx,ny,width:L,height:H,depth:c.depth,dx,dy,count:N,mask:Array(N).fill(1),cellCapacity:C,totalCapacity};
 function snapshot(){
  const {walls,bulk,nu}=thermalDiagnostics(T);
  return {law:LAW,signature,time,steps,lastDt,lastPower,safeDt,temperature:Array.from(T),velocity:Array.from(velocity),bulkTemperature:bulk,lowerWallTemperature:walls.lower,upperWallTemperature:walls.upper,wallToBulkNusselt:nu,energy:energy(T),initialEnergy,netInput,netInputCompensation,energyError:change(T)-netInput,energyRoundoffBudgetJ:budget(T,netInput,steps),cumulativeInletEnthalpyJ:cumulativeInlet,cumulativeOutletEnthalpyJ:cumulativeOutlet,cumulativeWallInputJ:cumulativeWall,min:Math.min(...T),max:Math.max(...T),meanTemperature:initialMean+change(T)/totalCapacity,advectionCfl:(Math.max(...velocity)/dx)*lastDt,...power(T),meanFlow:{...meanFlow},omittedMeanHeatingRateKPerS:omittedHeatingRate,omittedMeanHeatingEstimateK:finite(omittedHeatingRate*time,'省略仕事の累積温度換算'),assumptions:{steadyFullyDevelopedPoiseuille:true,passiveTemperature:true,axialConductionOmitted:true,viscousHeatingOmitted:true,inletPrescribed:true,equalWallHeatFlux:true,thermalEntranceResolvedOnly:true,generalTwoDimensionalMomentumResolved:false,bulkTemperatureUsesProductOfRowMeans:true,wallTemperatureHalfCellReconstruction:true},releaseApproved:false};
 }
 function step(dt,returnState=true){
  finite(dt,'時間刻み',true);if(dt>safeDt*(1+1e-12))throw Error('移流/横断拡散の陽解法安定条件を超えます。');const nextTime=finite(time+dt,'物理時刻');if(nextTime<=time||!Number.isSafeInteger(steps+1))throw Error('時刻/ステップ数をこれ以上解像できません。');finite(omittedHeatingRate*nextTime,'省略仕事の累積温度換算');
  const p=power(T),rates=new Float64Array(N);
  for(let j=0;j<ny;j++){
   const first=j*nx,last=first+nx-1;rates[first]+=rowCapacityFlow[j]*(inlet[j]-273.15);rates[last]-=rowCapacityFlow[j]*(T[last]-273.15);
   for(let i=0;i<nx;i++){const n=j*nx+i;if(i+1<nx){const f=rowCapacityFlow[j]*(T[n]-273.15);rates[n]-=f;rates[n+1]+=f;}if(j+1<ny){const next=n+nx,f=diffusionConductance*(T[next]-T[n]);rates[n]+=f;rates[next]-=f;}}
  }
  for(let i=0;i<nx;i++){rates[i]+=wallPerCell;rates[(ny-1)*nx+i]+=wallPerCell;}
  const next=Float64Array.from(T,(v,i)=>v+dt*rates[i]/C),increment=finite(dt*p.netExternalPowerW,'1刻みの正味熱量'),y=increment-netInputCompensation,nextInput=finite(netInput+y,'累積正味熱量'),nextCorrection=(nextInput-netInput)-y,nextInlet=finite(cumulativeInlet+dt*p.inletEnthalpyW,'累積入口熱量'),nextOutlet=finite(cumulativeOutlet+dt*p.outletEnthalpyW,'累積出口熱量'),nextWall=finite(cumulativeWall+dt*p.wallInputW,'累積壁熱量');
  validate(next,nextInput,nextCorrection,steps+1);T.set(next);time=nextTime;steps++;lastDt=dt;lastPower=p.netExternalPowerW;netInput=nextInput;netInputCompensation=nextCorrection;cumulativeInlet=nextInlet;cumulativeOutlet=nextOutlet;cumulativeWall=nextWall;return returnState?snapshot():undefined;
 }
 function restore(s){
  if(!s||s.law!==LAW||s.signature!==signature||!Array.isArray(s.temperature)||s.temperature.length!==N)throw Error('復元モデル/条件/格子が一致しません。');for(const key of ['time','lastDt','lastPower','netInput','netInputCompensation','cumulativeInletEnthalpyJ','cumulativeOutletEnthalpyJ','cumulativeWallInputJ'])finite(s[key],'復元'+key);
  if(!Number.isSafeInteger(s.steps)||s.steps<0||s.time<0||s.lastDt<0||s.lastDt>safeDt*(1+1e-12)||(s.steps===0?(s.time!==0||s.lastDt!==0||s.lastPower!==0||s.netInput!==0||s.cumulativeInletEnthalpyJ!==0||s.cumulativeOutletEnthalpyJ!==0||s.cumulativeWallInputJ!==0):(s.time<=0||s.lastDt<=0||s.time<s.lastDt||s.time>s.steps*safeDt*(1+1e-10))))throw Error('復元の時計/積分履歴が不正です。');
  if(s.steps===0&&s.temperature.some((t,i)=>t!==initial[i]))throw Error('初期時計と初期温度が一致しません。');validate(s.temperature,s.netInput,s.netInputCompensation,s.steps);finite(omittedHeatingRate*s.time,'復元の省略仕事温度換算');
  const cumulativeResidual=s.cumulativeInletEnthalpyJ-s.cumulativeOutletEnthalpyJ+s.cumulativeWallInputJ-s.netInput,cumulativeBudget=256*Number.EPSILON*(Math.abs(s.cumulativeInletEnthalpyJ)+Math.abs(s.cumulativeOutletEnthalpyJ)+Math.abs(s.cumulativeWallInputJ)+Math.abs(s.netInput))*(1+Math.sqrt(s.steps));if(Math.abs(cumulativeResidual)>cumulativeBudget)throw Error('入口/出口/壁の累積履歴と正味熱量が一致しません。');
  const knownInlet=s.time*inletEnthalpy,knownWall=s.time*wallInput,knownBudget=256*Number.EPSILON*(Math.abs(knownInlet)+Math.abs(knownWall))*(1+Math.sqrt(s.steps));if(Math.abs(s.cumulativeInletEnthalpyJ-knownInlet)>knownBudget||Math.abs(s.cumulativeWallInputJ-knownWall)>knownBudget)throw Error('指定された入口/壁と累積履歴が一致しません。');
  T.set(s.temperature);time=s.time;steps=s.steps;lastDt=s.lastDt;lastPower=s.lastPower;netInput=s.netInput;netInputCompensation=s.netInputCompensation;cumulativeInlet=s.cumulativeInletEnthalpyJ;cumulativeOutlet=s.cumulativeOutletEnthalpyJ;cumulativeWall=s.cumulativeWallInputJ;return snapshot();
 }
 validate(T,0,0,0);return {step,snapshot,restore,safeDt,mesh,get config(){return structuredClone(c);},get time(){return time;}};
}
