// Development-only screen for conjugate-cavity.mjs.  The model core
// is unchanged: this file only collects inputs, passes exactly the
// keys the core accepts through the ui-config builder, advances the
// core in its own stable steps, and renders its snapshots (or its
// Japanese rejection reason, verbatim).
import {createConjugateCavity} from './conjugate-cavity.mjs';
import {
  CONJUGATE_GUI_PRESETS,
  buildConjugateCavityInput,
  displayTemperatureRange,
  advanceModelBy,
  intervalChanges,
} from './conjugate-cavity-ui-config.mjs';
import {drawConjugateField} from './conjugate-cavity-view.mjs';

const $ = (id) => document.getElementById(id);
const els = {
  form: $('settings'), status: $('status'), error: $('error'), clock: $('clock'),
  readout: $('readout'), diag: $('diagnostic-values'), legend: $('legend'),
  summary: $('summary'), field: $('field'), interval: $('interval'),
};
const fmt10 = (v) => (v === null || v === undefined ? '—' : String(Number(v.toPrecision(10))));
const fmt4 = (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(4));
const ex = (v, d = 3) => (v === null || v === undefined ? '—' : Number(v).toExponential(d));

let model = null, history = [], frame = 0, range = [0, 1];
let busy = false, playing = false, cancelRequested = false;

function showError(e) { els.error.textContent = e.message; els.error.hidden = false; }
function clearError() { els.error.hidden = true; els.error.textContent = ''; }
function setStatus(t) { els.status.textContent = t; }
function syncButtons() {
  for (const id of ['run', 'step', 'back', 'restart', 'steady', 'apply']) $(id).disabled = busy || !model;
  if (!busy && model) {
    $('back').disabled = frame <= 0;
    $('restart').disabled = frame <= 0 && history.length <= 1;
  }
}

function readFields() {
  const v = (id) => $(id).valueAsNumber;
  return {
    grid: Number($('grid').value),
    rayleigh: v('rayleigh'), prandtl: v('prandtl'),
    conductivityRatio: v('conductivity'), capacityRatio: v('capacity'),
    source: v('source'), initialTemperature: v('initial'),
  };
}
function summaryText(input) {
  return `Ra=${input.rayleigh}、Pr=${input.prandtl}、K=${input.conductivityRatio}、C=${input.capacityRatio}、S=${input.source}、格子${input.n}（固体${input.n / 4}列＋流体${input.n}列）、δ=0.25、初期θ=${input.initialTemperature}一様・静止。背面θ=1、右壁θ=0、上下断熱。`;
}

function render() {
  const s = history[frame];
  if (!s) return;
  els.clock.textContent = `τ = ${s.time.toFixed(3)}`;
  drawConjugateField(els.field, s, {range});
  els.legend.textContent = `色の範囲：θ = ${range[0].toFixed(2)}（青）〜 ${range[1].toFixed(3)}（赤）。`;
  const p = s.instantaneousPowers, it = s.interfaceTemperature;
  els.readout.textContent = [
    `界面熱 Q（瞬間、高さ平均） = ${fmt10(p.interface)}`,
    `界面平均温度 θ = ${fmt10(it.mean)}（最小 ${fmt4(it.minimum)}／最大 ${fmt4(it.maximum)}）`,
    `固体平均温度 θ = ${fmt10(s.solidTemperature.mean)}、流体平均温度 θ = ${fmt10(s.fluidTemperature.mean)}`,
    `背面からの熱（瞬間） = ${fmt10(p.back)}、冷壁への熱（瞬間） = ${fmt10(p.cold)}、固体の発熱（瞬間） = ${fmt10(p.source)}`,
  ].join('\n');
  const e = s.energy, h = s.cumulativeHeats;
  els.diag.textContent = [
    `法則 ${s.model}（releaseApproved=${s.releaseApproved}）`,
    `ステップ数 = ${s.steps}、最終刻み = ${ex(s.lastDt, 4)}、安定刻み safeDt = ${ex(s.safeDt, 4)}`,
    `発散（直近ステップ） = ${ex(s.divergence)}、最大面速度 = ${fmt10(s.maximumFaceSpeed)}、最大セルPe（観測最大） = ${ex(s.maximumObservedCellPe)}`,
    `圧力投影の反復 = 直近 ${s.lastPressureIterations} 回／累計 ${s.totalPressureIterations} 回`,
    `蓄熱（初期比）：固体 = ${fmt10(e.solidStorage)}、流体 = ${fmt10(e.fluidStorage)}、全体 = ${fmt10(e.totalStorage)}`,
    `積算熱：背面 = ${fmt10(h[0])}、冷壁 = ${fmt10(h[1])}、発熱 = ${fmt10(h[2])}、界面 = ${fmt10(h[3])}`,
    `収支誤差：固体 = ${ex(e.errors[0])}、流体 = ${ex(e.errors[1])}、全体 = ${ex(e.errors[2])}、相対最大 = ${ex(e.relativeMaximumError)}`,
    `実効熱伝達比 Q/θ̄（界面） = ${fmt10(s.effectiveHeatTransferRatio)}、Bi_s = ${fmt10(s.solidBiFromInterfaceAverage)}`,
  ].join('\n');
  syncButtons();
}

function apply() {
  playing = false; cancelRequested = false;
  try {
    const input = buildConjugateCavityInput(readFields());
    model = createConjugateCavity(input);
    history = [model.snapshot()];
    frame = 0;
    range = displayTemperatureRange(input);
    els.summary.textContent = summaryText(input);
    clearError();
    render();
    setStatus('準備完了');
  } catch (e) {
    showError(e);
    setStatus('条件を受け付けませんでした');
  }
}

function readInterval() {
  const v = els.interval.valueAsNumber;
  if (!Number.isFinite(v) || v <= 0 || v > 5) {
    showError(Error('1コマの無次元時間は0より大きく5以下で指定してください。'));
    return null;
  }
  return v;
}

// Advance by a duration in slices of about 25 stable steps so the
// page stays responsive; returns false when cancelled mid-frame.
async function advanceChunked(duration) {
  const target = model.time + duration;
  while (model.time < target) {
    if (cancelRequested) return false;
    const slice = Math.min(target - model.time, 25 * model.safeDt);
    advanceModelBy(model, slice);
    await new Promise((r) => setTimeout(r, 0));
  }
  return true;
}

function trimHistory() {
  if (history.length > 1200) history.splice(1, history.length - 1200);
}

async function advanceFrame() {
  if (!model || busy) return;
  if (frame < history.length - 1) {
    frame++;
    model.restore(history[frame]);
    clearError(); render(); setStatus('計算済み');
    return;
  }
  const interval = readInterval();
  if (interval === null) { playing = false; return; }
  busy = true; cancelRequested = false; syncButtons();
  const before = model.snapshot();
  let done = false, failure = null;
  try { done = await advanceChunked(interval); } catch (e) { failure = e; }
  busy = false;
  if (failure) {
    model.restore(before);
    playing = false;
    showError(failure); render(); setStatus('一時停止');
    return;
  }
  if (!done) { model.restore(before); render(); setStatus('一時停止'); return; }
  history.push(model.snapshot());
  trimHistory();
  frame = history.length - 1;
  clearError(); render();
  setStatus(playing ? '再生中' : '計算済み');
}

async function playLoop() {
  while (playing) {
    await advanceFrame();
  }
}

// Seek the steady state with the core's own criterion: advance in
// 0.1 intervals (each pushed as a history frame) and require
// intervalChanges to pass on two consecutive intervals, exactly as
// runToSteady does.  The absolute time cap is the core's default 40.
async function seekSteady() {
  if (!model || busy) return;
  playing = false;
  busy = true; cancelRequested = false; syncButtons();
  history = history.slice(0, frame + 1);
  let prev = history[frame], streak = 0, reached = false, failure = null;
  try {
    while (model.time < 40) {
      if (cancelRequested) break;
      const before = model.snapshot();
      const done = await advanceChunked(0.1);
      if (!done) { model.restore(before); break; }
      const curr = model.snapshot();
      history.push(curr); trimHistory();
      frame = history.length - 1;
      const ch = intervalChanges(prev, curr);
      streak = ch.passes ? streak + 1 : 0;
      prev = curr;
      render();
      setStatus(`定常を探索中：τ=${model.time.toFixed(2)}、直近区間の最大温度変化=${ex(ch.maxTemperatureChange, 2)}`);
      if (streak >= 2) { reached = true; break; }
    }
  } catch (e) {
    failure = e;
    model.restore(history[frame]);
  }
  busy = false;
  render();
  if (failure) { showError(failure); setStatus('一時停止'); return; }
  if (reached) { clearError(); setStatus('定常に到達しました（計算核と同じ判定を連続2区間満たしました）'); }
  else if (cancelRequested) setStatus('一時停止');
  else setStatus('上限時刻 τ=40 までに定常基準へ到達しませんでした');
}

function applyPreset(key) {
  const p = CONJUGATE_GUI_PRESETS[key];
  if (!p) return;
  $('grid').value = String(p.fields.grid);
  $('rayleigh').value = String(p.fields.rayleigh);
  $('prandtl').value = String(p.fields.prandtl);
  $('conductivity').value = String(p.fields.conductivityRatio);
  $('capacity').value = String(p.fields.capacityRatio);
  $('source').value = String(p.fields.source);
  $('initial').value = String(p.fields.initialTemperature);
  apply();
}

els.form.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
$('preset').addEventListener('change', (e) => { if (e.target.value) applyPreset(e.target.value); });
for (const id of ['grid', 'rayleigh', 'prandtl', 'conductivity', 'capacity', 'source', 'initial']) {
  $(id).addEventListener('input', () => { $('preset').value = ''; });
}
$('run').addEventListener('click', () => {
  if (!model || busy || playing) return;
  playing = true; setStatus('再生中'); playLoop();
});
$('pause').addEventListener('click', () => {
  playing = false; cancelRequested = true;
  if (!busy) setStatus('一時停止');
});
$('step').addEventListener('click', () => { playing = false; advanceFrame(); });
$('back').addEventListener('click', () => {
  playing = false;
  if (!model || busy || frame <= 0) return;
  frame--; model.restore(history[frame]); clearError(); render(); setStatus('計算済み');
});
$('restart').addEventListener('click', () => {
  playing = false;
  if (!model || busy) return;
  frame = 0; model.restore(history[0]); clearError(); render(); setStatus('計算済み');
});
$('steady').addEventListener('click', () => { seekSteady(); });
let resizeQueued = false;
addEventListener('resize', () => {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => { resizeQueued = false; if (model) render(); });
});

apply();
