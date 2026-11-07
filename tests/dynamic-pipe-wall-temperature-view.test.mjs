import test from 'node:test';import assert from 'node:assert/strict';import {createWallTemperaturePipe} from '../dynamic/dev/pipe-wall-temperature.mjs';import {wallTemperaturePipeAirConfig} from '../dynamic/dev/pipe-wall-temperature-ui-config.mjs';import {sampleHeatedPipe} from '../dynamic/dev/pipe-wall-temperature-view.mjs';
test('fixed-wall air preset rejects simultaneous imposed flux and preserves the intended circular scope at speed extremes',()=>{
 for(const velocity of [.24,1.5]){const c=wallTemperaturePipeAirConfig({velocity}),s=createWallTemperaturePipe(c).snapshot();assert.ok(s.Pe_D>=100&&s.Re_D<=1000);assert.equal(c.wallTemperature,310);assert.equal(Object.hasOwn(c,'wallHeatFlux'),false);}
 for(const c of [{heatFlux:50},{wallTemperature:0},{wallTemperature:331},{wallTemperature:NaN},{velocity:.12},{grid:16}])assert.throws(()=>wallTemperaturePipeAirConfig(c));
});
test('CWT probes retain actual wall temperature and a zero local heat over a nonzero wall-bulk difference is Nu zero',()=>{
 const c=wallTemperaturePipeAirConfig({wallTemperature:300});c.initial=Array.from({length:c.nx*c.nr},(_,n)=>Math.floor(n/c.nx)===c.nr-1?300:299);const m=createWallTemperaturePipe(c),s=m.snapshot(),before=JSON.stringify(s),p=sampleHeatedPipe(s,m.mesh,[.5,1]);assert.equal(p.wallK,300);assert.ok(p.bulkK<300);assert.equal(s.wallHeatFluxWPerM2[p.i],0);assert.equal(p.wallBulkNu,0);assert.equal(p.nuUndefinedReason,null);assert.ok(p.areaCentroidRadius<m.mesh.radius);assert.equal(JSON.stringify(s),before);
});
