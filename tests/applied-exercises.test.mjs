import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateQuestion} from '../study-core.mjs';
import {checkPublicContent} from '../public-content-contract.mjs';
import {GUIDE_SECTIONS} from '../guide.mjs';

const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const solutions={
'1.1':['2,800 W/m²',()=> (200+80)/(.08+.02),2800],
'1.2':['30 K',()=>100*10*60*.75/(2*750),30],
'2.2':['400 W',()=>.5*2*20/.05,400],
'2.3':['7.5 K',()=>25/(.02+.03+.05)*.03,7.5],
'3.2':['43.3 K',()=>30/Math.log(2),43.28],
'3.3':['ε=0.50、40℃',()=>14000/(400*(90-20))+20+14000/700,40.5],
'4.3':['0.050',()=>100*.005/10,.05],
'4.5':['約0.603',()=>.9051/1.5,.6034],
'5.1':['1.0',()=>2e-6*50/.01**2,1],
'5.6':['87.4℃',()=>100+(20-100)*.1573,87.416],
'6.4':['8.0',()=>.001*4000/.5,8],
'6.5':['7.97 W/(m²·K)',()=>.664*Math.sqrt(1e4)*.03/.25,7.968],
'7.2':['146.4 W/(m²·K)',()=>3.66*.60/.015,146.4],
'7.5':['15 mm',()=>4*30*10/(2*(30+10)),15],
'8.3':['7.85×10⁶',()=>9.81*.003*10*.20**3/(1.5e-5*2e-5),7.848e6],
'8.5':['45,000 W/m²',()=>.60*15/.00020,45000],
'9.3':['40%',()=>100*(1-12000/(1e6*.02)),40],
'9.9':['55 kW',()=>.025*2.2e6/1000,55],
'10.3':['0.20',()=>2*.60/6,.2],
'10.4':['560 W/m²',()=>.70*1200+(1-.70)*400-400,560],
'11.3':['+1.2×10⁻⁶ mol/(m²·s)',()=>-3e-9*(-400),1.2e-6],
'11.6':['Sc=2000、Sh=1000',()=>1.2e-6/6e-10+3e-5*.020/6e-10,3000]
};
test('22 practical numericals are scientifically labeled, unique and correctly linked to 11 chapters',async()=>{
 const [bank,...fragments]=await Promise.all([
  'data/questions.json','data/applied-exercises-part1.json','data/applied-exercises-part2.json'
 ].map(read));
 assert.ok(bank.length>=265);
 const published=bank.filter(q=>q.id.startsWith('supp-applied-'));
 const authored=fragments.flatMap(doc=>doc.questions);
 assert.equal(published.length,22);
 assert.equal(authored.length,22);
 assert.equal(new Set(authored.map(q=>q.id)).size,22);
 assert.equal(new Set(authored.map(q=>q.source.focusSectionId)).size,22);
 assert.deepEqual(new Set(authored.map(q=>q.source.focusSectionId)),new Set(Object.keys(solutions)));
 const perChapter=new Map();
 for(const q of authored){
  const sid=q.source.focusSectionId;
  perChapter.set(q.source.chapterId,(perChapter.get(q.source.chapterId)||0)+1);
  assert.equal(q.id,'supp-applied-'+sid.replace('.','-')+'-v1');
  assert.equal(validateQuestion(q),'',q.id);
  assert.equal(q.revision,q.id==='supp-applied-6-5-v1'?'v3':['supp-applied-3-2-v1','supp-applied-10-4-v1','supp-applied-1-1-v1','supp-applied-1-2-v1','supp-applied-3-3-v1','supp-applied-4-5-v1','supp-applied-8-3-v1','supp-applied-11-3-v1','supp-applied-11-6-v1'].includes(q.id)?'v2':'v1');
  assert.equal(q.source.type,'supplement');
  assert.equal(q.questionKind,'numerical');
  assert.equal(q.expertReviewed,false);
  assert.ok(q.reviewStatus.includes('外部専門家校閲前'));
  assert.ok(q.explanation.includes('適用条件'));
  assert.ok(q.beginnerPitfall.length>=30,'missing meaningful applicability caveat for '+q.id);
  assert.ok(q.solutionSteps.length>=3);
  assert.ok(q.hints.length>=2);
  assert.equal(q.distractors.length,4);
  assert.equal(q.distractors.filter(d=>d.startsWith('正解。')).length,1);
  assert.ok(q.distractors[q.answer].startsWith('正解。'));
  assert.equal(new Set(q.choices).size,4);
  assert.equal(q.choices[q.answer],solutions[sid][0],sid);
  assert.deepEqual(bank.find(b=>b.id===q.id),q);
 }
 assert.equal(perChapter.size,11);
 assert.ok([...perChapter.values()].every(v=>v===2));
});
test('all 22 keyed calculations independently recompute to expected SI values',()=>{
 for(const [sid,[answer,calculate,expected]] of Object.entries(solutions)){
  const actual=calculate();
  assert.ok(Number.isFinite(actual));
  const tolerance=Math.max(1e-11,1e-3*Math.abs(expected));
  assert.ok(Math.abs(actual-expected)<=tolerance,sid+': '+actual+' vs '+expected);
  assert.ok(answer.length>0);
 }
 // Check both quantities on the exchanger question and mass transfer exercise independently.
 assert.equal(14000/(400*(90-20)),.5);
 assert.equal(20+14000/700,40);
 assert.equal(1.2e-6/6e-10,2000);
 assert.ok(Math.abs(3e-5*.02/6e-10-1000)<1e-8);
});
test('no accidental right-answer-length bias in new numerical MCQs',async()=>{
 const d=await Promise.all(['data/applied-exercises-part1.json','data/applied-exercises-part2.json'].map(read));
 const items=d.flatMap(x=>x.questions);
 const longest=items.filter(q=>q.choices[q.answer].length>Math.max(...q.choices.filter((_,i)=>i!==q.answer).map(v=>v.length)));
 assert.ok(longest.length<=3,'correct answer uniquely longest in '+longest.length+'/22');
});

test('public bundle rejects applied questions with broken section links or fictitious science-review labels',async()=>{
 const [book,notes,questions,glossary]=await Promise.all([
   'data/book.json','data/original-notes.json','data/questions.json','data/glossary.json'
 ].map(read));
 for(const ch of book.chapters)for(const section of ch.sections){for(const key of ['blocks','blocksEn','figures','sourceReview'])delete section[key];}
 const make=()=>structuredClone(questions);
 for(const q of questions)if(q.figure?.kind==='book')delete q.figure.src;
 assert.deepEqual(checkPublicContent({book,originalNotes:notes,questions,glossary,guides:GUIDE_SECTIONS}),[]);
 const linked=make();
 linked.find(q=>q.id==='supp-applied-1-1-v1').source.focusSectionId='0.999';
 assert.ok(checkPublicContent({book,originalNotes:notes,questions:linked,glossary,guides:GUIDE_SECTIONS})
   .some(e=>e.includes('応用計算問題の関連節')));
 const falsified=make();
 falsified.find(q=>q.id==='supp-applied-11-6-v1').expertReviewed=true;
 assert.ok(checkPublicContent({book,originalNotes:notes,questions:falsified,glossary,guides:GUIDE_SECTIONS})
   .some(e=>e.includes('未校閲表示')));
});
