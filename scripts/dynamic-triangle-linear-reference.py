#!/usr/bin/env python3
"""Independent continuum modes and physical-coordinate mixed-boundary K/C.
This script builds all targets before evaluating the production integrator."""
import os
for name in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']:os.environ[name]='1'
from pathlib import Path
from datetime import datetime,timezone
import math,json,hashlib,subprocess,tempfile,platform
import numpy as np
import scipy
from scipy.linalg import eigh
from scipy.optimize import brentq
from numpy.polynomial.legendre import leggauss
ROOT=Path(__file__).resolve().parents[1]
K,D,RHO,CP,TIME=15.,.03,1000.,1000.,2000.
MU=brentq(lambda x:x*math.tan(x)-1,1e-12,math.pi/2-1e-12,xtol=5e-15)
CRITERIA={'finestFullFieldRmsK':.25,'finestBoundaryRelativeError':.02,'lastSpaceOrderMinimum':1.5,'finestFixedGridMaximumTimeErrorK':.001,'lastTimeOrderRange':[1.8,2.2]}
GEOMETRY="import {createConvexTriangleMesh} from './dynamic/dev/convex-triangle-mesh.mjs';console.log(JSON.stringify([2,4,8,16].map(subdivisions=>createConvexTriangleMesh({outline:[[0,0],[1,0],[1,1],[0,1]],subdivisions}))));"
ACTUAL=r"""
import {readFileSync} from 'node:fs';import {createTriangleLinearTransient} from './dynamic/dev/triangle-linear-transient.mjs';const r=JSON.parse(readFileSync(process.argv[1])),samples=[];for(const config of r.configs){const m=createTriangleLinearTransient(config);while(m.time<r.time)m.step(Math.min(m.safeDt,r.time-m.time),false);samples.push(m.snapshot());}const fixed=[];for(const dt of [100,50,25]){const m=createTriangleLinearTransient(r.fixedConfig);if(dt>m.safeDt)throw Error('Time reference exceeds admissible positive update');for(let j=0;j<r.time/dt;j++)m.step(dt,false);fixed.push({dt,...m.snapshot()});}console.log(JSON.stringify({samples,fixed}));
"""
def node(code,*args):return json.loads(subprocess.run(['node','--input-type=module','-e',code,*args],cwd=ROOT,capture_output=True,text=True,check=True).stdout)
def mode(kind,y):return np.sin(math.pi*y/2) if kind=='dirichlet-neumann' else np.cos(MU*y)
def make_config(kind,m):
 p=np.array([n['point'] for n in m['nodes']]);initial=300+50*mode(kind,p[:,1]);b=[{'type':'adiabatic'} for _ in range(4)]
 if kind=='dirichlet-neumann':b[0]={'type':'temperature','temperatureK':300};initial[p[:,1]==0]=300
 else:b[2]={'type':'convection','h':15,'ambientK':300}
 return {'outline':m['outline'],'subdivisions':m['subdivisions'],'k':K,'depth':D,'rho':RHO,'cp':CP,'boundaries':b,'initial':initial.tolist(),'referenceTemperatureK':300,'source':0}
def assemble(m,config):
 p=np.array([n['point'] for n in m['nodes']]);N=len(p);matrix=np.zeros((N,N));capacity=np.zeros(N);rhs=np.zeros(N);fixed=np.zeros(N,dtype=bool);areas=[]
 for t in m['elements']:
  ids=t['nodes'];v=p[ids];twice=np.linalg.det(np.array([v[1]-v[0],v[2]-v[0]]));area=twice/2;assert area>0;areas.append(area);basis=np.array([[v[(i+1)%3,1]-v[(i+2)%3,1],v[(i+2)%3,0]-v[(i+1)%3,0]] for i in range(3)])/twice;local=K*D*area*basis@basis.T
  for i,a in enumerate(ids):
   capacity[a]+=RHO*CP*D*area/3
   for j,b in enumerate(ids):matrix[a,b]+=local[i,j]
 for edge in m['edges']:
  if not edge['boundary']:continue
  ids=edge['nodes'];a,b=p[ids];length=np.linalg.norm(b-a)
  # Independent physical-coordinate face identification, not outlineEdge metadata.
  if a[1]==0 and b[1]==0:face=0
  elif a[0]==1 and b[0]==1:face=1
  elif a[1]==1 and b[1]==1:face=2
  elif a[0]==0 and b[0]==0:face=3
  else:raise AssertionError('Not an exact unit-square boundary')
  bc=config['boundaries'][face]
  if bc['type']=='temperature':fixed[ids]=True;assert bc['temperatureK']==300
  if bc['type']=='convection':
   for i in ids:matrix[i,i]+=bc['h']*D*length/2;rhs[i]+=bc['h']*D*length/2*(bc['ambientK']-300)
  if bc['type']=='flux':
   for i in ids:rhs[i]-=bc['outwardFluxWPerM2']*D*length/2
 return p,matrix,capacity,rhs,fixed,np.array(areas)
def exponential(matrix,capacity,rhs,fixed,theta):
 ids=np.flatnonzero(~fixed);root=np.sqrt(capacity[ids]);A=matrix[np.ix_(ids,ids)];steady=np.linalg.solve(A,rhs[ids]);symmetric=A/root[:,None]/root[None,:];values,vectors=eigh(symmetric);assert values[0]>0
 result=np.zeros(len(theta));result[ids]=steady+(vectors@(np.exp(-values*TIME)*(vectors.T@(root*(theta[ids]-steady)))))/root;return result,steady

def field_error(kind,p,m,areas,theta,order):
 q,w=leggauss(order);q=(q+1)/2;w=w/2;r=q[:,None];s=q[None,:];bary=np.stack(np.broadcast_arrays(1-r,r*(1-s),r*s),axis=-1);weights=w[:,None]*w[None,:]*r;mu=math.pi/2 if kind=='dirichlet-neumann' else MU;decay=math.exp(-K/(RHO*CP)*mu**2*TIME);error=0.
 for j,t in enumerate(m['elements']):
  ids=t['nodes'];physical=np.einsum('ijk,kl->ijl',bary,p[ids]);exact=50*decay*mode(kind,physical[...,1]);interpolated=np.einsum('ijk,k->ij',bary,theta[ids]);error+=2*areas[j]*np.sum(weights*(interpolated-exact)**2)
 return math.sqrt(error)
def main():
 meshes=node(GEOMETRY);targets=[];private=[]
 for kind in ['dirichlet-neumann','robin-neumann']:
  for m in meshes:
   c=make_config(kind,m);p,matrix,capacity,rhs,fixed,areas=assemble(m,c);theta=np.array(c['initial'])-300;ode,_=exponential(matrix,capacity,rhs,fixed,theta);mu=math.pi/2 if kind=='dirichlet-neumann' else MU;decay=math.exp(-K/(RHO*CP)*mu**2*TIME);mean=2/math.pi if kind=='dirichlet-neumann' else math.sin(MU)/MU;heat=RHO*CP*D*50*mean*decay;power=K/(RHO*CP)*mu**2*heat
   targets.append({'kind':kind,'config':c,'nodeCount':len(p),'triangleCount':len(m['elements']),'independentSemidiscreteTemperatureExcessK':ode.tolist(),'continuousHeatJ':heat,'continuousBoundaryPowerW':power,'decayRatePerS':K/(RHO*CP)*mu**2});private.append((p,m,areas,matrix,capacity,rhs,fixed))
 fixed_config=make_config('robin-neumann',meshes[1]);fixed_config['boundaries'][0]={'type':'flux','outwardFluxWPerM2':-20};fixed_config['boundaries'][2]['h']=4;fixed_config['initial']=[300.]*len(meshes[1]['nodes']);p,matrix,capacity,rhs,fixed,_=assemble(meshes[1],fixed_config);oracle,steady=exponential(matrix,capacity,rhs,fixed,np.zeros(len(p)));steady_exact=20/4+20/K*(1-p[:,1]);steady_error=float(np.max(np.abs(steady-steady_exact)));assert steady_error<1e-11
 with tempfile.TemporaryDirectory(prefix='p1-linear-reference-') as temporary:
  path=Path(temporary)/'cases.json';path.write_text(json.dumps({'configs':[r['config'] for r in targets],'fixedConfig':fixed_config,'time':TIME}));actual=node(ACTUAL,str(path))
 for row,s,(p,m,areas,matrix,capacity,rhs,fixed) in zip(targets,actual['samples'],private):
  theta=np.array(s['temperatureExcess']);e8=field_error(row['kind'],p,m,areas,theta,8);e12=field_error(row['kind'],p,m,areas,theta,12);assert abs(e8-e12)<1e-11;rate=(rhs-matrix@theta)/capacity;rate[fixed]=0;rate_error=float(np.max(np.abs(rate-np.array(s['nodalTemperatureRateKPerS']))));assert rate_error<1e-12
  row['production']={'timeS':s['time'],'steps':s['steps'],'safeDt':s['safeDt'],'fullInterpolatedFieldRmsK':e12,'quadratureRefinementDifferenceK':e8-e12,'maximumNodalErrorK':float(np.max(np.abs(theta-50*math.exp(-row['decayRatePerS']*TIME)*mode(row['kind'],p[:,1])))),'heatRelativeError':s['energy']/row['continuousHeatJ']-1,'boundaryRelativeError':s['boundaryOutwardPowerW']/row['continuousBoundaryPowerW']-1,'energyErrorJ':s['energyError'],'roundoffBudgetJ':s['energyRoundoffBudgetJ'],'independentNodalRateMaximumDifferenceKPerS':rate_error,'fixedGridMaximumTimeErrorK':float(np.max(np.abs(theta-np.array(row['independentSemidiscreteTemperatureExcessK']))))}
 orders={kind:[math.log2([r for r in targets if r['kind']==kind][i]['production']['fullInterpolatedFieldRmsK']/[r for r in targets if r['kind']==kind][i+1]['production']['fullInterpolatedFieldRmsK']) for i in range(3)] for kind in ['dirichlet-neumann','robin-neumann']};fixed_runs=[{'dt':s['dt'],'maximumTimeErrorK':float(np.max(np.abs(np.array(s['temperatureExcess'])-oracle))),'energyErrorJ':s['energyError'],'temperatureExcessK':s['temperatureExcess']} for s in actual['fixed']];time_orders=[math.log2(fixed_runs[i]['maximumTimeErrorK']/fixed_runs[i+1]['maximumTimeErrorK']) for i in range(2)]
 finest=[r for r in targets if r['config']['subdivisions']==16];checks={'finestFullFields':all(r['production']['fullInterpolatedFieldRmsK']<.25 for r in finest),'finestBoundaryHeat':all(abs(r['production']['boundaryRelativeError'])<.02 for r in finest),'lastSpatialOrders':all(v[-1]>1.5 for v in orders.values()),'finestTimeError':fixed_runs[-1]['maximumTimeErrorK']<.001,'lastTimeOrder':1.8<time_orders[-1]<2.2}
 result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'recordedClientDate':'2026-11-06 Asia/Tokyo','sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceTreeDirty':True,'generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sourceFilesSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['dynamic/dev/triangle-linear-transient.mjs','dynamic/dev/triangle-boundaries.mjs']},'environment':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'BLASThreads':1},'criteriaDeclaredAtCommit':'87a88ae','criteria':CRITERIA,'robinEigenvalueMu':MU,'robinEigenvalueResidual':MU*math.tan(MU)-1,'timeS':TIME,'cases':targets,'spatialOrders':orders,'fixedTime':{'config':fixed_config,'independentExcessK':oracle.tolist(),'steadyLinearMaximumErrorK':steady_error,'runs':fixed_runs,'orders':time_orders},'checks':checks,'releaseApproved':False,'scope':'Unit-square positive-graph homogeneous Dirichlet/Neumann and row-lumped Robin continuum cases; independent physical-coordinate FEM and inhomogeneous boundary time exponential. Not general geometry, boundary, device or physical model approval.'}
 (ROOT/'docs/dynamic/TRIANGLE_LINEAR_REFERENCE_20261106.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n');print(json.dumps({'cases':[{'kind':r['kind'],'n':r['config']['subdivisions'],**r['production']} for r in targets],'spaceOrders':orders,'fixedTime':[{'dt':r['dt'],'errorK':r['maximumTimeErrorK']} for r in fixed_runs],'timeOrders':time_orders,'checks':checks},indent=2))
 if not all(checks.values()):raise SystemExit('Preserved independent mixed-boundary results and failed criteria; do not weaken budgets.')
if __name__=='__main__':main()
