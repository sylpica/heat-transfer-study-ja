import test from 'node:test';import assert from 'node:assert/strict';import {createHeatedPipe} from '../dynamic/dev/heated-pipe.mjs';import {heatedPipeAirConfig} from '../dynamic/dev/heated-pipe-ui-config.mjs';import {sampleHeatedPipe,heatedPipeLayout} from '../dynamic/dev/heated-pipe-view.mjs';
test('air pipe preset bounds satisfy both Pe and Re while unknown or out-of-range physics is rejected',()=>{
 for(const velocity of [.24,.5,1.5]){const s=createHeatedPipe(heatedPipeAirConfig({velocity})).snapshot();assert.ok(s.Pe_D>=100&&s.Re_D<=1000);assert.ok(Math.abs(s.Pr-.706400625)<2*Number.EPSILON);}
 for(const c of [{velocity:.12},{velocity:2},{heatFlux:101},{inletTemperature:0},{grid:16},{depth:.01},{grid:'32'},{velocity:NaN}])assert.throws(()=>heatedPipeAirConfig(c));
});
test('pipe probing separates chosen radius from annular area centroid and is read-only including the axis and wall',()=>{
 const m=createHeatedPipe(heatedPipeAirConfig({heatFlux:0})),s=m.snapshot(),before=JSON.stringify({s,mesh:m.mesh});
 const a=sampleHeatedPipe(s,m.mesh,[0,0]),b=sampleHeatedPipe(s,m.mesh,[1,1]);assert.equal(a.selectedRadius,0);assert.ok(a.areaCentroidRadius>0&&a.areaCentroidRadius<a.outerRadius);assert.equal(b.selectedRadius,m.mesh.radius);assert.ok(b.areaCentroidRadius<m.mesh.radius);assert.equal(b.i,m.mesh.nx-1);assert.equal(b.j,m.mesh.nr-1);assert.equal(b.wallBulkNu,null);assert.equal(b.nuUndefinedReason,'zero-wall-flux');assert.equal(b.velocity,m.mesh.rowAreaMeanVelocityMPerS.at(-1));assert.equal(JSON.stringify({s,mesh:m.mesh}),before);for(const p of [[0,-1],[NaN,0],[1,2]])assert.throws(()=>sampleHeatedPipe(s,m.mesh,p));
});
test('radial half-section reports its vertical enlargement and uses circle radius rather than full diameter',()=>{
 const m=createHeatedPipe(heatedPipeAirConfig()).mesh,p=heatedPipeLayout(m,800);assert.ok(p.verticalExaggeration>1);assert.ok(Math.abs(p.height/p.verticalExaggeration/p.width-m.radius/m.width)<1e-15);assert.equal(p.base,p.top+p.height);
});
