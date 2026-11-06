"""Own Leveque entrance-asymptote reference for the steady Graetz problem
between parallel plates with a prescribed parabolic velocity profile.

Near a wall the velocity is linear, u = beta*s, with beta = du/dy at the wall
= 6*U/H for plane Poiseuille flow.  With eta = s*(beta/(alpha*x))^(1/3) the
energy equation reduces to a similarity ODE that is solved here from its
definition; no JavaScript operator is reused.

Constant wall temperature: theta'' + (eta^2/3)*theta' = 0, theta(0)=0,
theta(inf)=1 gives theta'(0) = 1 / int_0^inf exp(-eta^3/9) d eta
= 1 / (9^(1/3) * Gamma(4/3)).  The integral is evaluated in closed form and
independently by quadrature.  As a cross-check, the same constant for a
circular tube (beta = 8*U/D) gives 2*theta'(0) = 1.0767..., matching the
1.077 coefficient of the Leveque branch of eq. (7.28) in A Heat Transfer
Textbook, 6th ed. (circular tube, not used for the plate values).

Constant wall heat flux: phi'' + (eta^2/3)*phi' - (eta/3)*phi = 0,
phi'(0) = -1, phi(inf) = 0 is solved by linear-combination shooting with
DOP853; phi(0) is reported for several eta_max to show convergence.

For both cases the local Nusselt number based on Dh = 2H follows
Nu_Dh,x = K * (12 * Gz_x)^(1/3) / K with Gz_x = Re_Dh * Pr * Dh / x, where
K = theta'(0) for constant Tw and K = 1/phi(0) for constant qw.
This script only produces the two dimensionless prefactors
Nu_Dh,x / Gz_x^(1/3):  theta'(0)*12^(1/3) and 12^(1/3)/phi(0).
"""
import datetime, hashlib, json, pathlib, platform, subprocess
import numpy as np
import scipy
from scipy.integrate import quad, solve_ivp
from scipy.special import gamma

ROOT = pathlib.Path(__file__).resolve().parents[1]

# --- constant wall temperature -------------------------------------------
integral_quad, quad_err = quad(lambda e: np.exp(-e**3 / 9.0), 0, np.inf, epsabs=1e-13, epsrel=1e-13, limit=200)
integral_closed = 9.0 ** (1.0 / 3.0) * gamma(4.0 / 3.0)
c_tw = 1.0 / integral_closed
coef_tw = c_tw * 12.0 ** (1.0 / 3.0)

# --- constant wall heat flux ---------------------------------------------
def basis(eta_max):
    def rhs(eta, Y):
        return [Y[1], -(eta**2 / 3.0) * Y[1] + (eta / 3.0) * Y[0]]
    a = solve_ivp(rhs, (0, eta_max), [1.0, 0.0], method='DOP853', rtol=1e-12, atol=1e-14)
    b = solve_ivp(rhs, (0, eta_max), [0.0, -1.0], method='DOP853', rtol=1e-12, atol=1e-14)
    A = -b.y[0, -1] / a.y[0, -1]
    return A

phi0_rows = []
for eta_max in (5.0, 6.0, 7.0, 8.0):
    phi0_rows.append(dict(etaMax=eta_max, phi0=basis(eta_max)))
phi0 = phi0_rows[-1]['phi0']
coef_qw = 12.0 ** (1.0 / 3.0) / phi0

out = dict(
    generatedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    sourceCommit=subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    generatorSHA256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
    environment=dict(python=platform.python_version(), numpy=np.__version__, scipy=scipy.__version__),
    releaseApproved=False,
    method='Similarity reduction of the Leveque entrance problem for plane Poiseuille flow (u ~ beta*s near the wall, beta = 6U/H). Constant-Tw constant from the closed-form integral 9^(1/3)*Gamma(4/3), cross-checked by numerical quadrature. Constant-flux phi(0) from DOP853 linear-combination shooting with eta_max refinement. No JS operator reused.',
    constantWallTemperature=dict(
        thetaPrime0=c_tw,
        integralQuadrature=integral_quad,
        integralQuadratureError=quad_err,
        integralClosedForm=integral_closed,
        nusseltPrefactor=coef_tw,
        pipeCrossCheck2C=2.0 * c_tw,
        pipeCrossCheckSource='A Heat Transfer Textbook 6th ed. eq. (7.28), Leveque branch coefficient 1.077 for a circular tube; geometry differs, used only to validate the similarity constant.',
    ),
    constantWallHeatFlux=dict(
        phi0=phi0,
        phi0ByEtaMax=phi0_rows,
        nusseltPrefactor=coef_qw,
    ),
    definition='Nu_Dh,x = nusseltPrefactor * Gz_x^(1/3) as Gz_x -> infinity, with Gz_x = Re_Dh*Pr*Dh/x and Dh = 2H. Valid only while the thermal layer is thin compared with H (small x* = 1/Gz_x); the solver is compared at finite x* and approaches the prefactor from above.',
)
path = ROOT / 'docs/dynamic/GRAETZ_LEVEQUE_REFERENCE_20261107.json'
path.write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps(dict(thetaPrime0=c_tw, coefTw=coef_tw, phi0=phi0, coefQw=coef_qw, integralQuad=integral_quad, integralClosed=integral_closed), indent=2))
print('wrote', path)
