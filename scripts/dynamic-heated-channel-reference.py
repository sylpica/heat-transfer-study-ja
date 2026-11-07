"""Own references for a restricted heated plane-Poiseuille/Graetz transport.
Continuum quartic, independent sparse steady system, affine matrix exponential.
No third-party code/data and no production-JS operator are imported.
"""
import datetime,hashlib,json,pathlib,platform,subprocess
import numpy as np
import scipy
from scipy.integrate import quad
from scipy.sparse import lil_matrix,bmat,csc_matrix
from scipy.sparse.linalg import spsolve,expm_multiply
ROOT=pathlib.Path(__file__).resolve().parents[1]
CONFIG=dict(width=.2,height=.02,depth=.01,rho=1.,cp=1000.,k=.02,nu=1e-5,bulkVelocity=.2,wallHeatFlux=20.,initial=300.)
TIME=.2
L,H,Ub,q,k,rho,cp=[CONFIG[x] for x in ['width','height','bulkVelocity','wallHeatFlux','k','rho','cp']]
G=2*q/(rho*cp*Ub*H)
def shape(z):return 17/70-z+2*z**3-z**4
def speed(z):return 6*Ub*z*(1-z)
def quartic(x,z):return 300+G*x+q*H/k*shape(z)
def grid_reference(nx,ny):
    dx=L/nx;dy=H/ny;N=nx*ny;alpha=k/(rho*cp)
    u=np.array([quad(speed,j/ny,(j+1)/ny,epsabs=1e-13)[0]*ny for j in range(ny)])
    inlet=np.array([quad(lambda z:quartic(0,z),j/ny,(j+1)/ny,epsabs=1e-12)[0]*ny for j in range(ny)])
    A=lil_matrix((N,N));b=np.zeros(N)
    for j in range(ny):
        for i in range(nx):
            n=j*nx+i;A[n,n]-=u[j]/dx
            if i:A[n,n-1]+=u[j]/dx
            else:b[n]+=u[j]/dx*(inlet[j]-300)
            for jj in [j-1,j+1]:
                if 0<=jj<ny:A[n,n]-=alpha/dy**2;A[n,jj*nx+i]+=alpha/dy**2
            if j in [0,ny-1]:b[n]+=q/(rho*cp*dy)
    A=A.tocsc();steady=300+spsolve(A,-b)
    assert np.max(np.abs(A@(steady-300)+b))<1e-9
    augmented=bmat([[A,csc_matrix(b[:,None])],[csc_matrix((1,N)),csc_matrix((1,1))]],format='csc')
    seed=np.r_[np.zeros(N),1.]
    final=expm_multiply(TIME*augmented,seed)
    half=expm_multiply(.5*TIME*augmented,seed);twice=expm_multiply(.5*TIME*augmented,half)
    refinement=float(np.max(np.abs(final-twice)));assert refinement<1e-11
    continuum=np.array([quad(lambda z:quartic((i+.5)*dx,z),j/ny,(j+1)/ny,epsabs=1e-12)[0]*ny for j in range(ny) for i in range(nx)])
    err=steady-continuum
    bulk=np.array([np.sum(u*steady.reshape(ny,nx)[:,i])/np.sum(u) for i in range(nx)])
    wall=.5*(steady[:nx]+steady[-nx:])+q*dy/(2*k)
    nu=2*H*q/(k*(wall-bulk))
    return dict(nx=nx,ny=ny,inletCellMeansK=inlet.tolist(),steadyCellMeansK=steady.tolist(),transientCellMeansK=(300+final[:-1]).tolist(),semigroupMaxDifferenceK=refinement,continuumCellMeansK=continuum.tolist(),steadyVsContinuumRmsK=float(np.sqrt(np.mean(err**2))),steadyVsContinuumMaxK=float(np.max(np.abs(err))),outletWallToBulkNusselt=float(nu[-1]),outletNusseltError=float(nu[-1]-140/17))
wall_minus_bulk=quad(lambda z:speed(z)*(quartic(0,0)-quartic(0,z)),0,1,epsabs=1e-12)[0]/Ub
assert abs(2*H*q/(k*wall_minus_bulk)-140/17)<1e-11
assert abs(quad(lambda z:speed(z)*shape(z),0,1,epsabs=1e-13)[0])<1e-14
out=dict(generatedAtUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceCommit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),generatorSHA256=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),environment=dict(python=platform.python_version(),numpy=np.__version__,scipy=scipy.__version__),config=CONFIG,targetTime=TIME,method='Continuum quartic with weighted bulk integrals; separate sparse full-grid steady solve and augmented affine matrix exponential for each fixed grid, independently assembled in Python; not a reuse of JS upwind/Euler.',continuum=dict(bulkGradientKPerM=G,hydraulicDiameter=2*H,nusselt=140/17,wallMinusBulkK=wall_minus_bulk,shape='17/70-z+2z^3-z^4; z=y/H',bulkInletK=300.),references=[grid_reference(nx,ny) for nx,ny in [(16,8),(32,16),(64,32)]],caveat='First-cell upwind inlet face vs cell mean gives a half-dx first-order boundary shift even for the continuous linear-x quartic. Product of row mean U and row mean T differs from the continuous weighted bulk at O(dy^2). Fixed-grid exponential verifies temporal integration, not continuous transient spatial accuracy.',releaseApproved=False)
print(json.dumps(out,indent=2))
