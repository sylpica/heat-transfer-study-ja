#!/usr/bin/env python3
"""Independent reference values for the development-only multilayer radial
conduction core (dynamic/dev/radial-multilayer.mjs).

Two kinds of references, neither produced from the product code:
  * steady: exact thermal-resistance-network formulas for concentric
    multilayer cylinders/spheres (log / 1-r resistances, series contact
    resistance, series convection resistance).
  * transient: a fine-grid implicit (backward-Euler) finite-volume solve
    written independently here, on per-layer meshes much finer than the
    product grids, with mesh/time self-convergence differences reported.
    This is a numerical reference, not a closed-form solution.

Run: python3 scripts/dynamic-radial-multilayer-reference.py
Writes docs/dynamic/RADIAL_MULTILAYER_REFERENCE_20261107.json next to the
other dynamic reference files.
"""
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import scipy
from scipy import sparse
from scipy.sparse.linalg import splu

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "dynamic" / "RADIAL_MULTILAYER_REFERENCE_20261107.json"


def git(*args):
    try:
        return subprocess.run(["git", "-C", str(ROOT), *args],
                              capture_output=True, text=True, timeout=30).stdout.strip()
    except Exception:
        return ""


# ---------------------------------------------------------------- steady ---
def steady_network(geometry, length, radii, ks, contact, inner_bc, outer_bc):
    """Exact steady heat rate and interface/surface temperatures.

    inner_bc / outer_bc: ("temperature", T) or ("convection", h, Tamb).
    Returns dict with heatRateW (positive from inner to outer),
    interfaceTemperaturesK, innerSurfaceTemperatureK,
    outerSurfaceTemperatureK.
    """
    dim = 3 if geometry == "sphere" else 2
    resistances = []
    for j, k in enumerate(ks):
        a, b = radii[j], radii[j + 1]
        if dim == 2:
            resistances.append(np.log(b / a) / (2 * np.pi * length * k))
        else:
            resistances.append((1 / a - 1 / b) / (4 * np.pi * k))
    iface_r = []
    for j, rc in enumerate(contact):
        area = (4 * np.pi if dim == 3 else 2 * np.pi * length) * radii[j + 1] ** (dim - 1)
        iface_r.append(rc / area)

    def bc_resistance(bc, radius):
        if bc[0] == "temperature":
            return 0.0, bc[1]
        h, tamb = bc[1], bc[2]
        area = (4 * np.pi if dim == 3 else 2 * np.pi * length) * radius ** (dim - 1)
        return 1.0 / (h * area), tamb

    r_in, t_in_drive = bc_resistance(inner_bc, radii[0])
    r_out, t_out_drive = bc_resistance(outer_bc, radii[-1])
    total = r_in + sum(resistances) + sum(iface_r) + r_out
    q = (t_in_drive - t_out_drive) / total
    temps = []
    t = t_in_drive - q * r_in
    inner_surface = t
    for j in range(len(ks)):
        t -= q * resistances[j]
        if j < len(contact):
            left = t
            t -= q * iface_r[j]
            temps.append((left, t))
    outer_surface = t_out_drive + q * r_out
    return {
        "heatRateW": q,
        "layerResistancesKW": resistances,
        "interfaceResistancesKW": iface_r,
        "innerBoundaryResistanceKW": r_in,
        "outerBoundaryResistanceKW": r_out,
        "interfaceLeftTemperaturesK": [x[0] for x in temps],
        "interfaceRightTemperaturesK": [x[1] for x in temps],
        "innerSurfaceTemperatureK": inner_surface,
        "outerSurfaceTemperatureK": outer_surface,
    }


STEADY_CASES = {
    "cylinderThreeLayer": {
        "geometry": "cylinder", "length": 0.1,
        "radii": [0.002, 0.005, 0.008, 0.012], "ks": [10.0, 1.0, 5.0],
        "contact": [0.0, 0.0],
        "innerBC": ["temperature", 400.0], "outerBC": ["temperature", 300.0],
    },
    "sphereTwoLayerConvection": {
        "geometry": "sphere", "length": None,
        "radii": [0.004, 0.007, 0.011], "ks": [5.0, 0.5],
        "contact": [0.0],
        "innerBC": ["temperature", 380.0], "outerBC": ["convection", 100.0, 290.0],
    },
    "cylinderContactResistance": {
        "geometry": "cylinder", "length": 0.1,
        "radii": [0.003, 0.006, 0.010], "ks": [8.0, 2.0],
        "contact": [0.005],
        "innerBC": ["temperature", 390.0], "outerBC": ["temperature", 310.0],
    },
    "hollowCylinderSteady": {
        "geometry": "cylinder", "length": 0.1,
        "radii": [0.004, 0.008, 0.012], "ks": [5.0, 0.8],
        "contact": [0.0],
        "innerBC": ["temperature", 360.0], "outerBC": ["convection", 50.0, 290.0],
    },
}


# ------------------------------------------------------------- transient ---
def solve_transient(case, cells_per_layer, dt):
    """Backward-Euler FV on a uniform-per-layer mesh. Returns (radii of
    coarse shells requested by caller are handled outside) fine cell
    centres, volumes and temperatures at case['timeS']."""
    geometry = case["geometry"]
    dim = 3 if geometry == "sphere" else 2
    factor = 4 * np.pi if dim == 3 else 2 * np.pi * case["length"]
    radii = case["radii"]
    faces = [radii[0]]
    centres, volumes, caps, layer_of = [], [], [], []
    ks_cell = []
    for j, layer in enumerate(case["layers"]):
        a0 = radii[j]
        dr = (radii[j + 1] - radii[j]) / cells_per_layer
        for i in range(cells_per_layer):
            a, b = a0 + i * dr, a0 + (i + 1) * dr
            faces.append(b)
            centres.append(0.5 * (a + b))
            if dim == 2:
                vol = factor * dr * (a + b) / 2
            else:
                vol = factor * dr * (a * a + a * b + b * b) / 3
            volumes.append(vol)
            caps.append(layer["rho"] * layer["cp"] * vol)
            layer_of.append(j)
            ks_cell.append(layer["k"])
    faces = np.array(faces)
    centres = np.array(centres)
    volumes = np.array(volumes)
    caps = np.array(caps)
    n = len(centres)
    areas = factor * faces ** (dim - 1)
    # conductances between centres
    g = np.zeros(n + 1)  # g[i] = conductance across face i (0..n), boundaries filled below
    layer_bounds = np.cumsum([0] + [cells_per_layer] * len(case["layers"]))
    for i in range(n - 1):
        f = i + 1
        left_layer = layer_of[i]
        if layer_of[i + 1] == left_layer:
            # uniform within layer: centre spacing = layer dr
            lay = case["layers"][left_layer]
            drl = (radii[left_layer + 1] - radii[left_layer]) / cells_per_layer
            g[f] = lay["k"] * areas[f] / drl
        else:
            ll = case["layers"][left_layer]
            rl = case["layers"][left_layer + 1]
            drl = (radii[left_layer + 1] - radii[left_layer]) / cells_per_layer
            drr = (radii[left_layer + 2] - radii[left_layer + 1]) / cells_per_layer
            g[f] = areas[f] / ((drl / 2) / ll["k"] + (drr / 2) / rl["k"])
    # boundary conductances (half-cell in series with convection if needed)
    def boundary_g(bc, layer_idx, face_idx, area):
        lay = case["layers"][layer_idx]
        dr = (radii[layer_idx + 1] - radii[layer_idx]) / cells_per_layer
        gh = 2 * lay["k"] * area / dr
        if bc[0] == "temperature":
            return gh, bc[1], True
        if bc[0] == "convection":
            h, tamb = bc[1], bc[2]
            return 1.0 / (1.0 / gh + 1.0 / (h * area)), tamb, True
        return 0.0, 0.0, False  # insulated

    gin, tin, has_in = boundary_g(case["innerBC"], 0, 0, areas[0]) if radii[0] > 0 else (0.0, 0.0, False)
    gout, tout, has_out = boundary_g(case["outerBC"], len(case["layers"]) - 1, n, areas[n])
    # system matrix (constant in time): (C/dt + K) T = C/dt T_old + bc terms
    main = caps / dt + np.array([ (g[i] if i > 0 else gin) + (g[i + 1] if i < n - 1 else gout) for i in range(n)])
    lower = -g[1:n]
    upper = -g[1:n]
    A = sparse.diags([lower, main, upper], [-1, 0, 1], format="csc")
    lu = splu(A)
    T = np.full(n, case["initialK"])
    steps = int(round(case["timeS"] / dt))
    for _ in range(steps):
        rhs = caps / dt * T
        if has_in:
            rhs[0] += gin * tin
        if has_out:
            rhs[-1] += gout * tout
        T = lu.solve(rhs)
    return centres, volumes, T, layer_bounds


def shell_averages(case, fine_centres, fine_volumes, fine_T, cells_per_layer):
    """Volume-average the fine solution onto uniform per-layer coarse shells."""
    radii = case["radii"]
    out = []
    for j in range(len(case["layers"])):
        a0, b0 = radii[j], radii[j + 1]
        dr = (b0 - a0) / cells_per_layer
        for i in range(cells_per_layer):
            a, b = a0 + i * dr, a0 + (i + 1) * dr
            mask = (fine_centres >= a) & (fine_centres < b if i < cells_per_layer - 1 or j < len(case["layers"]) - 1 else fine_centres <= b)
            w = fine_volumes[mask]
            out.append(float(np.sum(w * fine_T[mask]) / np.sum(w)))
    return out


TRANSIENT_CASES = {
    "sphereTwoLayer": {
        "geometry": "sphere", "length": None,
        "radii": [0.0, 0.006, 0.010],
        "layers": [
            {"k": 10.0, "rho": 1000.0, "cp": 1000.0},
            {"k": 2.0, "rho": 1500.0, "cp": 800.0},
        ],
        "initialK": 373.15,
        "innerBC": ["insulated"],
        "outerBC": ["convection", 500.0, 293.15],
        "timeS": 1.0,
    },
    "hollowCylinderTwoLayer": {
        "geometry": "cylinder", "length": 0.1,
        "radii": [0.004, 0.008, 0.012],
        "layers": [
            {"k": 5.0, "rho": 1200.0, "cp": 900.0},
            {"k": 0.8, "rho": 800.0, "cp": 1200.0},
        ],
        "initialK": 300.0,
        "innerBC": ["temperature", 360.0],
        "outerBC": ["convection", 50.0, 290.0],
        "timeS": 2.0,
    },
}

COARSE_GRIDS = [8, 16, 32]
FINE = 640
FINE_CHECK = 320


def main():
    steady = {}
    for name, case in STEADY_CASES.items():
        res = steady_network(case["geometry"], case["length"], case["radii"],
                             case["ks"], case["contact"], case["innerBC"], case["outerBC"])
        steady[name] = {"config": case, **res}

    transient = {}
    for name, case in TRANSIENT_CASES.items():
        dt = case["timeS"] / 8000
        c_fine, v_fine, t_fine, _ = solve_transient(case, FINE, dt)
        c_check, v_check, t_check, _ = solve_transient(case, FINE_CHECK, dt)
        _, _, t_dt2, _ = solve_transient(case, FINE, dt / 2)
        samples = {}
        for grid in COARSE_GRIDS:
            samples[str(grid)] = shell_averages(case, c_fine, v_fine, t_fine, grid)
        ref32 = np.array(samples["32"])
        check32 = np.array(shell_averages(case, c_check, v_check, t_check, 32))
        dt2_32 = np.array(shell_averages(case, c_fine, v_fine, t_dt2, 32))
        transient[name] = {
            "config": case,
            "fineCellsPerLayer": FINE,
            "dtS": dt,
            "samples": samples,
            "selfConvergence": {
                "meshRmsK_320vs640_on32Shells": float(np.sqrt(np.mean((ref32 - check32) ** 2))),
                "timeRmsK_dtVsHalfDt_on32Shells": float(np.sqrt(np.mean((ref32 - dt2_32) ** 2))),
            },
        }

    script_bytes = Path(__file__).read_bytes()
    doc = {
        "generatedAtUTC": datetime.now(timezone.utc).isoformat(),
        "sourceCommit": git("rev-parse", "HEAD"),
        "reference": ("Steady values are exact resistance-network formulas. Transient values are an "
                      "independent fine-grid backward-Euler finite-volume solve (640 cells/layer) "
                      "with reported mesh/time self-convergence differences; not a closed-form solution."),
        "environment": {"python": sys.version.split()[0], "numpy": np.__version__, "scipy": scipy.__version__},
        "generatorSHA256": hashlib.sha256(script_bytes).hexdigest(),
        "generatorTreeDirty": bool(git("status", "--porcelain")),
        "releaseApproved": False,
        "steady": steady,
        "transient": transient,
    }
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")
    print("wrote", OUT)
    for name, case in transient.items():
        print(name, "self-convergence:", case["selfConvergence"])
    for name, case in steady.items():
        print(name, "Q =", case["heatRateW"])


if __name__ == "__main__":
    main()
