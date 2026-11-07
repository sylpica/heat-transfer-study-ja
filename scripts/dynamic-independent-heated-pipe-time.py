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

def assemble(c):
    nx,nr=c['nx'],c['nr'];N=nx*nr;constant=N+4;R,L=c['radius'],c['width'];dx=L/nx;r=np.linspace(0,R,nr+1);centers=(r[:-1]+r[1:])/2;area=math.pi*np.diff(r*r);cap=np.repeat(c['rho']*c['cp']*area*dx,nx);reference=c.get('referenceTemperatureK',300);inlet=np.broadcast_to(c['inlet'],nr)-reference
    volume_flux=2*math.pi*c['bulkVelocity']*(np.diff(r*r)-np.diff(r**4)/(2*R*R));F=c['rho']*c['cp']*volume_flux;rows=[];cols=[];values=[]
    def add(a,b,x):rows.append(a);cols.append(b);values.append(float(x))
    for j in range(nr):
        for i in range(nx):
            n=j*nx+i;add(n,n,-F[j]/cap[n])
            if i:add(n,n-1,F[j]/cap[n])
            else:add(n,constant,F[j]*inlet[j]/cap[n]);add(N+1,constant,F[j]*inlet[j]);add(N+3,constant,F[j]*inlet[j])
            if i==nx-1:add(N+2,n,F[j]);add(N+3,n,-F[j])
            if j<nr-1:
                other=n+nx;G=c['k']*2*math.pi*r[j+1]*dx/(centers[j+1]-centers[j]);add(n,n,-G/cap[n]);add(n,other,G/cap[n]);add(other,other,-G/cap[other]);add(other,n,G/cap[other])
            if j==nr-1:
                wall=c['wallHeatFlux']*2*math.pi*R*dx;add(n,constant,wall/cap[n]);add(N,constant,wall);add(N+3,constant,wall)
    return coo_matrix((values,(rows,cols)),shape=(N+5,N+5)).tocsc(),cap,F

def main():
    p=argparse.ArgumentParser();p.add_argument('--tag',default='v1');a=p.parse_args();assert a.tag.isalnum();out=ROOT/f'docs/dynamic/HEATED_PIPE_TIME_REFERENCE_20261107_{a.tag}.json';assert not out.exists(),'Protect saved comparison.'
    own=json.loads(subprocess.check_output(['node','scripts/dynamic-heated-pipe-time-cases.mjs'],cwd=ROOT,text=True));c=own['config'];A,cap,F=assemble(c);N=len(cap);initial=np.zeros(N+5);initial[:N]=np.array(c['initial'])-c['referenceTemperatureK'];initial[-1]=1;exact=expm_multiply(A*own['targetTimeS'],initial);theta=exact[:N];heat=exact[N:N+4];storage=float(cap@(theta-initial[:N]));assert abs(storage-heat[3])<1e-10;assert abs(heat[0]+heat[1]-heat[2]-heat[3])<1e-10
    probe=initial.copy();probe[:N]=np.linspace(-.5,1,N);rate=A@probe;identity=float(cap@rate[:N]-rate[N+3]);assert abs(identity)<1e-10
    rows=[]
    for case in own['cases']:
        s=case['snapshot'];error=np.array(s['offsetTemperature'])-theta;diff=np.array(s['cumulativeComponentJ'])-heat;row={'factor':case['factor'],'maximumDt':case['maximumDt'],'steps':s['steps'],'maximumTemperatureErrorK':float(np.max(abs(error))),'volumeWeightedRmsErrorK':math.sqrt(float(np.sum(cap*error**2)/sum(cap))),'maximumCumulativeComponentDifferenceJ':float(np.max(abs(diff))),'ownEnergyErrorJ':s['energyErrorJ'],'ownEnergyRoundoffBudgetJ':s['energyRoundoffBudgetJ']};rows.append(row);print(json.dumps(row),flush=True)
    orders=[math.log2(x['maximumTemperatureErrorK']/y['maximumTemperatureErrorK']) for x,y in zip(rows,rows[1:])]
    checks={'finestMaximumDifferenceBelow001K':rows[-1]['maximumTemperatureErrorK']<.001,'finestAllHeatDifferenceBelow0001J':rows[-1]['maximumCumulativeComponentDifferenceJ']<1e-4,'finalTimeOrderBetween18And22':1.8<orders[-1]<2.2,'allOwnEnergyBudgets':all(abs(r['ownEnergyErrorJ'])<=r['ownEnergyRoundoffBudgetJ'] for r in rows)}
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'sourceCommit':own['sourceCommit'],'sourceTreeDirty':own['sourceTreeDirty'],'sourceFilesSHA256':own['sourceFilesSHA256'],'referenceGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'criteriaDeclaredAtCommit':'fa4defc','method':'Independent physical annular capacities and cylindrical face conduction, parabolic area-flux primitive and four affine heat rows, scipy expm_multiply. Product RHS/assembly/SSPRK2 are not reference solvers.','environment':{'node':own['environment']['node'],'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'BLASThreads':1},'config':c,'reference':{'timeS':own['targetTimeS'],'temperatureOffsetsK':theta.tolist(),'cumulativeComponentJ':heat.tolist(),'storageChangeJ':storage,'energyResidualJ':storage-float(heat[3]),'storagePowerIdentityResidualW':identity,'massFlowKgPerS':float(sum(F)/c['cp']),'analyticMassFlowKgPerS':c['rho']*c['bulkVelocity']*math.pi*c['radius']**2},'rows':rows,'maximumErrorTimeOrders':orders,'checks':checks,'allChecksPassed':all(checks.values()),'continuousSpatialAccuracyVerified':False,'realWorkerVerified':False,'GUIVerified':False,'releaseApproved':False}
    with out.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({'output':str(out),'orders':orders,'checks':checks}),flush=True)
    if not result['allChecksPassed']:raise RuntimeError('Saved failed time comparison; do not approve')
if __name__=='__main__':main()
