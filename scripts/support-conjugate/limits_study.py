#!/usr/bin/env python3
import os
for name in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS'):os.environ[name]='1'
from pathlib import Path
import json,hashlib,subprocess,math
import numpy as np
from scipy.linalg import solve_banded
from scipy.sparse.linalg import spsolve
from models import FVM,P1,mac
from test_limits import exact
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/dynamic/support-conjugate'
def static_source():
    rows=[]
    for cls in (FVM,P1):
        for n in (16,32,64):
            m=cls(n=n,ra=0,K=.5,C=2,source=1)
            if cls is FVM:
                nx=m.nx;G=m.gx;diag=np.r_[G,0]+np.r_[0,G];diag[0]+=2*m.K;diag[-1]+=2;M=np.zeros((3,nx));M[0,1:]=-G;M[1]=diag;M[2,:-1]=-G;b=np.r_[np.full(m.ns,m.source/n**2),np.zeros(n)];b[0]+=2*m.K
                m.T=np.broadcast_to(solve_banded((1,1),M,b),(n,nx)).copy();x=(np.arange(nx)+.5)/n-m.d;T,Q=exact(x,m.K,m.source);T[:m.ns]-=m.source/(24*m.K*n*n);rms=float(np.sqrt(np.mean((m.T-T)**2)))
            else:
                free=~m.fixed;T=m.T.copy();T[free]=spsolve(m.Kall[free][:,free],m.load[free]-m.Kall[free][:,m.fixed]@T[m.fixed]);m.T=T;_,Q=exact(np.array([0]),m.K,m.source)
                errors=[]
                for points in (4,8):
                    z,w=np.polynomial.legendre.leggauss(points);z=(z+1)/2;w=w/2;total=0.
                    for i,a in enumerate(z):
                        for j,b in enumerate(z):
                            weights=np.array([(1-a)*(1-b),a,(1-a)*b]);xy=np.einsum('i,tik->tk',weights,m.xy[m.tri]);numeric=m.T[m.tri]@weights;analytic,_=exact(xy[:,0],m.K,m.source);total+=float(np.sum(2*m.area*(1-a)*w[i]*w[j]*(numeric-analytic)**2))
                    errors.append(math.sqrt(total/1.25))
                selfq=abs(errors[0]-errors[1]);assert selfq<1e-12;rms=errors[-1]
            m.initial=m.T.copy();r=m.rhs(m.T,m.u,m.v)[0];metrics=m.metrics();row={'method':cls.__name__,'grid':n,'continuousP1RMSorFvExactCellMeanRMS':rms,'analyticInterfaceHeat':float(Q),'computedInterfaceHeat':metrics['interfaceIntoFluid'],'relativeInterfaceHeatError':metrics['interfaceIntoFluid']/Q-1,'maximumStaticRate':float(abs(r).max()),'metrics':metrics};rows.append(row);print(json.dumps(row),flush=True)
    for cls in ('FVM','P1'):
        r=[x for x in rows if x['method']==cls];assert r[-1]['continuousP1RMSorFvExactCellMeanRMS']<.002 and abs(r[-1]['relativeInterfaceHeatError'])<.01;assert all(a['continuousP1RMSorFvExactCellMeanRMS']>b['continuousP1RMSorFvExactCellMeanRMS'] for a,b in zip(r,r[1:]))
    return rows

def main():
    out=OUT/'LIMITS_STUDY.json';assert not out.exists(),'Protect saved result';source=static_source()
    base=mac.Cavity(16,1000);previous=None;steady=0;history=[]
    for target in np.arange(.1,3.01,.1):
        while base.time<target:base.step(min(base.dt(),float(target-base.time)))
        q=base.metrics()
        if previous:
            te=float(abs(base.T-previous[0]).max());ve=float(max(abs(base.u-previous[1]).max(),abs(base.v-previous[2]).max()))/max(1,float(abs(base.u).max()),float(abs(base.v).max()));ne=abs(q['Nu0']-history[-1]['Nu0'])/q['Nu0'];steady=steady+1 if te<1e-7 and ve<1e-6 and ne<1e-6 else 0
        previous=(base.T.copy(),base.u.copy(),base.v.copy());history.append(q)
        if steady>=2:break
    assert steady>=2;cases=[]
    for K in (16,64,256):
        tag='IsoK'+str(K);path=OUT/(tag+'.json')
        if path.exists():raise ValueError('Protect isothermal study files')
        done=subprocess.run(['python3','scripts/support-conjugate/run_case.py','--method','fv','--grid','16','--K',str(K),'--C',str(K/8),'--end','3','--tag',tag],cwd=ROOT,stdout=open(ROOT/f'work/conjugate-{tag}-20261107.log','w'),stderr=subprocess.STDOUT)
        j=json.loads(path.read_text());state=np.load(OUT/j['stateFile']);m=FVM(**j['config']);m.T=state['temperature'];m.u=state['u'];m.v=state['v'];d=np.r_[m.u.ravel()-base.u.ravel(),m.v.ravel()-base.v.ravel()];den=np.r_[base.u.ravel(),base.v.ravel()];row={'K':K,'C':K/8,'steady':j['steady'],'failure':j['failure'],'interfaceMeanDifferenceFromOne':1-j['last']['interfaceTemperatureMean'],'heatRelativeDifference':j['last']['interfaceIntoFluid']/history[-1]['Nu0']-1,'fluidTemperatureRelativeL2Difference':float(np.linalg.norm(m.fluid_cells()-base.T)/np.linalg.norm(base.T)),'velocityRelativeL2Difference':float(np.linalg.norm(d)/np.linalg.norm(den)),'metrics':j['last']};cases.append(row);print(json.dumps({'isothermal':row}),flush=True)
        if done.returncode:raise ValueError('Saved failed isothermal case')
    last=cases[-1];passed=last['interfaceMeanDifferenceFromOne']<.005 and max(abs(last['heatRelativeDifference']),last['fluidTemperatureRelativeL2Difference'],last['velocityRelativeL2Difference'])<.01
    result={'sourceSteadyRows':source,'fixedIsothermalReference':{'grid':16,'ra':1000,'history':history,'independentPublicBenchmarkClaimed':False,'role':'same-grid fixed-wall limit, not a new deVahl continuous accuracy claim'},'finiteConductivityApproach':cases,'finestLimitPassed':passed,'sourceSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'releaseApproved':False};out.write_text(json.dumps(result,indent=2)+'\n')
    if not passed:raise SystemExit(1)
if __name__=='__main__':main()
