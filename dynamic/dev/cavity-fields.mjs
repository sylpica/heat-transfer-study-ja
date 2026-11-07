// Inspection of one frozen MAC velocity field, not another flow solver.
export function createMacVelocityField(mesh, state, {lidVelocity = 0} = {}) {
  const {nx, ny, width, height} = mesh || {};
  if (![nx, ny].every(n => Number.isInteger(n) && n >= 2 && n <= 96) || ![width, height, width / nx, height / ny].every(x => Number.isFinite(x) && x > 0) || !Number.isFinite(lidVelocity)) throw Error('速度表示の格子/壁速度が不正です。');
  if (state?.u?.length !== (nx + 1) * ny || state?.v?.length !== nx * (ny + 1) || [...state.u, ...state.v].some(x => !Number.isFinite(x))) throw Error('MAC速度の寸法/値が不正です。');
  const u = Float64Array.from(state.u), v = Float64Array.from(state.v);
  function at(x, y) {
    if (![x, y].every(Number.isFinite) || x < 0 || x > width || y < 0 || y > height) throw Error('測定点が速度場の範囲外です。');
    if (lidVelocity !== 0 && y === height && (x === 0 || x === width)) throw Error('移動壁と静止壁が接する角の速度は一意に定義できません。');
    const xx = x / width * nx, yy = y / height * ny;
    const i = Math.min(nx - 1, Math.floor(xx)), fx = xx - i, j = Math.min(ny - 1, Math.floor(yy)), fy = yy - j;
    const ur = row => (1 - fx) * u[row * (nx + 1) + i] + fx * u[row * (nx + 1) + i + 1];
    const vc = col => (1 - fy) * v[j * nx + col] + fy * v[(j + 1) * nx + col];
    let ux, vy;
    if (yy <= .5) ux = 2 * yy * ur(0);
    else if (yy >= ny - .5) ux = (2 * (ny - yy)) * ur(ny - 1) + (1 - 2 * (ny - yy)) * (x === 0 || x === width ? 0 : lidVelocity);
    else {const row = Math.floor(yy - .5), f = yy - .5 - row; ux = (1 - f) * ur(row) + f * ur(row + 1);}
    if (xx <= .5) vy = 2 * xx * vc(0);
    else if (xx >= nx - .5) vy = 2 * (nx - xx) * vc(nx - 1);
    else {const col = Math.floor(xx - .5), f = xx - .5 - col; vy = (1 - f) * vc(col) + f * vc(col + 1);}
    return [ux, vy];
  }
  return Object.freeze({width, height, dx: width / nx, dy: height / ny, at});
}

export function traceFrozenStreamline(field, seed, {direction = 1, stepLength = .3 * Math.min(field.dx, field.dy), maxLength = 10 * Math.hypot(field.width, field.height), maxPoints = 1500, minSpeed = 1e-12} = {}) {
  if (!Array.isArray(seed) || seed.length !== 2 || ![stepLength, maxLength, minSpeed].every(x => Number.isFinite(x) && x > 0) || ![1, -1].includes(direction) || !Number.isInteger(maxPoints) || maxPoints < 2 || maxPoints > 5000) throw Error('流線の始点/刻み/上限が不正です。');
  field.at(...seed); // Validate the starting point before constructing a trace.
  const points = [[...seed]], inside = p => p[0] >= 0 && p[0] <= field.width && p[1] >= 0 && p[1] <= field.height;
  let length = 0, stopped = 'point-limit';
  function tangent(p) {
    if (!inside(p)) return {stop: 'boundary'};
    const [u, v] = field.at(...p), speed = Math.hypot(u, v);
    if (!Number.isFinite(speed)) throw Error('流線の速度が数値範囲を超えています。');
    return speed < minSpeed ? {stop: 'stagnation'} : {vector: [direction * u / speed, direction * v / speed]};
  }
  while (points.length < maxPoints) {
    const p = points.at(-1), h = Math.min(stepLength, maxLength - length);
    if (h <= 0) {stopped = 'length-limit'; break;}
    const a = tangent(p); if (a.stop) {stopped = a.stop; break;}
    const b = tangent(p.map((x, i) => x + h / 2 * a.vector[i])); if (b.stop) {stopped = b.stop; break;}
    const c = tangent(p.map((x, i) => x + h / 2 * b.vector[i])); if (c.stop) {stopped = c.stop; break;}
    const d = tangent(p.map((x, i) => x + h * c.vector[i])); if (d.stop) {stopped = d.stop; break;}
    const next = p.map((x, i) => x + h / 6 * (a.vector[i] + 2 * b.vector[i] + 2 * c.vector[i] + d.vector[i]));
    if (!inside(next)) {stopped = 'boundary'; break;}
    const distance = Math.hypot(next[0] - p[0], next[1] - p[1]);
    if (!Number.isFinite(distance) || distance < Number.EPSILON * Math.max(field.width, field.height)) {stopped = 'no-progress'; break;}
    length += distance; points.push(next);
    if (length >= maxLength * (1 - 1e-12)) {stopped = 'length-limit'; break;}
    if (length > stepLength * 10 && Math.hypot(next[0] - seed[0], next[1] - seed[1]) < stepLength / 2) {stopped = 'closed'; break;}
  }
  return {points, length, stopped, interpretation: 'instantaneous streamline of a frozen interpolated velocity field; not a particle path or an additional PDE solution'};
}
