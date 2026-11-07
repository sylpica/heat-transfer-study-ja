"""Independent continuous thermal limits, not a replacement channel solver."""
from pathlib import Path
import hashlib,json
import numpy as np
import sympy as sp
import mpmath as mp
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

def reference():
    z=sp.Symbol('z');u=6*z*(1-z)
    f=sp.Rational(17,70)-z+2*z**3-z**4
    assert sp.integrate(u*f,(z,0,1))==0
    assert sp.diff(f,z,2)==2*u
    assert sp.diff(f,z).subs(z,0)==-1 and sp.diff(f,z).subs(z,1)==1
    mp.mp.dps=70
    def series(mu):
        prev=mp.mpf(0);current=mp.mpf(1);s=current
        for j in range(160):
            nex=-mu*(current-prev)/((2*j+2)*(2*j+1))
            s+=nex;prev,current=current,nex
        return s
    mu=mp.findroot(series,(mp.mpf(2),mp.mpf(4)))
    def ode(m):
        return solve_ivp(lambda x,v:[v[1],-m*(1-x*x)*v[0]],(0,1),[1,0],
                         method='DOP853',rtol=2.3e-14,atol=1e-15,dense_output=True)
    shooting=brentq(lambda m:ode(m).y[0,-1],2,4,xtol=5e-15)
    sol=ode(shooting);nodes,weights=np.polynomial.legendre.leggauss(128)
    eta=(nodes+1)/2;bulk=1.5*np.dot(weights/2,(1-eta*eta)*sol.sol(eta)[0])
    fluxNu=-4*sol.y[1,-1]/bulk
    return dict(equalFlux=dict(polynomial='17/70 - z + 2 z^3 - z^4',
                nusseltExactFraction='140/17',nusselt=float(sp.Rational(140,17)),
                bulkOffsetIntegral=0,wallBulkOffsetDimensionless=float(sp.Rational(17,70))),
        equalWallTemperature=dict(eigenvalueSeries70Digits=str(mu),
            nusseltSeries70Digits=str(8*mu/3),eigenvalueShooting=shooting,
            nusseltShooting=8*shooting/3,nusseltFluxIntegral=fluxNu,
            relativeSeriesShootingDifference=abs(float(mu)-shooting)/float(mu),
            relativeFluxIntegralDifference=abs(fluxNu-8*shooting/3)/(8*shooting/3)),
        textbook=dict(title='A Heat Transfer Textbook, sixth edition, Version 6.00',
            section='7.5',equations=['7.62','7.63'],bookPage=386,pdfPageOneBased=400,
            pageImageInspected=True,printedNuEqualFlux=8.235,printedNuEqualTemperature=7.541,
            printedValuesRounded=True,rawTextOrFigureRedistributed=False),releaseApproved=False)

if __name__=='__main__':
    data=reference();data['generatorSHA256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    path=Path(__file__).resolve().parents[2]/'docs/dynamic/support-forced/GRAETZ_CONTINUOUS.json'
    with path.open('x') as f:json.dump(data,f,indent=2);f.write('\n')
    print(json.dumps(data,indent=2))
