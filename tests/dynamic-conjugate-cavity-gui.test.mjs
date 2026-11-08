import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createConjugateCavity} from '../dynamic/dev/conjugate-cavity.mjs';
import {
  CONJUGATE_GUI_PRESETS,
  buildConjugateCavityInput,
  displayTemperatureRange,
  advanceModelBy,
  intervalChanges,
} from '../dynamic/dev/conjugate-cavity-ui-config.mjs';

const html = readFileSync(
  new URL('../dynamic/dev/conjugate-cavity.html', import.meta.url), 'utf8');
const ui = readFileSync(
  new URL('../dynamic/dev/conjugate-cavity-ui.mjs', import.meta.url), 'utf8');
const near = (a, b, t, msg) => assert.ok(Math.abs(a - b) <= t, `${msg ?? ''} ${a} != ${b} (tol ${t})`);

test('screen HTML wires the core through the ui module and stays development-only', () => {
  assert.match(html, /conjugate-cavity-ui\.mjs/);
  assert.match(html, /cavity\.css/);
  assert.match(html, /開発用・公開承認前/);
  for (const id of ['settings', 'preset', 'grid', 'rayleigh', 'prandtl',
    'conductivity', 'capacity', 'source', 'initial', 'apply', 'summary',
    'interval', 'run', 'pause', 'step', 'back', 'restart', 'steady',
    'clock', 'status', 'error', 'legend', 'field', 'readout',
    'diagnostics', 'diagnostic-values']) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  // The UI passes core errors through instead of inventing its own.
  assert.match(ui, /createConjugateCavity/);
  assert.match(ui, /e\.message/);
  // The new screen files must not enter the public build allowlist.
  const build = readFileSync(
    new URL('../scripts/build-public-site.mjs', import.meta.url), 'utf8');
  assert.ok(!build.includes('conjugate-cavity.html'));
  assert.ok(!build.includes('conjugate-cavity-ui'));
  assert.ok(!build.includes('conjugate-cavity-ui-config'));
  assert.ok(!build.includes('conjugate-cavity-view'));
});

test('input builder passes exactly the keys the core accepts', () => {
  const input = buildConjugateCavityInput(CONJUGATE_GUI_PRESETS.main.fields);
  assert.deepEqual(Object.keys(input).sort(), [
    'capacityRatio', 'conductivityRatio', 'initialTemperature', 'n',
    'prandtl', 'rayleigh', 'source',
  ]);
  assert.deepEqual(input, {
    n: 16, rayleigh: 1000, prandtl: 0.71, conductivityRatio: 0.5,
    capacityRatio: 2, source: 0, initialTemperature: 0.5,
  });
  assert.throws(() => buildConjugateCavityInput(
    {...CONJUGATE_GUI_PRESETS.main.fields, rayleigh: NaN}),
    /Rayleigh数.*数値ではありません/);
  assert.throws(() => buildConjugateCavityInput(
    {...CONJUGATE_GUI_PRESETS.main.fields, grid: 16.5}),
    /格子数n.*整数ではありません/);
  assert.throws(() => buildConjugateCavityInput(null),
    /オブジェクトで指定/);
});

test('every preset is accepted by the core, and core refusals pass through untouched', () => {
  for (const key of Object.keys(CONJUGATE_GUI_PRESETS)) {
    const input = buildConjugateCavityInput(CONJUGATE_GUI_PRESETS[key].fields);
    const m = createConjugateCavity(input);
    assert.equal(m.snapshot().releaseApproved, false, key);
    assert.equal(m.config.thicknessRatio, 0.25, key);
  }
  // The builder does not pre-empt the core's scope refusals: Ra>1000
  // is built as-is and refused by the core with its own reason.
  const out = buildConjugateCavityInput(
    {...CONJUGATE_GUI_PRESETS.main.fields, rayleigh: 2000});
  assert.equal(out.rayleigh, 2000);
  assert.throws(() => createConjugateCavity(out), /検証範囲はRa≤1000/);
  const hot = buildConjugateCavityInput(
    {...CONJUGATE_GUI_PRESETS.main.fields, initialTemperature: 2});
  assert.throws(() => createConjugateCavity(hot), /監視範囲/);
});

test('display temperature range covers the core-monitored bound', () => {
  assert.deepEqual(displayTemperatureRange(
    buildConjugateCavityInput(CONJUGATE_GUI_PRESETS.main.fields)), [0, 1]);
  const src = displayTemperatureRange(
    buildConjugateCavityInput(CONJUGATE_GUI_PRESETS.source.fields));
  assert.equal(src[0], 0);
  near(src[1], 1.3125, 1e-15, 'source bound 1 + (0.25 + 0.0625/1)');
});

test('screen advance helper reproduces the measured main-case state at tau=0.1', () => {
  const m = createConjugateCavity(
    buildConjugateCavityInput(CONJUGATE_GUI_PRESETS.main.fields));
  const steps = advanceModelBy(m, 0.1);
  assert.equal(steps, 366);
  near(m.time, 0.1, 1e-12, 'time');
  const s = m.snapshot();
  // Anchors measured on the core itself (same stepping rule as its
  // runToSteady): the screen must show these to its displayed digits.
  near(s.instantaneousPowers.interface, 0.548530400268694, 1e-12, 'interface heat at 0.1');
  near(s.interfaceTemperature.mean, 0.6174993519840419, 1e-12, 'interface mean temperature at 0.1');
  near(s.maximumFaceSpeed, 2.314465339142153, 1e-11, 'maximum face speed at 0.1');
  assert.ok(s.energy.relativeMaximumError <= 1e-9);
  assert.throws(() => advanceModelBy(m, 0), /正の数/);
  assert.throws(() => advanceModelBy(m, -0.1), /正の数/);
});

test('intervalChanges implements the core steady criterion', () => {
  const m = createConjugateCavity(buildConjugateCavityInput(
    {...CONJUGATE_GUI_PRESETS.conduction.fields, grid: 8}));
  const s0 = m.snapshot();
  const same = intervalChanges(s0, s0);
  assert.equal(same.maxTemperatureChange, 0);
  assert.equal(same.relativeVelocityChange, 0);
  assert.equal(same.relativeInterfaceHeatChange, 0);
  assert.equal(same.passes, true);
  advanceModelBy(m, 0.1);
  const s1 = m.snapshot();
  const early = intervalChanges(s0, s1);
  assert.ok(early.maxTemperatureChange > 1e-7, 'early transient changes are large');
  assert.equal(early.passes, false);
  // A fabricated 1e-6 interface-heat change at steady temperatures
  // must fail the heat leg of the criterion.
  const doctored = structuredClone(s1);
  doctored.instantaneousPowers.interface = s1.instantaneousPowers.interface * (1 + 1e-5);
  assert.equal(intervalChanges(s1, doctored).passes, false);
});
