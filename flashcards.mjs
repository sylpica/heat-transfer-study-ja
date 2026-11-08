// Flashcard deck construction for the glossary (単語帳モード).
// Pure helpers: filtering, sorting, shuffle and position clamping live here
// so they can be unit-tested without a browser. The deck is always derived
// from the glossary array plus the learner's saved preferences; the only
// persisted order is the shuffled id list, so a deck can be rebuilt exactly
// after a reload.
export const FLASHCARD_SORTS = ['default', 'kana', 'section'];
export const FLASHCARD_SCOPES = ['all', 'bookmarks'];

export function defaultFlashcardPrefs() {
  return { mode: 'list', backFirst: false, sort: 'default', scope: 'all', chapter: 'all', category: 'all', order: null, index: 0, flipped: false };
}

function sectionParts(value) {
  const match = /^(\d+)\.(\d+)$/.exec(String(value ?? ''));
  return match ? [Number(match[1]), Number(match[2])] : null;
}

// Every chapter a term belongs to: its own source section plus the chapters
// of its related sections. Most glossary entries are supplements without a
// source section, so relatedSections is what makes chapter filtering useful.
export function termChapters(term) {
  const chapters = new Set();
  const own = sectionParts(term?.source?.section);
  if (own) chapters.add(own[0]);
  for (const section of term?.relatedSections || []) {
    const parts = sectionParts(section);
    if (parts) chapters.add(parts[0]);
  }
  return chapters;
}

export function termInChapter(term, chapter) {
  return termChapters(term).has(Number(chapter));
}

// The section a term sorts under for 章・分野順: its own source section when
// numeric, otherwise the smallest related section, otherwise null (sorted
// last, with the other chapter-less supplements).
export function termSortSection(term) {
  const own = sectionParts(term?.source?.section);
  if (own) return own;
  let best = null;
  for (const section of term?.relatedSections || []) {
    const parts = sectionParts(section);
    if (parts && (!best || parts[0] < best[0] || (parts[0] === best[0] && parts[1] < best[1]))) best = parts;
  }
  return best;
}

export function flashcardCategories(terms) {
  const seen = [];
  for (const term of terms || []) {
    if (term?.category && !seen.includes(term.category)) seen.push(term.category);
  }
  return seen;
}

export function flashcardChapters(terms) {
  const chapters = new Set();
  for (const term of terms || []) for (const chapter of termChapters(term)) chapters.add(chapter);
  return [...chapters].sort((a, b) => a - b);
}

function kanaCompare(a, b) {
  return String(a?.ja ?? '').localeCompare(String(b?.ja ?? ''), 'ja') || String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
}

export function sortFlashcardTerms(terms, sort) {
  const list = [...(terms || [])];
  if (sort === 'kana') return list.sort(kanaCompare);
  if (sort === 'section') {
    return list.sort((a, b) => {
      const sa = termSortSection(a), sb = termSortSection(b);
      if (sa && sb) {
        if (sa[0] !== sb[0]) return sa[0] - sb[0];
        if (sa[1] !== sb[1]) return sa[1] - sb[1];
      } else if (sa) return -1;
      else if (sb) return 1;
      const byCategory = String(a?.category ?? '').localeCompare(String(b?.category ?? ''), 'ja');
      return byCategory || kanaCompare(a, b);
    });
  }
  return list; // 'default': registration order, exactly as stored in the data.
}

// Builds the deck for the saved preferences. `order` (the shuffled id list)
// wins over the sort for the ids it still covers; ids that entered the
// filtered set later (e.g. a term bookmarked after shuffling) keep their
// sorted place at the end instead of breaking the restored position.
export function buildFlashcardDeck(terms, prefs, bookmarkedIds) {
  const p = { ...defaultFlashcardPrefs(), ...(prefs || {}) };
  const bookmarks = new Set(bookmarkedIds || []);
  let deck = (terms || []).filter(term => {
    if (p.scope === 'bookmarks' && !bookmarks.has(term.id)) return false;
    if (p.chapter !== 'all' && !termInChapter(term, p.chapter)) return false;
    if (p.category !== 'all' && term.category !== p.category) return false;
    return true;
  });
  deck = sortFlashcardTerms(deck, p.sort);
  if (Array.isArray(p.order) && p.order.length) {
    const byId = new Map(deck.map(term => [term.id, term]));
    const placed = new Set();
    const ordered = [];
    for (const id of p.order) {
      if (byId.has(id) && !placed.has(id)) { ordered.push(byId.get(id)); placed.add(id); }
    }
    for (const term of deck) if (!placed.has(term.id)) ordered.push(term);
    deck = ordered;
  }
  return deck;
}

// Fisher–Yates over a copy; the random source is injectable for tests.
export function shuffledOrder(ids, random = Math.random) {
  const order = [...(ids || [])];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function clampFlashcardIndex(index, length) {
  if (!Number.isInteger(length) || length <= 0) return 0;
  if (!Number.isInteger(index) || index < 0) return 0;
  return Math.min(index, length - 1);
}
