// Radial-symmetry conduction. No fluid or angular solution.
const SIGMA=5.670374419e-8,finite=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error(`${name}は有限値です。`);return v;},positive=(v,name)=>{finite(v,name);if(v<=0)throw Error(`${name}は正の値です。`);return v;};
export function createRadial(config){
 const c=structuredClone(config),{n,geometry}=c;if(!['cylinder','sphere'].includes(geometry)||!Number.isSafeInteger(n)||n<4||n>512)throw Error('半径方向は円筒/球の4〜512セルです。');
 for(const name of ['radius','k','rho','cp'])positive(c[name],name);if(geometry==='cylinder')positive(c.length,'円筒の長さ');
 if(c.materials||c.regions||c.outline||c.kTable||c.cpTable)throw Error('開発中の半径方向モデルは単一材料・一定物性だけです。');
 const R=c.radius,dr=R/n,dim=geometry==='sphere'?3:2,factor=geometry==='sphere'?4*Math.PI:2*Math.PI*c.length,source=finite(c.source??0,'体積発熱'),bc=structuredClone(c.boundary??{type:'insulated'});
 if(!['insulated','temperature','flux','convection','radiation'].includes(bc.type))throw Error('半径方向の表面境界条件が不正です。');
 if(['temperature','convection','radiation'].includes(bc.type))positive(bc.temperature,'表面/周囲絶対温度');if(bc.type==='flux')finite(bc.flux,'内向き表面熱流束');if(bc.type==='convection'&&(finite(bc.h,'熱伝達率')<0))throw Error('hは0以上です。');if(bc.type==='radiation'&&(finite(bc.emissivity,'放射率')<0||bc.emissivity>1||!Number.isFinite(bc.temperature**4)))throw Error('放射率/周囲温度が計算範囲外です。');
 const centres=Array.from({length:n},(_,i)=>(i+.5)*dr),faces=Array.from({length:n+1},(_,i)=>i*dr),area=faces.map(r=>factor*r**(dim-1)),volumes=centres.map((_,i)=>{const a=faces[i],b=faces[i+1];return dim===2?factor*dr*(a+b)/2:factor*dr*(a*a+a*b+b*b)/3;}),C=volumes.map(v=>c.rho*c.cp*v);
 // Integrate each shell's capacity exactly and reconstruct its radial face
 // gradient. A steady source-free log/1/r resistance is not imposed on a
 // transient or heat-generating central cell. At r=0 the face area is zero.
 const G=centres.slice(1).map((_,i)=>c.k*area[i+1]/dr),A=area[n],halfR=dr/(2*c.k*A),outerG=1/halfR;
 if(![...centres,...volumes,...C,...G,halfR,outerG,A].every(x=>Number.isFinite(x)&&x>0))throw Error('半径方向の格子/熱容量/抵抗が数値範囲外です。');
 if(Array.isArray(c.initial)){if(c.initial.length!==n||c.initial.some(t=>typeof t!=='number'||!Number.isFinite(t)||t<=0))throw Error('初期温度は正のKで全セルを指定してください。');}else positive(c.initial,'初期温度');
 let T=Array.isArray(c.initial)?Float64Array.from(c.initial):new Float64Array(n).fill(c.initial);
 const bound=bc.type==='temperature'?outerG:bc.type==='convection'&&bc.h>0?1/(halfR+1/(bc.h*A)):bc.type==='radiation'&&bc.emissivity>0?outerG:0;
 const limits=C.map((cap,i)=>cap/((i?G[i-1]:0)+(i<n-1?G[i]:bound))),safeDt=.8*Math.min(...limits);if(!(safeDt>0)||!Number.isFinite(safeDt))throw Error('半径方向の安定時間刻みが数値範囲外です。');
 const energy=tt=>tt.reduce((sum,t,i)=>sum+C[i]*(t-273.15),0),initialEnergy=energy(T);finite(initialEnergy,'初期顕熱');let time=0,steps=0,lastDt=0,lastPower=0,netInput=0;
 const signature=JSON.stringify([geometry,n,R,c.length??null,c.k,c.rho,c.cp,source,bc,Array.from(T)]);
 function outer(t=T[n-1]){
  let watts=0,surface=t;
  if(bc.type==='temperature'){surface=bc.temperature;watts=outerG*(surface-t);}
  if(bc.type==='flux'){watts=bc.flux*A;surface=t+watts*halfR;}
  if(bc.type==='convection'&&bc.h>0){watts=bound*(bc.temperature-t);surface=t+watts*halfR;}
  if(bc.type==='radiation'&&bc.emissivity>0){let lo=Math.min(t,bc.temperature),hi=Math.max(t,bc.temperature);for(let i=0;i<60;i++){const s=lo+(hi-lo)/2,residual=outerG*(t-s)-bc.emissivity*SIGMA*A*(s-bc.temperature)*(s+bc.temperature)*(s*s+bc.temperature*bc.temperature);finite(residual,'放射面の反復');if(residual>0)lo=s;else hi=s;}surface=lo+(hi-lo)/2;watts=outerG*(surface-t);}
  finite(watts,'表面熱移動率');positive(surface,'表面温度');return {watts,surface};
 }
 function snapshot(){const e=energy(T),error=e-initialEnergy-netInput,b=outer();return {modelType:'radial-conduction-v1',signature,time,steps,lastDt,lastPower,temperature:Array.from(T),surfaceTemperature:b.surface,outerInwardWatts:b.watts,energy:e,energyReference:'273.15 K',netInput,energyError:error,relativeEnergyError:Math.abs(error)/Math.max(1,Math.abs(initialEnergy),Math.abs(netInput)),min:Math.min(...T),max:Math.max(...T),safeDt};}
 function step(dt,returnState=true){positive(dt,'時間刻み');if(dt>safeDt*(1+1e-12))throw Error('半径方向の安定上限を超えました。');if(steps>=Number.MAX_SAFE_INTEGER)throw Error('計算回数の保存範囲を超えました。');const P=Float64Array.from(volumes,v=>source*v);let external=P.reduce((a,b)=>a+b,0);for(let i=0;i<n-1;i++){const q=G[i]*(T[i+1]-T[i]);P[i]+=q;P[i+1]-=q;}const boundary=outer();P[n-1]+=boundary.watts;external+=boundary.watts;const next=Float64Array.from(T,(t,i)=>t+dt*P[i]/C[i]),nextTime=time+dt,nextInput=netInput+dt*external,nextEnergy=energy(next);if(next.some(t=>!Number.isFinite(t)||t<=0)||![nextTime,nextInput,nextEnergy,nextEnergy-initialEnergy-nextInput].every(Number.isFinite)||nextTime<=time)throw Error('温度/顕熱/時間が範囲外のため、更新前の状態で停止しました。');outer(next[n-1]);T=next;time=nextTime;netInput=nextInput;lastDt=dt;lastPower=external;steps++;return returnState?snapshot():undefined;}
 function restore(s){if(!s||s.modelType!=='radial-conduction-v1'||s.signature!==signature||!Array.isArray(s.temperature)||s.temperature.length!==n||s.temperature.some(t=>typeof t!=='number'||!Number.isFinite(t)||t<=0)||![s.time,s.lastDt,s.lastPower,s.netInput].every(Number.isFinite)||s.time<0||s.lastDt<0||!Number.isSafeInteger(s.steps)||s.steps<0||![energy(s.temperature),energy(s.temperature)-initialEnergy-s.netInput].every(Number.isFinite))throw Error('復元する半径方向の状態が不正です。');outer(s.temperature[n-1]);const next=Float64Array.from(s.temperature);T=next;time=s.time;steps=s.steps;lastDt=s.lastDt;lastPower=s.lastPower;netInput=s.netInput;return snapshot();}
 function flux(){const outwardWatts=[0,...G.map((g,i)=>g*(T[i]-T[i+1])),-outer().watts],outwardFlux=outwardWatts.map((q,i)=>i?q/area[i]:0);if([...outwardWatts,...outwardFlux].some(x=>!Number.isFinite(x)))throw Error('半径方向の熱流束が数値範囲外です。');return {radius:[...faces],outwardWatts,outwardFlux,centreConvention:'r=0: symmetry, zero radial derivative; no division by zero'};}
 outer();return {step,snapshot,restore,flux,initialFlux:flux,config:structuredClone(c),mesh:structuredClone({geometry,n,radius:R,length:geometry==='cylinder'?c.length:null,dr,centres,faces,volumes,areas:area,count:n,dimension:dim}),get time(){return time;},get safeDt(){return safeDt;}};
}
