import assert from 'node:assert/strict';
import test from 'node:test';
import {createHeatSink} from '../dynamic/dev/heat-sink.mjs';
import {estimateWindHeatTransfer} from '../dynamic/dev/wind-heat-transfer.mjs';
import {windHandoffFromSearch, windHeatSinkHandoffHref} from '../dynamic/dev/wind-heatsink-handoff.mjs';

// Example 6.5 properties, built exactly as in the wind module's own tests
// (density 1, viscosity = kinematic viscosity, cp = Pr * k / nu).
const ex65Input = {
  geometry: 'flat-plate', velocity: 15, density: 1, viscosity: 1.95e-5,
  cp: 0.703 * 0.0292 / 1.95e-5, conductivity: 0.0292, characteristicLength: 0.5,
  surfaceTemperature: 383.15, freeStreamTemperature: 293.15,
};
// Example 7.8 properties (cylinder in cross flow).
const ex78Input = {
  geometry: 'cylinder', velocity: 457 * 1.602e-5 / 0.0001, density: 1, viscosity: 1.602e-5,
  cp: 0.712 * 0.0265 / 1.602e-5, conductivity: 0.0265, characteristicLength: 0.0001,
  surfaceTemperature: 383.15, freeStreamTemperature: 293.15,
};
// The heat-sink screen's default conditions (heat-sink.html initial values).
const SCREEN_DEFAULT = {
  baseWidth: .08, baseDepth: .06, baseThickness: .005, finLength: .04, finThickness: .002,
  finCount: 6, finCells: 32, k: 200, rho: 2700, cp: 900, h: 15,
  ambient: 293.15, initialBase: 293.15, initialFin: 293.15, power: 5, contactResistance: 0,
};
const advanceTo = (config, target) => {
  const m = createHeatSink(config);
  while (m.time < target) m.step(Math.min(m.safeDt, target - m.time), false);
  return m.snapshot();
};
const searchOf = href => href.slice(href.indexOf('?'));

test('handoff href round-trips the full estimation record (flat plate, eq. 6.68)', () => {
  const estimate = estimateWindHeatTransfer(ex65Input);
  const href = windHeatSinkHandoffHref(estimate, ex65Input);
  assert.ok(href.startsWith('./heat-sink.html?'));
  const record = windHandoffFromSearch(searchOf(href));
  assert.equal(record.h, estimate.h);
  assert.equal(record.correlation, '6.68');
  assert.equal(record.geometry, 'flat-plate');
  assert.equal(record.velocity, ex65Input.velocity);
  assert.equal(record.characteristicLength, ex65Input.characteristicLength);
  assert.equal(record.reynolds, estimate.reynolds);
  assert.equal(record.prandtl, estimate.prandtl);
  assert.equal(record.nusselt, estimate.nusselt);
  assert.equal(record.filmTemperatureK, estimate.filmTemperatureK);
  assert.equal(record.surfaceTemperature, ex65Input.surfaceTemperature);
  assert.equal(record.freeStreamTemperature, ex65Input.freeStreamTemperature);
});

test('handoff href round-trips a cylinder estimate (eq. 7.66)', () => {
  const estimate = estimateWindHeatTransfer(ex78Input);
  const record = windHandoffFromSearch(searchOf(windHeatSinkHandoffHref(estimate, ex78Input)));
  assert.equal(record.h, estimate.h);
  assert.equal(record.correlation, '7.66');
  assert.equal(record.geometry, 'cylinder');
  assert.equal(record.velocity, ex78Input.velocity);
  assert.equal(record.characteristicLength, ex78Input.characteristicLength);
});

test('handed-off h drives the heat sink identically to direct h input', () => {
  const estimate = estimateWindHeatTransfer(ex65Input);
  const record = windHandoffFromSearch(searchOf(windHeatSinkHandoffHref(estimate, ex65Input)));
  const viaHandoff = advanceTo({...SCREEN_DEFAULT, h: record.h}, 5);
  const viaDirect = advanceTo({...SCREEN_DEFAULT, h: estimate.h}, 5);
  assert.equal(viaHandoff.baseTemperature, viaDirect.baseTemperature);
  assert.deepEqual(viaHandoff.finTemperature, viaDirect.finTemperature);
  assert.equal(viaHandoff.energyError, viaDirect.energyError);
  const viaDefault = advanceTo(SCREEN_DEFAULT, 5);
  assert.notEqual(viaHandoff.baseTemperature, viaDefault.baseTemperature);
});

test('heat-sink screen defaults still reproduce the verified t=5 s result', () => {
  const snap = advanceTo(SCREEN_DEFAULT, 5);
  assert.ok(Math.abs(snap.baseTemperature - 293.4390857) < 1e-6,
    `default base temperature at t=5 s: ${snap.baseTemperature}`);
});

test('parser returns null without parameters and rejects malformed handoffs', () => {
  assert.equal(windHandoffFromSearch(''), null);
  assert.equal(windHandoffFromSearch('?'), null);
  const good = searchOf(windHeatSinkHandoffHref(estimateWindHeatTransfer(ex65Input), ex65Input));
  const replace = (key, value) => {
    const p = new URLSearchParams(good);
    if (value === null) p.delete(key); else p.set(key, value);
    return '?' + p;
  };
  assert.throws(() => windHandoffFromSearch(replace('wnu', null)), /形式に対応していません/);
  assert.throws(() => windHandoffFromSearch(good + '&extra=1'), /形式に対応していません/);
  assert.throws(() => windHandoffFromSearch(good + '&wh=1'), /形式に対応していません/);
  assert.throws(() => windHandoffFromSearch('?foo=1'), /形式に対応していません/);
  assert.throws(() => windHandoffFromSearch(replace('wc', '9.99')), /相関式/);
  assert.throws(() => windHandoffFromSearch(replace('wg', 'sphere')), /形状/);
  for (const bad of ['0', '-3', 'abc', '', '1e999', 'NaN', '0x10'])
    assert.throws(() => windHandoffFromSearch(replace('wh', bad)), /熱伝達率h/);
  for (const bad of ['0', '-1', 'x'])
    assert.throws(() => windHandoffFromSearch(replace('wv', bad)), /主流速度/);
});

test('serializer rejects unusable records instead of emitting a broken link', () => {
  const estimate = estimateWindHeatTransfer(ex65Input);
  assert.throws(() => windHeatSinkHandoffHref(null, ex65Input), /推定記録と入力条件/);
  assert.throws(() => windHeatSinkHandoffHref(estimate, null), /推定記録と入力条件/);
  assert.throws(() => windHeatSinkHandoffHref({...estimate, h: NaN}, ex65Input), /熱伝達率h/);
  assert.throws(() => windHeatSinkHandoffHref({...estimate, h: -1}, ex65Input), /熱伝達率h/);
  assert.throws(() => windHeatSinkHandoffHref({...estimate, correlation: '9.99'}, ex65Input), /相関式/);
  assert.throws(() => windHeatSinkHandoffHref({...estimate, geometry: 'sphere'}, ex65Input), /形状/);
  assert.throws(() => windHeatSinkHandoffHref(estimate, {...ex65Input, velocity: 0}), /主流速度/);
});
