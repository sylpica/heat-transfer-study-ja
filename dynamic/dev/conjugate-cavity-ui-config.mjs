// Screen configuration for the conjugate-cavity development page.
// Pure data and pure helpers only (no DOM), so the Node suite can
// verify that the screen's presets and input builder reproduce the
// cases verified in docs/dynamic/CONJUGATE_MODEL_JS_20261107.md and
// pass exactly the keys conjugate-cavity.mjs accepts.
//
// Presets are the record's verified cases at n=16: the main case
// (Ra=1000, Pr=0.71, K=0.5, C=2), the Ra=0 conduction cases with and
// without the solid source (analytic interface heat 2/3 and 17/24),
// the solid-dominated case (K=C=0.01), and the isothermal-wall limit
// (K=256, C=K/8).  All start from the record's cold start: uniform
// theta=0.5, fluid at rest.

export const CONJUGATE_GUI_PRESETS = {
  main: {
    label: '主ケース（Ra=1000、K=0.5、C=2）',
    fields: {grid: 16, rayleigh: 1000, prandtl: 0.71, conductivityRatio: 0.5, capacityRatio: 2, source: 0, initialTemperature: 0.5},
  },
  conduction: {
    label: '伝導のみ（Ra=0、解析解 Q=2/3）',
    fields: {grid: 16, rayleigh: 0, prandtl: 0.71, conductivityRatio: 0.5, capacityRatio: 2, source: 0, initialTemperature: 0.5},
  },
  source: {
    label: '固体発熱（Ra=0、S=1、解析解 Q=17/24）',
    fields: {grid: 16, rayleigh: 0, prandtl: 0.71, conductivityRatio: 0.5, capacityRatio: 2, source: 1, initialTemperature: 0.5},
  },
  solid: {
    label: '固体支配（Ra=1000、K=C=0.01）',
    fields: {grid: 16, rayleigh: 1000, prandtl: 0.71, conductivityRatio: 0.01, capacityRatio: 0.01, source: 0, initialTemperature: 0.5},
  },
  isothermal: {
    label: '等温壁極限（Ra=1000、K=256、C=32）',
    fields: {grid: 16, rayleigh: 1000, prandtl: 0.71, conductivityRatio: 256, capacityRatio: 32, source: 0, initialTemperature: 0.5},
  },
};

const FIELD_LABELS = {
  grid: '格子数n',
  rayleigh: 'Rayleigh数',
  prandtl: 'Prandtl数',
  conductivityRatio: '熱伝導率比K',
  capacityRatio: '体積熱容量比C',
  source: '固体体積源S',
  initialTemperature: '初期無次元温度',
};

// Build exactly the input object createConjugateCavity accepts.
// Range and scope refusals are the core's own: this builder only
// checks that every field is a finite number (and the grid an
// integer) and then passes the values through untouched, so the
// core's Japanese refusal reasons reach the screen verbatim.
export function buildConjugateCavityInput(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw Error('画面の条件はオブジェクトで指定してください。');
  }
  const take = (key) => {
    const v = fields[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw Error(`入力「${FIELD_LABELS[key]}」が数値ではありません。`);
    }
    return v;
  };
  const n = take('grid');
  if (!Number.isInteger(n)) {
    throw Error('入力「格子数n」が整数ではありません。');
  }
  return {
    n,
    rayleigh: take('rayleigh'),
    prandtl: take('prandtl'),
    conductivityRatio: take('conductivityRatio'),
    capacityRatio: take('capacityRatio'),
    source: take('source'),
    initialTemperature: take('initialTemperature'),
  };
}

// Colour-scale window for the dimensionless temperature.  The core
// itself monitors theta against [0, 1 + S(delta + delta^2/(2K))]
// with delta = 0.25 fixed, so the scale always covers the full
// admissible range of the current configuration.
export function displayTemperatureRange(input) {
  const bound = 1 + input.source * (0.25 + 0.25 * 0.25 / (2 * input.conductivityRatio));
  return [0, Math.max(1, bound)];
}

// Advance the coupled model by a dimensionless duration, subdividing
// into the core's own stable steps exactly as its runToSteady does
// (dt = min(safeDt, remaining)).  Returns the number of steps taken.
export function advanceModelBy(model, duration) {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    throw Error('進める無次元時間は正の数で指定してください。');
  }
  const target = model.time + duration;
  let steps = 0;
  while (model.time < target) {
    const dt = Math.min(model.safeDt, target - model.time);
    if (!(dt > 0)) break;
    model.advance(dt);
    steps++;
  }
  return steps;
}

// One interval of the steady criterion the core's runToSteady uses
// (Codex protocol): over an interval, max temperature change < 1e-7,
// relative velocity change < 1e-6 (scaled by max(1, max face speed),
// as in the core), relative interface-heat change < 1e-6.  The screen
// declares steadiness only after this passes on two consecutive
// intervals, again exactly as the core does.
export function intervalChanges(previous, current) {
  let maxTemperatureChange = 0;
  for (let i = 0; i < current.temperature.length; i++) {
    maxTemperatureChange = Math.max(maxTemperatureChange,
      Math.abs(current.temperature[i] - previous.temperature[i]));
  }
  let maxVelocityChange = 0, speedScale = 1;
  for (const key of ['u', 'v']) {
    const now = current[key], before = previous[key];
    for (let i = 0; i < now.length; i++) {
      maxVelocityChange = Math.max(maxVelocityChange, Math.abs(now[i] - before[i]));
      speedScale = Math.max(speedScale, Math.abs(now[i]));
    }
  }
  const relativeVelocityChange = maxVelocityChange / speedScale;
  const prevQ = previous.instantaneousPowers.interface;
  const relativeInterfaceHeatChange = Math.abs(current.instantaneousPowers.interface - prevQ)
    / Math.max(Math.abs(prevQ), 2.2250738585072014e-308);
  return {
    maxTemperatureChange,
    relativeVelocityChange,
    relativeInterfaceHeatChange,
    passes: maxTemperatureChange < 1e-7
      && relativeVelocityChange < 1e-6
      && relativeInterfaceHeatChange < 1e-6,
  };
}
