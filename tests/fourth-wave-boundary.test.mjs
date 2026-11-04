import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateDeepLessons,deepLessonForSection} from '../original-deep-lessons.mjs';
import {buildAuthoringQueue} from '../authoring-queue.mjs';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));

test('boundary-value and internal-generation lessons are complete independent texts, not a falsely approved translation',async()=>{
 const [book,d]=await Promise.all(['data/book.json','data/original-deep-lessons.json'].map(read));
 assert.deepEqual(validateDeepLessons(book,d),[]);
 assert.equal(d.lessons.length,76);
 for(const id of ['4.1','4.2']){
  const l=deepLessonForSection(d,id);
  assert.ok(l&&l.blocks.length>=6&&l.equations.length>=4,id);
  assert.ok(l.blocks.every(b=>b.text.length>=70),id);
  assert.ok(l.blocks.reduce((n,b)=>n+b.text.length,0)>=750,id);
  assert.ok(l.workedExample.steps.length>=5&&l.pitfalls.length>=4,id);
  assert.ok(l.reviewStatus.includes('外部学術専門家校閲前'),id);
 }
 assert.equal(d.translation,false);assert.equal(d.expertReviewed,false);
});

test('new section 4.1/4.2 questions have section metadata, rationale, and no answer-length giveaway',async()=>{
 const [book,notes,deep,questions,evidence]=await Promise.all(['data/book.json','data/original-notes.json','data/original-deep-lessons.json','data/questions.json','data/readiness-evidence.json'].map(read));
 assert.equal(questions.length,750);
 const items=questions.filter(q=>q.id.startsWith('supp-batch3-'));
 assert.equal(items.length,14);
 for(const q of items){
  assert.ok(['4.1','4.2'].includes(q.source?.focusSectionId),q.id);
  assert.equal(q.source.chapterId,'ch4',q.id);
  assert.equal(q.source.guideId,'chapter4-fin-design',q.id);
  assert.ok(['conceptual','numerical','applied'].includes(q.questionKind),q.id);
  assert.equal(q.choices.length,4);assert.equal(q.distractors.length,4);
  assert.ok(q.distractors.every(d=>d.length>=10),q.id);
  assert.ok(q.distractors[q.answer].startsWith('正解。'),q.id);
  assert.ok(q.solutionSteps.length>=3&&q.hints.length>=2,q.id);
  assert.equal(q.expertReviewed,false);
  assert.ok(q.reviewStatus.includes('外部専門家校閲前'));
  const len=q.choices[q.answer].length,wrong=q.choices.filter((_,i)=>i!==q.answer).map(s=>s.length);
  assert.ok(len>=Math.min(...wrong)&&len<=Math.max(...wrong),'length cue '+q.id);
 }
 const report=buildAuthoringQueue({book,originalNotes:notes,deepLessons:deep,questions,evidence});
 assert.equal(report.detailedLessonDrafts,76);
 assert.equal(report.draftAuthoringMinimumMet,76);
 assert.equal(report.remainingQuestionDraftMinimum,0);
 assert.equal(report.externallyAcceptedSections,0);
 for(const id of ['4.1','4.2']){
  const s=report.sections.find(s=>s.sectionId===id);
  assert.ok(s.authoringMinimumMet,id);
  assert.ok(!s.finalAcceptance,id);
 }
 const generatedTotal=items.find(q=>q.id==='supp-batch3-generated-total-power-v1');
 assert.equal(generatedTotal.revision,'v2');
 assert.match(generatedTotal.explanation,/面ごとの放熱量は境界条件や蓄熱の有無で変わり/);
 assert.doesNotMatch([generatedTotal.explanation,...generatedTotal.solutionSteps,...generatedTotal.distractors].join(' '),/両面から各1000W/);
});

test('boundary signs, stationary Poisson profile, and two-sided energy rate independently balance',()=>{
 const k=2,L=.1,T0=100,qRight=200;
 const grad=-qRight/k;assert.equal(grad,-100);
 assert.equal(T0+grad*L,90);
 assert.equal(-k*grad,200);
 // Outward flux uses a separate normal at each side.
 assert.equal(200*(-1),-200);
 // A steady slab with symmetric imposed wall temperatures and positive generation.
 const g=20_000,half=.05,ks=10,Ts=20,A=1;
 const rise=g*half**2/(2*ks);
 assert.ok(Math.abs(rise-2.5)<1e-10);
 assert.ok(Math.abs(Ts+rise-22.5)<1e-10);
 assert.equal(g*half,1000);
 assert.equal(g*(2*half*A),2000);
 assert.equal(2*(g*half*A),g*(2*half*A));
 assert.ok(Math.abs(g*(2*half)**2/(2*ks)-4*rise)<1e-10);
 // Laplace equation is the special case of the Poisson model with zero generation.
 const laplace=(qgen)=>-qgen/ks;
 assert.ok(Math.abs(laplace(0))<1e-12,'zero generation reduces to Laplace equation');
 assert.ok(laplace(g)<0);
});
