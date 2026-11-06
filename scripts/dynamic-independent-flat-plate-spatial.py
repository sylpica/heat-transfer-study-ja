#!/usr/bin/env python3
"""Continuous thermal similarity and independent cell-average quadrature.

Compares a saved OWN FV field; does not use its discrete temperature equation as
the spatial reference. No third-party table or original figure is reproduced.
"""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS'):os.environ[key]='1'
from pathlib import Path
from datetime import datetime,timezone
import argparse,importlib.util,json,hashlib,re,platform
import numpy as np
import scipy
from scipy.integrate import solve_bvp
from numpy.polynomial.legendre import leggauss
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('separate_blasius_reference',ROOT/'scripts/dynamic-independent-blasius-flow.py');blasius=importlib.util.module_from_spec(spec);spec.loader.exec_module(blasius)

def thermal_reference(Pr,end):
    flow=blasius.reference(end)
    def ode(eta,state):
        theta,w,J=state
        return np.array([w,-Pr*flow.sol(eta)[0]*w/2,theta])
    def bc(a,b):return np.array([a[0]-1,b[0],a[2]])
    eta=np.linspace(0,end,1601);guess=np.array([np.exp(-eta),-np.exp(-eta),1-np.exp(-eta)])
    result=solve_bvp(ode,bc,eta,guess,tol=2e-11,max_nodes=50000)
    if not result.success:raise RuntimeError(result.message)
    return flow,result

def cell_averages(c,solution,order):
    nx,ny=c['nx'],c['ny'];L,H,U,nu=[c[k] for k in ('width','height','freeStreamVelocity','nu')];dx=L/nx;dy=H/ny;x=np.linspace(0,L,nx+1);y=np.linspace(0,H,ny+1);s=np.sqrt(x);z,w=leggauss(order);half=np.diff(s)/2;sample=((s[:-1]+s[1:])/2)[:,None]+half[:,None]*z[None,:]
    end=solution.x[-1];eta=y[:,None,None]*np.sqrt(U/nu)/sample[None,:,:];J=solution.sol(np.minimum(eta,end))[2]
    # J'=theta; integrating y first and x=s^2 gives a smooth integrable leading corner.
    integrals=2*np.sqrt(nu/U)*np.sum((J[1:]-J[:-1])*sample[None,:,:]**2*w[None,None,:],axis=-1)*half[None,:]
    return integrals/(dx*dy)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--tag',default='v1');args=parser.parse_args();assert re.fullmatch('[a-z0-9-]{1,32}',args.tag)
    raw=args.input.read_bytes();saved=json.loads(raw);assert saved['steady'] and saved['integrityPassed'],'Only completed steady own cases can be compared.'
    c=saved['config'];nx,ny=c['nx'],c['ny'];Pr=saved['Pr'];assert nx in (32,64,128,256) and ny==nx//2 and Pr in (.71,1)
    assert c['width']==1 and c['height']==.12 and c['inletTemperature']==300 and c['wallTemperature']==320
    output=ROOT/f'docs/dynamic/FLAT_PLATE_SPATIAL_PR{"071" if Pr==.71 else "100"}_N{nx}X{ny}_20261106_{args.tag}.json';assert not output.exists(),'Protect existing result.'
    flow16,short=thermal_reference(Pr,16);flow24,wide=thermal_reference(Pr,24);eta=np.linspace(0,16,641);reference_change=float(np.max(np.abs(short.sol(eta)-wide.sol(eta))));assert reference_change<1e-9
    identity=None
    if Pr==1:
        identity=float(np.max(np.abs(wide.sol(eta)[0]-(1-flow24.sol(eta)[1]))));assert identity<1e-9
    delta=c['wallTemperature']-c['inletTemperature'];mean32=delta*cell_averages(c,wide,32);mean64=delta*cell_averages(c,wide,64);refinement=float(np.sqrt(np.mean((mean32-mean64)**2)));assert refinement<1e-6
    actual=np.array(saved['finalState']['offsetTemperature']).reshape(ny,nx);error=actual-mean64;rms=float(np.sqrt(np.mean(error**2)));worst=np.unravel_index(np.argmax(np.abs(error)),error.shape)
    dx=c['width']/nx;x=np.linspace(0,c['width'],nx+1);gradient=-float(wide.sol(0)[1]);q=2*c['k']*delta*gradient*np.sqrt(c['freeStreamVelocity']/c['nu'])/(np.sqrt(x[1:])+np.sqrt(x[:-1]));ownq=np.array(saved['finalState']['wallHeatFluxWPerM2']);mask=(x[:-1]+x[1:])/2>=.1*c['width'];local=float(np.sqrt(np.sum((ownq[mask]-q[mask])**2)/np.sum(q[mask]**2)));nu=float(2*gradient*np.sqrt(c['freeStreamVelocity']*c['width']/c['nu']));nu_relative=float((saved['finalState']['meanPlateNusselt']-nu)/nu)
    checks={'cellMeanTemperatureRmsBelow015K':rms<.15,'meanPlateNuWithin2Percent':abs(nu_relative)<.02,'localIntervalHeatL2Within2PercentOutsideLeadingTenth':local<.02};applies=nx==256
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'ownCase':args.input.name,'ownCaseSHA256':hashlib.sha256(raw).hexdigest(),'ownCaseSourceCommit':saved['sourceCommit'],'ownCaseSourceFilesSHA256':saved['sourceFilesSHA256'],'referenceGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'criteriaDeclaredAtCommit':'90e3206','method':'Independent Blasius/thermal BVP16/24, theta primitive J and separate Gauss32/64 in x=s^2 for actual cell averages; exact interval-integrated similarity wall heat. Product FV/RK2 are not the spatial reference.','environment':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'BLASThreads':1},'config':c,'Pr':Pr,'reference':{'wallDimensionlessTemperatureGradient':gradient,'meanNuL':float(nu),'BVP16Vs24MaximumStateDifference':reference_change,'cellMeanQuadratureRefinementRmsK':refinement,'PrOneThetaEqualsOneMinusFprimeMaximumDifference':identity,'outerThetaAtDownstreamBoundary':float(wide.sol(c['height']*np.sqrt(c['freeStreamVelocity']/(c['nu']*c['width'])))[0])},'ownMeanNuL':saved['finalState']['meanPlateNusselt'],'meanNuRelativeDifference':float(nu_relative),'temperatureCellMeanRmsErrorK':rms,'maximumCellMeanErrorK':float(np.max(np.abs(error))),'worstCell':{'i':int(worst[1]),'j':int(worst[0]),'ownOffsetK':float(actual[worst]),'referenceOffsetK':float(mean64[worst])},'localWallHeatRelativeL2OutsideLeadingTenth':local,'finestObjectiveApplies':applies,'checks':checks,'allFinestObjectivesPassed':applies and all(checks.values()),'generalFullNavierStokesAccuracyVerified':False,'releaseApproved':False}
    encoded=json.dumps(result,indent=2)+'\n'
    with output.open('x') as stream:stream.write(encoded)
    print(json.dumps({'output':str(output),'nx':nx,'Pr':Pr,'rmsK':rms,'meanNu':saved['finalState']['meanPlateNusselt'],'referenceNu':float(nu),'meanNuRelativeDifference':float(nu_relative),'localHeatRelativeL2':local,'quadratureRefinementRmsK':refinement,'checks':checks,'finestObjectiveApplies':applies}),flush=True)
    if applies and not result['allFinestObjectivesPassed']:raise RuntimeError('Saved failed finest spatial comparison; do not approve')

if __name__=='__main__':main()
