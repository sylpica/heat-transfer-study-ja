import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {createTriangleDiffusion} from '../dynamic/dev/triangle-diffusion.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/TRIANGLE_TRANSIENT_REFERENCE_20261106.json',import.meta.url))),square=[[0,0],[1,0],[1,1],[0,1]],base=(extra={})=>({outline:square,subdivisions:4,k:15,depth:.03,rho:1000,cp:1000,wallTemperature:300,initial:350,...extra}),near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`),advance=(m,end)=>{while(m.time<end)m.step(Math.min(m.safeDt,end-m.time),false);return m.snapshot();};
const squareIntegral=(theta,elements)=>elements.reduce((total,e)=>{const [a,b,c]=e.nodes.map(i=>theta[i]);return total+e.physicalAreaM2/6*(a*a+b*b+c*c+a*b+b*c+c*a);},0);

test('a one-unknown P1 system has the hand-calculated SSPRK2 decay, element Fourier flux and boundary heat in consistent units',()=>{
 const m=createTriangleDiffusion(base({subdivisions:1})),s=m.snapshot(),i=m.mesh.nodes.findIndex(n=>!n.boundary),dt=m.safeDt;near(dt,.8*10000/1.8,1e-10);near(s.elementGradientsKPerM[0][0],0,1e-12);near(s.elementGradientsKPerM[0][1],100,1e-12);near(s.elementHeatFluxWPerM2[0][0],0,1e-12);near(s.elementHeatFluxWPerM2[0][1],-1500,1e-10);near(s.energy,500000,1e-9);near(s.boundaryOutwardPowerW,90,1e-12);near(s.boundaryOneSidedFourierPowerW,180,1e-12);near(s.boundaryGradientVsReactionDifferenceW,90,1e-12);assert.equal(s.scope.equilibratedConservativeFluxImplemented,false);
 const next=m.step(dt);near(next.temperatureExcess[i],26,1e-12);near(next.energy,260000,1e-8);near(next.cumulativeBoundaryOutwardJ,240000,1e-8);near(next.energyChange,-240000,1e-8);assert.ok(Math.abs(next.energyError)<=next.energyRoundoffBudgetJ);assert.equal(next.scope.p1NodalNotCellMean,true);assert.equal(next.releaseApproved,false);
});

test('constant and nonnegative/negative impulse fields preserve the Dirichlet value and monitored maximum principle on multiple convex meshes',()=>{
 for(const sides of [3,4,5]){const outline=Array.from({length:sides},(_,i)=>[.5+.4*Math.cos(.17+2*Math.PI*i/sides),.5+.4*Math.sin(.17+2*Math.PI*i/sides)]),zero=createTriangleDiffusion(base({outline,initial:300})),z=zero.step(zero.safeDt);assert.equal(z.energyError,0);assert.equal(z.energyRoundoffBudgetJ,0);assert.ok(z.temperature.every(t=>t===300));assert.ok(z.elementHeatFluxWPerM2.flat().every(q=>q===0));
  const mesh=zero.mesh,center=mesh.nodes.findIndex(n=>!n.boundary);
  for(const sign of [1,-1]){const initial=mesh.nodes.map(n=>n.id===center?300+sign*50:300),m=createTriangleDiffusion(base({outline,initial}));let previous=50;for(let j=0;j<40;j++){const s=m.step(m.safeDt),magnitudes=s.temperatureExcess.map(v=>Math.abs(v)),maximum=Math.max(...magnitudes);assert.ok(maximum<=previous+2e-12);assert.ok(s.temperatureExcess.every(v=>sign*v>=0));mesh.nodes.forEach(n=>{if(n.boundary)assert.equal(s.temperatureExcess[n.id],0);});assert.ok(s.temperature.every(v=>v>=250&&v<=350));assert.ok(Math.abs(s.energyError)<=s.energyRoundoffBudgetJ);previous=maximum;}}
 }
});

test('independent continuous rotated-rectangle field and boundary heat converge under combined refinement, including the full P1 interpolation error',t=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-triangle-transient-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);assert.deepEqual(reference.criteriaDeclaredBeforeProductionEvaluation,{finestFullFieldRmsK:.25,finestBoundaryPowerRelativeError:.01,finestFixedGridMaximumTimeErrorK:.001,refinedSpaceOrderRange:[1.8,2.2],timeOrderRange:[1.8,2.2]});const results=[];
 for(const row of reference.grids){assert.ok(row.loadQuadratureRefinementMaxDifferenceKM2<2e-12);const m=createTriangleDiffusion(row.config),s=advance(m,20),theta=s.temperatureExcess,integral=squareIntegral(theta,row.elements)-2*theta.reduce((sum,v,i)=>sum+v*row.continuousLoadIntegralKM2[i],0)+row.continuousSquareIntegralK2M2;assert.ok(integral>=0);const rms=Math.sqrt(integral/(.4*.2)),nodal=Math.max(...theta.map((v,i)=>Math.abs(v-row.continuousTemperatureExcessK[i]))),heatError=s.energy/row.continuousHeatJ-1,boundaryError=s.boundaryOutwardPowerW/row.continuousBoundaryPowerW-1;near(rms,row.production.fullInterpolatedFieldRmsK,2e-8);assert.ok(Math.abs(s.energyError)<=s.energyRoundoffBudgetJ);assert.ok(s.relativeEnergyError<1e-10);near(s.boundaryOneSidedFourierPowerW,row.independentBoundaryDefinitions.oneSidedFourierPowerW,1e-9);near(s.boundaryOutwardPowerW,row.independentBoundaryDefinitions.nodalReactionPowerW,1e-9);assert.ok(theta.every(v=>v>=0&&v<=50));assert.equal(s.scope.generalSecondOrderVerified,false);results.push({n:row.subdivisions,nodes:row.nodeCount,rmsK:rms,maxNodalK:nodal,heatRelativeError:heatError,boundaryRelativeError:boundaryError,oneSidedFourierBoundaryRelativeError:s.boundaryOneSidedFourierPowerW/row.continuousBoundaryPowerW-1,energyErrorJ:s.energyError});}
 const orders=results.slice(1).map((r,i)=>Math.log2(results[i].rmsK/r.rmsK)),last=results.at(-1);t.diagnostic(JSON.stringify({results,observedCombinedOrders:orders}));assert.ok(results.slice(1).every((r,i)=>r.rmsK<results[i].rmsK));assert.ok(orders.slice(-2).every(p=>p>=1.8&&p<=2.2));assert.ok(last.rmsK<.25);assert.ok(Math.abs(last.boundaryRelativeError)<.01);assert.ok(Math.abs(last.oneSidedFourierBoundaryRelativeError)<.01);assert.ok(last.rmsK>last.maxNodalK,'nodal error alone must not stand in for the whole interpolated field');
});

test('fixed-mesh SSPRK2 has independently verified second-order time error against the weighted matrix exponential, separately from spatial error',t=>{
 const row=reference.grids[reference.fixedTime.configGridIndex],errors=[];
 for(const count of [4,8,16]){const m=createTriangleDiffusion(row.config),dt=20/count;assert.ok(dt<=m.safeDt);for(let i=0;i<count;i++)m.step(dt,false);const s=m.snapshot(),error=Math.max(...s.temperatureExcess.map((v,i)=>Math.abs(v-row.independentSemidiscreteTemperatureExcessK[i])));assert.ok(Math.abs(s.energyError)<=s.energyRoundoffBudgetJ);errors.push(error);}
 const orders=errors.slice(1).map((v,i)=>Math.log2(errors[i]/v));t.diagnostic(JSON.stringify({maximumTimeErrorK:errors,orders}));assert.ok(errors.at(-1)<.001);assert.ok(orders.every(p=>p>=1.8&&p<=2.2));
});

test('positive and negative uniform volume sources balance all physical volume, including the explicitly mesh-dependent initial boundary reaction',()=>{
 for(const source of [100,-100]){const m=createTriangleDiffusion(base({initial:300,source})),initial=m.snapshot();near(initial.sourcePowerW,source*.03,1e-13);near(initial.boundaryOutwardPowerW,initial.boundarySourceDirectPowerW,1e-13);assert.equal(initial.boundaryOneSidedFourierPowerW,0);assert.ok(source*initial.boundarySourceDirectPowerW>0);const s=advance(m,20);near(s.cumulativeSourceJ,source*.03*20,1e-11);assert.ok(source*s.energy>0);assert.ok(Math.abs(s.energyError)<=s.energyRoundoffBudgetJ);assert.equal(s.netInput,s.cumulativeSourceJ-s.cumulativeBoundaryOutwardJ);assert.equal(s.scope.lumpedBoundarySourceReactionMeshDependent,true);}
 const coarse=createTriangleDiffusion(base({subdivisions:2,initial:300,source:100})).snapshot(),fine=createTriangleDiffusion(base({subdivisions:4,initial:300,source:100})).snapshot();assert.ok(fine.boundarySourceDirectPowerW<coarse.boundarySourceDirectPowerW);near(coarse.sourcePowerW,fine.sourcePowerW,1e-13);
});

test('sub-ULP absolute temperature heating retains a resolved excess, heat and exact rewind/restart without falsifying a zero source',()=>{
 const m=createTriangleDiffusion(base({subdivisions:2,initial:300,source:1e-100}));advance(m,5);const saved=m.snapshot();advance(m,10);const expected=m.snapshot();assert.ok(expected.temperature.every(v=>v===300));assert.ok(expected.temperatureExcess.some(v=>v>0));assert.ok(expected.absoluteTemperatureResolution.lostNonzeroExcessCount>0);assert.ok(Math.abs(expected.energyError/expected.cumulativeSourceJ)<1e-12);m.restore(saved);advance(m,10);assert.deepEqual(m.snapshot(),expected);
});

test('invalid step, upper/absolute-temperature failure and a caller mutation cannot partially advance the accepted state',()=>{
 const c=base(),before=structuredClone(c),m=createTriangleDiffusion(c),s=m.snapshot();for(const dt of [0,-1,NaN,Infinity,m.safeDt*2]){assert.throws(()=>m.step(dt));assert.deepEqual(m.snapshot(),s);}
 for(const [source,maximum,dt]of [[1e8,310,1],[-1e8,2000,4]]){const bad=createTriangleDiffusion(base({initial:300,source,maxTemperature:maximum})),old=bad.snapshot();assert.throws(()=>bad.step(dt));assert.deepEqual(bad.snapshot(),old);}
 const cfg=m.config;cfg.initial=1;const geometry=m.mesh;geometry.nodes[0].point[0]=999;assert.deepEqual(m.snapshot(),s);assert.deepEqual(c,before);
});

test('corrupt or cross-model restore rejects clock, boundary, signature, source and energy inconsistencies atomically',()=>{
 const m=createTriangleDiffusion(base()),initial=m.snapshot();m.step(1);const valid=m.snapshot(),boundary=m.mesh.nodes.findIndex(n=>n.boundary),badTheta=valid.temperatureExcess.slice();badTheta[boundary]=1;
 const candidates=[{...valid,modelSignature:'wrong'},{...valid,time:NaN},{...valid,time:-1},{...valid,steps:0},{...valid,lastDt:0},{...valid,lastDt:m.safeDt*2},{...valid,energyRoundoffBudgetJ:Infinity},{...valid,energyRoundoffBudgetJ:1e10},{...valid,cumulativeSourceJ:1},{...valid,cumulativeBoundaryOutwardJ:valid.cumulativeBoundaryOutwardJ+1,netInput:valid.netInput-1},{...valid,temperatureExcess:badTheta},{...valid,temperature:valid.temperature.map(t=>t+1)}];
 for(const s of candidates){assert.throws(()=>m.restore(s));assert.deepEqual(m.snapshot(),valid);}const other=createTriangleDiffusion(base({k:30}));assert.throws(()=>other.restore(valid));m.restore(initial);m.step(1);assert.deepEqual(m.snapshot(),valid);
});

test('unsupported boundaries/properties, wrong initial layout and nonphysical data reject explicitly before use',()=>{
 const mesh=createTriangleDiffusion(base()).mesh,wrong=mesh.nodes.map(n=>n.boundary?301:350);for(const c of [null,{},base({wallTemperature:0}),base({initial:-1}),base({initial:NaN}),base({initial:[]}),base({initial:wrong}),base({maxTemperature:299}),base({rho:0}),base({cp:Infinity}),base({source:NaN}),base({convection:{h:10}}),base({initial:300,rho:1e154,cp:1e154,source:1e-100})])assert.throws(()=>createTriangleDiffusion(c));
});

test('mixed hot/cold states and uniform sources respect linear superposition in resolved nodal temperatures and integrated heat',()=>{
 const seed=createTriangleDiffusion(base({subdivisions:2,initial:300})),nodes=seed.mesh.nodes,unknown=nodes.filter(n=>!n.boundary).map(n=>n.id),a=nodes.map(n=>n.id===unknown[0]?50:0),b=nodes.map(n=>n.id===unknown[1]?40:0),models=[createTriangleDiffusion(base({subdivisions:2,initial:a.map(v=>300+v),source:100})),createTriangleDiffusion(base({subdivisions:2,initial:b.map(v=>300+v),source:-50})),createTriangleDiffusion(base({subdivisions:2,initial:a.map((v,i)=>300+2*v-3*b[i]),source:350}))];
 for(let j=0;j<10;j++)for(const m of models)m.step(1,false);const [x,y,z]=models.map(m=>m.snapshot());z.temperatureExcess.forEach((v,i)=>near(v,2*x.temperatureExcess[i]-3*y.temperatureExcess[i],1e-11));near(z.energy,2*x.energy-3*y.energy,1e-8);near(z.cumulativeBoundaryOutwardJ,2*x.cumulativeBoundaryOutwardJ-3*y.cumulativeBoundaryOutwardJ,1e-8);
});
