"""Independent continuous first thermal harmonic in a starting plane channel.
Fourier in periodic x, cosine Galerkin in insulated y, DOP853 in time.
The FVM/upwind/Euler implementation is not imported or transcribed.
"""
import datetime, hashlib, json, pathlib, platform, subprocess, time
import mpmath as mp
import numpy as np
import scipy
from scipy.integrate import solve_ivp

root=pathlib.Path(__file__).resolve().parents[1]
started=time.perf_counter()
L,H,rho,cp,k,nu=.04,.01,1.177,1006.,.0264,1.575e-5
alpha=k/(rho*cp); G=.02/(rho*L); end=.125; kx=2*np.pi/L
mp.mp.dps=50
# Periodic Gaussian centred at x/L=1/4. The y factor is sin²(pi*y/H).
first_amplitude=float(2*mp.quad(lambda z:mp.exp(-(z/mp.mpf('.08'))**2)*mp.cos(2*mp.pi*z),[-.5,-.16,0,.16,.5]))

def solve(modes,odd_terms):
    indices=np.arange(modes); i=indices[:,None]; j=indices[None,:]
    odd=np.arange(1,2*odd_terms,2,dtype=float)
    norm=np.sqrt(np.where(indices==0,1.,2.))
    def sine_integral(q):
        result=np.zeros_like(q); mask=q!=0
        result[mask]=(1-np.cos(np.pi*q[mask]))/q[mask]
        return result
    m=odd[:,None,None]
    coupling=(sine_integral(m+i-j)+sine_integral(m-i+j)+sine_integral(m+i+j)+sine_integral(m-i-j))/(4*np.pi)*norm[:,None]*norm[None,:]
    velocity_coefficients=4*G*H**2/(nu*np.pi**3*odd**3)
    decay=nu*(odd*np.pi/H)**2
    diffusion=-alpha*((indices*np.pi/H)**2+kx*kx)
    initial=np.zeros(modes,dtype=complex);initial[0]=-.5j*first_amplitude;initial[2]=1j*first_amplitude/(2*np.sqrt(2))
    def rhs(t,a):
        amplitudes=velocity_coefficients*(-np.expm1(-decay*t))
        velocity_matrix=np.einsum('k,kij->ij',amplitudes,coupling,optimize=False)
        return diffusion*a-1j*kx*(velocity_matrix@a)
    answer=solve_ivp(rhs,(0,end),initial,method='DOP853',rtol=1e-11,atol=1e-13,max_step=.001)
    assert answer.success
    coefficients=answer.y[:,-1]
    phase=float(-np.angle(coefficients[0])-np.pi/2)
    return coefficients,{'cosineModes':modes,'oddVelocityTerms':odd_terms,'phaseRad':phase,'equivalentDisplacementM':phase/kx,'firstHarmonicMeanRealK':float(coefficients[0].real),'firstHarmonicMeanImagK':float(coefficients[0].imag),'functionEvaluations':answer.nfev}

studies=[]
for modes,terms in [(16,128),(24,256),(32,256),(24,512),(32,512)]:
    coefficients,row=solve(modes,terms);studies.append(row)
assert abs(studies[-1]['phaseRad']-studies[-2]['phaseRad'])<1e-5
assert abs(studies[-1]['phaseRad']-studies[2]['phaseRad'])<1e-5
samples=[]
odd=np.arange(1,1024,2,dtype=float);lam=odd*np.pi/H;velocity_coefficients=4*G*H**2/(nu*np.pi**3*odd**3)
for ny in [12,24]:
    faces=np.arange(ny+1)/ny;a,b=faces[:-1],faces[1:];dy=H/ny
    velocity=G/(2*nu)*(H**2*(a+b)/2-H**2*(a*a+a*b+b*b)/3)
    velocity-=np.sum(velocity_coefficients[:,None]*np.exp(-nu*lam[:,None]**2*end)*(np.cos(odd[:,None]*np.pi*a)-np.cos(odd[:,None]*np.pi*b))/(lam[:,None]*dy),axis=0)
    basis=np.ones((len(coefficients),ny))
    for m in range(1,len(coefficients)):
        basis[m]=np.sqrt(2)*(np.sin(m*np.pi*b)-np.sin(m*np.pi*a))/(m*np.pi*(b-a))
    harmonic=coefficients@basis
    assert abs(np.mean(harmonic)-coefficients[0])<1e-14
    samples.append({'ny':ny,'velocityCellAverageMPerS':velocity.tolist(),'firstHarmonicRealK':harmonic.real.tolist(),'firstHarmonicImagK':harmonic.imag.tolist()})
print(json.dumps({'generatedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
 'generatorTreeDirty':bool(subprocess.check_output(['git','status','--porcelain','--','scripts/dynamic-channel-learning-reference.py'],cwd=root,text=True).strip()),
 'generatorSHA256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
 'environment':{'python':platform.python_version(),'scipy':scipy.__version__,'mpmath':mp.__version__},
 'method':'Independent continuous startup velocity sine series; exact analytic cosine/sine Galerkin couplings for the first x harmonic, DOP853. Repeat with increasing mode/velocity-series counts. This checks the first thermal harmonic, not all temperature modes.',
 'config':{'widthM':L,'heightM':H,'rho':rho,'cp':cp,'k':k,'nu':nu,'pressureDropPa':.02,'timeS':end},
 'initialFirstXHarmonicAmplitudeK':first_amplitude,'continuousVolumeMeanTemperatureK':300+float(mp.quad(lambda z:mp.exp(-(z/mp.mpf('.08'))**2),[-.5,-.16,0,.16,.5]))/2,
 'convergence':studies,'samples':samples,'elapsedSeconds':time.perf_counter()-started,'expertApproved':False,'passed':True},indent=2))
