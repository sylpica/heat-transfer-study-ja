import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createLongDuctViewFactors,createLongDuctRadiation} from '../dynamic/dev/long-duct-radiation.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/LONG_DUCT_RADIATION_REFERENCE_20261106.json',import.meta.url))),square=[[0,0],[1,0],[1,1],[0,1]],near=(a,b,tol=2e-12)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const config=()=>({outline:square,span:1,walls:[600,300,400,500].map(temperature=>({temperature,emissivity:.8,capacityPerLength:500})),maxTemperature:700});
function check(g){for(let i=0;i<g.viewFactors.length;i++){near(g.viewFactors[i].reduce((s,v)=>s+v,0),1);assert.equal(g.viewFactors[i][i],0);for(let j=0;j<g.viewFactors.length;j++){assert.ok(g.viewFactors[i][j]>=0&&g.viewFactors[i][j]<=1);near(g.areas[i]*g.viewFactors[i][j],g.areas[j]*g.viewFactors[j][i]);}}assert.equal(g.diagnostics.renormalized,false);assert.equal(g.diagnostics.clipped,false);assert.equal(g.scope.finiteLengthEndEffects,false);assert.equal(g.releaseApproved,false);}

test('convex long-duct factors agree with independent angular-kernel quadrature, high precision strings and the provided parallel-strip case',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-long-duct-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256);assert.equal(reference.releaseApproved,false);
 for(const row of reference.geometryCases){const g=createLongDuctViewFactors({outline:row.outline});check(g);assert.ok(row.integralRefinementMaxDifference<2e-11);assert.ok(row.integralVsStringsMaxDifference<2e-11);g.viewFactors.forEach((values,i)=>values.forEach((v,j)=>near(v,row.viewFactors[i][j])));}
 const g=createLongDuctViewFactors({outline:square});near(g.viewFactors[0][2],Math.SQRT2-1);near(g.viewFactors[0][1],1-Math.SQRT1_2);
 const supplied=reference.geometryCases.find(row=>row.id==='provided-T5-01');near(createLongDuctViewFactors({outline:supplied.outline}).viewFactors[0][2],reference.providedCases['T5-01'].printedViewFactor);
});

test('factor invariance under rigid motion, scale, span and input orientation preserves wall order without changing caller geometry',()=>{
 const original=reference.geometryCases.find(row=>row.id==='regular-pentagon').outline,before=structuredClone(original),base=createLongDuctViewFactors({outline:original});
 for(const scale of [.001,1,1000])for(const span of [.125,8]){
  const c=Math.cos(.43),s=Math.sin(.43),outline=original.map(([x,y])=>[scale*(3.75+c*x-s*y),scale*(-2.125+s*x+c*y)]),g=createLongDuctViewFactors({outline,span});
  for(let i=0;i<g.lengths.length;i++){near(g.lengths[i]/scale,base.lengths[i]);near(g.areas[i]/(scale*span),base.lengths[i]);for(let j=0;j<g.lengths.length;j++)near(g.viewFactors[i][j],base.viewFactors[i][j]);}
 }
 const clockwise=createLongDuctViewFactors({outline:original.toReversed()}),n=original.length;assert.equal(clockwise.orientation,'clockwise');for(let i=0;i<n;i++)for(let j=0;j<n;j++)near(clockwise.viewFactors[i][j],base.viewFactors[(n-2-i+n)%n][(n-2-j+n)%n]);
 const closed=createLongDuctViewFactors({outline:[...original,original[0]]});assert.equal(closed.repaired.length,1);assert.deepEqual(closed.viewFactors,base.viewFactors);assert.deepEqual(original,before);
});

test('provided Example10.9 initial pair exchange matches the independently evaluated nodal system while its printed arithmetic discrepancy remains recorded',()=>{
 const row=reference.geometryCases.find(r=>r.id==='provided-T5-01'),m=createLongDuctRadiation({outline:row.outline,walls:[{temperature:400,emissivity:.3},{temperature:250,emissivity:1},{temperature:300,emissivity:.5},{temperature:250,emissivity:1}].map(w=>({...w,capacityPerLength:500})),maxTemperature:500}),s=m.snapshot(),record=reference.providedCases['T5-08-Example10.9a'];
 near(s.pairPower[0][2],record.modernFormulaPairPowerWPerM,1e-10);near(s.radiosity[0],record.modernNodalRadiositiesWPerM2[0],1e-10);near(s.radiosity[2],record.modernNodalRadiositiesWPerM2[1],1e-10);assert.equal(record.primaryPrintedPairPowerWPerM,46.53);assert.equal(record.providedRoundedPairPowerWPerM,46.5);assert.ok(Math.abs(s.pairPower[0][2]-record.primaryPrintedPairPowerWPerM)>.09);assert.ok(Math.max(...record.primaryPrintedRadiosityResidualAgainstPrintedSystemWPerM2.map(Math.abs))>.5);assert.ok(Math.abs(s.outwardPower[0]-s.pairPower[0][2])>100);near(s.radiationBalance,0,1e-10);
});

test('actual finite-capacity gray duct has second-order time convergence to an independently reduced scalar transient and conserves total heat',t=>{
 const r=reference.transient,results=[];assert.ok(r.referenceToleranceRefinementMaxDifferenceK<1e-8);
 for(const dt of [.5,.25,.125]){
  const m=createLongDuctRadiation({outline:r.outline,walls:r.initialK.map(temperature=>({temperature,emissivity:r.emissivity,capacityPerLength:r.capacityPerLengthJPerMK})),maxTemperature:r.maxTemperatureK});assert.ok(dt<=m.safeDt);
  for(let i=0;i<8/dt;i++){const s=m.step(dt);near(s.temperature[1],s.temperature[2],1e-10);assert.ok(s.temperature.every(v=>v>=300&&v<=600));near(s.radiationBalance,0,1e-9);assert.ok(Math.abs(s.energyError)<1e-7);}
  const s=m.snapshot(),error=Math.max(...s.temperature.map((v,i)=>Math.abs(v-(i?r.eachColdWallTemperatureK.at(-1):r.hotWallTemperatureK.at(-1)))));results.push({dt,temperature:s.temperature,errorK:error,energyErrorJ:s.energyError});
 }
 const orders=results.slice(1).map((r,i)=>Math.log2(results[i].errorK/r.errorK));t.diagnostic(JSON.stringify({results,observedHeunOrders:orders}));assert.ok(orders.every(p=>p>1.9&&p<2.2));assert.ok(results.at(-1).errorK<.0005);
});

test('accounting span scales powers, capacities and work without introducing end-wall cooling, and valid rewind/resume is exact',()=>{
 const models=[.125,1,8].map(span=>createLongDuctRadiation({...config(),span,walls:config().walls.map((w,i)=>({...w,powerPerLength:i===0?40:0}))})),history=[];
 for(let i=0;i<8;i++){for(const m of models)m.step(.25);history.push(models[1].snapshot());}
 const middle=models[1].snapshot();for(let j=0;j<models.length;j++){const s=models[j].snapshot(),span=models[j].geometry.span;s.temperature.forEach((v,i)=>near(v,middle.temperature[i],1e-10));s.wallOutwardPowerPerLength.forEach((v,i)=>near(v,middle.wallOutwardPowerPerLength[i],1e-10));near(s.netInput,80*span);assert.ok(Math.abs(s.energyError)<1e-7);}
 const m=models[1];m.restore(history[2]);for(let i=3;i<8;i++)m.step(.25);assert.deepEqual(m.snapshot(),middle);
 const geometry=m.geometry;geometry.viewFactors[0][1]=999;const c=m.config;c.walls[0].temperature=1;assert.deepEqual(m.snapshot(),middle);assert.notEqual(m.geometry.viewFactors[0][1],999);
});

test('invalid geometry/physics and corrupt clock/input/energy restoration fail atomically and leave caller data intact',()=>{
 const c=config(),before=structuredClone(c),invalid=[{},null,{outline:[]},{outline:[[0,0],[1,0],[2,0]]},{outline:[[0,0],[1,0],[.5,.5],[1,1],[0,1]]},{outline:[[0,0],[1,1],[0,1],[1,0]]},{outline:[[0,0],[1,0],[1,0],[0,1]]},{outline:[[0,0],[Infinity,0],[0,1]]},{outline:square,span:0},{outline:square,finiteLength:true}];
 for(const v of invalid)assert.throws(()=>createLongDuctViewFactors(v));
 for(const v of [{...c,walls:[]},{...c,maxTemperature:500},{...c,walls:c.walls.map(w=>({...w,emissivity:0}))},{...c,walls:c.walls.map(w=>({...w,temperature:0}))},{...c,walls:c.walls.map(w=>({...w,emissivity:1.1}))},{...c,walls:c.walls.map(w=>({...w,capacityPerLength:0}))},{...c,span:Number.MAX_VALUE}])assert.throws(()=>createLongDuctRadiation(v));
 const m=createLongDuctRadiation(c);m.step(.25);const state=m.snapshot();
 for(const dt of [0,-1,NaN,Infinity,m.safeDt*2]){assert.throws(()=>m.step(dt));assert.deepEqual(m.snapshot(),state);}
 for(const v of [{...state,time:NaN},{...state,time:-1},{...state,time:1000},{...state,steps:0},{...state,lastDt:m.safeDt*2},{...state,netInput:1},{...state,temperature:state.temperature.map(v=>v+1)},{...state,temperature:[NaN,300,300,300]}]){assert.throws(()=>m.restore(v));assert.deepEqual(m.snapshot(),state);}
 assert.deepEqual(c,before);assert.equal(state.scope.arbitrary3D,false);assert.equal(state.releaseApproved,false);
});

test('rationalized adjacent strings resolve short-wall factors without row renormalization, while unrepresentable reciprocal products reject',()=>{
 for(const width of [1e-6,1e-12,1e-100]){const g=createLongDuctViewFactors({outline:[[0,0],[width,0],[width,1],[0,1]]});check(g);near(g.viewFactors[0][2]/(width/(Math.sqrt(1+width*width)+1)),1,3e-12);}
 assert.throws(()=>createLongDuctViewFactors({outline:[[0,0],[1e-200,0],[1e-200,1],[0,1]]}),/数値|解像|丸め|総和/);
});
