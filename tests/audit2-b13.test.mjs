// Regression tests for audit phase B-13 (round-2 finding A2-R2-08:
// translation-availability copy on the home hero card and the reader page
// heading). The old copy conditioned reading-position resume and in-app
// body display on "sections where a translation is included", which reads
// as if some sections ship with a translation; the public build includes
// none (0/76), and resume is not translation-dependent at all. Source
// assertions pin the corrected copy plus the implementation facts the copy
// rests on; the rendered appearance is checked in the batch log
// (audit2-fix-b13-log.md).
// PREMISE CHANGE (2026-11-05): the owner decided on 2026-11-04 to include the
// Japanese translation in the public build. All 76 sections now ship as
// bundled content (data/sections/*-ja.json via data/content-manifest.json),
// checked against the original by the translator; expert review is still
// outstanding and the copy must keep saying so. The reader assertions below
// were updated to pin the new disclosure instead of the old exclusion.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const readText=async file=>await readFile(new URL('../'+file,import.meta.url),'utf8');
const readJson=async file=>JSON.parse(await readText(file));
const [appJs,book]=await Promise.all([readText('app.js'),readJson('data/book.json')]);

// ---------- A2-R2-08: home hero copy ----------
test('A2-R2-08: home hero no longer conditions resume on an included translation',()=>{
  assert.equal(appJs.includes('日本語訳が収録された節では'),false,
    'the misleading translation conditional must be gone from the hero copy');
  assert.ok(appJs.includes('読書位置は節ごとに保存されるので、前回の続きから再開できます。'),
    'hero copy must state the actual per-section position saving');
});
test('A2-R2-08: position saving really is per-section and translation-independent',()=>{
  // Saved on scroll for whatever section is open in the reader, with no
  // translation gate; openReader restores the saved position the same way.
  assert.ok(appJs.includes("window.addEventListener('scroll', saveReaderPosition, { passive: true })"),
    'scroll listener must keep saving the reader position');
  const start=appJs.indexOf('function saveReaderPosition()');
  const end=appJs.indexOf('function captureReaderPosition()');
  assert.ok(start>=0&&end>start,'saveReaderPosition must exist');
  const body=appJs.slice(start,end);
  assert.ok(body.includes('state.readerPositions[section]=position'),
    'positions must be stored per section');
  assert.equal(body.includes('sectionIsTranslated'),false,
    'position saving must not be gated on translation availability');
});

// ---------- A2-R2-08: reader page heading copy ----------
test('A2-R2-08: reader page discloses the shipped translation and its review state',()=>{
  assert.equal(appJs.includes('アプリ内に訳文がある節では'),false,
    'the misleading translation conditional must stay gone from the reader page');
  assert.equal(appJs.includes('書籍の日本語訳は公開版に収録していません。'),false,
    'the old no-translation disclosure must be gone (owner decision 2026-11-04)');
  assert.ok(appJs.includes('書籍の日本語訳（全76節）を収録しています。翻訳は作業者が原本と照合済みですが、専門家校閲は未実施です。'),
    'reader page must disclose the shipped translation and that expert review is outstanding');
  assert.ok(appJs.includes('自分の訳稿などをローカル教材として追加した場合は、その本文を段落や式とともに表示します。'),
    'locally added material must still be described as an additional source');
});
test('A2-R2-08: premise holds in the shipped data (no section carries body blocks)',()=>{
  const sections=book.chapters.flatMap(chapter=>chapter.sections);
  assert.equal(sections.length,76,'the book has 76 sections');
  assert.ok(sections.every(s=>!Array.isArray(s.blocks)||s.blocks.length===0),
    'public data must not embed Japanese body blocks (readable text comes from the local pack)');
  assert.ok(sections.every(s=>!Array.isArray(s.blocksEn)||s.blocksEn.length===0),
    'public data must not embed English body blocks either');
  // In-app bodies come from the bundled content manifest (the shipped
  // translation) and may be overridden by the runtime local-content pack.
  assert.ok(appJs.includes("'./data/content-manifest.json'"),
    'the bundled content manifest must remain a core data file');
  assert.ok(appJs.includes("fetch('./data/local-content-manifest.json')"),
    'the local content pack merge path must remain available');
});
