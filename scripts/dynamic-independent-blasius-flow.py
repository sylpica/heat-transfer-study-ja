#!/usr/bin/env python3
"""Independent BVP/DOP853 reference and continuous face-velocity quadrature.

The product's RK4 shooting, Hermite interpolator and streamfunction differences
are not used to generate reference values. This verifies a boundary-layer
approximation, not general Navier--Stokes flow or temperature transport.
"""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS'): os.environ[key]='1'
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,subprocess,argparse,platform
import numpy as np
import scipy
from scipy.integrate import solve_bvp,solve_ivp
from scipy.optimize import brentq
from numpy.polynomial.legendre import leggauss

ROOT=Path(__file__).resolve().parents[1]

def ode(x,state):
    f,g,h=state
    return np.array([g,h,-f*h/2])

def boundary(left,right):
    return np.array([left[0],left[1],right[1]-1])

def reference(end):
    eta=np.linspace(0,end,1601)
    guess=np.array([eta-1+np.exp(-eta),1-np.exp(-eta),np.exp(-eta)])
    result=solve_bvp(ode,boundary,eta,guess,tol=2e-11,max_nodes=50000)
    if not result.success: raise RuntimeError(result.message)
    return result

def evaluate_far(bvp,eta):
    eta=np.asarray(eta);end=bvp.x[-1];delta=end-float(bvp.sol(end)[0]);state=bvp.sol(np.minimum(eta,end));far=eta>=end
    f=np.where(far,eta-delta,state[0]);g=np.where(far,1.,state[1]);entrainment=np.where(far,delta,eta*state[1]-state[0])
    return f,g,entrainment

def quadrature_flux(c,bvp,order):
    nx,ny=c['nx'],c['ny'];L,H,D,U,nu=[c[k] for k in ('width','height','depth','freeStreamVelocity','nu')]
    x=np.linspace(0,L,nx+1);y=np.linspace(0,H,ny+1);dx=L/nx;dy=H/ny;z,w=leggauss(order)
    ys=(y[:-1]+dy/2)[:,None,None]+(dy/2)*z[None,None,:]
    eta=ys*np.sqrt(U/(nu*x[1:]))[None,:,None]
    _,g,_=evaluate_far(bvp,eta)
    qx=np.empty((ny,nx+1));qx[:,0]=U*dy*D;qx[:,1:]=U*D*dy/2*np.sum(g*w,axis=-1)
    # x=s^2 removes the integrable leading-edge v ~ x^(-1/2) singularity.
    s=np.sqrt(x);half=np.diff(s)/2;sample=((s[:-1]+s[1:])/2)[None,:,None]+half[None,:,None]*z[None,None,:]
    eta=y[:,None,None]*np.sqrt(U/nu)/sample
    _,_,entrainment=evaluate_far(bvp,eta)
    qy=np.sqrt(nu*U)*D*half[None,:]*np.sum(entrainment*w,axis=-1)
    return qx,qy

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--tag',default='v1');args=parser.parse_args()
    import re
    assert re.fullmatch('[a-z0-9-]{1,32}',args.tag)
    output=ROOT/f'docs/dynamic/BLASIUS_FLOW_REFERENCE_20261106_{args.tag}.json'
    assert not output.exists(),'Protect existing reference; choose a new tag.'
    short,wide=reference(16),reference(24)
    probes=np.linspace(0,16,641)
    bvp_difference=float(np.max(np.abs(short.sol(probes)-wide.sol(probes))))
    curvature=float(wide.sol(0)[2]);assert abs(float(short.sol(0)[2])-curvature)<1e-12
    def integrate(curvature):
        result=solve_ivp(ode,(0,24),[0,0,curvature],method='DOP853',rtol=1e-12,atol=1e-14,dense_output=True)
        assert result.success
        return result
    root=brentq(lambda s:integrate(s).y[1,-1]-1,.3,.4,xtol=5e-15,rtol=1e-14)
    dop=integrate(root);cross=float(np.max(np.abs(dop.sol(probes)-wide.sol(probes))))
    assert cross<1e-10 and bvp_difference<1e-10
    # Synchronous Node subprocess: Python does not calculate concurrently.
    own=json.loads(subprocess.check_output(['node','scripts/dynamic-blasius-flow-cases.mjs'],cwd=ROOT,text=True))
    sample_errors=[]
    for sample in own['similaritySamples']:
        f,g,_=evaluate_far(wide,sample['eta']);sample_errors.append(max(abs(sample['f']-float(f)),abs(sample['fp']-float(g))))
    assert max(sample_errors)<1e-9
    rows=[]
    for case in own['cases']:
        flow=case['flow'];c=flow['config'];nx,ny=c['nx'],c['ny'];D=c['depth'];scale=flow['diagnostics']['positiveBoundaryFlowL1ScaleM3PerS']
        qx32,qy32=quadrature_flux(c,wide,32);qx64,qy64=quadrature_flux(c,wide,64)
        refinement=max(float(np.max(np.abs(qx32-qx64))),float(np.max(np.abs(qy32-qy64))))/scale
        x_error=float(np.max(np.abs(np.array(flow['xVolumeFluxM3PerS']).reshape(ny,nx+1)-qx64)))/scale
        y_error=float(np.max(np.abs(np.array(flow['yVolumeFluxM3PerS']).reshape(ny+1,nx)-qy64)))/scale
        shear_ref=float(4*curvature/np.sqrt(c['freeStreamVelocity']*c['width']/c['nu']))
        curvature_error=abs(flow['diagnostics']['wallCurvature']-curvature)
        checks={'referenceQuadrature32To64':refinement<1e-11,'allXFaceFluxes':x_error<1e-9,'allYFaceFluxes':y_error<1e-9,'wallCurvature':curvature_error<1e-11,'cellDivergence':flow['diagnostics']['normalizedDivergence']<1e-12,'wholeMass':flow['diagnostics']['boundaryRelativeResidual']<1e-12,'similarityMeanDrag':abs(flow['diagnostics']['meanFrictionCoefficient']-shear_ref)<1e-10}
        row={'name':case['name'],'config':c,'faceCounts':{'u':(nx+1)*ny,'v':nx*(ny+1)},'ownFieldSHA256':hashlib.sha256(json.dumps(flow,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'ownDiagnostics':flow['diagnostics'],'referenceQuadratureRefinementRelativeToBoundaryFlow':refinement,'maximumXFluxErrorRelativeToBoundaryFlow':x_error,'maximumYFluxErrorRelativeToBoundaryFlow':y_error,'wallCurvatureAbsoluteDifference':curvature_error,'meanDragDifference':flow['diagnostics']['meanFrictionCoefficient']-shear_ref,'checks':checks}
        rows.append(row);print(json.dumps({'name':row['name'],'xError':x_error,'yError':y_error,'refinement':refinement,'checks':checks}),flush=True)
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'sourceCommit':own['sourceCommit'],'generatorSHA256':own['generatorSHA256'],'referenceGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'environment':{'product':own['environment'],'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'BLASThreads':1},'criteriaDeclaredAtCommit':'5c4870a','quadratureDetailsDeclaredBeforeEvaluationAtCommit':'7d51571','method':'Independent SciPy collocation BVP on eta16/24, separate DOP853+Brent shooting; integrate continuous u along vertical faces and v dx in x=s^2 coordinates along horizontal faces with separate Gauss32/64. No product shooting/interpolation or streamfunction differences generate reference flux.','reference':{'wallCurvature':curvature,'BVP16WallCurvature':float(short.sol(0)[2]),'DOP853WallCurvature':root,'BVP16vs24MaximumStateDifferenceOn0To16':bvp_difference,'DOP853vsBVP24MaximumStateDifferenceOn0To16':cross,'maximumSimilaritySampleDifference':max(sample_errors),'BVP16Nodes':len(short.x),'BVP24Nodes':len(wide.x)},'rows':rows,'allChecksPassed':all(all(r['checks'].values()) for r in rows),'temperatureTransportVerified':False,'fullNavierStokesVerified':False,'GUIVerified':False,'releaseApproved':False}
    output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'output':str(output),'allChecksPassed':result['allChecksPassed'],'reference':result['reference']}),flush=True)
    if not result['allChecksPassed']:raise RuntimeError('Saved failed comparison; do not approve flow stage')

if __name__=='__main__':main()
