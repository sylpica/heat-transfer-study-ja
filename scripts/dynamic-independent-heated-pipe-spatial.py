#!/usr/bin/env python3
"""Independent continuous quartic annular averages and a physical steady solve.
Product state is checked at each separate fixed point, not time-marched to steady.
"""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS'):os.environ[key]='1'
from pathlib import Path
from datetime import datetime,timezone
import argparse,hashlib,importlib.util,json,math,subprocess
import numpy as np
from numpy.polynomial import Polynomial
from scipy.sparse.linalg import spsolve
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('independent_pipe_operator',ROOT/'scripts/dynamic-independent-heated-pipe-time.py');operator=importlib.util.module_from_spec(spec);spec.loader.exec_module(operator)

def continuous(c):
    n,nr=c['nx'],c['nr'];R,L=c['radius'],c['width'];q=c['wallHeatFlux'];z=np.linspace(0,1,nr+1);a,b=z[:-1],z[1:];fbar=(a*a+b*b)/2-(a**4+a*a*b*b+b**4)/12-7/24;g=2*q/(c['rho']*c['cp']*c['bulkVelocity']*R);x=(np.arange(n)+.5)*L/n;theta=g*x[None,:]+q*R/c['k']*fbar[:,None];c['inlet']=(300+q*R/c['k']*fbar).tolist();return theta.ravel(),g,fbar

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--tag',default='v1');a=parser.parse_args();assert a.tag.isalnum();out=ROOT/f'docs/dynamic/HEATED_PIPE_SPATIAL_REFERENCE_20261107_{a.tag}.json';assert not out.exists(),'Protect saved result.'
    # Derive the shape derivatives and velocity-weighted bulk with a separate
    # polynomial object and Gaussian integration, including the r=0 limit.
    f=Polynomial([-7/24,0,1,0,-.25]);nodes,weights=np.polynomial.legendre.leggauss(8);z=(nodes+1)/2;weight=(1-z*z)*z;mean=float(np.sum(weights*weight*f(z))/np.sum(weights*weight));nu_from_shape=2/(float(f(1))-mean);laplacian=f.deriv(2)(z)+f.deriv()(z)/z;derivation={'normalizedVelocityWeightedBulkOffset':mean,'wallDerivative':float(f.deriv()(1)),'axisDerivative':float(f.deriv()(0)),'axisRadialLaplacianLimit':float(2*f.deriv(2)(0)),'maximumRadialPolynomialIdentityResidual':float(np.max(abs(laplacian-4*(1-z*z)))),'nuFromIndependentWeightedProfile':nu_from_shape,'exactNu48Over11':48/11}
    references=[];cases=[];rows=[]
    for n in [8,16,32,64]:
        c={'width':5,'radius':.5,'nx':n,'nr':n//2,'rho':1,'cp':100,'k':1,'nu':.01,'bulkVelocity':1,'wallHeatFlux':1,'referenceTemperatureK':300,'maxTemperature':2000,'initial':300};exact,g,fbar=continuous(c);A,cap,F=operator.assemble(c);N=len(cap);K=A[:N,:N];b=A[:N,-1].toarray().ravel();theta=spsolve(K,-b);weights=cap/(c['rho']*c['cp']);rms=math.sqrt(float(np.sum(weights*(theta-exact)**2)/sum(weights)));residual=float(np.max(abs(K@theta+b)));outlet=theta.reshape(c['nr'],n)[:,-1];bulk=float(F@outlet/sum(F));wall=float(outlet[-1]+c['wallHeatFlux']/c['k']*(c['radius']/c['nr'])/2);nu=2*c['radius']*(c['wallHeatFlux']/c['k'])/(wall-bulk)
        row={'id':f'n{n}-r{n//2}','nx':n,'nr':n//2,'volumeWeightedRmsErrorK':rms,'maximumCellMeanErrorK':float(max(abs(theta-exact))),'independentSteadyResidualKPerS':residual,'outletNu':nu,'relativeOutletNuDifference':abs(nu/(48/11)-1),'outletWallTemperatureOffsetK':wall,'outletBulkTemperatureOffsetK':bulk,'trueContinuousOutletCellCenterBulkOffsetK':g*(c['width']-c['width']/n/2),'rowProductMeanBulkIsApproximation':True};rows.append(row);entry={'id':row['id'],'config':c,'temperatureOffsetsK':theta.tolist(),'continuousCellMeanOffsetsK':exact.tolist(),'summary':row};references.append(entry);cases.append({k:entry[k] for k in ['id','config','temperatureOffsetsK']});print(json.dumps(row),flush=True)
    own=json.loads(subprocess.check_output(['node','scripts/dynamic-heated-pipe-fixed-point-check.mjs'],input=json.dumps(cases),cwd=ROOT,text=True));
    for ref,result in zip(references,own['rows']):assert ref['id']==result['id'];ref['actualProductFixedPointCheck']=result
    orders=[math.log2(x['volumeWeightedRmsErrorK']/y['volumeWeightedRmsErrorK']) for x,y in zip(rows,rows[1:])]
    checks={'continuousWeightedBulkAndWallIdentity':abs(mean)<1e-12 and abs(derivation['wallDerivative']-1)<1e-12 and abs(nu_from_shape-48/11)<1e-12,'finestRmsBelow0005K':rows[-1]['volumeWeightedRmsErrorK']<.005,'finalRmsOrderAbove07':orders[-1]>.7,'finestOutletNuWithinHalfPercent':rows[-1]['relativeOutletNuDifference']<.005,'allProductRatesBelow1eMinus10KPerS':all(r['maximumTemperatureRateKPerS']<1e-10 for r in own['rows']),'allProductDriftsBelow1eMinus10K':all(max(r['maximumTemperatureDriftK'],r['maximumOffsetDriftK'])<1e-10 for r in own['rows']),'allProductNuMatchIndependentDiscreteRatio':all(abs(r['outletNu']-row['outletNu'])<1e-10 for r,row in zip(own['rows'],rows)),'allProductEnergyBudgets':all(abs(r['energyErrorJ'])<=r['energyRoundoffBudgetJ'] for r in own['rows'])}
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'criteriaDeclaredAtCommit':'fa4defc','sourceFilesSHA256':own['sourceFilesSHA256'],'referenceGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'independentAssemblyGeneratorSHA256':hashlib.sha256((ROOT/'scripts/dynamic-independent-heated-pipe-time.py').read_bytes()).hexdigest(),'method':'Separate physical annular steady sparse solve against continuous quartic volume averages, polynomial/Gaussian derivation of Nu=48/11. Actual product derivative and one-step fixed-point checks. Product has not been marched from uniform initial temperature to steady in this measurement.','continuousFormula':'T=300+g*x+(q*R/k)*(z^2-z^4/4-7/24), z=r/R, g=2q/(rho*cp*Ub*R). Exact annular area mean used; first-order axial inlet half-cell error remains.','continuousDerivation':derivation,'rows':rows,'rmsOrders':orders,'cases':references,'checks':checks,'allChecksPassed':all(checks.values()),'productTimeToSteadyVerified':False,'realWorkerVerified':False,'GUIVerified':False,'generalPipeCFDApproved':False,'releaseApproved':False}
    with out.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({'output':str(out),'orders':orders,'checks':checks}),flush=True)
    if not result['allChecksPassed']:raise RuntimeError('Saved failed spatial comparison; do not approve')
if __name__=='__main__':main()
