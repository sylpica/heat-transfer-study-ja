import {createThermal} from '../dynamic/thermal.mjs';
import {createRadial} from '../dynamic/radial.mjs';
import {createTriangleLinearTransient} from '../dynamic/dev/triangle-linear-transient.mjs';
// Closure order 4 measurement: long-time transient -> steady-state
// asymptotics measured on three independent model families (rectangular
// FVM, radial shells, convex P1 triangle transient). For each family the
// steady state is known independently (analytic profile or uniform root),
// and this script records the decay of the maximum deviation from that
// steady state, the measured decay rate against the continuous first
// eigenvalue where one exists, and the convergence of the boundary power
// balance. Prints JSON to stdout.
function advanceTo(m,t,dt){let s=m.snapshot();while(s.time<t-1e-12){m.step(Math.min(dt,t-s.time),false);s=m.snapshot();}return s;}
const out={};
// --- A. Rectangular FVM: Dirichlet-Dirichlet slab, linear steady profile.
{
 const nx=20,m=createThermal({nx,ny:1,width:1,height:1,depth:1,materials:[{k:1,rho:1,cp:1}],initial:300,boundaries:{left:{type:'temperature',temperature:320},right:{type:'temperature',temperature:300}}});
 const steady=Array.from({length:nx},(_,i)=>320-20*(i+.5)/nx),rows=[];
 for(const t of [.05,.1,.2,.3,.5]){const s=advanceTo(m,t,m.safeDt*.5);rows.push({time:t,maxDeviationK:Math.max(...s.temperature.map((v,i)=>Math.abs(v-steady[i]))),netPowerW:s.lastPower,energyErrorJ:s.energyError});}
 const rate=Math.log(rows[2].maxDeviationK/rows[4].maxDeviationK)/(rows[4].time-rows[2].time);
 const q=m.flux().x;
 out.rectangularFvm={rows,measuredDecayRatePerS:rate,continuousLambda1:Math.PI**2,ratio:rate/Math.PI**2,finalFluxSpread:Math.max(...q)-Math.min(...q),finalFluxMean:q.reduce((a,b)=>a+b,0)/q.length};
}
// --- B. Radial shells: sphere with fixed surface temperature, uniform steady state.
{
 const m=createRadial({geometry:'sphere',n:32,radius:.1,k:5,rho:1000,cp:1000,initial:350,boundary:{type:'temperature',temperature:300}});
 const rows=[];
 for(const t of [100,200,400,800]){const s=advanceTo(m,t,m.safeDt*.5);rows.push({time:t,maxDeviationK:Math.max(...s.temperature.map(v=>Math.abs(v-300))),outerInwardWatts:s.outerInwardWatts,energyErrorJ:s.energyError});}
 const rate=Math.log(rows[1].maxDeviationK/rows[3].maxDeviationK)/(rows[3].time-rows[1].time),lambda1=5e-6*Math.PI**2/.01;
 out.radialSphere={rows,measuredDecayRatePerS:rate,continuousLambda1:lambda1,ratio:rate/lambda1};
}
// --- C. Convex P1 triangle transient: square, left/right Dirichlet, top/bottom adiabatic.
{
 const adiabatic=()=>({type:'adiabatic'});
 const base=createTriangleLinearTransient({outline:[[0,0],[1,0],[1,1],[0,1]],subdivisions:8,k:15,depth:.03,rho:1000,cp:1000,boundaries:Array.from({length:4},adiabatic),initial:300});
 const initial=base.mesh.nodes.map(n=>n.point[0]===0?320:n.point[0]===1?300:300);
 const m=createTriangleLinearTransient({outline:[[0,0],[1,0],[1,1],[0,1]],subdivisions:8,k:15,depth:.03,rho:1000,cp:1000,boundaries:[adiabatic(),{type:'temperature',temperatureK:300},adiabatic(),{type:'temperature',temperatureK:320}],initial});
 const steady=base.mesh.nodes.map(n=>320-20*n.point[0]),rows=[];
 for(const t of [2000,5000,10000,20000]){const s=advanceTo(m,t,m.safeDt);rows.push({time:t,maxDeviationK:Math.max(...s.temperature.map((v,i)=>Math.abs(v-steady[i]))),boundaryOutwardPowerW:s.boundaryOutwardPowerW,dirichletReactionOutwardPowerW:s.dirichletReactionOutwardPowerW,energyErrorJ:s.energyError,energyRoundoffBudgetJ:s.energyRoundoffBudgetJ});}
 const rate=Math.log(rows[1].maxDeviationK/rows[3].maxDeviationK)/(rows[3].time-rows[1].time),lambda1=1.5e-5*Math.PI**2;
 out.triangleLinear={rows,measuredDecayRatePerS:rate,continuousLambda1:lambda1,ratio:rate/lambda1,safeDt:m.safeDt};
}
console.log(JSON.stringify(out,null,1));
