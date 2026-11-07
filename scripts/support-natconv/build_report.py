#!/usr/bin/env python3
from pathlib import Path
import json,hashlib,platform,datetime
import numpy as np
import scipy
ROOT=Path(__file__).resolve().parents[2];DIR=ROOT/'docs/dynamic/support-natconv'
REFERENCES={10000:{'Nu0':2.238,'NuVolume':2.243,'NuMidplane':2.243,'NuLocalMaximum':3.528,'uMaximum':16.178,'vMaximum':19.617,'uMaximumPosition':.823,'vMaximumPosition':.119},100000:{'Nu0':4.509,'NuVolume':4.519,'NuMidplane':4.519,'NuLocalMaximum':7.717,'uMaximum':34.73,'vMaximum':68.59,'uMaximumPosition':.855,'vMaximumPosition':.066},1000000:{'Nu0':8.817,'NuVolume':8.8,'NuMidplane':8.799,'NuLocalMaximum':17.925,'uMaximum':64.63,'vMaximum':219.36,'uMaximumPosition':.85,'vMaximumPosition':.038}}
def compare(ra,n,last,steady):
    ref=REFERENCES[ra];errors={key:{'computed':last[key],'reference':value,'signedDifference':last[key]-value,'signedRelativePercent':None if key.endswith('Position') else 100*(last[key]/value-1)} for key,value in ref.items()}
    checks={key:abs(row['signedDifference'])<=1/n+.001 if key.endswith('Position') else abs(row['signedRelativePercent'])<(1 if key in ('Nu0','NuVolume','NuMidplane') else 2) for key,row in errors.items()}
    checks.update({'twoConsecutiveSteadyIntervals':steady,'divergenceBelow1eMinus9':last['divergence']<1e-9,'centralStagePecletAtMost2':last['maximumObservedStagePe']<=2,'retainedTemperatureBounds':last['temperatureMin']>=0 and last['temperatureMax']<=1,'absoluteHeatBalanceBelow1eMinus10J':abs(last['energyErrorJ'])<1e-10,'actualPressureRelativeResidualBelow1eMinus10':last['maximumProjectionRelativeResidual']<1e-10})
    return {'errors':errors,'checks':checks,'allKnownBenchmarksAndIntegrityPassed':all(checks.values())}
def main():
    out=DIR/'RESULTS.json';assert not out.exists(),'Protect saved report';rows=[];fine=[]
    for path in sorted(DIR.glob('RA*_N*_DT1_stagev*.json')):
        j=json.loads(path.read_text());ra=j['ra'];n=j['grid'];row={'file':path.name,'ra':ra,'grid':n,'coldStart':True,'steady':j['steady'],'failure':j['failure'],'last':j['last'],'elapsedSeconds':j['elapsedSeconds'],**compare(ra,n,j['last'],j['steady'])};rows.append(row)
        if (ra,n) in ((10000,64),(100000,128),(1000000,192)):fine.append(row)
    f=json.loads((DIR/'FOLLOWTHROUGH.json').read_text());w=f['warmCoarseGrid'];warm={'ra':w['ra'],'grid':w['grid'],'coldStart':False,'steady':w['steady'],'last':w['history'][-1],**compare(w['ra'],w['grid'],w['history'][-1],w['steady'])}
    tails=[{'ra':r['ra'],'grid':r['grid'],'duration':r['duration'],'maximumTemperatureDifference':r['maximumTemperatureDifference'],'maximumVelocityDifference':r['maximumVelocityDifference'],'NuVolumeDifference':r['NuVolumeDifference'],'Nu0Difference':r['Nu0Difference']} for r in f['steadyTailSensitivity']]
    files=list(DIR.glob('*.npz'))+[ROOT/'scripts/support-natconv/prototype.py',ROOT/'scripts/support-natconv/followthrough.py',Path(__file__)]
    result={'generatedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'criteria':'PLAN.md, initial commit e7a3143; additions preserve original errors and budgets','environment':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'platform':platform.platform(),'threads':1},'referenceSource':{'paper':'de Vahl Davis1983 TableV, Pr=.71; velocities normalized by alpha/L','ownerPackSHA256':'22029fe4045039c60b4459b4120a66efe408dd96135a454ab2d80c4cb6cd1c6d','Nu0CrossCheckURL':'https://www.frontiersin.org/journals/mechanical-engineering/articles/10.3389/fmech.2018.00015/full','primaryHostedTextURL':'https://www.academia.edu/32025749/NATURAL_CONVECTION_OF_AIR_IN_A_SQUARE_CAVITY_A_BENCH_MARK_NUMERICAL_SOLUTION','newPrimaryPageImageRead':False,'Ra1e5Positions':'Newly read from hosted TableV text; not claimed supplied/verified by original pack','Ra1e6VPosition':'.038 is owner-pack rounded value; hosted TableV text .0379 retained as source precision note','rawThirdPartyTablesRedistributed':False},'coldStartSeries':rows,'fineColdStartCases':fine,'allSelectedFineColdStartChecksPassed':len(fine)==3 and all(r['allKnownBenchmarksAndIntegrityPassed'] for r in fine),'warmCoarseRa1e6':warm,'steadyTailTimeSensitivity':tails,'sourceAndOwnFieldSHA256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files},'wholeRaContinuumApproved':False,'productionGateChanged':False,'browserOrWorkerPortVerified':False,'releaseApproved':False}
    out.write_text(json.dumps(result,indent=2)+'\n')
    for row in fine:print(json.dumps({'ra':row['ra'],'grid':row['grid'],'passed':row['allKnownBenchmarksAndIntegrityPassed'],'errors':row['errors']}))
    print(json.dumps({'output':str(out),'selectedFinePassed':result['allSelectedFineColdStartChecksPassed']}))
    if not result['allSelectedFineColdStartChecksPassed']:raise SystemExit(1)
if __name__=='__main__':main()
