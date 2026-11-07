#!/usr/bin/env python3
"""Independent references for the 3D brick transient conduction solver.

Transient Dirichlet cases: the exact solution of the heat equation in a
brick with all faces at one temperature and a uniform initial temperature
separates into a product of three 1D slab series. Cell averages of the
series are evaluated with mpmath at 50 digits; the cell average of the
product is the product of the 1D cell averages.

Steady cases: (a) a direct dense solve (numpy) of the same cell-centred
finite-volume discrete system the JS solver marches to, and (b) the
continuum steady (Laplace) solution as a superposition of six single-face
double Fourier series with analytic cell averages, evaluated in float64
at two truncation limits so the JSON records its own tail estimate. The
series converges slowly near edges where neighbouring faces carry
different temperatures, so both the max and the RMS tail are recorded.

Writes docs/dynamic/TRANSIENT_BRICK_3D_REFERENCE_20261107.json.
"""
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import mpmath as mp

mp.mp.dps = 50
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "dynamic" / "TRANSIENT_BRICK_3D_REFERENCE_20261107.json"


def slab_cell_factors(L, n, alpha, t, terms=201):
    """Cell averages of u(x,t), u = slab series with u(0)=u(L)=0, u(x,0)=1."""
    factors = []
    for j in range(n):
        total = mp.mpf(0)
        for m in range(1, terms + 1, 2):
            coef = 4 / (m * mp.pi)
            avg_sin = (n / (m * mp.pi)) * (
                mp.cos(m * mp.pi * j / n) - mp.cos(m * mp.pi * (j + 1) / n)
            )
            decay = mp.e ** (-alpha * (m * mp.pi / L) ** 2 * t)
            total += coef * avg_sin * decay
        factors.append(total)
    return factors


def transient_case(size, grids, k, rho, cp, t0, tw, t):
    alpha = k / (rho * cp)
    out = {"size": size, "k": k, "rho": rho, "cp": cp, "initial": t0,
           "wallTemperature": tw, "time": t, "grids": {}}
    for grid in grids:
        nx, ny, nz = grid
        fx = slab_cell_factors(size["x"], nx, alpha, t)
        fy = slab_cell_factors(size["y"], ny, alpha, t)
        fz = slab_cell_factors(size["z"], nz, alpha, t)
        temps = []
        for l in range(nz):
            for j in range(ny):
                for i in range(nx):
                    temps.append(float(tw + (t0 - tw) * fx[i] * fy[j] * fz[l]))
        out["grids"][f"{nx}x{ny}x{nz}"] = temps
    return out


def cosh_over_sinh(u, w):
    """cosh(u)/sinh(w) for 0 <= u <= w, overflow-safe (arrays or scalars)."""
    return (np.exp(u - w) + np.exp(-u - w)) / (1.0 - np.exp(-2.0 * w))


def sin_avg(m, n):
    """Cell averages of sin(m*pi*x/L) over n uniform cells."""
    j = np.arange(n)
    return (n / (m * math.pi)) * (np.cos(m * math.pi * j / n) - np.cos(m * math.pi * (j + 1) / n))


def single_face_average(face_axis, from_min, dims, grid, terms):
    """Cell averages, in (z, y, x) array order, of the steady Laplace
    solution that is 1 on one face of the box and 0 on the other five.
    face_axis: 0=x, 1=y, 2=z. from_min: the driven face is the low side."""
    odd = np.arange(1, terms + 1, 2, dtype=float)
    # Driven axis a, tangential axes b and c in (x, y, z) numbering.
    a = face_axis
    b, c = [axis for axis in range(3) if axis != a]
    La, Lb, Lc = dims[a], dims[b], dims[c]
    na, nb, nc = grid[a], grid[b], grid[c]
    da = La / na
    edges = np.arange(na + 1) * da
    total_a = np.zeros((na, nb, nc))
    sb = np.array([sin_avg(int(m), nb) for m in odd])          # (M, nb)
    sc = np.array([sin_avg(int(n), nc) for n in odd])          # (M, nc)
    for mi, m in enumerate(odd):
        gamma = math.pi * np.sqrt((m / Lb) ** 2 + (odd / Lc) ** 2)   # (M,)
        coef = 16.0 / (m * odd * math.pi ** 2)                       # (M,)
        hi = cosh_over_sinh(gamma[:, None] * (La - edges[None, :]), gamma[:, None] * La)
        prof = (hi[:, :-1] - hi[:, 1:]) / (gamma[:, None] * da)      # (M, na), from-min profile
        if not from_min:
            prof = prof[:, ::-1]
        contrib = (coef[:, None] * prof).T @ sc                      # (na, nc)
        total_a += contrib[:, None, :] * sb[mi][None, :, None]
    # Reorder (a, b, c) axes into (z, y, x): dim_of_axis[axis] is the
    # input dimension carrying that axis, so the output permutation is
    # [dim of z, dim of y, dim of x].
    dim_of_axis = [0, 1, 2]
    dim_of_axis[a], dim_of_axis[b], dim_of_axis[c] = 0, 1, 2
    perm = [dim_of_axis[2], dim_of_axis[1], dim_of_axis[0]]
    return np.transpose(total_a, axes=perm)


def steady_series_case(size, face_temps, grids, terms_hi=401, terms_lo=201):
    dims = (size["x"], size["y"], size["z"])
    face_axis = {"xMin": (0, True), "xMax": (0, False), "yMin": (1, True),
                 "yMax": (1, False), "zMin": (2, True), "zMax": (2, False)}
    out = {"size": size, "faceTemperatures": face_temps, "grids": {},
           "tailMaxK": {}, "tailRmsK": {}}
    for grid in grids:
        acc = {}
        for label, terms in (("hi", terms_hi), ("lo", terms_lo)):
            total = None
            for face, temp in face_temps.items():
                axis, from_min = face_axis[face]
                part = single_face_average(axis, from_min, dims, grid, terms) * temp
                total = part if total is None else total + part
            acc[label] = total
        key = f"{grid[0]}x{grid[1]}x{grid[2]}"
        diff = np.abs(acc["hi"] - acc["lo"])
        out["grids"][key] = [float(v) for v in acc["hi"].ravel()]
        out["tailMaxK"][key] = float(diff.max())
        out["tailRmsK"][key] = float(np.sqrt(np.mean(diff ** 2)))
    return out


def steady_discrete_case(size, grid, k, face_temps):
    nx, ny, nz = grid
    Lx, Ly, Lz = size["x"], size["y"], size["z"]
    dx, dy, dz = Lx / nx, Ly / ny, Lz / nz
    N = nx * ny * nz
    A = np.zeros((N, N))
    b = np.zeros(N)

    def idx(i, j, l):
        return i + nx * (j + ny * l)

    g = {0: k * dy * dz / dx, 1: k * dx * dz / dy, 2: k * dx * dy / dz}
    area = {0: dy * dz, 1: dx * dz, 2: dx * dy}
    d = {0: dx, 1: dy, 2: dz}
    face_key = {(0, -1): "xMin", (0, 1): "xMax", (1, -1): "yMin",
                (1, 1): "yMax", (2, -1): "zMin", (2, 1): "zMax"}
    for l in range(nz):
        for j in range(ny):
            for i in range(nx):
                n = idx(i, j, l)
                coord = [i, j, l]
                counts = [nx, ny, nz]
                for axis in range(3):
                    for side in (-1, 1):
                        c2 = list(coord)
                        c2[axis] += side
                        if 0 <= c2[axis] < counts[axis]:
                            m = idx(*c2)
                            A[n, n] += g[axis]
                            A[n, m] -= g[axis]
                        else:
                            gb = 2 * k * area[axis] / d[axis]
                            A[n, n] += gb
                            b[n] += gb * face_temps[face_key[(axis, side)]]
    x = np.linalg.solve(A, b)
    residual = float(np.max(np.abs(A @ x - b)))
    return {"size": size, "grid": list(grid), "k": k,
            "faceTemperatures": face_temps, "temperature": [float(v) for v in x],
            "solveResidualMax": residual}


def main():
    doc = {"releaseApproved": False, "cases": {}}
    doc["cases"]["dirichletCube"] = transient_case(
        {"x": 0.1, "y": 0.1, "z": 0.1}, [(4, 4, 4), (8, 8, 8), (16, 16, 16)],
        k=10.0, rho=1000.0, cp=1000.0, t0=300.0, tw=350.0, t=100.0)
    doc["cases"]["dirichletBrick"] = transient_case(
        {"x": 0.12, "y": 0.08, "z": 0.05}, [(12, 8, 5), (24, 16, 10)],
        k=60.0, rho=1000.0, cp=1000.0, t0=300.0, tw=350.0, t=5.0)
    face_temps = {"xMin": 400.0, "xMax": 300.0, "yMin": 360.0,
                  "yMax": 310.0, "zMin": 340.0, "zMax": 320.0}
    size = {"x": 0.1, "y": 0.1, "z": 0.1}
    doc["cases"]["steadySeries"] = steady_series_case(size, face_temps, [(8, 8, 8), (16, 16, 16)])
    doc["cases"]["steadySeries"].update({"k": 100.0, "rho": 1000.0, "cp": 1000.0, "initial": 300.0})
    doc["cases"]["steadyDiscrete"] = steady_discrete_case(size, (6, 5, 4), 100.0, face_temps)
    doc["cases"]["steadyDiscrete"].update({"rho": 1000.0, "cp": 1000.0, "initial": 300.0})
    # Assembly diagnostic: the six unit-face solutions sum to exactly 1
    # (constant Dirichlet data on every face), so the truncated sum must
    # approach 1 everywhere; an axis mix-up would show up as O(1) error.
    unity = None
    for face, (axis, from_min) in {"xMin": (0, True), "xMax": (0, False),
                                   "yMin": (1, True), "yMax": (1, False),
                                   "zMin": (2, True), "zMax": (2, False)}.items():
        part = single_face_average(axis, from_min, (0.1, 0.1, 0.1), (8, 8, 8), 201)
        unity = part if unity is None else unity + part
    print("unity check max deviation", float(np.max(np.abs(unity - 1.0))))
    doc["generatorSHA256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    print("wrote", OUT)
    for name, case in doc["cases"].items():
        for gname, temps in case.get("grids", {}).items():
            arr = np.array(temps)
            print(name, gname, "min", arr.min(), "max", arr.max())
    print("steady tail max", doc["cases"]["steadySeries"]["tailMaxK"])
    print("steady tail rms", doc["cases"]["steadySeries"]["tailRmsK"])
    print("discrete residual", doc["cases"]["steadyDiscrete"]["solveResidualMax"])


if __name__ == "__main__":
    main()
