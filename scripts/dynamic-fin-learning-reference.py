"""Continuous adiabatic-tip fin: steady hyperbolic solution plus sine modes.
High precision independently equates derivative heat and the side integral.
"""
import datetime, hashlib, json, pathlib, platform, subprocess
import mpmath as mp

root=pathlib.Path(__file__).resolve().parents[1]
mp.mp.dps=50
k=mp.mpf(200);h=mp.mpf(25);A=mp.mpf('.0001');P=mp.mpf('.04');delta=mp.mpf(60)
m=mp.sqrt(h*P/(k*A));alpha=k/(2700*896);time_s=600
cases=[]
for length,grids in [(mp.mpf('.1'),[32,48]),(mp.mpf('.05'),[16,24])]:
    theta=lambda x:delta*mp.cosh(m*(length-x))/mp.cosh(m*length)
    derivative_heat=-k*A*mp.diff(theta,0)
    side_heat=h*P*mp.quad(theta,[0,length])
    assert abs(derivative_heat-side_heat)<mp.mpf('1e-45')
    eigen=[(j+mp.mpf('.5'))*mp.pi/length for j in range(200)]
    coeff=[-2*lam*delta/(length*(lam*lam+m*m)) for lam in eigen]
    exponential=[mp.exp(-alpha*(lam*lam+m*m)*time_s) for lam in eigen]
    q_base=derivative_heat-k*A*sum(b*lam*e for lam,b,e in zip(eigen,coeff,exponential))
    q_side=side_heat+h*P*sum(b/lam*e for lam,b,e in zip(eigen,coeff,exponential))
    samples=[]
    for n in grids:
        cells=[]
        for i in range(n):
            a=length*i/n;b=length*(i+1)/n;dx=b-a
            steady=delta*(mp.sinh(m*(length-a))-mp.sinh(m*(length-b)))/(m*dx*mp.cosh(m*length))
            transient=sum(c*(mp.cos(lam*a)-mp.cos(lam*b))/(lam*dx)*e for lam,c,e in zip(eigen,coeff,exponential))
            cells.append(float(mp.mpf('293.15')+steady+transient))
        samples.append({'n':n,'temperatureCellAverageK':cells})
    cases.append({'lengthM':float(length),'mPerM':float(m),'steadyBasePowerW':float(derivative_heat),'timeS':time_s,'basePowerW':float(q_base),'sidePowerW':float(q_side),'netStoragePowerW':float(q_base-q_side),'efficiency':float(q_side/(h*P*length*delta)),'effectiveness':float(q_side/(h*A*delta)),'samples':samples})
print(json.dumps({'generatedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
 'generatorTreeDirty':bool(subprocess.check_output(['git','status','--porcelain','--','scripts/dynamic-fin-learning-reference.py'],cwd=root,text=True).strip()),
 'generatorSHA256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
 'environment':{'python':platform.python_version(),'mpmath':mp.__version__},
 'method':'50-digit hyperbolic steady solution: derivative and side integral agree independently. Add 200 homogeneous sine modes for the finite-time response, analytically integrated over every cell. No FVM updates reused.',
 'config':{'k':200,'rho':2700,'cp':896,'h':25,'areaM2':.0001,'perimeterM':.04,'baseK':353.15,'ambientK':293.15,'initialK':293.15},
 'cases':cases,'expertApproved':False,'passed':True},indent=2))
