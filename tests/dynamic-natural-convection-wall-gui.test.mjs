import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  naturalConvectionVerticalWall,
  uniformHeatFluxVerticalWall,
} from '../dynamic/dev/natural-convection-wall.mjs';
import {
  WALL_GUI_PRESETS,
  buildIsothermalWallInput,
  buildUniformFluxWallInput,
  uniformFluxWallTemperatureProfile,
  boundaryLayerProfileWindow,
} from '../dynamic/dev/natural-convection-wall-ui-config.mjs';

const reference = JSON.parse(readFileSync(
  new URL('../docs/dynamic/NATURAL_CONVECTION_WALL_REFERENCE_20261107.json',
    import.meta.url)));
const ref = reference.reference;
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
const html = readFileSync(
  new URL('../dynamic/dev/natural-convection-wall.html', import.meta.url), 'utf8');
const ui = readFileSync(
  new URL('../dynamic/dev/natural-convection-wall-ui.mjs', import.meta.url), 'utf8');

test('screen HTML wires the core through the ui module and stays development-only', () => {
  assert.match(html, /natural-convection-wall-ui\.mjs/);
  assert.match(html, /cavity\.css/);
  assert.match(html, /開発用・公開承認前/);
  for (const id of ['settings', 'preset', 'wallkind', 'length', 'walltemp',
    'heatflux', 'ambient', 'beta', 'nu', 'alpha', 'k', 'gravity', 'apply',
    'summary', 'status', 'error', 'readout', 'warnings',
    'graph-velocity', 'graph-temperature', 'graph-walltemp']) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  // The printed (8.44a) inconsistency is disclosed, and the UI passes
  // core errors through instead of inventing its own messages.
  assert.match(html, /\(8\.44a\)/);
  assert.match(html, /0\.630/);
  assert.match(ui, /naturalConvectionVerticalWall/);
  assert.match(ui, /uniformHeatFluxVerticalWall/);
  assert.match(ui, /e\.message/);
  // The new screen files must not enter the public build allowlist.
  const build = readFileSync(
    new URL('../scripts/build-public-site.mjs', import.meta.url), 'utf8');
  assert.ok(!build.includes('natural-convection-wall.html'));
  assert.ok(!build.includes('natural-convection-wall-ui'));
  assert.ok(!build.includes('natural-convection-wall-ui-config'));
});

test('input builders pass exactly the keys the core accepts', () => {
  const iso = buildIsothermalWallInput(WALL_GUI_PRESETS.ex81.fields);
  assert.deepEqual(Object.keys(iso).sort(), [
    'ambientTemperatureK', 'betaPerK', 'gravityMPerS2',
    'kinematicViscosityM2PerS', 'lengthM', 'thermalConductivityWPerMK',
    'thermalDiffusivityM2PerS', 'wallTemperatureK',
  ]);
  const uhf = buildUniformFluxWallInput(WALL_GUI_PRESETS.uhf.fields);
  assert.deepEqual(Object.keys(uhf).sort(), [
    'ambientTemperatureK', 'betaPerK', 'gravityMPerS2', 'heatFluxWPerM2',
    'kinematicViscosityM2PerS', 'lengthM', 'thermalConductivityWPerMK',
    'thermalDiffusivityM2PerS',
  ]);
  assert.throws(() => buildIsothermalWallInput(
    {...WALL_GUI_PRESETS.ex81.fields, wallTemperatureK: NaN}),
    /壁温.*数値ではありません/);
  assert.throws(() => buildUniformFluxWallInput(
    {...WALL_GUI_PRESETS.uhf.fields, heatFluxWPerM2: undefined}),
    /壁熱流束.*数値ではありません/);
});

test('Example 8.1 preset reproduces the verified similarity and (8.13a) values', () => {
  const r = naturalConvectionVerticalWall(
    buildIsothermalWallInput(WALL_GUI_PRESETS.ex81.fields));
  const e = ref.example81;
  assert.ok(rel(r.averageNusselt, e.similarityAverageNusselt) < 2e-6,
    'similarity Nu_L');
  assert.ok(rel(r.averageH, e.similarityAverageH) < 2e-6, 'similarity h');
  assert.ok(rel(r.churchillChu.averageNusselt,
    e.churchillChuAverageNusselt) < 1e-12, '(8.13a) Nu_L');
  // Screen headline anchors: similarity 46.797, (8.13a) evaluates 47.346.
  assert.ok(Math.abs(r.averageNusselt - 46.797) < 0.001);
  assert.ok(Math.abs(r.churchillChu.averageNusselt - 47.346) < 0.001);
});

test('Example 8.3 preset reproduces the verified similarity and (8.27) values', () => {
  const r = naturalConvectionVerticalWall(
    buildIsothermalWallInput(WALL_GUI_PRESETS.ex83.fields));
  const e = ref.example83;
  assert.ok(rel(r.averageNusselt, e.similarityAverageNusselt) < 2e-6);
  assert.ok(rel(r.squireEckert.averageNusselt,
    e.squireEckertAverageNusselt) < 1e-12, '(8.27) Nu_L');
  assert.ok(rel(r.maxVelocityAtTopMPerS, e.maxVelocityAtTop) < 5e-6);
});

test('uniform-flux preset reproduces the verified (8.44b) reference case', () => {
  const r = uniformHeatFluxVerticalWall(
    buildUniformFluxWallInput(WALL_GUI_PRESETS.uhf.fields));
  const e = ref.uniformHeatFluxCase;
  assert.ok(rel(r.averageNusselt, e.averageNusselt) < 1e-12);
  assert.ok(rel(r.meanDeltaTK, e.meanDeltaT) < 1e-12);
  assert.ok(rel(r.topDeltaTK, e.topDeltaT) < 1e-12);
  assert.ok(rel(r.modifiedRayleigh, e.modifiedRayleigh) < 1e-12);
});

test('uniform-flux wall profile follows (8.40) and averages to (8.41)', () => {
  const r = uniformHeatFluxVerticalWall(
    buildUniformFluxWallInput(WALL_GUI_PRESETS.uhf.fields));
  const p = uniformFluxWallTemperatureProfile(r, 41);
  assert.equal(p.xOverL[0], 0);
  assert.equal(p.deltaTK[0], 0);
  assert.equal(p.xOverL[40], 1);
  assert.ok(rel(p.deltaTK[40], r.topDeltaTK) < 1e-12, 'top value');
  for (let i = 1; i < p.deltaTK.length; i++) {
    assert.ok(p.deltaTK[i] >= p.deltaTK[i - 1], 'monotone');
  }
  // Trapezoidal mean of the (8.40) profile approximates the (8.41)
  // mean temperature difference (5/6 of the top value).
  let trap = 0;
  for (let i = 1; i < p.deltaTK.length; i++) {
    trap += 0.5 * (p.deltaTK[i] + p.deltaTK[i - 1]) * (p.xOverL[i] - p.xOverL[i - 1]);
  }
  assert.ok(rel(trap, r.meanDeltaTK) < 0.01,
    `profile mean ${trap} vs (8.41) mean ${r.meanDeltaTK}`);
});

test('boundary-layer profile window ends at the layer edge, not etaMax', () => {
  const fields = WALL_GUI_PRESETS.ex81.fields;
  const r = naturalConvectionVerticalWall(buildIsothermalWallInput(fields));
  const win = boundaryLayerProfileWindow(
    r.profileAtTop, fields.ambientTemperatureK, r.deltaTK);
  const full = r.profileAtTop.yM;
  assert.ok(win.endIndex < full.length - 1, 'window is shorter than the raw profile');
  assert.ok(win.yLimitM < full[full.length - 1], 'window limit below raw extent');
  assert.ok(win.yLimitM > r.yAtMaxVelocityM, 'window covers the velocity peak');
  assert.equal(win.yM.length, win.endIndex + 1);
  assert.equal(win.velocityMPerS.length, win.yM.length);
  assert.equal(win.temperatureK.length, win.yM.length);
  // At the window end the temperature has essentially reached ambient.
  const thetaEnd = (win.temperatureK[win.temperatureK.length - 1]
    - fields.ambientTemperatureK) / r.deltaTK;
  assert.ok(thetaEnd <= 0.02, `theta at window end ${thetaEnd}`);
});
