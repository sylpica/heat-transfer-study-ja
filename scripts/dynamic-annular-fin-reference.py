"""Annular fin reference: 50-digit Bessel steady solutions (derivative heat
checked against an independent closed-form surface integral), plus an
independently assembled finite-volume network whose transient is propagated
with a matrix exponential instead of explicit Euler steps.
No solver code from dynamic/dev/annular-fin.mjs is reused; the network below
is rebuilt from the conservation equations for cross-checking only.
Scalar reference quantities (efficiency, effectiveness, powers, tip
temperature, balance) are evaluated with mpmath at 50 digits. The bulky
cell-average arrays are evaluated from the same closed-form Bessel integral
in float64 (scipy), after an in-generator cross-check against the 50-digit
values; float64 round-off (~1e-13 K) is orders of magnitude below the
discretization errors being measured.
"""
import datetime, hashlib, json, pathlib, platform, subprocess
import mpmath as mp
import numpy as np
from scipy.linalg import expm
from scipy.special import i0 as si0, i1 as si1, k0 as sk0, k1 as sk1

root = pathlib.Path(__file__).resolve().parents[1]
mp.mp.dps = 50

BASE = dict(innerRadius=0.01, outerRadius=0.03, thickness=0.002, k=200.0,
            rho=2700.0, cp=900.0, h=150.0, baseK=400.0, ambientK=300.0,
            initialK=300.0)
GRIDS = [8, 16, 32, 64, 128]
TRANSIENT_TIME_S = 2.0
TRANSIENT_GRID = 16


def solve_coefficients(cfg, tip):
    """50-digit Bessel coefficients A, B of theta = A I0(mr) + B K0(mr)."""
    r1, r2, t = (mp.mpf(str(cfg['innerRadius'])), mp.mpf(str(cfg['outerRadius'])),
                 mp.mpf(str(cfg['thickness'])))
    k, h = mp.mpf(str(cfg['k'])), mp.mpf(str(cfg['h']))
    thb = mp.mpf(str(cfg['baseK'])) - mp.mpf(str(cfg['ambientK']))
    m = mp.sqrt(2 * h / (k * t))
    R = r2 + t / 2 if tip == 'corrected' else r2
    a11, a12, b1 = mp.besseli(0, m * r1), mp.besselk(0, m * r1), thb
    if tip == 'corrected':  # insulated at R: A I1(mR) - B K1(mR) = 0
        a21, a22, b2 = mp.besseli(1, m * R), -mp.besselk(1, m * R), mp.mpf(0)
    else:  # -k theta'(r2) = h theta(r2)
        a21 = -k * m * mp.besseli(1, m * r2) - h * mp.besseli(0, m * r2)
        a22 = k * m * mp.besselk(1, m * r2) - h * mp.besselk(0, m * r2)
        b2 = mp.mpf(0)
    det = a11 * a22 - a12 * a21
    A = (b1 * a22 - a12 * b2) / det
    B = (a11 * b2 - b1 * a21) / det
    return A, B, m, R, thb


def bessel_solution(cfg, tip):
    r1, r2, t = (mp.mpf(str(cfg['innerRadius'])), mp.mpf(str(cfg['outerRadius'])),
                 mp.mpf(str(cfg['thickness'])))
    k, h = mp.mpf(str(cfg['k'])), mp.mpf(str(cfg['h']))
    A, B, m, R, thb = solve_coefficients(cfg, tip)
    theta = lambda r: A * mp.besseli(0, m * r) + B * mp.besselk(0, m * r)
    dtheta = lambda r: m * (A * mp.besseli(1, m * r) - B * mp.besselk(1, m * r))
    q_base = -2 * mp.pi * r1 * t * k * dtheta(r1)
    # Closed-form integral of r*theta(r): A r I1(mr)/m - B r K1(mr)/m.
    integ = lambda r: (A * r * mp.besseli(1, m * r) - B * r * mp.besselk(1, m * r)) / m
    q_surf = 4 * mp.pi * h * (integ(R) - integ(r1))
    if tip == 'convection':
        q_surf += h * 2 * mp.pi * r2 * t * theta(r2)
    assert abs(q_base - q_surf) < mp.mpf('1e-35'), (q_base, q_surf)
    fin_area = (2 * mp.pi * (R * R - r1 * r1) if tip == 'corrected'
                else 2 * mp.pi * (r2 * r2 - r1 * r1) + 2 * mp.pi * r2 * t)
    eta = q_base / (h * fin_area * thb)
    eps = q_base / (h * 2 * mp.pi * r1 * t * thb)
    # Cell averages from the same closed-form integral in float64, with a
    # 50-digit spot check on the coarsest grid.
    Af, Bf, mf, Rf = float(A), float(B), float(m), float(R)
    r1f, amb = cfg['innerRadius'], cfg['ambientK']
    integf = lambda r: (Af * r * si1(mf * r) - Bf * r * sk1(mf * r)) / mf
    cellavg = {}
    for n in GRIDS:
        dr = (Rf - r1f) / n
        edges = np.array([r1f + i * dr for i in range(n + 1)])
        edges[-1] = Rf
        vals = integf(edges)
        means = (vals[1:] - vals[:-1]) / ((edges[1:] ** 2 - edges[:-1] ** 2) / 2)
        cellavg[str(n)] = [float(amb + x) for x in means]
        if n == GRIDS[0]:
            for i in range(n):
                a, b = r1 + i * (R - r1) / n, r1 + (i + 1) * (R - r1) / n
                exact = (integ(b) - integ(a)) / ((b * b - a * a) / 2)
                assert abs(float(exact) - means[i]) < 1e-9, (i, float(exact), means[i])
    return {'mPerM': float(m), 'efficiency': float(eta), 'effectiveness': float(eps),
            'basePowerW': float(q_base), 'surfacePowerW': float(q_surf),
            'balanceDifferenceW': float(abs(q_base - q_surf)),
            'tipTemperatureK': float(mp.mpf(str(cfg['ambientK'])) + theta(r2)),
            'solvedOuterRadiusM': float(R), 'cellAverageK': cellavg}


def network(cfg, tip, n):
    """Independently assembled FV network (centroid nodes, log conductances)."""
    r1, r2, t = cfg['innerRadius'], cfg['outerRadius'], cfg['thickness']
    R = r2 + t / 2 if tip == 'corrected' else r2
    dr = (R - r1) / n
    faces = np.array([r1 + i * dr for i in range(n + 1)])
    faces[-1] = R
    centres = np.array([(2 / 3) * (a * a + a * b + b * b) / (a + b)
                        for a, b in zip(faces[:-1], faces[1:])])
    vols = np.pi * (faces[1:] - faces[:-1]) * (faces[1:] + faces[:-1]) * t
    C = cfg['rho'] * cfg['cp'] * vols
    Gs = cfg['h'] * 2 * vols / t
    Gt = cfg['h'] * 2 * np.pi * r2 * t if tip == 'convection' else 0.0
    G0 = 2 * np.pi * cfg['k'] * t / np.log(centres[0] / r1)
    Gi = np.array([2 * np.pi * cfg['k'] * t / np.log(centres[i + 1] / centres[i])
                   for i in range(n - 1)])
    A = np.zeros((n, n)); b = np.zeros(n)
    for i in range(n):
        left = G0 if i == 0 else Gi[i - 1]
        right = Gi[i] if i < n - 1 else 0.0
        sink = Gs[i] + (Gt if i == n - 1 else 0.0)
        A[i, i] = -(left + right + sink) / C[i]
        if i == 0: b[i] += G0 * cfg['baseK'] / C[i]
        else: A[i, i - 1] = Gi[i - 1] / C[i]
        if i < n - 1: A[i, i + 1] = Gi[i] / C[i]
        b[i] += Gs[i] * cfg['ambientK'] / C[i]
        if i == n - 1: b[i] += Gt * cfg['ambientK'] / C[i]
    return A, b, C


def discrete(cfg, tip):
    steady, transient = {}, None
    for n in GRIDS:
        A, b, _ = network(cfg, tip, n)
        steady[str(n)] = [float(x) for x in np.linalg.solve(A, -b)]
    A, b, _ = network(cfg, tip, TRANSIENT_GRID)
    aug = np.zeros((TRANSIENT_GRID + 1, TRANSIENT_GRID + 1))
    aug[:TRANSIENT_GRID, :TRANSIENT_GRID] = A
    aug[:TRANSIENT_GRID, TRANSIENT_GRID] = b
    e0 = np.concatenate([np.full(TRANSIENT_GRID, cfg['initialK']), [1.0]])
    temp = (expm(aug * TRANSIENT_TIME_S) @ e0)[:TRANSIENT_GRID]
    transient = {'timeS': TRANSIENT_TIME_S, 'cells': TRANSIENT_GRID,
                 'temperatureK': [float(x) for x in temp]}
    return steady, transient


cases = []
for tip in ['convection', 'corrected']:
    cfg = dict(BASE)
    bes = bessel_solution(cfg, tip)
    steady, transient = discrete(cfg, tip)
    cases.append({'name': tip, 'config': {**cfg, 'tipCondition': tip},
                  'besselSteady': bes, 'discreteSteadyK': steady,
                  'discreteTransient': transient})

limits = []
for r1, r2 in [(0.5, 0.55), (2.0, 2.05)]:
    cfg = dict(BASE, innerRadius=r1, outerRadius=r2)
    bes = bessel_solution(cfg, 'corrected')
    m = mp.mpf(str(bes['mPerM']))
    Lc = mp.mpf(str(r2 - r1)) + mp.mpf(str(cfg['thickness'])) / 2
    straight = float(mp.tanh(m * Lc) / (m * Lc))
    limits.append({'config': {**cfg, 'tipCondition': 'corrected'},
                   'besselEfficiency': bes['efficiency'],
                   'straightFinEfficiency': straight,
                   'difference': abs(bes['efficiency'] - straight)})
thin = dict(BASE, outerRadius=0.011)
bes = bessel_solution(thin, 'corrected')
limits.append({'config': {**thin, 'tipCondition': 'corrected'},
               'besselEfficiency': bes['efficiency'],
               'straightFinEfficiency': None, 'difference': None})

print(json.dumps({
    'generatedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'generatorTreeDirty': bool(subprocess.check_output(['git', 'status', '--porcelain', '--', 'scripts/dynamic-annular-fin-reference.py'], cwd=root, text=True).strip()),
    'generatorSHA256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
    'environment': {'python': platform.python_version(), 'mpmath': mp.__version__,
                    'numpy': np.__version__},
    'method': '50-digit Bessel steady solution for both tip treatments; base derivative heat and closed-form surface integral agree to <1e-35 W inside the generator. Cell-average arrays use the same closed-form integral in float64 (scipy), spot-checked against the 50-digit values to <1e-9 K on the coarsest grid. Transient reference is an independently assembled finite-volume network propagated by a scipy matrix exponential (no explicit Euler).',
    'cases': cases, 'limits': limits,
    'expertApproved': False, 'releaseApproved': False, 'passed': True}, indent=2))
