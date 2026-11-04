import {createRadiationNetwork} from '../dynamic/radiation-network.mjs';
const sigma=5.670374419e-8,surface=(temperature,emissivity,capacity=100)=>({area:1,temperature,emissivity,capacity}),config={surfaces:[surface(600,.8),surface(300,.6)],viewFactors:[[0,1],[1,0]],maxTemperature:1000};
const advance=(m,t,dt)=>{while(m.time<t-1e-12)m.step(Math.min(dt,t-m.time),false);return m.snapshot();};
const q=sigma*(600**4-300**4)/(1/.8+1/.6-1),initial=createRadiationNetwork(config).snapshot();
// Separate RK4 implementation of the analytical two-resistance heat-rate formula.
const derivative=t=>{const q=sigma*(t[0]**4-t[1]**4)/(1/.8+1/.6-1);return [-q/100,q/100];};let ref=[600,300];const h=.0001;
for(let i=0;i<20000;i++){const a=derivative(ref),b=derivative(ref.map((v,j)=>v+h*a[j]/2)),c=derivative(ref.map((v,j)=>v+h*b[j]/2)),d=derivative(ref.map((v,j)=>v+h*c[j]));ref=ref.map((v,j)=>v+h*(a[j]+2*b[j]+2*c[j]+d[j])/6);}
const time=[.04,.02,.01].map(dt=>{const s=advance(createRadiationNetwork(config),2,dt);return {dt,hotTemperature:s.temperature[0],errorK:Math.abs(s.temperature[0]-ref[0]),energyErrorJ:s.energyError};}),orders=time.slice(1).map((v,i)=>Math.log(time[i].errorK/v.errorK)/Math.log(2));
const black=createRadiationNetwork({surfaces:[surface(300,1),surface(400,1),surface(500,1)],viewFactors:[[0,.5,.5],[.5,0,.5],[.5,.5,0]]}).snapshot();
const out={date:'2026-11-04',scope:'Independently derived ideal enclosure equations; not a geometry solver or expert/real-device approval.',twoSurface:{analyticalW:q,numericalW:initial.outwardPower[0],absoluteErrorW:Math.abs(q-initial.outwardPower[0]),relativeLinearResidual:initial.linearResidual},timeRefinement:{reference:'Independent RK4 of the two-body resistance formula, dt=0.0001 s, t=2 s',referenceHotK:ref[0],samples:time,observedOrders:orders},threeBlackFaces:{temperatureK:black.temperature,outwardW:black.outwardPower,sumOutwardW:black.radiationBalance,energyErrorJ:black.energyError}};
out.passed=out.twoSurface.absoluteErrorW<1e-9&&orders.every(v=>v>1.9&&v<2.1)&&time.every(v=>Math.abs(v.energyErrorJ)<1e-8)&&Math.abs(black.radiationBalance)<1e-9;console.log(JSON.stringify(out,null,2));if(!out.passed)process.exitCode=1;
