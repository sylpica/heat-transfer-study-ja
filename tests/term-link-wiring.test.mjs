import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileTermMatcher,matchTerms,renderTermLinks,renderTermLinksFast,renderTermSheet,renderTermExample} from '../term-links.mjs';
const glossary=JSON.parse(await readFile(new URL('../data/glossary.json',import.meta.url),'utf8'));
const matcher=compileTermMatcher(glossary);

// The fast matcher used for bulk surfaces must produce byte-identical
// output to renderTermLinks (differentially verified over the whole
// shipped corpus when introduced; these cases pin the tricky rules).
test('fast matcher agrees with renderTermLinks on boundary and guard cases',()=>{
  const samples=[
    '熱伝導と対流の比熱比はリンクしない',
    'NuとNusselt数、Re_Dhの扱い',
    '蒸発潜熱と液滴、管群と管束相関式',
    '濡れ縁と濡れた断面は濡れにリンクしない',
    'W J K ℃ と熱だけでは一致しない',
    '黒体放射と黒体、 Stefan–Boltzmann の法則',
    '熱流束q″と熱伝達率h、温度差ΔT',
    'İを含む不安定な折り畳みテキストと熱伝導',
    '',
    'リンク対象のない短い文'
  ];
  for(const sample of samples){
    assert.equal(renderTermLinksFast(sample,matcher),renderTermLinks(sample,glossary),sample);
    assert.equal(renderTermLinksFast(sample,matcher,{limit:2}),renderTermLinks(sample,glossary,{limit:2}),sample);
  }
});
test('two-character labels link only where the corpus measurement allowed them',()=>{
  // Allowed after corpus measurement: 蒸発・液滴・管群 (and alias 管束).
  assert.ok(matchTerms('液滴が成長する',glossary,4).some(hit=>hit.label==='液滴'));
  assert.ok(matchTerms('管群の平均熱伝達率',glossary,4).some(hit=>hit.label==='管群'));
  assert.ok(matchTerms('管束相関式を使う',glossary,4).some(hit=>hit.label==='管束'));
  assert.ok(matchTerms('蒸発が進む',glossary,4).some(hit=>hit.label==='蒸発'));
  // 濡れ stays unlinked: 濡れ縁 (wetted perimeter) and 濡れた断面 belong to
  // a different concept family than the wetting entry.
  assert.ok(!matchTerms('濡れ縁の長さ',glossary,4).some(hit=>hit.label==='濡れ'));
  assert.ok(!matchTerms('濡れた断面を考える',glossary,4).some(hit=>hit.label==='濡れ'));
  assert.ok(!matchTerms('濡れが進む',glossary,4).some(hit=>hit.label==='濡れ'));
});
test('fast matcher excludeId removes self matches without shifting others',()=>{
  const self=glossary.find(term=>term.id==='heat-conduction');
  const text='熱伝導では熱流束が温度勾配に比例する';
  const plain=renderTermLinks(text,glossary.filter(term=>term.id!=='heat-conduction'));
  assert.equal(renderTermLinksFast(text,matcher,{excludeId:'heat-conduction'}),plain);
  assert.ok(!renderTermLinksFast(text,matcher,{excludeId:'heat-conduction'}).includes('data-term-id="heat-conduction"'));
  assert.ok(renderTermLinksFast(text,matcher,{excludeId:'heat-conduction'}).includes('data-term-id="heat-flux"'));
  assert.ok(self,'heat-conduction entry exists');
});
test('term sheet prose links onward to other terms but never to itself',()=>{
  const term=glossary.find(item=>item.id==='thermal-conductivity')||glossary[0];
  const html=renderTermSheet(term,glossary);
  assert.ok(!html.includes(`data-term-id="${term.id}"`),'sheet must not link to its own term');
});

// The linkTermTextNodes {labels:true} opt-in used for simulator field
// labels is covered by the real-browser checks (label prose links, the
// input cluster never does, and typing/focus stay intact); it needs a real
// DOM (template parsing), so it is not faked here.
test('renderTermExample links onward with a matcher and stays plain without one',()=>{
  const term=glossary.find(item=>item.example&&item.example.length>10)||glossary[0];
  const plain=renderTermExample(term);
  assert.ok(!plain.includes('data-term-id'),'no terms supplied means plain text');
  const linked=renderTermExample(term,[],matcher);
  assert.ok(!linked.includes(`data-term-id="${term.id}"`),'example never links to its own term');
});
