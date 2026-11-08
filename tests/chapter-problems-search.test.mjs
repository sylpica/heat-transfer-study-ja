import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as core from '../study-core.mjs';
import * as guide from '../guide.mjs';
import * as curriculum from '../chapter-curriculum.mjs';
import * as originalNotesModule from '../original-notes.mjs';
import * as deepNotesModule from '../original-deep-lessons.mjs';
import * as termModule from '../term-links.mjs';
import * as visualModule from '../sim-diagrams.mjs';
import * as dynamicNavigation from '../dynamic-navigation.mjs';

// Search coverage for the chapter-end problems (563) and references (410).
// The chapter files stay the single source of truth: the search index gains
// entries only for chapters already fetched and validated, and a search
// loads the missing chapter files on demand before recomputing results.

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
// Values produced inside the VM realm fail deepStrictEqual on prototypes, so
// compare them through a JSON round-trip (same note as the inapp tests).
const plain = value => JSON.parse(JSON.stringify(value));
function harness(fetchImpl = async () => ({ ok: false })) {
  const store = new Map();
  const root = { innerHTML: '' };
  const document = { querySelector: s => s === '#app' ? root : null, querySelectorAll: () => [], getElementById: () => null, documentElement: { dataset: {}, style: { setProperty() {} } }, body: { append() {} }, createElement: () => ({ setAttribute() {}, remove() {} }) };
  const context = vm.createContext({ ...core, ...guide, ...curriculum, ...originalNotesModule, ...deepNotesModule, ...termModule, ...visualModule, ...dynamicNavigation, structuredClone, JSON, Date, Math, Intl, Map, Set, Number, String, Array, Boolean, RegExp, Blob, URL, fetch: fetchImpl, crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' }, document, window: { matchMedia: () => ({ matches: false }), scrollTo() {}, confirm: () => true, location: { reload() {} } }, location: { hash: '' }, navigator: { onLine: true }, setTimeout: () => 1, clearTimeout() {}, localStorage: { getItem: k => store.get(k) || null, setItem(k, v) { store.set(k, v); }, removeItem(k) { store.delete(k); } }, FormData: class { constructor(v) { this.values = v?.values ?? v; } get(k) { return this.values?.[k] ?? null; } } });
  vm.runInContext(source.replace(/^import .*?;\s*/gm, '').replace(/\nstartApp\(\);\s*$/, '') + `
    render=()=>{globalThis.renderCount=(globalThis.renderCount||0)+1;};showStatus=message=>{globalThis.statusMessage=message;};
    globalThis.api={get state(){return state;},get ui(){return ui;},set ui(v){ui={...ui,...v};},
    set bookData(v){book=v;},set questions(v){questionBank=v;},set terms(v){glossary=v;},
    buildSearchIndex,chapterExtrasSearchEntries,chapterExtrasNeededForSearch,ensureChapterExtrasForSearch,
    renderChapterExtras,loadChapterProblems,chapterProblemsCache,searchEntries};`, context);
  context.api.bookData = { chapters: Array.from({ length: 11 }, (_, i) => ({ id: `ch${i + 1}`, title: `第${i + 1}章`, sections: [] })) };
  context.api.questions = [];
  context.api.terms = [];
  return context.api;
}

const chapterThree = {
  chapterId: 'chapter-03', language: 'ja', bookPages: '100–110', pdfPages: '114–124',
  problems: {
    heading: '問題', count: 2, blocks: [
      { type: 'problem', id: 'problem-3-1', number: '3.1', text: '平板の熱伝導率を求めよ。',
        items: ['（a）厚さを与える'], hint: 'フーリエの法則を使う', formulaBlocks: [{ expression: 'q = -kA dT/dx' }] },
      { type: 'table', caption: '物性表', headers: ['材料', 'k'], rows: [['銅', '401']] },
      { type: 'problem', id: 'problem-3-2', number: '3.2', text: '円筒の熱流束を求めよ。', answerHint: '約120 W' },
    ],
  },
  references: {
    heading: '参考文献', count: 1, blocks: [
      { type: 'reference', id: 'reference-3-1', number: '3.1', authors: 'H. D. Baehr and K. Stephan',
        originalTitle: 'Heat and Mass Transfer', titleJa: '熱・物質伝達', publication: 'Springer, 1998', doi: '10.1000/example' },
    ],
  },
};

function seedReady(api, chapterId = 'ch3', data = chapterThree) {
  api.chapterProblemsCache.set(chapterId, { status: 'ready', data });
}

test('search entries are built only from chapters already loaded and validated', () => {
  const api = harness();
  assert.equal(api.chapterExtrasSearchEntries().length, 0, 'nothing cached, nothing indexed');
  api.chapterProblemsCache.set('ch3', { status: 'loading' });
  api.chapterProblemsCache.set('ch4', { status: 'error' });
  assert.equal(api.chapterExtrasSearchEntries().length, 0, 'loading and failed chapters stay out of the index');
  seedReady(api);
  const entries = api.chapterExtrasSearchEntries();
  assert.equal(entries.length, 3, 'two problems and one reference');
  const [first, second, reference] = entries;
  assert.equal(first.kind, 'chapter-problem');
  assert.equal(first.kindLabel, '章末問題');
  assert.equal(first.title, '第3章 問題 3.1');
  assert.deepEqual(plain(first.target), { route: 'reader', chapterExtras: 'ch3', entryId: 'problem-3-1' });
  assert.ok(first.text.includes('フーリエの法則'), 'hint text is searchable');
  assert.ok(first.text.includes('q = -kA dT/dx'), 'given formulas are searchable');
  assert.ok(first.text.includes('銅') && first.text.includes('401'), 'a data table stays with its problem and is searchable');
  assert.ok(second.text.includes('約120 W'), 'printed partial answers are searchable');
  assert.equal(reference.kind, 'chapter-reference');
  assert.equal(reference.title, '熱・物質伝達');
  assert.ok(reference.text.includes('Baehr') && reference.text.includes('Heat and Mass Transfer') && reference.text.includes('10.1000/example'),
    'authors, original title and DOI are searchable');
});

test('chapter problem and reference entries answer to the shared search filters', () => {
  const api = harness();
  seedReady(api);
  const index = api.buildSearchIndex().filter(entry => entry.kind.startsWith('chapter-'));
  assert.equal(index.length, 3, 'the shared index carries the chapter entries once the chapter is loaded');
  const byAuthor = api.searchEntries(index, { query: 'Baehr', kind: 'all', chapter: 'all', field: 'all' });
  assert.deepEqual(plain(byAuthor.map(entry => entry.kind)), ['chapter-reference'], 'an author name reaches the reference');
  const byWord = api.searchEntries(index, { query: '熱流束', kind: 'all', chapter: 'all', field: 'all' });
  assert.deepEqual(plain(byWord.map(entry => entry.target.entryId)), ['problem-3-2'], 'a word from the problem text reaches the problem');
  const problemsOnly = api.searchEntries(index, { query: '求めよ', kind: 'chapter-problem', chapter: 'all', field: 'all' });
  assert.equal(problemsOnly.length, 2, 'the chapter-problem kind filter keeps problems only');
  const referencesOnly = api.searchEntries(index, { query: '伝達', kind: 'chapter-reference', chapter: 'all', field: 'all' });
  assert.equal(referencesOnly.length, 1, 'the chapter-reference kind filter keeps references only');
  const otherChapter = api.searchEntries(index, { query: '求めよ', kind: 'all', chapter: 'ch4', field: 'all' });
  assert.equal(otherChapter.length, 0, 'the chapter filter still applies');
  const wrongKind = api.searchEntries(index, { query: 'Baehr', kind: 'question', chapter: 'all', field: 'all' });
  assert.equal(wrongKind.length, 0, 'unrelated kinds never surface chapter entries');
});

test('a search loads only the chapter files its filters actually need', async () => {
  const api = harness();
  api.ui = { search: { query: 'x', kind: 'book', chapter: 'all', field: 'all' } };
  assert.deepEqual(plain(api.chapterExtrasNeededForSearch()), [], 'body-only searches never fetch chapter files');
  api.ui = { search: { query: 'x', kind: 'all', chapter: 'supplement', field: 'all' } };
  assert.deepEqual(plain(api.chapterExtrasNeededForSearch()), [], 'the supplement bucket has no chapter files');
  api.ui = { search: { query: 'x', kind: 'all', chapter: 'ch5', field: 'all' } };
  assert.deepEqual(plain(api.chapterExtrasNeededForSearch()), ['ch5'], 'a chapter filter loads just that chapter');
  api.ui = { search: { query: 'x', kind: 'chapter-reference', chapter: 'all', field: 'all' } };
  assert.equal(api.chapterExtrasNeededForSearch().length, 11, 'an all-chapter search loads every missing chapter');
  seedReady(api, 'ch3');
  assert.equal(api.chapterExtrasNeededForSearch().length, 10, 'loaded chapters are not fetched again');
});

test('the on-demand load fills the cache and clears the pending flag', async () => {
  const requested = [];
  const api = harness(async path => { requested.push(path); return { ok: true, json: async () => chapterThree }; });
  api.ui = { route: 'search', search: { query: '熱流束', kind: 'all', chapter: 'ch3', field: 'all' } };
  await api.ensureChapterExtrasForSearch();
  assert.deepEqual(plain(requested), ['./data/chapter-problems/chapter-03.json'], 'exactly the needed chapter file is fetched');
  assert.equal(api.chapterProblemsCache.get('ch3').status, 'ready');
  assert.equal(api.ui.searchExtrasPending, false, 'pending flag clears once the load settles');
  const hits = api.searchEntries(api.buildSearchIndex(), api.ui.search);
  assert.ok(hits.some(entry => entry.target.entryId === 'problem-3-2'), 'the recomputed index answers the pending query');
});

test('the panel opens the focused entry for a search jump, and nothing otherwise', async () => {
  const chapterOne = JSON.parse(await readFile(new URL('../data/chapter-problems/chapter-01.json', import.meta.url), 'utf8'));
  const api = harness(async () => ({ ok: true, json: async () => chapterOne }));
  api.ui = { route: 'reader', extrasChapter: 'ch1' };
  await api.loadChapterProblems('ch1');
  const problemId = chapterOne.problems.blocks.find(block => block.type === 'problem').id;
  const referenceId = chapterOne.references.blocks.find(block => block.type === 'reference').id;

  const plain = api.renderChapterExtras({ id: 'ch1', title: '第1章' });
  assert.ok(!/<details class="chapter-extras-group" open/.test(plain), 'groups start closed without a focus');
  assert.ok(plain.includes(`id="chapter-extra-${referenceId}"`), 'every reference carries its anchor id');

  api.ui = { extrasFocus: { chapter: 'ch1', entryId: problemId } };
  const focusedProblem = api.renderChapterExtras({ id: 'ch1', title: '第1章' });
  assert.ok(focusedProblem.includes(`<details class="chapter-problem-item" id="chapter-extra-${problemId}" open`),
    'the named problem renders open with its anchor id');
  assert.equal((focusedProblem.match(/<details class="chapter-extras-group" open>/g) || []).length, 1,
    'exactly its own group opens');

  api.ui = { extrasFocus: { chapter: 'ch1', entryId: referenceId } };
  const focusedReference = api.renderChapterExtras({ id: 'ch1', title: '第1章' });
  assert.equal((focusedReference.match(/<details class="chapter-extras-group" open>/g) || []).length, 1,
    'a reference focus opens the references group only');
  assert.ok(!/<details class="chapter-problem-item"[^>]*\sopen[\s>]/.test(focusedReference), 'problems stay closed for a reference focus');

  api.ui = { extrasFocus: { chapter: 'ch2', entryId: problemId } };
  const otherChapter = api.renderChapterExtras({ id: 'ch1', title: '第1章' });
  assert.ok(!otherChapter.includes(' open>'), 'a focus for another chapter never opens this panel');
});

test('search form and jump wiring for chapter entries exist in app.js', async () => {
  assert.ok(source.includes('value="chapter-problem"'), 'the kind filter offers chapter problems');
  assert.ok(source.includes('value="chapter-reference"'), 'the kind filter offers references');
  assert.ok(source.includes('item.chapterExtras'), 'the result jump handles chapter entries');
  assert.ok(source.includes('ui.extrasFocus={chapter:item.chapterExtras,entryId:item.entryId}'), 'the jump records the focus entry');
  assert.ok(source.includes('ensureChapterExtrasForSearch()'), 'searching triggers the on-demand chapter load');
  assert.ok(source.includes('章末問題・参考文献も読み込んで検索しています'), 'the pending state is announced while chapter files load');
});
