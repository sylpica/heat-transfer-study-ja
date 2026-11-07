import test from 'node:test';import assert from 'node:assert/strict';import {createLongDuctRadiation} from '../dynamic/dev/long-duct-radiation.mjs';import {longDuctDiagram} from '../dynamic/dev/long-duct-view.mjs';
const model=()=>createLongDuctRadiation({outline:[[0,0],[1,0],[1,2.4],[0,2.4]],walls:[600,300,300,300].map(temperature=>({temperature,emissivity:.8,capacityPerLength:500})),maxTemperature:700});
test('actual radiation pair signs set diagram arrows, while solved temperatures and a common physical scale remain explicit',()=>{
 const m=model(),geometry=m.geometry,state=m.snapshot(),before=structuredClone({geometry,state}),r=longDuctDiagram({geometry,state,selectedWall:0,idPrefix:'a',width:350});assert.equal(r.arrows.length,3);assert.ok(r.arrows.every(a=>a.from===0));for(const a of r.arrows)assert.equal(a.absolutePowerW,state.pairPower[a.from][a.to]);assert.match(r.markup,/壁1 326.9℃/);assert.match(r.markup,/端面は含みません/);assert.equal((r.markup.match(/data-wall=/g)||[]).length,4);assert.ok(!r.markup.includes('NaN')&&!r.markup.includes('Infinity'));
 const selectedCold=longDuctDiagram({geometry,state,selectedWall:1,idPrefix:'b',width:350});assert.equal(selectedCold.arrows.find(a=>a.from===0).to,1);assert.equal(selectedCold.pixelsPerMetre,r.pixelsPerMetre);assert.deepEqual({geometry,state},before);
 const enlarged=longDuctDiagram({geometry,state,selectedWall:0,width:800,bounds:[0,0,2,4.8]});assert.equal(enlarged.pixelsPerMetre,Math.min((800-130)/2,(320-100)/4.8));
});
test('invalid or clipped fields/ranges/labels cannot become a fake finite radiation picture',()=>{
 const m=model(),geometry=m.geometry,state=m.snapshot(),base={geometry,state};for(const change of [{width:0},{selectedWall:99},{idPrefix:'" onclick="x'},{range:[300,500]},{bounds:[0,0,.5,2.4]},{state:{...state,temperature:[NaN,300,300,300]}},{state:{...state,pairPower:[]}}])assert.throws(()=>longDuctDiagram({...base,...change}));
 const invalid=structuredClone(geometry);invalid.inwardNormals[0]=[NaN,0];assert.throws(()=>longDuctDiagram({geometry:invalid,state}));
});

test('roundoff-size pair exchange is omitted only from arrows, without changing the solved numeric state',()=>{
 const m=createLongDuctRadiation({outline:[[0,0],[1,0],[.5,Math.sqrt(3)/2]],walls:[600,300,300].map(temperature=>({temperature,emissivity:.8,capacityPerLength:500})),maxTemperature:700}),geometry=m.geometry,state=m.snapshot();state.pairPower[1][2]=1e-13;state.pairPower[2][1]=-1e-13;const before=structuredClone(state),r=longDuctDiagram({geometry,state,selectedWall:1});assert.equal(r.arrows.length,1);assert.equal(r.arrows[0].from,0);assert.equal(r.arrows[0].to,1);assert.equal(r.omittedRoundoffArrowCount,1);assert.ok(r.arrowNumericalDisplayThresholdW>1e-13);assert.deepEqual(state,before);assert.equal(state.pairPower[1][2],1e-13);
});
