#!/usr/bin/env python3
"""Independent reference values for the 3D box radiation connector.

The connector under test (dynamic/dev/box-radiation-3d.mjs) obtains its
view factors from a numerical quadrature kernel and its exchange from the
production radiosity network (dynamic/radiation-network.mjs).  This
generator shares no code with either:

1. View factors are evaluated from the analytic formulas of A Heat
   Transfer Textbook, 6th ed., Table 10.3 (case 1: aligned parallel
   rectangles; case 2: perpendicular rectangles sharing a common edge)
   with mpmath at 50 digits.  Every pair of faces of an axis-aligned
   rectangular box is one of these two configurations.  Each matrix is
   self-checked: row sums equal 1 and reciprocity A_i F_ij = A_j F_ji
   holds to ~1e-38 or the run aborts.

2. The radiosity system of the diffuse-gray opaque enclosure,
       J_i = eps_i sigma T_i^4 + (1 - eps_i) sum_j F_ij J_j,
   is solved with mpmath's LU solver at 50 digits.  Irradiation
   G_i = sum_j F_ij J_j, outward net power
   Q_i = A_i (J_i - G_i) = A_i sum_j F_ij (J_i - J_j),
   and pair powers Q_ij = A_i F_ij (J_i - J_j) are recorded.

sigma is the exact SI Stefan-Boltzmann constant 5.670374419e-8, the same
value as the production thermal module.  No textbook text, images or
tables are copied; only evaluated numbers and case metadata are recorded.
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import mpmath as mp

mp.mp.dps = 50
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'dynamic' / 'BOX_RADIATION_3D_REFERENCE_20261107.json'
SIGMA = mp.mpf('5.670374419e-8')


def parallel_formula(a, b, c):
    """Table 10.3 case 1: aligned parallel rectangles a x b separated by c."""
    X = mp.mpf(a) / c
    Y = mp.mpf(b) / c
    return (2 / (mp.pi * X * Y)) * (
        mp.log(mp.sqrt(((1 + X**2) * (1 + Y**2)) / (1 + X**2 + Y**2)))
        + X * mp.sqrt(1 + Y**2) * mp.atan(X / mp.sqrt(1 + Y**2))
        + Y * mp.sqrt(1 + X**2) * mp.atan(Y / mp.sqrt(1 + X**2))
        - X * mp.atan(X)
        - Y * mp.atan(Y)
    )


def perp_formula(ell, w, h):
    """Table 10.3 case 2: perpendicular rectangles with common edge ell.

    Returns F from the (ell x w) rectangle to the (ell x h) rectangle;
    W = w/ell is the normalized extent of the emitting rectangle.
    """
    W = mp.mpf(w) / ell
    H = mp.mpf(h) / ell
    bracket = (
        W * mp.atan(1 / W)
        + H * mp.atan(1 / H)
        - mp.sqrt(H**2 + W**2) * mp.atan(1 / mp.sqrt(H**2 + W**2))
        + mp.mpf(1) / 4 * mp.log(
            ((1 + W**2) * (1 + H**2)) / (1 + W**2 + H**2)
            * (W**2 * (1 + W**2 + H**2) / ((1 + W**2) * (W**2 + H**2))) ** W**2
            * (H**2 * (1 + H**2 + W**2) / ((1 + H**2) * (H**2 + W**2))) ** H**2
        )
    )
    return bracket / (mp.pi * W)


# Face order used everywhere (production modules and this generator):
#   0 bottom (z=0), 1 top (z=Z), 2 front (y=0), 3 back (y=Y),
#   4 left (x=0), 5 right (x=X).  Areas: [XY, XY, XZ, XZ, YZ, YZ].
def formula_matrix(X, Y, Z):
    F = [[mp.mpf(0)] * 6 for _ in range(6)]
    par_xy = parallel_formula(X, Y, Z)
    par_xz = parallel_formula(X, Z, Y)
    par_yz = parallel_formula(Y, Z, X)
    F[0][1] = F[1][0] = par_xy
    F[2][3] = F[3][2] = par_xz
    F[4][5] = F[5][4] = par_yz
    p_x_yz = perp_formula(X, Y, Z)   # bottom/top -> front/back
    p_x_zy = perp_formula(X, Z, Y)   # front/back -> bottom/top
    p_y_xz = perp_formula(Y, X, Z)   # bottom/top -> left/right
    p_y_zx = perp_formula(Y, Z, X)   # left/right -> bottom/top
    p_z_xy = perp_formula(Z, X, Y)   # front/back -> left/right
    p_z_yx = perp_formula(Z, Y, X)   # left/right -> front/back
    for i in (0, 1):
        F[i][2] = F[i][3] = p_x_yz
        F[i][4] = F[i][5] = p_y_xz
    for i in (2, 3):
        F[i][0] = F[i][1] = p_x_zy
        F[i][4] = F[i][5] = p_z_xy
    for i in (4, 5):
        F[i][0] = F[i][1] = p_y_zx
        F[i][2] = F[i][3] = p_z_yx
    return F


def areas_of(X, Y, Z):
    return [X * Y, X * Y, X * Z, X * Z, Y * Z, Y * Z]


def solve_case(case_id, dims, temperatures, emissivities):
    X, Y, Z = (mp.mpf(v) for v in dims)
    F = formula_matrix(X, Y, Z)
    areas = areas_of(X, Y, Z)
    worst_row = max(abs(sum(row) - 1) for row in F)
    worst_rec = max(
        abs(areas[i] * F[i][j] - areas[j] * F[j][i])
        for i in range(6) for j in range(6)
    )
    assert worst_row < mp.mpf('1e-38'), worst_row
    assert worst_rec < mp.mpf('1e-38'), worst_rec
    T = [mp.mpf(v) for v in temperatures]
    E = [mp.mpf(v) for v in emissivities]
    A = mp.matrix(6, 6)
    b = mp.matrix(6, 1)
    for i in range(6):
        for j in range(6):
            A[i, j] = (1 if i == j else 0) - (1 - E[i]) * F[i][j]
        b[i] = E[i] * SIGMA * T[i] ** 4
    J = mp.lu_solve(A, b)
    residual = max(abs(sum(A[i, j] * J[j] for j in range(6)) - b[i]) for i in range(6))
    assert residual < mp.mpf('1e-30'), residual
    G = [sum(F[i][j] * J[j] for j in range(6)) for i in range(6)]
    pair = [[areas[i] * F[i][j] * (J[i] - J[j]) for j in range(6)] for i in range(6)]
    outward = [sum(row) for row in pair]
    balance = sum(outward)
    assert abs(balance) < mp.mpf('1e-25'), balance
    fl = lambda v: float(v)
    return {
        'id': case_id,
        'dimensions': list(dims),
        'temperaturesK': list(temperatures),
        'emissivities': [fl(v) for v in E],
        'areas': [fl(v) for v in areas],
        'viewFactors': [[fl(v) for v in row] for row in F],
        'formulaRowSumMaxError': fl(worst_row),
        'formulaReciprocityMaxError': fl(worst_rec),
        'radiosityWPerM2': [fl(J[i]) for i in range(6)],
        'irradiationWPerM2': [fl(v) for v in G],
        'outwardPowerW': [fl(v) for v in outward],
        'pairPowerW': [[fl(v) for v in row] for row in pair],
        'radiationBalanceW': fl(balance),
    }


def main():
    cases = [
        solve_case(
            'gray-box-2-1-3', (2, 1, 3),
            [600, 300, 400, 350, 500, 450],
            ['0.8', '0.6', '0.9', '0.5', '0.7', '1'],
        ),
        solve_case(
            'black-cube-two-temperatures', (1, 1, 1),
            [600, 300, 300, 300, 300, 300],
            ['1', '1', '1', '1', '1', '1'],
        ),
        solve_case(
            'gray-cube-reradiating-sides', (1, 1, 1),
            [600, 300, 400, 400, 400, 400],
            ['0.8', '0.6', '0', '0', '0', '0'],
        ),
    ]
    script_bytes = Path(__file__).read_bytes()
    result = {
        'generatedAtUTC': datetime.now(timezone.utc).isoformat(),
        'recordedClientDate': '2026-11-07 Asia/Tokyo',
        'generatorSHA256': hashlib.sha256(script_bytes).hexdigest(),
        'generator': 'scripts/dynamic-box-radiation-3d-reference.py',
        'method': 'Table 10.3 analytic view factors (mpmath, 50 digits) plus an independent mpmath LU solve of the diffuse-gray radiosity system; no production kernel or network code.',
        'sigmaWPerM2K4': '5.670374419e-8',
        'faceOrder': ['bottom', 'top', 'front', 'back', 'left', 'right'],
        'cases': cases,
        'releaseApproved': False,
        'scope': 'Axis-aligned rectangular box enclosure; diffuse gray opaque isothermal faces; nonparticipating medium. Instantaneous exchange at the stated face temperatures.',
    }
    OUT.write_text(json.dumps(result, indent=1, ensure_ascii=False) + '\n')
    print(f'wrote {OUT}')
    for c in cases:
        print(c['id'], 'balance', c['radiationBalanceW'],
              'outward', [round(v, 6) for v in c['outwardPowerW']])


if __name__ == '__main__':
    main()
