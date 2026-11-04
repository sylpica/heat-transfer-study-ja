import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GUIDE_SECTIONS} from '../guide.mjs';
import {questionChapter,questionsForChapter,chapterLearningOverview} from '../chapter-curriculum.mjs';

const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
test('all eleven chapters have distinct independently authored question sets with precise source boundaries',async()=>{
  const [book,questions]=await Promise.all([read('data/book.json'),read('data/questions.json')]);
  const chapters=new Set(book.chapters.map(ch=>ch.id));
  const chapterCounts=Object.fromEntries(book.chapters.map(ch=>[ch.id,ch.sections.length]));
  assert.equal(chapters.size,11);
  const classified=questions.filter(q=>questionChapter(q,GUIDE_SECTIONS));
  assert.equal(classified.length,718); // Chapter-linked questions include six new §9.3 exercises
  for(const chapter of chapters){
    const qs=questionsForChapter(questions,chapter,GUIDE_SECTIONS);
    assert.equal(qs.filter(q=>q.source.type==='supplement').length,6+chapterCounts[chapter]+(['ch2','ch4','ch5','ch10','ch11'].includes(chapter)?4:0)+({'ch1':32,'ch2':31,'ch3':26,'ch4':30,'ch5':50,'ch6':61,'ch7':47,'ch9':111,'ch10':37,'ch11':72,'ch8':51}[chapter]||0),chapter);
    assert.equal(qs.filter(q=>q.source.type==='book').length,chapter==='ch9'?7:chapter==='ch1'?1:0,chapter);
  }
  assert.equal(questionsForChapter(questions,'unknown',GUIDE_SECTIONS).length,0);
  const legacy=questions.find(q=>q.id==='supp-flat-thickness');
  assert.equal(questionChapter(legacy,GUIDE_SECTIONS),null,'Generic supplemental topic must not be mislabeled as a textbook chapter');
  assert.equal(questionChapter({source:{type:'book',section:'9.2'}},GUIDE_SECTIONS),'ch9');
  assert.equal(questionChapter({source:{type:'book',section:'x.y'}},GUIDE_SECTIONS),null);
});
test('chapter overview uses most recent per-question answer and never implies full text translation',async()=>{
  const [book,questions]=await Promise.all([read('data/book.json'),read('data/questions.json')]);
  const attempts=[
    {questionId:'supp-chapter-ch2-series',at:'2026-10-28T09:00:00+09:00',correct:false},
    {questionId:'supp-chapter-ch2-series',at:'2026-10-28T09:30:00+09:00',correct:true},
    {questionId:'supp-chapter-ch3-qmax',at:'2026-10-28T09:30:00+09:00',correct:false},
    {questionId:'supp-chapter-ch2-series',at:'invalid',correct:false},
    {questionId:'wrong-id',at:'2026-10-28T09:30:00+09:00',correct:true}
  ];
  const overview=chapterLearningOverview(book,questions,GUIDE_SECTIONS,attempts,{'2.1':true,'2.2':true});
  assert.equal(overview.length,11);
  const ch2=overview.find(ch=>ch.chapter==='ch2');
  assert.equal(ch2.guideId,'chapter2-cylindrical-conduction');
  assert.equal(ch2.practiceQuestionCount,46);
  assert.equal(ch2.attemptedQuestions,1);
  assert.equal(ch2.latestCorrect,1);
  assert.equal(ch2.sectionsMarkedRead,2);
  const ch3=overview.find(ch=>ch.chapter==='ch3');
  assert.equal(ch3.attemptedQuestions,1);
  assert.equal(ch3.latestCorrect,0);
  const ch9=overview.find(ch=>ch.chapter==='ch9');
  assert.equal(ch9.practiceQuestionCount,135);
  assert.equal(ch9.bookCitedQuestionCount,7);
  assert.equal(overview.reduce((sum,x)=>sum+x.practiceQuestionCount,0),718);
  const numerical=chapterLearningOverview(book,questions,GUIDE_SECTIONS,[
    {questionId:'supp-chapter-ch2-series',at:Date.UTC(2026,9,28,0),correct:true},
    {questionId:'supp-chapter-ch2-series',at:'2026-10-28T10:00:00+09:00',correct:false}
  ]);
  assert.equal(numerical.find(ch=>ch.chapter==='ch2').latestCorrect,0,'Numeric legacy timestamps participate in last-answer ranking');
  assert.deepEqual(chapterLearningOverview(null,[],[]),[]);
});

test('chapter roadmap distinguishes stale old-revision scores, wrong responses and truly unanswered practice',async()=>{
  const [book,all]=await Promise.all([read('data/book.json'),read('data/questions.json')]);
  const questions=all.map(q=>q.id==='supp-chapter-ch2-series'?{...q,revision:'v2'}:q);
  const attempts=[
    {questionId:'supp-chapter-ch2-series',at:'2026-10-27T09:00:00Z',correct:true,questionRevision:'initial'},
    {questionId:'supp-chapter-ch2-cylinder-watts',at:'2026-10-28T08:00:00Z',correct:false,questionRevision:'initial'}
  ];
  const overview=chapterLearningOverview(book,questions,GUIDE_SECTIONS,attempts);
  const ch2=overview.find(c=>c.chapter==='ch2');
  assert.equal(ch2.historicalAttemptedQuestions,2);
  assert.equal(ch2.attemptedQuestions,1);
  assert.equal(ch2.latestCorrect,0);
  assert.equal(ch2.outdatedQuestions,1);
  assert.equal(ch2.latestIncorrect,1);
  assert.equal(ch2.unansweredQuestions,44);
  assert.equal(ch2.recommendedQuestionIds.length,46);
  assert.equal(ch2.recommendedQuestionIds[0],'supp-chapter-ch2-series','Outdated question should be retried before unseen questions');
  const current=chapterLearningOverview(book,questions,GUIDE_SECTIONS,[...attempts,
    {questionId:'supp-chapter-ch2-series',at:'2026-10-28T10:00:00Z',correct:true,questionRevision:'v2'}
  ]).find(c=>c.chapter==='ch2');
  assert.equal(current.outdatedQuestions,0);
  assert.equal(current.attemptedQuestions,2);
  assert.equal(current.latestCorrect,1);
  assert.equal(current.recommendedQuestionIds.length,45);
  assert.equal(current.practiceQuestionIds.length,46);
  assert.equal(current.sectionsMarkedRead,0,'Old answers do not modify book reading marks');
});
