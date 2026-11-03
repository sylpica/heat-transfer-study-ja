import { isCurrentQuestionAnswer } from './study-core.mjs';
// This curriculum tracks *available, independently authored* study aids,
// not completion of the source book, translation, or professional competence.
const chapterId = value => /^ch(?:[1-9]|10|11)$/.test(String(value||'')) ? value : null;

export function questionChapter(question, guides=[]) {
  const source=question?.source;
  if(!source || typeof source!=='object')return null;
  if(source.type==='book'){
    const match=String(source.section||'').match(/^([1-9]|10|11)\./);
    return match?'ch'+match[1]:null;
  }
  if(source.type!=='supplement')return null;
  if(chapterId(source.chapterId))return source.chapterId;
  const guide=guides.find(g=>g.id===source.guideId);
  return chapterId(guide?.bookChapter);
}

// Learner-facing topic groups ("分野") for the field map, field filter and
// session summaries. Authored `field` labels grew to ~50 near-duplicates
// (e.g. 放射 / 熱放射 / 放射熱移動) and some are misleading (対流 also tags
// chapter-8 natural convection and condensation), so grouping follows the
// book chapter each question is tied to. The authored `field` label is kept
// as data and still shown on each question card.
export const FIELD_GROUP_BY_CHAPTER = Object.freeze({
  ch1:'熱移動の基礎・熱収支', ch2:'定常熱伝導・熱抵抗', ch3:'熱交換器', ch4:'熱伝導の解析・フィン',
  ch5:'非定常・多次元熱伝導', ch6:'対流の基礎・境界層', ch7:'管内流・円柱横流れ', ch8:'自然対流・膜状凝縮',
  ch9:'沸騰・相変化', ch10:'熱放射', ch11:'物質移動'
});
export const FIELD_GROUP_ORDER = Object.freeze(Object.values(FIELD_GROUP_BY_CHAPTER));
// Simulator/learning guides without a bookChapter; mapped to the chapter whose topic they practise.
const GUIDE_FIELD_CHAPTER = Object.freeze({
  'sim-conduction':'ch2', 'sim-resistance':'ch2', 'sim-convection':'ch6', 'learn-convection-dimensionless':'ch6',
  'sim-radiation':'ch10', 'learn-dimensionless-transient':'ch5', 'learn-lumped-cooling':'ch5', 'learn-heat-exchanger':'ch3'
});

export function questionFieldGroup(question, guides=[]) {
  const chapter=questionChapter(question,guides)||GUIDE_FIELD_CHAPTER[question?.source?.guideId];
  return FIELD_GROUP_BY_CHAPTER[chapter]||(typeof question?.field==='string'&&question.field)||'その他';
}

// Accepts a group name or, for older bookmarks/links, an authored field label.
export function questionMatchesField(question, field, guides=[]) {
  if(!field||field==='all')return true;
  return questionFieldGroup(question,guides)===field||question?.field===field;
}

export function questionsForChapter(questions,chapter,guides=[]) {
  if(!chapterId(chapter))return [];
  return questions.filter(q=>questionChapter(q,guides)===chapter);
}

export function chapterLearningOverview(book,questions,guides,attempts=[],readSections={}) {
  if(!Array.isArray(book?.chapters)||!Array.isArray(questions)||!Array.isArray(guides))return [];
  const last=new Map();
  for(const attempt of attempts){
    if(!attempt || typeof attempt.questionId!=='string')continue;
    const at=typeof attempt.at==='number'?attempt.at:Date.parse(String(attempt.at||''));
    if(!Number.isFinite(at))continue;
    const existing=last.get(attempt.questionId);
    if(!existing||at>=existing.time)last.set(attempt.questionId,{time:at,correct:attempt.correct===true,questionRevision:attempt.questionRevision});
  }
  return book.chapters.map(chapter=>{
    const qs=questionsForChapter(questions,chapter.id,guides);
    const guide=guides.find(g=>g.bookChapter===chapter.id)||null;
    const historical=qs.filter(q=>last.has(q.id));
    const answered=historical.filter(q=>isCurrentQuestionAnswer(q,last.get(q.id)));
    const outdated=historical.filter(q=>!isCurrentQuestionAnswer(q,last.get(q.id)));
    const incorrect=answered.filter(q=>!last.get(q.id).correct);
    const unseen=qs.filter(q=>!last.has(q.id));
    const correct=answered.filter(q=>last.get(q.id).correct).length;
    const recommendedQuestionIds=[...outdated,...incorrect,...unseen].map(q=>q.id);
    return {
      chapter:chapter.id,
      title:chapter.title,
      guideId:guide?.id||null,
      sectionCount:chapter.sections.length,
      sectionsMarkedRead:chapter.sections.filter(s=>readSections?.[s.id]===true).length,
      practiceQuestionCount:qs.length,
      bookCitedQuestionCount:qs.filter(q=>q.source?.type==='book').length,
      attemptedQuestions:answered.length,
      historicalAttemptedQuestions:historical.length,
      outdatedQuestions:outdated.length,
      unansweredQuestions:unseen.length,
      latestIncorrect:incorrect.length,
      latestCorrect:correct,
      recommendedQuestionIds,
      practiceQuestionIds:qs.map(q=>q.id)
    };
  });
}
