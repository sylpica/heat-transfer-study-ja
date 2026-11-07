// Development-only laminar natural-convection model for a vertical
// isothermal plate, plus the textbook uniform-heat-flux average
// correlation.  All results follow A Heat Transfer Textbook, 6th ed.
// (Lienhard), Chapter 8:
//
//   Nusselt, Prandtl and Grashof numbers                     (8.9)
//   Rayleigh number  Ra_L = Gr_L Pr = g beta dT L^3/(nu alpha) (8.11)
//   Churchill-Chu laminar average correlation                (8.13a)
//   Squire-Eckert local / average Nusselt numbers      (8.26) / (8.27)
//
// The primary model is the exact similarity (Ostrach) solution of the
// laminar boundary-layer equations of section 8.3.  With
//   eta = (y/x)(Gr_x/4)^(1/4),  psi = 4 nu (Gr_x/4)^(1/4) f(eta),
//   theta = (T - Tinf)/(Tw - Tinf),
// the boundary-layer equations reduce to
//   f''' + 3 f f'' - 2 (f')^2 + theta = 0,
//   theta'' + 3 Pr f theta' = 0,
//   f(0) = f'(0) = 0, theta(0) = 1, f'(inf) = theta(inf) = 0,
// which this module solves by trapezoidal collocation with Newton
// iteration (mesh sequencing and continuation in Pr; single shooting
// is not used because the initial-value problem has a narrow basin
// and finite-eta blow-up for off-solution guesses).  Local and
// average Nusselt numbers follow as
//   Nu_x = -theta'(0) (Gr_x/4)^(1/4),   Nu_L = (4/3) Nu_x at x = L.
// The solution is the one whose profiles the textbook compares with
// the Squire-Eckert polynomials in Fig. 8.4 (Schmidt-Beckmann).
//
// Uniform wall heat flux is handled only through the correlations the
// textbook prints for it: the modified Rayleigh number (8.42) and the
// Raithby-Hollands average (8.44b), with the wall temperature profile
// dT = C x^(1/5) and its mean (8.40)-(8.41).  The printed local
// correlation (8.44a) is NOT used: as printed it disagrees with
// (8.44b) plus (8.40)-(8.41) by its own leading coefficient 0.630,
// while (8.44b) agrees with the independent Churchill-Chu form
// (8.43b) within about 2% (see the development document).
//
// Accepted ranges are the ranges verified for this module:
//   0.1 <= Pr <= 100 and 1e4 <= Ra_L <= 1e9 (laminar; the textbook
//   limits the laminar treatment to Ra_L <~ 1e9).  Anything outside is
//   rejected with a Japanese reason; nothing is extrapolated.
// Properties are user-supplied values at the film temperature
// Tf = (Tw + Tinf)/2, exactly as the textbook prescribes.  The
// turbulent correlation (8.13b), inclined/horizontal plates, vertical
// cylinders and enclosures are out of scope.

const LAW = 'natural-convection-vertical-wall-v1';
const PR_MIN = 0.1;
const PR_MAX = 100;
const RA_MIN = 1e4;
const RA_MAX = 1e9;
const DEFAULT_GRAVITY = 9.80665;

const finite = (v, name, positive = false) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || (positive && v <= 0)) {
    throw Error(`${name}が数値範囲外です。`);
  }
  return v;
};

function checkObject(input, what) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Error(`${what}はオブジェクトで指定してください。`);
  }
  return structuredClone(input);
}

function checkKeys(c, allowed) {
  if (Object.keys(c).some((key) => !allowed.has(key))) {
    throw Error('未対応の物理条件を暗黙に無視しません。');
  }
}

function checkProperties(c) {
  finite(c.betaPerK, '熱膨張係数β', true);
  finite(c.kinematicViscosityM2PerS, '動粘度ν', true);
  finite(c.thermalDiffusivityM2PerS, '温度拡散率α', true);
  finite(c.thermalConductivityWPerMK, '熱伝導率k', true);
  const gravity = c.gravityMPerS2 === undefined
    ? DEFAULT_GRAVITY : finite(c.gravityMPerS2, '重力加速度g', true);
  const prandtl = finite(
    c.kinematicViscosityM2PerS / c.thermalDiffusivityM2PerS, 'Prandtl数', true);
  if (prandtl < PR_MIN || prandtl > PR_MAX) {
    throw Error(`Pr=${prandtl}は本モジュールの検証済み範囲（Pr=${PR_MIN}〜${PR_MAX}）の外です。範囲外の相似解は検証していないため計算しません。`);
  }
  return {gravity, prandtl};
}

// ---------------------------------------------------------------------
// Similarity solver (Ostrach form).  State y = [f, f', f'', theta, theta'].
// Trapezoidal collocation on a uniform eta grid with Newton iteration.
// The Newton correction is propagated node by node as an affine map in
// the two free wall values (f''(0), theta'(0)), so no large banded
// system is ever formed.  Solutions are reached by mesh sequencing and,
// when the Prandtl number is far from 1, by continuation in Pr.
// Headline scalars are Richardson-extrapolated from the two finest
// grids (the trapezoidal rule is second order).
// ---------------------------------------------------------------------

function similarityRhs(prandtl, y, out) {
  const F = y[0]; const U = y[1]; const V = y[2]; const T = y[3]; const W = y[4];
  out[0] = U;
  out[1] = V;
  out[2] = 2 * U * U - 3 * F * V - T;
  out[3] = W;
  out[4] = -3 * prandtl * F * W;
}

// Solve a 5x5 linear system A x = B (B has nrhs columns) by Gaussian
// elimination with partial pivoting.  A and B are flat row-major arrays;
// returns x as a flat array with the same layout as B.
function solve5(Ain, Bin, nrhs) {
  const A = Float64Array.from(Ain);
  const B = Float64Array.from(Bin);
  for (let col = 0; col < 5; col++) {
    let piv = col;
    for (let r = col + 1; r < 5; r++) {
      if (Math.abs(A[r * 5 + col]) > Math.abs(A[piv * 5 + col])) piv = r;
    }
    if (Math.abs(A[piv * 5 + col]) < 1e-300) throw Error('相似解の線形系が特異です。');
    if (piv !== col) {
      for (let c = col; c < 5; c++) {
        const t = A[col * 5 + c]; A[col * 5 + c] = A[piv * 5 + c]; A[piv * 5 + c] = t;
      }
      for (let c = 0; c < nrhs; c++) {
        const t = B[col * nrhs + c]; B[col * nrhs + c] = B[piv * nrhs + c]; B[piv * nrhs + c] = t;
      }
    }
    for (let r = col + 1; r < 5; r++) {
      const factor = A[r * 5 + col] / A[col * 5 + col];
      if (factor === 0) continue;
      for (let c = col; c < 5; c++) A[r * 5 + c] -= factor * A[col * 5 + c];
      for (let c = 0; c < nrhs; c++) B[r * nrhs + c] -= factor * B[col * nrhs + c];
    }
  }
  const x = new Float64Array(5 * nrhs);
  for (let row = 4; row >= 0; row--) {
    for (let c = 0; c < nrhs; c++) {
      let s = B[row * nrhs + c];
      for (let k = row + 1; k < 5; k++) s -= A[row * 5 + k] * x[k * nrhs + c];
      x[row * nrhs + c] = s / A[row * 5 + row];
    }
  }
  return x;
}

// Collocation residual: max |interval residual| over the grid.
function collocationResidual(prandtl, y, n, h) {
  const Fi = new Float64Array(5); const Fj = new Float64Array(5);
  let worst = 0;
  for (let i = 0; i < n; i++) {
    similarityRhs(prandtl, y.subarray(i * 5, i * 5 + 5), Fi);
    similarityRhs(prandtl, y.subarray((i + 1) * 5, (i + 1) * 5 + 5), Fj);
    for (let c = 0; c < 5; c++) {
      const r = y[(i + 1) * 5 + c] - y[i * 5 + c] - 0.5 * h * (Fi[c] + Fj[c]);
      if (Math.abs(r) > worst) worst = Math.abs(r);
    }
  }
  return worst;
}

// One Newton solve of the collocation system at fixed (prandtl, n).
// y is a Float64Array(5*(n+1)) initial guess, modified in place.
function collocationNewton(prandtl, y, n, etaMax) {
  const h = etaMax / n;
  const Fi = new Float64Array(5); const Fj = new Float64Array(5);
  for (let iter = 0; iter < 40; iter++) {
    const residual = collocationResidual(prandtl, y, n, h);
    if (residual < 1e-12) return true;
    // Affine propagation of the correction: dy_i = p_i + Q_i z, where
    // z = (dy at f''(0), dy at theta'(0)); p, Q stored per node.
    const p = new Float64Array(5 * (n + 1));
    const Q = new Float64Array(10 * (n + 1));
    // Node 0: f, u, theta are pinned by the boundary conditions.
    p[0] = -y[0]; p[1] = -y[1]; p[2] = 0; p[3] = 1 - y[3]; p[4] = 0;
    // Q layout per node: Q[(node*2 + j)*5 + c] = d(dy_c)/dz_j.
    Q[(0 * 2 + 0) * 5 + 2] = 1; // d(d f''(0))/dz0
    Q[(0 * 2 + 1) * 5 + 4] = 1; // d(d theta'(0))/dz1
    let singular = false;
    for (let i = 0; i < n && !singular; i++) {
      const yi = y.subarray(i * 5, i * 5 + 5);
      const yj = y.subarray((i + 1) * 5, (i + 1) * 5 + 5);
      similarityRhs(prandtl, yi, Fi);
      similarityRhs(prandtl, yj, Fj);
      // A = -I - (h/2) DF(y_i), B = I - (h/2) DF(y_{i+1}).
      const dfAt = (yy) => {
        const F = yy[0]; const U = yy[1]; const V = yy[2]; const W = yy[4];
        return [
          0, 1, 0, 0, 0,
          0, 0, 1, 0, 0,
          -3 * V, 4 * U, -3 * F, -1, 0,
          0, 0, 0, 0, 1,
          -3 * prandtl * W, 0, 0, 0, -3 * prandtl * F,
        ];
      };
      const DFi = dfAt(yi); const DFj = dfAt(yj);
      const A = new Float64Array(25); const B = new Float64Array(25);
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          A[r * 5 + c] = -(r === c ? 1 : 0) - 0.5 * h * DFi[r * 5 + c];
          B[r * 5 + c] = (r === c ? 1 : 0) - 0.5 * h * DFj[r * 5 + c];
        }
      }
      // Interval residual R_i.
      const R = new Float64Array(5);
      for (let c = 0; c < 5; c++) {
        R[c] = yj[c] - yi[c] - 0.5 * h * (Fi[c] + Fj[c]);
      }
      // RHS columns: [-R - A p_i, -A Q_i(:,0), -A Q_i(:,1)].
      const rhs = new Float64Array(15);
      for (let r = 0; r < 5; r++) {
        let ap = 0; let aq0 = 0; let aq1 = 0;
        for (let c = 0; c < 5; c++) {
          ap += A[r * 5 + c] * p[i * 5 + c];
          aq0 += A[r * 5 + c] * Q[(i * 2 + 0) * 5 + c];
          aq1 += A[r * 5 + c] * Q[(i * 2 + 1) * 5 + c];
        }
        rhs[r * 3 + 0] = -R[r] - ap;
        rhs[r * 3 + 1] = -aq0;
        rhs[r * 3 + 2] = -aq1;
      }
      let sol;
      try {
        sol = solve5(B, rhs, 3);
      } catch {
        singular = true;
        break;
      }
      for (let c = 0; c < 5; c++) {
        p[(i + 1) * 5 + c] = sol[c * 3 + 0];
        Q[((i + 1) * 2 + 0) * 5 + c] = sol[c * 3 + 1];
        Q[((i + 1) * 2 + 1) * 5 + c] = sol[c * 3 + 2];
      }
    }
    if (singular) return false;
    // Terminal conditions u(etaMax) = 0, theta(etaMax) = 0 fix z:
    // Q z = -(current terminal value + particular correction).
    const pu = p[n * 5 + 1]; const pt = p[n * 5 + 3];
    const q00 = Q[(n * 2 + 0) * 5 + 1]; const q01 = Q[(n * 2 + 1) * 5 + 1];
    const q10 = Q[(n * 2 + 0) * 5 + 3]; const q11 = Q[(n * 2 + 1) * 5 + 3];
    const det = q00 * q11 - q01 * q10;
    if (!Number.isFinite(det) || det === 0) return false;
    const ru = -(y[n * 5 + 1] + pu);
    const rt = -(y[n * 5 + 3] + pt);
    const z0 = (ru * q11 - q01 * rt) / det;
    const z1 = (q00 * rt - ru * q10) / det;
    const dy = new Float64Array(5 * (n + 1));
    let maxCorr = 0;
    for (let i = 0; i <= n; i++) {
      for (let c = 0; c < 5; c++) {
        const d = p[i * 5 + c]
          + Q[(i * 2 + 0) * 5 + c] * z0 + Q[(i * 2 + 1) * 5 + c] * z1;
        dy[i * 5 + c] = d;
        if (Math.abs(d) > maxCorr) maxCorr = Math.abs(d);
      }
    }
    // Damped update: accept the largest fraction that lowers the residual.
    let accepted = false;
    for (let damp = 1; damp >= 1 / 32; damp /= 2) {
      const trial = Float64Array.from(y);
      for (let idx = 0; idx < y.length; idx++) trial[idx] += damp * dy[idx];
      const trialResidual = collocationResidual(prandtl, trial, n, h);
      if (Number.isFinite(trialResidual) && trialResidual < residual) {
        y.set(trial);
        accepted = true;
        break;
      }
    }
    if (!accepted) return residual < 1e-10;
    if (maxCorr < 1e-13) return true;
  }
  return collocationResidual(prandtl, y, n, h) < 1e-10;
}

// Linear-interpolation prolongation of a solution to a finer grid.
function prolongate(y, nFrom, nTo, etaMax) {
  const out = new Float64Array(5 * (nTo + 1));
  const hFrom = etaMax / nFrom;
  for (let i = 0; i <= nTo; i++) {
    const eta = (etaMax / nTo) * i;
    const pos = eta / hFrom;
    const i0 = Math.min(nFrom - 1, Math.floor(pos));
    const frac = pos - i0;
    for (let c = 0; c < 5; c++) {
      out[i * 5 + c] = y[i0 * 5 + c] * (1 - frac) + y[(i0 + 1) * 5 + c] * frac;
    }
  }
  // The wall values are pinned exactly.
  out[0] = 0; out[1] = 0; out[3] = 1;
  return out;
}

function analyticGuess(n, etaMax) {
  const y = new Float64Array(5 * (n + 1));
  const h = etaMax / n;
  let fInt = 0; let prevU = 0;
  for (let i = 0; i <= n; i++) {
    const eta = i * h;
    const u = 0.30 * eta * Math.exp(-0.5 * eta);
    fInt += (i === 0 ? 0 : 0.5 * h * (prevU + u));
    prevU = u;
    y[i * 5 + 0] = fInt;
    y[i * 5 + 1] = u;
    y[i * 5 + 2] = 0.30 * Math.exp(-0.5 * eta) * (1 - 0.5 * eta);
    y[i * 5 + 3] = Math.exp(-0.55 * eta);
    y[i * 5 + 4] = -0.55 * Math.exp(-0.55 * eta);
  }
  y[0] = 0; y[1] = 0; y[3] = 1;
  return y;
}

// Solve the similarity system at one Prandtl number on grid n, using
// mesh sequencing.  warmY (optional) is a solution on grid nWarm.
function collocationSolve(prandtl, etaMax, n, warmY = null, nWarm = 0) {
  let y; let nCur;
  if (warmY) {
    nCur = Math.min(1000, n);
    y = prolongate(warmY, nWarm, nCur, etaMax);
  } else {
    nCur = 250;
    y = analyticGuess(nCur, etaMax);
  }
  if (!collocationNewton(prandtl, y, nCur, etaMax)) return null;
  while (nCur < n) {
    const nNext = Math.min(n, nCur * 4);
    y = prolongate(y, nCur, nNext, etaMax);
    nCur = nNext;
    if (!collocationNewton(prandtl, y, nCur, etaMax)) return null;
  }
  return y;
}

export function solveVerticalPlateSimilarity(prandtl, options = {}) {
  finite(prandtl, 'Prandtl数', true);
  if (prandtl < PR_MIN || prandtl > PR_MAX) {
    throw Error(`Pr=${prandtl}は本モジュールの検証済み範囲（Pr=${PR_MIN}〜${PR_MAX}）の外です。範囲外の相似解は検証していないため計算しません。`);
  }
  const etaMaxDefault = prandtl < 1 ? 40 : 30;
  const etaMax = options.etaMax === undefined
    ? etaMaxDefault
    : finite(options.etaMax, '相似変数の上限ηmax');
  if (etaMax < 8 || etaMax > 200) throw Error('ηmaxは8〜200の範囲で指定してください。');
  // A truncated similarity domain silently distorts the solution: the
  // thermal layer of a low-Pr fluid extends far in eta, and at high Pr
  // the velocity tail decays slowly.  Explicit domains below the
  // verified defaults are refused.
  if (options.etaMax !== undefined && etaMax < etaMaxDefault) {
    throw Error(`ηmaxが小さすぎて相似領域が不足します。このPrでの検証済みの既定値（${etaMaxDefault}）以上を指定してください。`);
  }
  const steps = options.steps === undefined ? 3200 : options.steps;
  if (!Number.isInteger(steps) || steps < 400 || steps > 100000 || steps % 2 !== 0) {
    throw Error('相似解の刻み数は400〜100000の偶数で指定してください。');
  }
  // Continuation ladder in Pr from 1 to the target (ratio <= 1.8).
  const ladder = [1];
  if (prandtl !== 1) {
    const dir = Math.sign(Math.log(prandtl));
    let cur = 1;
    while ((dir > 0 && cur < prandtl) || (dir < 0 && cur > prandtl)) {
      let next = cur * Math.exp(dir * Math.log(1.8));
      if ((dir > 0 && next > prandtl) || (dir < 0 && next < prandtl)) next = prandtl;
      ladder.push(next);
      cur = next;
    }
  }
  let warmY = null; let nWarm = 0;
  let yCoarse = null; let yFine = null;
  for (let li = 0; li < ladder.length; li++) {
    const pr = ladder[li];
    const isTarget = li === ladder.length - 1;
    if (isTarget) {
      yCoarse = collocationSolve(pr, etaMax, steps / 2, warmY, nWarm);
      if (!yCoarse) throw Error('相似解が収束しませんでした。未検証として扱います。');
      yFine = collocationSolve(pr, etaMax, steps, yCoarse, steps / 2);
      if (!yFine) throw Error('相似解が収束しませんでした。未検証として扱います。');
    } else {
      warmY = collocationSolve(pr, etaMax, 1000, warmY, nWarm);
      if (!warmY) throw Error('相似解が収束しませんでした。未検証として扱います。');
      nWarm = 1000;
    }
  }
  const extract = (y, n) => {
    const h = etaMax / n;
    let imax = 0;
    for (let i = 1; i <= n; i++) if (y[i * 5 + 1] > y[imax * 5 + 1]) imax = i;
    let etaPeak = imax * h; let fPrimeMax = y[imax * 5 + 1];
    if (imax > 0 && imax < n) {
      const ym = y[(imax - 1) * 5 + 1]; const y0 = y[imax * 5 + 1]; const yp = y[(imax + 1) * 5 + 1];
      const denom = ym - 2 * y0 + yp;
      if (denom !== 0) {
        const shift = 0.5 * (ym - yp) / denom;
        if (Math.abs(shift) <= 1) {
          etaPeak = (imax + shift) * h;
          fPrimeMax = y0 - 0.25 * (ym - yp) * shift;
        }
      }
    }
    return {
      fDoublePrimeAtWall: y[2],
      thetaPrimeAtWall: y[4],
      fPrimeMax,
      etaAtFPrimeMax: etaPeak,
      fInfinity: y[n * 5 + 0],
      endFPrime: y[n * 5 + 1],
      endTheta: y[n * 5 + 3],
    };
  };
  const fine = extract(yFine, steps);
  const coarse = extract(yCoarse, steps / 2);
  // Richardson extrapolation (trapezoidal collocation is second order).
  const rich = (fc, ff) => ff + (ff - fc) / 3;
  const h = etaMax / steps;
  let etaTheta001 = null;
  for (let i = 1; i <= steps; i++) {
    if (yFine[i * 5 + 3] <= 0.01) {
      const t0 = yFine[(i - 1) * 5 + 3]; const t1 = yFine[i * 5 + 3];
      etaTheta001 = (i - 1) * h + h * (t0 - 0.01) / (t0 - t1);
      break;
    }
  }
  const stride = Math.max(1, Math.ceil(steps / 800));
  const eta = []; const fArr = []; const fpArr = []; const thArr = [];
  for (let i = 0; i <= steps; i += stride) {
    eta.push(i * h);
    fArr.push(yFine[i * 5 + 0]);
    fpArr.push(yFine[i * 5 + 1]);
    thArr.push(yFine[i * 5 + 3]);
  }
  if (eta[eta.length - 1] !== etaMax) {
    eta.push(etaMax);
    fArr.push(yFine[steps * 5 + 0]);
    fpArr.push(yFine[steps * 5 + 1]);
    thArr.push(yFine[steps * 5 + 3]);
  }
  return {
    prandtl,
    etaMax,
    steps,
    fDoublePrimeAtWall: rich(coarse.fDoublePrimeAtWall, fine.fDoublePrimeAtWall),
    thetaPrimeAtWall: rich(coarse.thetaPrimeAtWall, fine.thetaPrimeAtWall),
    wallTemperatureGradient: -rich(coarse.thetaPrimeAtWall, fine.thetaPrimeAtWall),
    fPrimeMax: rich(coarse.fPrimeMax, fine.fPrimeMax),
    etaAtFPrimeMax: fine.etaAtFPrimeMax,
    fInfinity: rich(coarse.fInfinity, fine.fInfinity),
    etaTheta001,
    endFPrime: fine.endFPrime,
    endTheta: fine.endTheta,
    gridValues: {coarse, fine},
    profile: {eta, f: fArr, fPrime: fpArr, theta: thArr},
  };
}

// ---------------------------------------------------------------------
// Textbook correlations (used as independent comparisons in the model
// records and directly testable).
// ---------------------------------------------------------------------

export function churchillChuLaminarNu(rayleigh, prandtl) {
  finite(rayleigh, 'Rayleigh数', true); finite(prandtl, 'Prandtl数', true);
  return finite(0.68 + 0.670 * rayleigh ** 0.25
    / (1 + (0.492 / prandtl) ** (9 / 16)) ** (4 / 9), '式(8.13a)のNusselt数', true);
}

export function squireEckertAverageNu(rayleigh, prandtl) {
  finite(rayleigh, 'Rayleigh数', true); finite(prandtl, 'Prandtl数', true);
  return finite(0.678 * rayleigh ** 0.25
    * (prandtl / (0.952 + prandtl)) ** 0.25, '式(8.27)のNusselt数', true);
}

export function squireEckertLocalNu(rayleigh, prandtl) {
  finite(rayleigh, 'Rayleigh数', true); finite(prandtl, 'Prandtl数', true);
  return finite(0.508 * rayleigh ** 0.25
    * (prandtl / (0.952 + prandtl)) ** 0.25, '式(8.26)のNusselt数', true);
}

export function raithbyHollandsUniformFluxAverageNu(modifiedRayleigh, prandtl) {
  finite(modifiedRayleigh, '修正Rayleigh数', true); finite(prandtl, 'Prandtl数', true);
  return finite((6 / 5) * (modifiedRayleigh * prandtl
    / (4 + 9 * Math.sqrt(prandtl) + 10 * prandtl)) ** 0.2, '式(8.44b)のNusselt数', true);
}

export function churchillChuUniformFluxAverageNu(modifiedRayleigh, prandtl) {
  finite(modifiedRayleigh, '修正Rayleigh数', true); finite(prandtl, 'Prandtl数', true);
  // Eqn. (8.43b) is defined with the mid-plate temperature difference;
  // convert to the mean-difference basis with (6/5) 2^(-1/5) from
  // eqns. (8.40)-(8.41) and Fig. 8.9.
  const mid = 0.73 * modifiedRayleigh ** 0.2
    / (1 + (0.492 / prandtl) ** (9 / 16)) ** (16 / 45);
  return finite(mid * (6 / 5) * 2 ** (-0.2), '式(8.43b)のNusselt数', true);
}

// ---------------------------------------------------------------------
// Main model: vertical isothermal plate.
// ---------------------------------------------------------------------

const WALL_KEYS = new Set([
  'wallTemperatureK', 'ambientTemperatureK', 'lengthM', 'betaPerK',
  'kinematicViscosityM2PerS', 'thermalDiffusivityM2PerS',
  'thermalConductivityWPerMK', 'gravityMPerS2', 'similaritySteps', 'etaMax',
]);

export function naturalConvectionVerticalWall(input) {
  const c = checkObject(input, '鉛直等温壁の自然対流の条件');
  checkKeys(c, WALL_KEYS);
  finite(c.wallTemperatureK, '壁温', true);
  finite(c.ambientTemperatureK, '周囲温度', true);
  finite(c.lengthM, '代表長さ（板の高さ）', true);
  const {gravity, prandtl} = checkProperties(c);
  const deltaT = c.wallTemperatureK - c.ambientTemperatureK;
  if (deltaT === 0) throw Error('壁温と周囲温度が等しいため温度差が0です。自然対流は生じません。');
  const deltaTAbs = Math.abs(deltaT);
  const nu = c.kinematicViscosityM2PerS;
  const alpha = c.thermalDiffusivityM2PerS;
  const k = c.thermalConductivityWPerMK;
  const L = c.lengthM;
  const grashof = finite(gravity * c.betaPerK * deltaTAbs * L ** 3 / nu ** 2, 'Grashof数', true);
  const rayleigh = finite(grashof * prandtl, 'Rayleigh数', true);
  if (rayleigh > RA_MAX) {
    throw Error(`Ra_L=${rayleigh}は層流の範囲（Ra_L≲10^9、教科書§8.3）を超えた乱流域です。層流相似解では計算しません。乱流域の相関式(8.13b)は本モジュールでは扱いません。`);
  }
  if (rayleigh < RA_MIN) {
    throw Error(`Ra_L=${rayleigh}では境界層が板の高さに対して厚くなりすぎ、境界層近似に基づく相似解の検証範囲外です（教科書§8.3の妥当性ノート）。本モジュールでは計算しません。`);
  }
  const sim = solveVerticalPlateSimilarity(prandtl, {
    etaMax: c.etaMax,
    steps: c.similaritySteps,
  });
  const direction = deltaT > 0 ? 1 : -1;
  const grQuarter = (grashof / 4) ** 0.25;
  const localNuTop = sim.wallTemperatureGradient * grQuarter;
  const averageNu = (4 / 3) * localNuTop;
  const averageH = averageNu * k / L;
  const localHTop = localNuTop * k / L;
  const velocityScale = (4 * nu / L) * Math.sqrt(grashof / 4);
  const maxVelocity = direction * velocityScale * sim.fPrimeMax;
  const yAtMaxVelocity = sim.etaAtFPrimeMax * L / grQuarter;
  const nuCC = churchillChuLaminarNu(rayleigh, prandtl);
  const nuSE = squireEckertAverageNu(rayleigh, prandtl);
  const warnings = [];
  if (rayleigh * (1 + (0.492 / prandtl) ** (9 / 16)) ** (16 / 9) > 1e8) {
    warnings.push('教科書p.419の整理では、この条件は境界層が乱流的振る舞いを示し始める領域に相当します。層流相似解の値として読んでください。');
  }
  if (rayleigh < 1e6) {
    warnings.push('Ra_Lが小さいため境界層は厚く、境界層近似の精度は低下します（教科書§8.3の妥当性ノート）。');
  }
  const profileAtTop = {yM: [], velocityMPerS: [], temperatureK: []};
  for (let i = 0; i < sim.profile.eta.length; i++) {
    profileAtTop.yM.push(sim.profile.eta[i] * L / grQuarter);
    profileAtTop.velocityMPerS.push(
      direction * velocityScale * sim.profile.fPrime[i]);
    profileAtTop.temperatureK.push(
      c.ambientTemperatureK + deltaT * sim.profile.theta[i]);
  }
  return {
    law: LAW,
    model: 'vertical-isothermal-plate-similarity',
    correlation: 'similarity (Ostrach), section 8.3',
    filmTemperatureK: (c.wallTemperatureK + c.ambientTemperatureK) / 2,
    deltaTK: deltaT,
    flowDirection: direction,
    prandtl,
    grashof,
    rayleigh,
    similarity: {
      fDoublePrimeAtWall: sim.fDoublePrimeAtWall,
      thetaPrimeAtWall: sim.thetaPrimeAtWall,
      wallTemperatureGradient: sim.wallTemperatureGradient,
      fPrimeMax: sim.fPrimeMax,
      etaAtFPrimeMax: sim.etaAtFPrimeMax,
      fInfinity: sim.fInfinity,
      etaMax: sim.etaMax,
      steps: sim.steps,
    },
    localNusseltAtTop: finite(localNuTop, '局所Nusselt数', true),
    averageNusselt: finite(averageNu, '平均Nusselt数', true),
    localHAtTop: finite(localHTop, '局所熱伝達率', true),
    averageH: finite(averageH, '平均熱伝達率', true),
    averageHeatFluxWPerM2: averageH * deltaT,
    localHeatFluxAtTopWPerM2: localHTop * deltaT,
    maxVelocityAtTopMPerS: maxVelocity,
    yAtMaxVelocityM: yAtMaxVelocity,
    thermalThickness1PercentM: sim.etaTheta001 === null
      ? null : sim.etaTheta001 * L / grQuarter,
    churchillChu: {
      equation: '8.13a',
      averageNusselt: nuCC,
      ratioToSimilarity: nuCC / averageNu,
    },
    squireEckert: {
      equation: '8.27',
      averageNusselt: nuSE,
      ratioToSimilarity: nuSE / averageNu,
    },
    similarityProfile: sim.profile,
    profileAtTop,
    inRange: true,
    warnings,
    assumptions: {
      propertiesAtFilmTemperature: true,
      constantProperties: true,
      boussinesqApproximation: true,
      isothermalWall: true,
      laminarBoundaryLayerSimilarity: true,
      radiationIncluded: false,
      edgeEffectsIncluded: false,
    },
    releaseApproved: false,
  };
}

// ---------------------------------------------------------------------
// Uniform wall heat flux: Raithby-Hollands average correlation (8.44b)
// with the textbook temperature distribution (8.40)-(8.41).
// ---------------------------------------------------------------------

const UHF_KEYS = new Set([
  'heatFluxWPerM2', 'ambientTemperatureK', 'lengthM', 'betaPerK',
  'kinematicViscosityM2PerS', 'thermalDiffusivityM2PerS',
  'thermalConductivityWPerMK', 'gravityMPerS2',
]);

export function uniformHeatFluxVerticalWall(input) {
  const c = checkObject(input, '一様熱流束の鉛直壁の条件');
  checkKeys(c, UHF_KEYS);
  finite(c.heatFluxWPerM2, '壁熱流束', true);
  finite(c.ambientTemperatureK, '周囲温度', true);
  finite(c.lengthM, '代表長さ（板の高さ）', true);
  const {gravity, prandtl} = checkProperties(c);
  const nu = c.kinematicViscosityM2PerS;
  const alpha = c.thermalDiffusivityM2PerS;
  const k = c.thermalConductivityWPerMK;
  const L = c.lengthM;
  const q = c.heatFluxWPerM2;
  const modifiedRayleigh = finite(
    gravity * c.betaPerK * q * L ** 4 / (k * nu * alpha), '修正Rayleigh数', true);
  const averageNu = raithbyHollandsUniformFluxAverageNu(modifiedRayleigh, prandtl);
  if (averageNu < 5) {
    throw Error(`式(8.44b)の適用条件はNu≳5です（計算値 ${averageNu}）。これより小さいNuに対する式は教科書では文献[8.11]に委ねられており、本モジュールでは計算しません。`);
  }
  const equivalentRayleigh = modifiedRayleigh / averageNu;
  if (equivalentRayleigh > RA_MAX) {
    throw Error(`平均温度差で評価したRa_L=${equivalentRayleigh}は層流の範囲（Ra_L≲10^9）を超えた乱流域です。式(8.44b)では計算しません。`);
  }
  const meanDeltaT = q * L / (k * averageNu);
  const topDeltaT = (6 / 5) * meanDeltaT;
  const midDeltaT = topDeltaT * 2 ** (-0.2);
  const localNuTop = (5 / 6) * averageNu;
  const nuCC = churchillChuUniformFluxAverageNu(modifiedRayleigh, prandtl);
  return {
    law: LAW,
    model: 'vertical-uniform-heat-flux-plate-correlation',
    correlation: '8.44b (Raithby-Hollands), profile (8.40)-(8.41)',
    prandtl,
    modifiedRayleigh,
    equivalentRayleigh,
    averageNusselt: averageNu,
    localNusseltAtTop: localNuTop,
    averageH: averageNu * k / L,
    meanDeltaTK: meanDeltaT,
    topDeltaTK: topDeltaT,
    midDeltaTK: midDeltaT,
    averageWallTemperatureK: c.ambientTemperatureK + meanDeltaT,
    topWallTemperatureK: c.ambientTemperatureK + topDeltaT,
    churchillChu: {
      equation: '8.43b (converted to the mean-difference basis)',
      averageNusselt: nuCC,
      ratioToRaithbyHollands: nuCC / averageNu,
    },
    inRange: true,
    warnings: [],
    assumptions: {
      propertiesAtFilmTemperature: true,
      constantProperties: true,
      boussinesqApproximation: true,
      uniformHeatFlux: true,
      laminarCorrelation: true,
      radiationIncluded: false,
      edgeEffectsIncluded: false,
    },
    releaseApproved: false,
  };
}
