#!/usr/bin/env python3
"""Separate dimensional K/C and affine exponential for solid/fluid temperature.
No product rate assembly or SSPRK2 is used for the reference.
"""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS'):os.environ[key]='1'
import argparse,hashlib,json,math,platform,subprocess
from datetime import datetime,timezone
from pathlib import Path
import numpy as np
import scipy
from scipy.sparse import coo_matrix
from scipy.sparse.linalg import expm_multiply
ROOT=Path(__file__).resolve().parents[1]

def assemble(c):
    nx,nf,ns=c['nx'],c['ny'],c['wallCells'];nr=nf+2*ns;N=nx*nr;constant=N+9;size=constant+1
    dx=c['width']/nx;D=c['depth'];fluid=c['fluid'];solid=c['solid'];ambient=c.get('referenceTemperatureK',300);R=c.get('contactResistance',0)
    active=np.array([ns<=j<ns+nf for j in range(nr)]);dy=np.where(active,c['height']/nf,c['wallThickness']/ns);k=np.array([fluid['k'] if a else solid['k'] for a in active]);rhocp=np.array([fluid['rho']*fluid['cp'] if a else solid['rho']*solid['cp'] for a in active]);cap=np.repeat(rhocp*dx*dy*D,nx)
    lower=np.broadcast_to(c['outerHeatFlux']['lower'],nx);upper=np.broadcast_to(c['outerHeatFlux']['upper'],nx);source=np.broadcast_to(c.get('source',0),N)*np.repeat(dx*dy*D,nx);inlet=np.broadcast_to(c['inlet'],nf)-ambient
    r=[];s=[];v=[]
    def add(i,j,x):r.append(i);s.append(j);v.append(float(x))
    def conduct(a,b,G):
        add(a,a,-G/cap[a]);add(a,b,G/cap[a]);add(b,b,-G/cap[b]);add(b,a,G/cap[b])
    for j in range(nr):
        for i in range(nx):
            n=j*nx+i;add(n,constant,source[n]/cap[n]);add(N+(2 if active[j] else 3),constant,source[n]);add(N+8,constant,source[n])
            if not active[j] and i<nx-1:conduct(n,n+1,k[j]*dy[j]*D/dx)
            if j<nr-1:
                extra=R if active[j]!=active[j+1] else 0
                G=dx*D/(dy[j]/(2*k[j])+dy[j+1]/(2*k[j+1])+extra);conduct(n,n+nx,G)
                if not active[j] and active[j+1]:add(N+6,n,G);add(N+6,n+nx,-G)
                if active[j] and not active[j+1]:add(N+7,n,-G);add(N+7,n+nx,G)
            if j==0 or j==nr-1:
                side=0 if j==0 else 1;watts=(lower if side==0 else upper)[i]*dx*D;add(n,constant,watts/cap[n]);add(N+side,constant,watts);add(N+8,constant,watts)
            if active[j]:
                z0=(j-ns)/nf;z1=(j-ns+1)/nf
                # Analytic integral of the actual parabolic profile over this row.
                volume=c['bulkVelocity']*c['height']*D*(3*(z1*z1-z0*z0)-2*(z1**3-z0**3));F=fluid['rho']*fluid['cp']*volume
                add(n,n,-F/cap[n])
                if i:add(n,n-1,F/cap[n])
                else:add(n,constant,F*inlet[j-ns]/cap[n]);add(N+4,constant,F*inlet[j-ns]);add(N+8,constant,F*inlet[j-ns])
                if i==nx-1:add(N+5,n,F);add(N+8,n,-F)
    return coo_matrix((v,(r,s)),shape=(size,size)).tocsc(),cap,np.repeat(active,nx)

def main():
    p=argparse.ArgumentParser();p.add_argument('--tag',default='v1');p.add_argument('--case',choices=['baseline','air'],default='baseline');args=p.parse_args();assert args.tag.isalnum(),'Simple immutable result tag required.'
    prefix='CONJUGATE_AIR_TIME_REFERENCE' if args.case=='air' else 'CONJUGATE_TIME_REFERENCE';output=ROOT/f'docs/dynamic/{prefix}_20261107_{args.tag}.json';assert not output.exists(),'Protect saved result.'
    own=json.loads(subprocess.check_output(['node','scripts/dynamic-conjugate-air-time-cases.mjs' if args.case=='air' else 'scripts/dynamic-conjugate-time-cases.mjs'],cwd=ROOT,text=True));c=own['config'];A,cap,fluid=assemble(c);N=len(cap);initial=np.zeros(N+10);initial[:N]=np.array(c['initial'])-c.get('referenceTemperatureK',300);initial[-1]=1
    exact=expm_multiply(A*own['targetTimeS'],initial);theta=exact[:N];heat=exact[N:N+9];storage=cap*(theta-initial[:N]);energy={'fluid':float(storage[fluid].sum()),'solid':float(storage[~fluid].sum()),'total':float(storage.sum())}
    def input_fluid(parts):return parts[2]+parts[4]-parts[5]+parts[6]+parts[7]
    def input_solid(parts):return parts[0]+parts[1]+parts[3]-parts[6]-parts[7]
    energy_residual={'fluid':energy['fluid']-input_fluid(heat),'solid':energy['solid']-input_solid(heat),'total':energy['total']-heat[8]};assert max(map(abs,energy_residual.values()))<1e-10
    probe=initial.copy();probe[:N]=np.linspace(-10,20,N);rate=A@probe;identity={'fluid':float(cap[fluid]@rate[:N][fluid]-input_fluid(rate[N:N+9])),'solid':float(cap[~fluid]@rate[:N][~fluid]-input_solid(rate[N:N+9])),'total':float(cap@rate[:N]-rate[N+8])};assert max(map(abs,identity.values()))<1e-10
    rows=[]
    for case in own['cases']:
        s=case['snapshot'];error=np.array(s['offsetTemperature'])-theta;diff=np.array(s['cumulativeComponentJ'])-heat;row={'factor':case['factor'],'maximumDt':case['maximumDt'],'steps':s['steps'],'maximumTemperatureErrorK':float(abs(error).max()),'fluidMaximumErrorK':float(abs(error[fluid]).max()),'solidMaximumErrorK':float(abs(error[~fluid]).max()),'maximumCumulativeComponentDifferenceJ':float(abs(diff).max()),'ownEnergyErrorJ':s['energyErrorJ'],'ownEnergyRoundoffBudgetJ':s['energyRoundoffBudgetJ']};rows.append(row);print(json.dumps(row),flush=True)
    orders=[math.log2(a['maximumTemperatureErrorK']/b['maximumTemperatureErrorK']) for a,b in zip(rows,rows[1:])]
    checks={'finestMaximumDifferenceBelow001K':rows[-1]['maximumTemperatureErrorK']<.001,'finestAllHeatDifferenceBelow0001J':rows[-1]['maximumCumulativeComponentDifferenceJ']<1e-4,'finalTimeOrderBetween18And22':1.8<orders[-1]<2.2,'allOwnRegionalEnergyBudgets':all(all(abs(x)<=r['ownEnergyRoundoffBudgetJ'] for x in r['ownEnergyErrorJ'].values()) for r in rows)}
    if args.case=='air':checks['guiAutoQuarterDtBelow001K']=rows[2]['maximumTemperatureErrorK']<.001
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'sourceCommit':own['sourceCommit'],'sourceFilesSHA256':own['sourceFilesSHA256'],'referenceGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'criteriaDeclaredAtCommit':'f79ec7e' if args.case=='air' else 'c8d7b97','method':'Independent physical-cell K/C, analytic parabolic-row integrals, series interface/contact resistance and nine affine heat integrals. scipy.sparse.linalg.expm_multiply; product assembly and SSPRK2 are not reference solvers.','environment':{'node':own['environment']['node'],'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'BLASThreads':1},'config':c,'reference':{'timeS':own['targetTimeS'],'temperatureOffsetsK':theta.tolist(),'cumulativeComponentJ':heat.tolist(),'storageChangeJ':energy,'energyResidualJ':energy_residual,'storagePowerIdentityResidualW':identity},'rows':rows,'maximumErrorTimeOrders':orders,'checks':checks,'allChecksPassed':all(checks.values()),'continuousNonuniformSpatialAccuracyVerified':False,'realWorkerVerified':False,'GUIVerified':False,'releaseApproved':False}
    with output.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({'output':str(output),'orders':orders,'checks':checks}),flush=True)
    if not result['allChecksPassed']:raise RuntimeError('Saved failed comparison; do not approve')
if __name__=='__main__':main()
