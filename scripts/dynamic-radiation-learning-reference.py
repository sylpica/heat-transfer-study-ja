"""Independent scalar two-plate ODE, eliminating the cold temperature by E.
No radiosity matrix or Heun update from the browser solver is reused.
"""
import datetime, hashlib, json, pathlib, platform, subprocess
import scipy
from scipy.integrate import solve_ivp

root=pathlib.Path(__file__).resolve().parents[1]
sigma=5.670374419e-8
capacity_hot,capacity_cold=200.,400.
initial_hot,initial_cold=473.15,293.15
total=capacity_hot*initial_hot+capacity_cold*initial_cold
resistance=1/.8+1/.6-1
def cold(hot):return (total-capacity_hot*hot)/capacity_cold
def watts(hot):return sigma*(hot**4-cold(hot)**4)/resistance
def rhs(t,y):return [-watts(y[0])/capacity_hot]
fine=solve_ivp(rhs,(0,20),[initial_hot],method='DOP853',rtol=2.3e-14,atol=1e-12,max_step=.05)
coarse=solve_ivp(rhs,(0,20),[initial_hot],method='DOP853',rtol=1e-11,atol=1e-10,max_step=.2)
assert fine.success and coarse.success
hot=float(fine.y[0,-1]);low=cold(hot)
assert abs(hot-coarse.y[0,-1])<1e-9
print(json.dumps({'generatedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
 'generatorTreeDirty':bool(subprocess.check_output(['git','status','--porcelain','--','scripts/dynamic-radiation-learning-reference.py'],cwd=root,text=True).strip()),
 'generatorSHA256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
 'environment':{'python':platform.python_version(),'scipy':scipy.__version__},
 'method':'Continuous equal-area gray two-plate resistance formula; scalar ODE using independent energy elimination, DOP853, repeated with a different step limit/tolerance.',
 'timeS':20.,'temperatureK':[hot,low],'initialOutwardPowerW':watts(initial_hot),'outwardPowerW':[watts(hot),-watts(hot)],
 'weightedMeanK':total/(capacity_hot+capacity_cold),'energyReferenceK':273.15,'initialSensibleEnergyJ':total-(capacity_hot+capacity_cold)*273.15,
 'repeatTemperatureDifferenceK':abs(hot-coarse.y[0,-1]),'expertApproved':False,'passed':True},indent=2))
