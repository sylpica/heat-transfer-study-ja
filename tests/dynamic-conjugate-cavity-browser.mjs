// Browser check for the conjugate-cavity development screen.
// Not part of `node --test` (run directly with node).  Verifies, in a
// real Chromium, that the screen's displayed values equal the core's
// own values to the displayed digits, that a core refusal reaches the
// screen verbatim, and that the screen's steady seek lands on the
// verified steady state of the main case recorded in
// docs/dynamic/CONJUGATE_MODEL_JS_20261107.md (Codex FVM record:
// interface heat 0.6964472716362966, interface mean temperature
// 0.6517763913916443 at n=16, cold start).
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, cp} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {startServer} from '../scripts/serve.mjs';
import {createConjugateCavity} from '../dynamic/dev/conjugate-cavity.mjs';

const work = new URL('../work/', import.meta.url);
await mkdir(work, {recursive: true});
const root = await mkdtemp(new URL('conjugate-gui-browser-', work).pathname);
await mkdir(root + '/dynamic/dev', {recursive: true});
for (const file of ['conjugate-cavity.mjs', 'conjugate-cavity.html',
  'conjugate-cavity-ui.mjs', 'conjugate-cavity-ui-config.mjs',
  'conjugate-cavity-view.mjs', 'cavity.css']) {
  await cp(new URL('../dynamic/dev/' + file, import.meta.url), root + '/dynamic/dev/' + file);
}
const engine = process.env.BROWSER_ENGINE || 'chromium';
const engines = createRequire(import.meta.url)('playwright');
const server = await startServer({root, port: 0});
const browser = await engines[engine].launch({headless: true, ...(engine === 'chromium' ? {...(process.env.BROWSER_EXECUTABLE || existsSync('/usr/bin/chromium') ? {executablePath: process.env.BROWSER_EXECUTABLE || '/usr/bin/chromium'} : {}), args: ['--no-sandbox']} : {})});
try {
  const context = await browser.newContext({viewport: {width: 1280, height: 900}});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ready = async () => {
    await page.waitForFunction(() => document.querySelector('#status')?.textContent === '準備完了');
    assert.equal(await page.locator('#error').isVisible(), false);
  };
  const readout = () => page.locator('#readout').innerText();
  const grab = (text, re) => {
    const m = text.match(re);
    assert.ok(m, `pattern ${re} in: ${text}`);
    return Number(m[1]);
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/dynamic/dev/conjugate-cavity.html`);
  await ready();
  assert.equal(await page.locator('#clock').innerText(), 'τ = 0.000');
  assert.match(await page.locator('#summary').innerText(), /主ケース|Ra=1000/);
  const blank = await page.locator('#field').evaluate((c) => c.toDataURL());

  // One 0.1 frame of the main case: screen values equal the core's
  // values computed here in Node, to the displayed digits.
  const kernel = createConjugateCavity({n: 16, rayleigh: 1000, prandtl: 0.71, conductivityRatio: 0.5, capacityRatio: 2, source: 0, initialTemperature: 0.5});
  {
    const target = kernel.time + 0.1;
    while (kernel.time < target) kernel.advance(Math.min(kernel.safeDt, target - kernel.time));
  }
  const kernelAt = kernel.snapshot();
  await page.locator('#step').click();
  await page.waitForFunction(() => document.querySelector('#clock').textContent === 'τ = 0.100', null, {timeout: 120000});
  let text = await readout();
  assert.ok(Math.abs(grab(text, /界面熱 Q（瞬間、高さ平均） = ([\d.]+)/) - kernelAt.instantaneousPowers.interface) < 1e-9, 'screen interface heat vs core');
  assert.ok(Math.abs(grab(text, /界面平均温度 θ = ([\d.]+)/) - kernelAt.interfaceTemperature.mean) < 1e-9, 'screen interface mean temperature vs core');
  assert.ok(Math.abs(grab(text, /固体平均温度 θ = ([\d.]+)/) - kernelAt.solidTemperature.mean) < 1e-9, 'screen solid mean vs core');
  assert.ok(Math.abs(grab(text, /流体平均温度 θ = ([\d.]+)/) - kernelAt.fluidTemperature.mean) < 1e-9, 'screen fluid mean vs core');
  assert.notEqual(await page.locator('#field').evaluate((c) => c.toDataURL()), blank);

  // Rewind restores the exact initial frame; stepping again moves
  // forward through the stored history.
  await page.locator('#back').click();
  await page.waitForFunction(() => document.querySelector('#clock').textContent === 'τ = 0.000');
  text = await readout();
  assert.ok(Math.abs(grab(text, /界面熱 Q（瞬間、高さ平均） = ([\d.]+)/)) < 1e-12, 'initial interface heat is 0 for the uniform start');
  await page.locator('#step').click();
  await page.waitForFunction(() => document.querySelector('#clock').textContent === 'τ = 0.100');
  await page.locator('#restart').click();
  assert.equal(await page.locator('#clock').innerText(), 'τ = 0.000');

  // A core refusal reaches the screen verbatim (Ra above the
  // validated range), and a non-numeric field is refused by the
  // builder.  The previously accepted state stays on screen.
  await page.locator('#rayleigh').fill('2000');
  await page.locator('#apply').click();
  await page.waitForFunction(() => document.querySelector('#error')?.hidden === false);
  assert.match(await page.locator('#error').innerText(), /検証範囲はRa≤1000です/);
  assert.equal(await page.locator('#clock').innerText(), 'τ = 0.000');
  // An emptied field is stopped by the form's native `required`
  // validation before the submit handler runs; remove that attribute
  // here to exercise the builder's own non-numeric refusal display.
  await page.evaluate(() => document.querySelector('#rayleigh').removeAttribute('required'));
  await page.locator('#rayleigh').fill('');
  await page.locator('#apply').click();
  assert.match(await page.locator('#error').innerText(), /Rayleigh数.*数値ではありません/);

  // Steady seek on the main preset: the screen's steady diagnostics
  // agree with the verified record values.
  await page.locator('#preset').selectOption('main');
  await ready();
  await page.locator('#steady').click();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('定常に到達しました'), null, {timeout: 600000});
  text = await readout();
  const qSteady = grab(text, /界面熱 Q（瞬間、高さ平均） = ([\d.]+)/);
  const tSteady = grab(text, /界面平均温度 θ = ([\d.]+)/);
  assert.ok(Math.abs(qSteady - 0.6964472716362966) < 1e-6, `steady interface heat ${qSteady} vs record 0.6964472716362966`);
  assert.ok(Math.abs(tSteady - 0.6517763913916443) < 1e-6, `steady interface mean temperature ${tSteady} vs record 0.6517763913916443`);
  const tau = grab(await page.locator('#clock').innerText(), /τ = ([\d.]+)/);
  assert.ok(tau >= 2.5 && tau <= 3.5, `steady time ${tau}`);
  const diag = await page.evaluate(() => { document.querySelector('#diagnostics').open = true; return document.querySelector('#diagnostic-values').innerText; });
  assert.match(diag, /相対最大 = [\d.]+e-1[0-9]/, 'energy relative error stays at roundoff level');

  assert.deepEqual(errors, []);
  console.log('conjugate-cavity browser check: PASS', {qSteady, tSteady, tau});
} finally {
  await browser.close();
  server.close();
}
