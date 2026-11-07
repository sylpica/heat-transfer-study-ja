#!/usr/bin/env python3
"""Independent continuous rectangle mode and physical-coordinate FEM time ODE.
Oracles are generated before running the production time integrator. BLAS is
single-threaded; no production cotangent, capacity or step code makes targets.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib,json,math,os,subprocess,tempfile
for key in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']:os.environ[key]='1'
import numpy as np
from numpy.polynomial.legendre import leggauss
from scipy.linalg import eigh
ROOT=Path(__file__).resolve().parents[1]
A,B,ANGLE,AMPLITUDE,END=.4,.2,.37,50.,20.
RHO,CP,K,DEPTH=1000.,1000.,15.,.03
LAMBDA=K/(RHO*CP)*math.pi**2*(1/A**2+1/B**2)
CRITERIA={'finestFullFieldRmsK':.25,'finestBoundaryPowerRelativeError':.01,'finestFixedGridMaximumTimeErrorK':.001,'refinedSpaceOrderRange':[1.8,2.2],'timeOrderRange':[1.8,2.2]}
GEOMETRY=r"""
import {createConvexTriangleMesh} from './dynamic/dev/convex-triangle-mesh.mjs';const c=Math.cos(.37),s=Math.sin(.37),outline=[[-.2,-.1],[.2,-.1],[.2,.1],[-.2,.1]].map(([x,y])=>[.53+x*c-y*s,.47+x*s+y*c]);console.log(JSON.stringify([2,4,8,16].map(subdivisions=>({subdivisions,mesh:createConvexTriangleMesh({outline,subdivisions})}))));
"""
ACTUAL=r"""
import {readFileSync} from 'node:fs';import {createTriangleDiffusion} from './dynamic/dev/triangle-diffusion.mjs';const r=JSON.parse(readFileSync(process.argv[1])),sample=m=>{const s=m.snapshot();return {temperature:s.temperature,temperatureExcess:s.temperatureExcess,time:s.time,steps:s.steps,safeDt:s.safeDt,energy:s.energy,boundaryPowerW:s.boundaryOutwardPowerW,boundaryOneSidedFourierPowerW:s.boundaryOneSidedFourierPowerW,boundaryGradientVsReactionDifferenceW:s.boundaryGradientVsReactionDifferenceW,energyErrorJ:s.energyError,roundoffBudgetJ:s.energyRoundoffBudgetJ,relativeEnergyError:s.relativeEnergyError};};const grids=[];for(const row of r.grids){const m=createTriangleDiffusion(row.config);while(m.time<r.endTime)m.step(Math.min(m.safeDt,r.endTime-m.time),false);grids.push(sample(m));}const fixed=[];for(const count of [4,8,16]){const m=createTriangleDiffusion(r.grids[1].config),dt=r.endTime/count;if(dt>m.safeDt)throw Error('Reference step exceeds the declared SSP bound');for(let j=0;j<count;j++)m.step(dt,false);fixed.push({stepCount:count,dt,...sample(m)});}console.log(JSON.stringify({grids,fixed}));
"""

def node(source,*args):return json.loads(subprocess.run(['node','--input-type=module','-e',source,*args],cwd=ROOT,check=True,capture_output=True,text=True).stdout)
def mode(points):
 x=points[...,0]-.53;y=points[...,1]-.47;c=math.cos(ANGLE);s=math.sin(ANGLE)
 return AMPLITUDE*np.sin(math.pi*(c*x+s*y+A/2)/A)*np.sin(math.pi*(-s*x+c*y+B/2)/B)

def assemble(m):
 p=np.array([v['point'] for v in m['nodes']]);n=len(p);matrix=np.zeros((n,n));capacity=np.zeros(n);elements=[]
 for e in m['elements']:
  ids=e['nodes'];v=p[ids];twice=(v[1,0]-v[0,0])*(v[2,1]-v[0,1])-(v[1,1]-v[0,1])*(v[2,0]-v[0,0]);assert twice>0;area=twice/2
  gradients=np.array([[v[(i+1)%3,1]-v[(i+2)%3,1],v[(i+2)%3,0]-v[(i+1)%3,0]] for i in range(3)])/twice;local=K*DEPTH*area*gradients@gradients.T
  for i,a in enumerate(ids):
   capacity[a]+=RHO*CP*DEPTH*area/3
   for j,b in enumerate(ids):matrix[a,b]+=local[i,j]
  elements.append({'nodes':ids,'physicalAreaM2':area})
 return p,matrix,capacity,elements

def load_integral(points,elements,order):
 z,w=leggauss(order);z=(z+1)/2;w=w/2;r=z[:,None];s=z[None,:];bary=np.stack(np.broadcast_arrays(1-r,r*(1-s),r*s),axis=-1);weights=w[:,None]*w[None,:]*r;load=np.zeros(len(points))
 for e in elements:
  ids=e['nodes'];physical=np.einsum('ijk,kl->ijl',bary,points[ids]);psi=mode(physical)*math.exp(-LAMBDA*END);integrals=2*e['physicalAreaM2']*np.sum(weights[...,None]*bary*psi[...,None],axis=(0,1))
  for i,node_id in enumerate(ids):load[node_id]+=integrals[i]
 return load

def interpolant_square(theta,elements):
 return sum(e['physicalAreaM2']/6*(sum(theta[i]**2 for i in e['nodes'])+theta[e['nodes'][0]]*theta[e['nodes'][1]]+theta[e['nodes'][1]]*theta[e['nodes'][2]]+theta[e['nodes'][2]]*theta[e['nodes'][0]]) for e in elements)

def main():
 geometry=node(GEOMETRY);targets=[];raw=[]
 for row in geometry:
  m=row['mesh'];p,matrix,capacity,elements=assemble(m);boundary=np.array([v['boundary'] for v in m['nodes']]);initial=300+mode(p);initial[boundary]=300;theta0=initial-300;exact=mode(p)*math.exp(-LAMBDA*END);exact[boundary]=0
  load8=load_integral(p,elements,8);load12=load_integral(p,elements,12);refinement=float(np.max(np.abs(load12-load8)));assert refinement<2e-12
  unknown=np.flatnonzero(~boundary);root=np.sqrt(capacity[unknown]);symmetric=matrix[np.ix_(unknown,unknown)]/root[:,None]/root[None,:];asymmetry=float(np.max(np.abs(symmetric-symmetric.T)));assert asymmetry<1e-13;values,vectors=eigh((symmetric+symmetric.T)/2);assert values[0]>0
  ode=np.zeros(len(p));ode[unknown]=(vectors@(np.exp(-values*END)*(vectors.T@(root*theta0[unknown]))))/root
  config={'outline':m['outline'],'subdivisions':row['subdivisions'],'k':K,'depth':DEPTH,'rho':RHO,'cp':CP,'wallTemperature':300,'initial':initial.tolist(),'maxTemperature':1000}
  targets.append({'subdivisions':row['subdivisions'],'config':config,'nodeCount':len(p),'elements':elements,'referenceLumpedCapacityJPerK':capacity.tolist(),'continuousTemperatureExcessK':exact.tolist(),'continuousLoadIntegralKM2':load12.tolist(),'continuousSquareIntegralK2M2':AMPLITUDE**2*math.exp(-2*LAMBDA*END)*A*B/4,'continuousHeatJ':RHO*CP*DEPTH*AMPLITUDE*4*A*B/math.pi**2*math.exp(-LAMBDA*END),'continuousBoundaryPowerW':LAMBDA*RHO*CP*DEPTH*AMPLITUDE*4*A*B/math.pi**2*math.exp(-LAMBDA*END),'initialInterpolantHeatJ':float(capacity@theta0),'loadQuadratureRefinementMaxDifferenceKM2':refinement,'independentSemidiscreteTemperatureExcessK':ode.tolist(),'minimumSymmetricDiffusionEigenvaluePerS':float(values[0]),'independentSymmetricTransformAsymmetry':asymmetry})
  raw.append((capacity,elements,load12,exact,ode,matrix,boundary,p,m))
 with tempfile.TemporaryDirectory(prefix='triangle-transient-reference-') as temporary:
  f=Path(temporary)/'inputs.json';f.write_text(json.dumps({'grids':targets,'endTime':END}));actual=node(ACTUAL,str(f))
 for target,s,(capacity,elements,load,exact,ode,matrix,boundary,points,mesh) in zip(targets,actual['grids'],raw):
  theta=np.array(s['temperatureExcess']);integral=interpolant_square(theta,elements)-2*float(theta@load)+target['continuousSquareIntegralK2M2'];assert integral>=0
  gradients=[]
  for element in elements:
   ids=element['nodes'];v=points[ids];twice=2*element['physicalAreaM2'];basis=np.array([[v[(i+1)%3,1]-v[(i+2)%3,1],v[(i+2)%3,0]-v[(i+1)%3,0]] for i in range(3)])/twice
   gradients.append(theta[ids]@basis)
  raw_boundary=0.0
  for edge in mesh['edges']:
   if not edge['boundary']:continue
   a,b=points[edge['nodes']];delta=b-a;flux=-K*gradients[edge['triangles'][0]];raw_boundary+=DEPTH*(flux[0]*delta[1]-flux[1]*delta[0])
  independent_reaction=float(-np.sum((matrix@theta)[boundary]));assert abs(raw_boundary-s['boundaryOneSidedFourierPowerW'])<1e-9;assert abs(independent_reaction-s['boundaryPowerW'])<1e-9
  target['independentBoundaryDefinitions']={'oneSidedFourierPowerW':float(raw_boundary),'nodalReactionPowerW':independent_reaction,'scope':'Recomputed from actual nodal temperatures using independent physical-coordinate basis gradients/K; definition verification, distinct from continuous accuracy.'}
  target['production']={**s,'fullInterpolatedFieldRmsK':math.sqrt(integral/(A*B)),'maximumNodalErrorK':float(np.max(np.abs(theta-exact))),'lumpedNodalRmsK':float(np.sqrt(np.sum(capacity*(theta-exact)**2)/np.sum(capacity))),'physicalHeatRelativeError':s['energy']/target['continuousHeatJ']-1,'boundaryPowerRelativeError':s['boundaryPowerW']/target['continuousBoundaryPowerW']-1,'oneSidedFourierBoundaryRelativeError':s['boundaryOneSidedFourierPowerW']/target['continuousBoundaryPowerW']-1,'fixedGridOdeMaximumErrorK':float(np.max(np.abs(theta-ode)))}
 fixed=[];target=targets[1];capacity=raw[1][0];ode=raw[1][4]
 for s in actual['fixed']:
  theta=np.array(s['temperatureExcess']);fixed.append({**s,'maximumTimeErrorK':float(np.max(np.abs(theta-ode))),'lumpedNodalTimeRmsK':float(np.sqrt(np.sum(capacity*(theta-ode)**2)/np.sum(capacity)))})
 orders=[math.log2(targets[i]['production']['fullInterpolatedFieldRmsK']/targets[i+1]['production']['fullInterpolatedFieldRmsK']) for i in range(3)];time_orders=[math.log2(fixed[i]['maximumTimeErrorK']/fixed[i+1]['maximumTimeErrorK']) for i in range(2)]
 checks={'finestFullFieldBudget':targets[-1]['production']['fullInterpolatedFieldRmsK']<CRITERIA['finestFullFieldRmsK'],'finestBoundaryPowerBudget':abs(targets[-1]['production']['boundaryPowerRelativeError'])<CRITERIA['finestBoundaryPowerRelativeError'],'finestFixedGridTimeBudget':fixed[-1]['maximumTimeErrorK']<CRITERIA['finestFixedGridMaximumTimeErrorK'],'refinedSpatialOrders':all(1.8<=p<=2.2 for p in orders[-2:]),'timeOrders':all(1.8<=p<=2.2 for p in time_orders),'monotoneFieldRefinement':all(targets[i+1]['production']['fullInterpolatedFieldRmsK']<targets[i]['production']['fullInterpolatedFieldRmsK'] for i in range(3))}
 result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'recordedClientDate':'2026-11-06 Asia/Tokyo','generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sourceFilesSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['dynamic/dev/triangle-diffusion.mjs','dynamic/dev/triangle-stiffness.mjs','dynamic/dev/convex-triangle-mesh.mjs','dynamic/dev/planar-predicates.mjs','dynamic/dev/dyadic-quotient.mjs']},'sourceBeforeEdits':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceTreeDirty':True,'continuousMode':{'widthM':A,'heightM':B,'rotationRad':ANGLE,'centerM':[.53,.47],'wallK':300,'amplitudeK':AMPLITUDE,'alphaM2PerS':K/(RHO*CP),'decayRatePerS':LAMBDA,'endTimeS':END,'equation':'T=300+50 sin(pi xi/.4) sin(pi eta/.2) exp[-alpha pi^2(1/.4^2+1/.2^2)t]. Exact homogeneous-Dirichlet rectangle mode; initial P1 interpolation error remains part of spatial error.'},'criteriaDeclaredBeforeProductionEvaluation':CRITERIA,'grids':targets,'combinedSpatialOrders':orders,'fixedTime':{'configGridIndex':1,'reference':'Independent physical-coordinate element-gradient K, exact P1 lumped integrals, symmetric weighted eigensystem exponential. Uses actual rounded initial Kelvin data.','runs':fixed,'orders':time_orders},'checks':checks,'releaseApproved':False,'scope':'These constant-property rotated-rectangle cases separate true continuous field/boundary heat, initial P1 interpolation, and fixed-grid SSPRK2 time error. No general geometry/order, facewise flux, nonlinear material, expert or real-device approval.'}
 (ROOT/'docs/dynamic/TRIANGLE_TRANSIENT_REFERENCE_20261106.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
 print(json.dumps({'grids':[{'n':r['subdivisions'],'nodes':r['nodeCount'],**{k:r['production'][k] for k in ['safeDt','steps','fullInterpolatedFieldRmsK','maximumNodalErrorK','physicalHeatRelativeError','boundaryPowerRelativeError','oneSidedFourierBoundaryRelativeError','energyErrorJ']}} for r in targets],'spaceOrders':orders,'fixedTime':[{'dt':r['dt'],'maximumTimeErrorK':r['maximumTimeErrorK']} for r in fixed],'timeOrders':time_orders,'checks':checks},indent=2))
 if not all(checks.values()):raise SystemExit('Preserved reference and failed criteria; do not weaken budgets.')
if __name__=='__main__':main()
