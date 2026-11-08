import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withoutRepeatedLead} from '../term-links.mjs';
import {createEmptyState,validateLearningData,normalizeLearningData,sessionSummaryMismatch} from '../study-core.mjs';
import {questionCoverage,questionEvidenceHash} from '../scripts/audit-question-coverage.mjs';

test('a definition identical to its visible brief contributes no repeated paragraph', () => {
  const text='温度差が駆動力となる。';
  assert.equal(withoutRepeatedLead(text,text),'');
  assert.equal(withoutRepeatedLead(text+' 条件を確認する。',text),'条件を確認する。');
  assert.equal(withoutRepeatedLead('別の定義。',text),'別の定義。');
  assert.equal(withoutRepeatedLead(text,''),text);
});

test('all shipped brief/meaning pairs preserve the full definition without equality duplicates', async () => {
  const terms=JSON.parse(await readFile(new URL('../data/glossary.json',import.meta.url),'utf8'));
  let equalityCases=0;
  for(const term of terms)for(const language of ['ja','en']){
    const summary=language==='en'?(term.meaningEn||term.brief||term.meaning):(term.brief||term.meaning);
    const meaning=language==='en'?(term.meaningEn||term.meaning):term.meaning;
    const remainder=withoutRepeatedLead(meaning,summary);
    if(meaning===summary){equalityCases++;assert.equal(remainder,'',term.id);}
    if(meaning.startsWith(summary))assert.equal((summary+remainder).replace(/\s/g,''),meaning.replace(/\s/g,''),term.id+' loses definition text');
    else assert.equal(remainder,meaning,term.id);
  }
  assert.ok(equalityCases>0,'the regression must exercise complete equal definitions');
});

test('inconsistent session detail is identified without changing legacy snapshots', () => {
  const state=createEmptyState();
  const s={id:'audit-session',date:'2026-11-08',startedAt:'2026-11-08T00:00:00Z',total:99,correct:99,answers:[]};
  state.sessions=[s];
  assert.equal(validateLearningData({...state,format:'heat-study-ja-learning-data'}),'');
  const loaded=normalizeLearningData(state);
  assert.equal(sessionSummaryMismatch(loaded.sessions[0]),true);
  assert.deepEqual(loaded.sessions[0],s,'preserve stored history');
  assert.equal(sessionSummaryMismatch({total:2,correct:1,answers:[{correct:true},{correct:false}]}),false);
  assert.equal(sessionSummaryMismatch({total:2,correct:2,answers:[{correct:true},{correct:false}]}),true);
  assert.equal(sessionSummaryMismatch({total:99,correct:99}),false,'legacy summaries without detailed answers cannot be contradicted');
});

test('review labels and peer counts cannot conceal absent or stale question evidence', () => {
  const q={id:'q',prompt:'条件A',choices:['A','B','C','D'],answer:0,explanation:'Aの根拠',reviewStatus:'独立再計算済み'};
  assert.equal(questionCoverage([q],['q']).current_content_receipts,0);
  assert.equal(questionCoverage([q],['q']).all_working_linked,false);
  const receipt={id:'q',content_sha256:questionEvidenceHash(q),independent_choice_index:0,working:'条件AからAを導出'};
  assert.equal(questionCoverage([q],[],[receipt]).all_working_linked,true);
  assert.equal(questionCoverage([{...q,explanation:'異なる根拠'}],[],[receipt]).current_content_receipts,0);
  assert.equal(questionCoverage([{...q,choices:['変更','B','C','D']}],[],[receipt]).current_content_receipts,0);
  assert.deepEqual(questionCoverage([q],[],[{...receipt,independent_choice_index:2}]).invalid_receipts,['q']);
});
