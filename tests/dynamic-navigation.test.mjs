import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readerSectionFromHash,dynamicLinkForSection,dynamicLinkForQuestion,thermalLaunchFromSearch} from '../dynamic-navigation.mjs';import {questionFingerprint} from '../study-core.mjs';import {createThermal} from '../dynamic/thermal.mjs';import {preset} from '../dynamic/presets.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url))),ids=read('data/book.json').chapters.flatMap(c=>c.sections.map(s=>s.id)),question=read('data/questions.json').find(q=>q.id==='supp-deep-fin-base-heat-v1');
test('reader section intents accept only real stable section IDs without decoding arbitrary routes',()=>{
 assert.equal(readerSectionFromHash('#reader/5.3',ids),'5.3');for(const hash of ['#reader','##reader/5.3','#reader/99.1','#reader/%35.3','#reader/5.3/extra','#reader/5.3?x=1'])assert.equal(readerSectionFromHash(hash,ids),'');
 for(const id of ids){const link=dynamicLinkForSection(id);if(!link)continue;assert.equal(link.sectionId,id);assert.ok(link.href.startsWith('./dynamic/'));assert.ok(!/[<>"']/.test(link.href));}assert.equal(dynamicLinkForSection('<img>'),null);assert.equal(dynamicLinkForSection('__proto__'),null);
});
test('question launch is withheld when the stable problem changes revision, wording or answer',()=>{
 assert.ok(dynamicLinkForQuestion(question,questionFingerprint(question)));for(const patch of [{revision:'v2'},{prompt:question.prompt+' changed'},{answer:1}]){const changed={...question,...patch};assert.equal(dynamicLinkForQuestion(changed,questionFingerprint(changed)),null);}assert.equal(dynamicLinkForQuestion(question,undefined),null);assert.equal(dynamicLinkForQuestion({id:'other'},''),null);
});
test('thermal launch uses an allowlist and rejects duplicates, mismatched sources and injected parameters',()=>{
 assert.equal(thermalLaunchFromSearch(''),null);assert.equal(thermalLaunchFromSearch('?preset=heating&section=5.3').sectionId,'5.3');assert.equal(thermalLaunchFromSearch('?preset=fin&section=4.5').preset,'fin');for(const search of ['?preset=bad','?preset=heating&section=4.5','?case=bad','?case=fin-base-v1&preset=fin','?preset=heating&preset=cooling','?preset=heating&k=1e99','?preset=heating&section=%3Cscript%3E'])assert.throws(()=>thermalLaunchFromSearch(search));
});
test('fin problem handoff keeps P, Ac, L, k, h and deltaT and reaches the independently solved steady profile',()=>{
 const launch=thermalLaunchFromSearch('?case=fin-base-v1'),f=launch.fields,c=preset('fin',48);Object.assign(c,{width:f.width,height:f.height,depth:f.depth,initial:f.initial+273.15,materials:[{k:f.k,rho:f.rho,cp:f.cp}]});c.boundaries.left.temperature=f['boundary-temperature']+273.15;c.distributedConvection={h:f.h,areaPerVolume:2*(f.height+f.depth)/(f.height*f.depth),temperature:293.15};assert.equal(c.height*c.depth,1e-4);assert.equal(2*(c.height+c.depth),.04);assert.match(launch.description,/設問にない/);
 const model=createThermal(c);while(model.time<600)model.step(Math.min(model.safeDt,600-model.time));const s=model.snapshot(),m=Math.sqrt(25*.04/(200*1e-4));for(let i=0;i<48;i++){const x=(i+.5)*.1/48,analytic=293.15+60*Math.cosh(m*(.1-x))/Math.cosh(m*.1);assert.ok(Math.abs(s.temperature[i]-analytic)<.003);}
 const baseHeat=200*1e-4*(353.15-s.temperature[0])/(.1/48/2),reference=200*1e-4*m*60*Math.tanh(m*.1);assert.ok(Math.abs(baseHeat-reference)<.003);assert.ok(Math.abs(reference-5.1663)<.0001);assert.ok(Math.abs(s.energyError)<1e-7);
});
