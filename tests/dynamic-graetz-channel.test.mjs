import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {solveGraetzChannel} from '../dynamic/dev/graetz-channel.mjs';
import {createHeatedChannel} from '../dynamic/dev/heated-channel.mjs';
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const rmsDiff=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length);
const air={width:.05,height:.01,depth:.01,rho:1.177,cp:1006,k:.0264,nu:1.575e-5,bulkVelocity:.5,inletTemperature:300};
const flux50={type:'wall-heat-flux',wallHeatFlux:50};

test('prescribed Poiseuille row means reproduce the analytic volume flow, pressure law and dimensionless groups',()=>{
 const r=solveGraetzChannel({...air,nx:16,ny:8,boundary:flux50}),H=air.height,U=air.bulkVelocity,dy=H/8;
 for(let j=0;j<8;j++){const a=j/8,b=(j+1)/8;near(r.rowVelocity[j],U*(3*(b*b-a*a)-2*(b**3-a**3))/(b-a),1e-14);near(r.rowVelocity[j],r.rowVelocity[7-j],1e-13);}
 near(r.rowVelocity.reduce((s,u)=>s+u*dy,0),U*H,1e-15);
 near(r.meanFlow.massFlowKgPerS,r.meanFlow.analyticMassFlowKgPerS,1e-15);
 near(r.meanFlow.pressureGradientPaPerM,-12*air.rho*air.nu*U/H**2,1e-9);
 near(r.meanFlow.wallShearMagnitudePa,6*air.rho*air.nu*U/H,1e-12);
 near(r.meanFlow.hydraulicDiameter,2*H,1e-18);near(r.meanFlow.reynoldsDh,U*2*H/air.nu,1e-9);
 near(r.meanFlow.prandtl,air.nu/(air.k/(air.rho*air.cp)),1e-12);near(r.meanFlow.pecletDh,r.meanFlow.reynoldsDh*r.meanFlow.prandtl,1e-6);
 assert.equal(r.releaseApproved,false);assert.equal(r.assumptions.axialConductionOmitted,true);assert.equal(r.assumptions.hydrodynamicEntranceResolved,false);assert.equal(r.assumptions.generalTwoDimensionalMomentumResolved,false);
});

test('steady marching reproduces the independently generated continuous Graetz reference on four grids',t=>{
 const ref=JSON.parse(readFileSync(new URL('../docs/dynamic/GRAETZ_CONTINUOUS_REFERENCE_20261106.json',import.meta.url)));
 assert.equal(ref.releaseApproved,false);assert.equal(ref.fullyDeveloped.nusseltDh,140/17);
 const budgets=[[.07,.028,.1,.018],[.016,.014,.034,.005],[.0095,.007,.022,.0015],[.006,.0036,.014,.0005]],rows=[];
 ref.grids.forEach((row,g)=>{
  const r=solveGraetzChannel({...air,nx:row.nx,ny:row.ny,boundary:flux50});
  const e={t:rmsDiff(r.temperature,row.temperature),b:rmsDiff(r.bulkTemperature,row.bulkTemperature),w:rmsDiff(r.lowerWallTemperature,row.wallTemperature),nu:Math.abs(r.localNusselt.at(-1)/row.wallToBulkNusselt.at(-1)-1)};
  assert.ok(e.t<budgets[g][0]&&e.b<budgets[g][1]&&e.w<budgets[g][2]&&e.nu<budgets[g][3],JSON.stringify(e));
  assert.ok(r.energyBalanceRelativeResidual<1e-9);
  rows.push(e);
 });
 for(let g=1;g<4;g++)for(const key of ['t','b','w','nu'])assert.ok(rows[g][key]<rows[g-1][key],`${key} not monotone at grid ${g}`);
 t.diagnostic(JSON.stringify({reference:'GRAETZ_CONTINUOUS_REFERENCE_20261106.json (Python cosine-Galerkin spectral, independent of this solver)',rmsK:rows,scope:'Cell/x-interval means against the spectral reference; errors decrease monotonically but no single whole-field order is asserted (mixed x-upwind and y-diffusion contributions, inlet corner singularity).'}));
});

test('direct steady marching agrees with the transient heated-channel solver advanced to steady state',()=>{
 const nx=32,ny=16,m=createHeatedChannel({width:.05,height:.01,depth:.01,rho:1.177,cp:1006,k:.0264,nu:1.575e-5,bulkVelocity:.5,wallHeatFlux:50,inlet:300,initial:300,nx,ny});
 let prev=m.snapshot(),s=prev;
 while(true){prev=s;s=m.step(Math.min(m.safeDt,4));if(Math.max(...s.temperature.map((v,i)=>Math.abs(v-prev.temperature[i])))<1e-10)break;}
 const r=solveGraetzChannel({...air,nx,ny,boundary:flux50});
 assert.ok(Math.max(...r.temperature.map((v,i)=>Math.abs(v-s.temperature[i])))<1e-7);
 assert.ok(Math.abs(r.outlet.bulkTemperature-s.bulkTemperature.at(-1))<1e-7);
});

test('long flux-heated channel reaches the exact quartic profile, wall-bulk difference and Nu=140/17',t=>{
 const q=50,H=air.height,k=air.k,g=2*q/(air.rho*air.cp*air.bulkVelocity*H);
 const r=solveGraetzChannel({...air,width:30,nx:400,ny:64,dxGrowth:1.03,boundary:flux50});
 assert.ok(Math.abs(r.outlet.localNusselt-140/17)<2e-4);
 near(r.outlet.wallTemperatureMean-r.outlet.bulkTemperature,(q*H/k)*17/70,1e-4);
 near(r.outlet.bulkTemperature,300+g*30,1e-3);
 const ny=64,nx=400,profileError=Math.max(...Array.from({length:ny},(_,j)=>{const z=(j+.5)/ny;return Math.abs(r.temperature[j*nx+nx-1]-(r.outlet.bulkTemperature+(q*H/k)*(17/70-z+2*z**3-z**4)));}));
 assert.ok(profileError<2e-3);
 // Downstream of x*=1 the wall-bulk difference is constant to 0.1 %.
 const dev=r.dimensionlessLength.map((xs,i)=>xs>=1?(r.lowerWallTemperature[i]+r.upperWallTemperature[i])/2-r.bulkTemperature[i]:null).filter(v=>v!==null);
 assert.ok(Math.max(...dev)-Math.min(...dev)<1e-3*(q*H/k)*17/70);
 t.diagnostic(JSON.stringify({outletNusselt:r.outlet.localNusselt,exact:140/17,wallMinusBulkK:r.outlet.wallTemperatureMean-r.outlet.bulkTemperature,exactWallMinusBulkK:(q*H/k)*17/70,quarticProfileMaxErrorK:profileError,scope:'Developed limit only; the same run at the entrance is not asserted to match the quartic.'}));
});

test('long isothermal-wall channel reaches the textbook fully developed Nu=7.541 (eq. 7.63)',t=>{
 const r=solveGraetzChannel({...air,width:8,nx:300,ny:128,dxGrowth:1.02,boundary:{type:'wall-temperature',wallTemperature:320}});
 const i=r.dimensionlessLength.findIndex(xs=>xs>=0.2);
 assert.ok(Math.abs(r.localNusselt[i]-7.541)<1.5e-3);
 assert.ok(r.bulkTemperature.every((v,j)=>j===0||v>=r.bulkTemperature[j-1]-1e-12));
 assert.ok(Math.max(...r.bulkTemperature)<320);
 t.diagnostic(JSON.stringify({stationXStar:r.dimensionlessLength[i],nusselt:r.localNusselt[i],textbook:7.541,source:'A Heat Transfer Textbook 6th ed. eq. (7.63) / Table 7.4, parallel plates, Dh basis.'}));
});

test('entrance stations follow the Leveque x*^(-1/3) asymptote derived from the similarity ODE',t=>{
 const lev=JSON.parse(readFileSync(new URL('../docs/dynamic/GRAETZ_LEVEQUE_REFERENCE_20261107.json',import.meta.url)));
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-graetz-leveque-reference.py',import.meta.url))).digest('hex'),lev.generatorSHA256);
 near(lev.constantWallTemperature.integralQuadrature,lev.constantWallTemperature.integralClosedForm,1e-9);
 near(lev.constantWallTemperature.pipeCrossCheck2C,1.077,2e-3);
 const cases=[[ {type:'wall-temperature',wallTemperature:320},lev.constantWallTemperature.nusseltPrefactor],[flux50,lev.constantWallHeatFlux.nusseltPrefactor]];
 for(const [boundary,target] of cases){
  const r=solveGraetzChannel({...air,width:2,nx:900,ny:256,dxGrowth:1.015,boundary});
  const band=(lo,hi)=>{const p=r.localNusselt.map((nu,i)=>[r.dimensionlessLength[i],nu]).filter(([xs,nu])=>nu&&xs>=lo&&xs<hi).map(([xs,nu])=>nu*xs**(1/3));return p.reduce((s,v)=>s+v,0)/p.length;};
  const small=band(1e-4,5e-4),mid=band(5e-4,1e-3),large=band(1e-3,2e-3);
  assert.ok(Math.abs(small/target-1)<.025,`${boundary.type}: ${small} vs ${target}`);
  assert.ok(small<mid&&mid<large,`${boundary.type}: asymptote must be approached from above as x* decreases`);
  t.diagnostic(JSON.stringify({boundary:boundary.type,target,small,mid,large,scope:'Finite-x* cell means approach the similarity prefactor from above; the singular point x*=0 itself is not evaluated.'}));
 }
});

test('energy balance closes to roundoff level and the flux-case bulk rise is the analytic linear law',()=>{
 for(const boundary of [{type:'wall-temperature',wallTemperature:320},{type:'wall-temperature',wallTemperature:280},flux50,{type:'wall-heat-flux',wallHeatFlux:-50}]){
  const r=solveGraetzChannel({...air,width:.5,nx:128,ny:32,boundary});
  assert.ok(r.energyBalanceRelativeResidual<1e-9,`${boundary.type} ${boundary.wallHeatFlux??boundary.wallTemperature}: ${r.energyBalanceRelativeResidual}`);
  near(r.totalWallHeatRateW-r.fluidHeatRateW,r.energyBalanceResidualW,1e-12);
 }
 const g=2*50/(air.rho*air.cp*air.bulkVelocity*air.height);
 const r=solveGraetzChannel({...air,width:.5,nx:128,ny:32,boundary:flux50});
 near(r.outlet.bulkTemperature,300+g*.5,1e-6);
});

test('grid refinement converges monotonically toward the developed values at fixed physical conditions',t=>{
 const seq=[[64,16],[128,32],[256,64],[512,128]].map(([nx,ny])=>solveGraetzChannel({...air,width:.5,nx,ny,boundary:{type:'wall-temperature',wallTemperature:320}}));
 const tbErr=seq.map(r=>Math.abs(r.outlet.bulkTemperature-seq.at(-1).outlet.bulkTemperature)),nuErr=seq.map(r=>Math.abs(r.outlet.localNusselt-seq.at(-1).outlet.localNusselt));
 assert.ok(tbErr[0]>tbErr[1]&&tbErr[1]>tbErr[2]);assert.ok(nuErr[0]>nuErr[1]&&nuErr[1]>nuErr[2]);
 assert.ok(Math.abs(seq.at(-1).outlet.localNusselt-7.541)<1e-3);
 const orders=tbErr.slice(1,-1).map((e,i)=>Math.log2(tbErr[i]/e));
 t.diagnostic(JSON.stringify({outletBulkK:seq.map(r=>r.outlet.bulkTemperature),outletNusselt:seq.map(r=>r.outlet.localNusselt),observedBulkOrdersVsFinest:orders,scope:'Combined nx/ny refinement against the finest grid of the same solver (self-convergence); the independent anchors are the spectral reference and the developed limits in the other tests.'}));
});

test('symmetry, degenerate heat inputs and invalid conditions are handled explicitly',()=>{
 const nx=64,ny=32,r=solveGraetzChannel({...air,width:.5,nx,ny,boundary:flux50});
 let sym=0;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)sym=Math.max(sym,Math.abs(r.temperature[j*nx+i]-r.temperature[(ny-1-j)*nx+i]));
 assert.ok(sym<1e-9);
 const zero=solveGraetzChannel({...air,nx,ny,boundary:{type:'wall-heat-flux',wallHeatFlux:0}});
 assert.ok(zero.localNusselt.every(v=>v===null));near(zero.outlet.bulkTemperature,300,1e-9);near(zero.totalWallHeatRateW,0,1e-12);
 const same=solveGraetzChannel({...air,nx,ny,boundary:{type:'wall-temperature',wallTemperature:300}});
 assert.ok(same.localNusselt.every(v=>v===null));near(same.totalWallHeatRateW,0,1e-9);
 const bad=[{...air,nx,ny,boundary:flux50,bulkVelocity:2},{...air,nx,ny,boundary:flux50,bulkVelocity:.05},{...air,nx,ny,boundary:flux50,unknown:1},{...air,nx,ny,boundary:{type:'wall-temperature'}},{...air,nx,ny,boundary:{type:'wall-heat-flux',wallHeatFlux:NaN}},{...air,nx:3,ny,boundary:flux50},{...air,nx,ny,boundary:flux50,inletTemperature:-5},{...air,nx,ny,boundary:flux50,dxGrowth:1.3},{...air,nx,ny,boundary:{type:'other'}}];
 for(const b of bad)assert.throws(()=>solveGraetzChannel(b),Error);
});
