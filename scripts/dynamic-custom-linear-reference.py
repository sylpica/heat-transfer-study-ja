#!/usr/bin/env python3
"""Independent physical P1 affine exponential for convex mixed boundary inputs."""
import os
for name in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']:os.environ[name]='1'
from pathlib import Path
from datetime import datetime,timezone
import json,math,hashlib,subprocess,tempfile
import numpy as np
from scipy.linalg import expm
ROOT=Path(__file__).resolve().parents[1]
TIME=20.
GEOMETRY="""
import {createBoundaryRefinedTriangleMesh} from './dynamic/dev/boundary-refined-triangle-mesh.mjs';const shapes={triangle:[[0,0],[.4,0],[.2,.2*Math.sqrt(3)]],pentagon:Array.from({length:5},(_,i)=>[.4+.25*Math.cos(i*2*Math.PI/5),.4+.2*Math.sin(i*2*Math.PI/5)]),quad:[[.1,.1],[.55,.12],[.48,.5],[.15,.43]],octagon:Array.from({length:8},(_,i)=>[.4+.25*Math.cos(i*Math.PI/4),.4+.2*Math.sin(i*Math.PI/4)])};console.log(JSON.stringify(Object.entries(shapes).flatMap(([shape,outline])=>[2,4,8].map(subdivisions=>({shape,mesh:createBoundaryRefinedTriangleMesh({outline,subdivisions})})))));
"""
ACTUAL="""
import {readFileSync} from 'node:fs';import {createTriangleLinearTransient} from './dynamic/dev/triangle-linear-transient.mjs';console.log(JSON.stringify(JSON.parse(readFileSync(process.argv[1])).map(row=>{const m=createTriangleLinearTransient(row.config);if(row.dt>m.safeDt)throw Error('reference dt exceeds positive bound');while(m.time<20)m.step(Math.min(row.dt??m.safeDt,20-m.time),false);return m.snapshot();})));
"""
def node(code,*args):return json.loads(subprocess.check_output(['node','--input-type=module','-e',code,*args],cwd=ROOT,text=True))
def assemble(mesh,c):
 p=np.array([n['point'] for n in mesh['nodes']]);N=len(p);K=np.zeros((N,N));C=np.zeros(N);source=np.zeros(N);robin=np.zeros(N);ambient=np.zeros(N);flux=np.zeros(N);fixed=np.zeros(N,dtype=bool);fx=np.zeros(N);corners=np.array(c['outline'])
 for e in mesh['elements']:
  ids=e['nodes'];a=p[ids];twice=np.linalg.det(np.array([a[1]-a[0],a[2]-a[0]]));assert twice>0;area=twice/2;grad=np.array([[a[(i+1)%3,1]-a[(i+2)%3,1],a[(i+2)%3,0]-a[(i+1)%3,0]] for i in range(3)])/twice;matrix=c['k']*c['depth']*area*grad@grad.T
  for i,u in enumerate(ids):
   C[u]+=c['rho']*c['cp']*c['depth']*area/3;source[u]+=c['source']*c['depth']*area/3
   for j,v in enumerate(ids):K[u,v]+=matrix[i,j]
 for e in mesh['edges']:
  if not e['boundary']:continue
  ids=e['nodes'];a,b=p[ids];length=np.linalg.norm(b-a);mid=(a+b)/2;distances=[]
  for i,x in enumerate(corners):
   v=corners[(i+1)%len(corners)]-x;along=np.dot(mid-x,v)/np.dot(v,v);distance=abs(v[0]*(mid[1]-x[1])-v[1]*(mid[0]-x[0]))/np.linalg.norm(v);distances.append(distance if -1e-12<=along<=1+1e-12 else math.inf)
  face=int(np.argmin(distances));assert distances[face]<1e-12;bc=c['boundaries'][face]
  if bc['type']=='temperature':
   for i in ids:
    if fixed[i]:assert fx[i]==bc['temperatureK']-300
    fixed[i]=True;fx[i]=bc['temperatureK']-300
  if bc['type']=='flux':
   for i in ids:flux[i]+=bc['outwardFluxWPerM2']*c['depth']*length/2
  if bc['type']=='convection':
   for i in ids:robin[i]+=bc['h']*c['depth']*length/2;ambient[i]+=bc['h']*c['depth']*length/2*(bc['ambientK']-300)
 A=K+np.diag(robin);rhs=source+ambient-flux;free=np.flatnonzero(~fixed);initial=np.zeros(N);initial[fixed]=fx[fixed];matrix=np.zeros((len(free)+1,len(free)+1));matrix[:-1,:-1]=-A[np.ix_(free,free)]/C[free,None];matrix[:-1,-1]=(rhs[free]-A[np.ix_(free,np.flatnonzero(fixed))]@fx[fixed])/C[free];z=np.r_[initial[free],1.];target=initial.copy();target[free]=(expm(TIME*matrix)@z)[:-1]
 return K,C,source,robin,ambient,flux,fixed,target
def main():
 geometries=node(GEOMETRY);inputs=[];private=[]
 for row in geometries:
  m=row['mesh'];boundaries=[({'type':'temperature','temperatureK':310} if i%4==0 else {'type':'flux','outwardFluxWPerM2':-40} if i%4==1 else {'type':'convection','h':6,'ambientK':290} if i%4==2 else {'type':'adiabatic'}) for i in range(len(m['outline']))];c={'outline':m['outline'],'subdivisions':m['subdivisions'],'boundaryRefinement':True,'k':15,'rho':1000,'cp':100,'depth':.03,'source':25,'initial':300,'referenceTemperatureK':300,'boundaries':boundaries};oracle=assemble(m,c)
  for dt in ([.125,.0625,.03125] if m['subdivisions']==4 else [None]):inputs.append({'shape':row['shape'],'config':c,'dt':dt});private.append(oracle)
 with tempfile.TemporaryDirectory(prefix='custom-boundary-expm-') as directory:
  path=Path(directory)/'input.json';path.write_text(json.dumps(inputs));states=node(ACTUAL,str(path))
 rows=[]
 for row,s,(K,C,source,robin,ambient,flux,fixed,target) in zip(inputs,states,private):
  theta=np.array(s['temperatureExcess']);internal=K@theta;out=robin*theta-ambient+flux;rates=(source-internal-out)/C;rates[fixed]=0;reaction=source-internal-out;reaction[~fixed]=0;power=float(np.sum(out+reaction));rate_error=float(np.max(np.abs(rates-np.array(s['nodalTemperatureRateKPerS']))));rate_budget=float(128*np.finfo(float).eps*np.max((np.abs(source)+np.abs(K)@np.abs(theta)+np.abs(robin*theta)+np.abs(ambient)+np.abs(flux))/C));assert rate_error<=rate_budget;heat=float(C@theta);heat_scale=float(C@np.abs(theta));assert abs(heat-s['energy'])<=128*np.finfo(float).eps*heat_scale
  rows.append({**row,'independentExcessK':target.tolist(),'maximumTimeErrorK':float(np.max(np.abs(theta-target))),'independentRateMaximumDifferenceKPerS':rate_error,'independentRateRoundoffBudgetKPerS':rate_budget,'independentBoundaryOutwardPowerW':power,'boundaryPowerDifferenceW':power-s['boundaryOutwardPowerW'],'independentHeatJ':heat,'energyErrorJ':s['energyError'],'energyRoundoffBudgetJ':s['energyRoundoffBudgetJ'],'safeDtS':s['safeDt'],'steps':s['steps']})
 orders={shape:[math.log2([r for r in rows if r['shape']==shape and r['dt'] is not None][i]['maximumTimeErrorK']/[r for r in rows if r['shape']==shape and r['dt'] is not None][i+1]['maximumTimeErrorK']) for i in range(2)] for shape in ['triangle','pentagon','quad','octagon']};checks={'finestTimeMaximumError':all(r['maximumTimeErrorK']<.001 for r in rows if r['dt']==.03125),'lastTimeOrder':all(1.8<o[-1]<2.2 for o in orders.values()),'separateWholeHeat':all(abs(r['energyErrorJ'])<=r['energyRoundoffBudgetJ'] for r in rows),'independentInstantaneousRates':all(r['independentRateMaximumDifferenceKPerS']<=r['independentRateRoundoffBudgetKPerS'] for r in rows)}
 result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceTreeDirty':True,'criteriaDeclaredAtCommit':'ac0ec9f','generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'timeS':TIME,'method':'Independent physical-coordinate P1 gradients, boundary line-segment classification, lumped capacity/Robin, fixed-temperature elimination, affine augmented matrix exponential; production cotangents/topology IDs/SSPRK2 do not create the oracle.','rows':rows,'timeOrders':orders,'checks':checks,'generalContinuousFieldAccuracyVerified':False,'releaseApproved':False}
 (ROOT/'docs/dynamic/TRIANGLE_CUSTOM_LINEAR_REFERENCE_20261106.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n');print(json.dumps({'rows':[{'shape':r['shape'],'n':r['config']['subdivisions'],'dt':r['dt'],'maximumTimeErrorK':r['maximumTimeErrorK']} for r in rows],'orders':orders,'checks':checks},indent=2))
 assert all(checks.values()),'Preserve failed criteria; do not loosen them.'
if __name__=='__main__':main()
