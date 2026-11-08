// Verification driver for dynamic/dev/conjugate-cavity.mjs against the
// support-conjugate reference record (Codex branch codex/support-natconv-
// conjugate @cc932b7). Usage: node scripts/dynamic-conjugate-cavity-verify.mjs
// [a1|a2|b|c|d16|d32|d64 ...] (default: all). Results are printed as JSON
// lines; set CONJ_DUMP_DIR to also dump final fields for field-level diffs.
//
// Steady seeking: the slow thermal transient is advanced with the module's
// frozen-flow advanceThermal in blocks, refreshed by short coupled blocks.
// A state is only ever CALLED steady after the module's own coupled
// runToSteady criterion (Codex protocol: Dt<1e-7, relative velocity and
// interface-heat changes <1e-6 over Dt=0.1, two consecutive intervals)
// passes from that state.
import {createConjugateCavity} from '../dynamic/dev/conjugate-cavity.mjs';
import {writeFileSync, mkdirSync, existsSync, readFileSync} from 'node:fs';

const DELTA = 0.25;
const out = (obj) => console.log(JSON.stringify(obj));

function exactConduction(n, K, S) {
  const s = n / 4, nx = n + s, h = 1 / n;
  const Q = (1 + S * DELTA * DELTA / (2 * K)) / (1 + DELTA / K);
  const T = new Float64Array(nx * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < nx; i++) {
    if (i < s) { const m = (i + 0.5) * h; T[j * nx + i] = 1 + (S * DELTA - Q) * m / K - S * (m * m + h * h / 12) / (2 * K); }
    else { const X = (i - s + 0.5) * h; T[j * nx + i] = Q * (1 - X); }
  }
  return {T, Q};
}

function bilinear(src, srcNx, srcNy, srcX0, srcY0, srcH, x, y) {
  const fx = Math.min(Math.max((x - srcX0) / srcH - 0.5, 0), srcNx - 1 - 1e-9);
  const fy = Math.min(Math.max((y - srcY0) / srcH - 0.5, 0), srcNy - 1 - 1e-9);
  const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const a = src[iy * srcNx + ix], b = src[iy * srcNx + ix + 1], c = src[(iy + 1) * srcNx + ix], d = src[(iy + 1) * srcNx + ix + 1];
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

function seedFrom(snap, nFine) {
  const nC = snap.mesh.n, sC = snap.mesh.solidColumns, nxC = snap.mesh.columns;
  const sF = nFine / 4, nxF = nFine + sF;
  const T = new Float64Array(nxF * nFine);
  for (let j = 0; j < nFine; j++) for (let i = 0; i < nxF; i++) {
    const x = -DELTA + (i + 0.5) / nFine, y = (j + 0.5) / nFine;
    T[j * nxF + i] = bilinear(snap.temperature, nxC, nC, -DELTA, 0, 1 / nC, x, y);
  }
  const u = new Float64Array(nFine * (nFine + 1)), v = new Float64Array((nFine + 1) * nFine);
  for (let j = 0; j < nFine; j++) for (let f = 1; f < nFine; f++) {
    u[j * (nFine + 1) + f] = bilinear(snap.u, nC + 1, nC, 0, 0, 1 / nC, f / nFine, (j + 0.5) / nFine);
  }
  for (let g = 1; g < nFine; g++) for (let i = 0; i < nFine; i++) {
    v[g * nFine + i] = bilinear(snap.v, nC, nC + 1, 0, 0, 1 / nC, (i + 0.5) / nFine, g / nFine);
  }
  return {initialTemperature: Array.from(T), initialVelocity: {u: Array.from(u), v: Array.from(v)}};
}

function drive(m, span, thermal) {
  const target = m.time + span;
  while (m.time < target) { const dt = Math.min(m.safeDt, target - m.time); if (!(dt > 0)) break; if (thermal) m.advanceThermal(dt); else m.advance(dt); }
}

function seekSteady(m, {thermalSpan = 0.2, coupledSpan = 0.05, maxCycles = 80, certifySpan = 0.35} = {}) {
  let quiet = 0;
  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    drive(m, thermalSpan, true);
    const before = m.snapshot();
    drive(m, coupledSpan, false);
    const after = m.snapshot();
    let dT = 0; for (let i = 0; i < after.temperature.length; i++) dT = Math.max(dT, Math.abs(after.temperature[i] - before.temperature[i]));
    const dQ = Math.abs(after.instantaneousPowers.interface - before.instantaneousPowers.interface) / Math.max(Math.abs(before.instantaneousPowers.interface), 1e-300);
    const scale = 0.1 / coupledSpan;
    if (dT * scale < 0.5e-7 && dQ * scale < 0.5e-6) quiet++; else quiet = 0;
    if (quiet >= 1) {
      const cert = m.runToSteady({interval: 0.1, maxTime: m.time + certifySpan});
      if (cert.steady) return {steady: true, cycles: cycle, certRows: cert.rows.length};
    }
  }
  return {steady: false, cycles: maxCycles};
}

function metrics(snap) {
  return {
    time: snap.time, steps: snap.steps,
    interfaceHeat: snap.instantaneousPowers.interface,
    interfaceTempMean: snap.interfaceTemperature.mean,
    interfaceTempMin: snap.interfaceTemperature.minimum,
    interfaceTempMax: snap.interfaceTemperature.maximum,
    maxFaceSpeed: snap.maximumFaceSpeed,
    solidMeanT: snap.solidTemperature.mean, fluidMeanT: snap.fluidTemperature.mean,
    Bi: snap.solidBiFromInterfaceAverage,
    energyRelErr: snap.energy.relativeMaximumError,
    divergence: snap.divergence, maxPe: snap.maximumObservedCellPe,
  };
}
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

const CODEX_MAIN = {
  16: {interfaceHeat: 0.6964472716362966, interfaceTempMean: 0.6517763913916443, maxFaceSpeed: 2.4952162624111827, solidMeanT: 0.8258881997098216, fluidMeanT: 0.3265799325111529, Bi: 0.5342685626808859},
  32: {interfaceHeat: 0.6948715158169103, interfaceTempMean: 0.6525642189755732, maxFaceSpeed: 2.492845317484628, solidMeanT: 0.8262821063799386, fluidMeanT: 0.32691478785917283, Bi: 0.5324161941546176},
  64: {interfaceHeat: 0.694472717008235, interfaceTempMean: 0.6527636161203673, maxFaceSpeed: 2.4923150880345784, solidMeanT: 0.8263818047301977, fluidMeanT: 0.3269993896818981, Bi: 0.5319480895211053},
};

const cases = new Set(process.argv.slice(2).length ? process.argv.slice(2) : ['a1', 'a2', 'b', 'c', 'd16', 'd32', 'd64']);
const dumpDir = process.env.CONJ_DUMP_DIR;
if (dumpDir) mkdirSync(dumpDir, {recursive: true});
let snap16 = null, snap32 = null;

if (cases.has('a1')) {
  for (const K of [0.01, 0.5, 10]) {
    const {T, Q} = exactConduction(16, K, 0);
    const m = createConjugateCavity({n: 16, rayleigh: 0, conductivityRatio: K, capacityRatio: 2, initialTemperature: Array.from(T)});
    const ev = m.evaluate();
    out({case: 'A1-residual', K, analyticQ: Q, interfaceHeat: ev.instantaneousPowers.interface, interfaceRelErr: rel(ev.instantaneousPowers.interface, Q), maxRate: Math.max(...ev.temperatureRate.map(Math.abs))});
  }
  const {Q} = exactConduction(16, 0.5, 0);
  const m = createConjugateCavity({n: 16, rayleigh: 0, conductivityRatio: 0.5, capacityRatio: 2});
  const t0 = Date.now(); const r = m.runToSteady({maxTime: 30});
  const s = m.snapshot();
  out({case: 'A1-marched', K: 0.5, steady: r.steady, ...metrics(s), analyticQ: Q, interfaceRelErr: rel(s.instantaneousPowers.interface, Q), wallMs: Date.now() - t0});
}

if (cases.has('a2')) {
  let prev = null;
  for (const n of [16, 32, 64]) {
    const {T, Q} = exactConduction(n, 0.5, 1);
    const init = prev ? {initialTemperature: seedFrom(prev, n).initialTemperature} : {};
    const m = createConjugateCavity({n, rayleigh: 0, conductivityRatio: 0.5, capacityRatio: 2, source: 1, ...init});
    const t0 = Date.now(); const r = m.runToSteady({maxTime: 40});
    const s = m.snapshot();
    let rms = 0; for (let i = 0; i < T.length; i++) rms += (s.temperature[i] - T[i]) ** 2; rms = Math.sqrt(rms / T.length);
    out({case: 'A2', n, steady: r.steady, ...metrics(s), analyticQ: Q, interfaceRelErr: rel(s.instantaneousPowers.interface, Q), rmsVsExactCellMeans: rms, wallMs: Date.now() - t0});
    prev = s;
  }
}

if (cases.has('b')) {
  for (const K of [16, 64, 256]) {
    const m = createConjugateCavity({n: 16, rayleigh: 1000, prandtl: 0.71, conductivityRatio: K, capacityRatio: K / 8});
    const t0 = Date.now(); const r = seekSteady(m, {maxCycles: 60});
    const s = m.snapshot();
    out({case: 'B-isothermal-limit', K, steady: r.steady, cycles: r.cycles, ...metrics(s), wallMs: Date.now() - t0});
  }
}

if (cases.has('c')) {
  const m = createConjugateCavity({n: 16, rayleigh: 1000, prandtl: 0.71, conductivityRatio: 0.01, capacityRatio: 0.01});
  const t0 = Date.now(); const r = seekSteady(m, {maxCycles: 120, thermalSpan: 0.25, coupledSpan: 0.05});
  const s = m.snapshot();
  out({case: 'C-solid-dominated', steady: r.steady, cycles: r.cycles, ...metrics(s), solidDropFraction: 1 - s.interfaceTemperature.mean, codexInterfaceHeat: 0.038461964223249254, interfaceRelErrVsCodex: rel(s.instantaneousPowers.interface, 0.038461964223249254), wallMs: Date.now() - t0});
}

function loadDump(n) {
  if (!dumpDir || !existsSync(`${dumpDir}/main-fv${n}.json`)) return null;
  const d = JSON.parse(readFileSync(`${dumpDir}/main-fv${n}.json`, 'utf8'));
  return {mesh: {n, solidColumns: n / 4, columns: n + n / 4}, temperature: d.temperature, u: d.u, v: d.v};
}

for (const n of [16, 32, 64]) {
  if (!cases.has('d' + n)) continue;
  if (n === 32 && !snap16) snap16 = loadDump(16);
  if (n === 64 && !snap32) snap32 = loadDump(32);
  const init = n === 32 && snap16 ? seedFrom(snap16, 32) : n === 64 && snap32 ? seedFrom(snap32, 64) : {};
  const m = createConjugateCavity({n, rayleigh: 1000, prandtl: 0.71, conductivityRatio: 0.5, capacityRatio: 2, ...init});
  const t0 = Date.now();
  const r = n === 16 ? (() => { const rr = m.runToSteady({maxTime: 12}); return {steady: rr.steady, cycles: 0}; })() : seekSteady(m, {maxCycles: 60, thermalSpan: n === 64 ? 0.3 : 0.2, coupledSpan: n === 64 ? 0.02 : 0.05});
  const s = m.snapshot();
  const cx = CODEX_MAIN[n];
  out({case: 'D-main', n, steady: r.steady, cycles: r.cycles, ...metrics(s),
    diffVsCodex: {interfaceHeatRel: rel(s.instantaneousPowers.interface, cx.interfaceHeat), interfaceTempAbs: Math.abs(s.interfaceTemperature.mean - cx.interfaceTempMean), maxSpeedRel: rel(s.maximumFaceSpeed, cx.maxFaceSpeed), solidMeanAbs: Math.abs(s.solidTemperature.mean - cx.solidMeanT), fluidMeanAbs: Math.abs(s.fluidTemperature.mean - cx.fluidMeanT), BiAbs: Math.abs(s.solidBiFromInterfaceAverage - cx.Bi)},
    wallMs: Date.now() - t0});
  if (n === 16) snap16 = s; if (n === 32) snap32 = s;
  if (dumpDir) writeFileSync(`${dumpDir}/main-fv${n}.json`, JSON.stringify({n, temperature: s.temperature, u: s.u, v: s.v}));
}
out({done: true});
