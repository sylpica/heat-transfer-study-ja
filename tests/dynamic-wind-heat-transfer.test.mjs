import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {calculateCylinderCrossflow, churchillBernsteinNu} from '../cylinder-crossflow.mjs';
import {createHeatSink} from '../dynamic/dev/heat-sink.mjs';
import {
  cylinderCrossflowNu,
  estimateWindHeatTransfer,
  flatPlateLaminarNu,
  flatPlateLiquidMetalNu,
  flatPlateMixedNu,
  heatSinkHFromWind,
} from '../dynamic/dev/wind-heat-transfer.mjs';

const reference = JSON.parse(readFileSync(new URL('../docs/dynamic/WIND_HEAT_TRANSFER_REFERENCE_20261107.json', import.meta.url), 'utf8'));
const R = reference.reference;
const near = (actual, expected, relTol, label) =>
  assert.ok(Math.abs(actual - expected) <= relTol * Math.abs(expected), `${label}: ${actual} vs ${expected}`);

// Build module inputs that reproduce a textbook case stored in the reference
// JSON by its kinematic viscosity, conductivity and Prandtl number.
function caseInput({kinematicViscosity: nu, conductivity: k, prandtl, velocity, length, surfaceTemperature = 383.15, freeStreamTemperature = 293.15}) {
  const density = 1, viscosity = density * nu, cp = prandtl * k / viscosity;
  return {velocity, density, viscosity, cp, conductivity: k, characteristicLength: length, surfaceTemperature, freeStreamTemperature};
}

test('reference JSON is pinned to the 50-digit generator', () => {
  const script = readFileSync(new URL('../scripts/dynamic-wind-heat-transfer-reference.py', import.meta.url));
  assert.equal(reference.generatorSHA256, createHash('sha256').update(script).digest('hex'));
  assert.equal(reference.precisionDigits, 50);
  assert.equal(reference.releaseApproved, false);
});

test('Example 6.5: laminar flat plate average, eqn. (6.68)', () => {
  const r = R.flatPlateLaminarEx65;
  const est = estimateWindHeatTransfer({geometry: 'flat-plate', ...caseInput(r)});
  assert.equal(est.correlation, '6.68');
  assert.equal(est.representativeGeometry, 'flat-plate');
  near(est.reynolds, r.reynolds, 1e-12, 'Re');
  near(est.nusselt, r.nusselt, 1e-12, 'Nu vs 50-digit reference');
  near(est.h, r.h, 1e-12, 'h vs 50-digit reference');
  near(est.nusselt, r.book.nusselt, 1e-3, 'Nu vs printed book value');
  near(est.h, r.book.h, 2e-3, 'h vs printed book value');
  near(est.filmTemperatureK, 338.15, 1e-12, 'film temperature 65 C');
  assert.equal(est.releaseApproved, false);
});

test('Example 6.9: three-region average for gases, eqns. (6.115)/(6.120)', () => {
  const r = R.flatPlateMixedObservedEx69;
  const est = estimateWindHeatTransfer({
    geometry: 'flat-plate', regime: 'mixed-observed', fluidKind: 'gas',
    transitionStartReynolds: r.transitionStart, transitionEndReynolds: r.transitionEnd,
    ...caseInput(r),
  });
  assert.equal(est.correlation, '6.120');
  near(est.transitionSlope, r.c, 1e-12, 'c vs 50-digit reference');
  near(est.nusselt, r.nusselt, 1e-12, 'Nu vs 50-digit reference');
  near(est.h, r.h, 1e-12, 'h vs 50-digit reference');
  near(est.nusselt, r.book.nusselt, 1e-3, 'Nu vs printed book value');
  near(est.h, r.book.h, 1e-3, 'h vs printed book value');
});

test('Example 6.11: abrupt-transition reduction of eqn. (6.120)', () => {
  for (const key of ['flatPlateAbruptEx611a', 'flatPlateAbruptEx611b']) {
    const r = R[key];
    const {nusselt, correlation} = flatPlateMixedNu(r.reynolds, r.prandtl, 'gas', {type: 'abrupt', reynolds: r.transitionReynolds});
    assert.equal(correlation, '6.120-abrupt');
    near(nusselt, r.nusselt, 1e-12, `${key} Nu vs 50-digit reference`);
    near(nusselt, r.book.nusselt, 1e-3, `${key} Nu vs printed book value`);
  }
});

test('liquid abrupt form developed from eqn. (6.113)', () => {
  const r = R.flatPlateLiquidAbrupt;
  const {nusselt, correlation} = flatPlateMixedNu(r.reynolds, r.prandtl, 'liquid', {type: 'abrupt', reynolds: r.transitionReynolds});
  assert.equal(correlation, '6.120-abrupt-liquid');
  near(nusselt, r.nusselt, 1e-12, 'Nu vs 50-digit reference');
});

test('liquid metal average, eqn. (6.69), and its Pe gate', () => {
  const r = R.flatPlateLiquidMetal;
  near(flatPlateLiquidMetalNu(r.peclet), r.nusselt, 1e-12, 'Nu vs 50-digit reference');
  assert.throws(() => flatPlateLiquidMetalNu(100), /Pe>100/);
  const est = estimateWindHeatTransfer({
    geometry: 'flat-plate', regime: 'liquid-metal',
    velocity: 2, density: 1000, viscosity: 0.002, cp: 500, conductivity: 10,
    characteristicLength: 0.1, surfaceTemperature: 600, freeStreamTemperature: 580,
  });
  assert.equal(est.correlation, '6.69');
  near(est.nusselt, 1.13 * Math.sqrt(est.peclet), 1e-15, 'estimate uses eqn. (6.69)');
});

test('Example 7.8 evaluated forward: cylinder component eqn. (7.66)', () => {
  const r = R.cylinderEx78;
  const {nusselt, correlation} = cylinderCrossflowNu(r.reynolds, r.prandtl);
  assert.equal(correlation, '7.66');
  near(nusselt, r.nusselt, 1e-12, 'Nu vs 50-digit reference');
  near(nusselt, r.book.nusselt, 1e-3, 'Nu vs printed book value');
  const est = estimateWindHeatTransfer({
    geometry: 'cylinder',
    ...caseInput({kinematicViscosity: 1.602e-5, conductivity: 0.0265, prandtl: 0.712, velocity: 457 * 1.602e-5 / 0.0001, length: 0.0001}),
  });
  assert.equal(est.correlation, '7.66');
  near(est.h, r.h, 1e-12, 'h vs 50-digit reference');
  near(est.h, r.book.h, 1e-3, 'h vs printed book value');
});

test('Nakai-Okazaki eqn. (7.67) covers Pe <= 0.2', () => {
  const r = R.cylinderNakaiOkazaki;
  const {nusselt, correlation} = cylinderCrossflowNu(10, 0.01);
  assert.equal(correlation, '7.67');
  near(nusselt, r.nusselt, 1e-12, 'Nu vs 50-digit reference');
  assert.equal(cylinderCrossflowNu(200, 0.001).correlation, '7.67', 'Pe exactly 0.2 stays on (7.67)');
});

test('component eqn. (7.68) in 40000 < Re < 400000, above the (7.65) value', () => {
  const r = R.cylinderComponent768;
  const {nusselt, correlation} = cylinderCrossflowNu(r.reynolds, r.prandtl);
  assert.equal(correlation, '7.68');
  near(nusselt, r.nusselt768, 1e-12, 'Nu vs 50-digit (7.68)');
  near(churchillBernsteinNu(r.reynolds, r.prandtl), r.nusselt765, 1e-12, 'static model vs 50-digit (7.65)');
  assert.ok(nusselt > churchillBernsteinNu(r.reynolds, r.prandtl), 'book: (7.65) underpredicts in this band');
});

test('cylinder selection boundaries follow the printed ranges', () => {
  assert.equal(cylinderCrossflowNu(3999, 0.7).correlation, '7.66');
  assert.equal(cylinderCrossflowNu(4000, 0.7).correlation, '7.65');
  assert.equal(cylinderCrossflowNu(40001, 0.7).correlation, '7.68');
  assert.equal(cylinderCrossflowNu(399999, 0.7).correlation, '7.68');
  assert.equal(cylinderCrossflowNu(400000, 0.7).correlation, '7.65');
});

test('identical values with the existing static cylinder model on (7.65)', () => {
  for (const [re, pr] of [[5000, 0.7], [20000, 7], [40000, 0.7], [400000, 0.7], [500000, 0.7], [2e6, 100]]) {
    assert.equal(cylinderCrossflowNu(re, pr).nusselt, churchillBernsteinNu(re, pr), `Re=${re}, Pr=${pr}`);
  }
  const shared = calculateCylinderCrossflow({
    density: 1.184, velocity: 3, viscosity: 1.849e-5, cp: 1007, conductivity: 0.0263,
    diameter: 0.05, length: 1, surface: 80, ambient: 25,
  });
  assert.ok(!shared.error);
  const est = estimateWindHeatTransfer({
    geometry: 'cylinder', velocity: 3, density: 1.184, viscosity: 1.849e-5, cp: 1007,
    conductivity: 0.0263, characteristicLength: 0.05, surfaceTemperature: 353.15, freeStreamTemperature: 298.15,
  });
  assert.equal(est.correlation, '7.65');
  near(est.h, shared.h, 1e-15, 'h identical to static model');
  near(est.nusselt, shared.nusselt, 1e-15, 'Nu identical to static model');
});

test('out-of-range inputs are rejected, never extrapolated', () => {
  const plate = {geometry: 'flat-plate', velocity: 15, density: 1, viscosity: 1.95e-5, cp: 1052.7, conductivity: 0.0292, characteristicLength: 0.5, surfaceTemperature: 383.15, freeStreamTemperature: 293.15};
  assert.throws(() => estimateWindHeatTransfer({...plate, bogus: 1}), /未対応の物理条件/);
  assert.throws(() => estimateWindHeatTransfer({...plate, velocity: 0}), /数値範囲外/);
  assert.throws(() => estimateWindHeatTransfer({...plate, cp: NaN}), /数値範囲外/);
  assert.throws(() => estimateWindHeatTransfer({...plate, geometry: 'sphere'}), /形状は/);
  // Pr below the printed range of eqn. (6.68)
  assert.throws(() => flatPlateLaminarNu(1e5, 0.5), /Pr≧0\.6/);
  // plate no longer wholly laminar, no regime declared
  assert.throws(() => estimateWindHeatTransfer({...plate, velocity: 30, characteristicLength: 2}), /外挿しません/);
  assert.throws(() => estimateWindHeatTransfer({...plate, velocity: 30, characteristicLength: 2, regime: 'laminar'}), /全体が層流/);
  // boundary layer approximation fails at low Pe
  assert.throws(() => estimateWindHeatTransfer({...plate, velocity: 0.001, characteristicLength: 0.01}), /境界層近似/);
  // abrupt transition needs its Reynolds number and a fluid kind
  assert.throws(() => estimateWindHeatTransfer({...plate, regime: 'mixed-abrupt', fluidKind: 'gas'}), /数値範囲外/);
  assert.throws(() => estimateWindHeatTransfer({...plate, regime: 'mixed-abrupt', transitionReynolds: 1e5}), /流体種別/);
  assert.throws(() => flatPlateMixedNu(1e6, 0.708, 'gas', {type: 'abrupt', reynolds: 1e6}), /未満/);
  // observed transition: gases only, eqn. (6.115) caps the start at 500,000
  assert.throws(() => flatPlateMixedNu(2e6, 7, 'liquid', {type: 'observed', start: 4e5, end: 8.7e5}), /気体について/);
  assert.throws(() => flatPlateMixedNu(2e6, 0.708, 'gas', {type: 'observed', start: 6e5, end: 9e5}), /500,000以下/);
  assert.throws(() => flatPlateMixedNu(2e6, 0.708, 'gas', {type: 'observed', start: 4e5, end: 4e5}), /より大きく/);
  assert.throws(() => flatPlateMixedNu(1.5e6, 0.708, 'gas', {type: 'observed', start: 4e5, end: 1.6e6}), /以下で指定/);
  // cylinder: conservative Re ceiling, and regime keys are not accepted
  assert.throws(() => cylinderCrossflowNu(2e7, 0.7), /10⁷/);
  assert.throws(() => estimateWindHeatTransfer({geometry: 'cylinder', velocity: 3, density: 1.184, viscosity: 1.849e-5, cp: 1007, conductivity: 0.0263, characteristicLength: 0.05, surfaceTemperature: 353.15, freeStreamTemperature: 298.15, regime: 'laminar'}), /使用しません/);
});

test('fin surfaces map to representative shapes and keep the same h', () => {
  const plateInput = {velocity: 15, density: 1, viscosity: 1.95e-5, cp: 1052.7, conductivity: 0.0292, characteristicLength: 0.5, surfaceTemperature: 383.15, freeStreamTemperature: 293.15};
  const flat = estimateWindHeatTransfer({geometry: 'flat-plate', ...plateInput});
  const finPlate = estimateWindHeatTransfer({geometry: 'fin-plate', ...plateInput});
  assert.equal(finPlate.representativeGeometry, 'flat-plate');
  assert.equal(finPlate.h, flat.h);
  assert.ok(finPlate.warnings.some(w => w.includes('フィン間干渉')));
  const cylInput = {velocity: 3, density: 1.184, viscosity: 1.849e-5, cp: 1007, conductivity: 0.0263, characteristicLength: 0.05, surfaceTemperature: 353.15, freeStreamTemperature: 298.15};
  const pin = estimateWindHeatTransfer({geometry: 'fin-pin', ...cylInput});
  assert.equal(pin.representativeGeometry, 'cylinder');
  assert.equal(pin.h, estimateWindHeatTransfer({geometry: 'cylinder', ...cylInput}).h);
});

test('h is not proportional to velocity (laminar plate follows sqrt)', () => {
  const base = {geometry: 'flat-plate', density: 1, viscosity: 1.95e-5, cp: 1052.7, conductivity: 0.0292, characteristicLength: 0.5, surfaceTemperature: 383.15, freeStreamTemperature: 293.15};
  const h1 = estimateWindHeatTransfer({...base, velocity: 3}).h;
  const h4 = estimateWindHeatTransfer({...base, velocity: 12}).h;
  near(h4 / h1, 2, 1e-12, 'quadrupling velocity doubles h in laminar flow');
});

test('adapter feeds the estimated h into the existing heat-sink model', () => {
  const r = R.flatPlateLaminarEx65;
  const {h, estimate} = heatSinkHFromWind({geometry: 'fin-plate', ...caseInput(r)});
  near(h, r.h, 1e-12, 'adapter h');
  assert.equal(estimate.correlation, '6.68');
  const sink = createHeatSink({
    baseWidth: 0.1, baseDepth: 0.05, baseThickness: 0.005,
    finLength: 0.03, finThickness: 0.002, finCount: 5, finCells: 8,
    k: 200, rho: 2700, cp: 900, h, ambient: 293.15,
    initialBase: 293.15, initialFin: 293.15, power: 10,
  });
  const snap = sink.snapshot();
  assert.equal(snap.assumptions.prescribedUniformH, true);
  assert.equal(sink.config.h, h);
  const after = sink.step(sink.safeDt / 2);
  assert.ok(after.baseTemperature > 293.15, 'heat sink warms under power with the estimated h');
});
