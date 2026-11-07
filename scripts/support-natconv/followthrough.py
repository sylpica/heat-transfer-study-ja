#!/usr/bin/env python3
"""Steady-tail dt comparison and explicitly warm/regridded coarse-grid check.
No cold-start claim is made for the regridded128 calculation.
"""
import os
for name in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS'):os.environ[name]='1'
from pathlib import Path
import importlib.util,json,time,hashlib
import numpy as np
from scipy.interpolate import RegularGridInterpolator
ROOT=Path(__file__).resolve().parents[2];DIR=ROOT/'docs/dynamic/support-natconv';spec=importlib.util.spec_from_file_location('support_proto',Path(__file__).with_name('prototype.py'));proto=importlib.util.module_from_spec(spec);spec.loader.exec_module(proto)

def restored(stem):
    info=json.loads((DIR/(stem+'.json')).read_text());d=np.load(DIR/info['fullState']);m=proto.Cavity(info['grid'],info['ra'])
    for key,field in [('T','temperature'),('u','u'),('v','v'),('p','pressureStageMean'),('heats','heats'),('comp','compensation')]:setattr(m,key,d[field].copy())
    m.time=float(d['time']);m.steps=int(d['steps']);return m,info

def save(m,path):np.savez_compressed(path,temperature=m.T,u=m.u,v=m.v,pressureStageMean=m.p,heats=m.heats,compensation=m.comp,time=m.time,steps=m.steps)
def main():
    out=DIR/'FOLLOWTHROUGH.json';assert not out.exists(),'Protect saved result';rows=[];started=time.perf_counter()
    for stem in ['RA10000_N64_DT1_stagev2','RA100000_N128_DT1_stagev2','RA1000000_N192_DT1_stagev3']:
        branch=[]
        for factor in (1.,.5):
            m,info=restored(stem);initial=(m.T.copy(),m.u.copy(),m.v.copy());target=m.time+.02;steps=m.steps;begin=time.perf_counter();nextlog=10
            while m.time<target:
                m.step(min(m.dt(factor),target-m.time))
                if time.perf_counter()-begin>nextlog:print(json.dumps({'tailProgress':True,'ra':m.ra,'grid':m.n,'factor':factor,'t':m.time,'seconds':time.perf_counter()-begin}),flush=True);nextlog+=10
            path=DIR/(stem+f'_tail{factor}.npz');assert not path.exists();save(m,path)
            branch.append((m,{'factor':factor,'last':m.metrics(),'stepsThisTail':m.steps-steps,'temperatureChangeFromSteadyStart':float(abs(m.T-initial[0]).max()),'velocityChangeFromSteadyStart':float(max(abs(m.u-initial[1]).max(),abs(m.v-initial[2]).max())),'stateFile':path.name,'elapsedSeconds':time.perf_counter()-begin}))
        a,b=branch[0][0],branch[1][0];row={'ra':a.ra,'grid':a.n,'duration':.02,'kind':'steady-tail timestep sensitivity, not cold-start transient temporal convergence','branches':[x[1] for x in branch],'maximumTemperatureDifference':float(abs(a.T-b.T).max()),'maximumVelocityDifference':float(max(abs(a.u-b.u).max(),abs(a.v-b.v).max())),'NuVolumeDifference':a.metrics()['NuVolume']-b.metrics()['NuVolume'],'Nu0Difference':a.metrics()['Nu0']-b.metrics()['Nu0']};rows.append(row);print(json.dumps(row),flush=True)
    # Restrict actual192 cold-start steady temperature with exact cell overlap,
    # interpolate native staggered velocities including stationary boundary data,
    # then project the interpolated velocity back to the coarse solenoidal space.
    fine,info=restored('RA1000000_N192_DT1_stagev3');n=128;old=fine.n;m=proto.Cavity(n,1000000);newedge=np.linspace(0,1,n+1);oldedge=np.linspace(0,1,old+1)
    W=np.maximum(0,np.minimum(newedge[1:,None],oldedge[None,1:])-np.maximum(newedge[:-1,None],oldedge[None,:-1]))*n;m.T=W@fine.T@W.T
    points=lambda ys,xs:np.stack(np.meshgrid(ys,xs,indexing='ij'),axis=-1)
    interpU=RegularGridInterpolator((np.r_[0,(np.arange(old)+.5)/old,1],np.linspace(0,1,old+1)),np.vstack([np.zeros(old+1),fine.u,np.zeros(old+1)]))
    interpV=RegularGridInterpolator((np.linspace(0,1,old+1),np.r_[0,(np.arange(old)+.5)/old,1]),np.column_stack([np.zeros(old+1),fine.v,np.zeros(old+1)]))
    m.u,m.v,m.p=m.project(interpU(points((np.arange(n)+.5)/n,np.linspace(0,1,n+1))),interpV(points(np.linspace(0,1,n+1),(np.arange(n)+.5)/n)));m.inspect(m.T,m.u,m.v)
    history=[];previous=None;count=0;begin=time.perf_counter()
    for target in np.arange(.025,.401,.025):
        while m.time<target:m.step(min(m.dt(),float(target-m.time)))
        row=m.metrics()
        if previous:
            te=float(abs(m.T-previous[0]).max());ve=float(max(abs(m.u-previous[1]).max(),abs(m.v-previous[2]).max()))/max(1,float(abs(m.u).max()),float(abs(m.v).max()));ne=abs(row['NuVolume']-history[-1]['NuVolume'])/max(1,abs(row['NuVolume']));row['change']={'temperature':te,'relativeVelocity':ve,'relativeNu':ne};count=count+1 if te<1e-7 and ve<1e-6 and ne<1e-6 else 0
        history.append(row);previous=(m.T.copy(),m.u.copy(),m.v.copy());print(json.dumps({'warm128':row,'consecutive':count}),flush=True)
        if count>=2:break
    state=DIR/'RA1000000_N128_WARM_FROM192.npz';assert not state.exists();save(m,state)
    warm={'ra':m.ra,'grid':n,'coldStart':False,'initialization':'Conservative exact-overlap restriction of actual192 cold-start steady field; bilinear native face interpolation including stationary walls; DCT projection. Heat accumulators reset.','parent':'RA1000000_N192_DT1_stagev3.json','history':history,'steady':count>=2,'elapsedSeconds':time.perf_counter()-begin,'fullState':state.name}
    result={'prototypeSHA256':hashlib.sha256(Path(__file__).with_name('prototype.py').read_bytes()).hexdigest(),'followthroughSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'steadyTailSensitivity':rows,'warmCoarseGrid':warm,'elapsedSeconds':time.perf_counter()-started,'releaseApproved':False};out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'output':str(out),'warmSteady':warm['steady']}),flush=True)
    if not warm['steady']:raise SystemExit(1)
if __name__=='__main__':main()
