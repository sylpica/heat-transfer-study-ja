"""Offline reduced conjugate reference, NOT a released general 3D CFD solver.

3D base / thickness-uniform 2D fins / fully developed cross-sectional momentum
and 3D passive scalar, no axial fluid diffusion. Local long-duct radiosity.
All exchanges assembled once as equal/opposite internal thermal powers.
"""
from dataclasses import dataclass,asdict
import numpy as np
from scipy.sparse import coo_matrix,csc_matrix
from scipy.sparse.linalg import splu,spsolve

SIGMA=5.670374419e-8

@dataclass(frozen=True)
class Conditions:
    length:float=.12
    fins:int=7
    thickness:float=.001
    gap:float=.003
    height:float=.03
    base:float=.003
    solid_k:float=167.
    rho:float=1.177
    cp:float=1006.
    fluid_k:float=.0264
    nu:float=1.575e-5
    ambient:float=300.
    flow:float=7.2e-4
    power:float=10.
    emissivity:float=.8
    patch_length:float=.03
    patch_width:float=.009
    @property
    def width(self):return self.fins*self.thickness+(self.fins+1)*self.gap
    @property
    def h_reference(self):return 7.5407008740694379*self.fluid_k/(2*self.gap)


class Matrix:
    def __init__(self,n):self.n=n;self.rr=[];self.cc=[];self.vv=[]
    def add(self,a,b,g):
        a,b,g=np.broadcast_arrays(a,b,g)
        self.rr.append(a.ravel());self.cc.append(b.ravel());self.vv.append(g.ravel())
    def edge(self,a,b,g):
        self.add(a,a,g);self.add(b,b,g);self.add(a,b,-np.asarray(g));self.add(b,a,-np.asarray(g))
    def matrix(self):
        if not self.vv:return csc_matrix((self.n,self.n))
        return coo_matrix((np.concatenate(self.vv),(np.concatenate(self.rr),np.concatenate(self.cc))),shape=(self.n,self.n)).tocsc()


def hydraulic_profile(s,H,ny,nz):
    """-laplacian psi=1; sides/bottom no slip, top free shear."""
    if min(s,H)<=0 or ny<2 or nz<2:raise ValueError('Positive channel dimensions / at least 2 cells required')
    dy,dz=s/ny,H/nz;ids=np.arange(ny*nz).reshape(nz,ny);m=Matrix(ids.size)
    m.edge(ids[:,:-1],ids[:,1:],dz/dy)
    m.edge(ids[:-1,:],ids[1:,:],dy/dz)
    m.add(ids[:,0],ids[:,0],2*dz/dy);m.add(ids[:,-1],ids[:,-1],2*dz/dy)
    m.add(ids[0,:],ids[0,:],2*dy/dz)
    K=m.matrix();rhs=np.full(ids.size,dy*dz)
    psi=spsolve(K,rhs).reshape(nz,ny)
    return psi,float(psi.sum()*dy*dz),float(abs(K@psi.ravel()-rhs).max())


def allocate_flow(gaps,H,L,mu,ny,nz,*,flow=None,pressure=None,profile_refinement=1):
    """Parallel long channels, common inlet/outlet pressure; no manifold loss."""
    if (flow is None)==(pressure is None):raise ValueError('Specify flow OR pressure difference')
    if min(H,L,mu)<=0:raise ValueError('Positive dimensions and viscosity required')
    if (flow if flow is not None else pressure)<=0:
        raise ValueError('Zero/reversed flow: this forced-flow reference must not be used as natural convection')
    if profile_refinement not in [1,2]:raise ValueError('Velocity subgrid refinement must be 1 or 2')
    profiles=[hydraulic_profile(s,H,ny*profile_refinement,nz*profile_refinement) for s in gaps]
    mobilities=np.array([p[1]/(mu*L) for p in profiles])
    dp=flow/mobilities.sum() if flow is not None else pressure
    rates=dp*mobilities
    velocities=[dp/(mu*L)*p[0].reshape(nz,profile_refinement,ny,profile_refinement).mean(axis=(1,3)) for p in profiles]
    return dict(pressurePa=float(dp),flowM3PerS=float(rates.sum()),channelFlows=rates,
        velocities=velocities,mobilities=mobilities,maximumPoissonResidual=max(p[2] for p in profiles))


def rectangle_mobility(s,H,terms=2000):
    """Continuum half of a no-slip rectangle s x 2H, symmetry at z=H."""
    n=np.arange(1,2*terms,2,dtype=float)
    return H*s**3/12*(1-96*s/(np.pi**5*H)*np.sum(np.tanh(n*np.pi*H/s)/n**5))


def patch_source(c,xedges,yedges):
    def overlap(e,width,center):return np.maximum(0,np.minimum(e[1:],center+width/2)-np.maximum(e[:-1],center-width/2))
    ax=overlap(xedges,c.patch_length,c.length/2);ay=overlap(yedges,c.patch_width,c.width/2)
    a=ay[:,None]*ax[None,:]
    if abs(a.sum()-c.patch_width*c.patch_length)>1e-14:raise ValueError('Source patch lies outside the base')
    return c.power*a/(c.patch_width*c.patch_length),a


def base_conduction(c,xedges,yedges,nzb,offset=0):
    nx,ny=len(xedges)-1,len(yedges)-1;dx=np.diff(xedges);dy=np.diff(yedges);dz=c.base/nzb
    ids=offset+np.arange(nx*ny*nzb).reshape(nzb,ny,nx)
    m=Matrix(offset+ids.size)
    m.edge(ids[:,:,:-1],ids[:,:,1:],c.solid_k*dy[None,:,None]*dz/((dx[:-1]+dx[1:])/2)[None,None,:])
    m.edge(ids[:,:-1,:],ids[:,1:,:],c.solid_k*dx[None,None,:]*dz/((dy[:-1]+dy[1:])/2)[None,:,None])
    if nzb>1:m.edge(ids[:-1,:,:],ids[1:,:,:],c.solid_k*dy[None,:,None]*dx[None,None,:]/dz)
    return ids,m


def view_factors(s,H,ny,nz):
    """Crossed strings, segments in CCW order; aperture included as last wall."""
    pts=[]
    for a,b in zip(np.linspace(0,s,ny+1)[:-1],np.linspace(0,s,ny+1)[1:]):pts.append(((a,0),(b,0)))
    z=np.linspace(0,H,nz+1)
    for a,b in zip(z[:-1],z[1:]):pts.append(((s,a),(s,b)))
    pts.append(((s,H),(0,H)))
    for a,b in zip(z[:0:-1],z[-2::-1]):pts.append(((0,a),(0,b)))
    a=np.array([p[0] for p in pts]);b=np.array([p[1] for p in pts]);lens=np.linalg.norm(b-a,axis=1)
    dist=lambda p,q:np.linalg.norm(p[:,None,:]-q[None,:,:],axis=2)
    exchange=(dist(a,a)+dist(b,b)-dist(a,b)-dist(b,a))/2
    np.fill_diagonal(exchange,0)
    if exchange.min() < -1e-12*max(s,H):raise ValueError('Negative crossed-string exchange')
    F=np.maximum(exchange,0)/lens[:,None]
    return F,lens


def radiosity_operator(F,lens,epsilon):
    e=np.asarray(epsilon);n=len(e)
    M=np.eye(n)-(1-e[:,None])*F
    R=lens[:,None]*(np.eye(n)-F)@np.linalg.solve(M,np.diag(e))*SIGMA
    return R


def build(c=Conditions(),refinement=1,hydraulic_refinement=1):
    r=refinement
    if not isinstance(r,int) or not 1<=r<=8:raise ValueError('Refinement is an integer 1..8')
    if c.flow<=0:raise ValueError('Natural convection needs its own buoyant/open-flow model; no forced zero-flow continuation')
    if not 0<=c.emissivity<=1:raise ValueError('Emissivity is 0..1')
    nx,nzf,nyg,nzb=8*r,4*r,3*r,r;ng=c.fins+1
    xe=np.linspace(0,c.length,nx+1);dx=c.length/nx;dz=c.height/nzf;dy=c.gap/nyg
    # Alternating guard gap / fin footprint; cell boundaries align exactly.
    edges=[0.];gapy=[];finy=[]
    for j in range(ng):
        start=len(edges)-1
        edges.extend(np.linspace(edges[-1],edges[-1]+c.gap,nyg+1)[1:]);gapy.append(np.arange(start,start+nyg))
        if j<c.fins:
            start=len(edges)-1;edges.extend(np.linspace(edges[-1],edges[-1]+c.thickness,r+1)[1:]);finy.append(np.arange(start,start+r))
    ye=np.array(edges);nb=nzb*(len(ye)-1)*nx;nf=c.fins*nzf*nx;nfluid=ng*nzf*nyg*nx;size=nb+nf+nfluid
    base,old=base_conduction(c,xe,ye,nzb);m=Matrix(size);m.rr=old.rr;m.cc=old.cc;m.vv=old.vv
    fins=nb+np.arange(nf).reshape(c.fins,nzf,nx)
    fluid=nb+nf+np.arange(nfluid).reshape(ng,nzf,nyg,nx)
    b=np.zeros(size);source,patch=patch_source(c,xe,ye);b[base[0].ravel()]=source.ravel()
    for j in range(c.fins):
        m.edge(fins[j,:,:-1],fins[j,:,1:],c.solid_k*c.thickness*dz/dx)
        m.edge(fins[j,:-1,:],fins[j,1:,:],c.solid_k*c.thickness*dx/dz)
        for yidx in finy[j]:
            area=(ye[yidx+1]-ye[yidx])*dx
            m.edge(base[-1,yidx,:],fins[j,0,:],c.solid_k*area/(c.base/nzb/2+dz/2))
        # Exactly the same small end-face area and prescribed h as the learning
        # model. These two edge faces are NOT part of the Graetz fluid solution.
        for i in [0,nx-1]:m.add(fins[j,:,i],fins[j,:,i],c.h_reference*c.thickness*dz)
    hydro=allocate_flow([c.gap]*ng,c.height,c.length,c.rho*c.nu,nyg,nzf,flow=c.flow,profile_refinement=hydraulic_refinement)
    for j in range(ng):
        ids=fluid[j];u=hydro['velocities'][j]
        m.edge(ids[:,:-1,:],ids[:,1:,:],c.fluid_k*dx*dz/dy)
        m.edge(ids[:-1,:,:],ids[1:,:,:],c.fluid_k*dx*dy/dz)
        capacity_flow=c.rho*c.cp*u*dy*dz
        m.add(ids,ids,capacity_flow[:,:,None])
        m.add(ids[:,:,1:],ids[:,:,:-1],-capacity_flow[:,:,None])
        for iy,by in enumerate(gapy[j]):
            m.edge(base[-1,by,:],ids[0,iy,:],dx*dy/(c.base/nzb/(2*c.solid_k)+dz/(2*c.fluid_k)))
        if j>0:m.edge(fins[j-1],ids[:,0,:],dx*dz/(c.thickness/(2*c.solid_k)+dy/(2*c.fluid_k)))
        if j<c.fins:m.edge(fins[j],ids[:,-1,:],dx*dz/(c.thickness/(2*c.solid_k)+dy/(2*c.fluid_k)))
    rad=Matrix(size);ambient_links=[];max_closure=0.;max_reciprocity=0.
    F,lens=view_factors(c.gap,c.height,nyg,nzf)
    for j in range(ng):
        # Segment order: base, right ascending, aperture, left descending.
        ids=np.vstack([base[-1,gapy[j],:],fins[j] if j<c.fins else np.full((nzf,nx),-1),
                       np.full((1,nx),-1),fins[j-1,::-1,:] if j>0 else np.full((nzf,nx),-1)])
        eps=np.full(len(lens),c.emissivity);eps[nyg+nzf]=1
        if j==ng-1:eps[nyg:nyg+nzf]=0
        if j==0:eps[-nzf:]=0
        R=radiosity_operator(F,lens,eps)
        max_closure=max(max_closure,float(abs(F.sum(axis=1)-1).max()))
        max_reciprocity=max(max_reciprocity,float(abs(R-R.T).max())/max(abs(R).max(),1e-300))
        if c.emissivity==0:continue
        for a in range(len(lens)):
            for bb in range(a+1,len(lens)):
                g=max(0.,-.5*(R[a,bb]+R[bb,a])*dx)
                if g<1e-26:continue
                ia,ib=ids[a],ids[bb]
                if ia[0]>=0 and ib[0]>=0:rad.edge(ia,ib,g)
                elif ia[0]>=0 or ib[0]>=0:
                    ii=ia if ia[0]>=0 else ib
                    rad.add(ii,ii,g);ambient_links.append((ii.copy(),g))
    return dict(c=c,r=r,hydraulic_refinement=hydraulic_refinement,K=m.matrix(),R=rad.matrix(),b=b,base=base,fins=fins,fluid=fluid,
        hydro=hydro,xe=xe,ye=ye,gapy=gapy,finy=finy,dx=dx,dy=dy,dz=dz,source=source,patch=patch,
        ambient_links=ambient_links,radiationClosure=max_closure,radiationReciprocity=max_reciprocity)


def fourth_difference(theta,T):return theta*(4*T**3+theta*(6*T*T+theta*(4*T+theta)))


def solve(system,initial=None):
    c=system['c'];K,R,b=system['K'],system['R'],system['b'];lu=splu(K)
    theta=lu.solve(b) if initial is None else np.array(initial,dtype=float).copy()
    history=[]
    for it in range(60):
        f=fourth_difference(theta,c.ambient)
        new=lu.solve(b-R@f)
        if not np.all(np.isfinite(new)) or (new+c.ambient).min()<=0 or (new+c.ambient).max()>500:
            raise ValueError('Reference nonlinear iteration left its positive-K / <=500 K budget')
        change=float(abs(new-theta).max());theta=new
        residual=K@theta+R@fourth_difference(theta,c.ambient)-b
        history.append(dict(iteration=it+1,maximumChangeK=change,maximumResidualW=float(abs(residual).max())))
        if change<1e-10 and abs(residual).max()<1e-10:break
    else:raise RuntimeError('Radiation fixed-point iteration did not converge; no silent approximation')
    return theta,history


def measure(system,theta,history):
    c=system['c'];K,R,b=system['K'],system['R'],system['b'];base,fins,fluid=[system[p] for p in ['base','fins','fluid']]
    dx,dy,dz=system['dx'],system['dy'],system['dz'];db=c.base/system['r']
    tb,tf,ta=theta[base],theta[fins],theta[fluid]
    weights=system['patch'];source=system['source']
    # Source face reconstruction; cells/patch boundaries align for standard r.
    surface=tb[0]+source/(np.diff(system['ye'])[:,None]*dx)*db/(2*c.solid_k)
    source_temp=c.ambient+float((surface*weights).sum()/weights.sum())
    outgoing=0.;interface=0.;wall_by_gap=[];bulk=[]
    for j in range(c.fins+1):
        u=system['hydro']['velocities'][j];f=c.rho*c.cp*u*dy*dz
        outgoing+=float((f*ta[j,:,:,-1]).sum());bulk.append((c.ambient+(f[:,:,None]*ta[j]).sum(axis=(0,1))/f.sum()).tolist())
        wall=0.
        for iy,by in enumerate(system['gapy'][j]):
            g=dx*dy/(db/(2*c.solid_k)+dz/(2*c.fluid_k))
            wall+=float((g*(tb[-1,by,:]-ta[j,0,iy,:])).sum())
        g=dx*dz/(c.thickness/(2*c.solid_k)+dy/(2*c.fluid_k))
        if j>0:wall+=float((g*(tf[j-1]-ta[j,:,0,:])).sum())
        if j<c.fins:wall+=float((g*(tf[j]-ta[j,:,-1,:])).sum())
        interface+=wall;wall_by_gap.append(wall)
    ends=float(c.h_reference*c.thickness*dz*(tf[:,:,0].sum()+tf[:,:,-1].sum()))
    f=fourth_difference(theta,c.ambient);rad=float((R@f).sum());port=sum(float(g*f[ids].sum()) for ids,g in system['ambient_links'])
    energy=c.power-outgoing-ends-rad
    volumes=np.diff(system['ye'])[None,:,None]*dx*db
    base_mean=c.ambient+float((tb*volumes).sum()/(c.width*c.length*c.base))
    dh=4*c.gap*c.height/(c.gap+2*c.height);U=c.flow/((c.fins+1)*c.gap*c.height)
    analytic=rectangle_mobility(c.gap,c.height)
    return dict(refinement=system['r'],hydraulicRefinement=system['hydraulic_refinement'],unknowns=len(theta),nx=base.shape[2],nyBase=base.shape[1],nzBase=base.shape[0],
        nyFluid=fluid.shape[2],nzFin=fins.shape[1],nonlinearHistory=history,
        sourceAverageTemperatureK=source_temp,maximumBaseCellTemperatureK=float(c.ambient+tb.max()),
        sourceFaceMaximumTemperatureK=float(c.ambient+surface[weights>0].max()),baseVolumeMeanTemperatureK=base_mean,
        baseTemperatureRangeK=float(tb.max()-tb.min()),finTemperatureRangeK=[float(c.ambient+tf.min()),float(c.ambient+tf.max())],
        bulkTemperaturesK=bulk,heatToFluidW=interface,fluidEnthalpyIncreaseW=outgoing,
        endConvectionW=ends,radiationOutwardW=rad,radiationApertureW=port,
        channelInterfaceHeatsW=wall_by_gap,energyResidualW=energy,relativeEnergyResidual=abs(energy)/max(c.power,1),
        fluidInternalBalanceW=interface-outgoing,radiationInternalBalanceW=rad-port,
        solidResidualMaximumW=float(abs((K@theta+R@f-b)[:base.size+fins.size]).max()),
        fluidResidualMaximumW=float(abs((K@theta+R@f-b)[base.size+fins.size:]).max()),
        radiationViewClosure=system['radiationClosure'],radiationReciprocity=system['radiationReciprocity'],
        pressureDropPa=system['hydro']['pressurePa'],totalFlowM3PerS=system['hydro']['flowM3PerS'],
        channelFlowsM3PerS=system['hydro']['channelFlows'].tolist(),
        hydraulicMobilityRelativeError=float(system['hydro']['mobilities'][0]*(c.rho*c.nu*c.length)/analytic-1),
        meanChannelSpeedMPerS=U,RePlanar=U*2*c.gap/c.nu,ReWetted=U*dh/c.nu,
        PePlanar=U*2*c.gap*c.rho*c.cp/c.fluid_k,
        transverseFinBi=c.h_reference*c.thickness/(2*c.solid_k),
        approximateRichardsonHeight=9.81/c.ambient*(source_temp-c.ambient)*c.height/U**2,
        sourceToBaseVolumeMeanResistanceKPerW=(source_temp-base_mean)/c.power if c.power else None,
        boundaryTemperatureApproximation='Radiation uses base/fin adjacent cell temperature, not an independently solved surface node',
        generalCFD=False,releaseApproved=False)
