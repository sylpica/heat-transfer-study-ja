import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GUIDE_SECTIONS} from '../guide.mjs';
import {learningCoverage} from '../learning-coverage.mjs';
const read=async name=>JSON.parse(await readFile(new URL('../'+name,import.meta.url),'utf8'));

test('coverage report separates original problems from verified book citation and public Japanese lessons',async()=>{
  const [book,questions,glossary,contentManifest,originalNotes,deepLessons]=await Promise.all(['data/book.json','data/questions.json','data/glossary.json','data/content-manifest.json','data/original-notes.json','data/original-deep-lessons.json'].map(read));
  const coverage=learningCoverage({book,questions,glossary,guides:GUIDE_SECTIONS,contentManifest,originalNotes,deepLessons});
  assert.equal(coverage.pdfPages,810);
  assert.equal(coverage.textbookSections,76);
  assert.equal(coverage.chapterCount,11);
  assert.equal(coverage.oldPcDraftOrPrivateRecordSections,46);
  assert.equal(coverage.oldPcDraftOnlyRecordSections,44);
  assert.equal(coverage.protectedPriorSections,2);
  assert.equal(coverage.publicJapaneseSections,76);
  assert.equal(coverage.totalQuestions,751);
  assert.equal(coverage.appCreatedQuestions,743);
  assert.equal(coverage.bookCitedQuestions,8);
  assert.equal(coverage.sectionsWithBookCitedQuestions,3);
  assert.equal(coverage.guideEntries,49);
  assert.equal(coverage.glossaryTerms,glossary.length);
  assert.equal(Object.values(coverage.practiceByField).reduce((a,b)=>a+b,0),751);
  assert.equal(coverage.chapters.reduce((a,b)=>a+b.sectionCount,0),76);
  assert.equal(coverage.chapters.reduce((a,b)=>a+b.citedPracticeQuestions,0),8);
  assert.equal(coverage.originalChapterGuides,11);
  assert.equal(coverage.chaptersWithOriginalPractice,11);
  assert.equal(coverage.chapters.reduce((a,b)=>a+b.originalPracticeQuestions,0),711);
  assert.equal(coverage.chapters.reduce((a,b)=>a+b.originalGuideEntries,0),11);
  assert.ok(coverage.chapters.every(c=>c.originalPracticeQuestions===6+c.sectionCount+(['ch2','ch4','ch5','ch10','ch11'].includes(c.chapter)?4:0)+({'ch1':32,'ch2':31,'ch3':26,'ch4':30,'ch5':50,'ch6':62,'ch7':47,'ch9':111,'ch10':37,'ch11':72,'ch8':51}[c.chapter]||0)&&c.originalGuideEntries===1));
  assert.equal(coverage.independentlyAuthoredJapaneseNotes,76);
  assert.equal(coverage.originalDeepLessons,76);
  assert.equal(coverage.chapters.find(x=>x.chapter==='ch1').originalDeepLessonCount,5);
  assert.equal(coverage.chapters.find(x=>x.chapter==='ch6').originalDeepLessonCount,9);
  assert.equal(coverage.chapters.find(x=>x.chapter==='ch9').originalDeepLessonCount,11);
  assert.equal(coverage.chapters.find(x=>x.chapter==='ch7').originalDeepLessonCount,7);
  assert.equal(coverage.chapters.find(x=>x.chapter==='ch8').originalDeepLessonCount,5);
  assert.equal(coverage.chapters.find(x=>x.chapter==='ch3').originalDeepLessonCount,4);
  assert.equal(coverage.chapters.find(x=>x.chapter==='ch4').originalDeepLessonCount,5);
  assert.equal(coverage.chapters.find(x=>x.chapter==='ch5').originalDeepLessonCount,8);
  assert.equal(coverage.chapters.find(x=>x.chapter==='ch2').originalDeepLessonCount,5);
  assert.equal(coverage.chapters.find(x=>x.chapter==='ch10').originalDeepLessonCount,6);
   assert.equal(coverage.chapters.find(x=>x.chapter==='ch11').originalDeepLessonCount,11);
  assert.equal(coverage.publicJapaneseSections,76,'Independent advanced lessons are not book translations; this count comes only from manifested translation files');
  assert.equal(coverage.sectionsWithIndependentCheckQuestions,76);
  assert.equal(coverage.publicJapaneseSections,76,'Section notes do not count as full textbook translations; this count comes only from manifested translation files');
  assert.ok(coverage.chapters.every(c=>c.independentSectionNotes===c.sectionCount&&c.independentSectionQuestions===c.sectionCount));


});
test('coverage never assigns public Japanese-translation progress from an unexamined manifest',async()=>{
  const [book,questions,glossary]=await Promise.all(['data/book.json','data/questions.json','data/glossary.json'].map(read));
  const input={book,questions,glossary,guides:GUIDE_SECTIONS};
  assert.equal(learningCoverage({...input,contentManifest:{files:[]}}).publicJapaneseSections,0);
  assert.equal(learningCoverage({...input,contentManifest:{files:['data/sections/pending.json']}}).publicJapaneseSections,null);
});
