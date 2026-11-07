"""Offline independent pressure-integral and developed thermal checks."""
from pathlib import Path
import hashlib,json
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/dynamic/support-forced'

def evaluate(data,reference):
    pressure=[];nodes,weights=np.polynomial.legendre.leggauss(64)
    for row in data['pressure']:
        c=row['config'];rho,mu=c['rho'],c['rho']*c['nu']
        if row['model']=='cess-imposed-closure':
            m=row['output'];meta=m['meta'];H=2*c['halfGap']
            # Integral control-volume balance using returned total shear faces,
            # rather than copying its given acceleration expression.
            dp=(m['totalShearAtFaces'][-1]-m['totalShearAtFaces'][0])/H
            actual=meta['pressureGradientPaPerM']
            pressure.append(dict(model=row['model'],config=c,referenceGradientPaPerM=dp,
                outputGradientPaPerM=actual,relativeDifference=abs(dp-actual)/abs(dp),
                independentDnsValidation=False))
            continue
        circular='pipe' in row['model']
        H=2*c['radius'] if circular else c['height']
        coord=(nodes+1)*H/(4 if circular else 2)
        jac=H/(4 if circular else 2)
        if circular:
            R=H/2
            unitVelocity=(R**2-coord**2)/(4*mu)
            response=np.dot(weights,2*coord*unitVelocity/R**2)*jac
        else:
            unitVelocity=coord*(H-coord)/(2*mu)
            response=np.dot(weights,unitVelocity)*jac/H
        U=c.get('bulkVelocity',c.get('acceleration',0)*response*rho)
        inferred=-U/response;actual=row['gradientPaPerM']
        Dh=H if circular else 2*H
        Re=rho*abs(U)*Dh/mu
        fDarcy=(64 if circular else 96)/Re
        darcy=-np.sign(U)*fDarcy/Dh*rho*U*U/2
        shear=abs(inferred)*H/(4 if circular else 2)
        pressure.append(dict(model=row['model'],config=c,referenceGradientPaPerM=float(inferred),
            outputGradientPaPerM=actual,relativeDifference=float(abs(inferred-actual)/abs(inferred)),
            darcyGradientPaPerM=float(darcy),darcyVersusIntegralRelativeDifference=float(abs(darcy-inferred)/abs(inferred)),
            referenceShearMagnitudePa=float(shear),
            shearRelativeDifference=None if 'shearPa' not in row else float(abs(shear-row['shearPa'])/shear),
            pressureLossPa=float(-actual*c['width']),imposedGradientNotSolvedTwoDimensionalPressure=True))
    graetz=[]
    for row in data['graetz']:
        c=row['config'];boundary=c['boundary'];nu=row['outlet']['localNusselt']
        target=reference['equalFlux']['nusselt'] if boundary['type']=='wall-heat-flux' else float(reference['equalWallTemperature']['nusseltSeries70Digits'])
        result=dict(ny=c['ny'],nx=c['nx'],boundary=boundary['type'],outletNu=nu,
            continuousDevelopedNu=target,relativeNuDifference=(nu-target)/target,
            textbookRoundedNu=8.235 if boundary['type']=='wall-heat-flux' else 7.541,
            energyRelativeResidual=row['energyBalanceRelativeResidual'])
        if boundary['type']=='wall-heat-flux':
            q,H,k,U=c['boundary']['wallHeatFlux'],c['height'],c['k'],c['bulkVelocity']
            tb=c['inletTemperature']+2*q*c['width']/(c['rho']*c['cp']*U*H)
            delta=q*H/k*17/70
            edges=np.linspace(0,1,c['ny']+1)
            primitive=lambda z:17/70*z-z*z/2+z**4/2-z**5/5
            cellMean=np.diff(primitive(edges))*c['ny']
            profile=tb+q*H/k*cellMean
            result.update(analyticOutletBulkK=tb,bulkAbsoluteErrorK=abs(row['outlet']['bulkTemperature']-tb),
                analyticWallMinusBulkK=delta,wallMinusBulkAbsoluteErrorK=abs(row['outlet']['wallTemperatureMean']-row['outlet']['bulkTemperature']-delta),
                quarticCellMeanMaximumErrorK=float(abs(profile-row['outletRowTemperatures']).max()),
                prescribedHeatRelativeDifference=abs(row['totalWallHeatRateW']-2*q*c['width']*c['depth'])/(2*q*c['width']*c['depth']))
        graetz.append(result)
    return dict(pressure=pressure,graetz=graetz,pressureAccuracyApproved=False,releaseApproved=False)

if __name__=='__main__':
    files=['CHANNEL_CASES.json','GRAETZ_CONTINUOUS.json'];data,ref=[json.loads((OUT/n).read_text()) for n in files]
    result=evaluate(data,ref);result['inputsSHA256']={n:hashlib.sha256((OUT/n).read_bytes()).hexdigest() for n in files}
    result['generatorSHA256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    with (OUT/'INDEPENDENT_CHANNEL.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({'maxPressureRelativeDifference':max(r['relativeDifference'] for r in result['pressure']),'graetz':result['graetz']},indent=2))
