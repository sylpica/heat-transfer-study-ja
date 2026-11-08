import test from 'node:test';
import assert from 'node:assert/strict';
import {createConjugateCavity} from '../dynamic/dev/conjugate-cavity.mjs';

const MAIN = {n: 16, rayleigh: 1000, prandtl: 0.71, conductivityRatio: 0.5, capacityRatio: 2};
const CODEX16 = {interfaceHeat: 0.6964472716362966, interfaceTempMean: 0.6517763913916443, maxFaceSpeed: 2.4952162624111827, solidMeanT: 0.8258881997098216, fluidMeanT: 0.3265799325111529};
const near = (a, b, t, msg) => assert.ok(Math.abs(a - b) <= t, `${msg ?? ''} ${a} != ${b} (tol ${t})`);

function exactConduction(n, K, S) {
  const d = 0.25, s = n / 4, nx = n + s, h = 1 / n;
  const Q = (1 + S * d * d / (2 * K)) / (1 + d / K);
  const T = new Float64Array(nx * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < nx; i++) {
    if (i < s) { const m = (i + 0.5) * h; T[j * nx + i] = 1 + (S * d - Q) * m / K - S * (m * m + h * h / 12) / (2 * K); }
    else { const X = (i - s + 0.5) * h; T[j * nx + i] = Q * (1 - X); }
  }
  return {T, Q};
}
function drive(m, span, thermal) {
  const target = m.time + span;
  while (m.time < target) { const dt = Math.min(m.safeDt, target - m.time); if (!(dt > 0)) break; if (thermal) m.advanceThermal(dt); else m.advance(dt); }
}
function seekSteady(m, maxCycles = 60) {
  let quiet = 0;
  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    drive(m, 0.2, true);
    const before = m.snapshot();
    drive(m, 0.05, false);
    const after = m.snapshot();
    let dT = 0; for (let i = 0; i < after.temperature.length; i++) dT = Math.max(dT, Math.abs(after.temperature[i] - before.temperature[i]));
    const dQ = Math.abs(after.instantaneousPowers.interface - before.instantaneousPowers.interface) / Math.abs(before.instantaneousPowers.interface);
    if (dT * 2 < 0.5e-7 && dQ * 2 < 0.5e-6) quiet++; else quiet = 0;
    if (quiet >= 1) { const cert = m.runToSteady({interval: 0.1, maxTime: m.time + 0.35}); if (cert.steady) return true; }
  }
  return false;
}

test('configuration is strict: unsupported or out-of-scope inputs are refused, never silently accepted', () => {
  assert.throws(() => createConjugateCavity({...MAIN, thicknessRatio: 0.5}), /未対応条件/);
  assert.throws(() => createConjugateCavity({...MAIN, contactResistance: 0.01}), /未対応条件/);
  assert.throws(() => createConjugateCavity({...MAIN, n: 15}), /4の倍数/);
  assert.throws(() => createConjugateCavity({...MAIN, n: 4}), /4の倍数/);
  assert.throws(() => createConjugateCavity({...MAIN, n: 100}), /4の倍数/);
  assert.throws(() => createConjugateCavity({...MAIN, rayleigh: 1000.5}), /Ra≤1000/);
  assert.throws(() => createConjugateCavity({...MAIN, rayleigh: -1}), /Ra≤1000/);
  assert.throws(() => createConjugateCavity({...MAIN, conductivityRatio: 0}), /数値範囲外/);
  assert.throws(() => createConjugateCavity({...MAIN, capacityRatio: -2}), /数値範囲外/);
  assert.throws(() => createConjugateCavity({...MAIN, source: -0.5}), /非負/);
  assert.throws(() => createConjugateCavity({...MAIN, pressurePreconditioner: 'direct'}), /multigridかnone/);
  assert.throws(() => createConjugateCavity({...MAIN, pressureTolerance: 1e-4}), /1e-6未満/);
  assert.throws(() => createConjugateCavity({...MAIN, initialTemperature: [0.5, 0.5]}), /要素数/);
  const u = new Array(16 * 17).fill(0); u[0] = 1; // wall face (row 0, f=0) must be exactly zero
  assert.throws(() => createConjugateCavity({...MAIN, initialVelocity: {u, v: new Array(17 * 16).fill(0)}}), /閉壁/);
  assert.throws(() => createConjugateCavity({n: 16, rayleigh: 0, conductivityRatio: 0.5, capacityRatio: 2, initialVelocity: {u: (() => { const a = new Array(16 * 17).fill(0); a[8 * 17 + 8] = 0.5; return a; })(), v: new Array(17 * 16).fill(0)}}), /Ra=0/);
});

test('Ra=0 keeps velocities exactly zero, wall normals exactly zero, and the scope is declared unapproved', () => {
  const m = createConjugateCavity({n: 16, rayleigh: 0, conductivityRatio: 0.5, capacityRatio: 2});
  let s;
  for (let k = 0; k < 30; k++) s = m.step(m.safeDt);
  assert.ok(s.u.every(x => x === 0) && s.v.every(x => x === 0));
  assert.equal(s.releaseApproved, false);
  assert.equal(s.scope.contactResistance, 0);
  assert.equal(s.scope.validatedRayleighMax, 1000);
  assert.ok(s.energy.relativeMaximumError <= 1e-9);
  assert.equal(s.divergence, 0);
});

test('analytic conduction: the exact cell-mean field is a discrete steady state (residual at roundoff level)', () => {
  for (const K of [0.01, 0.5, 10]) {
    const {T, Q} = exactConduction(16, K, 0);
    const m = createConjugateCavity({n: 16, rayleigh: 0, conductivityRatio: K, capacityRatio: 2, initialTemperature: Array.from(T)});
    const ev = m.evaluate();
    assert.ok(Math.max(...ev.temperatureRate.map(Math.abs)) <= 1e-9, `K=${K} residual`);
    near(ev.instantaneousPowers.interface, Q, 1e-12 * Q, `K=${K} interface heat`);
    for (const t of ev.interfaceTemperaturePerRow) near(t, Q, 1e-12, `K=${K} interface temperature`);
  }
});

test('analytic conduction marched to the steady criterion matches Q=2/3 within the pre-registered 1e-6', () => {
  const m = createConjugateCavity({n: 16, rayleigh: 0, conductivityRatio: 0.5, capacityRatio: 2});
  const r = m.runToSteady({maxTime: 30});
  assert.equal(r.steady, true);
  const s = m.snapshot();
  near(s.instantaneousPowers.interface, 2 / 3, 1e-6 * (2 / 3), 'marched interface heat');
  near(s.interfaceTemperature.mean, 2 / 3, 1e-6, 'marched interface temperature');
  assert.ok(s.energy.relativeMaximumError <= 1e-9);
});

test('solid source S=1: marched steady state matches Q=17/24 and the exact cell-mean field', () => {
  const {T, Q} = exactConduction(16, 0.5, 1);
  near(Q, 17 / 24, 1e-15, 'analytic source Q');
  const m = createConjugateCavity({n: 16, rayleigh: 0, conductivityRatio: 0.5, capacityRatio: 2, source: 1});
  const r = m.runToSteady({maxTime: 40});
  assert.equal(r.steady, true);
  const s = m.snapshot();
  near(s.instantaneousPowers.interface, Q, 1e-5 * Q, 'source interface heat');
  let rms = 0; for (let i = 0; i < T.length; i++) rms += (s.temperature[i] - T[i]) ** 2;
  assert.ok(Math.sqrt(rms / T.length) <= 2e-3, 'source RMS vs exact cell means');
  assert.ok(s.energy.relativeMaximumError <= 1e-9);
});

test('frozen-flow thermal advance coincides with the coupled step when there is no flow (Ra=0)', () => {
  const a = createConjugateCavity({n: 16, rayleigh: 0, conductivityRatio: 0.5, capacityRatio: 2, source: 0.3});
  const b = createConjugateCavity({n: 16, rayleigh: 0, conductivityRatio: 0.5, capacityRatio: 2, source: 0.3});
  for (let k = 0; k < 40; k++) { a.step(a.safeDt); b.stepThermal(b.safeDt); }
  assert.deepEqual(b.snapshot().temperature, a.snapshot().temperature);
  assert.deepEqual(b.snapshot().cumulativeHeats, a.snapshot().cumulativeHeats);
});

test('coupled step is divergence-free, energy-balanced and snapshot/restore replayable; tampering is refused atomically', () => {
  const m = createConjugateCavity(MAIN);
  let s;
  for (let k = 0; k < 60; k++) s = m.step(m.safeDt);
  assert.ok(s.maximumFaceSpeed > 0.1, 'buoyancy flow has developed');
  assert.ok(s.divergence <= 1e-8, `divergence ${s.divergence}`);
  assert.ok(s.energy.relativeMaximumError <= 1e-9, `energy ${s.energy.relativeMaximumError}`);
  assert.ok(s.maximumObservedCellPe <= 2);
  const accepted = m.snapshot();
  const next = m.step(m.safeDt);
  m.restore(accepted);
  assert.deepEqual(m.step(m.safeDt), next);
  m.restore(accepted);
  for (const mutate of [
    x => { x.temperature[10] += 1e-4; },
    x => { x.cumulativeHeats[3] += 1e-6; },
    x => { x.u[0] = 1; },
    x => { x.signature = 'other'; },
    x => { x.time = -1; },
  ]) {
    const bad = structuredClone(accepted); mutate(bad);
    assert.throws(() => m.restore(bad));
    assert.deepEqual(m.snapshot(), accepted);
  }
  assert.throws(() => m.step(2 * m.safeDt), /安定刻み/);
  assert.deepEqual(m.snapshot(), accepted);
});

test('main case at n=16 reaches the coupled steady criterion and matches the support-conjugate record', () => {
  const {T} = exactConduction(16, 0.5, 0);
  const m = createConjugateCavity({...MAIN, initialTemperature: Array.from(T)});
  assert.equal(seekSteady(m), true, 'coupled steady criterion reached');
  const s = m.snapshot();
  near(s.instantaneousPowers.interface, CODEX16.interfaceHeat, 0.005 * CODEX16.interfaceHeat, 'interface heat (criterion 0.5%)');
  near(s.interfaceTemperature.mean, CODEX16.interfaceTempMean, 2e-3, 'interface mean temperature (criterion 2e-3)');
  near(s.maximumFaceSpeed, CODEX16.maxFaceSpeed, 0.01 * CODEX16.maxFaceSpeed, 'maximum face speed (criterion 1%)');
  near(s.solidTemperature.mean, CODEX16.solidMeanT, 1e-3, 'solid mean temperature');
  near(s.fluidTemperature.mean, CODEX16.fluidMeanT, 1e-3, 'fluid mean temperature');
  assert.ok(s.energy.relativeMaximumError <= 1e-9, 'three-balance energy budget');
  assert.ok(s.divergence <= 1e-8);
  assert.ok(s.maximumObservedCellPe <= 2);
});
