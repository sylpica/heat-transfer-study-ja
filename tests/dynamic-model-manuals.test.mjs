import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL_MANUALS} from '../dynamic/model-manuals.mjs';

// The §21 manuals in docs/dynamic/ are the source of truth; this module is
// generated from them by scripts/generate-model-manuals.mjs. These tests pin
// the structure the in-app #manual renderer relies on, plus spot values that
// must survive transcription unchanged.
const TITLES=['現象の概要','現実世界での使用例','支配方程式','記号と単位','初期条件','境界条件','数値計算法','計算過程','グラフの読み方','結果の解釈','モデルの仮定','モデルの限界','よくある誤解','関連教材','関連問題','参考文献'];
const LEAD_LABELS=new Set(['対象モデル','対象範囲','注意','状態','読み分け']);
const texts=[];
const collect=block=>{
  if(block.t==='p'||block.t==='h')texts.push(block.x);
  else if(block.t==='ul'||block.t==='ol')for(const item of block.items){texts.push(item.x);if(item.sub)collect(item.sub);}
  else if(block.t==='table'){texts.push(...block.head,...block.rows.flat());}
  else assert.fail(`unknown block type ${block.t}`);
};
test('model manuals cover 15 models with the canonical 16 items each',()=>{
  assert.equal(MODEL_MANUALS.length,15);
  assert.equal(new Set(MODEL_MANUALS.map(m=>m.id)).size,15);
  for(const manual of MODEL_MANUALS){
    assert.match(manual.source,/^docs\/dynamic\/.+_20261107\.md$/);
    assert.ok(manual.lead.length>=2&&manual.lead.every(l=>LEAD_LABELS.has(l.label)),`${manual.id} lead labels`);
    assert.equal(manual.items.length,16);
    manual.items.forEach((item,index)=>{
      assert.equal(item.n,index+1);
      assert.equal(item.title,TITLES[index],`${manual.id} item ${item.n}`);
      assert.ok(item.blocks.length>=1,`${manual.id} item ${item.n} has blocks`);
      for(const block of item.blocks)collect(block);
    });
  }
});
test('transcribed text keeps balanced inline markers and no heading residue',()=>{
  assert.ok(texts.length>900);
  for(const text of texts){
    assert.ok(!/(^|\s)#{1,6}\s/.test(text),text.slice(0,60));
    assert.equal((text.match(/\*\*/g)||[]).length%2,0,text.slice(0,60));
    assert.equal((text.match(/`/g)||[]).length%2,0,text.slice(0,60));
  }
});
test('spot values are transcribed from the source manuals unchanged',()=>{
  const byId=id=>MODEL_MANUALS.find(m=>m.id===id);
  const sigma=byId('transient-rectangular').items[3].blocks.find(b=>b.t==='table').rows.find(r=>r[0]==='σ');
  assert.ok(sigma&&sigma[1].includes('5.670374419×10⁻⁸'));
  const annular15=byId('fin-annular').items[14].blocks.map(b=>b.x||'').join('');
  assert.match(annular15,/対応する問題はない/);
  const wind5=byId('fin-wind-h').items[4].blocks.map(b=>b.x||'').join('');
  assert.match(wind5,/初期条件は存在しない/);
  assert.ok(byId('natural-cavity').lead.some(l=>l.label==='状態'));
  assert.ok(byId('transient-triangle').lead.some(l=>l.label==='注意'));
});
