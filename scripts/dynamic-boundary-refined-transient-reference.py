#!/usr/bin/env python3
"""Rotated-rectangle continuum and independent physical P1 time exponentials."""
import os
for name in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']:os.environ[name]='1'
from pathlib import Path
from datetime import datetime,timezone
import json,math,hashlib,subprocess,tempfile
import numpy as np
from scipy.linalg import eigh
from scipy.optimize import brentq
from numpy.polynomial.legendre import leggauss
ROOT=Path(__file__).resolve().parents[1]
W,H,ANGLE,TIME,K,D,RHO,CP=.4,.2,.37,200.,15.,.03,1000.,1000.
MU=brentq(lambda x:x*math.tan(x)-15*H/K,1e-12,math.pi/2-1e-12,xtol=5e-15)
CRITERIA={'finestFieldRmsK':.25,'finestBoundaryRelativeError':.02,'lastSpatialOrderMinimum':1.5,'finestTimeMaximumErrorK':.001,'lastTimeOrderRange':[1.8,2.2]}
GEOMETRY="import {createBoundaryRefinedTriangleMesh} from './dynamic/dev/boundary-refined-triangle-mesh.mjs';const c=Math.cos(.37),s=Math.sin(.37),outline=[[-.2,-.1],[.2,-.1],[.2,.1],[-.2,.1]].map(([x,y])=>[.53+c*x-s*y,.47+s*x+c*y]);console.log(JSON.stringify([1,2,4,8].map(subdivisions=>createBoundaryRefinedTriangleMesh({outline,subdivisions}))));"
ACTUAL=r"""
import {readFileSync} from 'node:fs';import {createTriangleLinearTransient} from './dynamic/dev/triangle-linear-transient.mjs';const input=JSON.parse(readFileSync(process.argv[1])),rows=[];for(const c of input.configs){const m=createTriangleLinearTransient(c);while(m.time<input.time)m.step(Math.min(m.safeDt,input.time-m.time),false);rows.push(m.snapshot());}const fixed=[];for(const dt of [2.5,1.25,.625]){const m=createTriangleLinearTransient(input.fixedConfig);if(dt>m.safeDt)throw Error('time-reference step exceeds bound');for(let i=0;i<input.time/dt;i++)m.step(dt,false);fixed.push({dt,...m.snapshot()});}console.log(JSON.stringify({rows,fixed}));
"""
def node(code,*args):return json.loads(subprocess.run(['node','--input-type=module','-e',code,*args],cwd=ROOT,capture_output=True,text=True,check=True).stdout)
def local(p):
 x=p[...,0]-.53;y=p[...,1]-.47;c=math.cos(ANGLE);s=math.sin(ANGLE);return np.stack([c*x+s*y+W/2,-s*x+c*y+H/2],axis=-1)
def mode(kind,y):return np.sin(math.pi*y/(2*H)) if kind=='dirichlet-neumann' else np.cos(MU*y/H)
def assemble(m,c):
 p=np.array([n['point'] for n in m['nodes']]);N=len(p);A=np.zeros((N,N));C=np.zeros(N);b=np.zeros(N);fixed=np.zeros(N,dtype=bool);fixed_value=np.zeros(N);areas=[]
 for t in m['elements']:
  ids=t['nodes'];v=p[ids];twice=np.linalg.det(np.array([v[1]-v[0],v[2]-v[0]]));assert twice>0;area=twice/2;areas.append(area);basis=np.array([[v[(j+1)%3,1]-v[(j+2)%3,1],v[(j+2)%3,0]-v[(j+1)%3,0]] for j in range(3)])/twice;matrix=K*D*area*basis@basis.T
  for i,a in enumerate(ids):
   C[a]+=RHO*CP*D*area/3
   for j,d in enumerate(ids):A[a,d]+=matrix[i,j]
 for e in m['edges']:
  if not e['boundary']:continue
  ids=e['nodes'];a,d=p[ids];z=local((a+d)/2);distances=[abs(z[1]),abs(z[0]-W),abs(z[1]-H),abs(z[0])];face=int(np.argmin(distances));assert distances[face]<1e-12*max(W,H);bc=c['boundaries'][face];length=np.linalg.norm(d-a)
  if bc['type']=='temperature':fixed[ids]=True;fixed_value[ids]=bc['temperatureK']-300
  if bc['type']=='convection':
   for i in ids:A[i,i]+=bc['h']*D*length/2;b[i]+=bc['h']*D*length/2*(bc['ambientK']-300)
  if bc['type']=='flux':
   for i in ids:b[i]-=bc['outwardFluxWPerM2']*D*length/2
 return p,A,C,b,fixed,fixed_value,np.array(areas)
def exponential(A,C,b,fixed,fixed_value,initial):
 ids=np.flatnonzero(~fixed);root=np.sqrt(C[ids]);matrix=A[np.ix_(ids,ids)];rhs=b[ids]-A[np.ix_(ids,np.flatnonzero(fixed))]@fixed_value[fixed];steady=np.linalg.solve(matrix,rhs);scaled=matrix/root[:,None]/root[None,:];values,vectors=eigh((scaled+scaled.T)/2);assert values[0]>0;out=fixed_value.copy();out[ids]=steady+(vectors@(np.exp(-values*TIME)*(vectors.T@(root*(initial[ids]-steady)))))/root;full_steady=fixed_value.copy();full_steady[ids]=steady;return out,full_steady

def error_integral(kind,p,m,areas,theta,order):
 x,w=leggauss(order);x=(x+1)/2;w=w/2;r=x[:,None];s=x[None,:];bary=np.stack(np.broadcast_arrays(1-r,r*(1-s),r*s),axis=-1);weights=w[:,None]*w[None,:]*r;mu=math.pi/2 if kind=='dirichlet-neumann' else MU;decay=math.exp(-K/(RHO*CP)*(mu/H)**2*TIME);error=0.
 for i,t in enumerate(m['elements']):
  ids=t['nodes'];physical=np.einsum('ijk,kl->ijl',bary,p[ids]);target=50*decay*mode(kind,local(physical)[...,1]);value=np.einsum('ijk,k->ij',bary,theta[ids]);error+=2*areas[i]*np.sum(weights*(value-target)**2)
 return math.sqrt(error/(W*H))
def load_integrals(kind,p,m,areas,order):
 x,w=leggauss(order);x=(x+1)/2;w=w/2;r=x[:,None];s=x[None,:];bary=np.stack(np.broadcast_arrays(1-r,r*(1-s),r*s),axis=-1);weights=w[:,None]*w[None,:]*r;mu=math.pi/2 if kind=='dirichlet-neumann' else MU;decay=math.exp(-K/(RHO*CP)*(mu/H)**2*TIME);load=np.zeros(len(p))
 for i,t in enumerate(m['elements']):
  ids=t['nodes'];physical=np.einsum('ijk,kl->ijl',bary,p[ids]);target=50*decay*mode(kind,local(physical)[...,1]);values=2*areas[i]*np.sum(weights[...,None]*bary*target[...,None],axis=(0,1))
  for j,node_id in enumerate(ids):load[node_id]+=values[j]
 square=50**2*decay**2*W*H*(.5 if kind=='dirichlet-neumann' else .5+math.sin(2*MU)/(4*MU))
 return load,square
def main():
 meshes=node(GEOMETRY);targets=[];private=[]
 for kind in ['dirichlet-neumann','robin-neumann']:
  for m in meshes:
   p=np.array([n['point'] for n in m['nodes']]);y=local(p)[:,1];boundaries=[{'type':'adiabatic'} for _ in range(4)];initial=300+50*mode(kind,y)
   if kind=='dirichlet-neumann':boundaries[0]={'type':'temperature','temperatureK':300};initial[np.abs(y)<1e-12*H]=300
   else:boundaries[2]={'type':'convection','h':15,'ambientK':300}
   c={'outline':m['outline'],'subdivisions':m['subdivisions'],'boundaryRefinement':True,'k':K,'depth':D,'rho':RHO,'cp':CP,'boundaries':boundaries,'referenceTemperatureK':300,'initial':initial.tolist(),'source':0};p,A,C,b,fixed,fx,areas=assemble(m,c);ode,_=exponential(A,C,b,fixed,fx,initial-300);mu=math.pi/2 if kind=='dirichlet-neumann' else MU;rate=K/(RHO*CP)*(mu/H)**2;mean=2/math.pi if kind=='dirichlet-neumann' else math.sin(MU)/MU;heat=RHO*CP*D*W*H*50*mean*math.exp(-rate*TIME)
   targets.append({'kind':kind,'config':c,'nodeCount':len(p),'triangleCount':len(m['elements']),'boundarySegments':m['numerics']['boundaryRefinement']['boundarySegmentCountByOutlineEdge'],'continuousHeatJ':heat,'continuousBoundaryPowerW':rate*heat,'decayRatePerS':rate,'independentExcessK':ode.tolist()});private.append((p,m,areas,A,C,b,fixed))
 m=meshes[2];fixed_config={'outline':m['outline'],'subdivisions':4,'boundaryRefinement':True,'k':K,'depth':D,'rho':RHO,'cp':CP,'boundaries':[{'type':'temperature','temperatureK':310},{'type':'adiabatic'},{'type':'convection','h':15,'ambientK':300},{'type':'adiabatic'}],'referenceTemperatureK':300,'source':0};p,A,C,b,fixed,fx,areas=assemble(m,fixed_config);initial=np.full(len(p),300.);initial[fixed]=310;fixed_config['initial']=initial.tolist();oracle,steady=exponential(A,C,b,fixed,fx,initial-300);steady_exact=10*(1+15/K*(H-local(p)[:,1]))/(1+15*H/K);steady_error=float(np.max(np.abs(steady-steady_exact)));assert steady_error<1e-10
 with tempfile.TemporaryDirectory(prefix='boundary-refined-transient-') as temporary:
  f=Path(temporary)/'cases.json';f.write_text(json.dumps({'configs':[r['config'] for r in targets],'fixedConfig':fixed_config,'time':TIME}));actual=node(ACTUAL,str(f))
 for row,s,(p,m,areas,A,C,b,fixed) in zip(targets,actual['rows'],private):
  theta=np.array(s['temperatureExcess']);err8=error_integral(row['kind'],p,m,areas,theta,8);err12=error_integral(row['kind'],p,m,areas,theta,12);assert abs(err8-err12)<1e-11;rates=(b-A@theta)/C;rates[fixed]=0;difference=float(np.max(np.abs(rates-np.array(s['nodalTemperatureRateKPerS']))));rate_budget=float(128*np.finfo(float).eps*np.max((np.abs(b)+np.abs(A)@np.abs(theta))/C));assert difference<=rate_budget
  load8,square=load_integrals(row['kind'],p,m,areas,8);load12,_=load_integrals(row['kind'],p,m,areas,12);assert np.max(np.abs(load12-load8))<1e-12;row['continuousLoadIntegralKM2']=load12.tolist();row['continuousSquareIntegralK2M2']=square
  row['production']={'timeS':s['time'],'steps':s['steps'],'safeDt':s['safeDt'],'fullFieldRmsK':err12,'quadratureDifferenceK':err8-err12,'maximumNodalErrorK':float(np.max(np.abs(theta-50*math.exp(-row['decayRatePerS']*TIME)*mode(row['kind'],local(p)[:,1])))),'heatRelativeError':s['energy']/row['continuousHeatJ']-1,'boundaryRelativeError':s['boundaryOutwardPowerW']/row['continuousBoundaryPowerW']-1,'energyErrorJ':s['energyError'],'roundoffBudgetJ':s['energyRoundoffBudgetJ'],'independentRateMaximumDifferenceKPerS':difference,'rateComparisonRoundoffBudgetKPerS':rate_budget,'fixedGridMaximumTimeErrorK':float(np.max(np.abs(theta-np.array(row['independentExcessK']))))}
 orders={kind:[math.log2([r for r in targets if r['kind']==kind][i]['production']['fullFieldRmsK']/[r for r in targets if r['kind']==kind][i+1]['production']['fullFieldRmsK']) for i in range(3)] for kind in ['dirichlet-neumann','robin-neumann']};fixed_runs=[{'dt':s['dt'],'maximumTimeErrorK':float(np.max(np.abs(np.array(s['temperatureExcess'])-oracle))),'energyErrorJ':s['energyError'],'temperatureExcessK':s['temperatureExcess']} for s in actual['fixed']];time_orders=[math.log2(fixed_runs[i]['maximumTimeErrorK']/fixed_runs[i+1]['maximumTimeErrorK']) for i in range(2)];finest=[r for r in targets if r['config']['subdivisions']==8];checks={'finestFullField':all(r['production']['fullFieldRmsK']<.25 for r in finest),'finestBoundaryHeat':all(abs(r['production']['boundaryRelativeError'])<.02 for r in finest),'lastSpatialOrders':all(v[-1]>1.5 for v in orders.values()),'finestTimeMaximum':fixed_runs[-1]['maximumTimeErrorK']<.001,'lastTimeOrder':1.8<time_orders[-1]<2.2}
 result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceTreeDirty':True,'generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sourceFilesSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['dynamic/dev/triangle-linear-transient.mjs','dynamic/dev/triangle-boundaries.mjs','dynamic/dev/boundary-refined-triangle-mesh.mjs']},'criteriaDeclaredAtCommit':'76569d1','criteria':CRITERIA,'geometry':{'widthM':W,'heightM':H,'rotationRad':ANGLE,'centerM':[.53,.47]},'timeS':TIME,'robinMu':MU,'method':'Independent physical-coordinate P1 K/C with actual refined nodes; physical face classification and fixed-temperature elimination; weighted affine eigensystem exponential. Continuous normal-coordinate sin/cos full P1 field integrals with separate Gauss8/12 check. Production cotangents, topology face IDs and SSPRK2 do not generate target values.','cases':targets,'spatialOrders':orders,'fixedTime':{'config':fixed_config,'independentExcessK':oracle.tolist(),'linearSteadyMaximumErrorK':steady_error,'runs':fixed_runs,'orders':time_orders},'checks':checks,'releaseApproved':False,'scope':'Boundary-refined rotated rectangle with positive full graph, constant properties and fixed linear boundaries. Numerical cases, not general geometry/material/physical approval.'}
 (ROOT/'docs/dynamic/BOUNDARY_REFINED_TRANSIENT_REFERENCE_20261106.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n');print(json.dumps({'cases':[{'kind':r['kind'],'n':r['config']['subdivisions'],'nodes':r['nodeCount'],**r['production']} for r in targets],'spaceOrders':orders,'fixedTime':[{'dt':r['dt'],'errorK':r['maximumTimeErrorK']} for r in fixed_runs],'timeOrders':time_orders,'checks':checks},indent=2))
 if not all(checks.values()):raise SystemExit('Saved independent refined-boundary PDE results with failed criteria; do not weaken budgets.')
if __name__=='__main__':main()
