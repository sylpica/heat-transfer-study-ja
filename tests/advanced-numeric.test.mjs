import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GUIDE_SECTIONS} from '../guide.mjs';
import {validateQuestion} from '../study-core.mjs';

const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
test('11 advanced numerical problems are unique, consistently explained and cover each chapter',async()=>{
  const [source,all]=await Promise.all([read('data/original-advanced-questions.json'),read('data/questions.json')]);
  assert.equal(source.questions.length,11);
  assert.ok(all.length>=265);
  const seen=new Set();
  const expected={
    1:'3,000 W/m² と36,000 J',2:'150 W と15 K',3:'7.28 kW',4:'0.482',5:'138.6 s',
    6:'3.984 W/(m²·K)',7:'261.6 W/(m²·K)',8:'16倍',9:'3.0×10⁶ W/m²',10:'794 W',11:'+6.0×10⁻⁷ mol/(m²·s)'
  };
  for(const q of source.questions){
    assert.equal(validateQuestion(q),'',q.id);
    assert.equal(q.source.type,'supplement');
    assert.equal(q.questionGroup,'original_independent_numerical_v1');
    assert.equal(q.expertReviewed,false);
    assert.equal(q.revision,['supp-advanced-ch1-calc','supp-advanced-ch5-calc','supp-advanced-ch9-calc'].includes(q.id)?'v2':'v1');
    assert.ok(q.difficulty.includes('発展'));
    assert.ok(q.hints.length>=2&&q.solutionSteps.length>=3);
    assert.equal(q.distractors.length,4);
    assert.equal(q.distractors.filter(t=>t.startsWith('正解。')).length,1,q.id);
    assert.ok(q.distractors[q.answer].startsWith('正解。'));
    assert.ok(GUIDE_SECTIONS.some(g=>g.id===q.source.guideId&&g.bookChapter===q.source.chapterId));
    assert.equal(q.choices[q.answer],expected[Number(q.source.chapterId.slice(2))]);
    assert.ok(!seen.has(q.source.chapterId));seen.add(q.source.chapterId);
    assert.deepEqual(all.find(x=>x.id===q.id),q);
  }
  assert.equal(seen.size,11);
});
test('independent arithmetic checks derived from first principles match the keyed numerical results',async()=>{
  const near=(actual,expected,tolerance=.01)=>assert.ok(Math.abs(actual-expected)<=tolerance,'expected '+expected+' got '+actual);
  near(240/.080,3000,1e-9);
  near(240*150,36000,1e-9);
  near(30/(.05+.10+.05),150,1e-9);
  near((30/(.05+.10+.05))*.10,15,1e-9);
  near(100*2*(60-20)/Math.log(60/20)/1000,7.28,.005);
  near(Math.tanh(2)/2,.482,.001);
  near(100*Math.log((100-20)/(40-20)),138.6,.1);
  near(.664*Math.sqrt(4e4)*.030/1,3.984,1e-9);
  near(4.36*.60/.010,261.6,1e-8);
  near(2**3*2,16,1e-9);
  near(.030*2e6/.020,3e6,.01);
  near(.8*5.67e-8*(400**4-300**4),793.8,.1);
  near(-2e-9*(-200)+.25*8e-7,6e-7,1e-12);
});
