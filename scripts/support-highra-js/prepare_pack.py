"""Independent DCT expectations for the EXISTING JS algorithm, no JS port.
Input states are our saved support1 fields; originals are never overwritten.
"""
from pathlib import Path
import sys,json,gzip,hashlib,importlib.util
import numpy as np
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/dynamic/support-highra-js';OLD=ROOT/'docs/dynamic/support-natconv'
spec=importlib.util.spec_from_file_location('original_dct',ROOT/'scripts/support-natconv/prototype.py')
original=importlib.util.module_from_spec(spec);spec.loader.exec_module(original)

def js_dt(m):
    n=m.n;u,v=m.u,m.v
    counts=np.full((n,n),4.);counts[:,[0,-1]]+=1;counts[[0,-1],:]-=1
    adv=n*(np.maximum(u[:,1:],0)+np.maximum(-u[:,:-1],0)+np.maximum(v[1:,:],0)+np.maximum(-v[:-1,:],0))
    rate=counts*n*n+adv
    maxspeed=max(float(abs(u).max()),float(abs(v).max()),np.sqrt(.71*m.ra),1e-12)
    return min(.8/float(rate.max()),.1/(.71*2*n*n),.1/(n*maxspeed))

def load(stem):
    info=json.loads((OLD/(stem+'.json')).read_text());d=np.load(OLD/(stem+'.npz'))
    m=original.Cavity(info['grid'],info['ra'])
    m.T=(300.+d['temperature'])-300. # Same representable absolute input as JS.
    m.u=d['u'].copy();m.v=d['v'].copy();m.p=d['pressureStageMean'].copy()
    return m,info

def state(m):return dict(temperatureOffset=m.T.ravel().tolist(),u=m.u.ravel().tolist(),v=m.v.ravel().tolist(),pressureCenteredMean=m.p.ravel().tolist(),relativeTime=m.time,metrics=m.metrics())

def projection(m,dt):
    _,a,b,_,_=m.rhs(m.T,m.u,m.v)
    us=m.u+dt*a;vs=m.v+dt*b;u,v,phi=m.project(us.copy(),vs.copy())
    # Original JS uses buoyancy theta instead of theta-.5.
    vs[1:-1,:]+=dt*.5*m.gb
    hydro=.5*m.gb*((np.arange(m.n)+.5)/m.n-.5)[:,None]*np.ones((1,m.n))
    return dict(tentativeU=us.ravel().tolist(),tentativeV=vs.ravel().tolist(),
        expectedU=u.ravel().tolist(),expectedV=v.ravel().tolist(),
        expectedPhysicalGaugePressure=(phi/dt+hydro).ravel().tolist(),
        warmPressure=(m.p+hydro).ravel().tolist())

def save(name,data):
    raw=json.dumps(data,separators=(',',':'),allow_nan=False).encode()
    path=OUT/name
    with path.open('xb') as f:f.write(gzip.compress(raw,mtime=0))
    return dict(file=name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),uncompressedBytes=len(raw))

def main():
    target=OUT/'PACK.json'
    if target.exists():raise FileExistsError('Preserve saved pack; use a new version')
    rows=[]
    for stem in ['RA10000_N64_DT1_stagev2','RA100000_N128_DT1_stagev2','RA1000000_N192_DT1_stagev3']:
        m,info=load(stem);dt=js_dt(m);start=state(m);p=projection(m,dt);checkpoints=[]
        for step in range(1,17):
            m.step(dt)
            if step in [1,16]:checkpoints.append(dict(step=step,state=state(m)))
        data=dict(ra=m.ra,n=m.n,dt=dt,sourceTime=info['last']['time'],initial=start,projection=p,checkpoints=checkpoints)
        row=dict(ra=m.ra,n=m.n,jsDt=dt,originalDctDt=original.Cavity(m.n,m.ra).dt(),
            source=stem+'.npz',sourceSHA256=hashlib.sha256((OLD/(stem+'.npz')).read_bytes()).hexdigest(),
            canonicalSteady=info['last'],coldStartRecomputed=False,checkpoints=[1,16])
        row.update(save(f'RA{m.ra}_N{m.n}_comparison.json.gz',data));rows.append(row)
        print(json.dumps({k:row[k] for k in ['ra','n','jsDt','file']}),flush=True)
    # Same saved real cold-start pre-failure state, smaller JS-safe timesteps.
    stem='RA1000000_N128_DT1_stagev2';initial,info=load(stem);trials=[]
    for factor in [1.,.5,.25]:
        m,_=load(stem);dt=factor*js_dt(m);failure=None;accepted=0
        for i in range(64):
            before=(m.T.copy(),m.u.copy(),m.v.copy(),m.time)
            try:m.step(dt);accepted+=1
            except ValueError as e:
                failure=str(e)
                assert np.array_equal(before[0],m.T) and np.array_equal(before[1],m.u) and np.array_equal(before[2],m.v) and before[3]==m.time
                break
        trials.append(dict(factor=factor,dt=dt,acceptedSteps=accepted,failure=failure,last=state(m)))
    fail=dict(ra=1e6,n=128,sourceTime=info['last']['time'],initial=state(initial),trials=trials,
              source=stem+'.npz',sourceSHA256=hashlib.sha256((OLD/(stem+'.npz')).read_bytes()).hexdigest(),
              scope='Continuation from a DCT cold-start state, NOT a JS cold-start from t=0')
    failureFile=save('RA1000000_N128_pre_failure.json.gz',fail)
    pack=dict(schema='support-highra-js-comparison-v1',units='L=H=depth=alpha=rho=cp=deltaT=1, nu=Pr=.71; physical reference Tc=300 K,Th=301 K',
        temperature='theta=T-300; initial canonical cold theta=.5, u=v=0',
        pressure='JS mean of SSPRK2 stage pressures; DCT centered-buoyancy mean + .5*rho*gBeta*(y-.5); mean-zero gauge',
        cases=rows,failureReplay=failureFile,
        tolerances=dict(projectionVelocityMax=1e-8,projectionPressureMaxFloor=1e-5,projectionPressureRelativeToMax=1e-9,
            continuationTemperatureMax=1e-9,continuationVelocityMax=1e-7,continuationNuAbsolute=1e-7,
            literatureAverageNuRelative=.01,literatureLocalNuRelative=.02),
        sourceSHA256={str(Path(__file__).relative_to(ROOT)):hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'scripts/support-natconv/prototype.py':hashlib.sha256((ROOT/'scripts/support-natconv/prototype.py').read_bytes()).hexdigest()},
        fullJsColdToSteadyVerified=False,wholeRaContinuumApproved=False,releaseApproved=False)
    with target.open('x') as f:json.dump(pack,f,indent=2);f.write('\n')
    print(json.dumps({'saved':str(target),'failureTrials':[(r['factor'],r['acceptedSteps'],r['failure']) for r in trials]}),flush=True)

if __name__=='__main__':main()
