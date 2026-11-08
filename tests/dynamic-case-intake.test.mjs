import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {dynamicLinkForQuestion,thermalLaunchFromSearch,caseLaunchFromSearch} from '../dynamic-navigation.mjs';import {questionFingerprint} from '../study-core.mjs';import {createLumpedRadial} from '../dynamic/lumped-radial.mjs';import {createRadiationNetwork} from '../dynamic/radiation-network.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url))),all=read('data/questions.json');
const SIGMA=5.670374419e-8;
const newCases={'supp-transient-gap-sphere-lumped-length-v1':['radial.html','sphere-lumped-v1'],'supp-gray-parallel-flux-v1':['radiation.html','gray-parallel-v1'],'supp-batch2-blackbody-two-surfaces-v1':['radiation.html','blackbody-two-v1']};
test('the whole bank offers exactly eight case handoffs: five thermal, one radial, two radiation, none channel',()=>{
 const links=all.map(q=>dynamicLinkForQuestion(q,questionFingerprint(q))).filter(Boolean);
 assert.equal(links.length,8);const byPage={};for(const link of links){const page=link.href.split('?')[0].split('/').at(-1);byPage[page]=(byPage[page]||0)+1;}
 assert.deepEqual(byPage,{'index.html':5,'radial.html':1,'radiation.html':2});
});
test('new question cases are fingerprint-gated and link to their own lab page',()=>{
 for(const [qid,[page,caseId]] of Object.entries(newCases)){
  const q=all.find(x=>x.id===qid);assert.ok(q,`${qid} exists in the bank`);
  const link=dynamicLinkForQuestion(q,questionFingerprint(q));assert.ok(link,`${qid} link offered`);assert.equal(link.href,`./dynamic/${page}?case=${caseId}`);
  for(const patch of [{revision:'v2'},{prompt:q.prompt+' changed'},{answer:(q.answer+1)%q.choices.length}]){const changed={...q,...patch};assert.equal(dynamicLinkForQuestion(changed,questionFingerprint(changed)),null,`${qid} withheld after change`);}
  assert.equal(dynamicLinkForQuestion(q,undefined),null);
 }
});
test('page case parsers accept only a single registered case parameter for their own page',()=>{
 for(const page of ['channel','radial','network']){
  assert.equal(caseLaunchFromSearch(page,''),null,`${page} empty search`);
  assert.equal(caseLaunchFromSearch(page,'?preset=radial&section=5.4'),null,`${page} section arrival is not a case handoff`);
  assert.throws(()=>caseLaunchFromSearch(page,'?case=unknown-v1'),/対応していません/,`${page} unknown case`);
  assert.throws(()=>caseLaunchFromSearch(page,'?case=sphere-lumped-v1&case=sphere-lumped-v1'),/形式に対応していません/,`${page} duplicate case`);
  assert.throws(()=>caseLaunchFromSearch(page,'?case=sphere-lumped-v1&preset=radial'),/形式に対応していません/,`${page} case mixed with preset`);
 }
 assert.throws(()=>caseLaunchFromSearch('network','?case=sphere-lumped-v1'),/対応していません/,'radial case rejected on the network page');
 assert.throws(()=>caseLaunchFromSearch('radial','?case=gray-parallel-v1'),/対応していません/,'network case rejected on the radial page');
 assert.throws(()=>caseLaunchFromSearch('channel','?case=gray-parallel-v1'),/対応していません/,'network case rejected on the channel page');
 for(const caseId of ['sphere-lumped-v1','gray-parallel-v1','blackbody-two-v1'])assert.throws(()=>thermalLaunchFromSearch(`?case=${caseId}`),/対応していません/,`thermal lab rejects ${caseId}`);
 assert.throws(()=>caseLaunchFromSearch('fin','?case=sphere-lumped-v1'),/受け口がありません/);
});
test('case descriptions state conditions and supplements only, never an answer value',()=>{
 const radial=caseLaunchFromSearch('radial','?case=sphere-lumped-v1'),gray=caseLaunchFromSearch('network','?case=gray-parallel-v1'),black=caseLaunchFromSearch('network','?case=blackbody-two-v1');
 for(const launch of [radial,gray,black]){assert.ok(launch.description.length>0);assert.ok(!/答えは(約)?[0-9]/.test(launch.description));assert.match(launch.description,/設問にない|設問は/);}
 assert.ok(!radial.description.includes('0.020'),'Bi value must not be stated');
 assert.ok(!/517|992/.test(gray.description),'gray-plate flux and blackbody difference must not be stated');
 assert.ok(!/793|992/.test(black.description),'blackbody exchange rate must not be stated');
});
test('sphere lumped handoff carries R, k and h exactly and reproduces the lumped trajectory',()=>{
 const launch=caseLaunchFromSearch('radial','?case=sphere-lumped-v1'),f=launch.fields;
 assert.equal(f.geometry,'sphere');assert.equal(f.analysis,'lumped');assert.equal(f.radius,.03);assert.equal(f.k,5);assert.equal(f.h,10);
 assert.ok(Math.abs(f.h*(f.radius/3)/f.k-.02)<1e-12,'Bi from the handed-off fields');
 const radialHtml=readFileSync(new URL('../dynamic/radial.html',import.meta.url),'utf8');
 for(const id of Object.keys(f))assert.ok(radialHtml.includes(`id="${id}"`),`radial form has #${id}`);
 const model=createLumpedRadial({approximation:f.analysis,geometry:f.geometry,radius:f.radius,k:f.k,rho:f.rho,cp:f.cp,initial:f.initial+273.15,source:f.source,boundary:{type:f.boundary,temperature:f['boundary-temperature']+273.15,h:f.h}});
 assert.ok(Math.abs(model.snapshot().BiLc-.02)<1e-12,'model Bi_Lc matches the problem definition');
 const s=model.step(1000),expected=293.15+60*Math.exp(-1);
 assert.ok(Math.abs(s.temperature[0]-expected)<1e-9,'one time constant of exponential cooling');
 assert.ok(s.relativeEnergyError<1e-12);
});
function networkConfig(launch){return {surfaces:launch.surfaces.map((s,i)=>({id:`surface-${i+1}`,...s})),viewFactors:launch.viewFactors};}
test('gray parallel-plate handoff reproduces the analytic two-surface exchange at the initial state',()=>{
 const launch=caseLaunchFromSearch('network','?case=gray-parallel-v1');
 assert.deepEqual(launch.viewFactors,[[0,1],[1,0]]);
 const s=createRadiationNetwork(networkConfig(launch)).snapshot(),expected=SIGMA*(400**4-300**4)/(1/.8+1/.6-1);
 assert.ok(Math.abs(s.outwardPower[0]-expected)<.5,`hot surface net ${s.outwardPower[0]} vs analytic ${expected}`);
 assert.ok(Math.abs(s.outwardPower[1]+expected)<.5);assert.ok(Math.abs(s.radiationBalance)<1e-6);
 assert.ok(Math.abs(s.pairPower[0][1]-expected)<.5);
});
test('blackbody two-surface handoff reproduces A1 F12 sigma (T1^4 - T2^4) at the initial state',()=>{
 const launch=caseLaunchFromSearch('network','?case=blackbody-two-v1');
 const [a1]=launch.surfaces;assert.equal(a1.area,1);assert.equal(launch.viewFactors[0][1],.8);
 const s=createRadiationNetwork(networkConfig(launch)).snapshot(),expected=1*.8*SIGMA*(400**4-300**4);
 assert.ok(Math.abs(s.outwardPower[0]-expected)<.5,`surface 1 net ${s.outwardPower[0]} vs analytic ${expected}`);
 assert.ok(Math.abs(s.outwardPower[1]+expected)<.5);assert.ok(Math.abs(s.radiationBalance)<1e-6);
});
