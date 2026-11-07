// Development-only handoff from the wind heat-transfer estimation screen
// to the heat-sink screen.  The estimated h and the conditions it was
// computed from travel as allowlisted URL query parameters (the same
// launch style as dynamic-navigation.mjs), so the receiving screen can
// show where its prescribed h came from even after a reload.  Nothing is
// written to storage, and neither model's core is touched: the heat-sink
// screen still receives h through its ordinary prescribed-h input field.
const KEYS = ['wh', 'wc', 'wg', 'wv', 'wl', 'wre', 'wpr', 'wnu', 'wtf', 'wts', 'wtinf'];

export const WIND_HANDOFF_CORRELATIONS = Object.freeze({
  '6.68': '式(6.68)（平板・層流の平均）',
  '6.69': '式(6.69)（平板・液体金属の平均）',
  '6.120': '式(6.120)（3領域平均・観測遷移、気体）',
  '6.120-abrupt': '式(6.120)の例題6.11による縮約（急峻遷移、気体）',
  '6.120-abrupt-liquid': '式(6.113)から導出した急峻遷移形（液体）',
  '7.65': '式(7.65)（Churchill–Bernstein全体式、円柱横流れ）',
  '7.66': '式(7.66)（円柱横流れ）',
  '7.67': '式(7.67)（Nakai–Okazaki、円柱横流れ）',
  '7.68': '式(7.68)（円柱横流れ）',
});

export const WIND_HANDOFF_GEOMETRIES = Object.freeze({
  'flat-plate': '平板',
  'cylinder': '円柱（横流れ）',
  'fin-plate': '平板フィン面',
  'fin-pin': 'ピンフィン面',
});

const numberText = (value, name) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    throw Error(`受け渡し条件の${name}が数値範囲外です。`);
  return String(value);
};

// Build the heat-sink screen URL carrying one estimation record and the
// input conditions it came from.  Numbers are serialized with String(),
// the shortest round-trip form, so the parsed h is bit-identical.
export function windHeatSinkHandoffHref(estimate, input) {
  if (!estimate || typeof estimate !== 'object' || Array.isArray(estimate) ||
      !input || typeof input !== 'object' || Array.isArray(input))
    throw Error('受け渡しには推定記録と入力条件が必要です。');
  if (!Object.hasOwn(WIND_HANDOFF_CORRELATIONS, estimate.correlation))
    throw Error('受け渡しに対応していない相関式の推定記録です。');
  if (!Object.hasOwn(WIND_HANDOFF_GEOMETRIES, estimate.geometry))
    throw Error('受け渡しに対応していない形状の推定記録です。');
  const params = new URLSearchParams({
    wh: numberText(estimate.h, '熱伝達率h'),
    wc: estimate.correlation,
    wg: estimate.geometry,
    wv: numberText(input.velocity, '主流速度'),
    wl: numberText(input.characteristicLength, '代表長さ'),
    wre: numberText(estimate.reynolds, 'Reynolds数'),
    wpr: numberText(estimate.prandtl, 'Prandtl数'),
    wnu: numberText(estimate.nusselt, 'Nusselt数'),
    wtf: numberText(estimate.filmTemperatureK, '膜温度'),
    wts: numberText(input.surfaceTemperature, '表面温度'),
    wtinf: numberText(input.freeStreamTemperature, '主流温度'),
  });
  return `./heat-sink.html?${params}`;
}

const NUMBER_PATTERN = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const positiveNumber = (params, key, name) => {
  const raw = params.get(key);
  if (raw === null || !NUMBER_PATTERN.test(raw))
    throw Error(`風速推定の受け渡し条件（${name}）の形式に対応していません。`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0)
    throw Error(`風速推定の受け渡し条件（${name}）が数値範囲外です。`);
  return value;
};

// Parse a heat-sink screen query string.  Returns null when the URL
// carries no parameters at all (an ordinary open); anything else must be
// exactly the allowlisted handoff set, each key exactly once.
export function windHandoffFromSearch(search) {
  const params = new URLSearchParams(search);
  if (![...params.keys()].length) return null;
  if ([...params.keys()].some(key => !KEYS.includes(key) || params.getAll(key).length !== 1) ||
      KEYS.some(key => !params.has(key)))
    throw Error('風速推定の受け渡し条件の形式に対応していません。');
  const correlation = params.get('wc'), geometry = params.get('wg');
  if (!Object.hasOwn(WIND_HANDOFF_CORRELATIONS, correlation))
    throw Error('風速推定の受け渡し条件（相関式）に対応していません。');
  if (!Object.hasOwn(WIND_HANDOFF_GEOMETRIES, geometry))
    throw Error('風速推定の受け渡し条件（形状）に対応していません。');
  return {
    h: positiveNumber(params, 'wh', '熱伝達率h'),
    correlation, geometry,
    velocity: positiveNumber(params, 'wv', '主流速度'),
    characteristicLength: positiveNumber(params, 'wl', '代表長さ'),
    reynolds: positiveNumber(params, 'wre', 'Reynolds数'),
    prandtl: positiveNumber(params, 'wpr', 'Prandtl数'),
    nusselt: positiveNumber(params, 'wnu', 'Nusselt数'),
    filmTemperatureK: positiveNumber(params, 'wtf', '膜温度'),
    surfaceTemperature: positiveNumber(params, 'wts', '表面温度'),
    freeStreamTemperature: positiveNumber(params, 'wtinf', '主流温度'),
  };
}
