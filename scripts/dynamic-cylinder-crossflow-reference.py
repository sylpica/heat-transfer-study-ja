#!/usr/bin/env python3
"""Independent reference values for the cylinder-crossflow-transient
development module (dynamic/dev/cylinder-crossflow-transient.mjs).

Two independent routes, neither of which shares code with the JS module:

1. Internal-gradient case: a cell-centred radial finite-volume
   discretisation of the solid cylinder (constant properties, uniform
   convective surface with the half-cell conduction resistance in series
   with 1/h), assembled here from scratch and propagated in time exactly
   with the matrix exponential (scipy.linalg.expm, double precision).
   Two grids (256 and 512 cells) are run so the reference carries its own
   grid self-difference.  The JS module instead uses the existing radial
   model with explicit Euler substepping on much coarser grids.

2. Lumped-limit case: the analytic exponential decay of the lumped
   capacitance model, theta/theta0 = exp(-t/tau) with
   tau = rho*cp*V/(h*A) = rho*cp*R/(2h) for a cylinder (lateral area
   only), evaluated with mpmath at 50 digits.

Output: docs/dynamic/CYLINDER_CROSSFLOW_REFERENCE_20261107.json
"""
import hashlib
import json
import pathlib

import numpy as np
from mpmath import mp, mpf, exp as mexp
from scipy.linalg import expm

mp.dps = 50

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "dynamic" / "CYLINDER_CROSSFLOW_REFERENCE_20261107.json"


def gradient_case(n, R, k, rho, cp, h, t_inf):
    """Return (centres, volumes per unit length, M, b) for theta = T - t_inf."""
    dr = R / n
    faces = np.array([i * dr for i in range(n + 1)])
    areas = 2.0 * np.pi * faces  # per unit length
    vols = np.pi * (faces[1:] ** 2 - faces[:-1] ** 2)  # per unit length
    caps = rho * cp * vols
    # conductance between neighbouring cell centres, per unit length
    G = k * areas[1:n] / dr
    # boundary: series of half-cell conduction and convection, per unit length
    Gb = areas[n] / (dr / (2.0 * k) + 1.0 / h)
    M = np.zeros((n, n))
    for i in range(n):
        left = G[i - 1] if i > 0 else 0.0
        right = G[i] if i < n - 1 else Gb
        M[i, i] = -(left + right) / caps[i]
        if i > 0:
            M[i, i - 1] = G[i - 1] / caps[i]
        if i < n - 1:
            M[i, i + 1] = G[i] / caps[i]
    return dr, vols, M, Gb


def run_gradient(n, case, times):
    R, k, rho, cp, h = case["radius"], case["k"], case["rho"], case["cp"], case["h"]
    t0, t_inf = case["initial"], case["fluid"]
    dr, vols, M, Gb = gradient_case(n, R, k, rho, cp, h, t_inf)
    theta0 = np.full(n, t0 - t_inf)
    out = []
    for t in times:
        theta = expm(M * t) @ theta0
        T = theta + t_inf
        mean = float(np.sum(vols * T) / np.sum(vols))
        # surface temperature from the series resistance, as in the model
        q_area = (t_inf - T[-1]) / (dr / (2.0 * k) + 1.0 / h)  # W/m^2, inward +
        surface = t_inf - q_area / h
        out.append({
            "time": t,
            "centreTemperature": float(T[0]),
            "outerCellTemperature": float(T[-1]),
            "surfaceTemperature": float(surface),
            "meanTemperature": mean,
        })
    return out


def main():
    ref = {}

    grad = {"radius": 0.01, "length": 0.1, "k": 15.0, "rho": 8000.0,
            "cp": 500.0, "h": 500.0, "initial": 400.0, "fluid": 300.0}
    times = [2.0, 5.0, 10.0, 20.0]
    fine = run_gradient(512, grad, times)
    coarse = run_gradient(256, grad, times)
    selfdiff = max(
        max(abs(f["centreTemperature"] - c["centreTemperature"]),
            abs(f["surfaceTemperature"] - c["surfaceTemperature"]),
            abs(f["meanTemperature"] - c["meanTemperature"]))
        for f, c in zip(fine, coarse))
    ref["gradientCase"] = {
        "source": "independent Python cell-centred radial FV + matrix exponential (expm), n=512; self-difference vs n=256 recorded",
        "diameter": 0.02, "length": 0.1, "solidConductivity": 15.0,
        "solidDensity": 8000.0, "solidCp": 500.0, "heatTransferCoefficient": 500.0,
        "initialTemperature": 400.0, "fluidTemperature": 300.0,
        "biotNumber": 500.0 * 0.01 / 15.0,
        "referenceGridSelfDifferenceK": selfdiff,
        "samples": fine,
    }

    lump = {"radius": 0.01, "length": 0.1, "k": 400.0, "rho": 8900.0,
            "cp": 385.0, "h": 50.0, "initial": 400.0, "fluid": 300.0}
    tau = mpf(lump["rho"]) * mpf(lump["cp"]) * mpf(lump["radius"]) / (2 * mpf(lump["h"]))
    ref["lumpedCase"] = {
        "source": "analytic lumped-capacitance exponential, mpmath 50 digits; tau = rho*cp*R/(2h)",
        "diameter": 0.02, "length": 0.1, "solidConductivity": 400.0,
        "solidDensity": 8900.0, "solidCp": 385.0, "heatTransferCoefficient": 50.0,
        "initialTemperature": 400.0, "fluidTemperature": 300.0,
        "biotNumber": 50.0 * 0.01 / 400.0,
        "tauSeconds": float(tau),
        "ratioAtTau": float(mexp(-1)),
        "ratioAtTwoTau": float(mexp(-2)),
    }

    doc = {
        "law": "cylinder-crossflow-transient-reference-v1",
        "generatorSHA256": hashlib.sha256(pathlib.Path(__file__).resolve().read_bytes()).hexdigest(),
        "releaseApproved": False,
        "precision": "lumped values: mpmath 50 digits; gradient values: float64 matrix exponential with recorded grid self-difference",
        "reference": ref,
    }
    OUT.write_text(json.dumps(doc, indent=2) + "\n")
    print(f"wrote {OUT}")
    print("gradient self-difference (K):", selfdiff)
    for s in fine:
        print(s)


if __name__ == "__main__":
    main()
