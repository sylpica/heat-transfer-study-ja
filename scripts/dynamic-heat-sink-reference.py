"""Own heat-sink reference: full physical N-branch thermal network and continuum fins.
The JS symmetric reduction/Euler implementation is not imported. Fixed-grid
transients use an affine matrix exponential; continuum steady profiles use cosh.
"""
import datetime,hashlib,json,pathlib,platform,subprocess
import numpy as np
import scipy
from scipy.integrate import quad
from scipy.linalg import expm,solve
ROOT=pathlib.Path(__file__).resolve().parents[1]
c=dict(baseWidth=.06,baseDepth=.04,baseThickness=.005,finLength=.03,finThickness=.002,finCount=3,k=167.,rho=2700.,cp=896.,h=25.,ambient=293.15,initialBase=333.15,initialFin=293.15,power=8.,contactResistance=.0002)
N=c['finCount'];area=c['finThickness']*c['baseDepth'];perimeter=2*(c['finThickness']+c['baseDepth']);base_volume=c['baseWidth']*c['baseDepth']*c['baseThickness'];base_capacity=c['rho']*c['cp']*base_volume;exposed_area=c['baseDepth']*(c['baseWidth']-N*c['finThickness']);gb=c['h']*exposed_area
m=np.sqrt(c['h']*perimeter/(c['k']*area));mL=m*c['finLength'];kf=c['k']*area*m*np.tanh(mL);resistance=c['contactResistance']/area;per_fin=1/(resistance+1/kf);gb_total=gb+N*per_fin;theta_base=c['power']/gb_total;theta_root=per_fin*theta_base/kf
steady_temperature=lambda x:c['ambient']+theta_root*np.cosh(m*(c['finLength']-x))/np.cosh(mL)
continuum=dict(baseTemperature=c['ambient']+theta_base,finRootTemperature=c['ambient']+theta_root,finTipTemperature=steady_temperature(c['finLength']),finAdmittanceWPerK=kf,perFinWithContactWPerK=per_fin,totalConductanceWPerK=gb_total,baseToFinPerFinW=per_fin*theta_base,mL=mL,finEfficiency=np.tanh(mL)/mL,transverseBiot=c['h']*(area/perimeter)/c['k'])
out=dict(generatedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceCommit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),generatorSHA256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),environment=dict(python=platform.python_version(),numpy=np.__version__,scipy=scipy.__version__),method='All N physical fin branches are separately assembled into a symmetric conductance matrix and individual capacities. SciPy solve gives discrete steady fields; an augmented matrix exponential integrates the affine full-branch ODE exactly. Continuum fin cosh and contact/base resistance give an independent spatial reference. No JS reduction or Euler reused.',config=c,targetTime=10.,continuumSteady=continuum,references=[],releaseApproved=False,ownerProvidedBenchmark=dict(id='T2-01',sourceSHA256='3688be6cb043ed9b90b52c19adcc293c34704a42542d6554bd5cd746885c4fcb',scope='Owner-provided formula-evaluation benchmark, insulated fin tip and small transverse Bi, eqs 4.41/4.44/4.45/4.53/4.55/4.57. No original figure or source prose reproduced.'))
for n in [8,16,32,64]:
    dx=c['finLength']/n;cf=c['rho']*c['cp']*area*dx;size=1+N*n
    capacities=np.r_[base_capacity,np.full(N*n,cf)]
    K=np.zeros((size,size));external=np.zeros(size);K[0,0]+=gb;external[0]=c['power']
    def connect(a,b,g):
        K[a,a]+=g;K[b,b]+=g;K[a,b]-=g;K[b,a]-=g
    for branch in range(N):
        start=1+branch*n
        connect(0,start,1/(resistance+dx/(2*c['k']*area)))
        for j in range(n):
            K[start+j,start+j]+=c['h']*perimeter*dx
            if j+1<n:connect(start+j,start+j+1,c['k']*area/dx)
    theta=solve(K,external,assume_a='pos');assert np.max(np.abs(K@theta-external))<1e-9
    initial=np.r_[c['initialBase']-c['ambient'],np.full(N*n,c['initialFin']-c['ambient'])]
    generator=np.zeros((size+1,size+1));generator[:size,:size]=-K/capacities[:,None];generator[:size,-1]=external/capacities
    transient=(expm(out['targetTime']*generator)@np.r_[initial,1])[:size]+c['ambient']
    # Re-evaluate with two half-time exponentials, independently of Euler steps.
    half=expm(out['targetTime']/2*generator);refined=(half@half@np.r_[initial,1])[:size]+c['ambient'];assert np.max(np.abs(refined-transient))<1e-9
    steady=theta+c['ambient'];branches=steady[1:].reshape(N,n);transient_branches=transient[1:].reshape(N,n);symmetry=max(np.max(np.ptp(branches,axis=0)),np.max(np.ptp(transient_branches,axis=0)))
    assert symmetry<1e-9
    continuous_means=[quad(steady_temperature,j*dx,(j+1)*dx,epsabs=1e-11,epsrel=1e-13)[0]/dx for j in range(n)]
    errors=np.r_[steady[0]-continuum['baseTemperature'],branches.mean(axis=0)-continuous_means];weights=np.r_[base_capacity,np.full(n,N*cf)]
    out['references'].append(dict(finCells=n,steady=dict(baseTemperature=float(steady[0]),finTemperature=branches.mean(axis=0).tolist()),transient=dict(baseTemperature=float(transient[0]),finTemperature=transient_branches.mean(axis=0).tolist()),continuumFinCellMeans=continuous_means,steadyCapacityWeightedRmsErrorK=float(np.sqrt(np.sum(weights*errors**2)/sum(weights))),steadyMaxErrorK=float(np.max(np.abs(errors))),branchSymmetryMaxK=float(symmetry),matrixExponentialSemigroupMaxDifferenceK=float(np.max(np.abs(refined-transient)))))
print(json.dumps(out,indent=2))
