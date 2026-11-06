// Development-only conjugate TEMPERATURE transport. Steady Poiseuille momentum
// is prescribed; fluid axial conduction and general momentum coupling are absent.
const LAW='solid-wall-prescribed-Poiseuille-FV-SSPRK2-v1';
const finite=(x,name,positive=false)=>{if(typeof x!=='number'||!Number.isFinite(x)||(positive&&x<=0))throw Error(`${name}が数値範囲外です。`);return x===0?0:x;};
const sum=xs=>{let s=0,e=0;for(const x of xs){const y=x-e,t=s+y;e=(t-s)-y;s=t;}return finite(s,'積分');};
const only=(o,keys,name)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))throw Error(`${name}の未対応条件を無視しません。`);};
const expand=(value,n,name)=>{const a=Array.isArray(value)?value.slice():Array(n).fill(value);if(a.length!==n)throw Error(`${name}のセル数が一致しません。`);return a.map(x=>finite(x,name));};
export function createConjugateChannel(input){
 only(input,['width','height','depth','nx','ny','wallThickness','wallCells','fluid','solid','bulkVelocity','inlet','initial','outerHeatFlux','source','contactResistance','referenceTemperatureK','maxTemperature'],'共役流路');
 const c=structuredClone(input);only(c.fluid,['rho','cp','k','nu'],'流体物性');only(c.solid,['rho','cp','k'],'固体物性');only(c.outerHeatFlux,['lower','upper'],'外側熱流束');
 for(const material of ['fluid','solid'])for(const key of material==='fluid'?['rho','cp','k','nu']:['rho','cp','k'])finite(c[material][key],material+key,true);
 for(const key of ['width','height','depth','wallThickness','bulkVelocity'])finite(c[key],key,true);
 const {nx,ny,wallCells:nw}=c;if(!Number.isSafeInteger(nx)||nx<4||nx>128||!Number.isSafeInteger(ny)||ny<4||ny>64||ny%2||!Number.isSafeInteger(nw)||nw<1||nw>16)throw Error('共役格子は横4〜128、流体縦は偶数4〜64、各固体縦1〜16です。');
 c.contactResistance=finite(c.contactResistance??0,'接触熱抵抗');if(c.contactResistance<0)throw Error('接触熱抵抗は非負です。');
 c.referenceTemperatureK=finite(c.referenceTemperatureK??300,'基準絶対温度',true);c.maxTemperature=finite(c.maxTemperature??2000,'絶対温度監視上限',true);c.source??=0;
 const reference=c.referenceTemperatureK,L=c.width,H=c.height,D=c.depth,rows=ny+2*nw,N=nx*rows,dx=finite(L/nx,'dx',true),df=finite(H/ny,'流体dy',true),ds=finite(c.wallThickness/nw,'固体dy',true),alpha=finite(c.fluid.k/finite(c.fluid.rho*c.fluid.cp,'流体体積熱容量',true),'流体熱拡散率',true),Re=finite(c.bulkVelocity*2*H/c.fluid.nu,'Re_Dh',true),Pe=finite(c.bulkVelocity*2*H/alpha,'Pe_Dh',true);
 if(Re>1000||Pe<100||L/H<5)throw Error('指定発達流の共役温度はRe_Dh≤1000、Pe_Dh≥100、L/H≥5に限定します。');
 const isFluid=j=>j>=nw&&j<nw+ny,dy=Array.from({length:rows},(_,j)=>isFluid(j)?df:ds),y=Array.from({length:rows},(_,j)=>j<nw?-c.wallThickness+(j+.5)*ds:j<nw+ny?(j-nw+.5)*df:H+(j-nw-ny+.5)*ds),materials=dy.map((_,j)=>isFluid(j)?c.fluid:c.solid),capacity=materials.map((m,j)=>finite(m.rho*m.cp*dx*dy[j]*D,'行セル容量',true)),area=finite(dx*D,'y面積',true),gx=materials.map((m,j)=>isFluid(j)?0:finite(m.k*dy[j]*D/dx,'固体xコンダクタンス',true)),gy=Array.from({length:rows-1},(_,j)=>finite(area/finite(dy[j]/(2*materials[j].k)+dy[j+1]/(2*materials[j+1].k)+(j===nw-1||j===nw+ny-1?c.contactResistance:0),'面熱抵抗',true),'yコンダクタンス',true));
 const velocity=Array.from({length:rows},(_,j)=>{if(!isFluid(j))return 0;const a=(j-nw)/ny,b=(j-nw+1)/ny;return finite(6*c.bulkVelocity*((a+b)/2-(a*a+a*b+b*b)/3),'指定Poiseuille行平均',true);}),flow=velocity.map((u,j)=>isFluid(j)?finite(c.fluid.rho*c.fluid.cp*u*df*D,'行熱容量流量',true):0),flowTotal=finite(sum(flow),'全熱容量流量',true),massFlow=finite(flowTotal/c.fluid.cp,'質量流量',true);
 const initial=expand(c.initial,N,'初期絶対温度'),inlet=expand(c.inlet,ny,'入口絶対温度'),outer=[expand(c.outerHeatFlux.lower,nx,'下外熱流束'),expand(c.outerHeatFlux.upper,nx,'上外熱流束')],source=expand(c.source,N,'体積源'),theta0=Float64Array.from(initial,t=>t-reference),theta=theta0.slice(),inletTheta=inlet.map(t=>t-reference),sourcePower=source.map((v,n)=>finite(v*dx*dy[Math.floor(n/nx)]*D,'体積源熱率')),forcing=Float64Array.from(sourcePower);
 for(const t of [...initial,...inlet,reference])if(t<=0||t>c.maxTemperature)throw Error('入力絶対温度が監視範囲外です。');
 for(let i=0;i<nx;i++){forcing[i]+=finite(outer[0][i]*area,'下外熱');forcing[(rows-1)*nx+i]+=finite(outer[1][i]*area,'上外熱');}
 if(forcing.some(x=>!Number.isFinite(x)))throw Error('熱源の和が非有限です。');
 const sourceFluid=sum(sourcePower.filter((_,n)=>isFluid(Math.floor(n/nx)))),sourceSolid=sum(sourcePower.filter((_,n)=>!isFluid(Math.floor(n/nx)))),lowerPower=finite(area*sum(outer[0]),'下外側総熱'),upperPower=finite(area*sum(outer[1]),'上外側総熱'),inletPower=sum(inletTheta.map((t,j)=>flow[nw+j]*t));
 let maximumRate=0;for(let j=0;j<rows;j++)for(let i=0;i<nx;i++)maximumRate=Math.max(maximumRate,finite((flow[j]+gx[j]*((i>0?1:0)+(i<nx-1?1:0))+(j>0?gy[j-1]:0)+(j<rows-1?gy[j]:0))/capacity[j],'セル流出/拡散率',true));
 const safeDt=finite(.8/maximumRate,'全領域の安定刻み',true),signature=JSON.stringify(Object.fromEntries(Object.keys(c).sort().map(k=>[k,c[k]]))),scratch1=new Float64Array(N),scratch2=new Float64Array(N),stage=new Float64Array(N),next=new Float64Array(N);
 const mesh=Object.freeze({kind:'solid-wall-prescribed-flow-conjugate',nx,ny:rows,fluidNy:ny,wallCells:nw,count:N,width:L,height:H+2*c.wallThickness,fluidHeight:H,wallThickness:c.wallThickness,depth:D,dx,rowHeights:Object.freeze(dy.slice()),rowCenterY:Object.freeze(y.slice()),rowMaterial:Object.freeze(dy.map((_,j)=>isFluid(j)?'fluid':'solid')),rowCellCapacity:Object.freeze(capacity.slice()),rowVelocity:Object.freeze(velocity.slice())});
 let time=0,steps=0,lastDt=0,lastPower=0,parts=Array(9).fill(0),errors=Array(9).fill(0);
 // External components: lower in, upper in, fluid/solid volume source in,
 // reference inlet in, reference outlet out. Interface heat is internal:
 // lower-solid -> fluid and upper-solid -> fluid. Final component is net EXTERNAL.
 function evaluate(values,rates){
  rates.set(forcing);const outlet=[],lowerInterface=[],upperInterface=[];
  for(let j=0;j<rows;j++){
   if(isFluid(j)){const last=j*nx+nx-1,out=flow[j]*values[last];rates[j*nx]+=flow[j]*inletTheta[j-nw];rates[last]-=out;outlet.push(out);}
   for(let i=0;i<nx;i++){
    const n=j*nx+i;if(i<nx-1){const f=isFluid(j)?flow[j]*values[n]:gx[j]*(values[n]-values[n+1]);rates[n]-=f;rates[n+1]+=f;}
    if(j<rows-1){const f=gy[j]*(values[n]-values[n+nx]);rates[n]-=f;rates[n+nx]+=f;if(j===nw-1)lowerInterface.push(f);if(j===nw+ny-1)upperInterface.push(-f);}
   }
  }
  if(rates.some(x=>!Number.isFinite(x)))throw Error('共役熱率が非有限です。');
  const p=[lowerPower,upperPower,sourceFluid,sourceSolid,inletPower,sum(outlet),sum(lowerInterface),sum(upperInterface)];p.push(sum([p[0],p[1],p[2],p[3],p[4],-p[5]]));return p;
 }
 function storage(values){let fluid=[],solid=[];for(let n=0;n<N;n++){const j=Math.floor(n/nx),v=finite(capacity[j]*(values[n]-theta0[n]),'領域蓄熱');(isFluid(j)?fluid:solid).push(v);}const f=sum(fluid),s=sum(solid);return {fluid:f,solid:s,total:finite(f+s,'全蓄熱')};}
 function budget(values,cumulative,count){let scale=0;for(let n=0;n<N;n++)scale+=capacity[Math.floor(n/nx)]*(Math.abs(values[n])+Math.abs(theta0[n]));return finite(1024*Number.EPSILON*finite(scale+sum(cumulative.map(Math.abs)),'熱量尺度')*(1+Math.sqrt(count)),'収支丸め予算');}
 function validateTemperature(values){for(const t of values)if(!Number.isFinite(t)||!Number.isFinite(reference+t)||reference+t<=0||reference+t>c.maxTemperature)throw Error('固体/流体の絶対温度が監視範囲外です。');}
 function validateState(values,cumulative,correction,count){
  validateTemperature(values);if(cumulative.length!==9||correction.length!==9||[...cumulative,...correction].some(x=>typeof x!=='number'||!Number.isFinite(x)))throw Error('全9成分の熱履歴が必要です。');
  const b=budget(values,cumulative,count),s=storage(values),fluidInput=sum([cumulative[2],cumulative[4],-cumulative[5],cumulative[6],cumulative[7]]),solidInput=sum([cumulative[0],cumulative[1],cumulative[3],-cumulative[6],-cumulative[7]]),external=sum([cumulative[0],cumulative[1],cumulative[2],cumulative[3],cumulative[4],-cumulative[5]]);
  if(correction.some(x=>Math.abs(x)>b)||[s.fluid-fluidInput,s.solid-solidInput,s.total-cumulative[8],external-cumulative[8]].some(x=>!Number.isFinite(x)||Math.abs(x)>b))throw Error('固体/流体/全体と界面の積算熱収支が一致しません。');
 }
 function describe(values,cumulative,correction,count,clock,dt,power){
  const p=evaluate(values,scratch1),s=storage(values),interfaceData=[[],[]],outerTemperature=[[],[]];let low=Infinity,high=-Infinity;for(const t of values){low=Math.min(low,reference+t);high=Math.max(high,reference+t);}
  for(let i=0;i<nx;i++)for(let side=0;side<2;side++){
   const solidRow=side?nw+ny:nw-1,fluidRow=side?nw+ny-1:nw,q=finite(gy[side?nw+ny-1:nw-1]*(values[solidRow*nx+i]-values[fluidRow*nx+i])/area,'流体への界面熱流束'),solidOffset=finite(values[solidRow*nx+i]-q*ds/(2*c.solid.k),'固体面保持温度差'),fluidOffset=finite(values[fluidRow*nx+i]+q*df/(2*c.fluid.k),'流体面保持温度差');
   interfaceData[side].push({intoFluidWPerM2:q,solidTemperatureK:finite(reference+solidOffset,'固体界面絶対温度',true),fluidTemperatureK:finite(reference+fluidOffset,'流体界面絶対温度',true),contactJumpK:finite(q*c.contactResistance,'接触温度ジャンプ')});
   const t=finite(reference+values[(side?rows-1:0)*nx+i]+outer[side][i]*ds/(2*c.solid.k),'外側再構成絶対温度',true);if(t>c.maxTemperature)throw Error('外側再構成温度が監視上限を超えます。');outerTemperature[side].push(t);
  }
  const fluidNet=sum([cumulative[2],cumulative[4],-cumulative[5],cumulative[6],cumulative[7]]),solidNet=sum([cumulative[0],cumulative[1],cumulative[3],-cumulative[6],-cumulative[7]]),b=budget(values,cumulative,count),bulk=Array.from({length:nx},(_,i)=>finite(reference+sum(Array.from({length:ny},(_,j)=>flow[nw+j]*values[(nw+j)*nx+i]))/flowTotal,'流体バルク絶対温度',true));
  return {law:LAW,signature,time:clock,steps:count,lastDt:dt,lastPower:power,safeDt,temperature:Array.from(values,t=>reference+t),offsetTemperature:Array.from(values),temperatureRatesKPerS:Array.from(scratch1,(r,n)=>finite(r/capacity[Math.floor(n/nx)],'温度変化率')),cumulativeComponentJ:cumulative.slice(),cumulativeCompensationJ:correction.slice(),storageChangeJ:s,netInputJ:cumulative[8],energyErrorJ:{fluid:s.fluid-fluidNet,solid:s.solid-solidNet,total:s.total-cumulative[8]},energyRoundoffBudgetJ:b,instantaneousPowersW:{lowerOuterInput:p[0],upperOuterInput:p[1],fluidSource:p[2],solidSource:p[3],inletReferenceInput:p[4],outletReferenceOutput:p[5],lowerInterfaceIntoFluid:p[6],upperInterfaceIntoFluid:p[7],netExternalInput:p[8]},interfaceData:{lower:interfaceData[0],upper:interfaceData[1]},outerTemperature:{lower:outerTemperature[0],upper:outerTemperature[1]},bulkTemperature:bulk,min:low,max:high,referenceTemperatureK:reference,massFlowKgPerS:massFlow,Re_Dh:Re,Pe_Dh:Pe,Pr:finite(c.fluid.nu/alpha,'Pr',true),assumptions:{prescribedSteadyPoiseuille:true,fluidAxialConductionOmitted:true,solidAxialConductionIncluded:true,fluidSolidCapacitiesResolved:true,passiveTemperature:true,interfacePowerAppliedOnce:true,solidEndFacesAdiabatic:true,constantProperties:true,fullNavierStokesSolved:false,timeIntegrator:'SSPRK2'},releaseApproved:false};
 }
 function step(dt,returnState=true){
  finite(dt,'時間刻み',true);if(dt>safeDt*(1+8*Number.EPSILON))throw Error('全領域の移流/伝導安定刻みを超えます。');const target=finite(time+dt,'次の時刻');if(target<=time||!Number.isSafeInteger(steps+1))throw Error('時刻/ステップをこれ以上解像できません。');
  const p1=evaluate(theta,scratch1);for(let n=0;n<N;n++)stage[n]=theta[n]+dt*scratch1[n]/capacity[Math.floor(n/nx)];validateTemperature(stage);const p2=evaluate(stage,scratch2);for(let n=0;n<N;n++)next[n]=theta[n]+dt*(scratch1[n]/2+scratch2[n]/2)/capacity[Math.floor(n/nx)];
  const cumulative=[],correction=[];for(let i=0;i<9;i++){const increment=finite(dt*(p1[i]/2+p2[i]/2),'成分の1刻み熱量'),y=increment-errors[i],v=finite(parts[i]+y,'積算成分熱');cumulative.push(v);correction.push((v-parts[i])-y);}
  validateState(next,cumulative,correction,steps+1);const meanPower=finite(p1[8]/2+p2[8]/2,'刻み平均外熱'),report=describe(next,cumulative,correction,steps+1,target,dt,meanPower);theta.set(next);parts=cumulative;errors=correction;time=target;steps++;lastDt=dt;lastPower=meanPower;return returnState?report:undefined;
 }
 function restore(s){
  if(!s||s.law!==LAW||s.signature!==signature||!Array.isArray(s.offsetTemperature)||s.offsetTemperature.length!==N||!Array.isArray(s.temperature)||s.temperature.length!==N||!Array.isArray(s.cumulativeComponentJ)||!Array.isArray(s.cumulativeCompensationJ))throw Error('共役モデル/条件/格子/履歴が一致しません。');
  for(const k of ['time','lastDt','lastPower'])finite(s[k],'復元'+k);if(!Number.isSafeInteger(s.steps)||s.steps<0||s.time<0||s.lastDt<0||s.lastDt>safeDt*(1+8*Number.EPSILON)||(s.steps===0?(s.time!==0||s.lastDt!==0||s.lastPower!==0||s.offsetTemperature.some((x,i)=>x!==theta0[i])||[...s.cumulativeComponentJ,...s.cumulativeCompensationJ].some(x=>x!==0)):(s.time<=0||s.lastDt<=0||s.time<s.lastDt||s.time>s.steps*safeDt*(1+1e-10))))throw Error('共役の復元時計が不正です。');
  if(s.temperature.some((t,i)=>t!==reference+s.offsetTemperature[i]))throw Error('保持温度差と絶対温度表示が一致しません。');validateState(s.offsetTemperature,s.cumulativeComponentJ,s.cumulativeCompensationJ,s.steps);
  const constants=[lowerPower,upperPower,sourceFluid,sourceSolid,inletPower];for(let i=0;i<5;i++){const known=finite(constants[i]*s.time,'既知熱履歴'),b=512*Number.EPSILON*(Math.abs(known)+Math.abs(s.cumulativeComponentJ[i]))*(1+Math.sqrt(s.steps));if(Math.abs(known-s.cumulativeComponentJ[i])>b)throw Error('指定の外熱/源/入口と積算履歴が一致しません。');}
  const report=describe(s.offsetTemperature,s.cumulativeComponentJ,s.cumulativeCompensationJ,s.steps,s.time,s.lastDt,s.lastPower);theta.set(s.offsetTemperature);parts=s.cumulativeComponentJ.slice();errors=s.cumulativeCompensationJ.slice();time=s.time;steps=s.steps;lastDt=s.lastDt;lastPower=s.lastPower;return report;
 }
 validateState(theta,parts,errors,0);snapshot();function snapshot(){return describe(theta,parts,errors,steps,time,lastDt,lastPower);}
 return {step,snapshot,restore,safeDt,mesh,get config(){return structuredClone(c);},get time(){return time;}};
}
