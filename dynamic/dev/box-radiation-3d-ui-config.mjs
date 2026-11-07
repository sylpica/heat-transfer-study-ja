// Screen configuration for the 3D box radiation development page.
// Pure data and pure helpers only (no DOM), so the Node suite can verify
// that the screen's presets and input builder pass exactly the keys
// box-radiation-3d.mjs accepts and reproduce its verified cases (the
// gray box 2x1x3 of docs/dynamic/BOX_RADIATION_3D_REFERENCE_20261107.json,
// the isothermal blackbody cube, and the flat box whose resolution the
// connector escalates).  No physics lives here: every number the screen
// shows comes from the connector module itself.

// Face order is the kernel's: bottom (z=0), top (z=Z), front (y=0),
// back (y=Y), left (x=0), right (x=X).
export const BOX_FACE_DEFS = Object.freeze([
 {id: 'bottom', name: '下面', note: 'z=0'},
 {id: 'top', name: '上面', note: 'z=Z'},
 {id: 'front', name: '前面', note: 'y=0'},
 {id: 'back', name: '背面', note: 'y=Y'},
 {id: 'left', name: '左面', note: 'x=0'},
 {id: 'right', name: '右面', note: 'x=X'},
]);

// Explicit integration resolutions the screen offers, in the connector's
// own key names.  'auto' passes no integration key at all, so the
// connector escalates its ladder until the network admission (1e-12)
// holds; an explicit key is used exactly and refused when under-resolved.
export const BOX_RESOLUTION_OPTIONS = Object.freeze({
 auto: null,
 low: Object.freeze({separationPanels: 10, polarPanels: 16, gaussOrder: 6}),
 mid: Object.freeze({separationPanels: 20, polarPanels: 32, gaussOrder: 7}),
 high: Object.freeze({separationPanels: 32, polarPanels: 48, gaussOrder: 8}),
 max: Object.freeze({separationPanels: 64, polarPanels: 64, gaussOrder: 8}),
});

export const BOX_RESOLUTION_LABELS = Object.freeze({
 auto: '自動（受入精度まで自動で引上げ）',
 low: '明示：低（分離10・極16・ガウス6）',
 mid: '明示：中（分離20・極32・ガウス7）',
 high: '明示：高（分離32・極48・ガウス8）',
 max: '明示：最高（分離64・極64・ガウス8）',
});

const face = (temperature, emissivity, capacity) => ({temperature, emissivity, capacity, inputKind: 'none', inputValue: 0});

export const BOX_RADIATION_GUI_PRESETS = Object.freeze({
 gray: Object.freeze({
  label: '灰色箱 2×1×3（検証済みの参照ケース）',
  dimensions: {x: 2, y: 1, z: 3}, maxTemperature: 700, resolutionKey: 'auto', intervalSeconds: 60,
  faces: [[600, .8], [300, .6], [400, .9], [350, .5], [500, .7], [450, 1]].map(([t, e]) => face(t, e, 2e5)),
 }),
 iso: Object.freeze({
  label: '等温黒体立方体（交換は厳密にゼロ）',
  dimensions: {x: 1, y: 1, z: 1}, maxTemperature: 2000, resolutionKey: 'auto', intervalSeconds: 10,
  faces: Array.from({length: 6}, () => face(400, 1, 2e5)),
 }),
 flat: Object.freeze({
  label: '扁平箱 1×1×0.001（解像度の自動引上げ／明示・低では拒否）',
  dimensions: {x: 1, y: 1, z: 0.001}, maxTemperature: 2000, resolutionKey: 'auto', intervalSeconds: 10,
  faces: Array.from({length: 6}, () => face(300, .8, 2e5)),
 }),
});

export const fmt10 = v => String(Number(v.toPrecision(10)));
export const fmtFixed = (v, d = 4) => v === null || v === undefined || !Number.isFinite(v) ? '—' : Number(v).toFixed(d);
export const fmtPower = v => v !== 0 && Math.abs(v) < 1e-5 ? v.toExponential(3) : Number(v).toFixed(6);

// Builds exactly the input createBoxRadiation3D accepts from the screen's
// plain values.  Numbers must already be numbers (the UI reads
// valueAsNumber); a non-finite value is a screen-level error.  Every
// physical refusal (emissivity range, admission, ...) is the connector's
// own Japanese message, passed through untouched by the UI.
export function buildBoxRadiationInput(values) {
 const num = (v, label) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw Error(`入力に数値でない項目があります（${label}）。`);
  return v;
 };
 if (!values || !Array.isArray(values.faces) || values.faces.length !== 6) throw Error('6面すべての条件を指定してください。');
 const dimensions = {
  x: num(values.dimensions?.x, 'x寸法'),
  y: num(values.dimensions?.y, 'y寸法'),
  z: num(values.dimensions?.z, 'z寸法'),
 };
 const faces = values.faces.map((f, i) => {
  const def = BOX_FACE_DEFS[i];
  const built = {
   temperature: num(f?.temperature, `${def.name}の温度`),
   emissivity: num(f?.emissivity, `${def.name}の放射率`),
   capacity: num(f?.capacity, `${def.name}の熱容量`),
  };
  if (f?.inputKind === 'power') built.power = num(f.inputValue, `${def.name}の外部入力`);
  else if (f?.inputKind === 'heatFlux') built.heatFlux = num(f.inputValue, `${def.name}の外部入力`);
  else if (f?.inputKind !== 'none') throw Error(`${def.name}の外部入力の種類が不正です。`);
  return built;
 });
 const input = {dimensions, faces, maxTemperature: num(values.maxTemperature, '監視上限温度')};
 const resolution = BOX_RESOLUTION_OPTIONS[values.resolutionKey];
 if (resolution === undefined) throw Error('積分解像度の指定が不正です。');
 if (resolution) input.integration = {...resolution};
 return input;
}

// Splits one displayed frame into connector steps of at most safeDt.
// Returns the substep count and the equal substep width; the caller steps
// that many times and keeps the connector's own snapshot as the frame.
export function frameSteps(duration, safeDt) {
 if (!Number.isFinite(duration) || duration <= 0) throw Error('1コマの物理時間は正の数で指定してください。');
 if (!Number.isFinite(safeDt) || safeDt <= 0) throw Error('安定刻みが不正です。');
 const count = Math.max(1, Math.ceil(duration / safeDt));
 if (count > 100000) throw Error('1コマが長すぎます（安定刻みに対する細分が10万回を超えます）。1コマの物理時間を短くしてください。');
 return {count, dt: duration / count};
}
