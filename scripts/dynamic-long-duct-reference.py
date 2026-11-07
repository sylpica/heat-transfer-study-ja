#!/usr/bin/env python3
"""Independent long-duct radiation integrals and reduced symmetric transient.
No textbook text/images/tables are copied. Source case metadata is recorded
separately from modern formula evaluation and observed print discrepancies.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
for key in ['OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS']:
    os.environ[key] = '1'
import mpmath as mp
import numpy as np
from numpy.polynomial.legendre import leggauss
from scipy.integrate import solve_ivp
ROOT = Path(__file__).resolve().parents[1]
SIGMA = 5.670374419e-8
PACK_SHA = '3688be6cb043ed9b90b52c19adcc293c34704a42542d6554bd5cd746885c4fcb'


def shapes():
    def regular(n, angle):
        return [[.31+.67*math.cos(angle+2*math.pi*i/n), -.43+.67*math.sin(angle+2*math.pi*i/n)] for i in range(n)]
    return [{'id': 'square', 'outline': [[0,0],[1,0],[1,1],[0,1]]}, {'id': 'provided-T5-01', 'outline': [[0,0],[1,0],[1,2.4],[0,2.4]]}, {'id': 'equilateral', 'outline': [[0,0],[1,0],[.5,math.sqrt(3)/2]]}, {'id': 'regular-pentagon', 'outline': regular(5,.127)}, {'id': 'regular-octagon', 'outline': regular(8,.431)}]


def exact_strings(poly):
    mp.mp.dps = 80
    p = [[mp.mpf(v) for v in point] for point in poly]
    norm = lambda a,b: mp.sqrt(sum((a[k]-b[k])**2 for k in [0,1]))
    lengths = [norm(p[i],p[(i+1)%len(p)]) for i in range(len(p))]
    return [[0.0 if i == j else float((norm(p[i],p[j])+norm(p[(i+1)%len(p)],p[(j+1)%len(p)])-norm(p[i],p[(j+1)%len(p)])-norm(p[(i+1)%len(p)],p[j]))/(2*lengths[i])) for j in range(len(p))] for i in range(len(p))]


def quadrature(poly, order):
    # Kernel after analytic integration in the infinite axial direction:
    # (n_i dot r)(n_j dot -r)/(2 |r|^3). Integrate over the two cross-section
    # segments, then divide by emitter length. This uses no string formula.
    p = np.array(poly)
    edges = np.roll(p,-1,axis=0)-p
    lengths = np.linalg.norm(edges,axis=1)
    normals = np.column_stack([-edges[:,1],edges[:,0]])/lengths[:,None]
    z, w = leggauss(order); z=(z+1)/2; w=w/2
    n=len(p); F=np.zeros((n,n))
    def kernel(r,i,j):
        radius=np.linalg.norm(r,axis=-1)
        return ((r*normals[i]).sum(axis=-1)*(-r*normals[j]).sum(axis=-1))/(2*radius**3)
    for i in range(n):
        for j in range(i+1,n):
            if (i+1)%n==j or (j+1)%n==i:
                # Duffy split of the unit parameter square removes the common
                # endpoint's integrable singularity. Kernel is homogeneous -1,
                # so the radial Jacobian cancels it and its integral is 1.
                shared=p[j] if (i+1)%n==j else p[i]
                ei=p[i]-shared if (i+1)%n==j else p[(i+1)%n]-shared
                ej=p[(j+1)%n]-shared if (i+1)%n==j else p[j]-shared
                r1=z[:,None]*ej-ei; r2=ej-z[:,None]*ei
                G=lengths[i]*lengths[j]*np.sum(w*(kernel(r1,i,j)+kernel(r2,i,j)))
            else:
                a=p[i]+z[:,None]*edges[i]; b=p[j]+z[:,None]*edges[j]
                r=b[None,:,:]-a[:,None,:]
                G=lengths[i]*lengths[j]*np.sum((w[:,None]*w[None,:])*kernel(r,i,j))
            F[i,j]=G/lengths[i]; F[j,i]=G/lengths[j]
    return F


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--pack',type=Path);ap.add_argument('--output',type=Path,default=ROOT/'docs/dynamic/LONG_DUCT_RADIATION_REFERENCE_20261106.json');args=ap.parse_args()
    pack_checked=False
    if args.pack:
        assert hashlib.sha256(args.pack.read_bytes()).hexdigest()==PACK_SHA
        pack_checked=True
    rows=[]
    for item in shapes():
        exact=np.array(exact_strings(item['outline']))
        q64=quadrature(item['outline'],64);q128=quadrature(item['outline'],128)
        assert np.max(np.abs(q128-q64))<2e-11
        assert np.max(np.abs(q128-exact))<2e-11
        rows.append({**item,'viewFactors':exact.tolist(),'referenceArithmetic':'mpmath 80 digits on exact Float64 coordinates','independentIntegralOrder':128,'integralRefinementMaxDifference':float(np.max(np.abs(q128-q64))),'integralVsStringsMaxDifference':float(np.max(np.abs(q128-exact)))})
    # Equilateral unit walls, equal epsilon=.8, C'=500 J/(m K). Two cold
    # walls stay identical. Eliminate their radiosity difference analytically;
    # total energy gives Tc=(1200-Th)/2. Only a scalar nonlinear ODE remains.
    reduced_emissivity=.8/(1+.5*(1-.8))
    times=[0,.25,.5,1,2,4,8]
    def rhs(t,state):
        hot=state[0];cold=(1200-hot)/2
        return [-SIGMA*reduced_emissivity*(hot-cold)*(hot+cold)*(hot*hot+cold*cold)/500]
    a=solve_ivp(rhs,[0,8],[600],method='DOP853',t_eval=times,rtol=1e-11,atol=1e-12)
    b=solve_ivp(rhs,[0,8],[600],method='DOP853',t_eval=times,rtol=1e-12,atol=1e-13)
    assert a.success and b.success
    refinement=float(np.max(np.abs(a.y-b.y)));assert refinement<1e-8
    # Independent 2x2 nodal system for the initial state of Example 10.9(a).
    Eb=lambda t:SIGMA*t**4
    modern=np.linalg.solve([[1,-.14],[-.1,1]],[.3*Eb(400)+.56*Eb(250),.5*Eb(300)+.4*Eb(250)])
    rounded=np.linalg.solve([[1,-.14],[-1,10]],[559.6,3182.5])
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'recordedClientDate':'2026-11-06 Asia/Tokyo','generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'providedPackSHA256':PACK_SHA,'providedPackHashCheckedThisRun':pack_checked,'sourceBeforeEdits':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'geometryCases':rows,'transient':{'outline':shapes()[2]['outline'],'emissivity':.8,'capacityPerLengthJPerMK':500,'initialK':[600,300,300],'maxTemperatureK':700,'timeS':times,'hotWallTemperatureK':b.y[0].tolist(),'eachColdWallTemperatureK':((1200-b.y[0])/2).tolist(),'reference':'Independent scalar reduction of symmetric gray radiosity plus total energy, DOP853; no production time integrator or dense radiosity solve.','referenceToleranceRefinementMaxDifferenceK':refinement},'providedCases':{'T5-01':{'source':'AHTT 6th ed., Table 10.2 case 1; Example 10.9','kind':'provided printed value and own geometry evaluation','stripWidthM':1,'separationM':2.4,'printedViewFactor':.2,'formulaValue':float(1/(mp.sqrt(1+mp.mpf(2.4)**2)+mp.mpf(2.4)))},'T5-04':{'source':'AHTT 6th ed., Problem 10.14 and section 10.3','kind':'crossed-string identity verified by independent angular kernel quadrature'},'T5-08-Example10.9a':{'source':'AHTT 6th ed., section 10.4 Example 10.9; original PDF589/590, printed575/576 viewed as images by root','comparisonScope':'Initial instantaneous exchange with black 250 K virtual side walls. Later finite-capacity evolution is not the prescribed-temperature example.','providedRoundedPairPowerWPerM':46.5,'primaryPrintedPairPowerWPerM':46.53,'primaryPrintedRadiositiesWPerM2':[612.1,379.5],'modernNodalRadiositiesWPerM2':modern.tolist(),'modernFormulaPairPowerWPerM':float(.2*(modern[0]-modern[1])),'printedRoundedSystemSolutionWPerM2':rounded.tolist(),'printedRoundedSystemPairPowerWPerM':float(.2*(rounded[0]-rounded[1])),'primaryPrintedRadiosityResidualAgainstPrintedSystemWPerM2':(np.array([[1,-.14],[-1,10]])@np.array([612.1,379.5])-np.array([559.6,3182.5])).tolist(),'solverIssueStatus':'closed_no_solver_error','status':'Closed as a solver-correct comparison: printed 46.53 W/m versus modern formula 46.62819046 W/m. Preserve the separate original intermediate-arithmetic discrepancy; decimal rounding alone has not been demonstrated. See EXAMPLE_10_9_DISPOSITION_20261106.md.'}},'releaseApproved':False,'scope':'Infinitely long convex straight-wall duct; diffuse gray opaque isothermal faces; nonparticipating medium. No finite end walls, arbitrary 3D/concave/obstructed view factors, or expert approval.'}
    args.output.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print(json.dumps({'output':str(args.output),'quadratureErrors':[{k:r[k] for k in ['id','integralRefinementMaxDifference','integralVsStringsMaxDifference']} for r in rows],'transientRefinementK':refinement,'example10_9_a_modern':result['providedCases']['T5-08-Example10.9a']['modernFormulaPairPowerWPerM']},indent=2))

if __name__=='__main__':main()
