#!/usr/bin/env python3
"""Independent polynomial integrals and linear algebra, never a time oracle.

The JS geometry supplies clipped vertices; Fraction integrates those coordinates
exactly as binary rationals. No production centroid/moment/gradient routine is
used for the continuous cell and wall targets. SciPy's solve checks only the
linear algebra on the exported discrete matrix, not a second discretization.
"""
import argparse
from datetime import datetime, timezone
from fractions import Fraction as F
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

# Owner requested single-thread/sequential operation, including this driver's
# local BLAS work. Set before importing NumPy/SciPy; do not launch job pools.
for key in ['OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS']:
    os.environ[key] = '1'
import numpy as np
import scipy
from scipy.linalg import eigvals, solve

ROOT = Path(__file__).resolve().parents[1]
GRIDS = [6, 12, 24, 48]
GEOMETRY_JS = r"""
import {createCutCellGeometry} from './dynamic/dev/cut-cell-geometry.mjs';
const c=Math.cos(.37),s=Math.sin(.37),outline=[[-.2,-.1],[.2,-.1],[.2,.1],[-.2,.1]].map(([x,y])=>[.53+x*c-y*s,.47+x*s+y*c]);
console.log(JSON.stringify([6,12,24,48].map(n=>createCutCellGeometry({width:1,height:1,nx:n,ny:n,outline}))));
"""
SOLVE_JS = r"""
import {readFileSync} from 'node:fs';
import {solveCutCellSteady} from './dynamic/dev/cut-cell-steady.mjs';
const data=JSON.parse(readFileSync(process.argv[1]));
console.log(JSON.stringify(data.map(row=>({nx:row.geometry.nx,runs:['twoPoint','corrected'].map(scheme=>solveCutCellSteady({geometry:row.geometry,k:15,depth:.03,source:60,wallTemperature:row.wallTemperature,scheme}))}))));
"""

def node(source, *args):
    return json.loads(subprocess.run(['node', '--input-type=module', '-e', source, *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout)


def points(values):
    return [tuple(F.from_float(float(v)) for v in p) for p in values]


def cell_mean(vertices):
    p = points(vertices)
    o, area, integral = p[0], F(0), F(0)
    for a, b in zip(p[1:-1], p[2:]):
        triangle_area = ((a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]))/2
        if triangle_area < 0:
            raise ValueError('The integration polygon must be CCW.')
        # Triangle barycentric moments: E(lambda_i^2)=1/6,
        # E(lambda_i lambda_j)=1/12. Integrate T=310-x^2-y^2.
        mean_square = sum((o[k]**2+a[k]**2+b[k]**2+o[k]*a[k]+o[k]*b[k]+a[k]*b[k])/6 for k in [0, 1])
        area += triangle_area
        integral += triangle_area*(310-mean_square)
    if not area > 0:
        raise ValueError('Positive cell area required.')
    return float(integral/area), float(area)


def wall_mean(endpoints):
    a, b = points(endpoints)
    # Integral of the quadratic on a straight segment, parameter t in [0,1].
    return float(310-sum((a[k]**2+a[k]*b[k]+b[k]**2)/3 for k in [0, 1]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT/'docs/dynamic/CUT_CELL_STEADY_REFERENCE_20261106.json')
    args = parser.parse_args()
    geometries = node(GEOMETRY_JS)
    inputs, targets = [], []
    for g in geometries:
        active = [cell for cell in g['cells'] if cell['active']]
        target = [cell_mean(cell['vertices']) for cell in active]
        targets.append({'nx': g['nx'], 'ny': g['ny'], 'activeCellIds': [cell['id'] for cell in active], 'cellMeanTemperatureK': [t for t, a in target], 'cellAreaM2': [a for t, a in target], 'wallTemperatureK': [wall_mean(w['endpoints']) for w in g['wallFragments']]})
        inputs.append({'geometry': g, 'wallTemperature': targets[-1]['wallTemperatureK']})
    with tempfile.TemporaryDirectory(prefix='cut-cell-reference-') as temp:
        payload = Path(temp)/'inputs.json'
        payload.write_text(json.dumps(inputs))
        actual = node(SOLVE_JS, str(payload))
    results = []
    for row, target, raw in zip(inputs, targets, actual):
        area = np.array(target['cellAreaM2'])
        exact = np.array(target['cellMeanTemperatureK'])
        runs = []
        for run in raw['runs']:
            A, b = np.array(run['matrix']), np.array(run['rightHandSideW'])
            x = solve(A, b, assume_a='gen', check_finite=True)
            actual_x = np.array([run['temperatureExcess'][i] for i in target['activeCellIds']])
            actual_t = np.array([run['temperature'][i] for i in target['activeCellIds']])
            error = actual_t-exact
            # rho*cp=1 J/(m^3 K) is an algebraic capacity normalization only.
            rates = A/(area*.03)[:, None]
            eigen = eigvals(rates)
            positive = [(A[i, j], i, j) for i in range(len(A)) for j in range(len(A)) if i != j and A[i, j] > run['matrixProperties']['offDiagonalSignTolerance']]
            counterexample = None
            if positive:
                coefficient, i, j = max(positive)
                dt = 1/np.max(np.sum(np.abs(rates), axis=1))
                counterexample = {'receivingCellId': target['activeCellIds'][i], 'initiallyWarmCellId': target['activeCellIds'][j], 'positiveOffDiagonalWPerK': float(coefficient), 'capacityNormalizationJPerM3K': 1, 'initialWarmExcessK': 1, 'algebraicEulerStepS': float(dt), 'receivingExcessK': float(-dt*rates[i, j]), 'meaning': 'A positive initial excess basis vector has a negative tangent in another cell. This is a matrix maximum-principle counterexample, not an implemented or approved transient integrator.'}
            runs.append({'scheme': run['scheme'], 'areaWeightedRmsErrorK': float(np.sqrt(np.sum(area*error**2)/np.sum(area))), 'maximumCellMeanErrorK': float(np.max(np.abs(error))), 'maximumCellResidualW': run['maximumCellResidualW'], 'globalBalanceErrorW': run['globalBalanceErrorW'], 'totalSourceW': run['totalSourceW'], 'matrixProperties': run['matrixProperties'], 'independentLinearAlgebra': {'library': f'SciPy {scipy.__version__} general LAPACK solve/eigvals; NumPy SVD condition', 'maximumExcessDifferenceK': float(np.max(np.abs(x-actual_x))), 'matrixCondition2': float(np.linalg.cond(A)), 'minimumRealDiffusionEigenvaluePerSAtUnitCapacity': float(np.min(eigen.real)), 'maximumAbsoluteImaginaryEigenvaluePerSAtUnitCapacity': float(np.max(np.abs(eigen.imag))), 'finiteMatricesOnlyNotGeneralStability': True}, 'maximumPrincipleCounterexample': counterexample})
        results.append({**target, 'runs': runs})
    orders = {scheme: [float(np.log2(results[i]['runs'][j]['areaWeightedRmsErrorK']/results[i+1]['runs'][j]['areaWeightedRmsErrorK'])) for i in range(len(results)-1)] for j, scheme in enumerate(['twoPoint', 'corrected'])}
    result = {'generatedAtUTC': datetime.now(timezone.utc).isoformat(), 'recordedClientDate': '2026-11-06 Asia/Tokyo', 'generatorSHA256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'sourceFilesSHA256': {p: hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['dynamic/dev/cut-cell-geometry.mjs', 'dynamic/dev/cut-cell-flux.mjs', 'dynamic/dev/cut-cell-steady.mjs']}, 'continuousPDE': '-k Laplacian(T)=qvol; T=310-x^2-y^2 K; k=15 W/(m K); qvol=60 W/m^3; depth=.03 m', 'continuousTargets': 'Cell and straight wall-segment means from exact binary-rational polynomial integration, rounded once to Float64. Clipped vertices are supplied by the production geometry; geometry accuracy is separately checked.', 'boundaryDiscretization': 'One exact mean per wall fragment, fitted at its midpoint. Not midpoint samples of a quadratic; no exact normal gradient is supplied to the solver.', 'sourceCommitBeforeEdits': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(), 'sourceTreeDirty': True, 'shape': {'width': 1, 'height': 1, 'rotationRadians': .37, 'unrotatedSidesM': [.4, .2], 'centerM': [.53, .47]}, 'grids': results, 'observedAreaWeightedRmsOrders': orders, 'releaseApproved': False, 'scope': 'Small convex all-Dirichlet steady constant-k diagnostic only. Finite-mesh polynomial convergence and independent linear algebra do not verify arbitrary geometry/order, temporal stability, a maximum principle, or public release.'}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'output': str(args.output), 'grids': [{'n': r['nx'], 'cells': len(r['activeCellIds']), 'runs': [{k: v for k, v in run.items() if k not in ['matrixProperties', 'maximumPrincipleCounterexample']} for run in r['runs']]} for r in results], 'orders': orders}, indent=2, allow_nan=False))

if __name__ == '__main__':
    main()
