#!/usr/bin/env python3
"""Independent reference for variable-property (k(T), cp(T)) transient
conduction in a 1-D slab whose right face exchanges heat with a prescribed
fluid AND a large black enclosure through one common surface temperature
(the combination the production FVM currently keeps gated as unverified).

Independence: this script shares no code with the JavaScript solver. It
integrates the enthalpy form rho*dH/dt = d/dx(k(T) dT/dx) on its own
cell-centred finite-volume grid with solve_ivp's implicit BDF, evaluates
face conductances from half-cell resistances with cell-centre k(T), and
solves the common surface temperature by Brent root-finding at every
right-hand-side evaluation. Piecewise-linear property tables are integrated
analytically per segment.

Usage: dynamic-variable-property-surface-reference.py CASE_JSON OUT_JSON
CASE_JSON: {width, rho, kTable|null, kConst, cpTable|null, cpConst,
            initial, boundary:{temperature, radiationTemperature, h,
            emissivity}, times:[...], grids:[...]}
OUT_JSON: per grid, per time: cell-centre temperatures, plus the steady
uniform equilibrium temperature (root of the surface balance alone).
"""
import json
import sys

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

SIGMA = 5.670374419e-8


def make_table(rows):
    rows = np.array(rows, dtype=float)
    return rows[:, 0], rows[:, 1]


def interp(table, T):
    xs, ys = table
    return float(np.interp(T, xs, ys))


def enthalpy_fn(cp_table):
    xs, ys = cp_table

    def H(T):
        T = float(T)
        total = 0.0
        for i in range(len(xs) - 1):
            a, b = xs[i], xs[i + 1]
            if T <= a:
                break
            hi = min(T, b)
            cp_hi = ys[i] + (ys[i + 1] - ys[i]) * (hi - a) / (b - a)
            total += 0.5 * (ys[i] + cp_hi) * (hi - a)
            if T <= b:
                break
        return total

    def T_of_H(h):
        return brentq(lambda T: H(T) - h, xs[0], xs[-1], xtol=1e-13, rtol=1e-14)

    return H, T_of_H


def solve_case(case, n):
    L = case["width"]
    rho = case["rho"]
    dx = L / n
    area = 1.0  # height * depth = 1 m^2
    vol = dx * area
    k_tab = make_table(case["kTable"]) if case.get("kTable") else None
    cp_tab = make_table(case["cpTable"]) if case.get("cpTable") else None
    k_const = case.get("kConst")
    cp_const = case.get("cpConst")
    H, T_of_H = enthalpy_fn(cp_tab) if cp_tab else (None, None)
    b = case["boundary"]
    Tf, Trad, h, eps = b["temperature"], b["radiationTemperature"], b["h"], b["emissivity"]

    def kval(T):
        return interp(k_tab, T) if k_tab else k_const

    def surface_watts(Tcell):
        G = 2.0 * kval(Tcell) * area / dx

        def balance(Ts):
            return G * (Tcell - Ts) - h * area * (Ts - Tf) - eps * SIGMA * area * (Ts**4 - Trad**4)

        lo, hi = min(Tcell, Tf, Trad), max(Tcell, Tf, Trad)
        Ts = brentq(balance, lo, hi, xtol=1e-13, rtol=1e-14) if balance(lo) * balance(hi) < 0 else lo
        return G * (Ts - Tcell), Ts

    def rhs(t, Hstate):
        T = np.array([T_of_H(hh) for hh in Hstate]) if cp_tab else Hstate / cp_const
        k = np.array([kval(tt) for tt in T])
        P = np.zeros(n)
        for i in range(n - 1):
            G = area / (dx / (2 * k[i]) + dx / (2 * k[i + 1]))
            q = G * (T[i + 1] - T[i])
            P[i] += q
            P[i + 1] -= q
        inward, _ = surface_watts(T[-1])
        P[-1] += inward
        # State is enthalpy per unit mass in both representations (table
        # H(T), or cp*T for constant cp), so d(state)/dt = P/(rho*V).
        return P / (rho * vol)

    H0 = np.full(n, H(case["initial"])) if cp_tab else np.full(n, cp_const * case["initial"])
    times = sorted(case["times"])
    sol = solve_ivp(rhs, [0, times[-1]], H0, method="BDF", t_eval=times,
                    rtol=1e-10, atol=1e-9)
    if not sol.success:
        raise RuntimeError(f"BDF failed: {sol.message}")
    out = []
    for j, t in enumerate(times):
        state = sol.y[:, j]
        T = np.array([T_of_H(hh) for hh in state]) if cp_tab else state / cp_const
        _, Ts = surface_watts(T[-1])
        # cumulative boundary input by trapezoidal accumulation on the fly is
        # not available from t_eval alone; report instantaneous values only.
        out.append({"time": t, "temperature": [float(v) for v in T],
                    "surfaceTemperature": float(Ts)})
    return out


def main():
    case = json.load(open(sys.argv[1]))
    result = {"grids": {}}
    for n in case["grids"]:
        result["grids"][str(n)] = solve_case(case, n)
    b = case["boundary"]
    root = brentq(lambda T: b["h"] * (T - b["temperature"]) + b["emissivity"] * SIGMA * (T**4 - b["radiationTemperature"]**4),
                  b["radiationTemperature"], b["temperature"], xtol=1e-13, rtol=1e-14)
    result["steadyUniformTemperature"] = float(root)
    json.dump(result, open(sys.argv[2], "w"), indent=1)
    print(f"wrote {sys.argv[2]}; steady uniform root = {root:.10f} K")


if __name__ == "__main__":
    main()
