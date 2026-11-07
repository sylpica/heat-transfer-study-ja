#!/usr/bin/env python3
"""Support-only adjacent slab / closed square conjugate thermal prototypes.
FVM harmonic face resistance and independently assembled conforming P1 heat.
Momentum/projection are shared from the previously validated MAC support core.
"""
import os
for name in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS'):os.environ[name]='1'
from pathlib import Path
import importlib.util
import numpy as np
from scipy.sparse import coo_matrix
spec=importlib.util.spec_from_file_location('support_mac',Path(__file__).parents[1]/'support-natconv/prototype.py');mac=importlib.util.module_from_spec(spec);spec.loader.exec_module(mac)

class Coupled(mac.Cavity):
    def __init__(self,n=32,ra=1000,K=.5,C=2.,source=0.):
        if n not in (8,16,32,64) or ra not in (0,100,1000):raise ValueError('Support matrix only')
        if not all(np.isfinite(v) and v>0 for v in (K,C)) or not np.isfinite(source) or source<0:raise ValueError('Invalid solid properties/source')
        super().__init__(n,1000);self.ra=ra;self.gb=.71*ra;self.K=float(K);self.C=float(C);self.source=float(source);self.ns=n//4;self.nx=n+self.ns;self.d=.25;self.heats=np.zeros(4);self.comp=np.zeros(4)
    def finish(self):self.initial=self.T.copy()
    def momentum(self,T,u,v):return mac.Cavity.rhs(self,T,u,v)[1:3]
    def inspect(self,T,u,v):
        if T.shape!=self.initial.shape or not all(np.isfinite(x).all() for x in (T,u,v)):raise ValueError('Nonfinite/incompatible state')
        bound=1+self.source*(self.d+self.d**2/(2*self.K))
        if T.min()<-1e-9 or T.max()>bound+1e-9:raise ValueError(f'Thermal bounds: {T.min()}, {T.max()}')
        pe=float(max(abs(u).max(),abs(v).max())/self.n);self.max_pe=max(self.max_pe,pe)
        if pe>2*(1+1e-12):raise ValueError('Central cell Peclet exceeds2')
        if np.any(u[:,[0,-1]]!=0) or np.any(v[[0,-1]]!=0):raise ValueError('Closed-wall normal velocity')
        if self.ra==0 and (np.any(u!=0) or np.any(v!=0)):raise ValueError('Zero-buoyancy invariant')
    def energy(self,T,heat):
        ds=float(np.sum(self.cap_s*(T-self.initial)));df=float(np.sum(self.cap_f*(T-self.initial)))
        errors=np.array([ds-(heat[0]+heat[2]-heat[3]),df-(heat[1]+heat[3]),ds+df-sum(heat[:3])]);scale=abs(ds)+abs(df)+float(np.abs(heat).sum())
        relative=0. if scale==0 and np.max(abs(errors))==0 else float(np.max(abs(errors))/scale) if scale else float('inf')
        return {'solidStorage':ds,'fluidStorage':df,'totalStorage':ds+df,'errorsSolidFluidTotal':errors.tolist(),'relativeMaximumError':relative,'actualScaleWithoutOneJouleFloor':scale}
    def dt(self,factor=1.):return factor*min(.35/float(np.max(self.diag_rate)),mac.Cavity.dt(self))
    def step(self,dt):
        if not np.isfinite(dt) or dt<=0 or dt>self.dt()*(1+1e-12):raise ValueError('Unsafe timestep')
        r,a,b,q=self.rhs(self.T,self.u,self.v);T1=self.T+dt*r
        if self.ra:u1,v1,p1=self.project(self.u+dt*a,self.v+dt*b)
        else:u1,v1,p1=self.u.copy(),self.v.copy(),self.p.copy()
        self.inspect(T1,u1,v1);r1,a1,b1,q1=self.rhs(T1,u1,v1);T2=self.T+dt*(r+r1)/2
        if self.ra:ue,ve,p2=self.project(u1+dt*a1,v1+dt*b1)
        else:ue,ve,p2=u1,v1,p1
        u2=(self.u+ue)/2;v2=(self.v+ve)/2;self.inspect(T2,u2,v2)
        inc=dt*(q+q1)/2-self.comp;heat=self.heats+inc;comp=(heat-self.heats)-inc;e=self.energy(T2,heat)
        if e['relativeMaximumError']>1e-9:raise ValueError(f'Coupled energy budget: {e}')
        self.T,self.u,self.v,self.p=T2,u2,v2,(p1+p2)/(2*dt);self.heats,self.comp=heat,comp;self.time+=dt;self.steps+=1
    def common_metrics(self,Tfluid,interface_temperature,q,extra):
        power=self.rhs(self.T,self.u,self.v)[3];mean=float(np.mean(interface_temperature));n=self.n
        result={'time':self.time,'steps':self.steps,'solidTemperatureMin':float(self.solid_values().min()),'solidTemperatureMax':float(self.solid_values().max()),'fluidTemperatureMin':float(Tfluid.min()),'fluidTemperatureMax':float(Tfluid.max()),'solidMeanTemperature':float(np.sum(self.cap_s*self.T)/np.sum(self.cap_s)),'fluidMeanTemperature':float(np.sum(self.cap_f*self.T)/np.sum(self.cap_f)),'interfaceTemperatureMean':mean,'interfaceTemperatureMinimum':float(np.min(interface_temperature)),'interfaceTemperatureMaximum':float(np.max(interface_temperature)),'backInput':float(power[0]),'coldWallInput':float(power[1]),'solidSourcePower':float(power[2]),'interfaceIntoFluid':float(q),'effectiveHeatTransferRatio':None if mean==0 else float(q/mean),'solidBiFromInterfaceAverage':None if mean==0 else float(q/mean*self.d/self.K),'maximumFaceSpeed':float(max(abs(self.u).max(),abs(self.v).max())),'divergence':float(abs(n*(np.diff(self.u,axis=1)+np.diff(self.v,axis=0))).max()),'maximumObservedCellPe':self.max_pe,'maximumDctRelativeResidual':self.max_projection_relative_residual,'energy':self.energy(self.T,self.heats),'cumulativeBackColdSourceInterface':self.heats.tolist(),**extra}
        return result

class FVM(Coupled):
    def __init__(self,**kwargs):
        super().__init__(**kwargs);n=self.n;nx=self.nx;s=self.ns;self.k=np.r_[np.full(s,self.K),np.ones(n)];c=np.r_[np.full(s,self.C),np.ones(n)]
        self.cap=np.broadcast_to(c/n**2,(n,nx)).copy();self.cap_s=self.cap.copy();self.cap_s[:,s:]=0;self.cap_f=self.cap.copy();self.cap_f[:,:s]=0
        self.gx=2*self.k[:-1]*self.k[1:]/(self.k[:-1]+self.k[1:]);self.T=np.full((n,nx),.5)
        diag=np.zeros_like(self.T);diag[:,:-1]+=self.gx;diag[:,1:]+=self.gx;diag[:-1]+=self.k;diag[1:]+=self.k;diag[:,0]+=2*self.K;diag[:,-1]+=2;self.diag_rate=diag/self.cap
        self.finish()
    def rhs(self,T,u,v):
        n=self.n;s=self.ns;F=np.zeros_like(T);qx=self.gx*np.diff(T,axis=1);qy=self.k*np.diff(T,axis=0)
        F[:,:-1]+=qx;F[:,1:]-=qx;F[:-1]+=qy;F[1:]-=qy
        tf=T[:,s:];ax=-u[:,1:-1]*(tf[:,:-1]+tf[:,1:])/(2*n);ay=-v[1:-1]*(tf[:-1]+tf[1:])/(2*n)
        F[:,s:-1]+=ax;F[:,s+1:]-=ax;F[:-1,s:]+=ay;F[1:,s:]-=ay
        back=2*self.K*(1-T[:,0]);cold=-2*T[:,-1];F[:,0]+=back;F[:,-1]+=cold;F[:,:s]+=self.source/n**2
        a,b=self.momentum(tf,u,v) if self.ra else (np.zeros_like(u),np.zeros_like(v))
        q=np.array([back.sum(),cold.sum(),self.source*self.d,float(np.sum(-qx[:,s-1]))]);return F/self.cap,a,b,q
    def fluid_cells(self):return self.T[:,self.ns:]
    def solid_values(self):return self.T[:,:self.ns]
    def cell_means(self):return self.T
    def interface(self):
        s=self.ns;q=self.gx[s-1]*(self.T[:,s-1]-self.T[:,s]);ts=self.T[:,s-1]-q/(2*self.K);tf=self.T[:,s]+q/2
        return (ts+tf)/2,q,ts,tf
    def metrics(self):
        ti,qs,ts,tf=self.interface();return self.common_metrics(self.fluid_cells(),ti,qs.sum(),{'interfaceTemperatureJumpMax':float(abs(ts-tf).max()),'interfaceFluxJumpMax':0.,'interfaceTraceIsSharedHarmonicReconstruction':True})

class P1(Coupled):
    def __init__(self,**kwargs):
        super().__init__(**kwargs);n=self.n;nx=self.nx;s=self.ns
        x,y=np.meshgrid(np.arange(nx+1)/n-self.d,np.arange(n+1)/n);self.xy=np.column_stack((x.ravel(),y.ravel()));tri=[];phase=[]
        for j in range(n):
            for i in range(nx):
                a=j*(nx+1)+i;b=a+1;c=a+nx+1;d=c+1
                tri.extend([(a,b,d),(a,d,c)] if (i+j)%2==0 else [(a,b,c),(b,d,c)]);phase.extend([i<s]*2)
        self.tri=np.array(tri);self.solid=np.array(phase,dtype=bool);pts=self.xy[self.tri];e1=pts[:,1]-pts[:,0];e2=pts[:,2]-pts[:,0];cross=e1[:,0]*e2[:,1]-e1[:,1]*e2[:,0];self.area=cross/2
        self.grad=np.stack((np.column_stack((pts[:,1,1]-pts[:,2,1],pts[:,2,0]-pts[:,1,0])),np.column_stack((pts[:,2,1]-pts[:,0,1],pts[:,0,0]-pts[:,2,0])),np.column_stack((pts[:,0,1]-pts[:,1,1],pts[:,1,0]-pts[:,0,0]))),axis=1)/cross[:,None,None]
        N=len(self.xy);ids=self.tri.ravel();self.cap_s=np.bincount(ids,weights=np.repeat(np.where(self.solid,self.C,0)*self.area/3,3),minlength=N);self.cap_f=np.bincount(ids,weights=np.repeat(np.where(self.solid,0,1)*self.area/3,3),minlength=N);self.cap=self.cap_s+self.cap_f
        local=self.area[:,None,None]*np.einsum('tik,tjk->tij',self.grad,self.grad);rows=np.broadcast_to(self.tri[:,:,None],local.shape).ravel();cols=np.broadcast_to(self.tri[:,None,:],local.shape).ravel()
        self.Ks=coo_matrix(((local*np.where(self.solid,self.K,0)[:,None,None]).ravel(),(rows,cols)),shape=(N,N)).tocsr();self.Kf=coo_matrix(((local*np.where(self.solid,0,1)[:,None,None]).ravel(),(rows,cols)),shape=(N,N)).tocsr();self.Kall=self.Ks+self.Kf
        self.load=np.bincount(ids,weights=np.repeat(self.solid*self.source*self.area/3,3),minlength=N)
        self.back=self.xy[:,0]==-self.d;self.cold=self.xy[:,0]==1;self.interface_nodes=self.xy[:,0]==0;self.fixed=self.back|self.cold
        self.T=np.full(N,.5);self.T[self.back]=1;self.T[self.cold]=0;self.diag_rate=self.Kall.diagonal()/self.cap
        self.finish()
    def convective_load(self,T,u):
        if not np.any(u):return np.zeros_like(T)
        n=self.n;psi=np.zeros((n+1,n+1));psi[1:]=np.cumsum(u,axis=0)/n;psi[[0,-1]]=0;psi[:,[0,-1]]=0
        values=np.zeros((n+1,self.nx+1));values[:,self.ns:]=psi;g=np.einsum('ti,tik->tk',values.ravel()[self.tri],self.grad);vel=np.column_stack((g[:,1],-g[:,0]));vel[self.solid]=0
        # Conservative weak form: -integral grad(N_i).u*T. Sum over nodes is zero.
        local=-self.area[:,None]*np.einsum('tik,tk->ti',self.grad,vel)*np.mean(T[self.tri],axis=1)[:,None]
        return np.bincount(self.tri.ravel(),weights=local.ravel(),minlength=len(T))
    def rhs(self,T,u,v):
        adv=self.convective_load(T,u);ks=self.Ks@T;allop=ks+self.Kf@T+adv;rate=(self.load-allop)/self.cap;rate[self.fixed]=0
        qs=-float(np.sum((self.cap_s*rate+ks-self.load)[self.interface_nodes]));qback=float(np.sum((allop-self.load)[self.back]));qcold=float(np.sum((allop-self.load)[self.cold]));q=np.array([qback,qcold,float(self.load.sum()),qs]);tf=self.averages(T)[:,self.ns:]
        a,b=self.momentum(tf,u,v) if self.ra else (np.zeros_like(u),np.zeros_like(v));return rate,a,b,q
    def averages(self,T):return np.mean(T[self.tri],axis=1).reshape(self.n,self.nx,2).mean(axis=2)
    def cell_means(self):return self.averages(self.T)
    def fluid_cells(self):return self.cell_means()[:,self.ns:]
    def solid_values(self):return self.T[self.cap_s>0]
    def metrics(self):
        ti=self.T[self.interface_nodes].reshape(self.n+1);mean=float((ti.sum()-(ti[0]+ti[-1])/2)/self.n);q=self.rhs(self.T,self.u,self.v)[3][3]
        grads=np.einsum('ti,tik->tk',self.T[self.tri],self.grad);pts=self.xy[self.tri];on=np.sum(pts[:,:,0]==0,axis=1)==2;fs=np.empty(self.n);ff=np.empty(self.n)
        for a in np.flatnonzero(on):
            ys=pts[a,:,1][pts[a,:,0]==0];j=int(round(min(ys)*self.n));(fs if self.solid[a] else ff)[j]=-(self.K if self.solid[a] else 1)*grads[a,0]
        return self.common_metrics(self.fluid_cells(),np.array([mean]),q,{'interfaceTemperatureJumpMax':0.,'interfaceTemperatureMinimum':float(ti.min()),'interfaceTemperatureMaximum':float(ti.max()),'interfaceFluxIsWeakVariationalReaction':True,'adjacentElementStrongFluxJumpRMS':float(np.sqrt(np.mean((fs-ff)**2))),'adjacentElementStrongFluxJumpMax':float(abs(fs-ff).max()),'solidStrongInterfaceHeat':float(fs.mean()),'fluidStrongInterfaceHeat':float(ff.mean())})
