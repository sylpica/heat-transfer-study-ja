#!/usr/bin/env python3
"""Independent physical face quadrature and affine matrix exponential.

No product transport assembly, RK2 or finite-difference RHS is imported.
"""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS'):os.environ[key]='1'
from pathlib import Path
from datetime import datetime,timezone
import argparse,importlib.util,json,hashlib,subprocess,math,re,platform
import numpy as np
import scipy
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import expm_multiply
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('separate_blasius_reference',ROOT/'scripts/dynamic-independent-blasius-flow.py')
blasius=importlib.util.module_from_spec(spec);spec.loader.exec_module(blasius)

def operator(c,flow_reference):
    nx,ny=c['nx'],c['ny'];N=nx*ny;L,H,D=[c[k] for k in ('width','height','depth')];dx=L/nx;dy=H/ny;capacity=c['rho']*c['cp']*dx*dy*D;G=c['k']*dx*D/dy;delta=c['wallTemperature']-c['inletTemperature']
    qx,qy=blasius.quadrature_flux(c,flow_reference,64);Fx=qx*c['rho']*c['cp'];Fy=qy*c['rho']*c['cp'];rows=[];cols=[];values=[]
    def put(row,col,value):
        rows.append(row);cols.append(col);values.append(float(value))
    constant=N+4
    for j in range(ny):
        for i in range(nx):
            n=j*nx+i
            put(n,n,-(Fx[j,i+1]+Fy[j+1,i]+G*(3 if j in (0,ny-1) else 2))/capacity)
            if i>0:put(n,n-1,Fx[j,i]/capacity)
            if j>0:put(n,n-nx,(Fy[j,i]+G)/capacity)
            else:
                put(n,constant,2*G*delta/capacity);put(N,n,-2*G)
            if j<ny-1:put(n,n+nx,G/capacity)
            else:
                put(N+1,n,-2*G);put(N+3,n,Fy[ny,i])
            if i==nx-1:put(N+2,n,Fx[j,nx])
    put(N,constant,2*G*delta*nx)
    return coo_matrix((values,(rows,cols)),shape=(N+5,N+5)).tocsc(),capacity

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--tag',default='v1');args=parser.parse_args();assert re.fullmatch('[a-z0-9-]{1,32}',args.tag)
    output=ROOT/f'docs/dynamic/FLAT_PLATE_TIME_REFERENCE_20261106_{args.tag}.json';assert not output.exists(),'Protect existing result.'
    bvp=blasius.reference(24)
    own=json.loads(subprocess.check_output(['node','scripts/dynamic-flat-plate-time-cases.mjs'],cwd=ROOT,text=True))
    retained=ROOT/f'work/flat-plate-time-own-20261106-{args.tag}.json'
    with retained.open('x') as stream:json.dump(own,stream)
    c=own['config'];N=c['nx']*c['ny'];matrix,C=operator(c,bvp);initial=np.zeros(N+5);initial[-1]=1
    exact=expm_multiply(matrix*.5,initial);theta=exact[:N];components=exact[N:N+4];net=float(components[0]+components[1]-components[2]-components[3]);storage=C*float(np.sum(theta))
    # Check the augmented rows against independent physical storage algebra.
    probe=initial.copy();probe[:N]=np.linspace(0,20,N);rate=matrix@probe;power=float(rate[N]+rate[N+1]-rate[N+2]-rate[N+3]);identity=float(abs(C*np.sum(rate[:N])-power));assert identity<1e-12
    assert abs(storage-net)<1e-12
    rows=[]
    for case in own['cases']:
        state=case['snapshot'];error=np.array(state['offsetTemperature'])-theta;cum=np.array(state['cumulativeComponentJ'][:4])-components
        row={'factor':case['factor'],'maximumDt':case['maximumDt'],'steps':state['steps'],'timeS':state['time'],'maximumTemperatureErrorK':float(np.max(np.abs(error))),'temperatureRmsErrorK':float(np.sqrt(np.mean(error**2))),'maximumCumulativeComponentDifferenceJ':float(np.max(np.abs(cum))),'netInputDifferenceJ':state['netInputJ']-net,'ownEnergyErrorJ':state['energyErrorJ'],'ownEnergyRoundoffBudgetJ':state['energyRoundoffBudgetJ']};rows.append(row);print(json.dumps(row),flush=True)
    orders=[math.log2(a['maximumTemperatureErrorK']/b['maximumTemperatureErrorK']) for a,b in zip(rows,rows[1:])]
    checks={'finestMaximumDifferenceBelow001K':rows[-1]['maximumTemperatureErrorK']<.001,'finalTimeOrderBetween18And22':1.8<orders[-1]<2.2,'allOwnEnergyBudgets':all(abs(r['ownEnergyErrorJ'])<=r['ownEnergyRoundoffBudgetJ'] for r in rows)}
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'sourceCommit':own['sourceCommit'],'sourceFilesSHA256':own['sourceFilesSHA256'],'referenceGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'independentFlowGeneratorSHA256':hashlib.sha256((ROOT/'scripts/dynamic-independent-blasius-flow.py').read_bytes()).hexdigest(),'criteriaDeclaredAtCommit':'90e3206','method':'Separate SciPy Blasius collocation and continuous face-velocity quadrature, physical upwind/y-diffusion sparse matrix and four affine heat integrals, scipy expm_multiply. Product RK2/RHS/assembly are not reference solvers.','environment':{'product':own['environment'],'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'BLASThreads':1},'config':c,'reference':{'timeS':.5,'temperatureOffsetsK':theta.tolist(),'cumulativeComponentsJ':components.tolist(),'netInputJ':net,'storageChangeJ':storage,'storagePowerIdentityResidualW':identity,'energyResidualJ':storage-net},'rows':rows,'maximumErrorTimeOrders':orders,'checks':checks,'allChecksPassed':all(checks.values()),'continuousThermalSpatialAccuracyVerified':False,'realWorkerVerified':False,'GUIVerified':False,'releaseApproved':False}
    with output.open('x') as stream:json.dump(result,stream,indent=2);stream.write('\n')
    print(json.dumps({'output':str(output),'orders':orders,'checks':checks}),flush=True)
    if not result['allChecksPassed']:raise RuntimeError('Saved failed time comparison; do not approve')

if __name__=='__main__':main()
