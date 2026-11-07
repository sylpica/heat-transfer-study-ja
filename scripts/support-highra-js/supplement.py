"""Warm-grid/acceptance supplement; all base pack files remain immutable."""
from pathlib import Path
import json,hashlib
import numpy as np
from prepare_pack import OUT,OLD,original,js_dt,state,projection,save

def main():
    source=OLD/'RA1000000_N128_WARM_FROM192.npz';d=np.load(source)
    m=original.Cavity(128,1000000);m.T=(300+d['temperature'])-300;m.u=d['u'].copy();m.v=d['v'].copy();m.p=d['pressureStageMean'].copy()
    dt=js_dt(m);initial=state(m);p=projection(m,dt);checkpoints=[]
    for step in range(1,17):
        m.step(dt)
        if step in [1,16]:checkpoints.append(dict(step=step,state=state(m)))
    info=save('RA1000000_N128_warm_comparison.json.gz',dict(ra=1e6,n=128,dt=dt,initial=initial,projection=p,checkpoints=checkpoints,
        initialization='192 cold steady -> conservative temperature restriction and native velocity interpolation -> DCT projection -> 128 warm relaxation, as archived in support1',coldStart=False))
    info.update(ra=1e6,n=128,jsDt=dt,originalDctDt=original.Cavity(128,1000000).dt(),source=source.name,sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),coldStart=False)
    references=json.loads((OLD/'RESULTS.json').read_text());cases=[]
    for r in sorted(references['fineColdStartCases'],key=lambda r:r['ra']):
        cases.append(dict(ra=r['ra'],n=r['grid'],initialization='cold: theta=.5,u=v=0',
            dctSteadyReference={k:r['last'][k] for k in ['Nu0','NuVolume','NuMidplane','NuLocalMaximum','uMaximum','vMaximum','uMaximumPosition','vMaximumPosition','maximumObservedStagePe']},
            literatureReference={k:r['errors'][k]['reference'] for k in ['Nu0','NuVolume','NuMidplane','NuLocalMaximum','uMaximum','vMaximum','uMaximumPosition','vMaximumPosition']},
            sameGridSteadyAgreement=dict(NuRelative=1e-5,temperatureMaximum=2e-6,velocityMaximumRelativeToFieldPeak=2e-5),
            literatureCriteria=dict(averageNuRelative=.01,localMaximumNuRelative=.02,velocityMaximumRelative=.01,positionAbsolute=1/r['grid']+.001),
            source=r['file'],pureJsColdToSteadyRunThisSupport=False))
    warm=json.loads((OLD/'FOLLOWTHROUGH.json').read_text())['warmCoarseGrid']['history'][-1]
    pack=dict(schema='support-highra-acceptance-v1',benchmark='de Vahl Davis1983 TableV, Pr=.71, velocity scale alpha/L; definitions kept separate',
        conditions=dict(width=1,height=1,depth=1,alpha=1,nu=.71,rho=1,cp=1,temperatureColdK=300,temperatureHotK=301,
            scalarScheme='central',momentumScheme='conservative2',timeIntegrator='joint SSPRK2, project each Euler candidate velocity',wall='no-slip, horizontal adiabatic'),
        cases=cases,warm128=dict(packet=info,reference=warm,coldStart=False),
        steadyDetection=dict(temperatureMaximumChange=1e-7,velocityChangeRelative=1e-6,NuRelativeChange=1e-6,
            consecutiveIntervals=2,sampleIntervalByRa={'10000':.1,'100000':.025,'1000000':.025},shortTailIsNotSteadyDetection=True),
        mandatoryChecks=dict(maximumStagePe=2,temperatureOffsetLower=-1e-10,temperatureOffsetUpper=1+1e-10,
            divergenceNormalizedByMaxOneOrSpeedOverCell=1e-9,totalEnergyErrorAbsolute=1e-8,allStagesChecked=True,failedStepAtomic=True),
        basePackClarification='PACK.json originalDctDt is the COLD/default diffusion bound; use JS_RESULTS.dctSteadyStateSafeDt for the loaded steady field.',
        originalSources=references['referenceSource'],wholeRaContinuumApproved=False,releaseApproved=False,
        sourceSHA256={str(source.name):hashlib.sha256(source.read_bytes()).hexdigest(),'RESULTS.json':hashlib.sha256((OLD/'RESULTS.json').read_bytes()).hexdigest()},
        generatorSHA256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    with (OUT/'ACCEPTANCE_PACK.json').open('x') as f:json.dump(pack,f,indent=2);f.write('\n')
    with (OUT/'WARM_RUN_PACK.json').open('x') as f:json.dump(dict(cases=[info],tolerances=json.loads((OUT/'PACK.json').read_text())['tolerances']),f,indent=2);f.write('\n')
    print(json.dumps({'saved':'ACCEPTANCE_PACK.json / WARM_RUN_PACK.json','warmPacket':info}))

if __name__=='__main__':main()
