import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {readerSectionFromHash,dynamicLinkForSection,dynamicLinkForQuestion,thermalLaunchFromSearch,sectionContextFromSearch} from '../dynamic-navigation.mjs';import {questionFingerprint} from '../study-core.mjs';import {createThermal} from '../dynamic/thermal.mjs';import {preset} from '../dynamic/presets.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url))),ids=read('data/book.json').chapters.flatMap(c=>c.sections.map(s=>s.id)),question=read('data/questions.json').find(q=>q.id==='supp-deep-fin-base-heat-v1');
test('reader section intents accept only real stable section IDs without decoding arbitrary routes',()=>{
 assert.equal(readerSectionFromHash('#reader/5.3',ids),'5.3');for(const hash of ['#reader','##reader/5.3','#reader/99.1','#reader/%35.3','#reader/5.3/extra','#reader/5.3?x=1'])assert.equal(readerSectionFromHash(hash,ids),'');
 for(const id of ids){const link=dynamicLinkForSection(id);if(!link)continue;assert.equal(link.sectionId,id);assert.ok(link.href.startsWith('./dynamic/'));assert.ok(!/[<>"']/.test(link.href));}assert.equal(dynamicLinkForSection('<img>'),null);assert.equal(dynamicLinkForSection('__proto__'),null);assert.equal(sectionContextFromSearch('?preset=radial&section=5.4','radial'),'5.4');assert.equal(sectionContextFromSearch('?preset=channel&section=7.2','channel'),'7.2');assert.equal(sectionContextFromSearch('?preset=network&section=10.3','network'),'10.3');for(const q of ['?preset=radial&section=7.2','?preset=radial&section=__proto__','?preset=radial&section=5.4&section=5.5'])assert.equal(sectionContextFromSearch(q,'radial'),'');
});
test('question launch is withheld when the stable problem changes revision, wording or answer',()=>{
 assert.ok(dynamicLinkForQuestion(question,questionFingerprint(question)));for(const patch of [{revision:'v2'},{prompt:question.prompt+' changed'},{answer:1}]){const changed={...question,...patch};assert.equal(dynamicLinkForQuestion(changed,questionFingerprint(changed)),null);}assert.equal(dynamicLinkForQuestion(question,undefined),null);assert.equal(dynamicLinkForQuestion({id:'other'},''),null);
});
test('thermal launch uses an allowlist and rejects duplicates, mismatched sources and injected parameters',()=>{
 assert.equal(thermalLaunchFromSearch(''),null);assert.equal(thermalLaunchFromSearch('?preset=heating&section=5.3').sectionId,'5.3');assert.equal(thermalLaunchFromSearch('?preset=fin&section=4.5').preset,'fin');for(const search of ['?preset=bad','?preset=heating&section=4.5','?case=bad','?case=fin-base-v1&preset=fin','?preset=heating&preset=cooling','?preset=heating&k=1e99','?preset=heating&section=%3Cscript%3E'])assert.throws(()=>thermalLaunchFromSearch(search));
});
const expectedSections={'2.1':'heating','2.2':'heating','2.3':'radial','4.5':'fin','5.2':'cooling','5.3':'heating','5.4':'radial','5.5':'radial','5.7':'heating','5.8':'heating','7.2':'channel','7.4':'channel','7.5':'channel','10.1':'network','10.3':'network','10.4':'network'};
test('section linkage covers exactly the sections with a real model correspondence (16 of 76)',()=>{
 const linked=ids.filter(id=>dynamicLinkForSection(id));assert.deepEqual([...linked].sort(),Object.keys(expectedSections).sort());
 for(const [id,preset] of Object.entries(expectedSections)){const link=dynamicLinkForSection(id);assert.equal(link.sectionId,id);assert.ok(link.href.includes(`preset=${preset}&section=${id}`),`${id} href`);assert.ok(link.label.startsWith('動的実験：'));}
 for(const [search,preset] of [['?preset=radial&section=2.3','radial'],['?preset=channel&section=7.4','channel'],['?preset=channel&section=7.5','channel'],['?preset=network&section=10.4','network']])assert.equal(sectionContextFromSearch(search,preset),search.split('section=')[1]);
 assert.equal(thermalLaunchFromSearch('?preset=cooling&section=5.2').sectionId,'5.2');assert.equal(thermalLaunchFromSearch('?preset=heating&section=5.7').sectionId,'5.7');
 for(const search of ['?preset=heating&section=2.3','?preset=cooling&section=5.3','?preset=heating&section=5.2','?preset=fin&section=5.7'])assert.throws(()=>thermalLaunchFromSearch(search));
 const radialHtml=readFileSync(new URL('../dynamic/radial.html',import.meta.url),'utf8'),channelHtml=readFileSync(new URL('../dynamic/channel.html',import.meta.url),'utf8'),radiationHtml=readFileSync(new URL('../dynamic/radiation.html',import.meta.url),'utf8');
 assert.ok(radialHtml.includes('href="../index.html#reader/2.3"'));assert.ok(channelHtml.includes('href="../index.html#reader/7.4"'));assert.ok(channelHtml.includes('href="../index.html#reader/7.5"'));assert.ok(radiationHtml.includes('href="../index.html#reader/10.4"'));
});
const caseQuestions={'supp-deep-semi-profile-v1':'semi-profile-v1','supp-deep-heat-generation-center-v1':'gen-center-v1','supp-next-combined-surface-loss-v1':'combined-loss-v1','supp-deep-rad-netflux-v1':'rad-netflux-v1'};
test('every registered question case is fingerprint-gated and launches its own conditions',()=>{
 const all=read('data/questions.json');
 for(const [qid,caseId] of Object.entries({...caseQuestions,'supp-deep-fin-base-heat-v1':'fin-base-v1'})){
  const q=all.find(x=>x.id===qid);assert.ok(q,`${qid} exists in the bank`);
  const link=dynamicLinkForQuestion(q,questionFingerprint(q));assert.ok(link,`${qid} link offered`);assert.equal(link.href,`./dynamic/index.html?case=${caseId}`);
  for(const patch of [{revision:'v2'},{prompt:q.prompt+' changed'},{answer:(q.answer+1)%q.choices.length}]){const changed={...q,...patch};assert.equal(dynamicLinkForQuestion(changed,questionFingerprint(changed)),null,`${qid} withheld after change`);}
  const launch=thermalLaunchFromSearch(`?case=${caseId}`);assert.equal(launch.caseId,caseId);assert.ok(launch.description.length>0);assert.ok(!/答えは(約)?[0-9]/.test(launch.description),`${caseId} description must not state an answer value`);
 }
 for(const search of ['?case=unknown-v1','?case=semi-profile-v1&preset=heating','?case=gen-center-v1&section=2.1','?case=rad-netflux-v1&case=rad-netflux-v1'])assert.throws(()=>thermalLaunchFromSearch(search));
 const semi=thermalLaunchFromSearch('?case=semi-profile-v1');assert.equal(semi.preset,'heating');assert.equal(semi.fields.k/(semi.fields.rho*semi.fields.cp),1e-6);
 const gen=thermalLaunchFromSearch('?case=gen-center-v1');assert.equal(gen.fields.source,80000);assert.equal(gen.fields.width,.02);
 const combined=thermalLaunchFromSearch('?case=combined-loss-v1');assert.equal(combined.fields.boundary,'convection-radiation');assert.equal(combined.fields.height*combined.fields.depth,.5);
 const rad=thermalLaunchFromSearch('?case=rad-netflux-v1');assert.equal(rad.preset,'radiation');assert.equal(rad.fields.initial,126.85);assert.equal(rad.fields.emissivity,.8);
});
function configFromLaunch(launch){const f=launch.fields,c=preset(launch.preset,48);Object.assign(c,{width:f.width,height:f.height,depth:f.depth,initial:f.initial+273.15,materials:[{k:f.k,rho:f.rho,cp:f.cp}],source:f.source||0});
 if(launch.preset==='radiation'){for(const side of ['left','right','top','bottom'])c.boundaries[side]={type:'radiation',temperature:f['boundary-temperature']+273.15,emissivity:f.emissivity};}
 else if(f.boundary==='convection-radiation'){c.boundaries.left={type:'convection-radiation',temperature:f['boundary-temperature']+273.15,h:f.h,emissivity:f.emissivity,radiationTemperature:f['radiation-temperature']+273.15};}
 else c.boundaries.left.temperature=f['boundary-temperature']+273.15;return c;}
function runTo(model,until){while(model.time<until-1e-12)model.step(Math.min(model.safeDt,until-model.time));return model.snapshot();}
const erfc=x=>{const t=1/(1+.3275911*x);return (((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);};
test('semi-infinite problem handoff reproduces the erfc profile of the analytic solution at 100 s',()=>{
 const launch=thermalLaunchFromSearch('?case=semi-profile-v1'),model=createThermal(configFromLaunch(launch)),s=runTo(model,100),dx=.1/48,row=Math.floor(model.mesh.ny/2);
 for(const i of [3,4,5,9]){const x=(i+.5)*dx,analytic=293.15+60*erfc(x/(2*Math.sqrt(1e-6*100)));assert.ok(Math.abs(s.temperature[row*48+i]-analytic)<.1,`cell i=${i}`);}
 assert.ok(s.relativeEnergyError<1e-9);
});
test('heat-generation problem handoff reaches the analytic steady centre temperature',()=>{
 const launch=thermalLaunchFromSearch('?case=gen-center-v1'),model=createThermal(configFromLaunch(launch)),s=runTo(model,60);
 assert.ok(Math.abs(s.max-(30+8e4*.02*.02/(2*20)+273.15))<.01,'steady centre 30.8 C');assert.ok(s.relativeEnergyError<1e-9);
});
test('combined surface-loss handoff splits convection and radiation as the analytic balance at 320 K',()=>{
 const launch=thermalLaunchFromSearch('?case=combined-loss-v1'),model=createThermal(configFromLaunch(launch)),s0=model.snapshot(),g=s0.surfaceExchange.find(x=>x.side==='left'),sigma=5.670374419e-8;
 assert.ok(Math.abs(g.area-.5)<1e-9);assert.ok(Math.abs(g.convectionOutwardWatts/g.area-200)<1);assert.ok(Math.abs(g.radiationOutwardWatts/g.area-.8*sigma*(320**4-300**4))<1);
 let T=320;for(let t=0;t<2;t+=.01)T-=.01*100*(10*(T-300)+.8*sigma*(T**4-300**4))/(2700*900);
 const s=runTo(model,2),vals=s.temperature.filter((_,n)=>model.mesh.mask[n]),mean=vals.reduce((a,b)=>a+b,0)/vals.length;
 assert.ok(Math.abs(mean-T)<.005,'mean follows the lumped balance');assert.ok(s.max-s.min<.05);
});
test('radiation problem handoff cools the plate on the Stefan-Boltzmann lumped trajectory',()=>{
 const launch=thermalLaunchFromSearch('?case=rad-netflux-v1'),model=createThermal(configFromLaunch(launch)),sigma=5.670374419e-8;
 assert.ok(Math.abs(.8*sigma*(400**4-300**4)-793.852)<.01,'analytic net flux of the problem conditions');
 let T=400;for(let t=0;t<20;t+=.02)T-=.02*140*.8*sigma*(T**4-300**4)/(2700*900);
 const s=runTo(model,20),vals=s.temperature.filter((_,n)=>model.mesh.mask[n]),mean=vals.reduce((a,b)=>a+b,0)/vals.length;
 assert.ok(Math.abs(mean-T)<.01,'mean follows the lumped radiation trajectory');assert.ok(s.max-s.min<.1,'near-uniform plate (measured spread 0.064 K: corner cells cool through two faces)');assert.ok(s.relativeEnergyError<1e-9);
});
test('fin problem handoff keeps P, Ac, L, k, h and deltaT and reaches the independently solved steady profile',()=>{
 const launch=thermalLaunchFromSearch('?case=fin-base-v1'),f=launch.fields,c=preset('fin',48);Object.assign(c,{width:f.width,height:f.height,depth:f.depth,initial:f.initial+273.15,materials:[{k:f.k,rho:f.rho,cp:f.cp}]});c.boundaries.left.temperature=f['boundary-temperature']+273.15;c.distributedConvection={h:f.h,areaPerVolume:2*(f.height+f.depth)/(f.height*f.depth),temperature:293.15};assert.equal(c.height*c.depth,1e-4);assert.equal(2*(c.height+c.depth),.04);assert.match(launch.description,/設問にない/);
 const model=createThermal(c);while(model.time<600)model.step(Math.min(model.safeDt,600-model.time));const s=model.snapshot(),m=Math.sqrt(25*.04/(200*1e-4));for(let i=0;i<48;i++){const x=(i+.5)*.1/48,analytic=293.15+60*Math.cosh(m*(.1-x))/Math.cosh(m*.1);assert.ok(Math.abs(s.temperature[i]-analytic)<.003);}
 const baseHeat=200*1e-4*(353.15-s.temperature[0])/(.1/48/2),reference=200*1e-4*m*60*Math.tanh(m*.1);assert.ok(Math.abs(baseHeat-reference)<.003);assert.ok(Math.abs(reference-5.1663)<.0001);assert.ok(Math.abs(s.energyError)<1e-7);
});
