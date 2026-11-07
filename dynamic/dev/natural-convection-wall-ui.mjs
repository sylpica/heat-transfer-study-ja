// Development-only screen for natural-convection-wall.mjs.  The model
// core is unchanged: this file only collects inputs through the
// ui-config builders, passes exactly the keys the core accepts, and
// renders its record (or its Japanese rejection reason, verbatim).
import {
  naturalConvectionVerticalWall,
  uniformHeatFluxVerticalWall,
} from './natural-convection-wall.mjs';
import {
  WALL_GUI_PRESETS,
  buildIsothermalWallInput,
  buildUniformFluxWallInput,
  uniformFluxWallTemperatureProfile,
  boundaryLayerProfileWindow,
} from './natural-convection-wall-ui-config.mjs';

const $ = (id) => document.getElementById(id);
const els = {
  form: $('settings'), preset: $('preset'), wallkind: $('wallkind'),
  summary: $('summary'), status: $('status'), error: $('error'),
  readout: $('readout'), warnings: $('warnings'),
  profilesIsothermal: $('profiles-isothermal'),
  profilesUniform: $('profiles-uniform'),
  graphVelocity: $('graph-velocity'), graphTemperature: $('graph-temperature'),
  graphWalltemp: $('graph-walltemp'),
};
const fmt = (x) => String(Number(x.toPrecision(10)));
const pct = (a, b) => {
  const d = ((a - b) / b) * 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(2)}%`;
};

// Screen field id -> core field name.
const FIELD_IDS = {
  wallTemperatureK: 'walltemp', heatFluxWPerM2: 'heatflux',
  ambientTemperatureK: 'ambient', lengthM: 'length', betaPerK: 'beta',
  kinematicViscosityM2PerS: 'nu', thermalDiffusivityM2PerS: 'alpha',
  thermalConductivityWPerMK: 'k', gravityMPerS2: 'gravity',
};

function readFields() {
  const fields = {};
  for (const [key, id] of Object.entries(FIELD_IDS)) {
    fields[key] = $(id).value === '' ? NaN : Number($(id).value);
  }
  return fields;
}

function fillFields(fields) {
  for (const [key, value] of Object.entries(fields)) {
    $(FIELD_IDS[key]).value = String(value);
  }
}

function syncEnabled() {
  const uhf = els.wallkind.value === 'uniform-flux';
  $('walltemp').disabled = uhf;
  $('heatflux').disabled = !uhf;
}

function showError(e) {
  els.error.textContent = e.message;
  els.error.hidden = false;
  els.readout.textContent = '計算できませんでした。上の理由を確認してください。';
  els.warnings.hidden = true;
  els.warnings.textContent = '';
  els.profilesIsothermal.hidden = true;
  els.profilesUniform.hidden = true;
  els.status.textContent = '条件を受け付けませんでした';
}

function showWarnings(warnings) {
  if (warnings && warnings.length) {
    els.warnings.textContent = '警告：\n' + warnings.map((w) => '・' + w).join('\n');
    els.warnings.hidden = false;
  } else {
    els.warnings.hidden = true;
    els.warnings.textContent = '';
  }
}

// --- canvas profile drawing (display only; data comes from the core) ---
const ACCENT = '#ba7300';
function setupCanvas(canvas, height) {
  const W = Math.max(300, canvas.clientWidth || 600);
  const H = height;
  const ratio = devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  canvas.style.width = '100%';
  canvas.width = Math.round(W * ratio);
  canvas.height = Math.round(H * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, W, H);
  return {ctx, W, H};
}
function fgColor() {
  return getComputedStyle(document.body).getPropertyValue('--fg').trim() || '#152538';
}
function drawLineProfile(canvas, xs, ys, {height, title, xLabel, yLabel, xScale = 1, xDigits = 1, yDigits = 2, includeZero = false, aria}) {
  const {ctx, W, H} = setupCanvas(canvas, height);
  const l = 64, r = 12, t = 26, b = 26, pw = W - l - r, ph = H - t - b;
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (includeZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (hi <= lo) { hi = lo + 1; }
  const pad = (hi - lo) * 0.06;
  lo -= pad; hi += pad;
  const x0 = xs[0], x1 = xs[xs.length - 1];
  const X = (v) => l + ((v - x0) / (x1 - x0)) * pw;
  const Y = (v) => t + ((hi - v) / (hi - lo)) * ph;
  const fg = fgColor();
  ctx.font = '12px system-ui';
  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1;
  ctx.fillText(title, 8, 16);
  ctx.strokeRect(l, t, pw, ph);
  for (const f of [0, 0.5, 1]) {
    const v = lo + (hi - lo) * f, y = Y(v);
    ctx.fillText(v.toFixed(yDigits), 6, y + 4);
    ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(l + pw, y);
    ctx.strokeStyle = 'rgba(128,145,165,.35)'; ctx.stroke(); ctx.strokeStyle = fg;
  }
  for (const f of [0, 0.5, 1]) {
    const v = (x0 + (x1 - x0) * f) * xScale, x = X(x0 + (x1 - x0) * f);
    const label = v.toFixed(xDigits);
    ctx.fillText(label, Math.min(x, l + pw - ctx.measureText(label).width), H - 8);
  }
  ctx.fillText(yLabel, l + 4, t + 14);
  ctx.fillText(xLabel, l + pw - ctx.measureText(xLabel).width, t + 14);
  if (includeZero && lo < 0 && hi > 0) {
    ctx.beginPath(); ctx.moveTo(l, Y(0)); ctx.lineTo(l + pw, Y(0));
    ctx.strokeStyle = 'rgba(128,145,165,.6)'; ctx.stroke(); ctx.strokeStyle = fg;
  }
  ctx.beginPath();
  xs.forEach((x, i) => { const px = X(x), py = Y(ys[i]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1;
  canvas.setAttribute('aria-label', aria);
}

let lastResult = null;
let lastKind = null;
let lastFields = null;

function renderIsothermal(r, fields) {
  const lines = [
    '壁種別：等温壁（相似解、教科書§8.3）',
    `膜温度 Tf = ${fmt(r.filmTemperatureK)} K、温度差 ΔT = ${fmt(r.deltaTK)} K（${r.flowDirection > 0 ? '加熱壁：流れは上向き' : '冷却壁：流れは下向き'}）`,
    `Prandtl数 Pr = ${fmt(r.prandtl)}`,
    `Grashof数 Gr_L = ${fmt(r.grashof)}`,
    `Rayleigh数 Ra_L = ${fmt(r.rayleigh)}`,
    `相似解：−θ′(0) = ${fmt(r.similarity.wallTemperatureGradient)}、f′′(0) = ${fmt(r.similarity.fDoublePrimeAtWall)}`,
    `平均Nusselt数 Nu_L（相似解） = ${fmt(r.averageNusselt)}`,
    `局所Nusselt数 Nu_x（x = L） = ${fmt(r.localNusseltAtTop)}`,
    `平均熱伝達率 h = ${fmt(r.averageH)} W/(m² K)`,
    `局所熱伝達率 h_x（x = L） = ${fmt(r.localHAtTop)} W/(m² K)`,
    `平均熱流束 q″ = ${fmt(r.averageHeatFluxWPerM2)} W/m²（壁から流体へを正）`,
    `式(8.13a) Churchill–Chu：Nu_L = ${fmt(r.churchillChu.averageNusselt)}（相似解との比 ${fmt(r.churchillChu.ratioToSimilarity)}、差 ${pct(r.churchillChu.averageNusselt, r.averageNusselt)}）`,
    `式(8.27) Squire–Eckert：Nu_L = ${fmt(r.squireEckert.averageNusselt)}（相似解との比 ${fmt(r.squireEckert.ratioToSimilarity)}、差 ${pct(r.squireEckert.averageNusselt, r.averageNusselt)}）`,
    `境界層（x = L）：最大速度 ${fmt(r.maxVelocityAtTopMPerS)} m/s（壁から ${fmt(r.yAtMaxVelocityM * 1000)} mm）`,
  ];
  if (r.thermalThickness1PercentM !== null) {
    lines.push(`温度境界層厚さ（θ=0.01） = ${fmt(r.thermalThickness1PercentM * 1000)} mm`);
  }
  els.readout.textContent = lines.join('\n');
  showWarnings(r.warnings);
  els.profilesIsothermal.hidden = false;
  els.profilesUniform.hidden = true;
  const ambient = fields.ambientTemperatureK;
  const win = boundaryLayerProfileWindow(r.profileAtTop, ambient, r.deltaTK);
  const yMm = win.yM.map((y) => y * 1000);
  drawLineProfile(els.graphVelocity, yMm, win.velocityMPerS, {
    height: 300, title: '速度分布 u(y)（x = L）', xLabel: 'y [mm]', yLabel: 'u [m/s]',
    xDigits: 1, yDigits: 3, includeZero: true,
    aria: `上端断面の速度分布グラフ。横軸は壁からの距離[mm]、縦軸は速度[m/s]です。最大速度は${fmt(r.maxVelocityAtTopMPerS)} m/sです。`,
  });
  drawLineProfile(els.graphTemperature, yMm, win.temperatureK, {
    height: 300, title: '温度分布 T(y)（x = L）', xLabel: 'y [mm]', yLabel: 'T [K]',
    xDigits: 1, yDigits: 1,
    aria: `上端断面の温度分布グラフ。横軸は壁からの距離[mm]、縦軸は温度[K]です。壁温${fmt(fields.wallTemperatureK)} Kから周囲温度${fmt(ambient)} Kへ変化します。`,
  });
  els.summary.textContent = `等温壁：Tw=${fmt(fields.wallTemperatureK)} K、T∞=${fmt(ambient)} K、L=${fmt(fields.lengthM)} m、β=${fmt(fields.betaPerK)} 1/K、ν=${fmt(fields.kinematicViscosityM2PerS)} m²/s、α=${fmt(fields.thermalDiffusivityM2PerS)} m²/s、k=${fmt(fields.thermalConductivityWPerMK)} W/(m K)、g=${fmt(fields.gravityMPerS2)} m/s²（物性は膜温度評価）。`;
}

function renderUniformFlux(r, fields) {
  const lines = [
    '壁種別：一様熱流束壁（式(8.44b) Raithby–Hollands、温度分布は式(8.40)–(8.41)）',
    `Prandtl数 Pr = ${fmt(r.prandtl)}`,
    `修正Rayleigh数 Ra*_L = ${fmt(r.modifiedRayleigh)}（式(8.42)）`,
    `等価Rayleigh数 Ra_L（平均温度差基準） = ${fmt(r.equivalentRayleigh)}`,
    `平均Nusselt数 Nu_L（式8.44b） = ${fmt(r.averageNusselt)}`,
    `局所Nusselt数 Nu_x（x = L） = ${fmt(r.localNusseltAtTop)}`,
    `平均熱伝達率 h = ${fmt(r.averageH)} W/(m² K)`,
    `平均温度差 ΔT = ${fmt(r.meanDeltaTK)} K（平均壁温 ${fmt(r.averageWallTemperatureK)} K）`,
    `上端温度差 ΔT(L) = ${fmt(r.topDeltaTK)} K（上端壁温 ${fmt(r.topWallTemperatureK)} K）`,
    `中央温度差 ΔT(L/2) = ${fmt(r.midDeltaTK)} K`,
    `式(8.43b) Churchill–Chu：Nu_L = ${fmt(r.churchillChu.averageNusselt)}（(8.44b)との比 ${fmt(r.churchillChu.ratioToRaithbyHollands)}、差 ${pct(r.churchillChu.averageNusselt, r.averageNusselt)}）`,
  ];
  els.readout.textContent = lines.join('\n');
  showWarnings(r.warnings);
  els.profilesIsothermal.hidden = true;
  els.profilesUniform.hidden = false;
  const profile = uniformFluxWallTemperatureProfile(r);
  drawLineProfile(els.graphWalltemp, profile.xOverL, profile.deltaTK, {
    height: 260, title: '壁面温度差 ΔT(x)（式(8.40)）', xLabel: 'x/L', yLabel: 'ΔT [K]',
    xDigits: 2, yDigits: 1, includeZero: true,
    aria: `一様熱流束壁の壁面温度差分布グラフ。横軸は下端からの相対位置x/L、縦軸は周囲温度との差[K]です。上端で${fmt(r.topDeltaTK)} K、平均は${fmt(r.meanDeltaTK)} Kです。`,
  });
  els.summary.textContent = `一様熱流束壁：q″=${fmt(fields.heatFluxWPerM2)} W/m²、T∞=${fmt(fields.ambientTemperatureK)} K、L=${fmt(fields.lengthM)} m、β=${fmt(fields.betaPerK)} 1/K、ν=${fmt(fields.kinematicViscosityM2PerS)} m²/s、α=${fmt(fields.thermalDiffusivityM2PerS)} m²/s、k=${fmt(fields.thermalConductivityWPerMK)} W/(m K)、g=${fmt(fields.gravityMPerS2)} m/s²（物性は膜温度評価）。`;
}

function compute() {
  const kind = els.wallkind.value;
  const fields = readFields();
  try {
    if (kind === 'isothermal') {
      const result = naturalConvectionVerticalWall(buildIsothermalWallInput(fields));
      lastResult = result;
      lastKind = kind;
      lastFields = fields;
      els.error.hidden = true;
      els.error.textContent = '';
      renderIsothermal(result, fields);
    } else {
      const result = uniformHeatFluxVerticalWall(buildUniformFluxWallInput(fields));
      lastResult = result;
      lastKind = kind;
      lastFields = fields;
      els.error.hidden = true;
      els.error.textContent = '';
      renderUniformFlux(result, fields);
    }
    els.status.textContent = '計算済み';
  } catch (e) {
    lastResult = null;
    lastKind = null;
    lastFields = null;
    showError(e);
  }
}

function requestCompute() {
  els.status.textContent = '計算中';
  setTimeout(compute, 10);
}

function applyPreset(key) {
  const p = WALL_GUI_PRESETS[key];
  if (!p) return;
  els.wallkind.value = p.wallKind;
  fillFields(p.fields);
  syncEnabled();
  requestCompute();
}

els.wallkind.addEventListener('change', () => { syncEnabled(); els.preset.value = ''; });
els.preset.addEventListener('change', (e) => { if (e.target.value) applyPreset(e.target.value); });
for (const id of Object.values(FIELD_IDS)) {
  $(id).addEventListener('input', () => { els.preset.value = ''; });
}
els.form.addEventListener('submit', (e) => { e.preventDefault(); requestCompute(); });
let resizeQueued = false;
addEventListener('resize', () => {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    if (lastResult && lastKind === 'isothermal') renderIsothermal(lastResult, lastFields);
    if (lastResult && lastKind === 'uniform-flux') renderUniformFlux(lastResult, lastFields);
  });
});
syncEnabled();
requestCompute();
