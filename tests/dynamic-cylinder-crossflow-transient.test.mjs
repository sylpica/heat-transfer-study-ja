import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createCylinderCrossflowTransient} from '../dynamic/dev/cylinder-crossflow-transient.mjs';

const reference = JSON.parse(readFileSync(new URL('../docs/dynamic/CYLINDER_CROSSFLOW_REFERENCE_20261107.json', import.meta.url), 'utf8'));
const windReference = JSON.parse(readFileSync(new URL('../docs/dynamic/WIND_HEAT_TRANSFER_REFERENCE_20261107.json', import.meta.url), 'utf8'));
const R = reference.reference;
const near = (actual, expected, relTol, label) =>
  assert.ok(Math.abs(actual - expected) <= relTol * Math.abs(expected), `${label}: ${actual} vs ${expected}`);

const gradientConfig = (cells) => ({
  diameter: R.gradientCase.diameter, length: R.gradientCase.length,
  solidConductivity: R.gradientCase.solidConductivity, solidDensity: R.gradientCase.solidDensity,
  solidCp: R.gradientCase.solidCp, heatTransferCoefficient: R.gradientCase.heatTransferCoefficient,
  initialTemperature: R.gradientCase.initialTemperature, fluidTemperature: R.gradientCase.fluidTemperature,
  cells});

test('reference JSON is pinned to its generator', () => {
  const script = readFileSync(new URL('../scripts/dynamic-cylinder-crossflow-reference.py', import.meta.url));
  assert.equal(reference.generatorSHA256, createHash('sha256').update(script).digest('hex'));
  assert.equal(reference.releaseApproved, false);
});

test('h from wind reproduces Example 7.8 (eqn. 7.66)', () => {
  const nu = 1.602e-5, kf = 0.0265, pr = 0.712, D = 0.0001;
  const m = createCylinderCrossflowTransient({
    diameter: D, length: 0.001, solidConductivity: 15, solidDensity: 8000, solidCp: 500,
    initialTemperature: 383.15, fluidTemperature: 293.15,
    flow: {velocity: 457 * nu / D, density: 1, viscosity: nu, cp: pr * kf / nu, conductivity: kf}});
  const s = m.snapshot();
  assert.equal(s.heatTransferSource, 'wind-correlation');
  assert.equal(s.windEstimate.correlation, '7.66');
  near(s.heatTransferCoefficient, windReference.reference.cylinderEx78.h, 1e-12, 'h vs 50-digit Ex 7.8');
  near(s.windEstimate.nusselt, windReference.reference.cylinderEx78.nusselt, 1e-12, 'Nu vs 50-digit Ex 7.8');
  assert.equal(s.releaseApproved, false);
});

test('lumped limit: mean temperature decays with the analytic time constant', () => {
  const l = R.lumpedCase;
  const m = createCylinderCrossflowTransient({
    diameter: l.diameter, length: l.length, solidConductivity: l.solidConductivity,
    solidDensity: l.solidDensity, solidCp: l.solidCp, heatTransferCoefficient: l.heatTransferCoefficient,
    initialTemperature: l.initialTemperature, fluidTemperature: l.fluidTemperature, cells: 16});
  const s0 = m.snapshot();
  near(s0.lumpedTimeConstantSeconds, l.tauSeconds, 1e-12, 'tau');
  assert.ok(s0.biotNumber < 0.01, 'lumped regime Bi << 0.1');
  const ratio = (snap) => (snap.meanTemperature - l.fluidTemperature) / (l.initialTemperature - l.fluidTemperature);
  // measured relative errors: 3.2e-4 at tau, 6.3e-4 at 2 tau (budgets x3)
  near(ratio(m.step(l.tauSeconds)), l.ratioAtTau, 1e-3, 'theta ratio at tau');
  near(ratio(m.step(l.tauSeconds)), l.ratioAtTwoTau, 2e-3, 'theta ratio at 2 tau');
});

test('internal-gradient case collates with the independent Python reference', () => {
  const samples = R.gradientCase.samples;
  const errors = {};
  for (const n of [32, 64, 128]) {
    const m = createCylinderCrossflowTransient(gradientConfig(n));
    let t = 0; errors[n] = {centre: 0, surface: 0, mean: 0};
    for (const s of samples) {
      const snap = m.step(s.time - t); t = s.time;
      errors[n].centre = Math.max(errors[n].centre, Math.abs(snap.temperature[0] - s.centreTemperature));
      errors[n].surface = Math.max(errors[n].surface, Math.abs(snap.surfaceTemperature - s.surfaceTemperature));
      errors[n].mean = Math.max(errors[n].mean, Math.abs(snap.meanTemperature - s.meanTemperature));
    }
  }
  // measured at n=128: centre 4.1e-4 K, surface 7.9e-4 K, mean 8.2e-5 K
  assert.ok(errors[128].centre < 1e-3, `centre error ${errors[128].centre}`);
  assert.ok(errors[128].surface < 2e-3, `surface error ${errors[128].surface}`);
  assert.ok(errors[128].mean < 2e-4, `mean error ${errors[128].mean}`);
  assert.ok(errors[32].centre > errors[64].centre && errors[64].centre > errors[128].centre, 'centre error decreases under refinement');
  assert.ok(errors[32].surface > errors[64].surface && errors[64].surface > errors[128].surface, 'surface error decreases under refinement');
});

test('long run: energy balance is conserved and the field reaches the fluid temperature', () => {
  const m = createCylinderCrossflowTransient(gradientConfig(32));
  const snap = m.step(600);
  assert.ok(snap.relativeEnergyError < 1e-12, `relative energy error ${snap.relativeEnergyError}`);
  assert.ok(Math.abs(snap.meanTemperature - 300) < 0.01, `mean approaches fluid temperature: ${snap.meanTemperature}`);
  assert.ok(Math.abs(snap.surfaceInwardFluxWPerM2) < 0.5, `surface flux vanishes: ${snap.surfaceInwardFluxWPerM2}`);
  // cumulative inward heat equals the internal-energy change by the same measure
  const dE = 8000 * 500 * snap.volumeM3 * (snap.meanTemperature - 400);
  near(snap.cumulativeInwardJoules, dE, 1e-9, 'cumulative surface heat vs internal energy change');
});

test('direct h path and snapshot contents', () => {
  const m = createCylinderCrossflowTransient(gradientConfig(16));
  const s = m.snapshot();
  assert.equal(s.heatTransferSource, 'direct');
  assert.equal(s.windEstimate, null);
  assert.equal(s.heatTransferCoefficient, 500);
  near(s.biotNumber, R.gradientCase.biotNumber, 1e-15, 'Bi');
  near(s.surfaceAreaM2, Math.PI * 0.02 * 0.1, 1e-15, 'lateral area');
  near(s.meanTemperature, 400, 1e-12, 'initial mean temperature');
  assert.ok(s.surfaceTemperature < 400 && s.surfaceTemperature > 300, 'surface temperature is reconstructed through the half-cell resistance');
  const s2 = m.step(1);
  assert.ok(s2.meanTemperature < 400 && s2.meanTemperature > 300, 'cooling proceeds');
  assert.ok(s2.surfaceInwardWatts < 0, 'inward watts negative while cooling');
});

test('restore round-trips the exact state', () => {
  const m = createCylinderCrossflowTransient(gradientConfig(16));
  m.step(0.5);
  const s1 = m.snapshot();
  m.step(0.5);
  const back = m.restore(s1);
  assert.deepEqual(back.temperature, s1.temperature);
  assert.equal(back.time, s1.time);
  assert.equal(back.cumulativeInwardJoules, s1.cumulativeInwardJoules);
  assert.throws(() => m.restore({modelType: 'nope'}), /不正/);
});

test('out-of-range and malformed conditions are refused with reasons', () => {
  const base = gradientConfig(16);
  // wind correlation range: Re_D > 1e7 (wind module refusal propagates)
  assert.throws(() => createCylinderCrossflowTransient({
    diameter: 0.1, length: 0.1, solidConductivity: 15, solidDensity: 8000, solidCp: 500,
    initialTemperature: 350, fluidTemperature: 300,
    flow: {velocity: 2000, density: 1, viscosity: 1.6e-5, cp: 1000, conductivity: 0.026}}), /10\^7|10⁷/);
  // Bi above the model limit (direct h)
  assert.throws(() => createCylinderCrossflowTransient({...base, heatTransferCoefficient: 20000}), /開発範囲上限/);
  // both h sources / neither
  assert.throws(() => createCylinderCrossflowTransient({...base, flow: {velocity: 1, density: 1, viscosity: 1e-3, cp: 4000, conductivity: 0.6}}), /どちらか一方/);
  const {heatTransferCoefficient, ...noH} = base;
  assert.throws(() => createCylinderCrossflowTransient(noH), /どちらか一方/);
  // non-positive direct h, unknown keys, bad cells, bad geometry
  assert.throws(() => createCylinderCrossflowTransient({...base, heatTransferCoefficient: 0}), /正の値/);
  assert.throws(() => createCylinderCrossflowTransient({...base, roughness: 1e-5}), /無視しません/);
  assert.throws(() => createCylinderCrossflowTransient({...base, cells: 3}), /4〜512/);
  assert.throws(() => createCylinderCrossflowTransient({...base, cells: 4.5}), /4〜512/);
  assert.throws(() => createCylinderCrossflowTransient({...base, diameter: -0.02}), /正の値/);
  // flow with a missing property or an unknown key
  assert.throws(() => createCylinderCrossflowTransient({...noH, flow: {velocity: 1, density: 1, viscosity: 1e-3, conductivity: 0.6}}), /flow\.cp/);
  assert.throws(() => createCylinderCrossflowTransient({...noH, flow: {velocity: 1, density: 1, viscosity: 1e-3, cp: 4000, conductivity: 0.6, roughness: 0}}), /無視しません/);
  // non-positive step
  const m = createCylinderCrossflowTransient(base);
  assert.throws(() => m.step(0), /正の値/);
  assert.throws(() => m.step(-1), /正の値/);
});

test('module stays out of the public build allowlist', () => {
  const build = readFileSync(new URL('../scripts/build-public-site.mjs', import.meta.url), 'utf8');
  assert.ok(!build.includes('cylinder-crossflow-transient'), 'not in the public allowlist');
  assert.ok(!build.includes('wind-heat-transfer'), 'wind module not in the public allowlist');
});
