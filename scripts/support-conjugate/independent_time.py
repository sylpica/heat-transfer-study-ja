#!/usr/bin/env python3
"""Physical resistor/capacity graph, affine exponential and independently
projected direct-LU MAC ODE. Product coupled RHS is not used as oracle.
"""
import os
for name in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS'):os.environ[name]='1'
from pathlib import Path
import importlib.util,json,hashlib,math
import numpy as np
from scipy.linalg import expm
from scipy.integrate import solve_ivp
from models import FVM
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/dynamic/support-conjugate'
spec=importlib.util.spec_from_file_location('independent_mac',ROOT/'scripts/dynamic-independent-thermal-wall-central-time.py');ind=importlib.util.module_from_spec(spec);spec.loader.exec_module(ind)

def graph(c):
    n=c['n'];ns=n//4;nx=n+ns;N=n*nx;h=1/n;C=np.r_[np.full(ns,c['C']),np.ones(n)]*h*h;k=np.r_[np.full(ns,c['K']),np.ones(n)];A=np.zeros((N+5,N+5));const=N+4
    def edge(a,b,G,ca,cb):
        A[a,a]-=G/ca;A[a,b]+=G/ca;A[b,b]-=G/cb;A[b,a]+=G/cb
    for j in range(n):
        for i in range(nx):
            a=j*nx+i
            if i<nx-1:
                G=h/(h/(2*k[i])+h/(2*k[i+1]));edge(a,a+1,G,C[i],C[i+1])
                if i==ns-1:A[N+3,a]+=G;A[N+3,a+1]-=G
            if j<n-1:edge(a,a+nx,k[i],C[i],C[i])
            if i==0:A[a,a]-=2*k[i]/C[i];A[a,const]+=2*k[i]/C[i];A[N,a]-=2*k[i];A[N,const]+=2*k[i]
            if i==nx-1:A[a,a]-=2/C[i];A[N+1,a]-=2
            if i<ns:A[a,const]+=c['source']*h*h/C[i]
    A[N+2,const]=c['source']*.25;return A

def ode(c,A):
    n=c['n'];ns=n//4;nx=n+ns;N=n*nx;nf=n*n;un=(n+1)*n;vn=(n+1)*n;iu=N;iv=iu+un;ih=iv+vn;fi=np.arange(N).reshape(n,nx)[:,ns:].ravel()
    fcfg={'nx':n,'ny':n,'width':1,'height':1,'depth':1,'rho':1,'cp':1,'nu':.71,'alpha':1,'gravityBeta':.71*c['ra'],'wallCapacityJPerK':1,'wallInputW':0,'wallInitialTemperature':1,'coldTemperature':0,'wallMode':'isothermal-thermostat','initial':[.5]*nf}
    base,oldinitial,(u0,v0,h0)=ind.nonlinear(fcfg);fluidmatrix,_=ind.base.thermal(fcfg);Lf=fluidmatrix[:nf,:nf];bf=fluidmatrix[:nf,nf];Lt=A[:N,:N];bt=A[:N,N+4];Lq=A[N:N+4,:N];bq=A[N:N+4,N+4]
    def rhs(t,y):
        theta=y[:N];old=oldinitial.copy();old[:nf]=theta[fi];old[nf]=1;old[u0:v0]=y[iu:iv];old[v0:h0]=y[iv:ih];r=base(t,old);out=np.zeros_like(y);out[:N]=Lt@theta+bt;out[fi]+=r[:nf]-(Lf@theta[fi]+bf);out[iu:iv]=r[u0:v0];out[iv:ih]=r[v0:h0];out[ih:]=Lq@theta+bq;return out
    return rhs,(iu,iv,ih)

def main():
    out=OUT/'INDEPENDENT_TIME.json';assert not out.exists(),'Protect saved result';rows=[]
    for ra in (0,1000):
        c={'n':8,'ra':ra,'K':.5,'C':2.,'source':1.};m=FVM(**c);x,y=np.meshgrid((np.arange(m.nx)+.5)/m.n-m.d,(np.arange(m.n)+.5)/m.n);m.T=.3+.05*np.sin(np.pi*x)*np.sin(np.pi*y);m.initial=m.T.copy();T0=m.T.copy();N=m.T.size;A=graph(c);end=16*m.dt();selfdiff=0.
        if ra==0:
            initial=np.r_[T0.ravel(),np.zeros(4),1];exact=expm(A*end)@initial;Tref=exact[:N];Uref=np.zeros(m.u.size);Vref=np.zeros(m.v.size);Qref=exact[N:N+4]
        else:
            rhs,(iu,iv,ih)=ode(c,A);initial=np.r_[T0.ravel(),np.zeros(m.u.size+m.v.size+4)];a=solve_ivp(rhs,[0,end],initial,method='DOP853',rtol=1e-11,atol=1e-13);b=solve_ivp(rhs,[0,end],initial,method='DOP853',rtol=2.3e-14,atol=1e-15);assert a.success and b.success;exact=b.y[:,-1];selfdiff=float(abs(exact-a.y[:,-1]).max());Tref=exact[:N];Uref=exact[iu:iv];Vref=exact[iv:ih];Qref=exact[ih:]
        cases=[]
        for factor in (1.,.5,.25,.125,.0625):
            model=FVM(**c);model.T=T0.copy();model.initial=T0.copy();dt=model.dt()*factor
            while model.time<end:model.step(min(dt,end-model.time))
            cases.append({'factor':factor,'maximumDt':dt,'maximumTemperatureError':float(abs(model.T.ravel()-Tref).max()),'maximumVelocityError':float(max(abs(model.u.ravel()-Uref).max(),abs(model.v.ravel()-Vref).max())),'maximumAllFourHeatError':float(abs(model.heats-Qref).max()),'threeEnergyBalances':model.metrics()['energy']})
        orderT=math.log2(cases[-2]['maximumTemperatureError']/cases[-1]['maximumTemperatureError']);orderU=None if ra==0 else math.log2(cases[-2]['maximumVelocityError']/cases[-1]['maximumVelocityError']);last=cases[-1];checks={'referenceSelfDifferenceBelow1eMinus10':selfdiff<1e-10,'finestTemperatureBelow001':last['maximumTemperatureError']<.001,'finestVelocityBelow1eMinus5':last['maximumVelocityError']<1e-5,'finestAllFourHeatBelow1eMinus4':last['maximumAllFourHeatError']<1e-4,'temperatureOrder18To22':1.8<orderT<2.2,'velocityOrder18To22':True if orderU is None else 1.8<orderU<2.2,'threeRelativeEnergyBalancesBelow1eMinus9':all(x['threeEnergyBalances']['relativeMaximumError']<1e-9 for x in cases)}
        row={'config':c,'time':end,'cases':cases,'temperatureOrder':orderT,'velocityOrder':orderU,'independentReferenceSelfDifference':selfdiff,'referenceTemperature':Tref.tolist(),'referenceU':Uref.tolist(),'referenceV':Vref.tolist(),'referenceFourHeat':Qref.tolist(),'checks':checks,'passed':all(checks.values())};rows.append(row);print(json.dumps({k:v for k,v in row.items() if not k.startswith('reference')}),flush=True)
    files=[Path(__file__),Path(__file__).with_name('models.py'),ROOT/'scripts/dynamic-independent-thermal-wall-central-time.py',ROOT/'scripts/dynamic-independent-thermal-wall-time.py'];result={'sourceSHA256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files},'method':'Independent physical edge graph and exact exponential; separately constructed direct saddle-LU projected MAC/DOP853, replacing the uniform-wall thermal contribution by the spatial solid-interface graph. Product coupled RHS not used as reference.','cases':rows,'passed':all(r['passed'] for r in rows),'releaseApproved':False};out.write_text(json.dumps(result,indent=2)+'\n')
    if not result['passed']:raise SystemExit(1)
if __name__=='__main__':main()
