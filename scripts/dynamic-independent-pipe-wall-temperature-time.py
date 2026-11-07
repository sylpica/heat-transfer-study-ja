#!/usr/bin/env python3
"""Physical annular FV and affine exponential, independent of product RK2/RHS.
The parabolic mass flux is integrated from its radial primitive.
"""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS'):os.environ[key]='1'
from pathlib import Path
from datetime import datetime,timezone
import argparse,hashlib,json,math,platform,subprocess
import numpy as np
import scipy
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import expm_multiply
ROOT=Path(__file__).resolve().parents[1]

import importlib.util
spec=importlib.util.spec_from_file_location('independent_annular_base',ROOT/'scripts/dynamic-independent-heated-pipe-time.py');annular=importlib.util.module_from_spec(spec);spec.loader.exec_module(annular)

def assemble(c):
    # Independent physical annular base. Add Dirichlet wall heat as a
    # temperature-dependent flux, including its full accumulated heat rows.
    A,cap,F=annular.assemble({**c,'wallHeatFlux':0});A=A.tolil();nx,nr=c['nx'],c['nr'];N=nx*nr;constant=N+4;dx=c['width']/nx;dr=c['radius']/nr;G=c['k']*2*math.pi*c['radius']*dx/(dr/2);wall=c['wallTemperature']-c['referenceTemperatureK']
    for i in range(nx):
        n=(nr-1)*nx+i
        A[n,n]-=G/cap[n];A[n,constant]+=G*wall/cap[n]
        for row in [N,N+3]:A[row,n]-=G;A[row,constant]+=G*wall
    return A.tocsc(),cap,F

def main():
    p=argparse.ArgumentParser();p.add_argument('--tag',default='v1');a=p.parse_args();assert a.tag.isalnum();out=ROOT/f'docs/dynamic/PIPE_WALL_TEMPERATURE_TIME_REFERENCE_20261107_{a.tag}.json';assert not out.exists(),'Protect saved comparison.'
    own=json.loads(subprocess.check_output(['node','scripts/dynamic-pipe-wall-temperature-time-cases.mjs'],cwd=ROOT,text=True));c=own['config'];A,cap,F=assemble(c);N=len(cap);initial=np.zeros(N+5);initial[:N]=np.array(c['initial'])-c['referenceTemperatureK'];initial[-1]=1;exact=expm_multiply(A*own['targetTimeS'],initial);theta=exact[:N];heat=exact[N:N+4];storage=float(cap@(theta-initial[:N]));assert abs(storage-heat[3])<1e-10;assert abs(heat[0]+heat[1]-heat[2]-heat[3])<1e-10
    probe=initial.copy();probe[:N]=np.linspace(-.5,1,N);rate=A@probe;identity=float(cap@rate[:N]-rate[N+3]);assert abs(identity)<1e-10
    rows=[]
    for case in own['cases']:
        s=case['snapshot'];error=np.array(s['offsetTemperature'])-theta;diff=np.array(s['cumulativeComponentJ'])-heat;row={'factor':case['factor'],'maximumDt':case['maximumDt'],'steps':s['steps'],'maximumTemperatureErrorK':float(np.max(abs(error))),'volumeWeightedRmsErrorK':math.sqrt(float(np.sum(cap*error**2)/sum(cap))),'maximumCumulativeComponentDifferenceJ':float(np.max(abs(diff))),'ownEnergyErrorJ':s['energyErrorJ'],'ownEnergyRoundoffBudgetJ':s['energyRoundoffBudgetJ']};rows.append(row);print(json.dumps(row),flush=True)
    orders=[math.log2(x['maximumTemperatureErrorK']/y['maximumTemperatureErrorK']) for x,y in zip(rows,rows[1:])]
    checks={'finestMaximumDifferenceBelow001K':rows[-1]['maximumTemperatureErrorK']<.001,'finestAllHeatDifferenceBelow0001J':rows[-1]['maximumCumulativeComponentDifferenceJ']<1e-4,'finalTimeOrderBetween18And22':1.8<orders[-1]<2.2,'allOwnEnergyBudgets':all(abs(r['ownEnergyErrorJ'])<=r['ownEnergyRoundoffBudgetJ'] for r in rows)}
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'sourceCommit':own['sourceCommit'],'sourceTreeDirty':own['sourceTreeDirty'],'sourceFilesSHA256':own['sourceFilesSHA256'],'referenceGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'independentAnnularBaseGeneratorSHA256':hashlib.sha256((ROOT/'scripts/dynamic-independent-heated-pipe-time.py').read_bytes()).hexdigest(),'criteriaDeclaredAtCommit':'b56cab5','method':'Independent physical annular capacities and cylindrical face conduction, parabolic area-flux primitive, physical Dirichlet wall conductance and four affine heat rows, scipy expm_multiply. Product RHS/assembly/SSPRK2 are not reference solvers.','environment':{'node':own['environment']['node'],'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'BLASThreads':1},'config':c,'reference':{'timeS':own['targetTimeS'],'temperatureOffsetsK':theta.tolist(),'cumulativeComponentJ':heat.tolist(),'storageChangeJ':storage,'energyResidualJ':storage-float(heat[3]),'storagePowerIdentityResidualW':identity,'massFlowKgPerS':float(sum(F)/c['cp']),'analyticMassFlowKgPerS':c['rho']*c['bulkVelocity']*math.pi*c['radius']**2},'rows':rows,'maximumErrorTimeOrders':orders,'checks':checks,'allChecksPassed':all(checks.values()),'continuousSpatialAccuracyVerified':False,'realWorkerVerified':False,'GUIVerified':False,'releaseApproved':False}
    with out.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({'output':str(out),'orders':orders,'checks':checks}),flush=True)
    if not result['allChecksPassed']:raise RuntimeError('Saved failed time comparison; do not approve')
if __name__=='__main__':main()
