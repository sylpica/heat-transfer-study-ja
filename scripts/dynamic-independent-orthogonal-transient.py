#!/usr/bin/env python3
"""Physical-coordinate gradient P1 assembly, affine exponential, full-field
Duffy/Gauss evaluation. No product operator, RHS, integrator or quadrature used.
"""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS'):os.environ[key]='1'
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,math,subprocess
import numpy as np
from scipy.linalg import expm
ROOT=Path(__file__).resolve().parents[1]

def assemble(c,m):
    p=np.array([n['point'] for n in m['nodes']]);N=len(p);K=np.zeros((N,N));volume=np.zeros(N);boundary=[]
    for index,v in enumerate(p):
        on=False
        for a,b in zip(c['outline'],c['outline'][1:]+c['outline'][:1]):
            if a[0]==b[0] and v[0]==a[0] and min(a[1],b[1])<=v[1]<=max(a[1],b[1]):on=True
            if a[1]==b[1] and v[1]==a[1] and min(a[0],b[0])<=v[0]<=max(a[0],b[0]):on=True
        assert on==m['nodes'][index]['boundary']
        if on:boundary.append(index)
    for element in m['elements']:
        ids=element['nodes'];vertices=p[ids];B=np.column_stack([np.ones(3),vertices]);det=float(np.linalg.det(B));assert det>0;area=det/2;gradient=np.linalg.inv(B)[1:,:];local=c['k']*c['depth']*area*(gradient.T@gradient)
        K[np.ix_(ids,ids)]+=local;volume[ids]+=area*c['depth']/3
    C=c['rho']*c['cp']*volume;source=c['source']*volume;u=[i for i in range(N) if i not in boundary];b=boundary;assert np.all(C>0)
    return p,K,C,source,u,b

def continuous_rms(c,m,theta,count):
    # Duffy map from [0,1]^2 onto each actual physical triangle. Integrate the
    # continuous P1 interpolation rather than treating nodal RMS as field RMS.
    gx,gw=np.polynomial.legendre.leggauss(count);gx=(gx+1)/2;gw=gw/2;u,v=np.meshgrid(gx,gx,indexing='ij');weight=np.outer(gw,gw)*(1-u);l1=u;l2=(1-u)*v;l0=1-l1-l2;N=np.stack([l0,l1,l2],axis=-1);total=0;area_total=0;decay=math.exp(-8*math.pi**2*c['k']/(c['rho']*c['cp'])*250)
    for e in m['elements']:
        ids=e['nodes'];vertices=np.array([m['nodes'][i]['point'] for i in ids]);xy=N@vertices;numeric=N@theta[ids];exact=20*np.sin(2*math.pi*xy[:,:,0])*np.sin(2*math.pi*xy[:,:,1])*decay;twice=float(np.linalg.det(np.column_stack([vertices[1]-vertices[0],vertices[2]-vertices[0]])));total+=float(np.sum(weight*(numeric-exact)**2))*twice;area_total+=twice/2
    return math.sqrt(total/area_total)

def main():
    out=ROOT/'docs/dynamic/ORTHOGONAL_TRANSIENT_REFERENCE_20261107_v1.json';assert not out.exists(),'Protect saved result.'
    own=json.loads(subprocess.check_output(['node','scripts/dynamic-orthogonal-transient-cases.mjs'],cwd=ROOT,text=True));tc=own['time'];c=tc['config'];p,K,C,source,u,b=assemble(c,tc['mesh']);count=len(u);A=np.zeros((count+3,count+3));A[:count,:count]=-K[np.ix_(u,u)]/C[u,None];A[:count,-1]=source[u]/C[u];A[count,-1]=sum(source);A[count+1,:count]=-K[np.ix_(b,u)].sum(axis=0);A[count+1,-1]=sum(source[b]);initial=np.zeros(count+3);initial[:count]=np.array(c['initial'])[u]-c['wallTemperature'];initial[-1]=1;exact=expm(A*tc['timeS'])@initial;theta=np.zeros(len(p));theta[u]=exact[:count];heat=exact[count:count+2];storage=float(C@(theta-(np.array(c['initial'])-c['wallTemperature'])));assert abs(storage-heat[0]+heat[1])<1e-11
    time_reference_temperature=theta.copy()
    rows=[]
    for case in tc['cases']:
        s=case['snapshot'];delta=np.array(s['temperatureExcess'])-theta;hd=np.array([s['cumulativeSourceJ'],s['cumulativeBoundaryOutwardJ']])-heat;rows.append({'factor':case['factor'],'maximumDt':case['maximumDt'],'maximumTemperatureErrorK':float(max(abs(delta))),'maximumHeatIntegralDifferenceJ':float(max(abs(hd))),'ownEnergyErrorJ':s['energyError'],'ownEnergyRoundoffBudgetJ':s['energyRoundoffBudgetJ']})
    time_orders=[math.log2(a['maximumTemperatureErrorK']/b['maximumTemperatureErrorK']) for a,b in zip(rows,rows[1:])];spatial=[]
    for entry in own['spatial']:
        c=entry['config'];s=entry['snapshot'];theta=np.array(s['temperatureExcess']);r12=continuous_rms(c,entry['mesh'],theta,12);r24=continuous_rms(c,entry['mesh'],theta,24);decay=math.exp(-8*math.pi**2*c['k']/(c['rho']*c['cp'])*250);power=-8*c['k']*c['depth']*20*decay;energy=-c['rho']*c['cp']*c['depth']*20*decay/math.pi**2
        spatial.append({'subdivisions':c['subdivisions'],'nodes':len(theta),'elements':len(entry['mesh']['elements']),'config':c,'maximumDt':entry['maximumDt'],'fullFieldRmsK':r24,'quadrature12Vs24DifferenceK':abs(r12-r24),'continuousOutwardPowerW':power,'actualReactionOutwardPowerW':s['boundaryOutwardPowerW'],'reactionRelativeDifference':s['boundaryOutwardPowerW']/power-1,'oneSidedGradientOutwardPowerW':s['boundaryOneSidedFourierPowerW'],'oneSidedGradientRelativeDifference':s['boundaryOneSidedFourierPowerW']/power-1,'continuousEnergyJ':energy,'actualEnergyJ':s['energy'],'ownEnergyErrorJ':s['energyError'],'ownEnergyRoundoffBudgetJ':s['energyRoundoffBudgetJ'],'temperatureExcessK':theta.tolist()})
    space_orders=[math.log2(a['fullFieldRmsK']/b['fullFieldRmsK']) for a,b in zip(spatial,spatial[1:])]
    checks={'timeFinestMaxBelow001K':rows[-1]['maximumTemperatureErrorK']<.001,'timeFinestAllHeatBelow0001J':rows[-1]['maximumHeatIntegralDifferenceJ']<1e-4,'timeFinalOrder18To22':1.8<time_orders[-1]<2.2,'allOwnHeatBudgets':all(abs(r['ownEnergyErrorJ'])<=r['ownEnergyRoundoffBudgetJ'] for r in rows+spatial),'allSpatialQuadratureAgreement':all(r['quadrature12Vs24DifferenceK']<1e-9 for r in spatial),'finestFullFieldRmsBelow03K':spatial[-1]['fullFieldRmsK']<.3,'finalSpatialOrder16To24':1.6<space_orders[-1]<2.4,'finestReactionWithin5Percent':abs(spatial[-1]['reactionRelativeDifference'])<.05}
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'criteriaDeclaredAtCommit':'21a2187','sourceFilesSHA256':own['sourceFilesSHA256'],'independentGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'method':'Independent physical-coordinate P1 basis gradients, local element K and volume/3 capacities, geometric boundary reclassification, affine matrix exponential and both whole heat integrals. Separate Duffy/Gauss full P1 interpolation integral against continuous sine on L.','time':{'config':tc['config'],'timeS':tc['timeS'],'independentTemperatureExcessK':time_reference_temperature.tolist(),'independentCumulativeSourceAndBoundaryJ':heat.tolist(),'independentStorageChangeJ':storage},'timeRows':rows,'timeOrders':time_orders,'spatialRows':spatial,'spatialOrders':space_orders,'checks':checks,'allChecksPassed':all(checks.values()),'singularConcaveCornerFieldVerified':False,'WorkerVerified':False,'GUIVerified':False,'generalFreeShapeApproved':False,'releaseApproved':False}
    payload=json.dumps(result,indent=2)+'\n'
    with out.open('x') as f:f.write(payload)
    print(json.dumps({'output':str(out),'timeRows':rows,'timeOrders':time_orders,'spatialRows':[{k:v for k,v in r.items() if k not in ('config','temperatureExcessK')} for r in spatial],'spatialOrders':space_orders,'checks':checks}),flush=True)
    if not result['allChecksPassed']:raise RuntimeError('Saved failed orthogonal transient comparison; no approval.')
if __name__=='__main__':main()
