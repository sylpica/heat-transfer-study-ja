#!/usr/bin/env python3
"""Continuous manufactured conjugate field and separately assembled steady FV.
Steady temperatures are solved in Python; product derivative checks establish
whether the actual product has the same fixed point (not a new time-to-steady run).
"""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS'):os.environ[key]='1'
from pathlib import Path
from datetime import datetime,timezone
import argparse,hashlib,importlib.util,json,math,subprocess
import numpy as np
from scipy.sparse.linalg import spsolve
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('separate_conjugate_operator',ROOT/'scripts/dynamic-independent-conjugate-time.py');operator=importlib.util.module_from_spec(spec);spec.loader.exec_module(operator)

def manufacture(n,R):
    nf=n//2;nw=n//8;L=5.;H=1.;w=.25;ks=2.;kf=1.;D=.1;rho=1.;cp=100.;Ub=1.;A=2.;p=math.pi/L;dx=L/n;df=H/nf;ds=w/nw;total=w/ks+H/kf+w/ks+2*R
    y=np.r_[np.linspace(-w+ds/2,-ds/2,nw),np.linspace(df/2,H-df/2,nf),np.linspace(H+ds/2,H+w-ds/2,nw)]
    def f(y):
        resistance=np.where(y<0,(y+w)/ks,np.where(y>H,w/ks+R+H/kf+R+(y-H)/ks,w/ks+R+y/kf))
        return 1-2*resistance/total
    cosmean=(np.sin(p*dx*np.arange(1,n+1))-np.sin(p*dx*np.arange(n)))/(p*dx);sinmean=(np.cos(p*dx*np.arange(n))-np.cos(p*dx*np.arange(1,n+1)))/(p*dx)
    exact=A*f(y)[:,None]*cosmean[None,:];source=np.zeros_like(exact);points,weights=np.polynomial.legendre.leggauss(4)
    for j,yc in enumerate(y):
        if nw<=j<nw+nf:
            ys=yc+df/2*points;u=6*Ub*(ys/H)*(1-ys/H);uf=float(np.sum(weights*u*f(ys))/2)
            source[j,:]=-rho*cp*A*p*sinmean*uf
        else:source[j,:]=ks*A*p*p*cosmean*f(yc)
    c={'width':L,'height':H,'depth':D,'nx':n,'ny':nf,'wallCells':nw,'wallThickness':w,'fluid':{'rho':rho,'cp':cp,'k':kf,'nu':.01},'solid':{'rho':2,'cp':100,'k':ks},'bulkVelocity':Ub,'contactResistance':R,'referenceTemperatureK':300,'inlet':(300+A*f(y[nw:nw+nf])).tolist(),'initial':300,'source':source.ravel().tolist(),'outerHeatFlux':{'lower':(2*A*cosmean/total).tolist(),'upper':(-2*A*cosmean/total).tolist()}}
    return c,exact.ravel(),(2*A*cosmean/total),np.repeat(np.r_[np.full(nw,ds),np.full(nf,df),np.full(nw,ds)],n)*dx*D

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--tag',default='v1');a=parser.parse_args();assert a.tag.isalnum();out=ROOT/f'docs/dynamic/CONJUGATE_SPATIAL_REFERENCE_20261107_{a.tag}.json';assert not out.exists(),'Protect saved result.'
    cases=[];references=[]
    for R in [0,.2]:
        for n in [8,16,32,64]:
            c,exact,q,vol=manufacture(n,R);M,cap,fluid=operator.assemble(c);N=len(cap);K=M[:N,:N];b=M[:N,-1].toarray().ravel();theta=spsolve(K,-b);rms=math.sqrt(float(np.sum(vol*(theta-exact)**2)/sum(vol)));res=float(np.max(abs(K@theta+b)));row={'id':f'R{R:g}-n{n}','config':c,'temperatureOffsetsK':theta.tolist(),'continuousCellMeanOffsetsK':exact.tolist(),'continuousIntoFluidLowerWPerM2':q.tolist(),'volumeWeightedRmsErrorK':rms,'fluidRmsErrorK':math.sqrt(float(np.mean((theta[fluid]-exact[fluid])**2))),'solidRmsErrorK':math.sqrt(float(np.mean((theta[~fluid]-exact[~fluid])**2))),'independentSteadyResidualKPerS':res};references.append(row);cases.append({k:row[k] for k in ['id','config','temperatureOffsetsK']});print(json.dumps({k:row[k] for k in ['id','volumeWeightedRmsErrorK','fluidRmsErrorK','solidRmsErrorK','independentSteadyResidualKPerS']}),flush=True)
    own=json.loads(subprocess.check_output(['node','scripts/dynamic-conjugate-fixed-point-check.mjs'],input=json.dumps(cases),cwd=ROOT,text=True));summary=[]
    for ref,result in zip(references,own['rows']):
        assert ref['id']==result['id'];q=np.array(ref['continuousIntoFluidLowerWPerM2']);ref['actualProductFixedPointCheck']=result
        norm=np.linalg.norm(q);ref['lowerInterfaceFluxRelativeL2']=float(np.linalg.norm(np.array(result['interfaceFlux']['lower'])-q)/norm);ref['upperInterfaceFluxRelativeL2']=float(np.linalg.norm(np.array(result['interfaceFlux']['upper'])+q)/norm)
        summary.append({k:ref[k] for k in ['id','volumeWeightedRmsErrorK','fluidRmsErrorK','solidRmsErrorK','independentSteadyResidualKPerS','lowerInterfaceFluxRelativeL2','upperInterfaceFluxRelativeL2']})
    families=[]
    for start in [0,4]:
        rows=summary[start:start+4];orders=[math.log2(x['volumeWeightedRmsErrorK']/y['volumeWeightedRmsErrorK']) for x,y in zip(rows,rows[1:])];families.append({'contactResistance':references[start]['config']['contactResistance'],'rows':rows,'rmsOrders':orders})
    checks={'finestRmsBelow015KBothContacts':all(f['rows'][-1]['volumeWeightedRmsErrorK']<.15 for f in families),'finalRmsOrderAbove07BothContacts':all(f['rmsOrders'][-1]>.7 for f in families),'allProductMaximumRatesBelow1e10':all(r['maximumTemperatureRateKPerS']<1e-10 for r in own['rows']),'allProductOneStepDriftsBelow1e10K':all(r['maximumTemperatureDriftK']<1e-10 for r in own['rows']),'allProductRegionalBudgets':all(all(abs(x)<=r['afterEnergyRoundoffBudgetJ'] for x in r['afterEnergyErrorJ'].values()) for r in own['rows'])}
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'criteriaDeclaredAtCommit':'c8d7b97','sourceFilesSHA256':own['sourceFilesSHA256'],'referenceGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'independentAssemblyGeneratorSHA256':hashlib.sha256((ROOT/'scripts/dynamic-independent-conjugate-time.py').read_bytes()).hexdigest(),'method':'Independent continuous resistance-coordinate manufactured field and volume-averaged source, sparse physical FV steady solve; actual product rate and one-step check at each separately solved steady state. This is not a product time-to-steady run.','continuousField':'T=300+2 cos(pi*x/L)*f(y); f linear in integrated 1/k resistance coordinate with 2R jumps normalized by total resistance. Solid source=-k*(Txx+Tyy), fluid source=rho*cp*u*Tx-k*Tyy. Source u*f cell integral by four-point Gauss; x sine/cosine means analytic.','families':families,'cases':references,'checks':checks,'allChecksPassed':all(checks.values()),'productTimeToSteadyVerified':False,'realWorkerVerified':False,'GUIVerified':False,'generalConjugateMomentumAccuracyVerified':False,'releaseApproved':False}
    with out.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({'output':str(out),'families':families,'checks':checks}),flush=True)
    if not result['allChecksPassed']:raise RuntimeError('Saved failed spatial comparison; do not approve')
if __name__=='__main__':main()
