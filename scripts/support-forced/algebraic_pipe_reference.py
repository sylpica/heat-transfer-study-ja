"""Check existing correlation outputs; correlations are not exact turbulent DNS."""
from pathlib import Path
import hashlib,json,math
from scipy.optimize import brentq
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/dynamic/support-forced'

def evaluate(data):
    rows=[]
    for row in data['cases']:
        c=row['input'];Re=c['density']*c['velocity']*c['diameter']/c['viscosity']
        dynamic=c['length']/c['diameter']*c['density']*c['velocity']**2/2
        if row['kind']=='laminar':
            # Poiseuille volume-flux relation, without f=64/Re in the path.
            dp=128*c['viscosity']*c['length']*(c['velocity']*math.pi*c['diameter']**2/4)/(math.pi*c['diameter']**4)
            d=dict(exactPoiseuillePa=dp,relativeImplementationDifference=abs(dp-row['pressureDropPa'])/dp)
        else:
            # Primary AHTT Eq7.42 uses base10 1.82, NOT .79 ln(Re).
            fbook=(1.82*math.log10(Re)-1.64)**-2
            fsame=(.79*math.log(Re)-1.64)**-2
            # Secondary cross-correlation, not an exact physical reference.
            fc=brentq(lambda f:1/math.sqrt(f)+2*math.log10(2.51/(Re*math.sqrt(f))),.005,.1,xtol=1e-16)
            d=dict(sameFormulaPressurePa=fsame*dynamic,
                relativeImplementationDifference=abs(fsame*dynamic-row['pressureDropPa'])/(fsame*dynamic),
                textbookEquation742PressurePa=fbook*dynamic,
                relativeVersusTextbook742=(row['pressureDropPa']/(fbook*dynamic)-1),
                smoothColebrookPressurePa=fc*dynamic,
                relativeVersusSmoothColebrook=row['pressureDropPa']/(fc*dynamic)-1,
                correlationDifferenceIsNotDiscretizationError=True)
        volume=c['velocity']*math.pi*c['diameter']**2/4
        d.update(kind=row['kind'],re=Re,outputPressureDropPa=row['pressureDropPa'],
            relativeHydraulicPowerIdentity=abs(row['hydraulicPowerW']-row['pressureDropPa']*volume)/(row['pressureDropPa']*volume))
        rows.append(d)
    return dict(cases=rows,primaryReference={'title':'AHTT Version6.00','section':'7.3','equation':'7.42','bookPage':369,'pdfPageOneBased':383,'pageImageInspected':True},
                empiricalPhysicalUncertaintyApproved=False,releaseApprovalChanged=False)

if __name__=='__main__':
    source=OUT/'ALGEBRAIC_PIPE_CASES.json';r=evaluate(json.loads(source.read_text()))
    r['inputSHA256']=hashlib.sha256(source.read_bytes()).hexdigest();r['generatorSHA256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    with (OUT/'ALGEBRAIC_PIPE_REFERENCE.json').open('x') as f:json.dump(r,f,indent=2);f.write('\n')
    print(json.dumps(r,indent=2))
