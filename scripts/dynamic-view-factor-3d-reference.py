#!/usr/bin/env python3
"""Independent reference values for 3D box-enclosure view factors.

Two independent evaluation paths are used and cross-checked:

1. Analytic formulas from A Heat Transfer Textbook, 6th ed., Table 10.3:
   case 1 (aligned parallel rectangles) and case 2 (perpendicular
   rectangles sharing a common edge), evaluated with mpmath at 50 digits.
   Every pair of faces in an axis-aligned rectangular box is one of
   these two configurations, so the formulas give the full 6x6 matrix.
   Each matrix is self-checked: row sums must be 1 and reciprocity
   A_i F_ij = A_j F_ji must hold to ~1e-38 or the run aborts.

2. Direct numerical quadrature of the defining double area integral,
   eqn. (10.17a), for selected face pairs.  The face pairs are set up
   from explicit 3D coordinates (origin, in-plane edge vectors, inward
   normal), the shared edge / extents are extracted geometrically from
   the corner sets, and the integral is evaluated with mpmath's own
   adaptive quadrature after exact translation-invariance reductions
   along directions in which the kernel is invariant.  This path shares
   no code with the product module and does not use the Table 10.3
   formulas, so it independently checks both values and face mapping.

No textbook text/images/tables are copied; only the evaluated numbers
and case metadata are recorded.
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import mpmath as mp

mp.mp.dps = 50
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'dynamic' / 'VIEW_FACTOR_3D_REFERENCE_20261107.json'


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


# Face order used everywhere (product module and this generator):
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


def self_check(F, areas):
    worst_row = max(abs(sum(row) - 1) for row in F)
    worst_rec = max(
        abs(areas[i] * F[i][j] - areas[j] * F[j][i])
        for i in range(6) for j in range(6)
    )
    assert worst_row < mp.mpf('1e-38'), worst_row
    assert worst_rec < mp.mpf('1e-38'), worst_rec
    return float(worst_row), float(worst_rec)


# --- Coordinate-explicit quadrature of eqn. (10.17a) -----------------------
# Each face: (origin, u vector, v vector) spanning the rectangle, with
# extents (lu, lv); the inward normal is implied by the box geometry.
def face_defs(X, Y, Z):
    return [
        ((0, 0, 0), (X, 0, 0), (0, Y, 0)),   # 0 bottom
        ((0, 0, Z), (X, 0, 0), (0, Y, 0)),   # 1 top
        ((0, 0, 0), (X, 0, 0), (0, 0, Z)),   # 2 front
        ((0, Y, 0), (X, 0, 0), (0, 0, Z)),   # 3 back
        ((0, 0, 0), (0, Y, 0), (0, 0, Z)),   # 4 left
        ((X, 0, 0), (0, Y, 0), (0, 0, Z)),   # 5 right
    ]


def corners(face):
    o, u, v = face
    return [
        tuple(mp.mpf(o[k]) + a * u[k] + b * v[k] for k in range(3))
        for a in (0, 1) for b in (0, 1)
    ]


def dist(p, q):
    return mp.sqrt(sum((p[k] - q[k]) ** 2 for k in range(3)))


def quad_opposite(fa, fb):
    """F from face fa to the parallel face fb via separation variables."""
    oa, ua, va = fa
    ob, ub, vb = fb
    # separation between the planes along their common normal direction
    c = dist(
        tuple(mp.mpf(oa[k]) for k in range(3)),
        tuple(mp.mpf(ob[k]) for k in range(3)),
    )
    a = mp.sqrt(sum(mp.mpf(x) ** 2 for x in ua))
    b = mp.sqrt(sum(mp.mpf(x) ** 2 for x in va))
    area = a * b

    def integrand(dx, dy):
        s2 = dx * dx + dy * dy + c * c
        return (a - abs(dx)) * (b - abs(dy)) * c * c / s2**2

    val = mp.quad(integrand, [-a, 0, a], [-b, 0, b])
    return val / (mp.pi * area)


def quad_adjacent(fa, fb):
    """F from face fa to adjacent face fb via the shared-edge reduction."""
    ca, cb = corners(fa), corners(fb)
    shared = [p for p in ca if any(dist(p, q) == 0 for q in cb)]
    assert len(shared) == 2, 'faces must share exactly one edge'
    L = dist(shared[0], shared[1])
    axis = tuple((shared[1][k] - shared[0][k]) / L for k in range(3))

    def extent(face_corners):
        # Perpendicular distance from the shared edge line to the far
        # edge of the rectangle (not the diagonal corner distance).
        def perp_distance(p):
            rel = [p[k] - shared[0][k] for k in range(3)]
            along = sum(rel[k] * axis[k] for k in range(3))
            return mp.sqrt(sum((rel[k] - along * axis[k]) ** 2
                               for k in range(3)))
        return max(perp_distance(p) for p in face_corners
                   if all(dist(p, q) > 0 for q in shared))

    e_from = extent(ca)
    e_to = extent(cb)
    phi_star = mp.atan2(e_to, e_from)

    def region(phi_lo, phi_hi, rmax):
        def inner(phi):
            rm = rmax(phi)
            return mp.quad(
                lambda t: mp.cos(phi) * mp.sin(phi) * mp.atan2(L, rm * t) * rm,
                [0, 1],
            )
        return mp.quad(inner, [phi_lo, phi_hi])

    total = (
        region(0, phi_star, lambda phi: e_from / mp.cos(phi))
        + region(phi_star, mp.pi / 2, lambda phi: e_to / mp.sin(phi))
    )
    return total / (mp.pi * e_from)


CASES = [
    ('cube', (1, 1, 1)),
    ('box-2-1-3', (2, 1, 3)),
    ('box-squat-1-1-0.5', (1, 1, 0.5)),
    ('box-mixed-0.5-2-1', (0.5, 2, 1)),
    ('long-20', (1, 20, 1)),
    ('long-100', (1, 100, 1)),
]

QUAD_CHECKS = [
    ('cube', 0, 1), ('cube', 0, 2),
    ('box-2-1-3', 0, 1), ('box-2-1-3', 0, 2), ('box-2-1-3', 2, 0),
    ('box-2-1-3', 0, 4), ('box-2-1-3', 4, 0), ('box-2-1-3', 4, 5),
    ('box-mixed-0.5-2-1', 0, 2), ('box-mixed-0.5-2-1', 2, 4),
]


def main():
    cases = []
    matrices = {}
    for cid, (X, Y, Z) in CASES:
        Xf, Yf, Zf = (mp.mpf(v) for v in (X, Y, Z))
        F = formula_matrix(Xf, Yf, Zf)
        areas = areas_of(Xf, Yf, Zf)
        worst_row, worst_rec = self_check(F, areas)
        matrices[cid] = (F, (Xf, Yf, Zf))
        cases.append({
            'id': cid,
            'dimensions': [X, Y, Z],
            'areas': [float(a) for a in areas],
            'viewFactors': [[float(v) for v in row] for row in F],
            'formulaRowSumMaxError': worst_row,
            'formulaReciprocityMaxError': worst_rec,
        })

    # Quadrature cross-checks run at 30 digits: still far beyond the
    # double-precision values recorded here, and much faster than 50.
    mp.mp.dps = 30
    checks = []
    for cid, i, j in QUAD_CHECKS:
        F, (X, Y, Z) = matrices[cid]
        faces = face_defs(X, Y, Z)
        q = quad_opposite(faces[i], faces[j]) if {i, j} in ({0, 1}, {2, 3}, {4, 5}) \
            else quad_adjacent(faces[i], faces[j])
        checks.append({
            'case': cid, 'from': i, 'to': j,
            'formula': float(F[i][j]),
            'quadrature': float(q),
            'difference': float(abs(q - F[i][j])),
        })

    duct2d = {
        'crossSection': 'unit square',
        'oppositeF': float(mp.sqrt(2) - 1),
        'adjacentF': float(1 - 1 / mp.sqrt(2)),
        'note': 'Infinite-duct (crossed-string) values for the square '
                'cross-section; finite boxes approach them as the '
                'extrusion length grows.',
    }

    script_bytes = Path(__file__).read_bytes()
    payload = {
        'generatedAtUTC': datetime.now(timezone.utc).isoformat(),
        'generatorSHA256': hashlib.sha256(script_bytes).hexdigest(),
        'releaseApproved': False,
        'method': 'Table 10.3 case 1/case 2 analytic formulas at 50-digit '
                  'mpmath precision, self-checked by summation and '
                  'reciprocity; selected entries cross-checked by direct '
                  'quadrature of eqn. (10.17a) from explicit 3D face '
                  'coordinates with mpmath adaptive quadrature at 30-digit '
                  'precision.',
        'faceOrder': ['bottom', 'top', 'front', 'back', 'left', 'right'],
        'cases': cases,
        'quadratureChecks': checks,
        'duct2D': duct2d,
    }
    OUT.write_text(json.dumps(payload, indent=2) + '\n')
    print('wrote', OUT)
    for c in checks:
        print(c['case'], c['from'], '->', c['to'],
              'formula', c['formula'], 'quad', c['quadrature'],
              'diff', c['difference'])


if __name__ == '__main__':
    main()
