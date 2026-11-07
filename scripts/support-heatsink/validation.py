"""Continuous limits and measured errors, not a reference to real hardware."""
from pathlib import Path
from dataclasses import replace
import json,hashlib
import numpy as np
from scipy.sparse.linalg import spsolve
from prototype import (Conditions,Matrix,base_conduction,patch_source,rectangle_mobility,
    allocate_flow,view_factors,radiosity_operator,SIGMA)

ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/dynamic/support-heatsink'

def spreading_series(c,terms,top_h=None):
    """Rectangle slab, bottom rectangular uniform flux; insulated lateral walls.
    Source-area mean surface T, upper plane Dirichlet (default) or uniform Robin.
    Derived from cosine-mode separation, independent of the FV operator.
    """
    m=np.arange(terms+1,dtype=float);n=m.copy();a=np.ones(terms+1);a[1:]=2
    fx=np.cos(m*np.pi/2)*np.sinc(m*c.patch_length/(2*c.length))
    fy=np.cos(n*np.pi/2)*np.sinc(n*c.patch_width/(2*c.width))
    lam=np.sqrt((m[None,:]*np.pi/c.length)**2+(n[:,None]*np.pi/c.width)**2)
    ll=lam.copy();ll[0,0]=1
    if top_h is None:response=np.tanh(ll*c.base)/(c.solid_k*ll);response[0,0]=c.base/c.solid_k
    else:
        tanh=np.tanh(ll*c.base);response=(1+top_h/(c.solid_k*ll)*tanh)/(c.solid_k*ll*tanh+top_h)
        response[0,0]=c.base/c.solid_k+1/top_h
    weights=(a*fy*fy)[:,None]*(a*fx*fx)[None,:]/(c.length*c.width)
    total=float((weights*response).sum())
    uniform=(c.base/c.solid_k+(0 if top_h is None else 1/top_h))/(c.length*c.width)
    return dict(totalSourceResistanceKPerW=total,nonuniformSpreadingResistanceKPerW=total-uniform,
        uniformResistanceKPerW=uniform,termsPerCoordinate=terms)


def spreading_fv(c,r):
    nx,ny,nz=8*r,8*r,r
    xe=np.linspace(0,c.length,nx+1);ye=np.linspace(0,c.width,ny+1)
    ids,M=base_conduction(c,xe,ye,nz);dx=c.length/nx;dy=c.width/ny;dz=c.base/nz
    # Upper plane is isothermal Ta, not the fin-array mixed boundary.
    M.add(ids[-1],ids[-1],2*c.solid_k*dx*dy/dz)
    b=np.zeros(ids.size);power,patch=patch_source(c,xe,ye);b[ids[0].ravel()]=power.ravel()
    K=M.matrix();theta=spsolve(K,b).reshape(ids.shape)
    bottom=theta[0]+power/(dx*dy)*dz/(2*c.solid_k)
    rsource=float((bottom*patch).sum()/patch.sum()/c.power)
    out=float((2*c.solid_k*dx*dy/dz*theta[-1]).sum())
    return dict(refinement=r,nx=nx,ny=ny,nz=nz,sourceResistanceKPerW=rsource,
        powerOutwardW=out,relativeEnergyResidual=abs(out-c.power)/c.power,
        maximumResidualW=float(abs(K@theta.ravel()-b).max()))


def single_fin(c,n):
    A=c.thickness*c.length;P=2*(c.thickness+c.length);L=c.height;dx=L/n;h=c.h_reference;k=c.solid_k;root=20.
    m=Matrix(n);ids=np.arange(n);m.edge(ids[:-1],ids[1:],k*A/dx)
    m.add(ids,ids,h*P*dx);m.add(0,0,2*k*A/dx)
    b=np.zeros(n);b[0]=2*k*A/dx*root;K=m.matrix();th=spsolve(K,b)
    q=2*k*A/dx*(root-th[0]);rate=np.sqrt(h*P/(k*A));eta=np.tanh(rate*L)/(rate*L)
    edges=np.linspace(0,L,n+1)
    means=root*(np.sinh(rate*(L-edges[:-1]))-np.sinh(rate*(L-edges[1:])))/(rate*dx*np.cosh(rate*L))
    return dict(cells=n,analyticEfficiency=eta,discreteEfficiency=q/(h*P*L*root),
        relativeHeatError=abs(q/(h*P*L*root)-eta)/eta,
        maximumRelativeCellMeanTemperatureError=float(abs(th-means).max()/root),
        energyRelativeError=abs(q-h*P*dx*th.sum())/q)


def radiation_checks():
    F=np.array([[0.,1.],[1.,0.]]);area=np.array([2.,2.]);eps=np.array([.8,.6]);T=np.array([400.,300.])
    R=radiosity_operator(F,area,eps);q=R@T**4
    exact=2*SIGMA*(400**4-300**4)/(1/.8+1/.6-1)
    G,lens=view_factors(.003,.03,4,8);aperture=4+8
    rb=radiosity_operator(G,lens,np.ones(len(lens)));Ts=np.full(len(lens),400.);Ts[aperture]=300
    qq=rb@(Ts**4);opening=.003*SIGMA*(400**4-300**4)
    return dict(grayTwoPlateRelativeError=float(abs(q[0]-exact)/exact),
        grayTwoPlateEnergyDifferenceW=float(q.sum()),
        blackCavityOpeningRelativeError=float(abs(-qq[aperture]-opening)/opening),
        blackCavityEnergyDifferenceW=float(qq.sum()),
        viewClosure=float(abs(G.sum(axis=1)-1).max()),
        viewReciprocityMaximumLengthM=float(abs(lens[:,None]*G-lens[None,:]*G.T).max()))


def flow_checks(c):
    gaps=[.0025,.003,.0035]
    a=allocate_flow(gaps,c.height,c.length,c.rho*c.nu,12,16,flow=c.flow,profile_refinement=2)
    b=allocate_flow(gaps,c.height,c.length,c.rho*c.nu,12,16,pressure=a['pressurePa'],profile_refinement=2)
    refs=np.array([rectangle_mobility(s,c.height)/(c.rho*c.nu*c.length) for s in gaps])
    expected=c.flow*refs/refs.sum()
    transferred=[float(v.sum()*s/12*c.height/16) for s,v in zip(gaps,a['velocities'])]
    zero=''
    try:allocate_flow(gaps,c.height,c.length,c.rho*c.nu,12,16,flow=0)
    except ValueError as e:zero=str(e)
    return dict(gapsM=gaps,pressureDropPa=a['pressurePa'],flowsM3PerS=a['channelFlows'].tolist(),
        continuousFlowsM3PerS=expected.tolist(),
        relativeMobilityErrors=(a['mobilities']/refs-1).tolist(),
        relativeFlowAllocationErrors=(a['channelFlows']/expected-1).tolist(),
        fixedFlowToPressureRoundTripRelativeError=abs(b['flowM3PerS']-c.flow)/c.flow,
        conservativeVelocityTransferMaximumRelativeError=float(abs(np.array(transferred)-a['channelFlows']).max()/a['channelFlows'].max()),
        zeroFlowRejected=bool(zero),zeroFlowReason=zero)


def main():
    c=Conditions();slab=replace(c,fins=1,gap=.0195,patch_width=.01)
    series=[spreading_series(slab,n) for n in [80,160,320,640]]
    fv=[spreading_fv(slab,r) for r in [1,2,4]]
    for f in fv:f['relativeResistanceError']=f['sourceResistanceKPerW']/series[-1]['totalSourceResistanceKPerW']-1
    data=dict(spreading=dict(config=slab.__dict__,width=slab.width,series=series,fv=fv,
                 series320To640RelativeChange=abs(series[-1]['totalSourceResistanceKPerW']/series[-2]['totalSourceResistanceKPerW']-1)),
        fins=[single_fin(c,n) for n in [8,16,32,64]],flow=flow_checks(c),radiation=radiation_checks(),
        releaseApproved=False,independentFullConjugateCFDComparison=False)
    data['generatorSHA256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    with (OUT/'VALIDATION.json').open('x') as f:json.dump(data,f,indent=2);f.write('\n')
    print(json.dumps(data,indent=2))

if __name__=='__main__':main()
