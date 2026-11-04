// Experimental high-order MAC momentum operators. Developer-only, not in the
// public build. Pressure projection and scalar transport retain their own order.
// Fluxes are interpolated once at shared centres/corners, then differentiated.
// Near a wall use the actual Dirichlet value, never an invented odd extension.
function stencil(nodes, at, derivative = 0) {
  return nodes.map((node, i) => {
    let polynomial = [1], denominator = 1;
    for (let j = 0; j < nodes.length; j++) if (j !== i) {
      const next = Array(polynomial.length + 1).fill(0);
      for (let k = 0; k < polynomial.length; k++) {
        next[k] += (at - nodes[j]) * polynomial[k];
        next[k + 1] += polynomial[k];
      }
      polynomial = next; denominator *= node - nodes[j];
    }
    return {node, weight: polynomial[derivative] * (derivative === 2 ? 2 : 1) / denominator};
  });
}
const range = (start, count, offset = 0) => Array.from({length: count}, (_, i) => start + i + offset);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sum = (s, read) => s.reduce((a, {node, weight}) => a + weight * read(node), 0);
function axis(n) {
  const normalInterpolation = range(0, n).map(i => stencil(range(clamp(i - 1, 0, n - 3), 4), i + .5));
  const cornerInterpolation = range(0, n + 1).map(i => i === 0 || i === n ? null : stencil(
    i === 1 ? [0, .5, 1.5, 2.5] : i === n - 1 ? [n - 2.5, n - 1.5, n - .5, n] : range(i - 2, 4, .5), i));
  const normalDerivative = range(0, n + 1).map(i => i === 0 || i === n ? null : stencil(
    i === 1 ? range(0, 5, .5) : i === n - 1 ? range(n - 5, 5, .5) : range(i - 2, 4, .5), i, 1));
  const tangentDerivative = range(0, n).map(i => stencil(
    i === 0 ? range(0, 5) : i === n - 1 ? range(n - 4, 5) : range(i - 1, 4), i + .5, 1));
  const normalLaplacian = range(0, n + 1).map(i => i === 0 || i === n ? null : stencil(
    i === 1 ? range(0, 6) : i === n - 1 ? range(n - 5, 6) : range(i - 2, 5), i, 2));
  const tangentLaplacian = range(0, n).map(i => stencil(
    i < 2 ? [0, ...range(0, 5, .5)] : i >= n - 2 ? [...range(n - 5, 5, .5), n] : range(i - 2, 5, .5), i + .5, 2));
  return {normalInterpolation, cornerInterpolation, normalDerivative, tangentDerivative, normalLaplacian, tangentLaplacian};
}

export function createMacMomentumStencil({nx, ny, dx, dy}) {
  if (![nx, ny].every(n => Number.isInteger(n) && n >= 8 && n <= 96) || ![dx, dy].every(h => Number.isFinite(h) && h > 0)) throw Error('高次MAC格子は8〜96、間隔は正の有限値です。');
  const x = axis(nx), y = axis(ny), U = (i, j) => j * (nx + 1) + i, V = (i, j) => j * nx + i;
  return {evaluate(u, v, lid = 0) {
    if (u.length !== (nx + 1) * ny || v.length !== nx * (ny + 1) || !Number.isFinite(lid) || [...u, ...v].some(a => !Number.isFinite(a))) throw Error('高次MAC速度の寸法/値が不正です。');
    const u2 = new Float64Array(nx * ny), v2 = new Float64Array(nx * ny), uv = new Float64Array((nx + 1) * (ny + 1));
    const uTangent = (i, pos) => pos === 0 ? 0 : pos === ny ? lid : u[U(i, pos - .5)];
    const vTangent = (pos, j) => pos === 0 || pos === nx ? 0 : v[V(pos - .5, j)];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      u2[j * nx + i] = sum(x.normalInterpolation[i], p => u[U(p, j)]) ** 2;
      v2[j * nx + i] = sum(y.normalInterpolation[j], p => v[V(i, p)]) ** 2;
    }
    for (let j = 1; j < ny; j++) for (let i = 1; i < nx; i++) uv[j * (nx + 1) + i] = sum(y.cornerInterpolation[j], p => uTangent(i, p)) * sum(x.cornerInterpolation[i], p => vTangent(p, j));
    const advectionU = new Float64Array(u.length), advectionV = new Float64Array(v.length), laplacianU = new Float64Array(u.length), laplacianV = new Float64Array(v.length);
    for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
      const k = U(i, j);
      advectionU[k] = sum(x.normalDerivative[i], p => u2[j * nx + p - .5]) / dx + sum(y.tangentDerivative[j], p => uv[p * (nx + 1) + i]) / dy;
      laplacianU[k] = sum(x.normalLaplacian[i], p => u[U(p, j)]) / dx ** 2 + sum(y.tangentLaplacian[j], p => uTangent(i, p)) / dy ** 2;
    }
    for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = V(i, j);
      advectionV[k] = sum(x.tangentDerivative[i], p => uv[j * (nx + 1) + p]) / dx + sum(y.normalDerivative[j], p => v2[(p - .5) * nx + i]) / dy;
      laplacianV[k] = sum(x.tangentLaplacian[i], p => vTangent(p, j)) / dx ** 2 + sum(y.normalLaplacian[j], p => v[V(i, p)]) / dy ** 2;
    }
    return {advectionU, advectionV, laplacianU, laplacianV};
  }};
}
