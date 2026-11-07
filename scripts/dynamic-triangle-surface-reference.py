#!/usr/bin/env python3
"""Independent physical P1 nonlinear boundary ODE and continuous steady patch."""
import os
for name in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']:os.environ[name]='1'
from pathlib import Path
from datetime import datetime,timezone
import json,math,hashlib,subprocess,tempfile
import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq
ROOT=Path(__file__).resolve().parents[1]
SIGMA=5.670374419e-8
GEOMETRY="""
import {createBoundaryRefinedTriangleMesh} from './dynamic/dev/boundary-refined-triangle-mesh.mjs';const rotated=(W,H)=>{const c=Math.cos(.37),s=Math.sin(.37);return [[-W/2,-H/2],[W/2,-H/2],[W/2,H/2],[-W/2,H/2]].map(([x,y])=>[.53+c*x-s*y,.47+s*x+c*y]);};console.log(JSON.stringify({rectangle:createBoundaryRefinedTriangleMesh({outline:rotated(.4,.2),subdivisions:4}),pentagon:createBoundaryRefinedTriangleMesh({outline:Array.from({length:5},(_,i)=>[.4+.25*Math.cos(i*2*Math.PI/5),.4+.2*Math.sin(i*2*Math.PI/5)]),subdivisions:4}),steady:[2,4,8].map(subdivisions=>createBoundaryRefinedTriangleMesh({outline:rotated(.2,.1),subdivisions}))}));
"""
ACTUAL="""
import {readFileSync} from 'node:fs';import {createTriangleSurfaceTransient} from './dynamic/dev/triangle-surface-transient.mjs';console.log(JSON.stringify(JSON.parse(readFileSync(process.argv[1])).map(row=>{const m=createTriangleSurfaceTransient(row.config);if(row.dt>m.safeDt)throw Error('preregistered step exceeds nonlinear bound');while(m.time<row.timeS)m.step(Math.min(row.dt??m.safeDt,row.timeS-m.time),false);return m.snapshot();})));
"""
def node(code,*args):return json.loads(subprocess.check_output(['node','--input-type=module','-e',code,*args],cwd=ROOT,text=True))
def assemble(mesh,c):
 p=np.array([n['point'] for n in mesh['nodes']]);N=len(p);K=np.zeros((N,N));C=np.zeros(N);src=np.zeros(N);robin=np.zeros(N);ambient=np.zeros(N);flux=np.zeros(N);fixed=np.zeros(N,dtype=bool);fx=np.zeros(N);rad=[[] for _ in p];corners=np.array(c['outline'])
 for e in mesh['elements']:
  ids=e['nodes'];a=p[ids];twice=np.linalg.det(np.array([a[1]-a[0],a[2]-a[0]]));assert twice>0;area=twice/2;grad=np.array([[a[(i+1)%3,1]-a[(i+2)%3,1],a[(i+2)%3,0]-a[(i+1)%3,0]] for i in range(3)])/twice;matrix=c['k']*c['depth']*area*grad@grad.T
  for i,u in enumerate(ids):
   C[u]+=c['rho']*c['cp']*c['depth']*area/3;src[u]+=c.get('source',0)*c['depth']*area/3
   for j,v in enumerate(ids):K[u,v]+=matrix[i,j]
 for e in mesh['edges']:
  if not e['boundary']:continue
  ids=e['nodes'];a,b=p[ids];length=np.linalg.norm(b-a);mid=(a+b)/2;dist=[]
  for i,x in enumerate(corners):
   v=corners[(i+1)%len(corners)]-x;t=np.dot(mid-x,v)/np.dot(v,v);dist.append(abs(v[0]*(mid[1]-x[1])-v[1]*(mid[0]-x[0]))/np.linalg.norm(v) if -1e-12<=t<=1+1e-12 else math.inf)
  face=int(np.argmin(dist));assert dist[face]<1e-12;bc=c['boundaries'][face]
  for i in ids:
   if bc['type']=='temperature':
    if fixed[i]:assert fx[i]==bc['temperatureK']-300
    fixed[i]=True;fx[i]=bc['temperatureK']-300
   if bc['type']=='flux':flux[i]+=bc['outwardFluxWPerM2']*c['depth']*length/2
   if bc['type'] in ['convection','surface-exchange']:robin[i]+=bc['h']*c['depth']*length/2;ambient[i]+=bc['h']*c['depth']*length/2*(bc['ambientK']-300)
   if bc['type']=='surface-exchange':rad[i].append((bc['emissivity']*SIGMA*c['depth']*length/2,bc['radiationTemperatureK']))
 return p,K,C,src,robin,ambient,flux,fixed,fx,rad
def parts(assembled,theta):
 p,K,C,src,robin,ambient,flux,fixed,fx,rad=assembled;conv=robin*theta-ambient;radiation=np.array([sum(r*((300+theta[i])**4-tr**4) for r,tr in terms) for i,terms in enumerate(rad)]);net=src-K@theta-conv-flux-radiation;rates=net/C;rates[fixed]=0;reaction=net.copy();reaction[~fixed]=0;return rates,{'convection':float(np.sum(conv)),'radiation':float(np.sum(radiation)),'prescribed':float(np.sum(flux)),'dirichlet':float(np.sum(reaction))},radiation
def main():
 g=node(GEOMETRY);inputs=[];oracles=[]
 for shape in ['rectangle','pentagon']:
  m=g[shape];boundaries=([{'type':'temperature','temperatureK':400},{'type':'flux','outwardFluxWPerM2':-20},{'type':'surface-exchange','h':10,'ambientK':400,'emissivity':.8,'radiationTemperatureK':280},{'type':'adiabatic'}] if shape=='rectangle' else [{'type':'surface-exchange','h':0,'ambientK':300,'emissivity':.8,'radiationTemperatureK':280},{'type':'surface-exchange','h':20,'ambientK':400,'emissivity':.3,'radiationTemperatureK':300},{'type':'adiabatic'},{'type':'flux','outwardFluxWPerM2':-30},{'type':'temperature','temperatureK':330}]);c={'outline':m['outline'],'subdivisions':4,'boundaryRefinement':True,'k':15,'rho':1000,'cp':1000,'depth':.03,'source':100 if shape=='rectangle' else -50,'initial':350,'referenceTemperatureK':300,'maxTemperature':600,'boundaries':boundaries};a=assemble(m,c);fixed=a[7];initial=np.full(len(a[0]),50.);initial[fixed]=a[8][fixed];free=np.flatnonzero(~fixed)
  def rhs(t,z):
   theta=initial.copy();theta[free]=z;return parts(a,theta)[0][free]
  coarse=solve_ivp(rhs,(0,40),initial[free],method='DOP853',rtol=2e-12,atol=2e-12,max_step=.5);fine=solve_ivp(rhs,(0,40),initial[free],method='DOP853',rtol=2.5e-13,atol=2e-13,max_step=.25);assert coarse.success and fine.success;reference=initial.copy();reference[free]=fine.y[:,-1];ode_difference=float(np.max(np.abs(fine.y[:,-1]-coarse.y[:,-1])));assert ode_difference<1e-9
  for dt in [.125,.0625,.03125]:inputs.append({'kind':shape,'config':c,'timeS':40,'dt':dt,'independentExcessK':reference.tolist(),'independentODERefinementMaximumDifferenceK':ode_difference});oracles.append(a)
 ts=brentq(lambda t:5/.1*(600-t)-20*(t-300)-.8*SIGMA*(t**4-350**4),350,600,xtol=1e-12);steady_power=5/.1*(600-ts)*.2*.03
 for m in g['steady']:
  p=np.array([n['point'] for n in m['nodes']]);y=-(p[:,0]-.53)*math.sin(.37)+(p[:,1]-.47)*math.cos(.37)+.05;c={'outline':m['outline'],'subdivisions':m['subdivisions'],'boundaryRefinement':True,'k':5,'rho':1000,'cp':1000,'depth':.03,'source':0,'referenceTemperatureK':300,'maxTemperature':700,'boundaries':[{'type':'temperature','temperatureK':600},{'type':'adiabatic'},{'type':'surface-exchange','h':20,'ambientK':300,'emissivity':.8,'radiationTemperatureK':350},{'type':'adiabatic'}]};a=assemble(m,c);initial=600-(600-ts)*y/.1;initial[a[7]]=600;c['initial']=initial.tolist();inputs.append({'kind':'continuous-steady-linear','config':c,'timeS':5,'dt':.125,'continuousTopTemperatureK':ts,'continuousTopOutwardPowerW':steady_power});oracles.append(a)
 with tempfile.TemporaryDirectory(prefix='p1-surface-reference-') as directory:
  path=Path(directory)/'cases.json';path.write_text(json.dumps(inputs));states=node(ACTUAL,str(path))
 rows=[]
 for row,s,a in zip(inputs,states,oracles):
  theta=np.array(s['temperatureExcess']);rates,components,radiation=parts(a,theta);p,K,C,src,robin,ambient,flux,fixed,fx,rad=a;rate_budget=float(128*np.finfo(float).eps*np.max((np.abs(src)+np.abs(K)@np.abs(theta)+np.abs(robin*theta)+np.abs(ambient)+np.abs(flux)+np.abs(radiation))/C));rate_difference=float(np.max(np.abs(rates-np.array(s['nodalTemperatureRateKPerS']))));assert rate_difference<=rate_budget
  fields={'maximumTemperatureDifferenceK':float(np.max(np.abs(theta-np.array(row['independentExcessK']))))} if 'independentExcessK' in row else {'maximumSteadyDriftK':float(np.max(np.abs(np.array(s['temperature'])-np.array(row['config']['initial'])))),'steadyTopPowerRelativeError':(s['convectionOutwardPowerW']+s['radiationOutwardPowerW'])/steady_power-1}
  rows.append({**row,**fields,'productionTemperatureExcessK':s['temperatureExcess'],'independentComponentsOutwardW':components,'productionComponentsOutwardW':{k:s[field] for k,field in [('convection','convectionOutwardPowerW'),('radiation','radiationOutwardPowerW'),('prescribed','prescribedOutwardPowerW'),('dirichlet','dirichletReactionOutwardPowerW')]},'independentRateMaximumDifferenceKPerS':rate_difference,'independentRateRoundoffBudgetKPerS':rate_budget,'energyErrorJ':s['energyError'],'energyRoundoffBudgetJ':s['energyRoundoffBudgetJ'],'safeDtS':s['safeDt'],'steps':s['steps']})
 orders={kind:[math.log2([r for r in rows if r['kind']==kind][i]['maximumTemperatureDifferenceK']/[r for r in rows if r['kind']==kind][i+1]['maximumTemperatureDifferenceK']) for i in range(2)] for kind in ['rectangle','pentagon']};checks={'finestNonlinearODE':all(r['maximumTemperatureDifferenceK']<.001 for r in rows if r['kind']!='continuous-steady-linear' and r['dt']==.03125),'lastTimeOrders':all(1.8<v[-1]<2.2 for v in orders.values()),'steadyDrift':all(r['maximumSteadyDriftK']<1e-9 for r in rows if r['kind']=='continuous-steady-linear'),'steadyTopPower':all(abs(r['steadyTopPowerRelativeError'])<1e-10 for r in rows if r['kind']=='continuous-steady-linear'),'separateHeat':all(abs(r['energyErrorJ'])<=r['energyRoundoffBudgetJ'] for r in rows)}
 result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceTreeDirty':True,'criteriaDeclaredAtCommit':'b108cb1','generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sourceFilesSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['dynamic/dev/triangle-surface-boundaries.mjs','dynamic/dev/triangle-surface-transient.mjs']},'method':'Independent physical-coordinate P1 K/C, physical boundary classification, nodal-lumped radiation evaluated by direct fourth powers, fixed-temperature elimination and DOP853 with separate tolerance/max-step refinement; continuous steady boundary solved by independent Brent. Production cotangents/topological face IDs/chord weights/SSPRK2 are not oracle inputs.','rows':rows,'timeOrders':orders,'checks':checks,'generalContinuousTransientAccuracyVerified':False,'releaseApproved':False}
 (ROOT/'docs/dynamic/TRIANGLE_SURFACE_REFERENCE_20261106.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n');print(json.dumps({'rows':[{k:r[k] for k in ['kind','dt','maximumTemperatureDifferenceK','maximumSteadyDriftK','steadyTopPowerRelativeError','safeDtS'] if k in r} for r in rows],'orders':orders,'checks':checks},indent=2));assert all(checks.values()),'Keep failed results; do not loosen criteria.'
if __name__=='__main__':main()
