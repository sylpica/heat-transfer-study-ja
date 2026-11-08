#!/usr/bin/env node
// 付録参考文献データ（data/appendix-references/appendix-a.json / appendix-b.json）の
// 検証スクリプト。scripts/check-chapter-problems.mjs と同系の照合方式。
//
// 使い方:
//   node scripts/check-appendix-references.mjs [ahtt.txt のパス]
//   AHTT_TXT=/path/to/ahtt.txt node scripts/check-appendix-references.mjs
//
// やること:
//   1. 原文テキスト層 ahtt.txt から、付録A（書籍 pp.734–738、表A.1 の直前まで）と
//      付録B（書籍 p.765）の References を、連番受理・走行見出し/フッタ除去・
//      ページ換算 PDF = 書籍 + 14 の規則で再導出する。
//   2. データ側の件数・連番・各エントリの bookPage/pdfPage と機械的に照合する。
//   3. 全ブロックを app.js の validBookBlocks と同じ規則で検証する。
//
// ahtt.txt は公開リポジトリに含まれないため、このスクリプトは通常の
// テストスイート（npm test）には組み込んでいない。ローカル照合専用。
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

const rawLines = readFileSync(txtPath, 'utf8').split('\n');
// 行 -> PDF ページ（\f の累積）。書籍ページ = PDF - 14
const line2page = [];
{
  let cur = 1;
  for (const ln of rawLines) { line2page.push(cur); cur += (ln.match(/\f/g) || []).length; }
}
const bookpage = (lineno) => line2page[lineno - 1] - 14;

const HEAD_PATTERNS = [
  /^\s*References\s+\d+\s*$/,              // 奇数ページの走行見出し
  /^\s*\d+\s+Chapter\s+A:.*$/,             // 偶数ページの走行見出し（付録A）
  /^\s*Chapter\s+A:.*\s\d+\s*$/,
  /^\s*Appendix\s+B:.*\s\d+\s*$/,          // 付録Bの走行見出し
  /^\s*\d+\s+Appendix\s+B:.*$/,
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

function extractAppendix(letter) {
  // 見出し "References" の直後にある最初の [X.1] を起点にする。
  const firstRe = new RegExp(`^\\s{0,10}\\[${letter}\\.1\\]\\s`);
  let firstLine = -1;
  for (let ln = 1; ln <= rawLines.length; ln++) {
    if (firstRe.test(rawLines[ln - 1].replace(/\f/g, ''))) { firstLine = ln; break; }
  }
  if (firstLine < 0) throw new Error(`付録${letter}: [${letter}.1] が原文に見つかりません`);
  // 終端: 付録A は表A.1 の見出し行、付録B は付録C（Nomenclature）の開始行。
  const endRe = letter === 'A' ? /Table A\.1\s+Properties of metallic solids/ : /Nomenclature/;
  let endLine = -1;
  for (let ln = firstLine + 1; ln <= rawLines.length; ln++) {
    if (endRe.test(rawLines[ln - 1])) { endLine = ln; break; }
  }
  if (endLine < 0) throw new Error(`付録${letter}: 終端が原文に見つかりません`);
  const entryRe = new RegExp(`^\\s{0,10}\\[${letter}\\.(\\d{1,2})\\]\\s`);
  const references = [];
  let expected = 1;
  for (const [lineNo, s] of cleanLines(firstLine, endLine)) {
    const m = entryRe.exec(s);
    if (m && Number(m[1]) === expected) {
      references.push({ number: `${letter}.${expected}`, startLine: lineNo });
      expected += 1;
    }
  }
  for (const r of references) { r.bookPage = bookpage(r.startLine); r.pdfPage = r.bookPage + 14; }
  return references;
}

// ---- app.js の validBookBlocks / validBookFigure の移植（check-chapter-problems.mjs と同一） ----
const BOOK_BLOCK_TYPES = new Set(['heading', 'subheading', 'example', 'quote', 'experiment', 'footnote', 'formula', 'supplement', 'sourceNote', 'figure', 'table', 'list', 'problem', 'reference', 'paragraph']);
function validBookFigure(figure) {
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
const EXPECTED = { A: 41, B: 1 };
let total = 0;

for (const letter of ['A', 'B']) {
  const lower = letter.toLowerCase();
  const dataPath = join(root, `data/appendix-references/appendix-${lower}.json`);
  const src = extractAppendix(letter);
  if (!existsSync(dataPath)) { fail(`付録${letter}: データファイルがありません (${dataPath})`); continue; }
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const refs = data.references.blocks.filter((b) => b.type === 'reference');
  total += refs.length;

  console.log(`付録${letter}: 原文 参考文献${src.length}  vs  データ 参考文献${refs.length}`);
  if (data.appendixId !== `appendix-${lower}`) fail(`付録${letter}: appendixId = ${data.appendixId}`);
  if (data.language !== 'ja') fail(`付録${letter}: language = ${data.language}`);
  if (data.references.count !== refs.length) fail(`付録${letter}: references.count=${data.references.count} != 実ブロック数 ${refs.length}`);
  if (data.references.blocks.length !== refs.length) fail(`付録${letter}: references.blocks に reference 以外のブロックがあります`);
  if (src.length !== refs.length) fail(`付録${letter}: 参考文献数が不一致 原文${src.length} vs データ${refs.length}`);
  if (src.length !== EXPECTED[letter]) fail(`付録${letter}: 原文の再導出件数 ${src.length} が期待値 ${EXPECTED[letter]} と一致しません`);

  src.forEach((sr, i) => {
    const dr = refs[i];
    if (!dr) return;
    if (dr.number !== sr.number) fail(`付録${letter}: 参考文献 ${i + 1} の番号が ${dr.number}（原文 ${sr.number}）`);
    for (const k of ['bookPage', 'pdfPage']) {
      if (dr[k] !== sr[k]) fail(`付録${letter}: 参考文献 ${sr.number} の ${k} が ${dr[k]}（原文 ${sr[k]}）`);
    }
    for (const k of ['authors', 'originalTitle', 'titleJa', 'publication']) {
      if (typeof dr[k] !== 'string' || !dr[k]) fail(`付録${letter}: 参考文献 ${sr.number} の ${k} が空です`);
    }
  });

  if (!validBookBlocks(data.references.blocks)) fail(`付録${letter}: references.blocks が validBookBlocks を満たしません`);
}

console.log(`合計: 参考文献 ${total} 件（期待値: 付録A 41 件 + 付録B 1 件 = 42 件）`);
if (total !== 42) fail('合計件数が期待値と一致しません');

if (failures) { console.log(`照合失敗: ${failures} 件`); process.exit(1); }
console.log('照合OK: 付録A・Bとも原文とデータが一致し、全ブロックが検証を通過しました。');
