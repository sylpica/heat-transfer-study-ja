import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateDeepLessons,deepLessonForSection} from '../original-deep-lessons.mjs';
import {buildAuthoringQueue} from '../authoring-queue.mjs';

const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const near=(actual,want,tol=1e-10)=>assert.ok(Math.abs(actual-want)<=tol*Math.max(1,Math.abs(want)),`${actual} vs ${want}`);
const ids=[
 'supp-chf-capillary-length-v1','supp-chf-ideal-correlation-v1',
 'supp-chf-surface-tension-scale-v1','supp-chf-uncertain-bound-v1',
 'supp-chf-power-control-v1','supp-chf-model-selection-v1'
];

test('§9.3 independent lesson names its model limits and does not assert finished textbook review',async()=>{
 const [book,deep]=await Promise.all(['data/book.json','data/original-deep-lessons.json'].map(read));
 assert.deepEqual(validateDeepLessons(book,deep),[]);
 assert.equal(book.chapters.flatMap(ch=>ch.sections).find(s=>s.id==='9.3').pdfStart,499);
 const lesson=deepLessonForSection(deep,'9.3');
 assert.ok(lesson.blocks.length>=7);
 assert.ok(lesson.blocks.reduce((n,b)=>n+b.text.length,0)>=1150);
 assert.ok(lesson.equations.length>=4&&lesson.pitfalls.length>=5);
 assert.ok(lesson.workedExample.steps.length>=5);
 assert.match(lesson.blocks.map(b=>b.text).join(' '),/大きな水平面の説明用にはC≈0\.13/);
 assert.match(lesson.blocks.map(b=>b.text).join(' '),/実機の許容電力や事故防止条件を与えない/);
 assert.match(lesson.reviewStatus,/外部学術専門家校閲前/);
 assert.equal(deep.translation,false);
 assert.equal(deep.expertReviewed,false);
});

test('§9.3 six exercises explain all choices, vary cognitive skill and avoid length cues',async()=>{
 const [book,notes,deep,all,evidence]=await Promise.all([
  'data/book.json','data/original-notes.json','data/original-deep-lessons.json',
  'data/questions.json','data/readiness-evidence.json'
 ].map(read));
 assert.equal(all.length,750);
 const qs=all.filter(q=>ids.includes(q.id));
 assert.equal(qs.length,6);
 assert.equal(new Set(all.map(q=>q.id)).size,all.length);
 for(const q of qs){
  assert.equal(q.source.focusSectionId,'9.3',q.id);
  assert.equal(q.source.guideId,'chapter9-latent-boiling',q.id);
  assert.equal(q.choices.length,4,q.id);
  assert.equal(new Set(q.choices).size,4,q.id);
  assert.equal(q.distractors.length,4,q.id);
  assert.ok(q.distractors[q.answer].startsWith('正解。'),q.id);
  assert.ok(q.solutionSteps.length>=3&&q.hints.length>=2,q.id);
  assert.equal(q.expertReviewed,false,q.id);
  assert.ok(q.reviewStatus.includes('外部専門家校閲前'),q.id);
  const correct=q.choices[q.answer].length;
  const wrong=q.choices.filter((_,i)=>i!==q.answer).map(s=>s.length);
  assert.ok(correct>=Math.min(...wrong)&&correct<=Math.max(...wrong),`answer-length cue: ${q.id}`);
 }
 const section=buildAuthoringQueue({book,originalNotes:notes,deepLessons:deep,questions:all,evidence}).sections.find(s=>s.sectionId==='9.3');
 assert.equal(section.questionDraftCount,8);
 assert.ok(section.questionKinds>=3);
 assert.ok(section.detailedLessonDraft&&section.authoringMinimumMet);
 assert.equal(section.finalAcceptance,false);
});

test('CHF length scale and idealized correlation independently satisfy their numeric and unit examples',()=>{
 const sigma=.059,g=9.81,rhoL=950,rhoV=.60,hfg=2.2e6,C=.13;
 const capillary=Math.sqrt(sigma/(g*(rhoL-rhoV)));
 near(capillary,.002516905376279981);
 const fourth=Math.pow(sigma*g*(rhoL-rhoV),.25);
 near(fourth,4.841640749704226);
 const qChf=C*hfg*Math.sqrt(rhoV)*fourth;
 near(qChf,1072591.1763380333);
 const qOperating=160_000/.20;
 near(qOperating,800_000);
 near(1-qOperating/qChf,.2541426615765153);
 near(Math.sqrt(.060/(10*1000))*1000,2.449489742783178); // m to mm
 near(.13*2e6*Math.sqrt(.64)*Math.pow(.0625*10*1000,.25),1.04e6);
 near(Math.pow(16,.25),2);
 assert.ok(.80>.70&&.80<1.20,'an uncertainty interval spanning operation cannot prove safety');
});
