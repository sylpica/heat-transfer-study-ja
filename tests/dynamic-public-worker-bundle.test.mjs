import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';
import {buildPublicWorker} from '../scripts/public-worker-bundle.mjs';
import {createThermal} from '../dynamic/thermal.mjs';
import {preset} from '../dynamic/presets.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const allowed=['worker','worker-runtime','thermal','radial','radiation-network','developed-channel','geometry','properties'].map(name=>'dynamic/'+name+'.mjs');
test('self-contained public worker preserves model snapshots and rejects unregistered CFD',async()=>{
 const output=await mkdtemp(join(tmpdir(),'heat-worker-'));let worker;
 try{
  await mkdir(join(output,'dynamic'));
  const result=await buildPublicWorker({root,output,allowedSources:allowed});
  assert.ok(result.inputs.length>=6);assert.ok(result.inputs.every(path=>allowed.includes(path)));
  const entry=join(output,'dynamic/worker.mjs'),code=await readFile(entry,'utf8');
  assert.doesNotMatch(code,/^\s*import\s/m);assert.doesNotMatch(code,/createCavity/);
  const wrapper=join(output,'runner.mjs');
  await writeFile(wrapper,`import {parentPort} from 'node:worker_threads';globalThis.postMessage=value=>parentPort.postMessage(value);await import(${JSON.stringify(pathToFileURL(entry).href)});parentPort.on('message',data=>globalThis.onmessage({data}));`);
  worker=new Worker(pathToFileURL(wrapper));let id=0;
  const request=(type,fields={})=>new Promise((resolve,reject)=>{
   const token=++id;const listener=value=>{if(value.id===token&&value.type!=='progress'){worker.off('message',listener);worker.off('error',fail);resolve(value);}};
   const fail=error=>{worker.off('message',listener);reject(error);};worker.once('error',fail);worker.on('message',listener);worker.postMessage({id:token,type,...fields});
  });
  const config=preset('heating',8),model=createThermal(config),initial=await request('init',{config});
  assert.equal(initial.type,'ready');assert.deepEqual(initial.snapshot,model.snapshot());
  const duration=.1;while(model.time<duration)model.step(Math.min(model.safeDt,duration-model.time),false);
  const evolved=await request('advance',{duration});assert.equal(evolved.type,'result');assert.deepEqual(evolved.snapshot,model.snapshot());
  const invalid=await request('init',{kind:'cavity',config:{}});assert.equal(invalid.type,'error');assert.match(invalid.message,/未対応/);
 }finally{await worker?.terminate();await rm(output,{recursive:true,force:true});}
});
test('public worker build rejects an unallowlisted dependency before overwriting output',async()=>{
 const output=await mkdtemp(join(tmpdir(),'heat-worker-reject-'));
 try{
  await mkdir(join(output,'dynamic'));const target=join(output,'dynamic/worker.mjs');await writeFile(target,'preserve this output');
  await assert.rejects(buildPublicWorker({root,output,allowedSources:allowed.filter(path=>path!=='dynamic/thermal.mjs')}),/許可外.*thermal/);
  assert.equal(await readFile(target,'utf8'),'preserve this output');
 }finally{await rm(output,{recursive:true,force:true});}
});
