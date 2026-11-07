#!/usr/bin/env python3
"""Own continuous heat mode with dynamic wall-capacity boundary; independent
high-precision root, exact control-volume averages and physical heat integrals.
No finite-volume cell mean is treated as a point value.
"""
from pathlib import Path
from datetime import datetime,timezone
import argparse,hashlib,json,math,subprocess
import mpmath as mp
import numpy as np
ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--tag',default='v1');args=parser.parse_args();assert args.tag.isalnum();out=ROOT/f'docs/dynamic/THERMAL_WALL_SPATIAL_REFERENCE_20261107_{args.tag}.json';assert not out.exists(),'Protect saved result.'
    mp.mp.dps=80;mu=mp.findroot(lambda x:x*mp.tan(x)-10,(mp.mpf('1.3'),mp.mpf('1.5')));own=json.loads(subprocess.check_output(['node','scripts/dynamic-thermal-wall-spatial-cases.mjs'],cwd=ROOT,text=True));assert abs(own['driverMu']-float(mu))<1e-14;rows=[]
    for entry in own['cases']:
        c=entry['config'];s=entry['snapshot'];nx=c['nx'];L=c['width'];H=c['height'];D=c['depth'];rhoCp=c['rho']*c['cp'];alpha=c['alpha'];k=rhoCp*alpha;lam=alpha*float(mu)**2/L**2;decay=mp.exp(-mp.mpf(alpha)*mu**2*20/(L*L));cell=[]
        for i in range(nx):cell.append(float(nx/mu*(mp.cos(mu*(1-mp.mpf(i+1)/nx))-mp.cos(mu*(1-mp.mpf(i)/nx)))*decay))
        full=np.tile(cell,nx);theta=np.array(s['offsetTemperature']);rms=math.sqrt(float(np.mean((theta-full)**2)));wall=float(mp.sin(mu)*decay);Qwall=float(k*H*D/L*mu*mp.cos(mu)*decay);QcoldOut=float(k*H*D/L*mu*decay);fluidE=float(rhoCp*L*H*D/mu*(1-mp.cos(mu))*decay);wallE=float(c['wallCapacityJPerK']*mp.sin(mu)*decay);coldIntegral=float(k*H*D/L*mu*(1-decay)/lam);interfaceIntegral=float(c['wallCapacityJPerK']*mp.sin(mu)*(1-decay));exact_heat=[0,-coldIntegral,interfaceIntegral,-coldIntegral]
        identity=float(lam*(fluidE+wallE)-QcoldOut);assert abs(identity)<1e-14;errors=np.array(s['cumulativeComponentJ'])-exact_heat
        rows.append({'nx':nx,'config':c,'maximumDt':entry['maximumDt'],'steps':s['steps'],'volumeWeightedCellMeanRmsK':rms,'maximumCellMeanErrorK':float(max(abs(theta-full))),'wallTemperatureErrorK':abs(s['wallOffsetTemperatureK']-wall),'continuousWallTemperatureOffsetK':wall,'continuousCellMeanTemperatureOffsetsK':full.tolist(),'actualCellMeanTemperatureOffsetsK':theta.tolist(),'actualWallTemperatureOffsetK':s['wallOffsetTemperatureK'],'continuousInterfaceIntoFluidW':Qwall,'actualInterfaceIntoFluidW':s['instantaneousPowersW']['interfaceIntoFluid'],'interfaceRelativeDifference':s['instantaneousPowersW']['interfaceIntoFluid']/Qwall-1,'continuousColdWallIntoFluidW':-QcoldOut,'actualColdWallIntoFluidW':s['instantaneousPowersW']['coldWallIntoFluid'],'coldWallRelativeDifference':s['instantaneousPowersW']['coldWallIntoFluid']/(-QcoldOut)-1,'continuousRelativeEnergyFluidJ':fluidE,'continuousRelativeEnergyWallJ':wallE,'continuousCumulativeComponentsJ':exact_heat,'actualCumulativeComponentsJ':s['cumulativeComponentJ'],'maximumCumulativeComponentDifferenceJ':float(max(abs(errors))),'continuousColdPowerEnergyDerivativeResidualW':identity,'ownEnergyErrorsJ':s['energyErrorJ'],'ownEnergyRoundoffBudgetJ':s['energyRoundoffBudgetJ'],'allFaceVelocitiesExactlyZero':all(x==0 for x in s['u']+s['v'])})
    orders=[math.log2(a['volumeWeightedCellMeanRmsK']/b['volumeWeightedCellMeanRmsK']) for a,b in zip(rows,rows[1:])]
    checks={'finestCellMeanRmsBelow001K':rows[-1]['volumeWeightedCellMeanRmsK']<.001,'finestWallErrorBelow001K':rows[-1]['wallTemperatureErrorK']<.001,'finalTemperatureOrderAbove15':orders[-1]>1.5,'finestInterfaceWithin2Percent':abs(rows[-1]['interfaceRelativeDifference'])<.02,'finestColdWallWithin2Percent':abs(rows[-1]['coldWallRelativeDifference'])<.02,'allThreeOwnHeatBudgets':all(all(abs(v)<=r['ownEnergyRoundoffBudgetJ'] for v in r['ownEnergyErrorsJ'].values()) for r in rows),'allFaceVelocitiesExactlyZero':all(r['allFaceVelocitiesExactlyZero'] for r in rows)}
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'criteriaDeclaredAtCommit':'9f2b539','sourceFilesSHA256':own['sourceFilesSHA256'],'referenceGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'method':'Independent80-digit root mu*tan(mu)=Cfluid/Cwall=10; continuous sine with dynamic lumped-wall boundary, exact FV volume means and both interface/cold heat integrals. Driver bisection is checked against the independent root. No product assembly is a reference.','mu80Digit':str(mu),'continuousFormula':'theta=sin(mu*(1-x/L))*exp(-alpha*mu^2*t/L^2); wall=sin(mu)*sameDecay; coldPower=lambda*(fluidEnergy+wallEnergy).','rows':rows,'cellMeanRmsOrders':orders,'checks':checks,'allChecksPassed':all(checks.values()),'flowSpatialAccuracyVerified':False,'WorkerVerified':False,'GUIVerified':False,'generalConjugateCFDApproved':False,'releaseApproved':False}
    payload=json.dumps(result,indent=2)+'\n'
    with out.open('x') as f:f.write(payload)
    print(json.dumps({'output':str(out),'rows':[{k:v for k,v in r.items() if k not in ('config','continuousCellMeanTemperatureOffsetsK','actualCellMeanTemperatureOffsetsK')} for r in rows],'orders':orders,'checks':checks}),flush=True)
    if not result['allChecksPassed']:raise RuntimeError('Saved failed continuous dynamic-wall mode; no approval.')
if __name__=='__main__':main()
