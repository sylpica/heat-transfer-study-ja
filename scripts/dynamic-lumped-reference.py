"""Continuous Robin eigenfunctions quantify a lumped approximation's error.
Dimensionless temperature means are independent of a radial FVM grid.
"""
import datetime,hashlib,json,pathlib,platform,subprocess
import numpy as np
import scipy
from scipy.optimize import brentq
from scipy.special import j0,j1,jn_zeros
root=pathlib.Path(__file__).resolve().parents[1];cases=[]
for geometry,dimension in [('sphere',3),('cylinder',2)]:
    for bi_lc in [.01,.05,.1]:
        bi_r=dimension*bi_lc
        if geometry=='sphere':
            roots=np.array([brentq(lambda z:z*np.cos(z)+(bi_r-1)*np.sin(z),i*np.pi+1e-9,(i+1)*np.pi-1e-9,xtol=1e-14) for i in range(128)])
            coefficients=4*(np.sin(roots)-roots*np.cos(roots))/(2*roots-np.sin(2*roots))
            means=3*(np.sin(roots)-roots*np.cos(roots))/roots**3
        else:
            zeros=jn_zeros(0,128);edges=np.r_[1e-10,zeros]
            roots=np.array([brentq(lambda z:z*j1(z)-bi_r*j0(z),edges[i],edges[i+1],xtol=1e-14) for i in range(128)])
            coefficients=2*j1(roots)/(roots*(j0(roots)**2+j1(roots)**2));means=2*j1(roots)/roots
        samples=[]
        for fo in [.1,.5,1,2,5,10]:
            terms=coefficients*means*np.exp(-roots**2*fo);full=float(sum(terms));truncated=float(sum(terms[:64]));assert abs(full-truncated)<1e-12
            lumped=float(np.exp(-dimension*bi_r*fo))
            samples.append({'Fo':fo,'continuousVolumeMeanExcessFraction':full,'lumpedExcessFraction':lumped,'errorNormalizedByInitialExcess':lumped-full,'series64vs128Difference':full-truncated})
        cases.append({'geometry':geometry,'dimension':dimension,'BiLc':bi_lc,'BiRadius':bi_r,'rootCount':128,'samples':samples})
path=pathlib.Path(__file__)
print(json.dumps({'generatedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'generatorTreeDirty':bool(subprocess.check_output(['git','status','--porcelain','--',str(path.relative_to(root))],cwd=root,text=True).strip()),'generatorSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'environment':{'python':platform.python_version(),'scipy':scipy.__version__,'numpy':np.__version__},'method':'Independent continuous Robin sphere/cylinder eigenfunctions, exact volume averages, 128 vs 64 modes. Exact uniform-temperature exponential is compared as an approximation, not used to create the PDE reference.','scope':'No generation, constant properties and fixed prescribed convective h on a full sphere or an adiabatic-ended cylinder. Error normalized by initial temperature excess, not a relative error against a vanishing late temperature excess. Bi<=0.1 is an applicability guideline, not an all-times accuracy guarantee.','cases':cases,'expertApproved':False},indent=2))
