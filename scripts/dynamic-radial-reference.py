"""Independent continuous radial eigenfunction solutions; developer tool only."""
import datetime, hashlib, json, pathlib, platform, subprocess
import mpmath as mp
import numpy as np
import scipy
from scipy.special import jn_zeros, j0, j1
from scipy.optimize import brentq

root = pathlib.Path(__file__).resolve().parents[1]
mp.mp.dps = 50
roots = jn_zeros(0, 32)
assert abs(roots[0] - float(mp.besseljzero(0, 1))) < 5e-15
out = {"generatedAtUTC": datetime.datetime.now(datetime.timezone.utc).isoformat(),
       "sourceCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip(),
       "reference": "Independently evaluated continuous radial heat equation eigenfunctions, integrated over each shell. Not a numerical finite-volume reference solution.",
       "environment": {"python": platform.python_version(), "scipy": scipy.__version__, "mpmath": mp.__version__},
       "generatorSHA256": hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
       "generatorTreeDirty": bool(subprocess.check_output(["git", "status", "--porcelain", "--", "scripts/dynamic-radial-reference.py"], cwd=root, text=True).strip()),
       "geometry": {}, "releaseApproved": False}
Fo = .1
for geometry, dim in [("sphere", 3), ("cylinder", 2)]:
    samples = []
    for n in [16, 32, 64]:
        faces = np.arange(n+1, dtype=float)/n
        a, b = faces[:-1], faces[1:]
        theta = np.zeros(n)
        mean = 0.
        for j in range(32):
            if geometry == "sphere":
                m = j+1; lam = m*np.pi
                # integral s*sin(lambda*s) ds, normalized by integral s² ds
                F = lambda s: -s*np.cos(lam*s)/lam + np.sin(lam*s)/lam**2
                theta += 2/np.pi*(-1)**(m+1)/m*np.exp(-lam**2*Fo)*(F(b)-F(a))/((b**3-a**3)/3)
                mean += 6/lam**2*np.exp(-lam**2*Fo)
            else:
                lam = roots[j]
                theta += 2/(lam*j1(lam))*np.exp(-lam**2*Fo)*2*(b*j1(lam*b)-a*j1(lam*a))/(lam*(b*b-a*a))
                mean += 4/lam**2*np.exp(-lam**2*Fo)
        assert abs(float(theta @ np.diff(faces**dim)) - mean) < 2e-14
        samples.append({"n": n, "FourierNumber": Fo, "temperatureK": (293.15+80*theta).tolist(), "normalizedVolumeMean": mean})
    out["geometry"][geometry] = {"dimension": dim, "radiusM": .01, "k": 10., "rho": 1000., "cp": 1000., "initialK": 373.15, "surfaceK": 293.15, "timeS": 1., "eigenTerms": 32, "samples": samples}
    # Robin surface: Bi=hR/k=0.5. The roots and eigenfunction amplitudes
    # follow the continuous boundary-value problem, not any FVM stencil.
    Bi = .5
    if geometry == "sphere":
        robin_roots = [brentq(lambda z: z*np.cos(z)+(Bi-1)*np.sin(z), j*np.pi+1e-8, (j+1)*np.pi-1e-8, xtol=1e-14) for j in range(32)]
    else:
        robin_roots = [brentq(lambda z: z*j1(z)-Bi*j0(z), 1e-8 if j == 0 else roots[j-1], roots[j], xtol=1e-14) for j in range(32)]
    robin_samples = []
    for n in [16, 32, 64]:
        faces = np.arange(n+1, dtype=float)/n
        a, b = faces[:-1], faces[1:]; theta = np.zeros(n); mean = 0.; surface = 0.
        for lam in robin_roots:
            e = np.exp(-lam**2*Fo)
            if geometry == "sphere":
                C = 4*(np.sin(lam)-lam*np.cos(lam))/(2*lam-np.sin(2*lam))
                F = lambda s: -s*np.cos(lam*s)/lam + np.sin(lam*s)/lam**2
                theta += C/lam*e*(F(b)-F(a))/((b**3-a**3)/3)
                mean += C*3*(np.sin(lam)-lam*np.cos(lam))/lam**3*e
                surface += C*np.sin(lam)/lam*e
            else:
                C = 2*j1(lam)/(lam*(j0(lam)**2+j1(lam)**2))
                theta += C*e*2*(b*j1(lam*b)-a*j1(lam*a))/(lam*(b*b-a*a))
                mean += C*2*j1(lam)/lam*e
                surface += C*j0(lam)*e
        assert abs(float(theta @ np.diff(faces**dim)) - mean) < 2e-14
        robin_samples.append({"n": n, "temperatureK": (293.15+80*theta).tolist(), "surfaceTemperatureK": 293.15+80*surface, "normalizedVolumeMean": mean})
    out["geometry"][geometry]["convection"] = {"Bi_hR_over_k": Bi, "h": 500., "ambientK": 293.15, "firstEigenvalue": robin_roots[0], "samples": robin_samples}
print(json.dumps(out, ensure_ascii=False, indent=2))
