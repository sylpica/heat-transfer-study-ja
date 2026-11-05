import test from 'node:test';import assert from 'node:assert/strict';import {finFaces,finViewScale,rotatePoint} from '../dynamic/fin-view.mjs';
test('common fin scale preserves the length ratio and equal cross sections instead of fitting each fin independently',()=>{
 const reference={width:.1,height:.01,depth:.01},scale=finViewScale(reference,{widthPx:640,heightPx:320,yaw:0,pitch:0});assert.equal(scale,4800);assert.equal(.1*scale,480);assert.equal(.05*scale,240);assert.equal(.01*scale,48);
 for(const [yaw,pitch]of [[.5,.4],[-.7,.2],[1.2,-.5]]){const s=finViewScale(reference,{widthPx:640,heightPx:320,yaw,pitch}),long=rotatePoint([.1,0,0],yaw,pitch),short=rotatePoint([.05,0,0],yaw,pitch);assert.ok(Math.abs(Math.hypot(long[0],long[1])*s/(Math.hypot(short[0],short[1])*s)-2)<1e-14);}
 assert.throws(()=>finViewScale(reference,{widthPx:0,heightPx:320,yaw:0,pitch:0}));assert.throws(()=>finViewScale(reference,{widthPx:640,heightPx:320,yaw:NaN,pitch:0}));
});
test('a prescribed base face keeps its actual temperature while side cells and the adiabatic tip retain their solved values',()=>{
 const values=[293.15,303.15,313.15],before=[...values],faces=finFaces(values,{width:.1,height:.01,depth:.01},.5,.4,{baseTemperature:353.15});assert.deepEqual(values,before);assert.equal(faces.filter(f=>f.kind==='base').length,1);assert.equal(faces.find(f=>f.kind==='base').temperature,353.15);assert.equal(faces.find(f=>f.kind==='tip').temperature,313.15);assert.deepEqual(new Set(faces.filter(f=>f.kind==='side').map(f=>f.temperature)),new Set(values));assert.throws(()=>finFaces(values,{width:.1,height:.01,depth:.01},.5,.4,{baseTemperature:0}));
});
