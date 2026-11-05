import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createHeatSink} from '../dynamic/dev/heat-sink.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/HEAT_SINK_MATH_REFERENCE_20261105.json',import.meta.url))),base={...reference.config,finCells:16};
function advance(model,target,dt=model.safeDt){while(model.time<target)model.step(Math.min(dt,target-model.time),false);return model.snapshot();}
function errors(s,r,mesh){const e=[s.baseTemperature-r.baseTemperature,...s.finTemperature.map((t,i)=>t-r.finTemperature[i])],C=[mesh.baseCapacity,...s.finTemperature.map(()=>mesh.finCount*mesh.finCellCapacity)];return {rms:Math.sqrt(e.reduce((v,x,i)=>v+C[i]*x*x,0)/mesh.totalCapacity),max:Math.max(...e.map(Math.abs))};}
test('full physical-branch matrix references and contact/cosh continuum fins agree with conservative steady fields under grid refinement',t=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-heat-sink-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);
 const measured=[];for(const r of reference.references){
  const m=createHeatSink({...base,finCells:r.finCells,initialBase:r.steady.baseTemperature,initialFin:r.steady.finTemperature}),s=m.snapshot(),next=m.step(m.safeDt);assert.ok(Math.abs(next.baseTemperature-s.baseTemperature)<1e-10);s.finTemperature.forEach((T,i)=>assert.ok(Math.abs(next.finTemperature[i]-T)<1e-10));
  assert.ok(Math.abs(s.baseStoragePowerW)<1e-10);assert.ok(Math.abs(s.finStoragePowerPerFinW)<1e-10);assert.ok(Math.abs(s.netExternalPowerW)<1e-10);assert.ok(r.branchSymmetryMaxK<1e-9);assert.ok(r.matrixExponentialSemigroupMaxDifferenceK<1e-9);
  const error=errors(s,{baseTemperature:reference.continuumSteady.baseTemperature,finTemperature:r.continuumFinCellMeans},m.mesh);measured.push(error.rms);assert.ok(Math.abs(error.rms-r.steadyCapacityWeightedRmsErrorK)<1e-12);
 }
 const orders=measured.slice(1).map((e,i)=>Math.log2(measured[i]/e));assert.ok(orders.every(p=>p>1.95&&p<2.05));assert.ok(measured.at(-1)<.001);assert.ok(reference.continuumSteady.transverseBiot<.1);assert.equal(reference.releaseApproved,false);t.diagnostic(JSON.stringify({steadyCapacityWeightedRmsK:measured,spatialOrders:orders}));
});
test('symmetric representative fins follow the independent all-branches affine matrix exponential',t=>{
 const measured=[];for(const r of reference.references){const m=createHeatSink({...base,finCells:r.finCells}),s=advance(m,reference.targetTime,.5*m.safeDt),e=errors(s,r.transient,m.mesh);assert.ok(e.max<.02);assert.ok(Math.abs(s.energyError)<1e-8);assert.ok(Math.abs(s.energyError)<=s.energyRoundoffBudgetJ);measured.push({finCells:r.finCells,...e});}
 assert.ok(measured.at(-1).max<.001);t.diagnostic(JSON.stringify({fixedGridTemporalComparisons:measured,scope:'Each grid compared with its own exact full-branch matrix exponential; not a continuous transient spatial-order claim.'}));
});
test('Euler time refinement is first order against an independently integrated fixed physical network',t=>{
 const r=reference.references.find(row=>row.finCells===16),result=[1,.5,.25].map(f=>{const m=createHeatSink(base);return errors(advance(m,reference.targetTime,f*m.safeDt),r.transient,m.mesh).rms;}),orders=result.slice(1).map((e,i)=>Math.log2(result[i]/e));assert.ok(orders.every(p=>p>.9&&p<1.15));t.diagnostic(JSON.stringify({timeRmsK:result,timeOrders:orders}));
});
test('zero fins reduce to the independent heated lumped base with its full exposed area',()=>{
 const c={...base,finCount:0},m=createHeatSink(c),s=advance(m,10,.01),C=c.rho*c.cp*c.baseWidth*c.baseDepth*c.baseThickness,G=c.h*c.baseWidth*c.baseDepth,expected=c.ambient+c.power/G+(c.initialBase-c.ambient-c.power/G)*Math.exp(-10*G/C);assert.ok(Math.abs(s.baseTemperature-expected)<1e-4);assert.deepEqual(s.finTemperature,[]);assert.equal(s.finCount,0);assert.equal(s.baseToAllFinsW,0);assert.equal(s.finTotalConvectionOutwardW,0);assert.equal(m.mesh.baseExposedArea,c.baseWidth*c.baseDepth);assert.ok(Math.abs(s.energyError)<1e-8);
});
test('base/fin heat exchange and area resistance use SI units and count every physical fin once',()=>{
 const m=createHeatSink(base),s=m.snapshot(),A=base.finThickness*base.baseDepth,dx=base.finLength/base.finCells,q=A*(base.initialBase-base.initialFin)/(base.contactResistance+dx/(2*base.k));assert.ok(Math.abs(s.baseToFinPerFinW-q)<1e-12);assert.equal(s.baseToAllFinsW,base.finCount*s.baseToFinPerFinW);assert.equal(s.contactResistancePerFinKPerW,base.contactResistance/A);assert.ok(Math.abs(s.baseStoragePowerW+base.finCount*s.finStoragePowerPerFinW-s.netExternalPowerW)<1e-12);assert.ok(Math.abs(m.mesh.baseExposedArea-base.baseDepth*(base.baseWidth-base.finCount*base.finThickness))<1e-15);assert.equal(s.releaseApproved,false);assert.equal(s.assumptions.fluidInteractionsResolved,false);assert.equal(s.assumptions.threeDimensionalConductionResolved,false);
});
test('failed timesteps, temperature bounds and inconsistent restores never change the accepted physical state',()=>{
 const m=createHeatSink(base),zero=m.snapshot();advance(m,.1);const saved=m.snapshot(),end=advance(m,.2);m.restore(saved);assert.deepEqual(advance(m,.2),end);
 for(const dt of [0,-1,Infinity,NaN,m.safeDt*2]){const before=m.snapshot();assert.throws(()=>m.step(dt));assert.deepEqual(m.snapshot(),before);}
 const bad=[{...saved,signature:'other'},{...saved,time:-1},{...saved,steps:0},{...saved,baseTemperature:saved.baseTemperature+1},{...saved,netInput:saved.netInput+1},{...saved,netInputCompensation:Infinity}];const nan=structuredClone(saved);nan.finTemperature[0]=NaN;bad.push(nan);const inconsistent=structuredClone(zero);inconsistent.finTemperature.reverse();inconsistent.finTemperature[0]+=.1;bad.push(inconsistent);
 for(const state of bad){const before=m.snapshot();assert.throws(()=>m.restore(state));assert.deepEqual(m.snapshot(),before);}m.restore(zero);assert.deepEqual(m.snapshot(),zero);
 for(const power of [-1e10,1e10]){const f=createHeatSink({...base,power}),before=f.snapshot();assert.throws(()=>f.step(f.safeDt));assert.deepEqual(f.snapshot(),before);}
});
test('invalid material, geometry, unsupported physics and unresolved numeric scales are rejected',()=>{
 // Positive input can still underflow the derived volume (MIN_VALUE) or
 // overflow a derived rate (1e-320). 1e-300 does neither and was an invalid
 // rejection fixture; no arbitrary minimum thickness is imposed to pass it.
 for(const patch of [{baseWidth:0},{baseDepth:Infinity},{finCount:65},{finCount:1.5},{finCells:3},{finCells:257},{h:-1},{h:1e8},{contactResistance:-1},{k:0},{cp:-1},{rho:Infinity},{ambient:0},{initialBase:0},{initialFin:NaN},{initialFin:[300]},{baseWidth:.005},{baseWidth:.006},{source:1},{radiation:true},{outline:[]},{baseThickness:Number.MIN_VALUE},{baseThickness:1e-320},{maxTemperature:300}])assert.throws(()=>createHeatSink({...base,...patch}));
 const c=structuredClone(base),m=createHeatSink(c);c.power=500;const copy=m.config;copy.baseWidth=500;assert.equal(m.config.power,8);assert.equal(m.config.baseWidth,.06);
});
