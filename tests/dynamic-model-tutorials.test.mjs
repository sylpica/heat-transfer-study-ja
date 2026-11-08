import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL_MANUALS} from '../dynamic/model-manuals.mjs';
import {MODEL_TUTORIALS} from '../dynamic/model-tutorials.mjs';

// Every model that has a §21 manual in the in-app #manual also has a
// tutorial with the same three stages (touch / observe / check). Numbers
// quoted in the check stage must match the verified record transcribed in
// the manuals, so a few anchors are pinned here.
test('tutorials cover exactly the 15 manual models, one entry each',()=>{
  assert.equal(MODEL_TUTORIALS.length,15);
  assert.deepEqual(MODEL_TUTORIALS.map(t=>t.id).sort(),MODEL_MANUALS.map(m=>m.id).sort());
});
test('each tutorial has all three stages with concise steps and balanced markers',()=>{
  for(const tutorial of MODEL_TUTORIALS){
    for(const stage of ['touch','observe','check']){
      assert.ok(Array.isArray(tutorial[stage])&&tutorial[stage].length>=2,`${tutorial.id} ${stage} has at least two steps`);
      for(const step of tutorial[stage]){
        assert.equal(typeof step,'string');
        assert.ok(step.length<=240,`${tutorial.id} step stays concise: ${step.slice(0,40)}`);
        assert.equal((step.match(/\*\*/g)||[]).length%2,0,step.slice(0,60));
        assert.equal((step.match(/`/g)||[]).length%2,0,step.slice(0,60));
        assert.ok(!/<[a-z][^>]*>/i.test(step),`${tutorial.id} step has no raw HTML`);
      }
    }
  }
});
test('check-stage anchors match the verified values in the manuals and records',()=>{
  const check=id=>MODEL_TUTORIALS.find(t=>t.id===id).check.join('\n');
  assert.match(check('fin-straight-tip'),/340\.239853 K/);
  assert.match(check('fin-straight-tip'),/340\.746691 K/);
  assert.match(check('forced-graetz-channel'),/8\.235294/);
  assert.match(check('forced-graetz-channel'),/5\.384615/);
  assert.match(check('forced-pipe-heat-flux'),/4\.36447122/);
  assert.match(check('forced-pipe-wall-temperature'),/3\.6567934578/);
  assert.match(check('natural-cavity'),/1\.118329/);
  assert.match(check('forced-flat-plate'),/0\.3320573362/);
  assert.match(check('radiation-surface-exchange'),/498\.4157 K/);
  assert.match(check('radiation-surface-exchange'),/6087\.01/);
  assert.match(check('radiation-long-duct'),/√2 − 1/);
});
