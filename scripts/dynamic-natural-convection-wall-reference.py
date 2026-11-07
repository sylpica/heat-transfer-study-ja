#!/usr/bin/env python3
"""Independent 50-digit reference values for the vertical isothermal plate
laminar natural-convection similarity model (development only).

Formulation (Ostrach similarity form, derived from the boundary-layer
equations (8.8) and (6.40) of A Heat Transfer Textbook, 6th ed., section 8.3):

    eta = (y/x) (Gr_x/4)^(1/4),   psi = 4 nu (Gr_x/4)^(1/4) f(eta),
    theta = (T - Tinf)/(Tw - Tinf)
    f''' + 3 f f'' - 2 (f')^2 + theta = 0
    theta'' + 3 Pr f theta' = 0
    f(0) = f'(0) = 0, theta(0) = 1,  f'(inf) = theta(inf) = 0

so that Nu_x = -theta'(0) (Gr_x/4)^(1/4) and Nu_L = (4/3) Nu_x at x = L.

Primary values are computed by shooting with mpmath at 50 significant
digits (Taylor-method ODE integration).  A second, methodologically
independent solution with scipy solve_bvp (collocation, double precision)
is recorded as a cross-check.  Textbook anchors are evaluated from the
printed equations of the book itself:

    Churchill-Chu laminar correlation  Nu_L = 0.68 + 0.670 Ra_L^(1/4)
        [1 + (0.492/Pr)^(9/16)]^(-4/9)                            (8.13a)
    Squire-Eckert average  Nu_L = 0.678 Ra_L^(1/4)
        [Pr/(0.952 + Pr)]^(1/4)                                   (8.27)
    Raithby-Hollands uniform heat flux average
        Nu_L = (6/5) [Ra*_L Pr/(4 + 9 sqrt(Pr) + 10 Pr)]^(1/5)    (8.44b)
    Churchill-Chu uniform heat flux (Nu >= 5)
        Nu_L = 0.73 (Ra*_L)^(1/5) / [1 + (0.492/Pr)^(9/16)]^(16/45) (8.43b)
        (defined with the mid-plate temperature difference; converted
         here to the mean-difference basis with the factor
         (6/5) 2^(-1/5) from eqns. (8.40)-(8.41) and Fig. 8.9)

The printed local uniform-flux correlation (8.44a) is also recorded; as
printed it is inconsistent with (8.44b) plus eqns. (8.40)-(8.41) by the
factor 0.630 (its own leading coefficient), which this generator measures
and stores instead of silently resolving.

Book examples (properties and g = 9.8 m/s^2 exactly as printed):
    Example 8.1  air, L = 0.30 m, dT = 30 K, Tf = 35 C
    Example 8.3  air, L = 0.40 m, dT = 26 K, Tf = 27 C
    Problem 8.29 printed answer: u_max = 0.35 m/s for Example 8.3.
"""

import hashlib
import json
import signal
from pathlib import Path

import numpy as np
from mpmath import mp, mpf, findroot, odefun
from scipy.integrate import solve_bvp

mp.dps = 50

PR_SET = ["0.1", "0.5", "0.71", "0.72", "1", "2", "7", "10", "100"]


def eta_max_for(pr):
    pr = float(pr)
    if pr < 0.5:
        return mpf(60)
    if pr < 2:
        return mpf(40)
    return mpf(30)


# Starting points for the 50-digit shooting solve, taken from the
# independent JS trapezoidal-collocation solver (a different method in
# double precision).  They only seed findroot; the recorded values are
# the converged 50-digit shooting values, and the scipy solve_bvp
# cross-check below uses its own unrelated analytic initial profiles.
SEEDS = {
    "0.1": ("0.85916718", "-0.2301519241"),
    "0.5": ("0.71315258", "-0.4411669953"),
    "0.71": ("0.67745505", "-0.5020860898"),
    "0.72": ("0.67601953", "-0.5046341853"),
    "1": ("0.64218816", "-0.5671465083"),
    "2": ("0.57126314", "-0.7164667354"),
    "7": ("0.45078041", "-1.0543136299"),
    "10": ("0.41919626", "-1.1693339450"),
    "100": ("0.25169299", "-2.1913742391"),
}

SENSITIVITY_PR = {"0.1", "0.71", "1", "7", "100"}


def solve_mpmath(pr, seed=None):
    """Shooting solution of the Ostrach system at 50 digits."""
    pr = mpf(pr)
    eta_max = eta_max_for(pr)

    def rhs(eta, y):
        f, u, v, th, w = y
        return [u, v, 2 * u * u - 3 * f * v - th, w, -3 * pr * f * w]

    def shoot(a, b):
        # A wrong (a, b) can make the Taylor integrator crawl after a
        # blowing-up trajectory; cap each evaluation at 60 s of CPU
        # time (ITIMER_VIRTUAL, so VM contention does not inflate it)
        # and report such points as infinitely bad so the Newton
        # damping rejects them.
        def handler(signum, frame):
            raise TimeoutError("shoot timeout")
        previous = signal.signal(signal.SIGVTALRM, handler)
        signal.setitimer(signal.ITIMER_VIRTUAL, 60)
        try:
            sol = odefun(rhs, 0, [mpf(0), mpf(0), a, mpf(1), b],
                         tol=mpf("1e-30"), degree=22)
            end = sol(eta_max)
            return end[1], end[3]
        except TimeoutError:
            return mpf("inf"), mpf("inf")
        finally:
            signal.setitimer(signal.ITIMER_VIRTUAL, 0)
            signal.signal(signal.SIGVTALRM, previous)

    def shoot_newton(a, b):
        # Hand-rolled Newton for the 2x2 shooting system.  mpmath's
        # findroot perturbs too finely for the adaptive Taylor
        # integrator to respond measurably (its Jacobian degenerates),
        # so the Jacobian here uses relative perturbations of 1e-6,
        # far above the integrator's response floor (~1e-9), and the
        # iteration stops on the tail residuals themselves.  Steps are
        # damped: a step is accepted only if it lowers the residual.
        fu, ft = shoot(a, b)
        norm = max(abs(fu), abs(ft))
        if not norm < mpf("inf"):
            # One retry guards against a transient stall.
            fu, ft = shoot(a, b)
            norm = max(abs(fu), abs(ft))
        if not norm < mpf("inf"):
            raise RuntimeError("shooting seed does not integrate")
        for _ in range(12):
            if norm < mpf("1e-12"):
                return a, b
            da = mpf("1e-6") * max(1, abs(a))
            db = mpf("1e-6") * max(1, abs(b))
            jau, jat = shoot(a + da, b)
            jbu, jbt = shoot(a, b + db)
            j00 = (jau - fu) / da
            j01 = (jbu - fu) / db
            j10 = (jat - ft) / da
            j11 = (jbt - ft) / db
            det = j00 * j11 - j01 * j10
            if det == 0 or not abs(det) < mpf("inf"):
                raise RuntimeError("singular shooting Jacobian")
            sa = (-fu * j11 + ft * j01) / det
            sb = (-ft * j00 + fu * j10) / det
            accepted = False
            lam = mpf(1)
            for _try in range(6):
                na, nb = a + lam * sa, b + lam * sb
                nu_, nt = shoot(na, nb)
                nn = max(abs(nu_), abs(nt))
                if nn < norm:
                    a, b, fu, ft, norm = na, nb, nu_, nt, nn
                    accepted = True
                    break
                lam /= 2
            if not accepted:
                raise RuntimeError("shooting Newton step rejected")
        if norm >= mpf("1e-10"):
            raise RuntimeError("shooting Newton did not converge")
        return a, b

    if seed is None:
        # NB: str(mpf("7")) is "7.0", not "7"; match seeds by value.
        for key, value in SEEDS.items():
            if mpf(key) == pr:
                seed = value
                break
    if seed is not None:
        a0, b0 = mpf(seed[0]), mpf(seed[1])
    else:
        # Fallback guess for theta'(0) from the Squire-Eckert average
        # (8.27): -theta'(0) = (4 Pr)^(1/4) * (3/4) * 0.678
        # [Pr/(0.952+Pr)]^(1/4).
        a0 = mpf("0.65")
        b0 = (-(4 * pr) ** mpf("0.25") * mpf("0.75") * mpf("0.678")
              * (pr / (mpf("0.952") + pr)) ** mpf("0.25"))
    a, b = shoot_newton(a0, b0)
    sol = odefun(rhs, 0, [mpf(0), mpf(0), a, mpf(1), b],
                 tol=mpf("1e-30"), degree=22)
    # f' maximum: f'' starts at f''(0) > 0 and crosses zero once at the
    # peak.  Bracket the crossing by sampling f'' (short integrations)
    # and refine with a secant solve.
    probes = [mpf("0.25"), mpf("0.5"), mpf("0.75"), mpf(1), mpf("1.5"),
              mpf(2), mpf(3), mpf(4), mpf(6)]
    lo = mpf(0)
    hi = None
    for e in probes:
        if sol(e)[2] < 0:
            hi = e
            break
        lo = e
    if hi is None:
        raise RuntimeError("f'' sign change not bracketed")
    eta_star = findroot(lambda e: sol(e)[2], (lo, hi), tol=mpf("1e-32"))
    fmax = sol(eta_star)[1]
    return {
        "prandtl": pr,
        "etaMax": eta_max,
        "fDoublePrime0": a,
        "thetaPrime0": b,
        "wallTemperatureGradient": -b,
        "fPrimeMax": fmax,
        "etaAtFPrimeMax": eta_star,
        "fInfinity": sol(eta_max)[0],
        "tailFPrime": sol(eta_max)[1],
        "tailTheta": sol(eta_max)[3],
        "solution": sol,
    }


def solve_scipy(pr, eta_max):
    """Independent collocation solution (double precision)."""
    pr = float(pr)
    eta_max = float(eta_max)

    def fun(x, y):
        return np.vstack((
            y[1],
            y[2],
            2 * y[1] ** 2 - 3 * y[0] * y[2] - y[3],
            y[4],
            -3 * pr * y[0] * y[4],
        ))

    def bc(ya, yb):
        return np.array([ya[0], ya[1], ya[3] - 1.0, yb[1], yb[3]])

    # Analytic initial profiles scaled from the Squire-Eckert estimate
    # of -theta'(0) (textbook formula only; no shooting values), then a
    # two-stage solve: loose tolerance first, warm-started refinement.
    b_se = (4 * pr) ** 0.25 * 0.75 * 0.678 * (pr / (0.952 + pr)) ** 0.25
    rate = 0.45 * b_se
    x = np.linspace(0.0, eta_max, 800)
    y = np.zeros((5, x.size))
    u = 0.30 * x * np.exp(-0.5 * x)
    y[1] = u
    y[0] = np.concatenate(([0.0], np.cumsum(0.5 * (u[1:] + u[:-1])
                                           * np.diff(x))))
    y[2] = 0.30 * np.exp(-0.5 * x) * (1 - 0.5 * x)
    y[3] = np.exp(-rate * x)
    y[4] = -rate * np.exp(-rate * x)
    y[3, 0] = 1.0
    sol = solve_bvp(fun, bc, x, y, tol=1e-8, max_nodes=200000)
    if not sol.success:
        raise RuntimeError(f"solve_bvp stage 1 failed for Pr={pr}: "
                           f"{sol.message}")
    x2 = np.linspace(0.0, eta_max, 2000)
    y2 = sol.sol(x2)
    sol = None
    for tol2 in (1e-12, 1e-11, 1e-10):
        trial = solve_bvp(fun, bc, x2, y2, tol=tol2, max_nodes=200000)
        if trial.success:
            sol = trial
            break
    if sol is None:
        raise RuntimeError(f"solve_bvp failed for Pr={pr} at all "
                           f"tolerance levels")
    xs = np.linspace(0.0, eta_max, 20001)
    ys = sol.sol(xs)
    imax = int(np.argmax(ys[1]))
    return {
        "fDoublePrime0": float(sol.y[2, 0]),
        "thetaPrime0": float(sol.y[4, 0]),
        "fPrimeMax": float(ys[1][imax]),
        "etaAtFPrimeMax": float(xs[imax]),
        "fInfinity": float(sol.y[0, -1]),
        "toleranceUsed": tol2,
    }


def churchill_chu_asymptotic_coeff(pr):
    pr = mpf(pr)
    return mpf("0.670") / (
        (1 + (mpf("0.492") / pr) ** (mpf(9) / 16)) ** (mpf(4) / 9))


def churchill_chu_nu(ra, pr):
    pr = mpf(pr)
    return (mpf("0.68") + mpf("0.670") * mpf(ra) ** mpf("0.25")
            / (1 + (mpf("0.492") / pr) ** (mpf(9) / 16)) ** (mpf(4) / 9))


def squire_eckert_coeff(pr):
    pr = mpf(pr)
    return mpf("0.678") * (pr / (mpf("0.952") + pr)) ** mpf("0.25")


def raithby_hollands_uhf_average(ra_star, pr):
    pr = mpf(pr)
    return (mpf(6) / 5) * (mpf(ra_star) * pr
                           / (4 + 9 * pr ** mpf("0.5") + 10 * pr)) ** mpf("0.2")


def raithby_hollands_uhf_local_printed(ra_star, pr):
    """Eqn. (8.44a) exactly as printed in the book."""
    pr = mpf(pr)
    return mpf("0.630") * (mpf(ra_star) * pr
                           / (4 + 9 * pr ** mpf("0.5") + 10 * pr)) ** mpf("0.2")


def churchill_chu_uhf_average(ra_star, pr):
    """Eqn. (8.43b): mid-plate difference basis, converted to mean basis."""
    pr = mpf(pr)
    mid = (mpf("0.73") * mpf(ra_star) ** mpf("0.2")
           / (1 + (mpf("0.492") / pr) ** (mpf(9) / 16)) ** (mpf(16) / 45))
    return mid * (mpf(6) / 5) * mpf(2) ** mpf("-0.2")


def similarity_average_coeff(theta_prime0, pr):
    pr = mpf(pr)
    return (mpf(4) / 3) * (-theta_prime0) / (4 * pr) ** mpf("0.25")


def squire_eckert_velocity(nu_, alpha_, beta_, g_, dt_, length_):
    """Squire-Eckert velocity scale for an example: u_c from (8.19) with
    C1 = 7 Pr/(21 Pr + 20) (the constant implied by eqns. (8.23) and
    (8.24) together) and delta from (8.24); the profile (8.18) peaks at
    eta_delta = 1/3 with u_max = (4/27) u_c.  Problem 8.29's printed
    u_max = 0.35 m/s for Example 8.3 follows this Squire-Eckert route,
    not the exact similarity solution."""
    nu_, alpha_, beta_, g_, dt_, length_ = (
        mpf(repr(v)) for v in (nu_, alpha_, beta_, g_, dt_, length_))
    pr = nu_ / alpha_
    gr = g_ * beta_ * dt_ * length_ ** 3 / nu_ ** 2
    delta_over_l = mpf("3.936") * ((mpf("0.952") + pr)
                                   / (pr ** 2 * gr)) ** mpf("0.25")
    delta = delta_over_l * length_
    c1 = 7 * pr / (21 * pr + 20)
    uc = c1 * g_ * beta_ * dt_ * delta ** 2 / nu_
    return {
        "squireEckertDeltaOverL": num(delta_over_l),
        "squireEckertMaxVelocityAtTop": num(mpf(4) / 27 * uc),
    }


def num(x):
    return float(mpf(x))


def main():
    out = {
        "generatedBy": "scripts/dynamic-natural-convection-wall-reference.py",
        "generatorSHA256": hashlib.sha256(
            Path(__file__).read_bytes()).hexdigest(),
        "precisionDigits": 50,
        "integrationTolerance": "Taylor integration tol 1e-30 at 50-digit "
                                "arithmetic; shooting Newton stops at "
                                "tail residuals below 1e-12",
        "textbook": "A Heat Transfer Textbook, 6th ed. (Lienhard)",
        "initialGuessSource": "findroot starting points are taken from "
                              "the independent JS trapezoidal-collocation "
                              "solver; all recorded values are converged "
                              "50-digit shooting results, cross-checked "
                              "against scipy solve_bvp with unrelated "
                              "analytic initial profiles",
        "releaseApproved": False,
        "reference": {},
    }
    ref = out["reference"]
    target = (Path(__file__).resolve().parent.parent
              / "docs" / "dynamic"
              / "NATURAL_CONVECTION_WALL_REFERENCE_20261107.json")

    def checkpoint():
        # Progressive write so a crash or restart never loses the
        # Prandtl numbers already completed.
        target.write_text(json.dumps(out, indent=2) + "\n")

    similarity = {}
    cross = {}
    # Resume from a checkpoint written by an earlier run of this
    # generator: entries already present in both maps are converged
    # solutions of the same equations with the same settings, so they
    # are reused verbatim.
    if target.exists():
        try:
            previous = json.loads(target.read_text())
            prev_ref = previous.get("reference", {})
            for pr_s in PR_SET:
                if (pr_s in prev_ref.get("similarity", {})
                        and pr_s in prev_ref.get("crossMethodCheck", {})):
                    similarity[pr_s] = prev_ref["similarity"][pr_s]
                    cross[pr_s] = prev_ref["crossMethodCheck"][pr_s]
                    print(f"similarity Pr={pr_s} resumed", flush=True)
        except (ValueError, OSError):
            pass
    for pr_s in PR_SET:
        if pr_s in similarity:
            continue
        r = solve_mpmath(pr_s)
        pr = mpf(pr_s)
        avg_coeff = similarity_average_coeff(r["thetaPrime0"], pr)
        entry = {
            "prandtl": num(pr),
            "etaMax": num(r["etaMax"]),
            "fDoublePrime0": num(r["fDoublePrime0"]),
            "thetaPrime0": num(r["thetaPrime0"]),
            "wallTemperatureGradient": num(r["wallTemperatureGradient"]),
            "fPrimeMax": num(r["fPrimeMax"]),
            "etaAtFPrimeMax": num(r["etaAtFPrimeMax"]),
            "fInfinity": num(r["fInfinity"]),
            "tailFPrimeAbs": num(abs(r["tailFPrime"])),
            "tailThetaAbs": num(abs(r["tailTheta"])),
            "localNuCoeff": num(avg_coeff * mpf(3) / 4),
            "averageNuCoeff": num(avg_coeff),
            "churchillChuAsymptoticAverageCoeff":
                num(churchill_chu_asymptotic_coeff(pr)),
            "squireEckertAverageCoeff": num(squire_eckert_coeff(pr)),
            "ratioSimilarityToChurchillChu":
                num(avg_coeff / churchill_chu_asymptotic_coeff(pr)),
            "ratioSimilarityToSquireEckert":
                num(avg_coeff / squire_eckert_coeff(pr)),
        }
        # etaMax sensitivity: recompute with 1.5x domain (subset only),
        # warm-seeded from the main solve.
        if pr_s in SENSITIVITY_PR:
            r2_eta = r["etaMax"] * mpf("1.5")
            saved = eta_max_for
            globals()["eta_max_for"] = lambda p, _e=r2_eta: _e
            try:
                r2 = solve_mpmath(pr_s, seed=(
                    str(r["fDoublePrime0"]), str(r["thetaPrime0"])))
            finally:
                globals()["eta_max_for"] = saved
            entry["etaMaxSensitivityThetaPrime0"] = num(
                abs(r2["thetaPrime0"] - r["thetaPrime0"]))
        similarity[pr_s] = entry
        print(f"mpmath Pr={pr_s} done", flush=True)

        s = solve_scipy(pr_s, r["etaMax"])
        cross[pr_s] = {
            "scipyToleranceUsed": s["toleranceUsed"],
            "scipyThetaPrime0": s["thetaPrime0"],
            "scipyFDoublePrime0": s["fDoublePrime0"],
            "scipyFPrimeMax": s["fPrimeMax"],
            "relDiffThetaPrime0": num(
                abs(mpf(s["thetaPrime0"]) - r["thetaPrime0"])
                / abs(r["thetaPrime0"])),
            "relDiffFDoublePrime0": num(
                abs(mpf(s["fDoublePrime0"]) - r["fDoublePrime0"])
                / abs(r["fDoublePrime0"])),
            "relDiffFPrimeMax": num(
                abs(mpf(s["fPrimeMax"]) - r["fPrimeMax"]) / r["fPrimeMax"]),
        }
        ref["similarity"] = similarity
        ref["crossMethodCheck"] = cross
        checkpoint()
        print(f"similarity Pr={pr_s} done", flush=True)
    ref["similarity"] = similarity
    ref["crossMethodCheck"] = cross

    # Profile samples at Pr = 0.71 (air) for solver profile checks.
    r71 = solve_mpmath("0.71")
    sol71 = r71["solution"]
    samples = []
    for e in ["0", "0.25", "0.5", "1", "1.5", "2", "3", "4", "6", "8", "10"]:
        y = sol71(mpf(e))
        samples.append({
            "eta": float(e),
            "f": num(y[0]),
            "fPrime": num(y[1]),
            "theta": num(y[3]),
        })
    ref["profileSamplesPr071"] = samples

    def example(nu_, alpha_, k_, beta_, g_, dt_, length_):
        nu_, alpha_, k_, beta_, g_, dt_, length_ = (
            mpf(repr(v)) for v in (nu_, alpha_, k_, beta_, g_, dt_, length_))
        pr = nu_ / alpha_
        ra = g_ * beta_ * dt_ * length_ ** 3 / (nu_ * alpha_)
        sol = solve_mpmath(pr, seed=SEEDS["0.71"])
        avg_coeff = similarity_average_coeff(sol["thetaPrime0"], pr)
        nu_sim = avg_coeff * ra ** mpf("0.25")
        nu_cc = churchill_chu_nu(ra, pr)
        nu_se = squire_eckert_coeff(pr) * ra ** mpf("0.25")
        gr = ra / pr
        u_max = (4 * nu_ / length_) * (gr / 4) ** mpf("0.5") * sol["fPrimeMax"]
        return {
            "prandtlFromProperties": num(pr),
            "rayleigh": num(ra),
            "grashof": num(gr),
            "thetaPrime0": num(sol["thetaPrime0"]),
            "similarityAverageNusselt": num(nu_sim),
            "churchillChuAverageNusselt": num(nu_cc),
            "squireEckertAverageNusselt": num(nu_se),
            "similarityAverageH": num(nu_sim * k_ / length_),
            "similarityAverageHeatFlux": num(nu_sim * k_ / length_ * dt_),
            "maxVelocityAtTop": num(u_max),
            "etaAtMaxVelocity": num(sol["etaAtFPrimeMax"]),
            "yAtMaxVelocity": num(sol["etaAtFPrimeMax"] * length_
                                  / (gr / 4) ** mpf("0.25")),
        }

    ref["example81"] = {
        "source": "Example 8.1 (Churchill-Chu eqn. (8.13a)); book prints "
                  "Ra_L = 6.78e7, Nu_L = 47.33, h = 4.22 W/m^2 K",
        "book": {"rayleigh": 6.78e7, "averageNusselt": 47.33,
                 "averageH": 4.22},
        **example(1.643e-5, 2.315e-5, 0.02672, 0.00325, 9.8, 30.0, 0.30),
    }
    ref["example83"] = {
        "source": "Example 8.3 (Squire-Eckert eqn. (8.27)); book prints "
                  "Ra_L = 1.555e8, Nu_L = 61.25, h = 4.02 W/m^2 K, "
                  "q = 104 W/m^2; Problem 8.29 prints u_max = 0.35 m/s",
        "book": {"rayleigh": 1.555e8, "averageNusselt": 61.25,
                 "averageH": 4.02, "averageHeatFlux": 104.0,
                 "maxVelocityAtTop": 0.35, "deltaOverL": 0.0431},
        **example(1.578e-5, 2.213e-5, 0.02623, 0.00333, 9.8, 26.0, 0.40),
        **squire_eckert_velocity(1.578e-5, 2.213e-5, 0.00333, 9.8, 26.0, 0.40),
    }

    # Uniform heat flux: Example 8.3 fluid, q_w = 100 W/m^2, L = 0.40 m.
    nu_, alpha_, k_, beta_, g_ = (mpf(repr(v)) for v in
                                  (1.578e-5, 2.213e-5, 0.02623, 0.00333, 9.8))
    q_w, length_ = mpf(100), mpf("0.40")
    pr = nu_ / alpha_
    ra_star = g_ * beta_ * q_w * length_ ** 4 / (k_ * nu_ * alpha_)
    nu_rh = raithby_hollands_uhf_average(ra_star, pr)
    dt_mean = q_w * length_ / (k_ * nu_rh)
    local_profile = nu_rh * mpf(5) / 6
    local_printed = raithby_hollands_uhf_local_printed(ra_star, pr)
    nu_cc_uhf = churchill_chu_uhf_average(ra_star, pr)
    ref["uniformHeatFluxCase"] = {
        "source": "Raithby-Hollands eqn. (8.44b) with the Example 8.3 "
                  "fluid at q_w = 100 W/m^2, L = 0.40 m, g = 9.8 m/s^2",
        "heatFlux": 100.0,
        "length": 0.40,
        "prandtl": num(pr),
        "modifiedRayleigh": num(ra_star),
        "averageNusselt": num(nu_rh),
        "meanDeltaT": num(dt_mean),
        "topDeltaT": num(dt_mean * mpf(6) / 5),
        "midDeltaT": num(dt_mean * (mpf(6) / 5) * mpf(2) ** mpf("-0.2")),
        "localNusseltAtTopFromProfile": num(local_profile),
        "localNusseltAtTopPrinted844a": num(local_printed),
        "ratioPrinted844aToProfile": num(local_printed / local_profile),
        "churchillChu843bAverageNusseltMeanBasis": num(nu_cc_uhf),
        "ratioRhToChurchillChu": num(nu_rh / nu_cc_uhf),
        "equivalentRayleigh": num(ra_star / nu_rh),
    }
    sweep = {}
    for pr_s in ["0.1", "0.71", "1", "7", "100"]:
        pr = mpf(pr_s)
        rh = raithby_hollands_uhf_average(mpf("1e10"), pr)
        cc = churchill_chu_uhf_average(mpf("1e10"), pr)
        sweep[pr_s] = {
            "raithbyHollandsAverageCoeff": num(rh / mpf("1e10") ** mpf("0.2")),
            "churchillChu843bAverageCoeffMeanBasis":
                num(cc / mpf("1e10") ** mpf("0.2")),
            "ratio": num(rh / cc),
        }
    ref["uniformHeatFluxCorrelationSweep"] = sweep

    target = (Path(__file__).resolve().parent.parent
              / "docs" / "dynamic"
              / "NATURAL_CONVECTION_WALL_REFERENCE_20261107.json")
    target.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {target}")


if __name__ == "__main__":
    main()
  