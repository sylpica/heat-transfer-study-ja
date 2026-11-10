import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Fixes for the full-page collation campaign #3, line A (chapter problems),
// implemented by Muse on 2026-11-11. Fix list:
// docs/audit-collation/CAMPAIGN3_FIXLIST_20261111.md (line A: A-1, A-2)
// Record: docs/audit-collation/CAMPAIGN3_FIX_A_20261111.md
// Every displayed form below follows the original page image of
// AHTTv600.pdf (600 dpi, descender-checked where glyphs were adjudicated),
// never the pre-fix data form.

const chapter = async id => JSON.parse(await readFile(new URL(`../data/chapter-problems/chapter-${id}.json`, import.meta.url), 'utf8'));
const prob = async (cid, pid) => (await chapter(cid)).problems.blocks.find(p => p.id === pid);
const MAC = '\u0304';   // combining macron
const OVL = '\u0305';   // combining overline
const TT = '\u{1D47B}';   // bold italic T
const SCRIPT_D = '\u{1D49F}';
const SCRIPT_F = 'ℱ';
const D_STROKE = 'Đ';

test('C3-A P1 (C07-16): problem 8.1 Pi_4 is the quotient Pr Re^2 / Ja in text and expression', async () => {
  const p = await prob('08', 'problem-8-1');
  assert.ok(p.text.includes('Pr·Re²/Ja'), p.text);
  assert.ok(!p.text.includes('Pr·Re²·Ja'));
  assert.equal(p.formulaBlocks[0].expression, 'Π_4 = Pr Re²/Ja');
  // Physics: with Ep = Re^2 Pr / Le (eq. 8.36 reading) the fourth group of
  // eq. (8.35) reduces to Pr Re^2 / Ja; the product form is a different
  // dimensionless group (off by Ja^2), so the two forms are distinguishable.
  const Pr = 0.7, Re = 100, Ja = 0.05;
  assert.ok(Math.abs((Pr * Re ** 2 / Ja) / (Pr * Re ** 2 * Ja) - 1 / Ja ** 2) < 1e-9);
});

test('C3-A P2 (C07-02): problem 7.45 hot-wire law has no /R_w on the left side', async () => {
  const p = await prob('07', 'problem-7-45');
  assert.equal(p.formulaBlocks[0].expression, 'V_w² = (T_wire − T_flow)(A + B u^(1/2))');
  assert.ok(!p.formulaBlocks[0].expression.includes('R_w'));
});

test('C3-A P2 (C06-01): problem 6.3 shooting variable is df\'/dη, not f\'', async () => {
  const p = await prob('06', 'problem-6-3');
  assert.equal((p.items[0].match(/df′\/dη/g) || []).length, 4, p.items[0]);
  assert.ok(p.items[1].includes('df′/dη の正しい値は η = 0 でおよそ0.33206'), p.items[1]);
  assert.ok(p.items[2].includes('df/dη = 1'), p.items[2]);  // item 3 keeps df/dη (no prime)
  assert.ok(!p.items[0].includes('f′（df/dη）'));
  // The value 0.33206 is f''(0) of the Blasius solution, i.e. df'/dη at 0.
});

test('C3-A (A-1): end pages sit on the text-completion page and keep the +14 offset everywhere', async () => {
  const ends = {
    '01': {'problem-1-15': [39, 53], 'problem-1-20': [41, 55], 'problem-1-26': [42, 56]},
    '02': {'problem-2-17': [89, 103], 'problem-2-23': [90, 104], 'problem-2-29': [91, 105], 'problem-2-41': [93, 107]},
    '03': {'problem-3-6': [130, 144]},
    '05': {'problem-5-6': [253, 267], 'problem-5-17': [255, 269], 'problem-5-24': [256, 270],
           'problem-5-50': [263, 277], 'problem-5-61': [265, 279], 'problem-5-66': [266, 280]},
    '06': {'problem-6-20': [339, 353], 'problem-6-29': [340, 354], 'problem-6-36': [341, 355]},
    '07': {'problem-7-46': [406, 420], 'problem-7-49': [407, 421], 'problem-7-51': [408, 422]},
    '08': {'problem-8-10': [457, 471], 'problem-8-23': [459, 473], 'problem-8-31': [460, 474],
           'problem-8-37': [461, 475], 'problem-8-50': [463, 477], 'problem-8-57': [465, 479]},
    '09': {'problem-9-25': [531, 545], 'problem-9-33': [532, 546]},
  };
  for (const cid of ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11']) {
    const ch = await chapter(cid);
    for (const b of ch.problems.blocks) {
      if (b.type === 'problem') {
        assert.equal(b.pdfPage - b.bookPage, 14, `${b.id} start offset`);
        assert.equal(b.endPdfPage - b.endBookPage, 14, `${b.id} end offset`);
        assert.ok(b.bookPage <= b.endBookPage, `${b.id} range`);
      }
      if (b.figure) assert.equal(b.figure.pdfPage - b.figure.bookPage, 14, `${b.id} figure offset`);
    }
  }
  for (const [cid, table] of Object.entries(ends)) {
    const ch = await chapter(cid);
    for (const [pid, [bk, pd]] of Object.entries(table)) {
      const p = ch.problems.blocks.find(x => x.id === pid);
      assert.deepEqual([p.endBookPage, p.endPdfPage], [bk, pd], pid);
    }
  }
  // figure pages (C07-19/20)
  assert.deepEqual([(await prob('08', 'problem-8-5')).figure.bookPage, (await prob('08', 'problem-8-5')).figure.pdfPage], [457, 471]);
  assert.deepEqual([(await prob('08', 'problem-8-9')).figure.bookPage, (await prob('08', 'problem-8-9')).figure.pdfPage], [458, 472]);
});

test('C3-A macrons: dropped overlines restored in ch.4/7/8 problems (h and Nu)', async () => {
  assert.ok((await prob('04', 'problem-4-43')).text.includes(`熱伝達率は h${MAC} = 28 W/m²·K`));
  assert.ok((await prob('07', 'problem-7-32')).text.includes(`Nu${MAC}_D を直接計算せよ`));
  assert.ok((await prob('07', 'problem-7-35')).text.includes(`ただし h${MAC} は分からない`));
  const p736 = await prob('07', 'problem-7-36');
  assert.ok(p736.text.includes(`なら h${MAC} はいくらか。u∞ が28 m/s なら h${MAC} はいくらか`));
  assert.ok((await prob('07', 'problem-7-39')).text.includes(`h${MAC} をプロットせよ`));
  const p813 = await prob('08', 'problem-8-13');
  assert.ok(p813.text.includes(`h${MAC}_conv はいくらか`), p813.text);
  assert.equal(p813.answerHint, `h${MAC} = 4.59 W/m²·K`);
  assert.ok((await prob('08', 'problem-8-14')).items[1].includes(`における h${MAC} で近似して`));
  assert.ok((await prob('08', 'problem-8-49')).hint.includes(`鉛に対する h${MAC} を計算する際は`));
});

test('C3-A macron over-application removed (C07-10): problem 7.42 boundary u has no bar, defined ū keeps it', async () => {
  const p = await prob('07', 'problem-7-42');
  assert.ok(p.text.includes('ここで u = 0 は正方形の辺上であり'), p.text);
  assert.ok(p.text.includes('ū = u/[(a²/μ)(dp/dz)]'), p.text);  // ū = U+016B precomposed, as in the data convention
  assert.ok(!p.text.includes('ここで ū = 0'));
});

test('C3-A script F (C07-25): problem 8.42 view factor uses ℱ U+2131', async () => {
  const p = await prob('08', 'problem-8-42');
  assert.ok(p.text.includes(`${SCRIPT_F}_{rod–room} = 0.15`), p.text);
  assert.ok(!p.text.includes('F_{rod–room}'));
});

test('C3-A (C3C08-16): no U+00B5 remains in any chapter-problems file; mu is U+03BC', async () => {
  for (const cid of ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11']) {
    const raw = await readFile(new URL(`../data/chapter-problems/chapter-${cid}.json`, import.meta.url), 'utf8');
    assert.ok(!raw.includes('µ'), `chapter-${cid} still contains U+00B5`);
  }
  const p853 = await prob('08', 'problem-8-53');
  const s = JSON.stringify(p853);
  assert.equal((s.match(/μ/g) || []).length, 3, s);
  assert.ok(p853.continuation.includes('μ = 9.75 × 10⁻⁶ kg/m³'));
});

test('C3-A time-constant class: script 𝒯 (U+1D4AF) replaced by bold-italic 𝑻 (U+1D47B) in ch.2/ch.5 problems', async () => {
  for (const cid of ['02', '05']) {
    const raw = await readFile(new URL(`../data/chapter-problems/chapter-${cid}.json`, import.meta.url), 'utf8');
    assert.ok(!raw.includes('\u{1D4AF}'), `chapter-${cid} still contains script T`);
  }
  assert.ok((await prob('02', 'problem-2-22')).items[0].includes(`タンクの時定数 ${TT}`));
  assert.ok((await prob('05', 'problem-5-1')).text.includes(`(T_i − b${TT})`));
  const p552 = await prob('05', 'problem-5-52');
  assert.equal((JSON.stringify(p552).match(new RegExp(TT, 'g')) || []).length, 5);
  const p554 = await prob('05', 'problem-5-54');
  assert.equal((JSON.stringify(p554).match(new RegExp(TT, 'g')) || []).length, 5);
  const p558 = await prob('05', 'problem-5-58');
  assert.equal((JSON.stringify(p558).match(new RegExp(TT, 'g')) || []).length, 3);
  assert.ok(p558.answerHint.includes(`t/${TT} = Bi_L Fo_l`));
});

test('C3-A ch.5 companions: 5.52(b) bracket/operator forms, 5.54 Re braces, 5.28 unit form', async () => {
  const p552 = await prob('05', 'problem-5-52');
  assert.equal(p552.formulaBlocks[1].expression,
    `T(t) = T_∞(t) + [T_i − T_∞(0)] e^(−t/${TT}) − e^(−t/${TT}) ∫_0^t e^(s/${TT}) (d/ds) T_∞(s) ds`);
  const p554 = await prob('05', 'problem-5-54');
  assert.ok(p554.items[0].includes('Re{e^(iωt)} = cos ωt'), p554.items[0]);
  const p528 = await prob('05', 'problem-5-28');
  assert.equal(p528.answerHint, 'q = 338 W/m²K');
  assert.ok(p528.sourceNote.ja.includes('q = 338 W/m²K'));
  assert.ok(p528.sourceNote.en.includes('in W/m²K;'));
});

test('C3-A terminology & bracket glyphs: 3.5/3.6 use 係数 not 率; 4.3 bracket pair is half-width', async () => {
  assert.ok((await prob('03', 'problem-3-5')).text.includes('総括熱伝達係数'));
  assert.ok((await prob('03', 'problem-3-6')).text.includes('凝縮熱伝達係数'));
  const h = (await prob('04', 'problem-4-3')).answerHint;
  assert.ok(h.includes('EIL²/(2k·体積)'), h);
  assert.ok(!h.includes('体積）'));
});

test('C3-A per-instance ≃/≅ (C06-02): problem 6.21 is ≅, while 6.16 keeps ≃ and 6.20 keeps ≅', async () => {
  assert.ok((await prob('06', 'problem-6-21')).text.includes('u/u_∞ ≅ (3/2)(y/δ)'));
  assert.ok((await prob('06', 'problem-6-16')).answerHint.includes('≃'));
  assert.ok((await prob('06', 'problem-6-20')).answerHint.includes('≅'));
});

test('C3-A subscript identity (C02-F14): problem 2.23(c) is q_l (ell), head q_1 stays', async () => {
  const p = await prob('02', 'problem-2-23');
  assert.ok(p.items[2].includes('q_l が400 W/m²'), p.items[2]);
  assert.ok(p.text.includes('熱流束 q_1 を受ける'), p.text);
});

test('C3-A figure alt dimensions: 8.5 (Fig. 8.17) and five ch.10 figures carry the printed sizes', async () => {
  assert.ok((await prob('08', 'problem-8-5')).figure.alt.includes('20 cm'));
  const a9 = (await prob('10', 'problem-10-9')).figure.alt;
  assert.ok(a9.includes('幅2 m × 長さ3 m × 高さ0.8 m'), a9);
  const a11 = (await prob('10', 'problem-10-11')).figure.alt;
  assert.ok(a11.includes('幅0.4 m・高さ0.6 m') && a11.includes('長さ1.2 m × 奥行き1/2 m'), a11);
  const a12 = (await prob('10', 'problem-10-12')).figure.alt;
  assert.ok(a12.includes('一辺 L') && a12.includes('0.7L'), a12);
  const a15 = (await prob('10', 'problem-10-15')).figure.alt;
  assert.ok(a15.includes('幅0.4 m・高さ0.6 m') && a15.includes('奥行き0.8 m'), a15);
  const a16 = (await prob('10', 'problem-10-16')).figure.alt;
  assert.ok(a16.includes('0.25 m × 0.25 m') && a16.includes('直径0.1 m'), a16);
});

test('C3-A ch.11 glyphs: 𝒟 restorations, Đ (U+0110) not Ð (U+00D0), ℱ in 11.56, whole-token overline in 11.29/11.41', async () => {
  const raw11 = await readFile(new URL('../data/chapter-problems/chapter-11.json', import.meta.url), 'utf8');
  assert.ok(!raw11.includes('Ð'), 'U+00D0 remains in chapter-11');
  assert.ok((await prob('11', 'problem-11-26')).items[2].includes(`ν = ${SCRIPT_D}_im`));
  const p1129 = await prob('11', 'problem-11-29');
  assert.ok(p1129.text.includes(`m${OVL}_{H${OVL}e${OVL},s${OVL}}`), p1129.text);
  const p1141 = await prob('11', 'problem-11-41');
  assert.ok(p1141.formulaBlocks[0].expression.startsWith(`N${OVL}u${OVL}_D = 2 +`), p1141.formulaBlocks[0].expression);
  const p1143 = await prob('11', 'problem-11-43');
  assert.ok(p1143.items[1].includes(`${SCRIPT_D}_{He,m} と ${SCRIPT_D}_{Ar,m}`));
  assert.ok((await prob('11', 'problem-11-47')).items[1].includes(`ρ${SCRIPT_D}_12`));
  const p1153 = await prob('11', 'problem-11-53');
  assert.ok(p1153.text.includes(`拡散係数 ${SCRIPT_D}_im`));
  assert.ok(p1153.items[1].includes(`${D_STROKE}_ij が各化学種ペア`));
  assert.ok(p1153.items[1].includes(`${SCRIPT_D}_im = ${D_STROKE}_ij`));
  assert.ok(p1153.items[2].includes(`${SCRIPT_D}_im = ${D_STROKE}_{i,n}`));
  const p1156 = await prob('11', 'problem-11-56');
  assert.ok(p1156.items[2].includes(`−z_i ${SCRIPT_F}∇φ`));
  assert.ok(p1156.items[2].includes(`${SCRIPT_F} = 9.6485 × 10⁴ C/mol`));
  assert.equal((p1156.formulaBlocks[0].expression.match(new RegExp(`${SCRIPT_D}_\\{i,n\\}`, 'g')) || []).length, 2);
  assert.ok(p1156.formulaBlocks[0].expression.includes(`(${SCRIPT_F}/(R°T))`));
  const p1157 = await prob('11', 'problem-11-57');
  for (const sub of ['_12', '_13', '_23']) assert.ok(p1157.text.includes(`${D_STROKE}${sub}`), sub);
  // problem 11.52's D is the number of molecular energy modes, not a diffusion coefficient: untouched
  assert.ok((await prob('11', 'problem-11-52')).text.includes('γ ≊ (D + 2)/D'));
});
