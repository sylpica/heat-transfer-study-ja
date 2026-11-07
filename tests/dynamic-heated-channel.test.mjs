import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {createHeatedChannel} from '../dynamic/dev/heated-channel.mjs';
const ref=JSON.parse(readFileSync(new URL('../docs/dynamic/HEATED_CHANNEL_MATH_REFERENCE_20261106.json',import.meta.url))),base={...ref.config,nx:32,ny:16,inlet:300},near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
function advance(m,time,dt=m.safeDt){while(m.time<time)m.step(Math.min(dt,time-m.time),false);return m.snapshot();}
const rms=(a,b)=>Math.sqrt(a.reduce((s,t,i)=>s+(t-b[i])**2,0)/a.length);
test('prescribed Poiseuille row means give the independent volume flow, wall shear and plane-channel pressure law',()=>{
 const m=createHeatedChannel(base),s=m.snapshot(),H=base.height,U=base.bulkVelocity,dy=H/base.ny;
 for(let j=0;j<base.ny;j++){const a=j/base.ny,b=(j+1)/base.ny,integral=U*(3*(b*b-a*a)-2*(b**3-a**3));near(s.velocity[j],integral/(b-a),1e-14);near(s.velocity[j],s.velocity[base.ny-1-j],1e-14);}
 near(s.velocity.reduce((sum,u)=>sum+u*dy,0),U*H);near(s.meanFlow.massFlowKgPerS,base.rho*U*H*base.depth);near(s.meanFlow.pressureGradientPaPerM,-12*base.rho*base.nu*U/H**2);near(s.meanFlow.wallShearMagnitudePa,6*base.rho*base.nu*U/H);assert.equal(s.meanFlow.reynoldsDh,800);assert.equal(s.meanFlow.pecletDh,400);assert.equal(s.releaseApproved,false);assert.equal(s.assumptions.generalTwoDimensionalMomentumResolved,false);assert.equal(s.assumptions.axialConductionOmitted,true);
});
test('all inlet, outlet and wall powers independently account for actual full-domain heat storage for heating, cooling and insulation',()=>{
 for(const wallHeatFlux of [-20,0,20]){
  const c={...base,wallHeatFlux,initial:Array.from({length:base.nx*base.ny},(_,i)=>300+.5*Math.sin(i))},m=createHeatedChannel(c),zero=m.snapshot(),C=c.rho*c.cp*m.mesh.dx*m.mesh.dy*c.depth;let expectedInput=0,s=zero;
  for(let n=0;n<80;n++){
   const dt=.7*m.safeDt,inlet=c.rho*c.cp*c.bulkVelocity*c.height*c.depth*(c.inlet-273.15),outlet=c.rho*c.cp*m.mesh.dy*c.depth*s.velocity.reduce((sum,u,j)=>sum+u*(s.temperature[j*c.nx+c.nx-1]-273.15),0),walls=2*wallHeatFlux*c.width*c.depth;
   near(s.inletEnthalpyW,inlet);near(s.outletEnthalpyW,outlet);near(s.wallInputW,walls);expectedInput+=dt*(inlet-outlet+walls);s=m.step(dt);const stored=C*s.temperature.reduce((sum,t,i)=>sum+t-zero.temperature[i],0);near(stored,expectedInput,2e-10);near(s.netInput,expectedInput,2e-10);assert.ok(Math.abs(s.energyError)<s.energyRoundoffBudgetJ);assert.ok(s.advectionCfl<.8);
  }
  assert.ok(s.cumulativeInletEnthalpyJ!==0&&s.cumulativeOutletEnthalpyJ!==0);near(s.cumulativeWallInputJ,2*wallHeatFlux*c.width*c.depth*s.time);assert.ok(s.omittedMeanHeatingRateKPerS>0);near(s.omittedMeanHeatingEstimateK,s.time*s.omittedMeanHeatingRateKPerS);
 }
});
test('independent full-grid steady matrices approach the continuum quartic and plane-plate Nu=140/17 while retaining inlet cell-mean errors',t=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-heated-channel-reference.py',import.meta.url))).digest('hex'),ref.generatorSHA256);assert.equal(ref.releaseApproved,false);near(ref.continuum.nusselt,140/17);
 const measured=[],nuErrors=[];for(const r of ref.references){
  const m=createHeatedChannel({...base,nx:r.nx,ny:r.ny,inlet:r.inletCellMeansK,initial:r.steadyCellMeansK}),before=m.snapshot(),after=m.step(m.safeDt);before.temperature.forEach((T,i)=>near(after.temperature[i],T,1e-9));near(before.netExternalPowerW,0,1e-10);near(before.wallToBulkNusselt.at(-1),r.outletWallToBulkNusselt,1e-9);
  const e=rms(before.temperature,r.continuumCellMeansK);near(e,r.steadyVsContinuumRmsK,1e-12);measured.push(e);nuErrors.push(Math.abs(before.wallToBulkNusselt.at(-1)-140/17));assert.ok(r.semigroupMaxDifferenceK<1e-11);
 }
 const orders=measured.slice(1).map((e,i)=>Math.log2(measured[i]/e)),nuOrders=nuErrors.slice(1).map((e,i)=>Math.log2(nuErrors[i]/e));assert.ok(orders.every(v=>v>.9&&v<1.3));assert.ok(nuOrders.every(v=>v>1.8&&v<2.5));assert.ok(measured.at(-1)<.025);assert.ok(nuErrors.at(-1)<.001);t.diagnostic(JSON.stringify({steadyFullFieldRmsK:measured,coupledSpatialOrders:orders,outletNuErrors:nuErrors,outletNuOrders:nuOrders,scope:'Full-field first-order inlet shift is retained; local Nu ratio cancels the uniform axial offset and has a separate near-second-order trend. Not an assertion of second-order full-field accuracy.'}));
});
test('Euler time refinement matches an independent affine matrix exponential at fixed grid',t=>{
 const r=ref.references.find(v=>v.nx===32),result=[1,.5,.25].map(f=>{const m=createHeatedChannel({...base,inlet:r.inletCellMeansK}),s=advance(m,ref.targetTime,f*m.safeDt);assert.ok(Math.abs(s.energyError)<1e-9);return rms(s.temperature,r.transientCellMeansK);}),orders=result.slice(1).map((e,i)=>Math.log2(result[i]/e));assert.ok(orders.every(p=>p>.85&&p<1.2));assert.ok(result.at(-1)<.01);t.diagnostic(JSON.stringify({fixedGridTimeRmsK:result,timeOrders:orders,scope:'Fixed-grid matrix exponential verifies Euler time error, not the continuous transient spatial solution.'}));
});
test('zero wall heat and constant inlet preserve a uniform field; passive insulation respects the inlet/initial maximum principle',()=>{
 const uniform=createHeatedChannel({...base,wallHeatFlux:0});const s=advance(uniform,.2);assert.ok(s.temperature.every(t=>t===300));assert.equal(s.energyError,0);assert.ok(s.wallToBulkNusselt.every(v=>v===null));
 const c={...base,wallHeatFlux:0,initial:Array.from({length:base.nx*base.ny},(_,i)=>i%3?299:301)},m=createHeatedChannel(c),mixed=advance(m,.5);assert.ok(mixed.min>=299-1e-12&&mixed.max<=301+1e-12);
});
test('failures and cross-condition restores leave every accepted scalar and heat-history state unchanged',()=>{
 const m=createHeatedChannel(base),zero=m.snapshot();advance(m,.1);const saved=m.snapshot(),end=advance(m,.2);m.restore(saved);assert.deepEqual(advance(m,.2),end);
 for(const dt of [NaN,Infinity,0,-1,2*m.safeDt]){const before=m.snapshot();assert.throws(()=>m.step(dt));assert.deepEqual(m.snapshot(),before);}
 const bad=[{...saved,signature:'other'},{...saved,time:-1},{...saved,steps:0},{...saved,netInput:saved.netInput+1},{...saved,cumulativeInletEnthalpyJ:saved.cumulativeInletEnthalpyJ+1,cumulativeOutletEnthalpyJ:saved.cumulativeOutletEnthalpyJ+1}];const nan=structuredClone(saved);nan.temperature[3]=NaN;bad.push(nan);const hot=structuredClone(saved);hot.temperature[0]+=1;bad.push(hot);
 for(const state of bad){const before=m.snapshot();assert.throws(()=>m.restore(state));assert.deepEqual(m.snapshot(),before);}m.restore(zero);assert.deepEqual(m.snapshot(),zero);
 const largeFlux=1e7,initialWall=300+largeFlux*(base.height/base.ny)/(2*base.k),huge=createHeatedChannel({...base,wallHeatFlux:largeFlux,maxTemperature:initialWall+1}),initial=huge.snapshot();assert.throws(()=>huge.step(huge.safeDt));assert.deepEqual(huge.snapshot(),initial);
});
test('unsupported geometry, unresolved floating scales and flow regimes are rejected before accepting a model',()=>{
 for(const patch of [{width:0},{height:0},{depth:Number.MIN_VALUE},{nx:3},{ny:7},{ny:129},{nu:0},{rho:NaN},{cp:0},{k:-1},{bulkVelocity:0},{bulkVelocity:-1},{bulkVelocity:1},{bulkVelocity:.01},{width:.02},{initial:0},{inlet:[300]},{initial:[300]},{inlet:Infinity},{wallHeatFlux:NaN},{wallHeatFlux:-1e9},{maxTemperature:299},{boundaries:{}},{radiation:true},{inletVelocity:[1]}])assert.throws(()=>createHeatedChannel({...base,...patch}),JSON.stringify(patch));
 const c=structuredClone(base),m=createHeatedChannel(c);c.width=100;m.config.width=200;assert.equal(m.config.width,.2);
});
