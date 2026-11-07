#!/usr/bin/env python3
"""Independent regular Graetz eigenmode: 80-digit power series, separate ODE,
then physical annular FV steady solves against exact cell-volume averages.
Product is used only to check its actual fixed points, never as reference.
"""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS'):os.environ[key]='1'
from pathlib import Path
from datetime import datetime,timezone
import hashlib,importlib.util,json,math,subprocess
import numpy as np
import mpmath as mp
from scipy.integrate import solve_ivp
from scipy.sparse.linalg import spsolve
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('independent_cwt',ROOT/'scripts/dynamic-independent-pipe-wall-temperature-time.py');cwt=importlib.util.module_from_spec(spec);spec.loader.exec_module(cwt)
mp.mp.dps=80

def coefficients(lam):
    a=[mp.mpf(1)];previous=mp.mpf(0)
    for n in range(100):a.append(-lam*(a[-1]-previous)/(4*(n+1)**2));previous=a[-2]
    return a

def main():
    out=ROOT/'docs/dynamic/PIPE_WALL_TEMPERATURE_SPATIAL_REFERENCE_20261107_v1.json';assert not out.exists(),'Protect saved result.'
    lam=mp.findroot(lambda l:sum(coefficients(l)),(7,8));a=coefficients(lam);profile=lambda z:sum(an*mp.mpf(z)**(2*n) for n,an in enumerate(a));derivative=sum(2*n*an for n,an in enumerate(a));bulk=4*sum(an*(mp.mpf(1)/(2*n+2)-mp.mpf(1)/(2*n+4)) for n,an in enumerate(a));Nu=2*(-derivative)/bulk
    assert all(profile(mp.mpf(i)/100)>0 for i in range(100)) # No interior nodes: first regular eigenmode.
    eps=1e-6;lf=float(lam);ode=solve_ivp(lambda z,y:[y[1],-y[1]/z-lf*(1-z*z)*y[0]],[eps,1],[1-lf*eps**2/4,-lf*eps/2],rtol=2.3e-14,atol=1e-14,dense_output=True,max_step=.005)
    points=np.linspace(eps,1,201);ode_error=max(abs(ode.sol(z)[0]-float(profile(z))) for z in points);assert ode.success
    gauss_x,gauss_w=np.polynomial.legendre.leggauss(32);z=(gauss_x+1)/2;bulk_gauss=float(np.dot(gauss_w/2,4*z*(1-z*z)*ode.sol(z)[0]));nu_ode=2*(-ode.y[1,-1])/bulk_gauss
    derivation={'eigenvalueLambda80Digit':str(lam),'wallSeriesResidual':float(sum(a)),'firstModeNoInteriorNode':True,'odeVsSeriesMaximumDifference':ode_error,'odeWallResidual':float(ode.y[0,-1]),'velocityWeightedBulkMode':float(bulk),'outwardModeWallDerivative':float(derivative),'NuFromFluxAndBulk':float(Nu),'NuLambdaOver2':float(lam/2),'NuFromSeparateODEAndGaussianBulk':nu_ode,'roundedLiteratureValue':3.66,'roundedValueIsNotExact':True}
    cases=[];rows=[];R=.5;L=5;alpha=.01;U=1;beta=float(lam)*alpha/(2*U*R*R)
    for nx,nr in [(8,4),(16,8),(32,16),(64,32)]:
        radial=[]
        for j in range(nr):
            lo=mp.mpf(j)/nr;hi=mp.mpf(j+1)/nr
            radial.append(float(sum(an*(hi**(2*n+2)-lo**(2*n+2))/((n+1)*(hi*hi-lo*lo)) for n,an in enumerate(a))))
        c={'width':L,'radius':R,'nx':nx,'nr':nr,'rho':1,'cp':100,'k':1,'nu':.01,'bulkVelocity':U,'wallTemperature':300,'inlet':[300-v for v in radial],'initial':300,'referenceTemperatureK':300,'maxTemperature':2000}
        A,cap,F=cwt.assemble(c);N=nx*nr;theta=spsolve(A[:N,:N],-A[:N,-1].toarray().ravel());dx=L/nx;axial=np.array([math.exp(-beta*i*dx)*(-math.expm1(-beta*dx))/(beta*dx) for i in range(nx)]);continuous=(-np.array(radial)[:,None]*axial).ravel();error=theta-continuous;rms=math.sqrt(float(cap@(error*error)/sum(cap)))
        last=theta.reshape(nr,nx)[:,-1];bulk_product=float(F@last/sum(F));q=float(c['k']*(0-last[-1])/(R/nr/2));nu=2*R*q/(c['k']*(0-bulk_product))
        row={'id':f'n{nx}-r{nr}','nx':nx,'nr':nr,'volumeWeightedRmsErrorK':rms,'maximumCellMeanErrorK':float(max(abs(error))),'independentSteadyResidualKPerS':float(max(abs(A[:N,:N]@theta+A[:N,-1].toarray().ravel()))),'outletNu':nu,'relativeOutletNuDifference':abs(nu/float(Nu)-1),'outletBulkOffsetK':bulk_product,'outletWallHeatFluxWPerM2':q,'rowProductMeanBulkIsApproximation':True}
        rows.append(row);cases.append({'id':row['id'],'config':c,'temperatureOffsetsK':theta.tolist(),'continuousCellMeanOffsetsK':continuous.tolist(),'summary':row});print(json.dumps(row),flush=True)
    product=json.loads(subprocess.check_output(['node','scripts/dynamic-pipe-wall-temperature-fixed-point-check.mjs'],input=json.dumps(cases),cwd=ROOT,text=True))
    for c,p in zip(cases,product['rows']):assert c['id']==p['id'];c['actualProductFixedPointCheck']=p
    orders=[math.log2(x['volumeWeightedRmsErrorK']/y['volumeWeightedRmsErrorK']) for x,y in zip(rows,rows[1:])]
    checks={'seriesAndSeparateODE':ode_error<1e-10 and abs(derivation['odeWallResidual'])<1e-10,'fluxBulkAndEigenvalueIdentity':abs(float(Nu-lam/2))<1e-12 and abs(nu_ode-float(Nu))<1e-10,'finestRmsBelow001K':rows[-1]['volumeWeightedRmsErrorK']<.01,'finalRmsOrderAbove07':orders[-1]>.7,'finestOutletNuWithinHalfPercent':rows[-1]['relativeOutletNuDifference']<.005,'allProductRatesBelow1eMinus10KPerS':all(p['maximumTemperatureRateKPerS']<1e-10 for p in product['rows']),'allProductDriftsBelow1eMinus10K':all(max(p['maximumTemperatureDriftK'],p['maximumOffsetDriftK'])<1e-10 for p in product['rows']),'allProductNuMatchIndependentDiscreteRatio':all(abs(p['outletNu']-r['outletNu'])<1e-10 for p,r in zip(product['rows'],rows)),'allProductEnergyBudgets':all(abs(p['energyErrorJ'])<=p['energyRoundoffBudgetJ'] for p in product['rows'])}
    checks={key:bool(value) for key,value in checks.items()}
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'criteriaDeclaredAtCommit':'b56cab5','sourceFilesSHA256':product['sourceFilesSHA256'],'referenceGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'independentAssemblyGeneratorSHA256':hashlib.sha256((ROOT/'scripts/dynamic-independent-pipe-wall-temperature-time.py').read_bytes()).hexdigest(),'independentAnnularBaseGeneratorSHA256':hashlib.sha256((ROOT/'scripts/dynamic-independent-heated-pipe-time.py').read_bytes()).hexdigest(),'method':'80-digit regular eigenfunction power series and separate IVP/Gauss bulk integration; independent physical annular steady FV solve against analytic axial-exponential and annular-volume means. Product checks only derivative and one step at independently solved steady fields.','continuousFormula':'T=Tw-exp(-beta*x)*f(r/R), beta=lambda*alpha/(2*Ub*R^2). (z f\')\'+lambda*z*(1-z^2)*f=0. No product time-to-steady measurement.','continuousDerivation':derivation,'axialDecayRatePerM':beta,'rows':rows,'rmsOrders':orders,'cases':cases,'checks':checks,'allChecksPassed':all(checks.values()),'productTimeToSteadyVerified':False,'realWorkerVerified':False,'GUIVerified':False,'generalPipeCFDApproved':False,'releaseApproved':False}
    payload=json.dumps(result,indent=2)+'\n' # Serialize completely before reserving the result file.
    with out.open('x') as f:f.write(payload)
    print(json.dumps({'output':str(out),'orders':orders,'checks':checks,'derivation':derivation}),flush=True)
    if not result['allChecksPassed']:raise RuntimeError('Saved failed spatial comparison; no approval.')
if __name__=='__main__':main()
