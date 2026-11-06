#!/usr/bin/env python3
"""Independent physical-coordinate P1 rates, sparse constrained flux optimum,
RT0 normal traces and full continuous vector-field errors; no JS CG reuse."""
import os
for name in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']:os.environ[name]='1'
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,math,subprocess,platform
import numpy as np
import scipy
from scipy.sparse import coo_matrix,diags
from scipy.sparse.linalg import spsolve
from numpy.polynomial.legendre import leggauss
ROOT=Path(__file__).resolve().parents[1]
CRITERIA={'independentEdgeRelativeError':1e-9,'elementBalanceRelativeError':1.1e-11,'finestContinuousVectorRelativeL2':.1,'lastRefinementOrderMinimum':.8}
K,D,RHO,CP,A,B,ANGLE,TIME=15.,.03,1000.,1000.,.4,.2,.37,20.
DECAY=math.exp(-K/(RHO*CP)*math.pi**2*(1/A**2+1/B**2)*TIME)
ACTUAL=r"""
import {createTriangleDiffusion} from './dynamic/dev/triangle-diffusion.mjs';import {createTriangleFluxRecovery} from './dynamic/dev/triangle-flux-recovery.mjs';import {buildTriangleExperiment} from './dynamic/dev/triangle-ui-config.mjs';const rows=[];for(const subdivisions of [2,4,8,16]){const c=Math.cos(.37),s=Math.sin(.37),outline=[[-.2,-.1],[.2,-.1],[.2,.1],[-.2,.1]].map(([x,y])=>[.53+c*x-s*y,.47+s*x+c*y]);const {createConvexTriangleMesh}=await import('./dynamic/dev/convex-triangle-mesh.mjs');const mesh=createConvexTriangleMesh({outline,subdivisions}),initial=mesh.nodes.map(n=>n.boundary?300:300+50*Math.sin(Math.PI*((n.point[0]-.53)*c+(n.point[1]-.47)*s+.2)/.4)*Math.sin(Math.PI*(-(n.point[0]-.53)*s+(n.point[1]-.47)*c+.1)/.2)),config={outline,subdivisions,k:15,depth:.03,rho:1000,cp:1000,source:0,wallTemperature:300,initial};const m=createTriangleDiffusion(config);while(m.time<20)m.step(Math.min(m.safeDt,20-m.time),false);const state=m.snapshot(),recovered=createTriangleFluxRecovery({...config,mesh}).recover(state);rows.push({config,mesh,state,recovered});}console.log(JSON.stringify(rows));
"""
def exact_flux(points):
 c,s=math.cos(ANGLE),math.sin(ANGLE);x=points[...,0]-.53;y=points[...,1]-.47;xi=c*x+s*y+A/2;eta=-s*x+c*y+B/2
 gx=50*DECAY*math.pi/A*np.cos(math.pi*xi/A)*np.sin(math.pi*eta/B);gy=50*DECAY*math.pi/B*np.sin(math.pi*xi/A)*np.cos(math.pi*eta/B)
 return -K*np.stack([c*gx-s*gy,s*gx+c*gy],axis=-1)
def integrate_error(points,triangles,area,raw,field,order):
 z,w=leggauss(order);z=(z+1)/2;w=w/2;r=z[:,None];s=z[None,:];bary=np.stack(np.broadcast_arrays(1-r,r*(1-s),r*s),axis=-1);weights=w[:,None]*w[None,:]*r
 sums=np.zeros(3)
 for i,ids in enumerate(triangles):
  physical=np.einsum('ijk,kl->ijl',bary,points[ids]);target=exact_flux(physical);f=field[i];rec=np.array(f['fluxAtCentroidWPerM2'])+f['isotropicSlopeWPerM3']*(physical-np.array(f['centroidM']))
  errors=[np.sum((rec-target)**2,axis=-1),np.sum((raw[i]-target)**2,axis=-1),np.sum((rec-raw[i])**2,axis=-1)]
  sums+=np.array([2*area[i]*np.sum(weights*e) for e in errors])
 return sums

def main():
 actual=json.loads(subprocess.run(['node','--input-type=module','-e',ACTUAL],cwd=ROOT,capture_output=True,text=True,check=True).stdout);out=[]
 exact_norm_sq=K**2*(50*DECAY)**2*math.pi**2*(1/A**2+1/B**2)*A*B/4
 for row in actual:
  mesh,state,field=row['mesh'],row['state'],row['recovered'];points=np.array([n['point'] for n in mesh['nodes']]);triangles=[e['nodes'] for e in mesh['elements']];nn=len(points);ne=len(triangles);areas=[];matrix=np.zeros((nn,nn));capacity=np.zeros(nn);raw=[]
  theta=np.array(state['temperatureExcess']);boundary=np.array([n['boundary'] for n in mesh['nodes']])
  for ids in triangles:
   v=points[ids];twice=np.linalg.det(np.array([v[1]-v[0],v[2]-v[0]]));area=twice/2;assert area>0;areas.append(area);basis=np.array([[v[(i+1)%3,1]-v[(i+2)%3,1],v[(i+2)%3,0]-v[(i+1)%3,0]] for i in range(3)])/twice;local=K*D*area*basis@basis.T;raw.append(-K*(theta[ids]@basis))
   for i,a in enumerate(ids):
    capacity[a]+=RHO*CP*D*area/3
    for j,b in enumerate(ids):matrix[a,b]+=local[i,j]
  areas=np.array(areas);raw=np.array(raw);rates=-(matrix@theta)/capacity;rates[boundary]=0;rate_difference=float(np.max(np.abs(rates-np.array(state['nodalTemperatureRateKPerS']))));assert rate_difference<1e-12
  centres=np.array([np.mean(points[ids],axis=0) for ids in triangles]);rows=[];cols=[];signs=[];weights=[];q0=[];normal_trace_error=0.
  for edge_id,edge in enumerate(mesh['edges']):
   ids=edge['nodes'];a,b=points[ids];delta=b-a;length=np.linalg.norm(delta);normal=np.array([delta[1],-delta[0]])/length;mid=(a+b)/2;t=edge['triangles'];distance=np.dot(mid-centres[t[0]],normal);rows.append(t[0]);cols.append(edge_id);signs.append(1)
   if len(t)==2:distance+=np.dot(centres[t[1]]-mid,normal);rows.append(t[1]);cols.append(edge_id);signs.append(-1)
   weights.append(K*D*length/distance);q0.append(D*length*np.dot(np.mean(raw[t],axis=0),normal))
   power=field['edges'][edge_id]['powerOutOfFirstW']
   for element in t:
    f=field['elements'][element];q=np.array(f['fluxAtCentroidWPerM2'])+f['isotropicSlopeWPerM3']*(mid-np.array(f['centroidM']));normal_trace_error=max(normal_trace_error,abs(D*length*np.dot(q,normal)-power))
  incidence=coo_matrix((signs,(rows,cols)),shape=(ne,len(mesh['edges']))).tocsr();weight=diags(weights);q0=np.array(q0);storage=RHO*CP*D*areas*np.array([np.mean(rates[ids]) for ids in triangles]);target=-storage
  dual=spsolve((incidence@weight@incidence.T).tocsc(),target-incidence@q0);oracle=q0+weight@incidence.T@dual;production=np.array([e['powerOutOfFirstW'] for e in field['edges']]);scale=max(np.max(np.abs(oracle)),np.max(np.abs(target)),np.max(np.abs(q0)));edge_error=np.max(np.abs(production-oracle));balance=np.max(np.abs(incidence@production-target));cross=np.max(np.abs(raw-np.array(state['elementHeatFluxWPerM2'])));assert cross<1e-8
  integral8=integrate_error(points,triangles,areas,raw,field['elements'],8);integral12=integrate_error(points,triangles,areas,raw,field['elements'],12);quadrature_change=float(np.max(np.abs(integral12-integral8))/exact_norm_sq);assert quadrature_change<1e-11
  metrics={'subdivisions':mesh['subdivisions'],'triangles':ne,'nodes':nn,'timeS':state['time'],'independentNodalRateMaximumDifferenceKPerS':rate_difference,'independentRawFluxMaximumDifferenceWPerM2':float(cross),'independentEdgeMaximumDifferenceW':float(edge_error),'independentEdgeRelativeError':float(edge_error/scale),'independentElementBalanceMaximumResidualW':float(balance),'independentElementBalanceRelativeError':float(balance/scale),'normalTraceMaximumPowerErrorW':float(normal_trace_error),'continuousVectorRelativeL2':math.sqrt(integral12[0]/exact_norm_sq),'rawFourierContinuousVectorRelativeL2':math.sqrt(integral12[1]/exact_norm_sq),'recoveredVsRawConstitutiveRelativeL2':math.sqrt(integral12[2]/exact_norm_sq),'quadratureRelativeRefinementChange':quadrature_change,'discreteReactionW':state['boundaryOutwardPowerW'],'recoveredBoundaryPowerW':field['diagnostics']['boundaryOutwardPowerW'],'rawBoundaryPowerW':state['boundaryOneSidedFourierPowerW'],'productionDiagnostics':field['diagnostics'],'config':row['config'],'referenceEdgePowerOutOfFirstW':oracle.tolist(),'actualTemperatureExcessK':state['temperatureExcess']}
  out.append(metrics)
 orders=[math.log2(out[i]['continuousVectorRelativeL2']/out[i+1]['continuousVectorRelativeL2']) for i in range(len(out)-1)];checks={'edgeOptimum':all(r['independentEdgeRelativeError']<CRITERIA['independentEdgeRelativeError'] for r in out),'localBalance':all(r['independentElementBalanceRelativeError']<CRITERIA['elementBalanceRelativeError'] for r in out),'finestVectorAccuracy':out[-1]['continuousVectorRelativeL2']<CRITERIA['finestContinuousVectorRelativeL2'],'lastRefinementOrder':orders[-1]>CRITERIA['lastRefinementOrderMinimum']}
 result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'recordedClientDate':'2026-11-06 Asia/Tokyo','sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceTreeDirty':True,'generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sourceFilesSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['dynamic/dev/triangle-diffusion.mjs','dynamic/dev/triangle-flux-recovery.mjs']},'environment':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'BLASThreads':1},'method':'Independent physical-coordinate P1 K/C and rates; explicit sparse incidence constrained minimum via direct sparse dual solve. Full RT0 vector-field quadrature against analytic rotated-rectangle gradient. Production CG, cotangent K and recovery are not used to generate oracle values.','criteriaBeforeVerificationCommit':'36cb7b9','criteria':CRITERIA,'rows':out,'continuousVectorOrders':orders,'checks':checks,'releaseApproved':False,'scope':'Postprocessing verifies element-mean storage balance and normal continuity; it changes constitutive flux and does not correct the nodal temperature error. Narrow constant-property homogeneous-Dirichlet rotated rectangle, not general accuracy approval.'}
 (ROOT/'docs/dynamic/TRIANGLE_FLUX_REFERENCE_20261106.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n');print(json.dumps({'rows':[{k:v for k,v in r.items() if k not in ['config','referenceEdgePowerOutOfFirstW','actualTemperatureExcessK']} for r in out],'orders':orders,'checks':checks},indent=2))
 if not all(checks.values()):raise SystemExit('Independent recovery checks failed; results preserved without relaxing criteria.')
if __name__=='__main__':main()
