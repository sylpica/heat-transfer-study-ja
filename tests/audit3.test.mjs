// Independent quality audit, round 3 (A3-*): regression checks for the fixes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {questionFieldGroup,questionMatchesField,FIELD_GROUP_ORDER,FIELD_GROUP_BY_CHAPTER,questionChapter} from '../chapter-curriculum.mjs';
import {GUIDE_SECTIONS} from '../guide.mjs';

const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));

test('A3-01: every published question belongs to one of the 11 chapter-based field groups',async()=>{
  const bank=await read('data/questions.json');
  assert.equal(FIELD_GROUP_ORDER.length,11);
  assert.equal(new Set(FIELD_GROUP_ORDER).size,11);
  const counts=new Map();
  for(const q of bank){
    const group=questionFieldGroup(q,GUIDE_SECTIONS);
    assert.ok(FIELD_GROUP_ORDER.includes(group),`${q.id}: authored field "${q.field}" fell through to "${group}"`);
    const chapter=questionChapter(q,GUIDE_SECTIONS);
    if(chapter)assert.equal(group,FIELD_GROUP_BY_CHAPTER[chapter],q.id);
    counts.set(group,(counts.get(group)||0)+1);
  }
  // Each group must be large enough to be a meaningful practice set (the old labels had many 1–4 question groups).
  for(const group of FIELD_GROUP_ORDER)assert.ok((counts.get(group)||0)>=20,`${group}: ${counts.get(group)||0}`);
  assert.equal([...counts.values()].reduce((a,b)=>a+b,0),bank.length);
});

test('A3-01: misleading authored labels are grouped by the topic actually practised',async()=>{
  const bank=await read('data/questions.json');
  const byId=id=>bank.find(q=>q.id===id);
  // Authored as 対流 but it is a chapter-8 natural-convection question.
  assert.equal(byId('supp-natural-beta-v1').field,'対流');
  assert.equal(questionFieldGroup(byId('supp-natural-beta-v1'),GUIDE_SECTIONS),'自然対流・膜状凝縮');
  // Authored as 熱伝導 but it practises Bi for transient (lumped) conduction.
  assert.equal(questionFieldGroup(byId('supp-expanded-bi-calc'),GUIDE_SECTIONS),'非定常・多次元熱伝導');
  // Simulator supplements without a book chapter follow their guide's topic.
  assert.equal(questionFieldGroup(byId('supp-radiation-numeric'),GUIDE_SECTIONS),'熱放射');
  assert.equal(questionFieldGroup(byId('supp-resistance-total'),GUIDE_SECTIONS),'定常熱伝導・熱抵抗');
  // All radiation-labelled variants now land in one group.
  const radiationLabels=['熱放射','放射','放射熱移動','熱放射・放射交換','放射形態係数'];
  for(const q of bank.filter(q=>radiationLabels.includes(q.field)))assert.equal(questionFieldGroup(q,GUIDE_SECTIONS),'熱放射',q.id);
});

test('A3-01: field filter accepts group names and legacy authored labels',async()=>{
  const bank=await read('data/questions.json');
  const q=bank.find(q=>q.id==='supp-natural-beta-v1');
  assert.equal(questionMatchesField(q,'all',GUIDE_SECTIONS),true);
  assert.equal(questionMatchesField(q,'自然対流・膜状凝縮',GUIDE_SECTIONS),true);
  assert.equal(questionMatchesField(q,'対流',GUIDE_SECTIONS),true,'old links keep working');
  assert.equal(questionMatchesField(q,'熱放射',GUIDE_SECTIONS),false);
  assert.equal(questionFieldGroup({field:'未知'},[]),'未知');
  assert.equal(questionFieldGroup(null,[]),'その他');
});

test('A3-01: simulator practice buttons name an existing field group exactly',async()=>{
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const literal=[...app.matchAll(/data-sim-practice="([^"$]+)"/g)].map(m=>m[1]);
  const templated=[...app.matchAll(/data-sim-practice="\$\{([^}]*)\}"/g)].flatMap(m=>[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1])).filter(v=>!['radiation','convection'].includes(v));
  const values=[...literal,...templated];
  assert.ok(values.length>=4,values.join());
  for(const value of values)assert.ok(FIELD_GROUP_ORDER.includes(value),value);
  assert.match(app,/o\.value===simPractice\.dataset\.simPractice/,'exact match, not substring');
});

test('A3-02: flat-plate average-Nu explanation cites eq. (6.68) and has no stray audit remark',async()=>{
  const [bank,part2]=await Promise.all([read('data/questions.json'),read('data/applied-exercises-part2.json')]);
  for(const q of [bank.find(q=>q.id==='supp-applied-6-5-v1'),part2.questions.find(q=>q.id==='supp-applied-6-5-v1')]){
    assert.match(q.explanation,/式\(6\.68\)/);
    assert.doesNotMatch(q.explanation,/上限50/);
    assert.equal(q.revision,'v2','explanation-only fix keeps the revision');
    assert.ok(q.reportHistory.some(r=>r.issue?.includes('A3-02')));
  }
  assert.deepEqual(bank.find(q=>q.id==='supp-applied-6-5-v1').explanation,part2.questions.find(q=>q.id==='supp-applied-6-5-v1').explanation);
});
