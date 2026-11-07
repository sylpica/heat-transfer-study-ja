import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {buildBoundary,buildMultilayerConfig,MULTILAYER_PRESETS} from '../dynamic/dev/radial-multilayer-ui-config.mjs';
import {createRadialMultilayer} from '../dynamic/dev/radial-multilayer.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/RADIAL_MULTILAYER_REFERENCE_20261107.json',import.meta.url)));
const toSteady=m=>{for(let n=0;;n++){for(let i=0;i<500;i++)m.step(m.safeDt,false);const s=m.snapshot(),scale=Math.max(1,Math.abs(s.innerInwardWatts),Math.abs(s.outerInwardWatts));if(Math.abs(s.innerInwardWatts+s.outerInwardWatts)/scale<1e-8)return s;if(n>16000)throw Error('steady state not reached');}};

test('multilayer GUI config builder converts mm form values into the core config (SI units)',()=>{
 const config=buildMultilayerConfig(structuredClone(MULTILAYER_PRESETS.contact.values));
 assert.equal(config.geometry,'cylinder');assert.equal(config.length,0.1);assert.equal(config.innerRadius,0.003);
 assert.deepEqual(config.layers.map(l=>l.thickness),[0.003,0.004]);
 assert.deepEqual(config.layers.map(l=>l.k),[8,2]);
 assert.deepEqual(config.contactResistance,[0.005]);
 assert.deepEqual(config.boundary,{type:'temperature',temperature:310});
 assert.deepEqual(config.innerBoundary,{type:'temperature',temperature:390});
 const sphere=buildMultilayerConfig(structuredClone(MULTILAYER_PRESETS.sphereConvection.values));
 assert.equal('length' in sphere,false,'sphere config must not carry a cylinder length');
 assert.deepEqual(sphere.boundary,{type:'convection',h:100,temperature:290});
});

test('multilayer GUI boundary builder forwards only the fields of the chosen type',()=>{
 assert.deepEqual(buildBoundary({type:'insulated',temperature:999,h:5},'外面'),{type:'insulated'});
 assert.deepEqual(buildBoundary({type:'convection',h:50,temperature:290,flux:123},'外面'),{type:'convection',h:50,temperature:290});
 assert.deepEqual(buildBoundary({type:'convection-radiation',h:20,emissivity:.8,temperature:320,radiationTemperature:300},'外面'),{type:'convection-radiation',h:20,emissivity:.8,temperature:320,radiationTemperature:300});
 assert.throws(()=>buildBoundary({type:'convection',h:NaN,temperature:290},'外面'),/外面境界条件の入力に数値でない項目があります。/);
 assert.throws(()=>buildBoundary({type:'bogus'},'内面'),/内面境界条件の種類が不正です。/);
});

test('multilayer GUI builder rejects non-numeric layer input before the core sees it',()=>{
 const values=structuredClone(MULTILAYER_PRESETS.contact.values);values.layers[1].k=NaN;
 assert.throws(()=>buildMultilayerConfig(values),/第2層の入力に数値でない項目があります。/);
 const bad=structuredClone(MULTILAYER_PRESETS.contact.values);bad.initialK=undefined;
 assert.throws(()=>buildMultilayerConfig(bad),/入力に数値でない項目があります。/);
});

test('every multilayer GUI preset is accepted by the core and builds a finite mesh',()=>{
 for(const [name,preset] of Object.entries(MULTILAYER_PRESETS)){
  const model=createRadialMultilayer(buildMultilayerConfig(structuredClone(preset.values)));
  assert.ok(model.mesh.count>=4&&model.mesh.count<=1024,name);
  assert.ok(model.safeDt>0&&Number.isFinite(model.safeDt),name);
  const s=model.snapshot();assert.ok(s.temperature.every(Number.isFinite),name);
 }
});

test('contact preset built through the GUI layer reproduces the analytic 56.7188 K jump and heat rate',()=>{
 const model=createRadialMultilayer(buildMultilayerConfig(structuredClone(MULTILAYER_PRESETS.contact.values)));
 const s=toSteady(model),it=model.flux().interfaces[0],ref=reference.steady.cylinderContactResistance;
 assert.ok(Math.abs(it.temperatureJump-(ref.interfaceLeftTemperaturesK[0]-ref.interfaceRightTemperaturesK[0]))<.01,`jump ${it.temperatureJump}`);
 assert.ok(Math.abs(it.temperatureJump-56.7188)<.01,`jump ${it.temperatureJump} vs 56.7188`);
 assert.ok(Math.abs(it.leftSurfaceTemperature-ref.interfaceLeftTemperaturesK[0])<.01);
 assert.ok(Math.abs(it.rightSurfaceTemperature-ref.interfaceRightTemperaturesK[0])<.01);
 assert.ok(Math.abs(-s.outerInwardWatts-ref.heatRateW)<.05,`Q ${-s.outerInwardWatts} vs ${ref.heatRateW}`);
});

test('sphere convection preset built through the GUI layer matches the resistance-network reference',()=>{
 const model=createRadialMultilayer(buildMultilayerConfig(structuredClone(MULTILAYER_PRESETS.sphereConvection.values)));
 const s=toSteady(model),ref=reference.steady.sphereTwoLayerConvection;
 assert.ok(Math.abs(-s.outerInwardWatts-ref.heatRateW)/ref.heatRateW<1e-3);
 assert.ok(Math.abs(s.outerSurfaceTemperature-ref.outerSurfaceTemperatureK)<.01);
 assert.ok(Math.abs(model.flux().interfaces[0].leftSurfaceTemperature-ref.interfaceLeftTemperaturesK[0])<.01);
});
