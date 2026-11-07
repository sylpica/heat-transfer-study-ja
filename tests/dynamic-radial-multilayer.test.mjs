import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {createRadialMultilayer} from '../dynamic/dev/radial-multilayer.mjs';import {createRadial} from '../dynamic/radial.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/RADIAL_MULTILAYER_REFERENCE_20261107.json',import.meta.url)));
const advance=(m,end)=>{while(m.time<end)m.step(Math.min(m.safeDt,end-m.time),false);return m.snapshot();};
function toSteady(m){for(let n=0;;n++){for(let i=0;i<500;i++)m.step(m.safeDt,false);const s=m.snapshot(),scale=Math.max(1,Math.abs(s.innerInwardWatts),Math.abs(s.outerInwardWatts));if(Math.abs(s.innerInwardWatts+s.outerInwardWatts)/scale<1e-8)return s;if(n>16000)throw Error('steady state not reached');}}
const steadyConfig=(name,cells)=>{const st=reference.steady[name].config;return {geometry:st.geometry,...(st.length?{length:st.length}:{}),innerRadius:st.radii[0],layers:st.ks.map((k,j)=>({thickness:st.radii[j+1]-st.radii[j],cells,k,rho:100,cp:1000})),...(st.contact.some(v=>v>0)?{contactResistance:st.contact}:{}),initial:(st.innerBC[1]+st.outerBC.at(-1))/2,innerBoundary:{type:'temperature',temperature:st.innerBC[1]},boundary:st.outerBC[0]==='temperature'?{type:'temperature',temperature:st.outerBC[1]}:{type:'convection',h:st.outerBC[1],temperature:st.outerBC[2]}};};
const transientConfig=(cfg,cells)=>({geometry:cfg.geometry,...(cfg.length?{length:cfg.length}:{}),innerRadius:cfg.radii[0],layers:cfg.layers.map((l,j)=>({thickness:cfg.radii[j+1]-cfg.radii[j],cells,...l})),initial:cfg.initialK,innerBoundary:cfg.innerBC[0]==='temperature'?{type:'temperature',temperature:cfg.innerBC[1]}:{type:'insulated'},boundary:cfg.outerBC[0]==='convection'?{type:'convection',h:cfg.outerBC[1],temperature:cfg.outerBC[2]}:{type:'temperature',temperature:cfg.outerBC[1]}});

test('multilayer mesh integrates hollow cylinder and sphere volumes, areas and interfaces exactly',()=>{
 const cyl=createRadialMultilayer({geometry:'cylinder',length:.1,innerRadius:.004,layers:[{thickness:.004,cells:8,k:5,rho:1200,cp:900},{thickness:.004,cells:8,k:.8,rho:800,cp:1200}],initial:300});
 const V=Math.PI*(.012**2-.004**2)*.1;assert.ok(Math.abs(cyl.mesh.volumes.reduce((a,b)=>a+b,0)/V-1)<1e-14);
 assert.ok(Math.abs(cyl.mesh.areas.at(-1)/(2*Math.PI*.012*.1)-1)<1e-14);assert.ok(Math.abs(cyl.mesh.areas[0]/(2*Math.PI*.004*.1)-1)<1e-14);
 assert.equal(cyl.mesh.interfaces.length,1);assert.equal(cyl.mesh.interfaces[0].radius,.008);assert.equal(cyl.mesh.count,16);
 const sph=createRadialMultilayer({geometry:'sphere',innerRadius:.002,layers:[{thickness:.005,cells:5,k:3,rho:1000,cp:1000},{thickness:.005,cells:5,k:1,rho:1000,cp:1000}],initial:300});
 assert.ok(Math.abs(sph.mesh.volumes.reduce((a,b)=>a+b,0)/((4*Math.PI/3)*(.012**3-.002**3))-1)<1e-14);
 const solid=createRadialMultilayer({geometry:'sphere',layers:[{thickness:.01,cells:8,k:10,rho:1000,cp:1000}],initial:300});
 assert.equal(solid.mesh.areas[0],0);assert.equal(solid.flux().outwardWatts[0],0);assert.equal(solid.flux().outwardFlux[0],0);
 assert.equal(solid.releaseApproved,false);assert.equal(solid.snapshot().releaseApproved,false);
});

test('insulated multilayer bodies preserve a uniform field and zero interface jump exactly',()=>{
 for(const geometry of ['sphere','cylinder']){
  const m=createRadialMultilayer({geometry,...(geometry==='cylinder'?{length:.1}:{}),innerRadius:.003,layers:[{thickness:.004,cells:8,k:5,rho:1000,cp:1000},{thickness:.005,cells:8,k:.5,rho:2000,cp:500}],initial:310});
  const s=advance(m,.5);assert.ok(s.temperature.every(t=>t===310));assert.equal(s.energyError,0);
  const f=m.flux();assert.ok(f.outwardWatts.every(q=>q===0));assert.ok(f.interfaces.every(it=>it.temperatureJump===0&&it.leftSurfaceTemperature===310&&it.rightSurfaceTemperature===310));
 }
});

test('per-layer generation proportional to heat capacity raises every layer uniformly with exact accounting',()=>{
 const m=createRadialMultilayer({geometry:'sphere',innerRadius:.002,layers:[{thickness:.004,cells:8,k:5,rho:1000,cp:1000,source:2e5},{thickness:.004,cells:8,k:1,rho:2000,cp:500,source:2e5}],initial:300});
 const s=advance(m,.25);for(const t of s.temperature)assert.ok(Math.abs(t-(300+2e5*.25/1e6))<2e-11);
 const V=m.mesh.volumes.reduce((a,b)=>a+b,0);assert.ok(Math.abs(s.netInput-2e5*V*.25)<1e-9);assert.ok(Math.abs(s.energyError)<1e-8);
});

test('a single solid layer reproduces the existing radial model field, energy and stability limit',()=>{
 for(const geometry of ['sphere','cylinder']){
  const extra=geometry==='cylinder'?{length:.1}:{};
  for(const boundary of [{type:'convection',h:500,temperature:293.15},{type:'temperature',temperature:293.15}]){
   const a=createRadial({geometry,...extra,n:32,radius:.01,k:10,rho:1000,cp:1000,initial:373.15,boundary,source:1e5});
   const b=createRadialMultilayer({geometry,...extra,layers:[{thickness:.01,cells:32,k:10,rho:1000,cp:1000,source:1e5}],initial:373.15,boundary});
   const sa=advance(a,1),sb=advance(b,1);
   assert.ok(Math.max(...sa.temperature.map((t,i)=>Math.abs(t-sb.temperature[i])))<1e-12,geometry);
   assert.ok(Math.abs(sa.energy-sb.energy)<1e-9);assert.ok(Math.abs(a.safeDt/b.safeDt-1)<1e-12);
   assert.ok(Math.abs(sa.outerInwardWatts-sb.outerInwardWatts)<1e-9);
  }
 }
});

test('steady multilayer fields converge at second order to the independent resistance-network solution',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../scripts/dynamic-radial-multilayer-reference.py',import.meta.url))).digest('hex'),reference.generatorSHA256,'regenerate references when the independent generator changes');
 const ref=reference.steady.cylinderThreeLayer,errors=[];
 for(const cells of [8,16,32]){
  const m=createRadialMultilayer(steadyConfig('cylinderThreeLayer',cells)),s=toSteady(m),f=m.flux();
  errors.push(Math.abs(-s.outerInwardWatts/ref.heatRateW-1));
  assert.ok(Math.abs(s.energyError)<1e-6);
  if(cells===32)f.interfaces.forEach((it,j)=>{assert.ok(Math.abs(it.leftSurfaceTemperature-ref.interfaceLeftTemperaturesK[j])<3e-3);assert.ok(Math.abs(it.rightSurfaceTemperature-ref.interfaceRightTemperaturesK[j])<3e-3);});
 }
 assert.ok(errors[0]/errors[1]>3.7&&errors[1]/errors[2]>3.7,JSON.stringify(errors));assert.ok(errors[2]<1e-4);
 // Sphere with an outer convection resistance in the same network.
 const refS=reference.steady.sphereTwoLayerConvection,mS=createRadialMultilayer(steadyConfig('sphereTwoLayerConvection',32)),sS=toSteady(mS);
 assert.ok(Math.abs(-sS.outerInwardWatts/refS.heatRateW-1)<1e-3);
 assert.ok(Math.abs(sS.outerSurfaceTemperature-refS.outerSurfaceTemperatureK)<.01);
 assert.ok(Math.abs(mS.flux().interfaces[0].leftSurfaceTemperature-refS.interfaceLeftTemperaturesK[0])<.01);
 // Contact resistance produces the analytic temperature jump at the interface.
 const refC=reference.steady.cylinderContactResistance,mC=createRadialMultilayer(steadyConfig('cylinderContactResistance',32)),sC=toSteady(mC),itC=mC.flux().interfaces[0];
 assert.ok(Math.abs(-sC.outerInwardWatts/refC.heatRateW-1)<1e-3);
 assert.ok(Math.abs(itC.temperatureJump-(refC.interfaceLeftTemperaturesK[0]-refC.interfaceRightTemperaturesK[0]))<.01);
 assert.ok(itC.temperatureJump>.5,'contact jump is physically resolved, not smeared to zero');
});

test('transient multilayer fields converge to the independent fine-grid implicit reference',()=>{
 for(const [name,caseRef] of Object.entries(reference.transient)){
  const errors=[];
  for(const cells of [8,16,32]){
   const m=createRadialMultilayer(transientConfig(caseRef.config,cells)),s=advance(m,caseRef.config.timeS),refT=caseRef.samples[String(cells)],weights=m.mesh.volumes,total=weights.reduce((a,b)=>a+b,0);
   errors.push(Math.sqrt(s.temperature.reduce((sum,t,i)=>sum+weights[i]*(t-refT[i])**2,0)/total));
   assert.ok(Math.abs(s.energyError)<1e-6,`${name}: energy error ${s.energyError}`);
  }
  assert.ok(errors[0]>errors[1]&&errors[1]>errors[2],`${name}: ${errors}`);
  assert.ok(errors[2]<.02,`${name}: fine-grid RMS ${errors[2]}`);
 }
});

test('interface heat flux agrees from both sides during a transient (section 6.4 item 8)',()=>{
 const cfg=reference.transient.hollowCylinderTwoLayer.config;
 const measure=cells=>{
  const m=createRadialMultilayer(transientConfig(cfg,cells));advance(m,cfg.timeS/2);
  const s=m.snapshot(),f=m.flux(),it=f.interfaces[0],li=m.mesh.layers[0],ri=m.mesh.layers[1],lastL=li.firstCell+li.cells-1,firstR=ri.firstCell;
  const qL=li.k*(-2*s.temperature[lastL]+3*s.temperature[lastL-1]-s.temperature[lastL-2])/li.dr*it.area;
  const qR=ri.k*(2*s.temperature[firstR]-3*s.temperature[firstR+1]+s.temperature[firstR+2])/ri.dr*it.area;
  return {solver:it.outwardWatts,left:Math.abs(qL-it.outwardWatts)/Math.abs(it.outwardWatts),right:Math.abs(qR-it.outwardWatts)/Math.abs(it.outwardWatts),sides:Math.abs(qL-qR)/Math.abs(it.outwardWatts)};
 };
 const coarse=measure(16),fine=measure(32);
 assert.ok(coarse.solver>0);
 assert.ok(fine.left<.02&&fine.right<.02&&fine.sides<.02,JSON.stringify(fine));
 assert.ok(fine.sides<coarse.sides,`${coarse.sides} -> ${fine.sides}`);
});

test('hollow inner heat-flux boundary delivers exactly its area integral at steady state',()=>{
 const A=2*Math.PI*.004*.1,m=createRadialMultilayer({geometry:'cylinder',length:.1,innerRadius:.004,layers:[{thickness:.004,cells:32,k:5,rho:100,cp:1000},{thickness:.004,cells:32,k:.8,rho:100,cp:1000}],initial:320,innerBoundary:{type:'flux',flux:2000},boundary:{type:'temperature',temperature:300}});
 const s=toSteady(m);assert.ok(Math.abs(s.innerInwardWatts-2000*A)<1e-9);assert.ok(Math.abs(s.innerInwardWatts+s.outerInwardWatts)<1e-7);
 const ref=reference.steady.hollowCylinderSteady;
 const m2=createRadialMultilayer(steadyConfig('hollowCylinderSteady',32)),s2=toSteady(m2);
 assert.ok(Math.abs(-s2.outerInwardWatts/ref.heatRateW-1)<1e-3);
 assert.ok(Math.abs(m2.flux().interfaces[0].leftSurfaceTemperature-ref.interfaceLeftTemperaturesK[0])<.01);
});

test('radiation and combined surface exchange cool the outer layer with closed accounting',()=>{
 const rad=createRadialMultilayer({geometry:'sphere',layers:[{thickness:.006,cells:16,k:10,rho:1000,cp:1000},{thickness:.004,cells:16,k:2,rho:1000,cp:1000}],initial:600,boundary:{type:'radiation',emissivity:.8,temperature:300}});
 const rs=advance(rad,.01);assert.ok(rs.outerInwardWatts<0);assert.ok(rs.outerSurfaceTemperature>300&&rs.outerSurfaceTemperature<rs.temperature.at(-1));assert.ok(Math.abs(rs.energyError)<1e-7);
 const both=createRadialMultilayer({geometry:'sphere',layers:[{thickness:.01,cells:16,k:10,rho:1000,cp:1000}],initial:600,boundary:{type:'convection-radiation',h:20,emissivity:.8,temperature:320,radiationTemperature:300}});
 const bs=advance(both,.01);assert.ok(bs.outerInwardWatts<0&&bs.outerSurfaceExchange);assert.ok(Math.abs(bs.energyError)<1e-7);
 const off=createRadialMultilayer({geometry:'sphere',layers:[{thickness:.01,cells:16,k:10,rho:1000,cp:1000}],initial:600,boundary:{type:'convection-radiation',h:0,emissivity:0,temperature:320,radiationTemperature:300}});
 assert.ok(advance(off,1).temperature.every(t=>t===600));
});

test('multilayer invalid inputs, unsafe steps and damaged restores fail atomically, while valid rewind exactly replays',()=>{
 const base={geometry:'sphere',innerRadius:.002,layers:[{thickness:.004,cells:8,k:5,rho:1000,cp:1000},{thickness:.004,cells:8,k:1,rho:1000,cp:1000}],initial:300};
 for(const patch of [{geometry:'disc'},{unknown:1},{layers:[]},{layers:[{thickness:.004,cells:8,k:5,rho:1000,cp:1000,extra:1}]},{layers:[{thickness:0,cells:8,k:5,rho:1000,cp:1000}]},{layers:[{thickness:.004,cells:0,k:5,rho:1000,cp:1000}]},{layers:[{thickness:.004,cells:2.5,k:5,rho:1000,cp:1000}]},{layers:[{thickness:.004,cells:8,k:0,rho:1000,cp:1000}]},{layers:[{thickness:.004,cells:8,k:5,rho:1000,cp:1000}],contactResistance:[-.1]},{layers:base.layers,contactResistance:[0,0]},{innerRadius:-.1},{innerRadius:.002,innerBoundary:{type:'temperature',temperature:300},layers:[{thickness:.01,cells:8,k:5,rho:1000,cp:1000}],innerRadiusOverride:undefined},{initial:[300]},{initial:Array(16).fill('300')},{initial:0},{boundary:{type:'convection',h:-1,temperature:300}},{boundary:{type:'radiation',emissivity:2,temperature:300}},{boundary:{type:'flux',flux:NaN}},{boundary:{type:'convection-radiation',h:1,emissivity:.5,temperature:300}},{boundary:{type:'bogus'}},{approximation:'lumped'}])assert.throws(()=>createRadialMultilayer({...base,...patch}),undefined,JSON.stringify(patch));
 assert.throws(()=>createRadialMultilayer({geometry:'sphere',innerRadius:0,layers:[{thickness:.01,cells:8,k:5,rho:1000,cp:1000}],initial:300,innerBoundary:{type:'temperature',temperature:300}}));
 assert.throws(()=>createRadialMultilayer({geometry:'cylinder',layers:[{thickness:.01,cells:8,k:5,rho:1000,cp:1000}],initial:300}));
 assert.throws(()=>createRadialMultilayer({geometry:'sphere',length:.1,layers:[{thickness:.01,cells:8,k:5,rho:1000,cp:1000}],initial:300}));
 const m=createRadialMultilayer({...base,boundary:{type:'temperature',temperature:400}}),seed=m.snapshot();
 assert.throws(()=>m.step(2*m.safeDt));assert.deepEqual(m.snapshot(),seed);
 m.step(m.safeDt);const accepted=m.snapshot();m.step(m.safeDt);const next=m.snapshot();
 m.restore(accepted);m.step(m.safeDt);assert.deepEqual(m.snapshot(),next);
 for(const edit of [s=>s.signature+='x',s=>s.temperature[0]=NaN,s=>s.time=-1,s=>s.steps=.5,s=>s.netInput=Infinity]){const bad=structuredClone(accepted);edit(bad);assert.throws(()=>m.restore(bad));assert.deepEqual(m.snapshot(),next);}
 m.restore(seed);assert.deepEqual(m.snapshot(),seed);
 const untouched=createRadialMultilayer({...base}),changed=createRadialMultilayer({...base});
 changed.mesh.volumes.fill(0);changed.config.layers[0].k=1e100;untouched.step(untouched.safeDt);changed.step(changed.safeDt);
 assert.deepEqual(changed.snapshot(),untouched.snapshot());assert.deepEqual(changed.flux(),untouched.flux());
});
