"""Straight fin reference: 50-digit analytic steady solutions for both tip
treatments (convective tip and insulated tip), corrected-length comparison,
plus an independently assembled finite-volume network whose transient is
propagated with a matrix exponential instead of explicit Euler steps.
No solver code from dynamic/dev/fin-convective-tip.mjs is reused; the
network below is rebuilt from the conservation equations for cross-checking
only. Scalar reference quantities are evaluated with mpmath at 50 digits,
including the closed-form cell averages of the analytic profile.
"""
import datetime, hashlib, json, pathlib, platform, subprocess
import mpmath as mp
import numpy as np
from scipy.linalg import expm

root = pathlib.Path(__file__).resolve().parents[1]
mp.mp.dps = 50

GRIDS = [16, 32, 64]
TRANSIENT_GRID = 16

CANON = dict(length=0.1, thickness=0.01, depth=0.01, k=200.0, rho=2700.0,
             cp=900.0, h=25.0, baseK=353.15, ambientK=293.15, initialK=293.15)
STRONG = dict(length=0.02, thickness=0.002, depth=0.05, k=200.0, rho=2700.0,
              cp=900.0, h=25.0, baseK=353.15, ambientK=293.15, initialK=293.15)
CASE_DEFS = [
    ('canonical-convection', CANON, 'convection', 20.0),
    ('canonical-insulated', CANON, 'insulated', 20.0),
    ('strong-tip-convection', STRONG, 'convection', 2.0),
    ('strong-tip-insulated', STRONG, 'insulated', 2.0),
]
# Feiris cross-checked closed-form values for the canonical insulated case
# (k=200, h=25, P=0.04, Ac=1e-4, dT=60, L=0.1, adiabatic tip).
FEIRIS_VERIFIED = {'basePowerW': 5.1663430295, 'efficiency': 0.861057172,
                   'effectiveness': 34.4422869}


def f(x):
    return mp.mpf(str(x))


def analytic(cfg, tip):
    L, t, d = f(cfg['length']), f(cfg['thickness']), f(cfg['depth'])
    k, h = f(cfg['k']), f(cfg['h'])
    Ac, P = t * d, 2 * (t + d)
    thb = f(cfg['baseK']) - f(cfg['ambientK'])
    m = mp.sqrt(h * P / (k * Ac))
    H = h / (m * k) if tip == 'convection' else mp.mpf(0)
    D = mp.cosh(m * L) + H * mp.sinh(m * L)
    theta = lambda x: thb * (mp.cosh(m * (L - x)) + H * mp.sinh(m * (L - x))) / D
    q_base = k * Ac * m * thb * (mp.sinh(m * L) + H * mp.cosh(m * L)) / D
    int_theta = thb * (mp.sinh(m * L) + H * (mp.cosh(m * L) - 1)) / (D * m)
    q_surf = h * P * int_theta + (h * Ac * theta(L) if tip == 'convection' else mp.mpf(0))
    assert abs(q_base - q_surf) < mp.mpf('1e-35'), (q_base, q_surf)
    area = P * L + (Ac if tip == 'convection' else mp.mpf(0))
    eta = q_base / (h * area * thb)
    eps = q_base / (h * Ac * thb)
    cellavg = {}
    for n in GRIDS:
        dx = L / n
        vals = []
        for i in range(n):
            a, b = i * dx, (i + 1) * dx
            integ = (mp.sinh(m * (L - a)) - mp.sinh(m * (L - b))
                     + H * (mp.cosh(m * (L - a)) - mp.cosh(m * (L - b))))
            vals.append(float(f(cfg['ambientK']) + thb * integ / (D * m * dx)))
        cellavg[str(n)] = vals
    out = {'mPerM': float(m), 'tipParameterH': float(H),
           'efficiency': float(eta), 'effectiveness': float(eps),
           'basePowerW': float(q_base), 'surfacePowerW': float(q_surf),
           'balanceDifferenceW': float(abs(q_base - q_surf)),
           'tipFaceTemperatureK': float(f(cfg['ambientK']) + theta(L)),
           'cellAverageK': cellavg}
    if tip == 'convection':
        M = mp.sqrt(h * P * k * Ac) * thb
        Lc = L + Ac / P
        q_ad = M * mp.tanh(m * L)
        q_corr = M * mp.tanh(m * Lc)
        out['correctedLength'] = {
            'correctedLengthM': float(Lc),
            'adiabaticAtLW': float(q_ad),
            'adiabaticAtLcW': float(q_corr),
            'adiabaticAtLRelativeError': float(abs(q_ad - q_base) / q_base),
            'correctedRelativeError': float(abs(q_corr - q_base) / q_base)}
    return out


def network(cfg, tip, n):
    """Independently assembled cell-centred FV network (same physics,
    rebuilt from the conservation equations; no product code reused)."""
    L, Ac = cfg['length'], cfg['thickness'] * cfg['depth']
    P = 2 * (cfg['thickness'] + cfg['depth'])
    dx = L / n
    C = cfg['rho'] * cfg['cp'] * Ac * dx
    G0, Gi = 2 * cfg['k'] * Ac / dx, cfg['k'] * Ac / dx
    Gs = cfg['h'] * P * dx
    Gt = cfg['h'] * Ac if tip == 'convection' else 0.0
    A = np.zeros((n, n)); b = np.zeros(n)
    for i in range(n):
        left = G0 if i == 0 else Gi
        right = Gi if i < n - 1 else 0.0
        sink = Gs + (Gt if i == n - 1 else 0.0)
        A[i, i] = -(left + right + sink) / C
        if i == 0: b[i] += G0 * cfg['baseK'] / C
        else: A[i, i - 1] = Gi / C
        if i < n - 1: A[i, i + 1] = Gi / C
        b[i] += Gs * cfg['ambientK'] / C
        if i == n - 1: b[i] += Gt * cfg['ambientK'] / C
    return A, b


def discrete(cfg, tip, transient_time):
    steady = {}
    for n in GRIDS:
        A, b = network(cfg, tip, n)
        steady[str(n)] = [float(x) for x in np.linalg.solve(A, -b)]
    A, b = network(cfg, tip, TRANSIENT_GRID)
    aug = np.zeros((TRANSIENT_GRID + 1, TRANSIENT_GRID + 1))
    aug[:TRANSIENT_GRID, :TRANSIENT_GRID] = A
    aug[:TRANSIENT_GRID, TRANSIENT_GRID] = b
    e0 = np.concatenate([np.full(TRANSIENT_GRID, cfg['initialK']), [1.0]])
    temp = (expm(aug * transient_time) @ e0)[:TRANSIENT_GRID]
    return steady, {'timeS': transient_time, 'cells': TRANSIENT_GRID,
                    'temperatureK': [float(x) for x in temp]}


cases = []
for name, cfg, tip, ttime in CASE_DEFS:
    ana = analytic(cfg, tip)
    steady, transient = discrete(cfg, tip, ttime)
    cases.append({'name': name, 'config': {**cfg, 'tipCondition': tip},
                  'analyticSteady': ana, 'discreteSteadyK': steady,
                  'discreteTransient': transient})

canon_ins = next(c for c in cases if c['name'] == 'canonical-insulated')
for key, tol in [('basePowerW', 1e-9), ('efficiency', 1e-9), ('effectiveness', 1e-7)]:
    got = canon_ins['analyticSteady'][key]
    assert abs(got - FEIRIS_VERIFIED[key]) < tol, (key, got, FEIRIS_VERIFIED[key])

print(json.dumps({
    'generatedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'generatorTreeDirty': bool(subprocess.check_output(['git', 'status', '--porcelain', '--', 'scripts/dynamic-fin-convective-tip-reference.py'], cwd=root, text=True).strip()),
    'generatorSHA256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
    'environment': {'python': platform.python_version(), 'mpmath': mp.__version__,
                    'numpy': np.__version__},
    'method': '50-digit analytic steady solution: theta(x)/theta_b = [cosh(m(L-x)) + H sinh(m(L-x))] / [cosh(mL) + H sinh(mL)] with H = h/(mk) for a convective tip and H = 0 for an insulated tip; base derivative heat and the closed-form surface integral agree to <1e-35 W inside the generator. Cell averages use the closed-form antiderivative at 50 digits. Transient reference is an independently assembled finite-volume network propagated by a scipy matrix exponential (no explicit Euler). The canonical insulated case is asserted against the previously cross-checked closed-form values (q = 5.1663430295 W, eta = 0.861057172, eps = 34.4422869).',
    'feirisVerifiedCanonicalInsulated': FEIRIS_VERIFIED,
    'cases': cases,
    'expertApproved': False, 'releaseApproved': False, 'passed': True}, indent=2))
