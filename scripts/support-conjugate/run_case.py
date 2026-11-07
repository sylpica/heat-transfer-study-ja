#!/usr/bin/env python3
import os
for name in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS'):os.environ[name]='1'
from pathlib import Path
import argparse,hashlib,json,time,subprocess
import numpy as np
from models import FVM,P1
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/dynamic/support-conjugate'
def main():
    p=argparse.ArgumentParser();p.add_argument('--method',choices=['fv','p1'],default='fv');p.add_argument('--grid',type=int,default=32);p.add_argument('--ra',type=int,default=1000);p.add_argument('--K',type=float,default=.5);p.add_argument('--C',type=float,default=2);p.add_argument('--source',type=float,default=0);p.add_argument('--end',type=float,default=3);p.add_argument('--tag',required=True);a=p.parse_args();assert a.tag.isalnum();out=OUT/(a.tag+'.json');state=out.with_suffix('.npz');assert not out.exists() and not state.exists(),'Protect saved result'
    c=dict(n=a.grid,ra=a.ra,K=a.K,C=a.C,source=a.source);m=(FVM if a.method=='fv' else P1)(**c);history=[];previous=None;steady_count=0;start=time.perf_counter();nextlog=10;failure=None
    try:
        for target in np.arange(.1,a.end+.05,.1):
            while m.time<target:
                m.step(min(m.dt(),float(target-m.time)))
                if time.perf_counter()-start>nextlog:print(json.dumps({'progress':a.tag,'time':m.time,'steps':m.steps,'seconds':time.perf_counter()-start}),flush=True);nextlog+=15
            r=m.metrics()
            if previous:
                dT=float(abs(m.T-previous[0]).max());dU=float(max(abs(m.u-previous[1]).max(),abs(m.v-previous[2]).max()))/max(1,float(abs(m.u).max()),float(abs(m.v).max()));dQ=abs(r['interfaceIntoFluid']-history[-1]['interfaceIntoFluid'])/max(abs(r['interfaceIntoFluid']),1e-30);r['change']={'temperature':dT,'relativeVelocity':dU,'relativeInterfaceHeat':dQ};steady_count=steady_count+1 if dT<1e-7 and dU<1e-6 and dQ<1e-6 else 0
            history.append(r);previous=(m.T.copy(),m.u.copy(),m.v.copy());print(json.dumps({'sample':a.tag,**r,'consecutiveSteadyIntervals':steady_count}),flush=True)
            if steady_count>=2:break
    except ValueError as e:failure=str(e)
    result={'config':c,'method':a.method,'history':history,'last':m.metrics(),'steady':steady_count>=2,'failure':failure,'elapsedSeconds':time.perf_counter()-start,'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceSHA256':hashlib.sha256(Path(__file__).with_name('models.py').read_bytes()).hexdigest(),'stateFile':state.name,'releaseApproved':False}
    np.savez_compressed(state,temperature=m.T,u=m.u,v=m.v,pressureStageMean=m.p,heats=m.heats,compensation=m.comp,cellMeans=m.cell_means(),initial=m.initial,time=m.time,steps=m.steps);out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'output':str(out),'steady':result['steady'],'failure':failure,'seconds':result['elapsedSeconds']}),flush=True)
    if failure or not result['steady']:raise SystemExit(1)
if __name__=='__main__':main()
