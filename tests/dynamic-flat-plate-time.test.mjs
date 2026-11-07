import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {createFlatPlateThermal} from '../dynamic/dev/flat-plate-thermal.mjs';
for(const [file,label]of [['FLAT_PLATE_TIME_REFERENCE_20261106_xy512.json','dimensionless'],['FLAT_PLATE_AIR_TIME_REFERENCE_20261106_v1.json','300 K air']]){
const ref=JSON.parse(readFileSync(new URL('../docs/dynamic/'+file,import.meta.url)));
test(`actual passive plate ${label} fields and cumulative heat converge to the separately assembled physical affine exponential`,()=>{
 assert.equal(ref.allChecksPassed,true);for(const [path,sha]of Object.entries(ref.sourceFilesSHA256))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex'),sha,'independent fixture must match the numerical source');
 const errors=[],componentErrors=[];
 for(const factor of [1,.5,.25,.125]){const m=createFlatPlateThermal(ref.config);while(m.time<ref.reference.timeS)m.step(Math.min(m.safeDt*factor,ref.reference.timeS-m.time),false);const s=m.snapshot(),difference=s.offsetTemperature.map((x,i)=>x-ref.reference.temperatureOffsetsK[i]);errors.push(Math.max(...difference.map(Math.abs)));componentErrors.push(Math.max(...ref.reference.cumulativeComponentsJ.map((x,i)=>Math.abs(s.cumulativeComponentJ[i]-x))));assert.ok(Math.abs(s.energyErrorJ)<=s.energyRoundoffBudgetJ);}
 const temperatureOrder=Math.log2(errors.at(-2)/errors.at(-1)),componentOrder=Math.log2(componentErrors.at(-2)/componentErrors.at(-1));assert.ok(errors.at(-1)<.001);assert.ok(temperatureOrder>1.8&&temperatureOrder<2.2);assert.ok(componentOrder>1.8&&componentOrder<2.2);assert.ok(componentErrors.at(-1)<.001*ref.config.rho*ref.config.cp*ref.config.width*ref.config.height*ref.config.depth);
});
}
