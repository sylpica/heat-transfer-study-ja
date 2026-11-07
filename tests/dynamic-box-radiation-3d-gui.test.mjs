import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createBoxRadiation3D} from '../dynamic/dev/box-radiation-3d.mjs';
import {BOX_FACE_DEFS,BOX_RADIATION_GUI_PRESETS,buildBoxRadiationInput,frameSteps,fmt10} from '../dynamic/dev/box-radiation-3d-ui-config.mjs';
import {boxFaceTilesMarkup,fmtTileFlux,temperatureColor} from '../dynamic/dev/box-radiation-3d-view.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/BOX_RADIATION_3D_REFERENCE_20261107.json',import.meta.url)));
const relNear=(a,b,tol=1e-11)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b} (rel tol ${tol})`);

test('screen builder passes exactly the keys the connector accepts, with no integration key for auto',()=>{
 const input=buildBoxRadiationInput(structuredClone(BOX_RADIATION_GUI_PRESETS.gray));
 assert.deepEqual(Object.keys(input).sort(),['dimensions','faces','maxTemperature']);
 assert.deepEqual(input.dimensions,{x:2,y:1,z:3});assert.equal(input.maxTemperature,700);
 assert.deepEqual(input.faces,[600,300,400,350,500,450].map((temperature,i)=>({temperature,emissivity:[.8,.6,.9,.5,.7,1][i],capacity:2e5})));
 const explicit=buildBoxRadiationInput({...structuredClone(BOX_RADIATION_GUI_PRESETS.gray),resolutionKey:'mid'});
 assert.deepEqual(explicit.integration,{separationPanels:20,polarPanels:32,gaussOrder:7});
});

test('gray preset reproduces the verified reference case through the screen builder',()=>{
 const row=reference.cases.find(r=>r.id==='gray-box-2-1-3');
 const s=createBoxRadiation3D(buildBoxRadiationInput(structuredClone(BOX_RADIATION_GUI_PRESETS.gray))).snapshot();
 s.outwardPower.forEach((v,i)=>relNear(v,row.outwardPowerW[i]));
 s.faceOutwardFlux.forEach((v,i)=>relNear(v,row.outwardPowerW[i]/row.areas[i]));
 assert.ok(Math.abs(s.radiationBalance)<=1e-9);
});

test('isothermal blackbody preset exchanges exactly nothing',()=>{
 const s=createBoxRadiation3D(buildBoxRadiationInput(structuredClone(BOX_RADIATION_GUI_PRESETS.iso))).snapshot();
 s.outwardPower.forEach(v=>assert.ok(Math.abs(v)<=1e-12));s.faceOutwardFlux.forEach(v=>assert.ok(Math.abs(v)<=1e-12));
 assert.equal(s.radiationBalance,0);
});

test('flat preset is admitted by escalation under auto and refused verbatim under an explicit low resolution',()=>{
 const auto=createBoxRadiation3D(buildBoxRadiationInput(structuredClone(BOX_RADIATION_GUI_PRESETS.flat)));
 assert.equal(auto.geometry.diagnostics.networkAdmission.resolutionEscalated,true);
 assert.throws(()=>createBoxRadiation3D(buildBoxRadiationInput({...structuredClone(BOX_RADIATION_GUI_PRESETS.flat),resolutionKey:'low'})),/受入精度（1e-12）まで解像できません/);
 const max=createBoxRadiation3D(buildBoxRadiationInput({...structuredClone(BOX_RADIATION_GUI_PRESETS.flat),resolutionKey:'max'}));
 assert.equal(max.geometry.diagnostics.networkAdmission.resolutionEscalated,false);
});

test('face input kinds map to exactly one of power / heatFlux and the two are equivalent on a unit face',()=>{
 const values=structuredClone(BOX_RADIATION_GUI_PRESETS.iso);
 values.faces[0]={temperature:500,emissivity:.8,capacity:2e5,inputKind:'power',inputValue:100};
 for(let i=1;i<6;i++)values.faces[i]={temperature:300,emissivity:.8,capacity:2e5,inputKind:'none',inputValue:0};
 const asPower=buildBoxRadiationInput(values);
 assert.deepEqual(Object.keys(asPower.faces[0]).sort(),['capacity','emissivity','power','temperature']);
 values.faces[0].inputKind='heatFlux';
 const asFlux=buildBoxRadiationInput(values);
 assert.deepEqual(Object.keys(asFlux.faces[0]).sort(),['capacity','emissivity','heatFlux','temperature']);
 const a=createBoxRadiation3D(asPower),b=createBoxRadiation3D(asFlux);
 a.step(10);b.step(10);assert.deepEqual(a.snapshot(),b.snapshot());
});

test('builder refuses non-numeric values, unknown resolutions and unknown input kinds at the screen layer',()=>{
 const gray=()=>structuredClone(BOX_RADIATION_GUI_PRESETS.gray);
 const badTemp=gray();badTemp.faces[2].temperature=NaN;assert.throws(()=>buildBoxRadiationInput(badTemp),/数値でない項目があります（前面の温度）/);
 const badDim=gray();badDim.dimensions.z=undefined;assert.throws(()=>buildBoxRadiationInput(badDim),/数値でない項目があります（z寸法）/);
 assert.throws(()=>buildBoxRadiationInput({...gray(),resolutionKey:'ultra'}),/積分解像度の指定が不正です/);
 const badKind=gray();badKind.faces[0].inputKind='both';assert.throws(()=>buildBoxRadiationInput(badKind),/外部入力の種類が不正です/);
});

test('frame subdivision never exceeds safeDt and covers the frame exactly',()=>{
 for(const [duration,safeDt] of [[60,85.69251574389824],[10,22.04],[342.65,3.7],[0.001,0.5]]){
  const {count,dt}=frameSteps(duration,safeDt);
  assert.ok(dt<=safeDt*(1+1e-12),`${dt} <= ${safeDt}`);assert.ok(Math.abs(count*dt-duration)<=1e-9*duration);
 }
 assert.throws(()=>frameSteps(0,1),/正の数で指定してください/);
 assert.throws(()=>frameSteps(-5,1),/正の数で指定してください/);
 assert.throws(()=>frameSteps(1e9,1e-6),/細分が10万回を超えます/);
});

test('face tiles show every face with the connector values, coloured by temperature',()=>{
 const m=createBoxRadiation3D(buildBoxRadiationInput(structuredClone(BOX_RADIATION_GUI_PRESETS.gray))),s=m.snapshot();
 const markup=boxFaceTilesMarkup({snapshot:s,areas:m.geometry.areas,range:[300,600]});
 for(const [i,def] of BOX_FACE_DEFS.entries()){
  assert.ok(markup.includes(`${def.name}（${def.id}、${def.note}）`),def.id);
  assert.ok(markup.includes(`T = ${fmt10(s.temperature[i])} K`),def.id);
  assert.ok(markup.includes(`q″ = ${fmtTileFlux(s.faceOutwardFlux[i])} W/m²`),def.id);
  assert.ok(markup.includes(`A = ${fmt10(m.geometry.areas[i])} m²`),def.id);
 }
 assert.notEqual(temperatureColor(600,300,600),temperatureColor(300,300,600));
});
