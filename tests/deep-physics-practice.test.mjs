import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateQuestion} from '../study-core.mjs';

const read=async name=>JSON.parse(await readFile(new URL('../'+name,import.meta.url),'utf8'));
const close=(value,expected,tolerance=1e-8)=>
 assert.ok(Math.abs(value-expected)<=tolerance, `${value} is not within ${tolerance} of ${expected}`);

test('twenty authored deep-physics numericals are published with matched keys, references and no answer-position bias',async()=>{
 const [bundle,bank,deep]=await Promise.all([
   'data/deep-physics-practice.json','data/questions.json','data/original-deep-lessons.json'
 ].map(read));
 const items=bundle.questions;
 assert.equal(bundle.kind,'original_deep_physics_practice_v1');
 assert.equal(items.length,20);
 assert.ok(bank.length>=298);
 assert.equal(new Set(items.map(q=>q.id)).size,20);
 assert.deepEqual(items.map(q=>q.answer).sort(),[0,0,0,0,0,1,1,1,1,1,2,2,2,2,2,3,3,3,3,3]);
 assert.equal(items.filter(q=>q.source.focusSectionId==='2.1').length,4);
 assert.equal(items.filter(q=>q.source.focusSectionId==='11.3').length,4);
 assert.equal(items.filter(q=>q.source.focusSectionId==='5.6').length,4);
 assert.equal(items.filter(q=>q.source.focusSectionId==='10.1').length,4);
 assert.equal(items.filter(q=>q.source.focusSectionId==='4.5').length,4);
 for(const q of items){
   assert.equal(validateQuestion(q),'',q.id);
   assert.deepEqual(bank.find(x=>x.id===q.id),q,q.id);
   assert.equal(q.source.type,'supplement');
   assert.ok(deep.lessons.some(x=>x.sectionId===q.source.focusSectionId));
   assert.equal(q.questionGroup,'original_independent_applied_v1');
   assert.equal(q.questionKind,'numerical');
   // supp-deep-fin-effectiveness-v1 moved to v2 in the 2026-11-09 overall fix part 2 (distractor rationale rewrite).
   assert.equal(q.revision,q.id==='supp-deep-fin-effectiveness-v1'?'v2':'v1');
   assert.equal(q.expertReviewed,false);
   assert.match(q.reviewStatus,/外部専門家校閲前/);
   assert.match(q.explanation,/適用条件/);
   assert.ok(q.hints.length>=2&&q.solutionSteps.length>=4);
   assert.equal(q.distractors.length,4);
   assert.equal(q.distractors.filter(s=>s.startsWith('正解。')).length,1);
   assert.match(q.distractors[q.answer],/^正解。/);
   assert.ok(q.choices.every(v=>v.length>4));
   const lens=q.choices.map(s=>s.length);
   assert.ok(lens[q.answer]!==Math.max(...lens)||lens.filter(x=>x===lens[q.answer]).length>1);
   assert.ok(lens[q.answer]!==Math.min(...lens)||lens.filter(x=>x===lens[q.answer]).length>1);
 }
});

test('independently recompute new heat generation, Fourier direction and flux-balance answers',async()=>{
 const bundle=(await read('data/deep-physics-practice.json')).questions;
 const byId=new Map(bundle.map(q=>[q.id,q]));
 const choice=id=>{const q=byId.get('supp-deep-'+id+'-v1');assert.ok(q,id);return q.choices[q.answer];};
 close(30+8e4*.04**2/(8*20),30.8,1e-12);
 assert.equal(choice('heat-generation-center'),'30.8 ℃');
 close(-20*(50-30)/.04,-10000,1e-9);
 assert.equal(choice('heat-conduction-direction'),'−10,000 W/m²');
 close(2e5*.05/2,5000,1e-9);
 assert.equal(choice('heat-symmetric-flux'),'5,000 W/m²');
 close((3500-(-2500))/.06,1e5,1e-8);
 assert.equal(choice('heat-generation-balance'),'100,000 W/m³');
});

test('independently recompute molar density, equimolar flux, Stefan-flow ratio and mass flux',async()=>{
 const bundle=(await read('data/deep-physics-practice.json')).questions;
 const byId=new Map(bundle.map(q=>[q.id,q]));
 const choice=id=>{const q=byId.get('supp-deep-'+id+'-v1');assert.ok(q,id);return q.choices[q.answer];};
 const c=101325/(8.3144626*300),coefficient=c*2e-5/.01;
 const equimolar=coefficient*(.2-.05),stagnant=coefficient*Math.log(.95/.8);
 close(c,40.62198800437204,1e-9);
 close(equimolar,.012186596401311612,1e-12);
 close(stagnant,.013961798150845993,1e-12);
 close(stagnant/equimolar,1.1456683795110603,1e-10);
 close(.01219*.0280,.00034132,1e-12);
 assert.equal(choice('fick-molar-concentration'),'40.6 mol/m³');
 assert.equal(choice('fick-equimolar-flux'),'+0.01219 mol/(m²·s)');
 assert.equal(choice('fick-stefan-ratio'),'1.15 倍');
 assert.equal(choice('fick-mass-flux'),'+3.41×10⁻⁴ kg/(m²·s)');
});
