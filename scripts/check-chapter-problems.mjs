#!/usr/bin/env node
// 章末問題・参考文献データ（data/chapter-problems/chapter-NN.json）の検証スクリプト。
//
// 使い方:
//   node scripts/check-chapter-problems.mjs [ahtt.txt のパス]
//   AHTT_TXT=/path/to/ahtt.txt node scripts/check-chapter-problems.mjs
//
// やること:
//   1. 原文テキスト層 ahtt.txt から、作成時と同じ分割規則（章ごとの開始行・
//      連番受理・走行見出し/フッタ除去・ページ換算 PDF = 書籍 + 14）で
//      各章の問題・参考文献の件数と開始ページを再導出する。
//   2. データ側の件数・連番・各エントリの bookPage/pdfPage と機械的に照合する。
//   3. 全ブロックを app.js の validBookBlocks / validBookFigure と同じ規則で検証する。
//
// ahtt.txt は公開リポジトリに含まれないため、このスクリプトは通常の
// テストスイート（npm test）には組み込まない。ローカル照合専用。
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const txtPath = process.argv[2] || process.env.AHTT_TXT ||
  join(homedir(), 'workspace/research_notes/ahtt-reading/ahtt.txt');

if (!existsSync(txtPath)) {
  console.error(`ahtt.txt が見つかりません: ${txtPath}`);
  console.error('引数または環境変数 AHTT_TXT でパスを指定してください。');
  process.exit(2);
}

// ---- 原文の境界（抽出時に実測した値。toc-verified.md の書籍ページ範囲と対応） ----
const P_START = { 1: 1845, 2: 3951, 3: 5736, 4: 7889, 5: 11099, 6: 15032, 7: 17770, 8: 20340, 9: 23157, 10: 26363, 11: 31030 };
const R_START = { 1: 2314, 2: 4471, 3: 6080, 4: 8264, 5: 11650, 6: 15465, 7: 18193, 8: 20804, 9: 23406, 10: 26778, 11: 31695 };
const TOC_RANGE = { 1: [36, 48], 2: [86, 98], 3: [130, 138], 4: [183, 193], 5: [252, 268], 6: [337, 350], 7: [399, 412], 8: [456, 470], 9: [528, 540], 10: [604, 618], 11: [707, 728] };
const BIBLIOGRAPHY_LINE = 2306; // 第1章のみ "Bibliography of Historical and Advanced Texts"

const rawLines = readFileSync(txtPath, 'utf8').split('\n');
// 行 -> PDF ページ（\f の累積）。書籍ページ = PDF - 14
const line2page = [];
{
  let cur = 1;
  for (const ln of rawLines) { line2page.push(cur); cur += (ln.match(/\f/g) || []).length; }
}
const bookpage = (lineno) => line2page[lineno - 1] - 14;

const HEAD_PATTERNS = [
  /^\s*(Problems|References)\s+\d+\s*$/,
  /^\s*\d+\s+Chapter\s+\d+:.*$/,
  /^\s*Chapter\s+\d+:.*\s\d+\s*$/,
];
function cleanLines(start, end) {
  const out = [];
  for (let ln = start; ln < end; ln++) {
    const s = rawLines[ln - 1].replace(/\f/g, '');
    if (HEAD_PATTERNS.some((p) => p.test(s))) continue;
    if (/^\s*\d{1,3}\s*$/.test(s)) continue; // フッタの単独ページ番号
    out.push([ln, s]);
  }
  return out;
}

function extractChapter(ch) {
  const p0 = P_START[ch], r0 = R_START[ch], endBook = TOC_RANGE[ch][1];
  let rEnd = r0, ln = r0;
  while (ln <= rawLines.length && bookpage(ln) <= endBook) { rEnd = ln; ln += 1; }

  const probRe = new RegExp(`^\\s{0,30}${ch}\\.(\\d{1,3})\\s{1,8}(\\S.*)$`);
  const problems = [];
  {
    let expected = 1, cur = null;
    for (const [lineNo, s] of cleanLines(p0 + 1, r0)) {
      const m = probRe.exec(s);
      if (m && Number(m[1]) === expected) {
        if (cur) problems.push(cur);
        cur = { number: `${ch}.${expected}`, startLine: lineNo, lastLine: lineNo };
        expected += 1;
      } else if (cur) {
        if (!(ch === 1 && lineNo >= BIBLIOGRAPHY_LINE)) cur.lastLine = lineNo;
      }
    }
    if (cur) problems.push(cur);
    for (const p of problems) {
      p.bookPage = bookpage(p.startLine);
      p.endBookPage = bookpage(p.lastLine);
      p.pdfPage = p.bookPage + 14;
      p.endPdfPage = p.endBookPage + 14;
    }
  }

  const refRe = new RegExp(`^\\s{0,30}\\[${ch}\\.(\\d{1,3})\\]\\s{0,3}(\\S.*)$`);
  const references = [];
  {
    let expected = 1, cur = null;
    for (const [lineNo, s] of cleanLines(r0 + 1, rEnd + 1)) {
      const m = refRe.exec(s);
      if (m && Number(m[1]) === expected) {
        if (cur) references.push(cur);
        cur = { number: `${ch}.${expected}`, startLine: lineNo };
        expected += 1;
      }
    }
    if (cur) references.push(cur);
    for (const r of references) { r.bookPage = bookpage(r.startLine); r.pdfPage = r.bookPage + 14; }
  }
  return { problems, references };
}

// ---- app.js の validBookBlocks / validBookFigure の移植 ----
const BOOK_BLOCK_TYPES = new Set(['heading', 'subheading', 'example', 'quote', 'experiment', 'footnote', 'formula', 'supplement', 'sourceNote', 'figure', 'table', 'list', 'problem', 'reference', 'paragraph']);
function validBookFigure(figure) {
  // 検証対象データの図は権利方針により src を持たない（公開側の原図埋め込みなし）。
  return figure && typeof figure === 'object' && !Array.isArray(figure) &&
    typeof figure.alt === 'string' && !!figure.alt.trim() &&
    (figure.src === undefined || figure.src === '');
}
function validBookBlocks(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return false;
  const ids = new Set();
  return blocks.every((block) => {
    if (!block || typeof block !== 'object' || Array.isArray(block) || !BOOK_BLOCK_TYPES.has(block.type)) return false;
    if (block.id !== undefined) {
      if (typeof block.id !== 'string' || !block.id || ids.has(block.id)) return false;
      ids.add(block.id);
    }
    if (['heading', 'subheading', 'example', 'quote', 'experiment', 'footnote', 'supplement', 'sourceNote', 'paragraph'].includes(block.type) && typeof block.text !== 'string') return false;
    if (block.type === 'formula' && typeof block.expression !== 'string') return false;
    if (block.type === 'figure' && !validBookFigure(block.figure ?? block)) return false;
    if (block.type === 'list' && (!Array.isArray(block.items) || !block.items.every((i) => typeof i === 'string'))) return false;
    if (block.type === 'table' && (!Array.isArray(block.headers) || !block.headers.every((i) => typeof i === 'string') || !Array.isArray(block.rows) || !block.rows.every((row) => Array.isArray(row) && row.every((i) => typeof i === 'string')))) return false;
    if (block.type === 'problem' && ((block.items !== undefined && (!Array.isArray(block.items) || !block.items.every((i) => typeof i === 'string'))) || (block.figureRefs !== undefined && (!Array.isArray(block.figureRefs) || !block.figureRefs.every((i) => typeof i === 'string'))) || (block.formulaBlocks !== undefined && (!Array.isArray(block.formulaBlocks) || !block.formulaBlocks.every((i) => i && typeof i === 'object' && typeof i.expression === 'string'))) || (block.figure !== undefined && !validBookFigure(block.figure)))) return false;
    return true;
  });
}

// ---- 照合 ----
let failures = 0;
const fail = (msg) => { failures += 1; console.log(`  NG: ${msg}`); };
let totalP = 0, totalR = 0;

for (let ch = 1; ch <= 11; ch++) {
  const nn = String(ch).padStart(2, '0');
  const dataPath = join(root, `data/chapter-problems/chapter-${nn}.json`);
  const src = extractChapter(ch);
  if (!existsSync(dataPath)) { fail(`Ch${ch}: データファイルがありません (${dataPath})`); continue; }
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const probs = data.problems.blocks.filter((b) => b.type === 'problem');
  const refs = data.references.blocks.filter((b) => b.type === 'reference');
  totalP += probs.length; totalR += refs.length;

  console.log(`Ch${ch}: 原文 問題${src.problems.length} / 参考文献${src.references.length}  vs  データ 問題${probs.length} / 参考文献${refs.length}`);
  if (data.chapterId !== `chapter-${nn}`) fail(`Ch${ch}: chapterId = ${data.chapterId}`);
  if (data.problems.count !== probs.length) fail(`Ch${ch}: problems.count=${data.problems.count} != 実ブロック数 ${probs.length}`);
  if (data.references.count !== refs.length) fail(`Ch${ch}: references.count=${data.references.count} != 実ブロック数 ${refs.length}`);
  if (src.problems.length !== probs.length) fail(`Ch${ch}: 問題数が不一致 原文${src.problems.length} vs データ${probs.length}`);
  if (src.references.length !== refs.length) fail(`Ch${ch}: 参考文献数が不一致 原文${src.references.length} vs データ${refs.length}`);

  src.problems.forEach((sp, i) => {
    const dp = probs[i];
    if (!dp) return;
    if (dp.number !== sp.number) fail(`Ch${ch}: 問題 ${i + 1} の番号が ${dp.number}（原文 ${sp.number}）`);
    for (const k of ['bookPage', 'endBookPage', 'pdfPage', 'endPdfPage']) {
      if (dp[k] !== sp[k]) fail(`Ch${ch}: 問題 ${sp.number} の ${k} が ${dp[k]}（原文 ${sp[k]}）`);
    }
    if (typeof dp.text !== 'string' || !dp.text) fail(`Ch${ch}: 問題 ${sp.number} の text が空です`);
  });
  src.references.forEach((sr, i) => {
    const dr = refs[i];
    if (!dr) return;
    if (dr.number !== sr.number) fail(`Ch${ch}: 参考文献 ${i + 1} の番号が ${dr.number}（原文 ${sr.number}）`);
    for (const k of ['bookPage', 'pdfPage']) {
      if (dr[k] !== sr[k]) fail(`Ch${ch}: 参考文献 ${sr.number} の ${k} が ${dr[k]}（原文 ${sr[k]}）`);
    }
    for (const k of ['authors', 'originalTitle', 'titleJa', 'publication']) {
      if (typeof dr[k] !== 'string' || !dr[k]) fail(`Ch${ch}: 参考文献 ${sr.number} の ${k} が空です`);
    }
  });

  if (!validBookBlocks(data.problems.blocks)) fail(`Ch${ch}: problems.blocks が validBookBlocks を満たしません`);
  if (!validBookBlocks(data.references.blocks)) fail(`Ch${ch}: references.blocks が validBookBlocks を満たしません`);
  if (data.references.preambleBlocks?.length && !validBookBlocks(data.references.preambleBlocks)) {
    fail(`Ch${ch}: references.preambleBlocks が validBookBlocks を満たしません`);
  }
}

console.log(`合計: 問題 ${totalP} 件 / 参考文献 ${totalR} 件（期待値: 問題 563 件 / 参考文献 410 件）`);
if (totalP !== 563 || totalR !== 410) fail('合計件数が期待値と一致しません');

if (failures) { console.log(`照合失敗: ${failures} 件`); process.exit(1); }
console.log('照合OK: 全11章で原文とデータが一致し、全ブロックが検証を通過しました。');
