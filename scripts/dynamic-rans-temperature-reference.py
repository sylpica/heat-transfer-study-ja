"""Own continuous passive mean-temperature reference, no DNS/third-party code.
Fourier in x, orthonormal cosine Galerkin in y, matrix exponential in time.
This neither reuses the JS FVM nor measures the physical thermal closure error.
"""
import datetime,hashlib,json,pathlib,platform,subprocess
import numpy as np
import scipy
from scipy.integrate import solve_ivp,quad
from scipy.linalg import expm
from scipy.special import roots_legendre
ROOT=pathlib.Path(__file__).resolve().parents[1]
CONFIG=dict(halfGap=.1,nu=1.575e-5,rho=1.177,cp=1006,k=.0264,width=1.,depth=.01,turbulentPrandtl=1.)
TARGET=.2

def operators(ret,modes,quadrature):
    p,w=roots_legendre(quadrature);z=(p+1)/2;w=w/2
    d=2*np.minimum(z,1-z);r=1-d
    q=.426*ret/3*d*(2-d)*(1+2*r*r)*(-np.expm1(-d*ret/25.4))
    total=.5*(1+np.sqrt(1+q*q));eddy=total-1
    def rhs(s,u):
        r=1-s;q=.426*ret/3*s*(2-s)*(1+2*r*r)*(-np.expm1(-s*ret/25.4))
        return [ret*(1-s)/(.5*(1+np.sqrt(1+q*q)))]
    solved=solve_ivp(rhs,[0,1],[0],method='DOP853',rtol=2.3e-14,atol=1e-14,dense_output=True,max_step=.002)
    assert solved.success
    U=ret*CONFIG['nu']/CONFIG['halfGap']*solved.sol(d)[0]
    alpha=CONFIG['k']/(CONFIG['rho']*CONFIG['cp'])+CONFIG['nu']*eddy/CONFIG['turbulentPrandtl']
    n=np.arange(modes);phi=np.sqrt(2)*np.cos(np.pi*z[:,None]*n);phi[:,0]=1
    grad=-np.sqrt(2)*np.sin(np.pi*z[:,None]*n)*(np.pi*n/(2*CONFIG['halfGap']))
    kx=2*np.pi/CONFIG['width']
    diffusion=-grad.T@(w[:,None]*alpha[:,None]*grad)-kx*kx*phi.T@(w[:,None]*alpha[:,None]*phi)
    advection=-1j*kx*phi.T@(w[:,None]*U[:,None]*phi)
    a0=np.zeros(modes,dtype=complex);a0[0]=1;a0[2]=.25/np.sqrt(2)
    # Symmetric diffusion must dissipate; advection is skew-Hermitian.
    assert np.max(np.linalg.eigvalsh(diffusion))<0
    return expm(TARGET*(diffusion+advection))@a0

def row_harmonic(coeff,ny):
    n=np.arange(len(coeff));a=np.arange(ny)/ny;b=a+1/ny
    B=np.ones((ny,len(coeff)))
    B[:,1:]=np.sqrt(2)*(np.sin(np.pi*b[:,None]*n[1:])-np.sin(np.pi*a[:,None]*n[1:]))/(np.pi*n[1:]/ny)
    harmonic=B@coeff
    return harmonic

def averages(coeff,nx,ny):
    xphase=np.exp(2j*np.pi*(np.arange(nx)+.5)/nx)*np.sinc(1/nx)
    return 300+(row_harmonic(coeff,ny)[:,None]*xphase[None,:]).real

out=dict(generatedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceCommit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),generatorSHA256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),environment=dict(python=platform.python_version(),numpy=np.__version__,scipy=scipy.__version__),method='Continuous Fourier/cosine Galerkin with variable-coefficient quadrature and matrix exponential; independent of JS finite volumes/Euler. Passive mean temperature, not thermal DNS approval.',config=CONFIG,targetTime=TARGET,releaseApproved=False,cases=[])
for case_id,ret in [('MKM180',178.12),('MKM395',392.24),('MKM590',587.19)]:
    a=operators(ret,768,3072);b=operators(ret,1024,4096);c=operators(ret,1024,5120)
    grids=[];modal_error=0;quadrature_error=0
    for nx,ny in [(32,16),(64,32),(128,64)]:
        ref=averages(c,nx,ny);modal_error=max(modal_error,float(np.max(np.abs(ref-averages(a,nx,ny)))));quadrature_error=max(quadrature_error,float(np.max(np.abs(ref-averages(b,nx,ny)))))
        grids.append(dict(nx=nx,ny=ny,rowHarmonic=[dict(real=float(v.real),imag=float(v.imag)) for v in row_harmonic(c,ny)]))
    assert modal_error<1e-7 and quadrature_error<1e-8,(case_id,modal_error,quadrature_error)
    out['cases'].append(dict(caseId=case_id,reTau=ret,modeRefinementMaxTemperatureDifferenceK=modal_error,quadratureRefinementMaxTemperatureDifferenceK=quadrature_error,grids=grids))
# Separate fixed-grid temporal reference: exact exponential of the Fourier
# symbol of the upwind/central conservative semi-discretization. This check
# isolates Euler time error; the Galerkin comparison above checks the PDE.
ret=392.24;nx,ny=32,16;H=2*CONFIG['halfGap'];dx=CONFIG['width']/nx;dy=H/ny

def eddy(d):
    q=.426*ret/3*d*(2-d)*(1+2*(1-d)**2)*(-np.expm1(-d*ret/25.4))
    return .5*(np.sqrt(1+q*q)-1)
sol=solve_ivp(lambda d,u:[ret*(1-d)/(1+eddy(d))],[0,1],[0],dense_output=True,method='DOP853',rtol=2.3e-14,atol=1e-14,max_step=.002)
assert sol.success
u_tau=ret*CONFIG['nu']/CONFIG['halfGap']
u=np.array([quad(lambda z:u_tau*sol.sol(2*min(z,1-z))[0],j/ny,(j+1)/ny,epsabs=1e-13)[0]*ny for j in range(ny)])
alpha=CONFIG['k']/(CONFIG['rho']*CONFIG['cp'])
ac=alpha+CONFIG['nu']*eddy(2*np.minimum((np.arange(ny)+.5)/ny,1-(np.arange(ny)+.5)/ny))/CONFIG['turbulentPrandtl']
af=alpha+CONFIG['nu']*eddy(2*np.minimum(np.arange(ny+1)/ny,1-np.arange(ny+1)/ny))/CONFIG['turbulentPrandtl']
theta=2*np.pi/nx
M=np.diag(-u*(1-np.exp(-1j*theta))/dx-4*ac*np.sin(theta/2)**2/dx**2)
for j in range(ny-1):
    a=af[j+1]/dy**2;M[j,j]-=a;M[j+1,j+1]-=a;M[j,j+1]+=a;M[j+1,j]+=a
initial=(1+.25*np.sinc(1/ny)*np.cos(2*np.pi*(np.arange(ny)+.5)/ny))*np.sinc(1/nx)
amp=expm(TARGET*M)@initial
out['temporalReference']=dict(caseId='MKM395',nx=nx,ny=ny,targetTime=TARGET,rowHarmonic=[dict(real=float(v.real),imag=float(v.imag)) for v in amp],includesXCellAverage=True,method='Exact matrix exponential of the fixed-grid first Fourier symbol; only for temporal verification, distinct from the continuous Galerkin PDE reference.')
print(json.dumps(out,indent=2))
