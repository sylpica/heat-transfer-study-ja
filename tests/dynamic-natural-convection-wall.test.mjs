import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  naturalConvectionVerticalWall,
  uniformHeatFluxVerticalWall,
  solveVerticalPlateSimilarity,
  churchillChuLaminarNu,
  squireEckertAverageNu,
} from '../dynamic/dev/natural-convection-wall.mjs';

const reference = JSON.parse(readFileSync(
  new URL('../docs/dynamic/NATURAL_CONVECTION_WALL_REFERENCE_20261107.json',
    import.meta.url)));
const ref = reference.reference;
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

test('reference JSON is the pinned 50-digit generator output', () => {
  assert.equal(createHash('sha256').update(readFileSync(
    new URL('../scripts/dynamic-natural-convection-wall-reference.py',
      import.meta.url))).digest('hex'), reference.generatorSHA256);
  assert.equal(reference.precisionDigits, 50);
  assert.equal(reference.releaseApproved, false);
  // The two independent Python methods (mpmath shooting at 50 digits
  // and scipy solve_bvp collocation) agree to near machine precision.
  for (const [pr, c] of Object.entries(ref.crossMethodCheck)) {
    assert.ok(c.relDiffThetaPrime0 < 1e-9, `Pr=${pr} theta'(0) cross-check`);
    assert.ok(c.relDiffFDoublePrime0 < 1e-9, `Pr=${pr} f''(0) cross-check`);
    // The scipy f'max is read off a 20001-point evaluation grid
    // (argmax), so its agreement is bounded by that extraction
    // resolution (~6e-7 measured), not by the solution accuracy.
    assert.ok(c.relDiffFPrimeMax < 1e-6, `Pr=${pr} f'max cross-check`);
  }
  // Domain-size sensitivity of theta'(0) (1.5x etaMax) is negligible.
  for (const [pr, e] of Object.entries(ref.similarity)) {
    if (e.etaMaxSensitivityThetaPrime0 !== undefined
      && e.etaMaxSensitivityThetaPrime0 !== null) {
      assert.ok(e.etaMaxSensitivityThetaPrime0 < 1e-6, `Pr=${pr} etaMax`);
    }
    // Similarity average Nu vs the textbook correlations: within
    // 0.5% of Churchill-Chu (8.13a) asymptotically, and within the
    // documented approximation band of Squire-Eckert (8.27).
    assert.ok(e.ratioSimilarityToChurchillChu > 0.995
      && e.ratioSimilarityToChurchillChu < 1.005, `Pr=${pr} vs (8.13a)`);
    assert.ok(e.ratioSimilarityToSquireEckert > 0.91
      && e.ratioSimilarityToSquireEckert < 1.04, `Pr=${pr} vs (8.27)`);
    assert.ok(e.tailFPrimeAbs < 1e-6 && e.tailThetaAbs < 1e-6);
  }
});

test('JS collocation similarity solver reproduces the 50-digit values', () => {
  for (const [prKey, e] of Object.entries(ref.similarity)) {
    const pr = Number(prKey);
    const s = solveVerticalPlateSimilarity(pr);
    assert.ok(rel(s.wallTemperatureGradient, e.wallTemperatureGradient) < 2e-6,
      `Pr=${pr} -theta'(0): ${s.wallTemperatureGradient} vs ${e.wallTemperatureGradient}`);
    assert.ok(rel(s.fDoublePrimeAtWall, e.fDoublePrime0) < 5e-6,
      `Pr=${pr} f''(0)`);
    assert.ok(rel(s.fPrimeMax, e.fPrimeMax) < 5e-6, `Pr=${pr} f'max`);
    assert.ok(rel(s.fInfinity, e.fInfinity) < 1e-5, `Pr=${pr} f(inf)`);
    assert.ok(Math.abs(s.etaAtFPrimeMax - e.etaAtFPrimeMax) < 0.02,
      `Pr=${pr} eta at f'max`);
    assert.ok(Math.abs(s.endFPrime) < 1e-6 && Math.abs(s.endTheta) < 1e-6,
      `Pr=${pr} terminal residuals`);
  }
});

test('similarity profiles at Pr=0.71 match the 50-digit samples', () => {
  const s = solveVerticalPlateSimilarity(0.71);
  const {eta, f, fPrime, theta} = s.profile;
  const interp = (arr, x) => {
    let i = 0;
    while (i < eta.length - 2 && eta[i + 1] < x) i++;
    const t = (x - eta[i]) / (eta[i + 1] - eta[i]);
    return arr[i] * (1 - t) + arr[i + 1] * t;
  };
  for (const sample of ref.profileSamplesPr071) {
    assert.ok(Math.abs(interp(f, sample.eta) - sample.f) < 1e-3,
      `f(${sample.eta})`);
    assert.ok(Math.abs(interp(fPrime, sample.eta) - sample.fPrime) < 1e-3,
      `f'(${sample.eta})`);
    assert.ok(Math.abs(interp(theta, sample.eta) - sample.theta) < 1e-3,
      `theta(${sample.eta})`);
  }
});

test('trapezoidal collocation converges at observed order 2', () => {
  const rich = solveVerticalPlateSimilarity(1, {steps: 3200});
  const limit = rich.thetaPrimeAtWall;
  const errors = [400, 800, 1600].map((steps) => Math.abs(
    solveVerticalPlateSimilarity(1, {steps}).gridValues.fine.thetaPrimeAtWall
    - limit));
  const orders = errors.slice(1).map((e, i) => Math.log2(errors[i] / e));
  for (const order of orders) {
    assert.ok(order > 1.8 && order < 2.2, `observed order ${order}`);
  }
});

test('Example 8.1: similarity and Churchill-Chu against the book', () => {
  const r = naturalConvectionVerticalWall({
    wallTemperatureK: 323.15, ambientTemperatureK: 293.15, lengthM: 0.30,
    betaPerK: 0.00325, kinematicViscosityM2PerS: 1.643e-5,
    thermalDiffusivityM2PerS: 2.315e-5, thermalConductivityWPerMK: 0.02672,
    gravityMPerS2: 9.8,
  });
  const e = ref.example81;
  assert.ok(rel(r.rayleigh, e.rayleigh) < 1e-12);
  assert.ok(rel(r.rayleigh, e.book.rayleigh) < 1e-3, 'book Ra=6.78e7');
  assert.ok(rel(r.averageNusselt, e.similarityAverageNusselt) < 2e-6);
  assert.ok(rel(r.averageH, e.similarityAverageH) < 2e-6);
  // The (8.13a) formula at the book's inputs reproduces the printed
  // Nu_L = 47.33 (the book's h = 4.22 follows from it).
  assert.ok(rel(r.churchillChu.averageNusselt, e.book.averageNusselt) < 1e-3);
  assert.ok(rel(r.churchillChu.averageNusselt,
    e.churchillChuAverageNusselt) < 1e-12);
  assert.equal(r.law, 'natural-convection-vertical-wall-v1');
  assert.equal(r.releaseApproved, false);
  assert.equal(r.inRange, true);
});

test('Example 8.3: Squire-Eckert print values and Problem 8.29 velocity', () => {
  const r = naturalConvectionVerticalWall({
    wallTemperatureK: 313.15, ambientTemperatureK: 287.15, lengthM: 0.40,
    betaPerK: 0.00333, kinematicViscosityM2PerS: 1.578e-5,
    thermalDiffusivityM2PerS: 2.213e-5, thermalConductivityWPerMK: 0.02623,
    gravityMPerS2: 9.8,
  });
  const e = ref.example83;
  assert.ok(rel(r.rayleigh, e.book.rayleigh) < 1e-3, 'book Ra=1.555e8');
  assert.ok(rel(r.averageNusselt, e.similarityAverageNusselt) < 2e-6);
  assert.ok(rel(r.maxVelocityAtTopMPerS, e.maxVelocityAtTop) < 5e-6);
  // The book's Example 8.3 uses (8.27): printed Nu_L = 61.25.
  assert.ok(rel(r.squireEckert.averageNusselt, e.book.averageNusselt) < 1e-3);
  assert.ok(rel(r.squireEckert.averageNusselt,
    e.squireEckertAverageNusselt) < 1e-12);
  // Problem 8.29 prints u_max = 0.35 m/s.  That answer follows the
  // Squire-Eckert route (0.34532 by (8.19)/(8.23)/(8.24)); the exact
  // similarity solution gives 0.32274, about 7% lower, consistent
  // with the book's caution that the S-E velocity profile is the
  // cruder approximation.
  assert.ok(rel(e.squireEckertMaxVelocityAtTop, e.book.maxVelocityAtTop) < 0.02);
  assert.ok(r.maxVelocityAtTopMPerS < e.squireEckertMaxVelocityAtTop);
  assert.ok(rel(e.squireEckertDeltaOverL, e.book.deltaOverL) < 0.02);
});

test('cold wall reverses the flow and keeps h', () => {
  const base = {
    lengthM: 0.30, betaPerK: 0.00325, kinematicViscosityM2PerS: 1.643e-5,
    thermalDiffusivityM2PerS: 2.315e-5, thermalConductivityWPerMK: 0.02672,
    gravityMPerS2: 9.8,
  };
  const hot = naturalConvectionVerticalWall(
    {...base, wallTemperatureK: 323.15, ambientTemperatureK: 293.15});
  const cold = naturalConvectionVerticalWall(
    {...base, wallTemperatureK: 293.15, ambientTemperatureK: 323.15});
  assert.equal(cold.flowDirection, -1);
  assert.ok(rel(cold.averageH, hot.averageH) < 1e-12);
  assert.ok(cold.maxVelocityAtTopMPerS < 0);
  assert.ok(rel(cold.maxVelocityAtTopMPerS, -hot.maxVelocityAtTopMPerS) < 1e-12);
  assert.ok(cold.averageHeatFluxWPerM2 < 0 && hot.averageHeatFluxWPerM2 > 0);
});

test('out-of-range conditions are rejected, never extrapolated', () => {
  const base = {
    wallTemperatureK: 350, ambientTemperatureK: 300, lengthM: 0.3,
    betaPerK: 0.0033, kinematicViscosityM2PerS: 1.6e-5,
    thermalDiffusivityM2PerS: 2.25e-5, thermalConductivityWPerMK: 0.026,
  };
  assert.throws(() => naturalConvectionVerticalWall(
    {...base, lengthM: 30}), /乱流域/);
  assert.throws(() => naturalConvectionVerticalWall(
    {...base, wallTemperatureK: 300.001, lengthM: 0.001}), /境界層が板の高さに対して厚く/);
  assert.throws(() => naturalConvectionVerticalWall(
    {...base, wallTemperatureK: 300}), /温度差が0/);
  assert.throws(() => naturalConvectionVerticalWall(
    {...base, thermalDiffusivityM2PerS: 3.2e-4}), /検証済み範囲/);
  assert.throws(() => naturalConvectionVerticalWall(
    {...base, thermalDiffusivityM2PerS: 8e-8}), /検証済み範囲/);
  assert.throws(() => naturalConvectionVerticalWall(
    {...base, bogusKey: 1}), /未対応の物理条件/);
  assert.throws(() => naturalConvectionVerticalWall(
    {...base, betaPerK: NaN}), /数値範囲外/);
  assert.throws(() => solveVerticalPlateSimilarity(0.05), /検証済み範囲/);
  assert.throws(() => solveVerticalPlateSimilarity(101), /検証済み範囲/);
  assert.throws(() => solveVerticalPlateSimilarity(0.71, {etaMax: 20}),
    /ηmaxが小さすぎて/);
});

test('uniform heat flux: Raithby-Hollands case matches the reference', () => {
  const r = uniformHeatFluxVerticalWall({
    heatFluxWPerM2: 100, ambientTemperatureK: 300.15, lengthM: 0.40,
    betaPerK: 0.00333, kinematicViscosityM2PerS: 1.578e-5,
    thermalDiffusivityM2PerS: 2.213e-5, thermalConductivityWPerMK: 0.02623,
    gravityMPerS2: 9.8,
  });
  const e = ref.uniformHeatFluxCase;
  assert.ok(rel(r.modifiedRayleigh, e.modifiedRayleigh) < 1e-12);
  assert.ok(rel(r.averageNusselt, e.averageNusselt) < 1e-12);
  assert.ok(rel(r.meanDeltaTK, e.meanDeltaT) < 1e-12);
  assert.ok(rel(r.topDeltaTK, e.topDeltaT) < 1e-12);
  assert.ok(rel(r.midDeltaTK, e.midDeltaT) < 1e-12);
  assert.ok(rel(r.localNusseltAtTop, e.localNusseltAtTopFromProfile) < 1e-12);
  assert.ok(rel(r.churchillChu.averageNusselt,
    e.churchillChu843bAverageNusseltMeanBasis) < 1e-12);
  assert.ok(rel(r.equivalentRayleigh, e.equivalentRayleigh) < 1e-12);
  assert.equal(r.releaseApproved, false);
  // (8.44b) vs the independent (8.43b) agree within about 2% across Pr.
  for (const s of Object.values(ref.uniformHeatFluxCorrelationSweep)) {
    assert.ok(s.ratio > 0.98 && s.ratio < 1.03);
  }
  // The printed local correlation (8.44a) is inconsistent with
  // (8.44b) + (8.40)-(8.41) by exactly its own coefficient 0.630;
  // the generator measures and records this instead of resolving it.
  assert.ok(Math.abs(e.ratioPrinted844aToProfile - 0.630) < 1e-9);
});

test('uniform heat flux rejections', () => {
  const base = {
    ambientTemperatureK: 300.15, lengthM: 0.40, betaPerK: 0.00333,
    kinematicViscosityM2PerS: 1.578e-5, thermalDiffusivityM2PerS: 2.213e-5,
    thermalConductivityWPerMK: 0.02623, gravityMPerS2: 9.8,
  };
  assert.throws(() => uniformHeatFluxVerticalWall(
    {...base, heatFluxWPerM2: 1e-5}), /適用条件はNu≳5/);
  assert.throws(() => uniformHeatFluxVerticalWall(
    {...base, heatFluxWPerM2: 100000, lengthM: 4.0}), /乱流域/);
  assert.throws(() => uniformHeatFluxVerticalWall(
    {...base, heatFluxWPerM2: 0}), /数値範囲外/);
  assert.throws(() => uniformHeatFluxVerticalWall(
    {...base, heatFluxWPerM2: 100, extra: 1}), /未対応の物理条件/);
});

test('correlation helpers reproduce the textbook example values', () => {
  // Example 8.1 inputs: (8.13a) at the exact inputs.
  assert.ok(Math.abs(churchillChuLaminarNu(ref.example81.rayleigh,
    ref.example81.prandtlFromProperties)
    - ref.example81.churchillChuAverageNusselt) < 1e-9);
  // Example 8.3 inputs: (8.27) at the exact inputs.
  assert.ok(Math.abs(squireEckertAverageNu(ref.example83.rayleigh,
    ref.example83.prandtlFromProperties)
    - ref.example83.squireEckertAverageNusselt) < 1e-9);
});
