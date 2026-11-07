// Development-only screen for box-radiation-3d.mjs.  The connector and
// both kernels (view factors, radiation network) are unchanged: this
// file only collects inputs, passes exactly the keys the connector
// accepts (via the DOM-independent builder in the ui-config module), and
// renders its snapshots (or its Japanese rejection reason, verbatim).
import {createBoxRadiation3D} from './box-radiation-3d.mjs';
import {BOX_FACE_DEFS, BOX_RADIATION_GUI_PRESETS, buildBoxRadiationInput, frameSteps, fmt10, fmtFixed, fmtPower} from './box-radiation-3d-ui-config.mjs';
import {boxFaceTilesMarkup} from './box-radiation-3d-view.mjs';
const $ = id => document.getElementById(id);
const els = {form: $('settings'), status: $('status'), error: $('error'), clock: $('clock'), readout: $('readout'), diag: $('diagnostic-values'), legend: $('legend'), summary: $('summary'), figure: $('figure'), interval: $('interval')};
let model = null, history = [], frame = 0, timer = null, range = [300, 600];
function stop() { if (timer) { clearInterval(timer); timer = null; } }
function showError(e) { els.error.textContent = e.message; els.error.hidden = false; }
function clearError() { els.error.hidden = true; els.error.textContent = ''; }

// One editor block per face, generated from the shared face definitions
// so the order on screen is always the kernel's face order.
function buildFaceEditors() {
 $('faces').replaceChildren(...BOX_FACE_DEFS.map((def, i) => {
  const fs = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = `${def.name}（${def.id}、${def.note}）`;
  fs.append(legend);
  const add = (labelText, control) => { const l = document.createElement('label'); l.append(labelText, control); fs.append(l); return control; };
  const number = (suffix, value) => { const input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.id = `face-${i}-${suffix}`; input.value = String(value); input.required = true; return input; };
  add('温度 [K]', number('temperature', ''));
  add('放射率', number('emissivity', ''));
  add('熱容量 [J/K]', number('capacity', ''));
  const kind = document.createElement('select'); kind.id = `face-${i}-input-kind`;
  kind.replaceChildren(new Option('外部入力なし', 'none'), new Option('外部入力 power [W]', 'power'), new Option('外部入力 heatFlux [W/m²]', 'heatFlux'));
  add('外部入力', kind);
  add('外部入力の値', number('input-value', '0'));
  return fs;
 }));
}
function setFaceValues(faces) {
 faces.forEach((f, i) => {
  $(`face-${i}-temperature`).value = String(f.temperature);
  $(`face-${i}-emissivity`).value = String(f.emissivity);
  $(`face-${i}-capacity`).value = String(f.capacity);
  $(`face-${i}-input-kind`).value = f.inputKind;
  $(`face-${i}-input-value`).value = String(f.inputValue);
 });
}
function readValues() {
 const num = id => $(id).valueAsNumber;
 return {
  dimensions: {x: num('dim-x'), y: num('dim-y'), z: num('dim-z')},
  maxTemperature: num('max-temperature'),
  resolutionKey: $('resolution').value,
  faces: BOX_FACE_DEFS.map((_, i) => ({
   temperature: num(`face-${i}-temperature`),
   emissivity: num(`face-${i}-emissivity`),
   capacity: num(`face-${i}-capacity`),
   inputKind: $(`face-${i}-input-kind`).value,
   inputValue: num(`face-${i}-input-value`),
  })),
 };
}
function summaryText(input, g) {
 const adm = g.diagnostics.networkAdmission;
 return `寸法 ${input.dimensions.x}×${input.dimensions.y}×${input.dimensions.z} m、6面の合計面積 ${fmt10(g.areas.reduce((a, b) => a + b, 0))} m²。形態係数の受入：行和残差 ${adm.maximumRowResidual.toExponential(3)}（受入精度 1e-12、解像度の自動引上げ${adm.resolutionEscalated ? 'あり' : 'なし'}、再正規化なし）。`;
}
function render() {
 const s = history[frame]; if (!s || !model) return;
 const g = model.geometry;
 els.clock.textContent = `${s.time.toFixed(3)} s`;
 els.legend.textContent = `共通の色の範囲：${range[0].toFixed(1)} K（青）〜 ${range[1].toFixed(1)} K（赤）。タイルは各面を同じ大きさで示す模式図です（寸法比は表と数値で確認してください）。`;
 els.figure.innerHTML = boxFaceTilesMarkup({snapshot: s, areas: g.areas, range});
 els.readout.textContent = [
  ...BOX_FACE_DEFS.map((def, i) => `${def.name} ${def.id}：T=${fmt10(s.temperature[i])} K、J=${fmt10(s.radiosity[i])} W/m²、G=${fmt10(s.irradiation[i])} W/m²、正味放射 Q=${fmt10(s.outwardPower[i])} W（外向き+）、正味熱流束 q″=${fmt10(s.faceOutwardFlux[i])} W/m²`),
  `放射収支 ΣQ = ${fmt10(s.radiationBalance)} W（全6面の正味放射の合計）`,
 ].join('\n');
 $('face-values').querySelector('tbody').innerHTML = BOX_FACE_DEFS.map((def, i) =>
  `<tr><th>${def.name}（${def.id}）</th><td>${fmtFixed(g.areas[i], 4)}</td><td>${fmtFixed(s.temperature[i], 4)}</td><td>${fmtFixed(s.radiosity[i], 4)}</td><td>${fmtFixed(s.irradiation[i], 4)}</td><td>${fmtPower(s.outwardPower[i])}</td><td>${fmtPower(s.faceOutwardFlux[i])}</td></tr>`).join('');
 const adm = g.diagnostics.networkAdmission, kd = g.diagnostics, integ = kd.integration || {};
 els.diag.textContent = [
  `形態係数 F（行=出る面、列=当たる面）:`,
  ...g.viewFactors.map(row => row.map(v => v.toPrecision(7)).join(' ')),
  `面の面積 [m²]: ${g.areas.map(v => fmt10(v)).join(', ')}`,
  `接続層の受入判定：総和則の最大残差 = ${adm.maximumRowResidual}、相反則の相対残差 = ${adm.reciprocityRelativeResidual}、受入精度 = ${adm.tolerance}、解像度の自動引上げ = ${adm.resolutionEscalated ? 'あり' : 'なし'}、再正規化 = なし`,
  `形態係数核：総和残差 = ${kd.maximumRowResidual}、相反の相対差 = ${kd.reciprocityRelativeResidual}、採用積分 = 分離 ${integ.separationPanels}・極 ${integ.polarPanels}・ガウス ${integ.gaussOrder}`,
  `安定刻み safeDt = ${s.safeDt} s、steps = ${s.steps}、最終刻み = ${s.lastDt} s`,
  `顕熱 = ${s.energy} J、外部累積入力 = ${s.netInput} J、熱収支差 = ${s.energyError} J（相対 ${s.relativeEnergyError}）`,
  `射度の相対残差 = ${s.linearResidual}、外部入力の合計 = ${s.lastPower} W`,
  `releaseApproved = false（開発用・公開承認前）`,
 ].join('\n');
 $('back').disabled = frame <= 0;
 $('restart').disabled = frame <= 0 && history.length <= 1;
}
function apply() {
 stop();
 try {
  const input = buildBoxRadiationInput(readValues());
  const next = createBoxRadiation3D(input);
  model = next; history = [model.snapshot()]; frame = 0;
  const temps = history[0].temperature;
  range = [Math.min(...temps), Math.max(...temps)];
  if (range[1] - range[0] < 1) range = [range[0] - .5, range[1] + .5];
  els.summary.textContent = summaryText(input, model.geometry);
  clearError(); render(); els.status.textContent = '準備完了';
 } catch (e) { showError(e); els.status.textContent = '条件を受け付けませんでした'; }
}
function advanceFrame() {
 if (!model) return;
 if (frame < history.length - 1) { frame++; model.restore(history[frame]); render(); els.status.textContent = '計算済み'; return; }
 const before = model.snapshot();
 try {
  const {count, dt} = frameSteps(els.interval.valueAsNumber, model.safeDt);
  for (let i = 0; i < count; i++) model.step(dt);
 } catch (e) { model.restore(before); stop(); showError(e); els.status.textContent = '一時停止'; return; }
 history.push(model.snapshot()); if (history.length > 1200) history.splice(1, history.length - 1200);
 frame = history.length - 1; clearError(); render(); els.status.textContent = timer ? '再生中' : '計算済み';
}
function applyPreset(key) {
 const p = BOX_RADIATION_GUI_PRESETS[key]; if (!p) return;
 $('dim-x').value = String(p.dimensions.x); $('dim-y').value = String(p.dimensions.y); $('dim-z').value = String(p.dimensions.z);
 $('max-temperature').value = String(p.maxTemperature); $('resolution').value = p.resolutionKey;
 els.interval.value = String(p.intervalSeconds);
 setFaceValues(p.faces); apply();
}
els.form.addEventListener('submit', e => { e.preventDefault(); apply(); });
$('preset').addEventListener('change', e => { if (e.target.value) applyPreset(e.target.value); });
for (const id of ['dim-x', 'dim-y', 'dim-z', 'max-temperature', 'resolution'])
 $(id).addEventListener('input', () => { $('preset').value = ''; });
$('faces').addEventListener('input', () => { $('preset').value = ''; });
$('run').addEventListener('click', () => { if (!model || timer) return; timer = setInterval(advanceFrame, 100); els.status.textContent = '再生中'; });
$('pause').addEventListener('click', () => { stop(); els.status.textContent = '一時停止'; });
$('step').addEventListener('click', () => { stop(); advanceFrame(); });
$('back').addEventListener('click', () => { stop(); if (frame > 0) { frame--; model.restore(history[frame]); render(); } els.status.textContent = '計算済み'; });
$('restart').addEventListener('click', () => { stop(); frame = 0; model.restore(history[0]); render(); els.status.textContent = '計算済み'; });
buildFaceEditors();
setFaceValues(BOX_RADIATION_GUI_PRESETS.gray.faces);
apply();
