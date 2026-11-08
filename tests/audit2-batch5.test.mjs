// Regression tests for audit phase B-4 (register batch 5: documentation,
// accessibility and remaining P3 items). Each test names its finding ID.
// DOM-dependent behaviour is pinned by source-structure assertions plus
// module-level behaviour tests; real screen-reader and real-device checks
// remain unverified and are recorded as such in the batch log.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchTerms, renderTermLinks} from '../term-links.mjs';
import {calculateNucleateBoiling, NUCLEATE_DEFAULTS} from '../pool-boiling-nucleate.mjs';

const readText=async file=>await readFile(new URL('../'+file,import.meta.url),'utf8');
const readJson=async file=>JSON.parse(await readText(file));
const [glossary,questions,appJs,stylesCss,indexHtml,swJs,readme,verification,sectionProgressMd]=await Promise.all([
  readJson('data/glossary.json'),readJson('data/questions.json'),readText('app.js'),readText('styles.css'),
  readText('index.html'),readText('sw.js'),readText('README.md'),readText('docs/VERIFICATION.md'),readText('docs/SECTION_PROGRESS.md')]);
const term=id=>glossary.find(t=>t.id===id);

// ---------- A2-UXS-09: false-compound term links ----------
test('A2-UXS-09: 比熱比 and 対流圏 are not split into head-term links',()=>{
  assert.equal(matchTerms('比熱比は温度によって変わる',glossary).some(m=>m.label==='比熱'),false);
  assert.equal(matchTerms('対流圏の上端は圏界面である',glossary).some(m=>m.label==='対流'),false);
  assert.equal(renderTermLinks('比熱比を用いる',glossary).includes('data-term-id'),false);
});
test('A2-UXS-09: legitimate links survive (standalone and compound-head uses)',()=>{
  assert.equal(matchTerms('比熱は温度で変わる',glossary).some(m=>m.label==='比熱'),true);
  assert.equal(matchTerms('対流は流れを伴う熱移動である',glossary).some(m=>m.label==='対流'),true);
  // Prefix-of-compound uses the audit itself accepted stay linked.
  assert.equal(matchTerms('黒体放射は温度の4乗に比例する',glossary).some(m=>m.label==='黒体'),true);
  assert.equal(matchTerms('対流境界層が発達する',glossary).some(m=>m.label==='対流'),true);
  assert.equal(matchTerms('非定常伝導を解く',glossary).some(m=>m.label==='非定常'),true);
});
test('A2-UXS-09: no shipped question/glossary text links inside a false compound',()=>{
  const texts=[];
  for(const q of questions){texts.push(q.prompt,q.explanation,...(q.choices||[]).map(c=>c.text||''));}
  for(const t of glossary){for(const k of ['meaning','detail','brief','beginner','example'])if(typeof t[k]==='string')texts.push(t[k]);}
  for(const text of texts){
    for(const m of matchTerms(text,glossary,100)){
      const compound=text.slice(m.start,m.start+3);
      assert.ok(!(m.label==='比熱'&&compound==='比熱比'),`false link in: ${text.slice(0,40)}`);
      assert.ok(!(m.label==='対流'&&compound==='対流圏'),`false link in: ${text.slice(0,40)}`);
    }
  }
});

// ---------- A2-UXS-12: related-label integrity ----------
test('A2-UXS-12: every glossary related label resolves to exactly one term',()=>{
  for(const t of glossary){
    for(const r of t.related||[]){
      if(r===t.ja||r===t.en||(t.aliases||[]).includes(r))continue;
      const hits=glossary.filter(x=>x.ja===r||x.en===r||(x.aliases||[]).includes(r));
      assert.equal(hits.length,1,`${t.id} related "${r}" resolves to ${hits.length} terms`);
    }
  }
  assert.equal(term('kelvin').related.includes('熱放射'),false);
  assert.equal(term('buckingham-pi-theorem').related.includes('数学・単位'),false);
  assert.equal(term('hydraulic-diameter').related.includes('乱流'),true);
  assert.equal(term('fick-diffusive-flux').related.includes('濃度勾配'),false);
});

// ---------- Glossary additions and detail appends (B-3 proposals) ----------
test('glossary proposals: 475 terms at batch-5 time (504 after the 2026-11-07 expansion); five source-verified additions carry the full schema',()=>{
  // 2026-11-07 expansion added 29 further source-verified terms (docs/GLOSSARY_EXPANSION_20261107.md).
  assert.equal(glossary.length,504);
  for(const id of ['entropy-generation','radiation-heat-transfer-coefficient','temperature-efficiency-p','temperature-ratio-r','p-ntu-method']){
    const t=term(id);assert.ok(t,`${id} missing`);
    for(const key of ['ja','en','meaning','brief','beginner','detail','formula','unit','category','related','relatedSections','source','reviewStatus'])
      assert.ok(t[key]!==undefined&&t[key]!=='',`${id}.${key} missing`);
    assert.equal(t.source.type,'supplement');
    assert.equal(t.reviewStatus,'needs_review');
  }
  assert.match(term('entropy-generation').detail,/\(1\.7\)/);
  assert.match(term('radiation-heat-transfer-coefficient').detail,/\(2\.29\)/);
  assert.match(term('p-ntu-method').detail,/\(3\.24\)/);
  // Pre-existing coverage that made two other proposals unnecessary.
  assert.ok(term('thermal-effusivity'));assert.ok(term('product-solution'));
});
test('glossary proposals: five detail appends landed on existing terms',()=>{
  assert.match(term('entropy').detail,/Ṡ_Un = \|Q̇\|\(1\/T₂ − 1\/T₁\)/);
  assert.match(term('biot-number').detail,/Bi = hL\/k_b/);
  assert.match(term('thermal-time-constant').detail,/3時定数/);
  assert.match(term('temperature-laplacian').detail,/\(2\.13\)/);
  assert.match(term('lmtd-correction-factor').detail,/F\(P, R\) = F\(PR, 1\/R\)/);
});

// ---------- A2-UXS-10/11/13/14: app.js structure ----------
test('A2-UXS-10: deep-lesson expressions render without term links',()=>{
  assert.ok(appJs.includes("renderMathText(e.expression,ui.readerQuery||'')"));
  assert.equal(appJs.includes('mark(e.expression)'),false);
});
test('A2-UXS-11: term sheet makes the background inert and restores it on close',()=>{
  assert.ok(appJs.includes("root.querySelector('.app-shell')?.setAttribute('inert','')"));
  assert.ok(appJs.includes("root.querySelector('.app-shell')?.removeAttribute('inert')"));
  assert.ok(appJs.includes("else document.querySelector('#main-content')?.focus();"));
});
test('A2-UXS-13: transient UI (term sheet + mistake-note draft) survives same-route re-renders',()=>{
  assert.ok(appJs.includes('function captureTransientUi()'));
  assert.ok(appJs.includes('function restoreTransientUi(snapshot)'));
  assert.ok(appJs.includes("document.getElementById('mistake-note-form')"));
  assert.ok(appJs.includes('ui.renderedRoute=ui.route;'));
  assert.ok(appJs.includes('snapshot.route!==ui.route'));
});
test('A2-UXS-14: generation mixing is closed by a one-time controllerchange reload',()=>{
  assert.ok(appJs.includes("navigator.serviceWorker.addEventListener('controllerchange'"));
  assert.ok(appJs.includes('if (navigator.serviceWorker.controller)'));
  // The service worker itself only ever reads the current generation's cache.
  assert.equal(/(?<![\w.])caches\.match\(/.test(swJs),false);
  assert.ok(swJs.includes('caches.open(CACHE_NAME)'));
});

// ---------- A2-UXS-16/17/21/22/23 ----------
test('A2-UXS-16: index.html carries a self-only CSP and no inline scripts',()=>{
  assert.ok(indexHtml.includes('Content-Security-Policy'));
  assert.ok(indexHtml.includes("script-src 'self'"));
  assert.ok(indexHtml.includes("object-src 'none'"));
  const scripts=indexHtml.match(/<script[^>]*>/g)||[];
  assert.equal(scripts.length,1);
  assert.ok(scripts[0].includes('src="app.js"'));
});
test('A2-UXS-17: external links announce that they open in a new tab',()=>{
  assert.ok(appJs.includes("esc(ref.title)+' ↗</a>"));
  assert.ok(appJs.includes('>${escapeHTML(block.url)} ↗</a>'));
  assert.ok(appJs.includes('>doi:${escapeHTML(block.doi)} ↗</a>'));
  assert.ok((appJs.match(/↗（別タブで開く）/g)||[]).length>=3);
});
test('A2-UXS-21: skip link is rendered in the app shell and handled without route change',()=>{
  assert.ok(appJs.includes('<a href="#main-content" class="skip-link" data-action="skip-content">本文へスキップ</a>'));
  assert.ok(appJs.includes("action==='skip-content'"));
  assert.ok(stylesCss.includes('.skip-link:focus-visible'));
});
test('A2-UXS-22: simulator tabs implement the full tab pattern',()=>{
  assert.ok(appJs.includes('aria-controls="sim-panel"'));
  assert.ok(appJs.includes('id="sim-tab-${key}"'));
  assert.equal((appJs.match(/role="tabpanel" id="sim-panel"/g)||[]).length,3);
  assert.ok(appJs.includes('function onSimTabKeyDown(event)'));
  for(const key of ['ArrowRight','ArrowLeft','Home','End'])assert.ok(appJs.includes(`'${key}'`),key);
  assert.ok(appJs.includes("root.addEventListener('keydown', onSimTabKeyDown);"));
});
test('A2-UXS-23: search result counts are live regions',()=>{
  assert.ok(appJs.includes('<span role="status" aria-live="polite">${results.length}件</span>'));
  assert.ok(appJs.includes('<p aria-live="polite">全${results.length}件中'));
});

// ---------- A2-UXS-18/19/20: styles.css ----------
test('A2-UXS-18: reduced-motion preference disables CSS animation and smooth scroll',()=>{
  assert.ok(stylesCss.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(stylesCss.includes('scroll-behavior: auto'));
  assert.ok(stylesCss.includes('transition-duration: 0.01ms !important'));
});
test('A2-UXS-19: primary touch targets reach 44px',()=>{
  assert.ok(stylesCss.includes('.clear-search { position: absolute; right: 2px; min-width: 44px; min-height: 44px;'));
  assert.ok(stylesCss.includes('.modal-close { position:absolute; top:8px; right:9px; width:44px; height:44px;'));
  assert.ok(stylesCss.includes('min-width: 44px; min-height: 44px; padding: 5px 9px;'));
  assert.ok(stylesCss.includes('.guide-toc nav a { padding: 13px 7px;'));
});
function luminance(hex){const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
function contrast(a,b){const [x,y]=[luminance(a),luminance(b)].sort((m,n)=>n-m);return (x+0.05)/(y+0.05);}
test('A2-UXS-20: wall-diagram temperature colours meet 4.5:1 in both themes',()=>{
  assert.ok(stylesCss.includes('.wall-temp.hot { color: #a34a24; }'));
  assert.ok(stylesCss.includes('.wall-temp.cold { color: #2f6491; }'));
  assert.ok(contrast('#a34a24','#f0eee6')>=4.5,contrast('#a34a24','#f0eee6').toFixed(2));
  assert.ok(contrast('#2f6491','#f0eee6')>=4.5,contrast('#2f6491','#f0eee6').toFixed(2));
  assert.ok(contrast('#e08a5f','#202c2d')>=4.5,contrast('#e08a5f','#202c2d').toFixed(2));
  assert.ok(contrast('#7fb0d8','#202c2d')>=4.5,contrast('#7fb0d8','#202c2d').toFixed(2));
});

// ---------- A2-FUN-07: nucleate-boiling low-superheat warning ----------
test('A2-FUN-07: very small superheat warns that natural convection may dominate',()=>{
  const small=calculateNucleateBoiling({...NUCLEATE_DEFAULTS,superheat:0.1});
  assert.equal(small.error,undefined);
  assert.match(small.warning,/自然対流/);
  assert.match(small.warning,/開始点/);
  const normal=calculateNucleateBoiling({...NUCLEATE_DEFAULTS});
  assert.equal(normal.error,undefined);
  assert.doesNotMatch(normal.warning,/自然対流が支配的/);
  const nearChf=calculateNucleateBoiling({...NUCLEATE_DEFAULTS,superheat:19});
  assert.match(nearChf.warning,/80%/);
});

// ---------- A2-DOC-01/03/05: documentation freshness ----------
test('A2-DOC-01: README states the measured current content and publication state',()=>{
  assert.ok(readme.includes('**751問**'));
  assert.ok(readme.includes('図解76点'));
  assert.ok(readme.includes('学習ガイド49項目'));
  assert.ok(readme.includes('用語集504語'));
  assert.ok(readme.includes('公開済みです（https://sylpica.github.io/heat-transfer-study-ja/）'));
  assert.ok(readme.includes('PR #1はマージ済みです'));
  assert.equal(readme.includes('図解28点'),false);
  assert.equal(readme.includes('学習ガイド33項目'),false);
  assert.equal(readme.includes('minkohno-hub.github.io'),false);
});
test('A2-DOC-03: VERIFICATION.md points at the current owner URL with a dated note',()=>{
  assert.ok(verification.includes('https://sylpica.github.io/heat-transfer-study-ja/'));
  assert.ok(verification.includes('2026-10-31追記：PR #1はその後マージ済み'));
  assert.equal(verification.includes('現在の配信先は `https://minkohno-hub.github.io'),false);
});
test('A2-DOC-05: SECTION_PROGRESS.md carries the 2026-10-31 freshness note',()=>{
  assert.ok(sectionProgressMd.includes('2026-10-31：監査フェーズB完了時点の鮮度注記'));
  assert.ok(sectionProgressMd.includes('用語504語'));
});
