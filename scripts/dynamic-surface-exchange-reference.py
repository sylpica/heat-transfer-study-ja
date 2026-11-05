"""Independent continuous steady fields and a one-control-volume time reference.
No JS FVM, surface-offset Newton iteration or Euler stepping is reused.
"""
import datetime,hashlib,json,pathlib,platform,subprocess
import numpy as np
import scipy
from scipy.optimize import brentq
from scipy.integrate import solve_ivp

root=pathlib.Path(__file__).resolve().parents[1]
sigma=5.670374419e-8
def outflow(surface,h,fluid,emissivity,radiation):
    return h*(surface-fluid)+emissivity*sigma*(surface**4-radiation**4)
slab={'lengthM':.1,'k':5,'leftK':600,'h':20,'fluidK':300,'emissivity':.8,'radiationK':350}
surface=brentq(lambda t:slab['k']/slab['lengthM']*(slab['leftK']-t)-outflow(t,slab['h'],slab['fluidK'],slab['emissivity'],slab['radiationK']),300,600,xtol=1e-12)
slab.update(surfaceK=surface,outwardFluxWPerM2=slab['k']/slab['lengthM']*(slab['leftK']-surface))
radial=[]
for geometry,dimension in [('sphere',3),('cylinder',2)]:
    radius=1;source=6;k=1;h=12;fluid=400;emissivity=.8;radiation=280
    flux=source*radius/dimension
    surface=brentq(lambda t:outflow(t,h,fluid,emissivity,radiation)-flux,280,400,xtol=1e-12)
    samples=[]
    for n in [8,16,32]:
        edges=np.linspace(0,radius,n+1);a=edges[:-1];b=edges[1:]
        mean_r_squared=dimension/(dimension+2)*(b**(dimension+2)-a**(dimension+2))/(b**dimension-a**dimension)
        samples.append({'n':n,'temperatureCellAverageK':(surface+source*(radius**2-mean_r_squared)/(2*dimension*k)).tolist()})
    radial.append({'geometry':geometry,'dimension':dimension,'radius':radius,'length':1,'k':k,'rho':1,'cp':1,'source':source,'h':h,'fluidK':fluid,'emissivity':emissivity,'radiationK':radiation,'surfaceK':surface,'outwardFluxWPerM2':flux,'timeS':5,'samples':samples})
# This is a time-integration reference for ONE control volume plus its finite
# face resistance. It is deliberately not labelled a continuum transient PDE.
one={'lengthM':.1,'areaM2':1,'k':1,'rho':100,'cp':100,'initialK':500,'h':20,'fluidK':300,'emissivity':.8,'radiationK':280,'timeS':100}
G=2*one['k']*one['areaM2']/one['lengthM'];C=one['rho']*one['cp']*one['lengthM']*one['areaM2']
def rhs(t,y):
    cell=y[0]
    surface=brentq(lambda s:G*(cell-s)-one['areaM2']*outflow(s,one['h'],one['fluidK'],one['emissivity'],one['radiationK']),min(cell,280,300),max(cell,280,300),xtol=1e-12)
    return [G*(surface-cell)/C]
integrations=[]
for max_step in [2,1,.5]:
    solution=solve_ivp(rhs,[0,one['timeS']],[one['initialK']],method='DOP853',rtol=2.3e-14,atol=1e-12,max_step=max_step)
    assert solution.success
    integrations.append({'maxStepS':max_step,'temperatureK':float(solution.y[0,-1])})
assert max(r['temperatureK'] for r in integrations)-min(r['temperatureK'] for r in integrations)<1e-10
one.update(temperatureK=integrations[-1]['temperatureK'],refinement=integrations,capacityJPerK=C,conductanceWPerK=G)
path=pathlib.Path(__file__)
result={'generatedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'generatorTreeDirty':bool(subprocess.check_output(['git','status','--porcelain','--',str(path.relative_to(root))],cwd=root,text=True).strip()),'generatorSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'environment':{'python':platform.python_version(),'scipy':scipy.__version__,'numpy':np.__version__},'method':'Brent root on absolute surface temperature; continuous linear slab and volume-integrated parabolic sphere/cylinder steady fields. Separate DOP853 integration of a single finite-resistance control volume; not a transient PDE reference. No JS solver reused.','slab':slab,'radial':radial,'oneControlVolume':one,'expertApproved':False}
print(json.dumps(result,indent=2))
