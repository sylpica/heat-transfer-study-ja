"""Own continuous steady Graetz reference, equal wall flux, uniform inlet.
Cosine Galerkin in y with analytic Poiseuille-weighted mass matrix and positive
transverse diffusion; generalized symmetric eigensolution evolves in x.
No JavaScript FVM operator or discrete thermal network is reused.
"""
import argparse,datetime,hashlib,json,pathlib,platform,subprocess
import numpy as np
import scipy
from scipy.linalg import eigh
from scipy.special import roots_legendre
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--verify-production',action='store_true');args=parser.parse_args()
c=dict(width=.05,height=.01,depth=.01,rho=1.177,cp=1006.,k=.0264,nu=1.575e-5,bulkVelocity=.5,wallHeatFlux=50.,inlet=300.,initial=300.)
H,L,Ub,k,q=c['height'],c['width'],c['bulkVelocity'],c['k'],c['wallHeatFlux']
alpha=k/(c['rho']*c['cp']);Q=q*H/k;g=2*q/(c['rho']*c['cp']*Ub*H)

def polynomial(z):return Q*(17/70-z+2*z**3-z**4)
def primitive(z):return Q*(17*z/70-z*z/2+z**4/2-z**5/5)
def profile(modes,quadrature):
    # Use only symmetric modes n=2,4,... . psi_n=phi_n-r_n has exactly
    # zero Poiseuille-weighted mean, analytically eliminating the constant mode.
    n=2*np.arange(1,modes+1,dtype=float)
    def integral_cos(j):
        out=np.ones_like(j);nonzero=j!=0;out[nonzero]=-12/(np.pi*j[nonzero])**2;return out
    r=-12*np.sqrt(2)/(n*np.pi)**2
    M=integral_cos(n[:,None]-n[None,:])+integral_cos(n[:,None]+n[None,:])-r[:,None]*r[None,:]
    stiffness=np.diag((n*np.pi)**2)
    x,w=roots_legendre(quadrature);z=(x+1)/2;w=w/2;weight=6*z*(1-z)
    psi=np.sqrt(2)*np.cos(np.pi*z[:,None]*n)-r
    Mquad=psi.T@((w*weight)[:,None]*psi)
    mass_error=float(np.max(np.abs(M-Mquad)));assert mass_error<2e-11
    weighted_mean_f=float(np.sum(w*weight*polynomial(z)));assert abs(weighted_mean_f)<1e-11
    rhs=psi.T@(-w*weight*polynomial(z))
    mu,V=eigh(stiffness,M,check_finite=True)
    assert np.min(mu)>0 and np.max(np.abs(V.T@M@V-np.eye(modes)))<1e-9
    rates=mu*alpha/(Ub*H*H);amplitudes=V.T@rhs
    return dict(n=n,r=r,V=V,rates=rates,amplitudes=amplitudes,mass_error=mass_error,weighted_mean_f=weighted_mean_f,condition=float(np.linalg.cond(M)))

def coefficient_average(model,a,b):
    rates=model['rates'];decay=np.exp(-rates*a)*(-np.expm1(-rates*(b-a)))/(rates*(b-a))
    return model['V']@(model['amplitudes']*decay)
def coefficient_point(model,x):return model['V']@(model['amplitudes']*np.exp(-model['rates']*x))
def samples(model,nx,ny):
    a=np.arange(ny)/ny;b=a+1/ny;n=model['n'];r=model['r']
    psi_mean=np.sqrt(2)*(np.sin(np.pi*b[:,None]*n)-np.sin(np.pi*a[:,None]*n))/(np.pi*n/ny)-r
    fmean=(primitive(b)-primitive(a))*ny
    wall_basis=np.sqrt(2)-r
    xa=np.arange(nx)*L/nx;xb=xa+L/nx;xm=(xa+xb)/2
    C=np.column_stack([coefficient_average(model,float(a),float(b)) for a,b in zip(xa,xb)])
    field=c['inlet']+g*xm[None,:]+fmean[:,None]+psi_mean@C
    bulk=c['inlet']+g*xm
    wall=c['inlet']+g*xm+polynomial(0)+wall_basis@C
    nu=q*(2*H)/(k*(wall-bulk))
    point_wall=np.array([c['inlet']+g*x+polynomial(0)+wall_basis@coefficient_point(model,float(x)) for x in xm])
    return dict(nx=nx,ny=ny,temperature=field.ravel().tolist(),bulkTemperature=bulk.tolist(),wallTemperature=wall.tolist(),wallToBulkNusselt=nu.tolist(),pointWallTemperatureAtCellX=point_wall.tolist())

def compare(a,b):return max(float(np.max(np.abs(np.array(a[key])-np.array(b[key])))) for key in ['temperature','bulkTemperature','wallTemperature'])
coarse=profile(768,4096);fine=profile(1024,6144);refined=profile(1024,8192)
out=dict(generatedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceCommit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),generatorSHA256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),generatorTreeDirty=bool(subprocess.check_output(['git','status','--porcelain','--','scripts/dynamic-graetz-reference.py'],cwd=ROOT,text=True).strip()),environment=dict(python=platform.python_version(),numpy=np.__version__,scipy=scipy.__version__),config=c,method='Continuous steady Graetz PDE. Analytic Poiseuille-weighted cosine mass matrix, independent Gauss inlet projection, symmetric generalized eigendecomposition, exact x exponential and analytic x/y cell integrals. No JS finite-volume operator reused.',steadyOnly=True,releaseApproved=False,thermalEntranceResolved=True,grids=[],refinement=dict(coarseEvenCosineModes=768,fineEvenCosineModes=1024,quadraturePoints=[4096,6144,8192],analyticVsQuadratureMassMaxError=max(coarse['mass_error'],fine['mass_error'],refined['mass_error']),weightedQuarticMeanMaxAbsK=max(abs(coarse['weighted_mean_f']),abs(fine['weighted_mean_f']),abs(refined['weighted_mean_f'])),fineMassCondition=fine['condition']),fullyDeveloped=dict(bulkGradientKPerM=g,wallMinusBulkK=Q*17/70,nusseltDh=140/17),scope='Neumann wall-flux corner at x=0 is singular. Uniform inlet is imposed in velocity-weighted L2; no pointwise wall-gradient match at the inlet corner is claimed. Values use positive x or finite x-cell means. Stationary thermal entrance with prescribed developed velocity, not unsteady entrance momentum or transient PDE reference.')
for nx,ny in [(16,8),(32,16),(64,32),(128,64)]:
    a=samples(coarse,nx,ny);b=samples(fine,nx,ny);r=samples(refined,nx,ny)
    mode_error=compare(a,r);quad_error=compare(b,r)
    assert mode_error<1e-7 and quad_error<1e-8,(nx,mode_error,quad_error)
    r['modeRefinementMaxDifferenceK']=mode_error;r['quadratureRefinementMaxDifferenceK']=quad_error;out['grids'].append(r)
if args.verify_production:
    # Separate actual-production verification. These results are metadata only;
    # the continuous eigenproblem and samples above do not depend on the FVM.
    js="""import {createHeatedChannel} from './dynamic/dev/heated-channel.mjs';
const c=CONFIG;const result=[];
for(const [nx,ny] of [[16,8],[32,16],[64,32],[128,64]]){
 const m=createHeatedChannel({...c,nx,ny}),advance=end=>{while(m.time<end)m.step(Math.min(m.safeDt,end-m.time),false);return m.snapshot();};
 const one=advance(1),state=advance(2);result.push({nx,ny,state,maxSteadyChangeK:Math.max(...state.temperature.map((v,i)=>Math.abs(v-one.temperature[i])))});
}console.log(JSON.stringify(result));""".replace('CONFIG',json.dumps(c))
    states=json.loads(subprocess.check_output(['node','--input-type=module','-'],input=js,text=True,cwd=ROOT))
    rows=[]
    for ref,observed in zip(out['grids'],states):
        state=observed['state'];difference=np.array(state['temperature'])-ref['temperature'];wall=np.array(state['lowerWallTemperature'])-ref['wallTemperature'];bulk=np.array(state['bulkTemperature'])-ref['bulkTemperature'];shift=g*L/(2*ref['nx'])
        rows.append(dict(nx=ref['nx'],ny=ref['ny'],temperatureRmsK=float(np.sqrt(np.mean(difference**2))),wallRmsK=float(np.sqrt(np.mean(wall**2))),bulkRmsK=float(np.sqrt(np.mean(bulk**2))),analyticBulkHalfCellShiftK=shift,bulkMaxDifferenceFromAnalyticShiftK=float(np.max(np.abs(bulk-shift))),outletNusselt=state['wallToBulkNusselt'][-1],referenceOutletNusselt=ref['wallToBulkNusselt'][-1],outletNusseltRelativeError=state['wallToBulkNusselt'][-1]/ref['wallToBulkNusselt'][-1]-1,maxSteadyChangeK=observed['maxSteadyChangeK'],netExternalPowerW=state['netExternalPowerW'],energyErrorJ=state['energyError'],steps=state['steps']))
    combined_orders=[float(np.log2(a['temperatureRmsK']/b['temperatureRmsK'])) for a,b in zip(rows,rows[1:])]
    bulk_orders=[float(np.log2(a['bulkRmsK']/b['bulkRmsK'])) for a,b in zip(rows,rows[1:])]
    out['productionVerification']=dict(method='Actual JS production solver advanced to t=1 and t=2, then compared with independently computed continuous reference. Production results do not determine the spectral reference.',productionModelSHA256=hashlib.sha256((ROOT/'dynamic/dev/heated-channel.mjs').read_bytes()).hexdigest(),rows=rows,observedFullTemperatureRmsOrders=combined_orders,observedBulkOrders=bulk_orders,originalUnsupportedHypothesis=dict(minimumFullRmsOrderEachInterval=.8,passed=all(p>.8 for p in combined_orders),scope='Our provisional assumption, not an owner acceptance criterion. Rejected without altering the absolute error budgets. It ignores possible cancellation/mixing of different error contributions; no unique cause is established.'),criteria=dict(finestTemperatureRmsK=.05,finestWallRmsK=.1,finestOutletNuRelative=.03,steadyMaxChangeK=1e-8,bulkAnalyticShiftMaxDifferenceK=2e-10,bulkOrderTolerance=1e-6,fullErrorsMonotonicallyDecrease=True),interpretation='The exact discrete stationary cross-section balance yields Tb_i=Tin+g*(i+1)*dx, whereas the continuous x-cell mean is Tin+g*(i+1/2)*dx. Bulk error g*dx/2 is verified separately. Overall field RMS orders are only observations, not a proof of asymptotic first order.')
print(json.dumps(out,indent=2))
