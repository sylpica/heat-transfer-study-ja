import test from 'node:test';
import assert from 'node:assert/strict';
import {createRansChannel} from '../dynamic/dev/rans-channel.mjs';

// Independent nondimensional and thermodynamic checks. No production stencil,
// quadrature, Fourier matrix or reference temperature solution is copied here.
const base={caseId:'MKM395',halfGap:.1,nu:1.575e-5,rho:1.177,cp:1006,k:.0264,width:1,depth:.01,nx:20,ny:12,turbulentPrandtl:.85};
const initial=Array.from({length:base.nx*base.ny},(_,n)=>300+((n%base.nx<7)?1:-.5)+.3*Math.sin(2.17*n));
const variance=s=>s.temperature.reduce((sum,t)=>sum+(t-s.meanTemperature)**2,0)/s.temperature.length;
const closeRelative=(a,b,tol=2e-13)=>assert.ok(Math.abs(a-b)<=tol*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);

test('a passive periodic insulated scalar loses temperature variance in both flow directions and both time integrators',()=>{
 for(const caseId of ['MKM180','MKM395','MKM590'])for(const direction of [-1,1])for(const timeIntegrator of ['euler','ssprk2']){
  const m=createRansChannel({...base,caseId,direction,timeIntegrator,initial});let state=m.snapshot(),previous=variance(state),first=previous;const initialMean=state.meanTemperature;
  for(let step=0;step<50;step++){
   state=m.step(.95*m.safeDt);const next=variance(state);
   // Positive diffusion plus incompressible periodic transport must dissipate
   // the L2 norm about the conserved mean, including a nonsmooth scalar.
   assert.ok(next<=previous+2e-13,`${caseId}/${direction}/${timeIntegrator}: ${next} > ${previous}`);
   assert.ok(Math.abs(state.meanTemperature-initialMean)<1e-12);
   previous=next;
  }
  assert.ok(previous<.9*first,'the fixture must actually mix instead of testing a stationary field');
 }
});

test('scaling every length by lambda and time by lambda squared preserves the nondimensional passive temperature history',()=>{
 for(const direction of [-1,1])for(const timeIntegrator of ['euler','ssprk2']){
  const c={...base,direction,timeIntegrator,initial},control=createRansChannel(c),scaled=[.25,2,10].map(lambda=>({lambda,model:createRansChannel({...c,halfGap:c.halfGap*lambda,width:c.width*lambda,depth:c.depth*lambda})}));
  const original=control.snapshot();
  for(const {lambda,model}of scaled){const s=model.snapshot();closeRelative(model.safeDt,control.safeDt*lambda**2);closeRelative(s.meanFlow.bulkVelocity,original.meanFlow.bulkVelocity/lambda);closeRelative(s.meanFlow.pressureGradientPaPerM,original.meanFlow.pressureGradientPaPerM/lambda**3);closeRelative(s.meanFlow.bulkReynoldsHydraulicDiameter,original.meanFlow.bulkReynoldsHydraulicDiameter);closeRelative(s.omittedMeanHeatingRateKPerS,original.omittedMeanHeatingRateKPerS/lambda**4);}
  for(let step=0;step<25;step++){
   const s=control.step(.6*control.safeDt);
   for(const {lambda,model}of scaled){const t=model.step(.6*control.safeDt*lambda**2);closeRelative(t.time,s.time*lambda**2);closeRelative(t.energy,s.energy*lambda**3);t.temperature.forEach((v,n)=>assert.ok(Math.abs(v-s.temperature[n])<2e-12));}
  }
 }
});
