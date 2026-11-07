import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {projectFaces} from '../dynamic/dev/cavity.mjs';
const root=new URL('../',import.meta.url),dir=new URL('docs/dynamic/support-forced/',root);
const read=name=>JSON.parse(readFileSync(new URL(name,dir)));
test('support pressure evidence retains actual iterations, independent errors and original source identities',()=>{
 const input=read('PRESSURE_CASES.json'),fresh=read('PRESSURE_PROJECTION_FRESH.json'),independent=read('INDEPENDENT_PRESSURE.json');
 for(const [path,sha]of Object.entries(input.sourceSHA256))assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),sha,path);
 for(const c of fresh.cases){assert.ok(c.outputs.every(r=>r.iterations>0));assert.ok(c.outputs.every(r=>r.maximumPressureError<1e-9));}
 assert.ok(independent.manufactured.every(r=>r.independentOldTimeVersusPcgMaxPa<1e-8));
 assert.ok(independent.manufactured.find(r=>r.n===64&&r.velocityAmplitude===1).returnedPressureRelativeRmsEnd>.06);
 // A new combination: non-unit rectangular dimensions, density and dt;
 // both pressure modes. A p/rho scaling or gauge regression must fail.
 const nx=12,ny=8,dx=.07,dy=.11,rho=997,dt=.003,N=nx*ny;
 const p=Array.from({length:N},(_,n)=>13*Math.cos(Math.PI*((n%nx)+.5)/nx)+7*Math.cos(3*Math.PI*(Math.floor(n/nx)+.5)/ny));
 const u=new Float64Array((nx+1)*ny),v=new Float64Array(nx*(ny+1));
 for(let j=0;j<ny;j++)for(let i=1;i<nx;i++)u[j*(nx+1)+i]=dt/rho*(p[j*nx+i]-p[j*nx+i-1])/dx;
 for(let j=1;j<ny;j++)for(let i=0;i<nx;i++)v[j*nx+i]=dt/rho*(p[j*nx+i]-p[(j-1)*nx+i])/dy;
 const s=projectFaces(u,v,{nx,ny,dx,dy,rho,dt,pressure:Array(N).fill(21),tolerance:1e-12});
 assert.ok(Math.max(...s.pressure.map((x,i)=>Math.abs(x-p[i])))<1e-9);assert.ok(s.iterations>0);assert.ok(s.divergence<1e-10);
 assert.equal(independent.releaseApproved,false);
});
test('support fin-gap evidence preserves the independent continuous limit and the pinned Muse ownership boundary',()=>{
 const d=read('CHANNEL_CASES.json'),v=read('INDEPENDENT_CHANNEL.json'),ref=read('GRAETZ_CONTINUOUS.json');
 assert.equal(d.museSource.readOnly,true);assert.equal(d.museSource.implementationCopiedIntoBranch,false);
 assert.ok(v.pressure.every(r=>r.relativeDifference<1e-12));
 assert.ok(ref.equalWallTemperature.relativeSeriesShootingDifference<1e-9);
 for(const type of ['wall-temperature','wall-heat-flux']){const last=v.graetz.filter(r=>r.boundary===type).at(-1);assert.ok(Math.abs(last.relativeNuDifference)<.001);}
 assert.equal(v.pressureAccuracyApproved,false);assert.equal(v.releaseApproved,false);
 const algebra=read('ALGEBRAIC_PIPE_REFERENCE.json');assert.equal(algebra.empiricalPhysicalUncertaintyApproved,false);
 assert.ok(algebra.cases.every(r=>r.relativeImplementationDifference<1e-12));
 assert.ok(algebra.cases.filter(r=>r.kind==='turbulent').every(r=>r.correlationDifferenceIsNotDiscretizationError));
});
