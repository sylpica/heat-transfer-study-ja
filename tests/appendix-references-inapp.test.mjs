import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as core from '../study-core.mjs';
import * as guide from '../guide.mjs';
import * as curriculum from '../chapter-curriculum.mjs';
import * as originalNotesModule from '../original-notes.mjs';
import * as deepNotesModule from '../original-deep-lessons.mjs';
import * as termModule from '../term-links.mjs';
import * as visualModule from '../sim-diagrams.mjs';
import * as dynamicNavigation from '../dynamic-navigation.mjs';

// ---- Data integrity: the 2 shipped appendix files stay self-consistent ----

const appendixFile = letter => new URL(`../data/appendix-references/appendix-${letter}.json`, import.meta.url);
const EXPECTED = { a: { count: 41, prefix: 'A', bookPages: [734, 738] }, b: { count: 1, prefix: 'B', bookPages: [765, 765] } };

test('appendix reference data: 2 files, counts reconcile (A: 41, B: 1, total 42)', async () => {
  let total = 0;
  for (const [letter, expected] of Object.entries(EXPECTED)) {
    const data = JSON.parse(await readFile(appendixFile(letter), 'utf8'));
    assert.equal(data.appendixId, `appendix-${letter}`, `appendix ${letter} id`);
    assert.equal(data.language, 'ja');
    assert.equal(data.status, 'complete');
    const blocks = data.references.blocks;
    assert.equal(blocks.length, data.references.count, `appendix ${letter} count field`);
    assert.equal(blocks.length, expected.count, `appendix ${letter} reference count`);
    assert.ok(blocks.every(block => block.type === 'reference'), `appendix ${letter} holds reference blocks only`);
    const ids = blocks.map(block => block.id);
    assert.equal(new Set(ids).size, ids.length, `appendix ${letter} block ids are unique`);
    blocks.forEach((block, i) => {
      assert.equal(block.number, `${expected.prefix}.${i + 1}`, `appendix ${letter} sequential number`);
      assert.equal(block.id, `reference-${expected.prefix}-${i + 1}`, `appendix ${letter} block id`);
      assert.ok(block.bookPage >= expected.bookPages[0] && block.bookPage <= expected.bookPages[1],
        `appendix ${letter} ${block.number} book page ${block.bookPage} within ${expected.bookPages}`);
      assert.equal(block.pdfPage, block.bookPage + 14, `appendix ${letter} ${block.number} pdf page offset`);
      for (const key of ['authors', 'originalTitle', 'titleJa', 'publication']) {
        assert.equal(typeof block[key], 'string', `appendix ${letter} ${block.number} ${key}`);
        assert.ok(block[key].length > 0, `appendix ${letter} ${block.number} ${key} not empty`);
      }
    });
    total += data.references.count;
  }
  assert.equal(total, 42);
});

// ---- Shipping wiring: build copy, cache versioning, SW shell ----

test('appendix references ship in the public build and the offline shell', async () => {
  const [build, worker] = await Promise.all([
    readFile(new URL('../scripts/build-public-site.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../sw.js', import.meta.url), 'utf8'),
  ]);
  assert.ok(build.includes("join(root,'data','appendix-references')"), 'build reads the appendix-references directory');
  assert.ok(build.includes('appendixReferenceFileNames.length!==2'), 'build fails unless exactly 2 appendix files ship');
  assert.ok(build.includes('...appendixReferencePaths'), 'appendix files join the cache-versioned public assets');
  assert.ok(build.includes("'content-manifest.json':{files:sectionPaths.map"), 'content manifest stays section files only');
  for (const letter of ['a', 'b']) {
    const path = `./data/appendix-references/appendix-${letter}.json`;
    assert.ok(worker.includes(`'${path}'`), `APP_SHELL precaches ${path}`);
  }
});

test('reader wiring: lazy fetch path, panel render and TOC entry exist in app.js', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('./data/appendix-references/'), 'reader fetches per-appendix files');
  assert.ok(app.includes('renderAppendixReferences()'), 'reader article renders the appendix references panel');
  assert.ok(app.includes('data-appendix-references'), 'TOC carries an appendix references entry');
  assert.ok(app.includes('toggle-appendix-references'), 'panel toggle action is handled');
});

// ---- Behaviour in the app.js VM harness (same pattern as chapter-problems-inapp.test.mjs) ----

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
function harness(fetchImpl = async () => ({ ok: false })) {
  const store = new Map();
  const root = { innerHTML: '' };
  const document = { querySelector: s => s === '#app' ? root : null, querySelectorAll: () => [], documentElement: { dataset: {}, style: { setProperty() {} } }, body: { append() {} }, createElement: () => ({ setAttribute() {}, remove() {} }), getElementById: () => null };
  const context = vm.createContext({ ...core, ...guide, ...curriculum, ...originalNotesModule, ...deepNotesModule, ...termModule, ...visualModule, ...dynamicNavigation, structuredClone, JSON, Date, Math, Intl, Map, Set, Number, String, Array, Boolean, RegExp, Blob, URL, fetch: fetchImpl, crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' }, document, window: { matchMedia: () => ({ matches: false }), scrollTo() {}, confirm: () => true, location: { reload() {} } }, location: { hash: '' }, navigator: { onLine: true }, setTimeout: () => 1, clearTimeout() {}, localStorage: { getItem: k => store.get(k) || null, setItem(k, v) { store.set(k, v); }, removeItem(k) { store.delete(k); } }, FormData: class { constructor(v) { this.values = v?.values ?? v; } get(k) { return this.values?.[k] ?? null; } } });
  vm.runInContext(source.replace(/^import .*?;\s*/gm, '').replace(/\nstartApp\(\);\s*$/, '') + `
    render=()=>{globalThis.renderCount=(globalThis.renderCount||0)+1;};showStatus=message=>{globalThis.statusMessage=message;};
    globalThis.api={get state(){return state;},get ui(){return ui;},set ui(v){ui={...ui,...v};},set book(v){book=v;},set terms(v){glossary=v;},renderAppendixReferences,appendixReferencesPath,validAppendixReferencesData,loadAppendixReferences,appendixReferencesCache,validBookBlocks};`, context);
  context.api.book = { chapters: [], appendices: [{ id: 'A', title: '選定材料の熱物性' }, { id: 'B', title: '単位と換算係数' }, { id: 'C', title: '記号一覧' }] };
  context.api.terms = [{ id: 'term', ja: '熱', en: 'heat', meaning: '温度による移動', source: { section: '1.1' } }];
  return context.api;
}

test('appendix references path mapping covers exactly appendices A and B', () => {
  const api = harness();
  assert.equal(api.appendixReferencesPath('A'), './data/appendix-references/appendix-a.json');
  assert.equal(api.appendixReferencesPath('B'), './data/appendix-references/appendix-b.json');
  assert.equal(api.appendixReferencesPath('C'), null);
  assert.equal(api.appendixReferencesPath('index'), null);
  assert.equal(api.appendixReferencesPath('ch1'), null);
});

test('appendix data validation rejects count, id and block-type mismatches', () => {
  const api = harness();
  const valid = {
    appendixId: 'appendix-b', language: 'ja',
    references: { heading: '参考文献', count: 1, blocks: [{ type: 'reference', number: 'B.1', authors: 'A', originalTitle: 'T', titleJa: '題', publication: 'P' }] },
  };
  assert.equal(api.validAppendixReferencesData(valid, 'B'), true);
  assert.equal(api.validAppendixReferencesData({ ...valid, references: { ...valid.references, count: 2 } }, 'B'), false);
  assert.equal(api.validAppendixReferencesData(valid, 'A'), false);
  assert.equal(api.validAppendixReferencesData({ ...valid, language: 'en' }, 'B'), false);
  assert.equal(api.validAppendixReferencesData({ ...valid, references: { ...valid.references, blocks: [{ type: 'problem', number: 'B.1', text: 'x' }] } }, 'B'), false);
  assert.equal(api.validAppendixReferencesData(null, 'B'), false);
});

test('panel renders counts and entries after an on-demand load; nothing renders before selection', async () => {
  const appendixA = JSON.parse(await readFile(appendixFile('a'), 'utf8'));
  const requested = [];
  const api = harness(async path => { requested.push(path); return { ok: true, json: async () => appendixA }; });
  api.ui = { route: 'reader', appendixRefs: '' };
  assert.equal(api.renderAppendixReferences(), '', 'no panel before an appendix is selected');
  api.ui = { appendixRefs: 'A' };
  await api.loadAppendixReferences('A');
  assert.deepEqual(requested, ['./data/appendix-references/appendix-a.json'], 'exactly one lazy fetch for the appendix file');
  assert.equal(api.appendixReferencesCache.get('A').status, 'ready');
  const html = api.renderAppendixReferences();
  assert.ok(html.includes('付録A 参考文献'), 'panel heading names the appendix');
  assert.ok(html.includes('参考文献（41件）'), 'reference count from the data is shown');
  assert.ok(html.includes('[A.1]'), 'first reference is listed');
  assert.ok(html.includes('[A.41]'), 'last reference is listed');
  assert.ok(html.includes('付録の本文（物性値・換算の表）は収録していません'), 'the untranslated appendix body is disclosed');
});

test('panel reports a load failure instead of rendering partial content', async () => {
  const api = harness(async () => ({ ok: false }));
  api.ui = { route: 'reader', appendixRefs: 'B' };
  await api.loadAppendixReferences('B');
  assert.equal(api.appendixReferencesCache.get('B').status, 'error');
  const html = api.renderAppendixReferences();
  assert.ok(html.includes('読み込めませんでした'), 'failure is stated plainly');
  assert.ok(html.includes('data-action="retry-appendix-references"'), 'a retry control is offered');
  assert.ok(!html.includes('book-reference'), 'no partial reference list is shown');
});
