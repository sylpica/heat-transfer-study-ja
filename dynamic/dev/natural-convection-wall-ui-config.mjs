// Screen configuration for the vertical-wall natural-convection
// development page.  Pure data and pure helpers only (no DOM), so the
// Node suite can verify that the screen's presets and input builders
// reproduce the verified core cases in
// docs/dynamic/NATURAL_CONVECTION_WALL_REFERENCE_20261107.json and
// pass exactly the keys natural-convection-wall.mjs accepts.
//
// Presets are the textbook cases the core was verified against
// (Example 8.1, Example 8.3 and the uniform-heat-flux reference case),
// with the book's own inputs including g = 9.8.  No new property fit
// is introduced here; properties stay user-supplied film-temperature
// values, exactly as the core prescribes.

export const WALL_KINDS = ['isothermal', 'uniform-flux'];

export const WALL_GUI_PRESETS = {
  ex81: {
    label: '例題8.1：等温壁（空気、相似解と式8.13a）',
    wallKind: 'isothermal',
    fields: {
      wallTemperatureK: 323.15, ambientTemperatureK: 293.15, lengthM: 0.30,
      betaPerK: 0.00325, kinematicViscosityM2PerS: 1.643e-5,
      thermalDiffusivityM2PerS: 2.315e-5, thermalConductivityWPerMK: 0.02672,
      gravityMPerS2: 9.8,
    },
  },
  ex83: {
    label: '例題8.3：等温壁（空気、式8.27と最大速度）',
    wallKind: 'isothermal',
    fields: {
      wallTemperatureK: 313.15, ambientTemperatureK: 287.15, lengthM: 0.40,
      betaPerK: 0.00333, kinematicViscosityM2PerS: 1.578e-5,
      thermalDiffusivityM2PerS: 2.213e-5, thermalConductivityWPerMK: 0.02623,
      gravityMPerS2: 9.8,
    },
  },
  uhf: {
    label: '一様熱流束の参照ケース（式8.44b）',
    wallKind: 'uniform-flux',
    fields: {
      heatFluxWPerM2: 100, ambientTemperatureK: 300.15, lengthM: 0.40,
      betaPerK: 0.00333, kinematicViscosityM2PerS: 1.578e-5,
      thermalDiffusivityM2PerS: 2.213e-5, thermalConductivityWPerMK: 0.02623,
      gravityMPerS2: 9.8,
    },
  },
};

const FIELD_LABELS = {
  wallTemperatureK: '壁温',
  heatFluxWPerM2: '壁熱流束',
  ambientTemperatureK: '周囲温度',
  lengthM: '壁の高さ',
  betaPerK: '熱膨張係数β',
  kinematicViscosityM2PerS: '動粘度ν',
  thermalDiffusivityM2PerS: '温度拡散率α',
  thermalConductivityWPerMK: '熱伝導率k',
  gravityMPerS2: '重力加速度g',
};

function takeFields(fields, keys) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw Error('画面の条件はオブジェクトで指定してください。');
  }
  const out = {};
  for (const key of keys) {
    const v = fields[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw Error(`入力「${FIELD_LABELS[key]}」が数値ではありません。`);
    }
    out[key] = v;
  }
  return out;
}

const PROPERTY_KEYS = [
  'ambientTemperatureK', 'lengthM', 'betaPerK', 'kinematicViscosityM2PerS',
  'thermalDiffusivityM2PerS', 'thermalConductivityWPerMK', 'gravityMPerS2',
];

// Build exactly the input object naturalConvectionVerticalWall accepts.
export function buildIsothermalWallInput(fields) {
  return takeFields(fields, ['wallTemperatureK', ...PROPERTY_KEYS]);
}

// Build exactly the input object uniformHeatFluxVerticalWall accepts.
export function buildUniformFluxWallInput(fields) {
  return takeFields(fields, ['heatFluxWPerM2', ...PROPERTY_KEYS]);
}

// Wall-temperature distribution for the uniform-flux wall, from the
// textbook profile (8.40): dT(x) = dT(L) * (x/L)^(1/5), whose mean is
// (8.41).  Returns normalized positions and temperature differences;
// the caller adds the ambient temperature when absolute values are
// wanted.  This is a display of the printed profile, not a new model.
export function uniformFluxWallTemperatureProfile(result, count = 41) {
  if (!Number.isInteger(count) || count < 2 || count > 1001) {
    throw Error('プロファイルの点数は2〜1001で指定してください。');
  }
  const top = result.topDeltaTK;
  if (typeof top !== 'number' || !Number.isFinite(top)) {
    throw Error('上端温度差が数値ではありません。');
  }
  const xOverL = []; const deltaTK = [];
  for (let i = 0; i < count; i++) {
    const s = i / (count - 1);
    xOverL.push(s);
    deltaTK.push(top * s ** 0.2);
  }
  return {xOverL, deltaTK};
}

// Display window for the isothermal boundary-layer profiles at x = L.
// The similarity profile arrays run to etaMax (30-40), far beyond the
// layer itself; plotting the whole range would squash the profiles
// into a sliver at the wall.  The window ends at the first point where
// both the temperature has decayed to theta <= 0.01 and the velocity
// to 2% of its peak, plus one point of headroom.  Pure selection on
// the core's returned arrays; nothing is recomputed.
export function boundaryLayerProfileWindow(profileAtTop, ambientTemperatureK, deltaTK) {
  const {yM, velocityMPerS, temperatureK} = profileAtTop;
  const n = yM.length;
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(velocityMPerS[i]));
  let end = n - 1;
  for (let i = 1; i < n; i++) {
    const theta = (temperatureK[i] - ambientTemperatureK) / deltaTK;
    if (theta <= 0.01 && Math.abs(velocityMPerS[i]) <= 0.02 * peak) {
      end = Math.min(n - 1, i + 1);
      break;
    }
  }
  return {
    yLimitM: yM[end],
    endIndex: end,
    yM: yM.slice(0, end + 1),
    velocityMPerS: velocityMPerS.slice(0, end + 1),
    temperatureK: temperatureK.slice(0, end + 1),
  };
}
