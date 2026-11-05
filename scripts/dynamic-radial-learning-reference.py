"""Independent continuous eigenfunctions with Gaussian shell quadrature.
Developer-only; browser users do not need Python or SciPy.
"""
import datetime, hashlib, json, pathlib, platform, subprocess
import mpmath as mp
import numpy as np
import scipy
from scipy.special import jn_zeros, j0, j1

root = pathlib.Path(__file__).resolve().parents[1]
alpha = 167 / (2700 * 896)
Fo = alpha / .025**2
nodes, weights = np.polynomial.legendre.leggauss(24)
zeros = jn_zeros(0, 32)
mp.mp.dps = 50
assert abs(zeros[0] - float(mp.besseljzero(0, 1))) < 5e-15
rows = {}
for geometry, d in [('sphere', 3), ('cylinder', 2)]:
    def theta(s):
        if geometry == 'sphere':
            return sum(2*(-1)**(m+1)*np.sinc(m*s)*np.exp(-(m*np.pi)**2*Fo) for m in range(1, 33))
        return sum(2*j0(z*s)/(z*j1(z))*np.exp(-z*z*Fo) for z in zeros)
    mean = sum(6/(m*np.pi)**2*np.exp(-(m*np.pi)**2*Fo) for m in range(1, 33)) if d == 3 else sum(4/z**2*np.exp(-z*z*Fo) for z in zeros)
    samples = []
    for n in [32, 64]:
        faces = np.arange(n+1)/n
        averages = []
        for a, b in zip(faces[:-1], faces[1:]):
            s = (a+b)/2 + (b-a)/2*nodes
            averages.append(float(np.dot(weights, theta(s)*s**(d-1))*(b-a)/2 / ((b**d-a**d)/d)))
        assert abs(np.dot(averages, np.diff(faces**d))-mean) < 3e-14
        samples.append({'n': n, 'temperatureK': (293.15+60*np.array(averages)).tolist()})
    rows[geometry] = {'volumeMeanK': 293.15+60*float(mean), 'samples': samples}
print(json.dumps({'generatedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceCommit': subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
    'generatorTreeDirty': bool(subprocess.check_output(['git','status','--porcelain','--','scripts/dynamic-radial-learning-reference.py'],cwd=root,text=True).strip()),
    'generatorSHA256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
    'environment': {'python':platform.python_version(),'scipy':scipy.__version__,'mpmath':mp.__version__},
    'method':'32 continuous eigenfunctions; 24-point Gauss-Legendre quadrature per shell; whole mean separately checked against integrated eigenfunction series. No FVM coefficients reused.',
    'config':{'radiusM':.025,'k':167,'rho':2700,'cp':896,'timeS':1,'initialK':353.15,'surfaceK':293.15},
    'FourierNumber':Fo,'geometry':rows,'expertApproved':False,'passed':True},indent=2))
