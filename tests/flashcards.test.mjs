import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFlashcardDeck, shuffledOrder, flashcardCategories, flashcardChapters, termChapters, termSortSection, clampFlashcardIndex, defaultFlashcardPrefs } from '../flashcards.mjs';
import { createEmptyState, validateLearningData, normalizeLearningData, mergeLearningData, DATA_FORMAT } from '../study-core.mjs';

const term = (id, ja, extra = {}) => ({ id, ja, en: id, meaning: '意味', brief: '要約', detail: '詳細', category: '熱伝導', source: { type: 'supplement' }, relatedSections: [], aliases: [], ...extra });
const prefs = (extra = {}) => ({ ...defaultFlashcardPrefs(), ...extra });
const ids = deck => deck.map(t => t.id);

test('default sort keeps registration order and no filter keeps every term', () => {
  const terms = [term('c', 'か'), term('a', 'あ'), term('b', 'い')];
  assert.deepEqual(ids(buildFlashcardDeck(terms, prefs(), [])), ['c', 'a', 'b']);
});

test('kana sort orders by Japanese reading', () => {
  const terms = [term('banana', 'ばなな'), term('ame', 'あめ'), term('kaki', 'かき')];
  assert.deepEqual(ids(buildFlashcardDeck(terms, prefs({ sort: 'kana' }), [])), ['ame', 'kaki', 'banana']);
});

test('section sort orders by book section, supplements without sections last', () => {
  const terms = [
    term('late', 'x', { source: { section: '10.2' } }),
    term('early', 'x', { source: { section: '2.1' } }),
    term('mid', 'x', { source: { section: '7.6' } }),
    term('viaRelated', 'x', { relatedSections: ['3.4', '3.9'] }),
    term('none', 'x'),
  ];
  assert.deepEqual(ids(buildFlashcardDeck(terms, prefs({ sort: 'section' }), [])), ['early', 'viaRelated', 'mid', 'late', 'none']);
  assert.deepEqual(termSortSection(terms[3]), [3, 4]);
});

test('chapter filter matches source sections and related sections', () => {
  const terms = [
    term('own', 'x', { source: { section: '9.3' } }),
    term('related', 'x', { relatedSections: ['7.6', '7.8'] }),
    term('other', 'x', { relatedSections: ['5.1'] }),
    term('none', 'x'),
  ];
  assert.deepEqual(ids(buildFlashcardDeck(terms, prefs({ chapter: '7' }), [])), ['related']);
  assert.deepEqual(ids(buildFlashcardDeck(terms, prefs({ chapter: '9' }), [])), ['own']);
  assert.deepEqual([...termChapters(terms[1])], [7]);
  assert.deepEqual(flashcardChapters(terms), [5, 7, 9]);
});

test('category filter and category list follow the data', () => {
  const terms = [term('a', 'x', { category: '熱放射' }), term('b', 'x', { category: '熱伝導' }), term('c', 'x', { category: '熱放射' })];
  assert.deepEqual(ids(buildFlashcardDeck(terms, prefs({ category: '熱放射' }), [])), ['a', 'c']);
  assert.deepEqual(flashcardCategories(terms), ['熱放射', '熱伝導']);
});

test('bookmarks scope keeps only bookmarked terms and is empty without bookmarks', () => {
  const terms = [term('a', 'x'), term('b', 'x'), term('c', 'x')];
  assert.deepEqual(ids(buildFlashcardDeck(terms, prefs({ scope: 'bookmarks' }), ['c', 'a'])), ['a', 'c']);
  assert.deepEqual(buildFlashcardDeck(terms, prefs({ scope: 'bookmarks' }), []), []);
});

test('a saved shuffled order is restored, stale ids drop out, new ids append in sort order', () => {
  const terms = [term('a', 'x'), term('b', 'x'), term('c', 'x'), term('d', 'x')];
  const deck = buildFlashcardDeck(terms, prefs({ order: ['c', 'a', 'stale-id'] }), []);
  assert.deepEqual(ids(deck), ['c', 'a', 'b', 'd']);
});

test('shuffle returns a permutation and honours the injected random source', () => {
  let seed = 42;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const input = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const order = shuffledOrder(input, random);
  assert.deepEqual([...order].sort(), [...input].sort());
  assert.notDeepEqual(order, input);
  assert.deepEqual(input, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 'input array is not mutated');
});

test('index clamping keeps the position inside the deck', () => {
  assert.equal(clampFlashcardIndex(5, 3), 2);
  assert.equal(clampFlashcardIndex(-1, 3), 0);
  assert.equal(clampFlashcardIndex(1, 3), 1);
  assert.equal(clampFlashcardIndex(3, 0), 0);
});

test('empty state carries term bookmarks and complete flashcard defaults', () => {
  const state = createEmptyState();
  assert.deepEqual(state.termBookmarks, []);
  assert.deepEqual(state.flashcards, { mode: 'list', backFirst: false, sort: 'default', scope: 'all', chapter: 'all', category: 'all', order: null, index: 0, flipped: false });
});

test('learning data written before term bookmarks existed still validates and loads', () => {
  const legacy = { ...createEmptyState(), format: DATA_FORMAT };
  delete legacy.termBookmarks;
  delete legacy.flashcards;
  assert.equal(validateLearningData(legacy), '');
  const loaded = normalizeLearningData(legacy);
  assert.deepEqual(loaded.termBookmarks, []);
  assert.equal(loaded.flashcards.mode, 'list');
});

test('malformed term bookmarks and flashcard prefs are rejected on import', () => {
  const base = { ...createEmptyState(), format: DATA_FORMAT };
  assert.match(validateLearningData({ ...base, termBookmarks: [42] }), /用語ブックマーク/);
  assert.match(validateLearningData({ ...base, flashcards: { sort: 'bogus' } }), /単語帳/);
  assert.match(validateLearningData({ ...base, flashcards: { order: 'not-an-array' } }), /単語帳/);
  assert.equal(validateLearningData({ ...base, termBookmarks: ['heat'], flashcards: { mode: 'cards', backFirst: true, sort: 'kana', order: ['heat'], index: 0 } }), '');
});

test('normalize dedupes term bookmarks and completes partial flashcard prefs', () => {
  const loaded = normalizeLearningData({ ...createEmptyState(), termBookmarks: ['a', 'a', 'b'], flashcards: { sort: 'kana', index: -3 } });
  assert.deepEqual(loaded.termBookmarks, ['a', 'b']);
  assert.equal(loaded.flashcards.sort, 'kana');
  assert.equal(loaded.flashcards.mode, 'list');
  assert.equal(loaded.flashcards.order, null);
  assert.equal(loaded.flashcards.index, 0);
});

test('merge unions term bookmarks from both records', () => {
  const a = { ...createEmptyState(), termBookmarks: ['a', 'b'] };
  const b = { ...createEmptyState(), termBookmarks: ['b', 'c'] };
  assert.deepEqual(mergeLearningData(a, b).termBookmarks, ['a', 'b', 'c']);
});
