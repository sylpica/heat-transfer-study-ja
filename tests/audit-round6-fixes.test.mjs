import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Muse round-6 fix, 2026-11-10. The mean Nusselt number in §7.2 was
// written with the katakana word 「バー」 (NuD バー) in three places where
// the original prints Nū_D with a combining macron (PDF 376). Meaning
// was preserved, but the notation form was inconsistent — eq. (7.27)
// even mixes both forms in one display (h̄ with a true U+0304).
// Record: docs/audit-final/ROUND6_MUSE_SEC7_20261110.md.

const section=async id=>JSON.parse(await readFile(new URL(`../data/sections/${id}-ja.json`,import.meta.url),'utf8'));
const MAC='\u0304';

test('§7.2 mean Nusselt number uses the printed macron form in all three places (PDF 376)',async()=>{
  const s=await section('7-2');
  assert.ok(s.blocks[48].explanation.includes(`平均ヌセルト数 Nu${MAC}D`));
  assert.ok(s.blocks[49].expression.startsWith(`Nu${MAC}D ≡ h${MAC}D/k`));
  assert.ok(s.blocks[53].expression.startsWith(`Nu${MAC}D = 3.657/tanh[`));
  const raw=await readFile(new URL('../data/sections/7-2-ja.json',import.meta.url),'utf8');
  assert.ok(!raw.includes('NuD バー'));
  // The (7.29) campaign fix (tanh argument) is untouched by this change.
  assert.ok(s.blocks[53].expression.includes('1.7·Gz^(−2/3)'));
});
