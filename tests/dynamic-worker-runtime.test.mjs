import test from 'node:test';import assert from 'node:assert/strict';
import {installWorkerRuntime} from '../dynamic/worker-runtime.mjs';
import {createCavity} from '../dynamic/dev/cavity.mjs';
const config={nx:8,ny:8,width:1,height:1,rho:1,cp:1,nu:.1,alpha:.1,initial:300,lidVelocity:1,pressurePreconditioner:'multigrid'};
function harness(){const messages=[],scope={postMessage:data=>messages.push(structuredClone(data))};installWorkerRuntime(data=>{if(data.kind!=='cavity')throw Error('unknown model');return createCavity(data.config);},scope);return {scope,messages,send:async(id,type,values={})=>{await scope.onmessage({data:{id,type,...values}});return messages.findLast(m=>m.id===id&&m.type!=='progress');}};}
test('shared runtime keeps the accepted model when another initialization fails and rolls back a failed advance',async()=>{
 const h=harness(),ready=await h.send(1,'init',{kind:'cavity',config}),state=ready.snapshot;
 assert.equal((await h.send(2,'init',{kind:'unknown',config})).type,'error');
 const stepped=await h.send(3,'advance',{duration:.01});assert.equal(stepped.type,'result');assert.ok(stepped.snapshot.u.some(x=>x!==0));
 assert.equal((await h.send(4,'advance',{duration:.01,dt:1000})).type,'error');
 const again=await h.send(5,'advance',{duration:.01}),control=createCavity(config);control.step(.01,false);control.step(.01,false);assert.deepEqual(again.snapshot,control.snapshot());
 assert.equal((await h.send(6,'restore',{snapshot:{...state,signature:'other'}})).type,'error');
 assert.deepEqual((await h.send(7,'restore',{snapshot:state})).snapshot,state);
});
test('a real CFD calculation cancelled during progress restores its entire pre-request state',async()=>{
 const h=harness(),initial=(await h.send(1,'init',{kind:'cavity',config})).snapshot,original=h.scope.postMessage;
 h.scope.postMessage=data=>{original(data);if(data.type==='progress')h.scope.onmessage({data:{id:3,type:'cancel'}});};
 const completed=await h.send(2,'advance',{duration:10});assert.equal(completed,undefined);assert.equal(h.messages.find(m=>m.id===3).type,'cancelled');
 h.scope.postMessage=original;const actual=(await h.send(4,'advance',{duration:.01})).snapshot,control=createCavity(config);control.restore(initial);control.step(.01);assert.deepEqual(actual,control.snapshot());
});
