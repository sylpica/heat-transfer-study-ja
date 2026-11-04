import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateDeepLessons,deepLessonForSection} from '../original-deep-lessons.mjs';
import {buildAuthoringQueue} from '../authoring-queue.mjs';
import {checkPublicContent} from '../public-content-contract.mjs';
import {GUIDE_SECTIONS} from '../guide.mjs';

const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const close=(actual,want)=>assert.ok(Math.abs(actual-want)<=1e-10*Math.max(1,Math.abs(want)),`${actual} vs ${want}`);
const ids=[
 'supp-nucleate-laplace-pressure-v1','supp-nucleate-radius-sensitivity-v1',
 'supp-nucleate-subcooling-v1','supp-nucleate-latent-rate-v1',
 'supp-nucleate-effective-h-v1','supp-nucleate-onset-limit-v1'
];

test('independent nucleate-boiling lecture is linked to the actual section without claiming translation or review',async()=>{
 const [book,lessons]=await Promise.all(['data/book.json','data/original-deep-lessons.json'].map(read));
 assert.deepEqual(validateDeepLessons(book,lessons),[]);
 const section=book.chapters.flatMap(c=>c.sections).find(s=>s.id==='9.2');
 assert.equal(section.pdfStart,492);
 const lesson=deepLessonForSection(lessons,'9.2');
 assert.ok(lesson.blocks.length>=7);
 assert.ok(lesson.blocks.reduce((n,b)=>n+b.text.length,0)>=1100);
 assert.ok(lesson.equations.length>=5&&lesson.pitfalls.length>=5);
 assert.ok(lesson.reviewStatus.includes('外部学術専門家校閲前'));
 assert.equal(lessons.translation,false);
 assert.equal(lessons.expertReviewed,false);
 assert.match(lesson.blocks.map(b=>b.text).join(' '),/主流が過冷却されていても壁面近くで局所的に核沸騰/);
 assert.match(lesson.blocks.map(b=>b.text).join(' '),/限界熱流束の値はこの球形泡の平衡式からは求まらず/);
});

test('new nucleate-boiling questions are section-linked, independently explained and avoid answer-length cues',async()=>{
 const [book,notes,lessons,questions,evidence,glossary]=await Promise.all([
  'data/book.json','data/original-notes.json','data/original-deep-lessons.json',
  'data/questions.json','data/readiness-evidence.json','data/glossary.json'
 ].map(read));
 assert.equal(questions.length,750);
 const added=questions.filter(q=>ids.includes(q.id));
 assert.equal(added.length,6);
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 const byTerm=new Map(glossary.map(term=>[term.id,term]));
 for(const termId of ['nucleate-boiling','surface-tension']){
  const term=byTerm.get(termId);
  assert.match(term.beginner,/^補足説明（アプリ作成）：/);
  assert.match(term.detail,/^補足説明（アプリ作成）：/);
  assert.notEqual(term.beginner,term.detail);
 }
 assert.ok(byTerm.get('nucleate-boiling').relatedQuestions.some(link=>link.id==='supp-nucleate-subcooling-v1'));
 assert.ok(byTerm.get('surface-tension').relatedQuestions.some(link=>link.id==='supp-nucleate-laplace-pressure-v1'));
 for(const q of added){
  assert.equal(q.source.focusSectionId,'9.2',q.id);
  assert.equal(q.source.guideId,'chapter9-latent-boiling',q.id);
  assert.equal(q.choices.length,4,q.id);
  assert.equal(new Set(q.choices).size,4,q.id);
  assert.equal(q.distractors.length,4,q.id);
  assert.ok(q.distractors[q.answer].startsWith('正解。'),q.id);
  assert.ok(q.solutionSteps.length>=3&&q.hints.length>=2,q.id);
  assert.ok(['numerical','conceptual','applied'].includes(q.questionKind),q.id);
  assert.equal(q.expertReviewed,false,q.id);
  assert.ok(q.reviewStatus.includes('外部専門家校閲前'),q.id);
  const correct=q.choices[q.answer].length;
  const other=q.choices.filter((_,i)=>i!==q.answer).map(c=>c.length);
  assert.ok(correct>=Math.min(...other)&&correct<=Math.max(...other),`answer-length cue: ${q.id}`);
 }
 const row=buildAuthoringQueue({book,originalNotes:notes,deepLessons:lessons,questions,evidence}).sections.find(s=>s.sectionId==='9.2');
 assert.equal(row.questionDraftCount,8);
 assert.ok(row.questionKinds>=3);
 assert.ok(row.detailedLessonDraft&&row.authoringMinimumMet);
 assert.equal(row.finalAcceptance,false);
 for(const chapter of book.chapters)for(const section of chapter.sections){
  if(section.translationStatus==='translated')section.translationStatus='private_only';
  delete section.blocks;delete section.blocksEn;delete section.figures;delete section.sourceReview;
 }
 for(const q of questions)if(q.figure?.kind==='book')delete q.figure.src;
 assert.deepEqual(checkPublicContent({book,questions,glossary,guides:GUIDE_SECTIONS,originalNotes:notes,deepLessons:lessons}),[]);
});

test('bubble pressure, radius and latent energy agree with dimensional hand calculations',()=>{
 const sigma=.050, R=50e-6;
 close(2*sigma/R,2000); // (N/m)/m = Pa
 close(2*sigma/2500,40e-6);
 close(2*sigma/5000,20e-6);
 close(.0020*2.0e6,4000); // kg/s × J/kg = W
 close(60_000/15,4000); // W/m² ÷ K = W/(m²·K)
});
