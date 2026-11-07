#!/usr/bin/env python3
"""Support-only uniform square MAC/SSPRK2, central thermal flux, exact DCT Neumann projection.
Nondimensional units alpha=L=H=rho=cp=D=deltaT=1, nu=Pr=.71, buoyancy=Pr*Ra.
Not a public model or an extension of the production admission gate.
"""
import os
for name in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS'):os.environ[name]='1'
import argparse,hashlib,json,time,subprocess
from pathlib import Path
import numpy as np
from scipy.fft import dctn,idctn
ROOT=Path(__file__).resolve().parents[2]

class Cavity:
    def __init__(self,n,ra):
        if n not in (8,16,32,64,128,256) or ra not in (1000,10000,100000,1000000):raise ValueError('Support matrix only')
        self.n=n;self.ra=ra;self.nu=.71;self.gb=.71*ra;self.T=np.full((n,n),.5);self.u=np.zeros((n,n+1));self.v=np.zeros((n+1,n));self.p=np.zeros((n,n));self.time=0.;self.steps=0;self.heats=np.zeros(2);self.comp=np.zeros(2)
        e=4*n*n*np.sin(np.pi*np.arange(n)/(2*n))**2;self.eigen=e[:,None]+e[None,:];self.eigen[0,0]=1
        self.max_pe=0.;self.max_div=0.;self.max_projection_relative_residual=0.;self.max_balance=0.
    def project(self,u,v):
        n=self.n;div=n*(np.diff(u,axis=1)+np.diff(v,axis=0));r=-div;coeff=dctn(r,type=2,norm='ortho',workers=1)/self.eigen;coeff[0,0]=0
        p=idctn(coeff,type=2,norm='ortho',workers=1)
        lap=np.zeros_like(p);gx=n*n*np.diff(p,axis=1);gy=n*n*np.diff(p,axis=0);lap[:,:-1]-=gx;lap[:,1:]+=gx;lap[:-1]-=gy;lap[1:]+=gy
        self.projection_residual=float(np.max(np.abs(lap-(r-r.mean()))));self.projection_rhs=float(np.max(np.abs(r)))
        self.max_projection_relative_residual=max(self.max_projection_relative_residual,self.projection_residual/max(self.projection_rhs,np.finfo(float).tiny))
        u[:,1:-1]-=n*np.diff(p,axis=1);v[1:-1]-=n*np.diff(p,axis=0)
        return u,v,p
    def rhs(self,T,u,v):
        n=self.n;cu=((u[:,:-1]+u[:,1:])/2)**2;cv=((v[:-1]+v[1:])/2)**2
        uv=np.zeros((n+1,n+1));uv[1:-1,1:-1]=(u[:-1,1:-1]+u[1:,1:-1])*(v[1:-1,:-1]+v[1:-1,1:])/4
        up=np.vstack((-u[0],u,-u[-1]));vp=np.column_stack((-v[:,0],v,-v[:,-1]));a=np.zeros_like(u);b=np.zeros_like(v)
        a[:,1:-1]=self.nu*n*n*(u[:,2:]+u[:,:-2]+up[2:,1:-1]+up[:-2,1:-1]-4*u[:,1:-1])-n*np.diff(cu,axis=1)-n*np.diff(uv[:,1:-1],axis=0)
        b[1:-1]=self.nu*n*n*(v[2:]+v[:-2]+vp[1:-1,2:]+vp[1:-1,:-2]-4*v[1:-1])-n*np.diff(uv[1:-1],axis=1)-n*np.diff(cv,axis=0)+self.gb*((T[1:]+T[:-1])/2-.5)
        # Every face exchanges exactly opposite heat. q is heat into left/bottom cell.
        qx=np.diff(T,axis=1)-u[:,1:-1]*(T[:,:-1]+T[:,1:])/(2*n)
        qy=np.diff(T,axis=0)-v[1:-1]*(T[:-1]+T[1:])/(2*n)
        F=np.zeros_like(T);F[:,:-1]+=qx;F[:,1:]-=qx;F[:-1]+=qy;F[1:]-=qy
        hot=2*(1-T[:,0]);cold=-2*T[:,-1];F[:,0]+=hot;F[:,-1]+=cold
        return n*n*F,a,b,None,np.array([hot.sum(),cold.sum()])
    def inspect(self,T,u,v):
        if not all(np.isfinite(x).all() for x in (T,u,v)):raise ValueError('nonfinite candidate')
        pe=max(np.abs(u).max(),np.abs(v).max())/self.n;self.max_pe=max(self.max_pe,float(pe))
        if pe>2*(1+1e-12):raise ValueError(f'central cell Peclet >2: {pe}')
        if T.min()<-1e-10 or T.max()>1+1e-10:raise ValueError(f'thermal maximum principle lost: {T.min()}, {T.max()}')
    def dt(self,factor=1):
        speed=max(float(np.abs(self.u).max()),float(np.abs(self.v).max()),1.)
        return factor*min(.12/self.n**2,.2/(2*self.n*speed))
    def step(self,dt):
        if not np.isfinite(dt) or dt<=0 or dt>self.dt()*(1+1e-12):raise ValueError('unsafe dt')
        r,a,b,_,q=self.rhs(self.T,self.u,self.v);T1=self.T+dt*r
        u1,v1,p1=self.project(self.u+dt*a,self.v+dt*b);self.inspect(T1,u1,v1)
        r1,a1,b1,_,q1=self.rhs(T1,u1,v1);T2=self.T+dt*(r+r1)/2
        uEuler,vEuler,p2=self.project(u1+dt*a1,v1+dt*b1)
        u2=(self.u+uEuler)/2;v2=(self.v+vEuler)/2;self.inspect(T2,u2,v2)
        inc=dt*(q+q1)/2-self.comp;heat=self.heats+inc;comp=(heat-self.heats)-inc
        self.T,self.u,self.v,self.p=T2,u2,v2,(p1+p2)/(2*dt);self.time+=dt;self.steps+=1;self.heats=heat;self.comp=comp
    def metrics(self):
        n=self.n;T=self.T;u=self.u;v=self.v;Nu0=2*(1-T[:,0]).sum();Nucold=2*T[:,-1].sum()
        sections=np.empty(n+1);sections[0]=Nu0;sections[-1]=Nucold;sections[1:-1]=(-np.diff(T,axis=1)+u[:,1:-1]*(T[:,:-1]+T[:,1:])/(2*n)).sum(axis=0)
        us=u[:,n//2];vs=v[n//2];i=int(us.argmax());j=int(vs.argmax());div=float((n*(np.diff(u,axis=1)+np.diff(v,axis=0))).__abs__().max())
        qhot=2*(1-T[:,0]);balance=float((T-.5).mean()-self.heats.sum())
        return {'time':self.time,'steps':self.steps,'Nu0':float(Nu0),'NuMidplane':float(sections[n//2]),'NuVolume':float((sections.sum()-(sections[0]+sections[-1])/2)/n),'NuCold':float(Nucold),'NuSectionSpread':float(np.ptp(sections)),'NuLocalMaximum':float((n*qhot).max()),'uMaximum':float(us[i]),'uMaximumPosition':(i+.5)/n,'vMaximum':float(vs[j]),'vMaximumPosition':(j+.5)/n,'divergence':div,'pressureSolveResidualMax':getattr(self,'projection_residual',0.),'pressureSolveRhsMax':getattr(self,'projection_rhs',0.),'maximumProjectionRelativeResidual':self.max_projection_relative_residual,'currentCellPe':float(max(abs(u).max(),abs(v).max())/n),'maximumObservedStagePe':self.max_pe,'temperatureMin':float(T.min()),'temperatureMax':float(T.max()),'energyErrorJ':balance,'cumulativeBoundaryHeatJ':self.heats.tolist()}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--ra',type=int,required=True);ap.add_argument('--grid',type=int,required=True);ap.add_argument('--factor',type=float,default=1);ap.add_argument('--tag',default='v1');ap.add_argument('--end',type=float,default=1.);args=ap.parse_args()
    if not 0<args.factor<=1 or not args.tag.isalnum():raise ValueError('Invalid factor/tag')
    stem=f'RA{args.ra}_N{args.grid}_DT{str(args.factor).replace(".","p")}_{args.tag}'
    out=ROOT/'docs/dynamic/support-natconv'/f'{stem}.json';state=out.with_suffix('.npz');assert not out.exists() and not state.exists(),'Protect saved result'
    m=Cavity(args.grid,args.ra);start=time.perf_counter();history=[];previous=None;consecutive=0;failed=None;nextlog=5
    interval=.1 if args.ra<=1e4 else .025
    try:
        for target in np.arange(interval,args.end+interval/2,interval):
            while m.time<target:
                m.step(min(m.dt(args.factor),float(target-m.time)))
                if time.perf_counter()-start>nextlog:
                    print(json.dumps({'progress':True,'ra':args.ra,'grid':args.grid,'t':m.time,'steps':m.steps,'seconds':time.perf_counter()-start}),flush=True);nextlog=time.perf_counter()-start+10
            row=m.metrics()
            if previous:
                te=float(abs(m.T-previous[0]).max());ve=max(float(abs(m.u-previous[1]).max()),float(abs(m.v-previous[2]).max()));scale=max(1.,float(abs(m.u).max()),float(abs(m.v).max()));ne=abs(row['NuVolume']-history[-1]['NuVolume'])/max(1,abs(row['NuVolume']))
                row['change']={'interval':interval,'temperature':te,'velocity':ve,'relativeVelocity':ve/scale,'relativeNu':ne};consecutive=consecutive+1 if te<1e-7 and ve/scale<1e-6 and ne<1e-6 else 0
            history.append(row);previous=(m.T.copy(),m.u.copy(),m.v.copy());print(json.dumps({'sample':row,'consecutiveSteadyIntervals':consecutive}),flush=True)
            if consecutive>=2:break
    except (ValueError,FloatingPointError) as e:failed=str(e)
    row=m.metrics();steady=consecutive>=2
    result={'generatedAtUTC':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'prototypeSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'ra':args.ra,'grid':args.grid,'dtFactor':args.factor,'units':'alpha=L=H=rho=cp=depth=deltaT=1; nu=Pr=.71; gBeta=.71Ra; Tc=0,Th=1 retained offsets; no absolute-temperature property claim','method':'uniform MAC conservative2 momentum and central scalar, joint SSPRK2; exact typeII DCT orthonormal Neumann projection on each Euler-stage velocity; no-slip half-cell velocity ghosts','history':history,'last':row,'steady':steady,'failure':failed,'elapsedSeconds':time.perf_counter()-start,'fullState':state.name,'releaseApproved':False}
    payload=json.dumps(result,indent=2)+'\n';np.savez_compressed(state,temperature=m.T,u=m.u,v=m.v,pressureStageMean=m.p,heats=m.heats,compensation=m.comp,time=m.time,steps=m.steps)
    out.write_text(payload);print(json.dumps({'result':str(out),'steady':steady,'failure':failed,'last':row,'seconds':result['elapsedSeconds']}),flush=True)
    if failed or not steady:raise SystemExit(1)
if __name__=='__main__':main()
