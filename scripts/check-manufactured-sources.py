"""Developer-only independent SymPy check. No Python is needed by app users."""
import hashlib
import json
from pathlib import Path
import subprocess
from datetime import datetime, timezone
import sympy as s

root = Path(__file__).resolve().parents[1]
x, y, t, rho, cp, nu, alpha = s.symbols('x y t rho cp nu alpha', positive=True)
velocityAmplitude = s.symbols('velocityAmplitude', real=True)
psi = velocityAmplitude*s.sin(s.pi*x)**2*s.sin(s.pi*y)**2*s.exp(-t)
u, v = s.diff(psi, y), -s.diff(psi, x)
p = s.Rational(1, 10)*s.cos(2*s.pi*x)*s.cos(2*s.pi*y)*s.exp(-t)
T = 300+s.sin(s.pi*x)*s.cos(s.pi*y)*s.exp(-t)
force = [s.diff(q, t)+u*s.diff(q, x)+v*s.diff(q, y)+s.diff(p, axis)/rho
         -nu*(s.diff(q, x, 2)+s.diff(q, y, 2)) for q, axis in [(u, x), (v, y)]]
heat = rho*cp*(s.diff(T, t)+u*s.diff(T, x)+v*s.diff(T, y)
               -alpha*(s.diff(T, x, 2)+s.diff(T, y, 2)))
assert s.simplify(s.diff(u, x)+s.diff(v, y)) == 0
for axis in [x, y]:
    for boundary in [0, 1]:
        assert s.simplify(u.subs(axis, boundary)) == 0
        assert s.simplify(v.subs(axis, boundary)) == 0
        assert s.simplify(s.diff(p, axis).subs(axis, boundary)) == 0
for boundary in [0, 1]:
    assert s.simplify(T.subs(x, boundary)-300) == 0
    assert s.simplify(s.diff(T, y).subs(y, boundary)) == 0

requests = []
for parameters in [dict(rho=1, cp=1, nu=1, alpha=.2),
                   dict(rho=2, cp=7, nu=.1, alpha=.3),
                   dict(rho=.3, cp=2, nu=.5, alpha=.1)]:
    for point in [[.13, .37, .019], [.66, .28, .01], [.45, .79, .023]]:
        for amplitude in [0, .1, 1]:
            requests.append(dict(parameters={**parameters, 'velocityAmplitude': amplitude}, point=point))
program = """
import {readFileSync} from 'node:fs';
import {manufacturedCavity} from './dynamic/dev/manufactured-cavity.mjs';
const requests=JSON.parse(readFileSync(0,'utf8'));
console.log(JSON.stringify(requests.map(r=>manufacturedCavity(r.parameters).components(...r.point))));
"""
actual = json.loads(subprocess.check_output(
    ['node', '--input-type=module', '-e', program], input=json.dumps(requests),
    cwd=root, text=True))
max_difference = 0.0
for request, row in zip(requests, actual):
    substitutions = dict(zip([x, y, t], request['point']))
    substitutions.update({symbol: request['parameters'][str(symbol)] for symbol in [rho, cp, nu, alpha, velocityAmplitude]})
    expressions = [u, v, p, T, *force, heat, u*s.diff(u,x)+v*s.diff(u,y), u*s.diff(v,x)+v*s.diff(v,y), s.diff(u,x,2)+s.diff(u,y,2), s.diff(v,x,2)+s.diff(v,y,2), s.diff(p,x), s.diff(p,y), s.diff(u,t), s.diff(v,t)]
    values = [*row['velocity'], row['pressure'], row['temperature'], *row['bodyForce'], row['heatSource'], *row['advection'], *row['laplacianVelocity'], *row['pressureGradient'], *row['velocityTimeDerivative']]
    for expression, value in zip(expressions, values):
        expected = float(expression.subs(substitutions))
        difference = abs(value-expected)
        max_difference = max(max_difference, difference)
        assert difference < 1e-10, (request, expression, value, expected)

files = ['dynamic/dev/manufactured-cavity.mjs', 'scripts/check-manufactured-sources.py']
print(json.dumps(dict(
    generatedAtUTC=datetime.now(timezone.utc).isoformat(), sympy=s.__version__,
    scope='Independent symbolic consistency of the manufactured source; not physical model or expert approval.',
    samples=len(requests), maxAbsoluteDifference=max_difference,
    divergenceAndWallsSymbolicallyVerified=True,
    sourceFilesSHA256={path: hashlib.sha256((root/path).read_bytes()).hexdigest() for path in files},
    passed=True), indent=2))
