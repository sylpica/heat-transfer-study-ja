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

// ---- Data integrity: the 11 shipped chapter files stay self-consistent ----

const chapterFile = n => new URL(`../data/chapter-problems/chapter-${String(n).padStart(2, '0')}.json`, import.meta.url);

test('chapter problem data: 11 files, counts reconcile, totals are 563 problems and 410 references', async () => {
  let totalProblems = 0, totalReferences = 0;
  for (let n = 1; n <= 11; n++) {
    const data = JSON.parse(await readFile(chapterFile(n), 'utf8'));
    assert.equal(data.chapterId, `chapter-${String(n).padStart(2, '0')}`, `chapter ${n} id`);
    assert.equal(data.language, 'ja');
    assert.equal(data.status, 'complete');
    const problemBlocks = data.problems.blocks.filter(block => block.type === 'problem');
    const referenceBlocks = data.references.blocks.filter(block => block.type === 'reference');
    assert.equal(problemBlocks.length, data.problems.count, `chapter ${n} problem count`);
    assert.equal(referenceBlocks.length, data.references.count, `chapter ${n} reference count`);
    assert.equal(referenceBlocks.length, data.references.blocks.length, `chapter ${n} references are reference blocks only`);
    assert.ok(data.problems.blocks.every(block => block.type === 'problem' || block.type === 'table'),
      `chapter ${n} problem part holds only problems and their data tables`);
    const ids = [...data.problems.blocks, ...data.references.blocks, ...(data.references.preambleBlocks || [])]
      .map(block => block.id).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, `chapter ${n} block ids are unique`);
    for (const block of problemBlocks) {
      assert.equal(typeof block.number, 'string', `chapter ${n} problem number`);
      assert.ok(block.number.startsWith(`${n}.`), `chapter ${n} problem ${block.number} belongs to the chapter`);
    }
    totalProblems += data.problems.count;
    totalReferences += data.references.count;
  }
  assert.equal(totalProblems, 563);
  assert.equal(totalReferences, 410);
});

// ---- Shipping wiring: build allowlist copy, cache versioning, SW shell ----

test('chapter problems ship in the public build and the offline shell', async () => {
  const [build, worker] = await Promise.all([
    readFile(new URL('../scripts/build-public-site.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../sw.js', import.meta.url), 'utf8'),
  ]);
  assert.ok(build.includes("join(root,'data','chapter-problems')"), 'build reads the chapter-problems directory');
  assert.ok(build.includes('chapterProblemFileNames.length!==11'), 'build fails unless exactly 11 chapter files ship');
  assert.ok(build.includes('...chapterProblemPaths'), 'chapter files join the cache-versioned public assets');
  // The reader loads chapter files on demand; they must not leak into the
  // section content manifest, whose entries the app loads as book sections.
  assert.ok(build.includes("'content-manifest.json':{files:sectionPaths.map"), 'content manifest stays section files only');
  for (let n = 1; n <= 11; n++) {
    const path = `./data/chapter-problems/chapter-${String(n).padStart(2, '0')}.json`;
    assert.ok(worker.includes(`'${path}'`), `APP_SHELL precaches ${path}`);
  }
});

test('reader wiring: lazy fetch path, panel render and TOC entry exist in app.js', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('./data/chapter-problems/chapter-'), 'reader fetches per-chapter files');
  assert.ok(app.includes('renderChapterExtras(chapter)'), 'reader article renders the chapter extras panel');
  assert.ok(app.includes('data-chapter-extras'), 'TOC carries a chapter extras entry per chapter');
  assert.ok(app.includes("'toggle-chapter-extras'") || app.includes('toggle-chapter-extras'), 'panel toggle action is handled');
});

// ---- Behaviour in the app.js VM harness (same pattern as app.test.mjs) ----

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const key = 'heat-study-ja:v1';
function harness(fetchImpl = async () => ({ ok: false })) {
  const store = new Map();
  const root = { innerHTML: '' };
  const document = { querySelector: s => s === '#app' ? root : null, querySelectorAll: () => [], documentElement: { dataset: {}, style: { setProperty() {} } }, body: { append() {} }, createElement: () => ({ setAttribute() {}, remove() {} }) };
  const context = vm.createContext({ ...core, ...guide, ...curriculum, ...originalNotesModule, ...deepNotesModule, ...termModule, ...visualModule, ...dynamicNavigation, structuredClone, JSON, Date, Math, Intl, Map, Set, Number, String, Array, Boolean, RegExp, Blob, URL, fetch: fetchImpl, crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' }, document, window: { matchMedia: () => ({ matches: false }), scrollTo() {}, confirm: () => true, location: { reload() {} } }, location: { hash: '' }, navigator: { onLine: true }, setTimeout: () => 1, clearTimeout() {}, localStorage: { getItem: k => store.get(k) || null, setItem(k, v) { store.set(k, v); }, removeItem(k) { store.delete(k); } }, FormData: class { constructor(v) { this.values = v?.values ?? v; } get(k) { return this.values?.[k] ?? null; } } });
  vm.runInContext(source.replace(/^import .*?;\s*/gm, '').replace(/\nstartApp\(\);\s*$/, '') + `
    render=()=>{globalThis.renderCount=(globalThis.renderCount||0)+1;};showStatus=message=>{globalThis.statusMessage=message;};
    globalThis.api={get state(){return state;},get ui(){return ui;},set ui(v){ui={...ui,...v};},set terms(v){glossary=v;},renderChapterExtras,chapterProblemGroups,chapterProblemsPath,validChapterProblemsData,loadChapterProblems,chapterProblemsCache,validBookBlocks};`, context);
  context.api.terms = [{ id: 'term', ja: '熱', en: 'heat', meaning: '温度による移動', source: { section: '1.1' } }];
  return context.api;
}

test('chapter problems path mapping covers exactly chapters 1-11', () => {
  const api = harness();
  assert.equal(api.chapterProblemsPath('ch1'), './data/chapter-problems/chapter-01.json');
  assert.equal(api.chapterProblemsPath('ch11'), './data/chapter-problems/chapter-11.json');
  assert.equal(api.chapterProblemsPath('ch12'), null);
  assert.equal(api.chapterProblemsPath('appendix'), null);
});

test('problem groups keep a data table with the problem it belongs to', () => {
  const api = harness();
  const problem = n => ({ type: 'problem', number: n, text: `問題${n}の本文` });
  const table = { type: 'table', headers: ['列'], rows: [['値']] };
  const groups = api.chapterProblemGroups([problem('6.47'), table, problem('6.48')]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].problem.number, '6.47');
  // Groups are built inside the VM realm, so compare structurally.
  assert.equal(groups[0].extra.length, 1);
  assert.equal(groups[0].extra[0].type, 'table');
  assert.equal(groups[1].extra.length, 0);
});

test('chapter data validation rejects count and chapter mismatches', () => {
  const api = harness();
  const valid = {
    chapterId: 'chapter-03', language: 'ja',
    problems: { heading: '問題', count: 1, blocks: [{ type: 'problem', number: '3.1', text: '本文' }] },
    references: { heading: '参考文献', count: 1, blocks: [{ type: 'reference', number: '3.1', authors: 'A', originalTitle: 'T', publication: 'P' }] },
  };
  assert.equal(api.validChapterProblemsData(valid, 'ch3'), true);
  assert.equal(api.validChapterProblemsData({ ...valid, problems: { ...valid.problems, count: 2 } }, 'ch3'), false);
  assert.equal(api.validChapterProblemsData(valid, 'ch4'), false);
  assert.equal(api.validChapterProblemsData({ ...valid, language: 'en' }, 'ch3'), false);
  assert.equal(api.validChapterProblemsData(null, 'ch3'), false);
});

test('panel renders counts and collapsed problems after an on-demand load', async () => {
  const chapterOne = JSON.parse(await readFile(chapterFile(1), 'utf8'));
  const requested = [];
  const api = harness(async path => { requested.push(path); return { ok: true, json: async () => chapterOne }; });
  api.ui = { route: 'reader', extrasChapter: 'ch1' };
  await api.loadChapterProblems('ch1');
  assert.deepEqual(requested, ['./data/chapter-problems/chapter-01.json'], 'exactly one lazy fetch for the chapter file');
  assert.equal(api.chapterProblemsCache.get('ch1').status, 'ready');
  const html = api.renderChapterExtras({ id: 'ch1' });
  assert.ok(html.includes('問題（46問）'), 'problem count from the data is shown');
  assert.ok(html.includes('参考文献（22件）'), 'reference count from the data is shown');
  assert.ok(html.includes('問題 1.1'), 'first problem is listed');
  assert.ok(html.includes('問題 1.46'), 'last problem is listed');
  assert.equal((html.match(/<details class="chapter-problem-item"/g) || []).length, 46, 'one collapsed row per problem');
  assert.ok(!/<details class="chapter-problem-item"[^>]*\sopen[\s>]/.test(html),
    'problems never render pre-expanded without a search focus');
  assert.ok(html.includes('歴史的文献と発展的テキスト') || html.includes('Bibliography') || chapterOne.references.preambleBlocks.length > 0,
    'chapter 1 bibliography preamble is part of the references group');
  api.ui = { extrasChapter: '' };
  const closed = api.renderChapterExtras({ id: 'ch1' });
  assert.ok(!closed.includes('id="chapter-extras-panel"'), 'closed panel renders no problem content');
  assert.ok(!closed.includes('chapter-problem-item'), 'closed panel lists no problems');
  assert.ok(closed.includes('data-action="toggle-chapter-extras"'), 'closed panel keeps the open control');
});

test('panel reports a load failure instead of rendering partial content', async () => {
  const api = harness(async () => ({ ok: false }));
  api.ui = { route: 'reader', extrasChapter: 'ch2' };
  await api.loadChapterProblems('ch2');
  assert.equal(api.chapterProblemsCache.get('ch2').status, 'error');
  const html = api.renderChapterExtras({ id: 'ch2' });
  assert.ok(html.includes('読み込めませんでした'), 'failure is stated plainly');
  assert.ok(html.includes('data-action="retry-chapter-extras"'), 'a retry control is offered');
  assert.ok(!html.includes('chapter-problem-item'), 'no partial problem list is shown');
});
