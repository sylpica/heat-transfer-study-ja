import test from 'node:test';import assert from 'node:assert/strict';import {blasiusSimilarity,createBlasiusBoundaryFlow} from '../dynamic/dev/blasius-boundary-flow.mjs';
const config={width:1,height:.12,depth:.03,nx:32,ny:32,nu:.0001,rho:1,freeStreamVelocity:1};
const close=(a,b,scale=1)=>assert.ok(Math.abs(a-b)<2e-12*scale,`${a} vs ${b}`);
test('steady flat-plate streamfunction supplies closed plate normals, uniform inlet and conservative external throughflow without claiming NS or thermal validation',()=>{
 const flow=createBlasiusBoundaryFlow(config),{nx,ny}=flow.mesh,d=flow.diagnostics;
 assert.deepEqual(blasiusSimilarity(0),{f:0,fp:0});assert.equal(blasiusSimilarity(24).fp,1);
 close(d.inletVolumeFlowM3PerS,config.freeStreamVelocity*config.height*config.depth);assert.ok(d.upperOutflowM3PerS>0&&d.outletVolumeFlowM3PerS>0);close(d.inletVolumeFlowM3PerS,d.outletVolumeFlowM3PerS+d.upperOutflowM3PerS,d.inletVolumeFlowM3PerS);
 for(let i=0;i<nx;i++)assert.equal(flow.v[i],0);for(let j=0;j<ny;j++)close(flow.u[j*(nx+1)],config.freeStreamVelocity);
 assert.ok(d.normalizedDivergence<1e-12&&d.boundaryRelativeResidual<1e-12);close(d.meanFrictionCoefficient,4*d.wallCurvature/Math.sqrt(d.Re_L));
 assert.ok(flow.wallShearCellMeansPa[0]>flow.wallShearCellMeansPa.at(-1));assert.equal(flow.assumptions.fullNavierStokesSolved,false);assert.equal(flow.assumptions.temperatureTransportImplemented,false);assert.equal(flow.releaseApproved,false);
});
test('preserving Reynolds number while scaling length speed density and span preserves the nondimensional entire face flow and drag',()=>{
 const a=createBlasiusBoundaryFlow(config),length=4,speed=3,density=7,span=5,b=createBlasiusBoundaryFlow({...config,width:config.width*length,height:config.height*length,depth:config.depth*span,freeStreamVelocity:speed,nu:config.nu*length*speed,rho:density});
 for(const name of ['u','v'])for(let i=0;i<a[name].length;i++)close(b[name][i],speed*a[name][i],speed);
 for(const name of ['xVolumeFluxM3PerS','yVolumeFluxM3PerS'])for(let i=0;i<a[name].length;i++)close(b[name][i],length*speed*span*a[name][i],b.diagnostics.positiveBoundaryFlowL1ScaleM3PerS);
 close(a.diagnostics.meanFrictionCoefficient,b.diagnostics.meanFrictionCoefficient);for(let i=0;i<a.wallShearCellMeansPa.length;i++)close(b.wallShearCellMeansPa[i],density*speed**2*a.wallShearCellMeansPa[i]);
});
test('unknown physics and unresolved input ranges reject, caller data and accepted output stay protected',()=>{
 const c={...config},before=structuredClone(c),flow=createBlasiusBoundaryFlow(c);c.rho=99;assert.equal(flow.config.rho,1);assert.deepEqual(before,config);assert.throws(()=>{flow.u[0]=99;});assert.throws(()=>{flow.config.rho=2;});
 for(const bad of [{...config,nx:3},{...config,ny:129},{...config,width:NaN},{...config,depth:0},{...config,freeStreamVelocity:-1},{...config,nu:.01},{...config,nu:1e-6},{...config,height:.5},{...config,height:.01},{...config,lidVelocity:0},{...config,temperature:300}])assert.throws(()=>createBlasiusBoundaryFlow(bad));
 for(const eta of [-1,NaN,Infinity,'1'])assert.throws(()=>blasiusSimilarity(eta));assert.deepEqual(createBlasiusBoundaryFlow(config).u,flow.u);
});
