import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createCessProfile,cessEddyRatio,CESS_DNS_CASES} from '../dynamic/dev/cess-profile.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/CESS_MATH_REFERENCE_20261105.json',import.meta.url))),base={caseId:'MKM180',halfGap:.01,nu:1.575e-5,rho:1.177,rows:64},near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('mean profile, center and cell averages match independent coordinate-ODE and high-precision closure references',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-cess-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);
 for(const row of reference.cases){
  for(const sample of row.eddyRatioSamples){const actual=cessEddyRatio(sample.distanceOverHalfGap,row.reTau);if(sample.eddyRatio===0)assert.equal(actual,0);else assert.ok(Math.abs(actual/sample.eddyRatio-1)<1e-12);}
  for(const sample of row.samples){const p=createCessProfile({...base,caseId:row.id,halfGap:1,nu:1/row.reTau,rho:1,rows:sample.rows});near(p.meta.centerVelocity,row.centerVelocityPlus);near(p.meta.bulkVelocity,row.bulkVelocityPlus);for(let i=0;i<sample.rows;i++)near(p.rowVelocity[i],sample.rowVelocityPlus[i],1e-9);}
 }
});
test('no-slip walls, symmetric mean velocity and total shear satisfy the imposed pressure-gradient balance',()=>{
 const p=createCessProfile(base),m=p.meta,dy=m.fullHeight/m.rows;assert.equal(p.pointVelocity(0),0);assert.equal(p.pointVelocity(m.fullHeight),0);
 for(let j=0;j<m.rows;j++){assert.equal(p.rowVelocity[j],p.rowVelocity[m.rows-1-j]);assert.ok(p.rowVelocity[j]>0);if(j<m.rows/2-1)assert.ok(p.rowVelocity[j+1]>p.rowVelocity[j]);}
 for(let j=0;j<=m.rows;j++){near(p.totalShearAtFaces[j],-m.pressureGradientPaPerM*(m.halfGap-p.faces[j]));assert.ok(p.effectiveNuAtFaces[j]>=m.nu);}
 for(let j=0;j<m.rows;j++)near((p.totalShearAtFaces[j+1]-p.totalShearAtFaces[j])/dy,m.pressureGradientPaPerM,1e-9);
 near(p.totalShearAtFaces[0],m.wallShearMagnitude);near(p.totalShearAtFaces.at(-1),-m.wallShearMagnitude);assert.equal(p.totalShearAtFaces[m.rows/2],0);near(m.cellMeanBulkDifference,0);
});
test('reversing the pressure gradient reverses mean flow while the empirical eddy viscosity remains positive',()=>{
 const a=createCessProfile(base),b=createCessProfile({...base,direction:-1});near(a.meta.pressureGradientPaPerM,-b.meta.pressureGradientPaPerM);near(a.meta.bulkVelocity,-b.meta.bulkVelocity);
 a.rowVelocity.forEach((u,i)=>near(u,-b.rowVelocity[i]));assert.deepEqual(a.effectiveNuAtFaces,b.effectiveNuAtFaces);assert.equal(b.pointVelocity(0),0);assert.equal(b.pointVelocity(b.meta.fullHeight),0);
 assert.equal(cessEddyRatio(0,178.12),0);assert.equal(cessEddyRatio(.5,0),0);assert.ok(cessEddyRatio(1e-12,178.12)>0);
});
test('friction coefficients distinguish full-gap Reynolds number and hydraulic diameter without altering dimensions',()=>{
 const m=createCessProfile(base).meta,U=m.bulkVelocity,tau=m.wallShearMagnitude;near(m.skinFrictionCoefficient,tau/(.5*m.rho*U*U));near(m.DarcyFrictionFactor,4*m.skinFrictionCoefficient);near(m.bulkReynoldsFullGap,U*(2*m.halfGap)/m.nu);near(m.bulkReynoldsHydraulicDiameter,U*(4*m.halfGap)/m.nu);near(m.bulkReynoldsHydraulicDiameter,2*m.bulkReynoldsFullGap);
 const scaled=createCessProfile({...base,nu:2*base.nu}).meta;near(scaled.bulkVelocity,2*U);near(scaled.pressureGradientPaPerM,4*m.pressureGradientPaPerM);near(scaled.bulkReynoldsHydraulicDiameter,m.bulkReynoldsHydraulicDiameter);
});
test('modeled molecular shear work plus Reynolds-stress production balances the imposed mean pressure power',()=>{
 const p=createCessProfile({...base,caseId:'MKM395'}),m=p.meta,n=4096,h=m.fullHeight/n;let work=0;
 for(let i=0;i<=n;i++){const y=i*h,gradient=p.velocityGradient(y),density=m.rho*m.nu*(1+p.eddyRatioAt(y))*gradient*gradient;work+=(i===0||i===n?1:i%2?4:2)*density;}
 work*=h/3;const pressurePower=-m.pressureGradientPaPerM*m.bulkVelocity*m.fullHeight;assert.ok(pressurePower>0);assert.ok(Math.abs(work-pressurePower)<2e-8*pressurePower);near(m.meanMechanicalPowerDensityWPerM3,-m.pressureGradientPaPerM*m.bulkVelocity);
});
test('quadrature refinement changes numerical integration error rather than the empirical model constants or DNS cases',()=>{
 for(const c of CESS_DNS_CASES){const a=createCessProfile({...base,caseId:c.id,quadratureOrder:8}),b=createCessProfile({...base,caseId:c.id,quadratureOrder:16});near(a.meta.bulkVelocity,b.meta.bulkVelocity);a.rowVelocity.forEach((u,i)=>near(u,b.rowVelocity[i]));assert.equal(a.meta.reTau,c.reTau);assert.equal(a.releaseApproved,false);assert.equal(a.meanFlowSteady,true);assert.equal(a.fluctuationsResolved,false);}
 assert.equal(CESS_DNS_CASES.find(c=>c.id==='MKM180').reTau,178.12);
});
test('out-of-scope cases, dimensions, rows, signs and positions are rejected rather than silently extrapolated',()=>{
 for(const patch of [{caseId:'Re590'},{halfGap:0},{nu:Infinity},{rho:-1},{rows:63},{rows:256},{direction:0},{quadratureOrder:12},{halfGap:1e-300}])assert.throws(()=>createCessProfile({...base,...patch}));
 const p=createCessProfile(base);for(const y of [-.001,.03,NaN,'0'])assert.throws(()=>p.pointVelocity(y));for(const [d,ret]of [[-1,180],[1.1,180],[.5,-1],[.5,Infinity]])assert.throws(()=>cessEddyRatio(d,ret));
});
