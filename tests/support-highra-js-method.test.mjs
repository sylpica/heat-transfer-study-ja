import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {projectFaces} from '../dynamic/dev/cavity.mjs';import {createNeumannMultigrid} from '../dynamic/dev/poisson-multigrid.mjs';
const root=new URL('../',import.meta.url),dir=new URL('docs/dynamic/support-highra-js/',root),sha=b=>createHash('sha256').update(b).digest('hex'),read=n=>JSON.parse(readFileSync(new URL(n,dir)));
test('high-Ra support verifies original multigrid on an actual saved RHS while keeping the original grid gate',()=>{
 const pack=read('PACK.json'),item=pack.cases[0],bytes=readFileSync(new URL(item.file,dir));assert.equal(sha(bytes),item.sha256);
 const p=JSON.parse(gunzipSync(bytes)),q=p.projection,n=p.n,s=projectFaces(q.tentativeU,q.tentativeV,{nx:n,ny:n,dx:1/n,dy:1/n,rho:1,dt:p.dt,tolerance:1e-12,maxIterations:4000,preconditioner:createNeumannMultigrid({nx:n,ny:n,dx:1/n,dy:1/n})});
 assert.ok(s.iterations>0);assert.ok(Math.max(...s.u.map((x,i)=>Math.abs(x-q.expectedU[i])))<1e-8);
 assert.throws(()=>createNeumannMultigrid({nx:192,ny:192,dx:1/192,dy:1/192}));
 for(const [file,h]of Object.entries(read('JS_RESULTS.json').sourceSHA256))assert.equal(sha(readFileSync(new URL(file,root))),h,file);
});
test('high-Ra acceptance keeps successful tails, cold rejection and nonmonotone local extrema distinct',()=>{
 const r=read('JS_RESULTS.json'),w=read('JS_WARM_RESULTS.json'),p=read('ACCEPTANCE_PACK.json');
 for(const c of r.cases){for(const q of c.checkpoints){assert.ok(q.temperatureMaximum<1e-9);assert.ok(q.velocityMaximum<1e-7);assert.ok(q.NuMaximumDifference<1e-7);}assert.equal(sha(readFileSync(new URL(c.actualTailFile,dir))),c.actualTailSHA256);}
 for(const f of r.failureReplays){assert.equal(f.atomic,true);assert.equal(f.acceptedSteps,f.expectedAcceptedSteps);assert.match(f.failure,/Pe/);}
 assert.ok(r.cases.at(-1).checkpoints.at(-1).nu.NuLocalMaximum<17.925);assert.ok(w.cases[0].checkpoints.at(-1).nu.NuLocalMaximum>17.925);
 assert.equal(r.fullJsColdToSteadyVerified,false);assert.equal(p.releaseApproved,false);assert.equal(p.warm128.coldStart,false);
});
