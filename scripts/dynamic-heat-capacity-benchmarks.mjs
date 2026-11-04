import {createThermal} from '../dynamic/thermal.mjs';
const cpTable=[[290,1.9],[300,2],[350,2.5]],base={nx:10,ny:1,width:1,height:1,depth:1,materials:[{k:1,rho:1,cp:2,cpTable}],initial:300};
const advance=(m,t,f=1)=>{while(m.time<t-1e-12)m.step(Math.min(m.safeDt*f,t-m.time),false);return m.snapshot();};
const out={date:'2026-11-04',scope:'Mathematical cp(T)=2+0.01(T-300) J/(kg K), not a real material dataset. Constant density, no phase change.',uniform:[]};
for(const [start,power]of[[300,10],[340,-5]])for(const factor of[1,.25]){
 const m=createThermal({...base,initial:start,source:power}),s=advance(m,2,factor),theta=start-300,H=2*theta+.005*theta**2+2*power,exact=300+2*H/(2+Math.sqrt(4+.02*H));
 out.uniform.push({initialK:start,sourceWPerM3:power,time:s.time,internalStepFactor:factor,exactK:exact,maxErrorK:Math.max(...s.temperature.map(t=>Math.abs(t-exact))),energyErrorJ:s.energyError,netInputJ:s.netInput});
}
const eq=createThermal({...base,nx:2,initial:[300,340]}),s=advance(eq,12),H=44,exact=300+2*H/(2+Math.sqrt(4+.02*H));out.insulatedEquilibrium={time:s.time,exactK:exact,temperatureK:s.temperature,maxErrorK:Math.max(...s.temperature.map(t=>Math.abs(t-exact))),energyErrorJ:s.energyError,arithmeticMeanInitialK:320};
out.passed=out.uniform.every(r=>r.maxErrorK<1e-8&&Math.abs(r.energyErrorJ)<1e-8)&&out.insulatedEquilibrium.maxErrorK<1e-7&&Math.abs(out.insulatedEquilibrium.energyErrorJ)<1e-8;console.log(JSON.stringify(out,null,2));if(!out.passed)process.exitCode=1;
