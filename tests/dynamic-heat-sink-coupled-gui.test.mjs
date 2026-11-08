import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HEAT_SINK_COUPLED_STANDARD_CONDITIONS} from '../dynamic/dev/heat-sink-coupled.mjs';
import {
  COUPLED_GUI_PRESETS,
  buildCoupledInput,
  formatTemperatureK,
  formatPressurePa,
  formatRadiationW,
} from '../dynamic/dev/heat-sink-coupled-ui-config.mjs';

const html = readFileSync(
  new URL('../dynamic/dev/heat-sink-coupled.html', import.meta.url), 'utf8');
const ui = readFileSync(
  new URL('../dynamic/dev/heat-sink-coupled-ui.mjs', import.meta.url), 'utf8');
const worker = readFileSync(
  new URL('../dynamic/dev/heat-sink-coupled-worker.mjs', import.meta.url), 'utf8');

test('screen HTML wires the coupled core through the worker and stays development-only', () => {
  assert.match(html, /heat-sink-coupled-ui\.mjs/);
  assert.match(html, /cavity\.css/);
  assert.match(html, /開発用・公開承認前/);
  for (const id of ['settings', 'preset', 'fincount', 'fthick', 'gap', 'fheight',
    'length', 'bthick', 'solidk', 'frho', 'fcp', 'fk', 'fnu', 'ambient', 'flow',
    'power', 'emissivity', 'patchl', 'patchw', 'refinement', 'hrefinement',
    'apply', 'summary', 'status', 'error', 'readout', 'flows', 'flowlist',
    'diagnostic-values']) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  // The core runs in a worker and its refusal messages reach the page
  // verbatim instead of being replaced by screen-side wording.
  assert.match(worker, /solveHeatSinkCoupled/);
  assert.match(worker, /error\.message/);
  assert.match(ui, /heat-sink-coupled-worker\.mjs/);
  assert.match(ui, /data\.message/);
  // The new screen files must not enter the public build allowlist.
  const build = readFileSync(
    new URL('../scripts/build-public-site.mjs', import.meta.url), 'utf8');
  for (const name of ['heat-sink-coupled.html', 'heat-sink-coupled-ui',
    'heat-sink-coupled-ui-config', 'heat-sink-coupled-view',
    'heat-sink-coupled-worker']) {
    assert.ok(!build.includes(name), `allowlist must not include ${name}`);
  }
});

test('input builder passes exactly the keys the core accepts', () => {
  const built = buildCoupledInput(COUPLED_GUI_PRESETS.standard.fields);
  assert.deepEqual(Object.keys(built).sort(),
    Object.keys(HEAT_SINK_COUPLED_STANDARD_CONDITIONS).sort());
});

test('standard preset converts to the verified standard conditions', () => {
  const built = buildCoupledInput(COUPLED_GUI_PRESETS.standard.fields);
  for (const [key, expected] of Object.entries(HEAT_SINK_COUPLED_STANDARD_CONDITIONS)) {
    assert.ok(Math.abs(built[key] - expected) <= 1e-12 * Math.max(1, Math.abs(expected)),
      `${key}: ${built[key]} vs ${expected}`);
  }
  assert.equal(COUPLED_GUI_PRESETS.standard.refinement, 4);
  assert.equal(COUPLED_GUI_PRESETS.standard.hydraulicRefinement, 2);
  assert.equal(COUPLED_GUI_PRESETS.noRadiation.fields.emissivity, 0);
});

test('display formats render the verified r=4 reference values', () => {
  // JS-measured values at the standard conditions (r=4, hydraulic
  // refinement 2, epsilon 0.8); see HEATSINK_COUPLED_JS_20261107.md.
  assert.equal(formatTemperatureK(316.68666875369127), '316.6867');
  assert.equal(formatPressurePa(3.041697622921199), '3.0417');
  assert.equal(formatRadiationW(0.2271442678950287), '0.22714');
});
