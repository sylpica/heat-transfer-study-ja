import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {solveFinGapFlow} from '../dynamic/dev/fin-gap-flow.mjs';
import {
  FINGAP_GUI_PRESETS,
  buildFinGapInput,
  formatTemperatureK,
  formatNusselt,
  formatPressurePa,
} from '../dynamic/dev/fin-gap-flow-ui-config.mjs';

const html = readFileSync(
  new URL('../dynamic/dev/fin-gap-flow.html', import.meta.url), 'utf8');
const ui = readFileSync(
  new URL('../dynamic/dev/fin-gap-flow-ui.mjs', import.meta.url), 'utf8');

test('screen HTML wires the fin-gap core directly and stays development-only', () => {
  assert.match(html, /fin-gap-flow-ui\.mjs/);
  assert.match(html, /cavity\.css/);
  assert.match(html, /開発用・公開承認前/);
  for (const id of ['settings', 'preset', 'gap', 'fheight', 'length', 'frho',
    'fcp', 'fk', 'fnu', 'inlet', 'drivetype', 'drivevalue', 'drivevaluelabel',
    'boundarytype', 'boundaryvalue', 'boundaryvaluelabel', 'nx', 'ny',
    'dxgrowth', 'apply', 'summary', 'status', 'error', 'readout', 'profiles',
    'diagnostic-values']) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  // The core runs in the page (fast sweep, no worker) and its refusal
  // messages reach the page verbatim instead of screen-side wording.
  assert.match(ui, /solveFinGapFlow/);
  assert.match(ui, /showError\(e\)/);
  // The new screen files must not enter the public build allowlist.
  const build = readFileSync(
    new URL('../scripts/build-public-site.mjs', import.meta.url), 'utf8');
  for (const name of ['fin-gap-flow.html', 'fin-gap-flow-ui',
    'fin-gap-flow-ui-config', 'fin-gap-flow-view']) {
    assert.ok(!build.includes(name), `allowlist must not include ${name}`);
  }
});

test('input builder passes exactly the keys the core accepts', () => {
  const built = buildFinGapInput(FINGAP_GUI_PRESETS.developedFlux.fields);
  assert.deepEqual(Object.keys(built).sort(),
    ['boundary', 'cp', 'drive', 'dxGrowth', 'finHeight', 'gap',
     'inletTemperature', 'k', 'length', 'nu', 'nx', 'ny', 'rho']);
  assert.deepEqual(Object.keys(built.drive).sort(), ['bulkVelocity', 'type']);
  assert.deepEqual(Object.keys(built.boundary).sort(), ['type', 'wallHeatFlux']);
  const temp = buildFinGapInput(FINGAP_GUI_PRESETS.developedTemp.fields);
  assert.deepEqual(Object.keys(temp.boundary).sort(), ['type', 'wallTemperature']);
});

test('presets reproduce the pre-registered acceptance cases A1/A2/A4 and the A3 drive case', () => {
  const a1 = solveFinGapFlow(buildFinGapInput(FINGAP_GUI_PRESETS.developedFlux.fields));
  assert.ok(Math.abs(a1.thermal.outletLocalNusselt - 8.235294109) <= 1e-6,
    `${a1.thermal.outletLocalNusselt}`);
  const a2 = solveFinGapFlow(buildFinGapInput(FINGAP_GUI_PRESETS.developedTemp.fields));
  assert.ok(Math.abs(a2.thermal.outletLocalNusselt - 7.540485607) <= 1e-6,
    `${a2.thermal.outletLocalNusselt}`);
  const a4 = solveFinGapFlow(buildFinGapInput(FINGAP_GUI_PRESETS.pressureDrive.fields));
  assert.ok(Math.abs(a4.drive.bulkVelocityMPerS - 0.44953315981353364) <=
    1e-12 * 0.44953315981353364, `${a4.drive.bulkVelocityMPerS}`);
  assert.ok(Math.abs(a4.pressure.dropPa - 0.1) <= 1e-9 * 0.1);
  const a3 = solveFinGapFlow(buildFinGapInput(FINGAP_GUI_PRESETS.volumeFlow.fields));
  assert.ok(Math.abs(a3.drive.bulkVelocityMPerS - 4) <= 1e-12 * 4,
    `${a3.drive.bulkVelocityMPerS}`);
});

test('display formats render the verified acceptance values', () => {
  assert.equal(formatNusselt(8.235294109226304), '8.235294');
  assert.equal(formatNusselt(7.540485606848578), '7.540486');
  assert.equal(formatNusselt(null), '—');
  assert.equal(formatTemperatureK(316.56391850205534), '316.5639');
  assert.equal(formatPressurePa(0.1), '0.1000');
});
