#!/usr/bin/env python3
"""Independent physical-coordinate edge optimum on boundary-refined rotated meshes."""
import os
for name in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']:os.environ[name]='1'
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,math,subprocess,tempfile,importlib.util
import numpy as np
from scipy.sparse import coo_matrix,diags
from scipy.sparse.linalg import spsolve
from numpy.polynomial.legendre import leggauss
ROOT=Path(__file__).resolve().parents[1]
ORACLE=ROOT/'scripts/dynamic-boundary-refined-transient-reference.py';spec=importlib.util.spec_from_file_location('independent_linear_reference',ORACLE);linear=importlib.util.module_from_spec(spec);spec.loader.exec_module(linear)
ACTUAL=r"""
import {readFileSync} from 'node:fs';import {createTriangleLinearTransient} from './dynamic/dev/triangle-linear-transient.mjs';import {triangleLinearField} from './dynamic/dev/triangle-linear-field.mjs';import {createTriangleLinearFluxRecovery} from './dynamic/dev/triangle-linear-flux-recovery.mjs';const rows=JSON.parse(readFileSync(process.argv[1])).map(row=>{const m=createTriangleLinearTransient(row.config);while(m.time<row.time)m.step(Math.min(m.safeDt,row.time-m.time),false);const state=triangleLinearField(m.mesh,m.snapshot(),row.config.k),field=createTriangleLinearFluxRecovery({...row.config,mesh:m.mesh}).recover(state);return {...row,mesh:m.mesh,state,field};});console.log(JSON.stringify(rows));
"""
CRITERIA={'knownBoundaryRelativeError':1e-12,'edgeOptimumRelativeError':1e-9,'elementBalanceRelativeError':1.1e-11,'finestContinuousVectorRelativeL2':.1,'lastVectorOrderMinimum':.8}

def exact_flux(kind,points):
 y=linear.local(points)[...,1];H=linear.H
 if kind=='dirichlet-neumann':mu=math.pi/2;q=-15*50*mu/H*np.cos(mu*y/H)*math.exp(-15/1e6*(mu/H)**2*linear.TIME)
 elif kind=='robin-neumann':mu=linear.MU;q=15*50*mu/H*np.sin(mu*y/H)*math.exp(-15/1e6*(mu/H)**2*linear.TIME)
 elif kind=='steady-flux-robin':q=np.zeros_like(y)+20
 else:q=np.zeros_like(y)
 return np.stack([-math.sin(linear.ANGLE)*q,math.cos(linear.ANGLE)*q],axis=-1)
def full_error(row,points,areas,order):
 x,w=leggauss(order);x=(x+1)/2;w=w/2;r=x[:,None];s=x[None,:];bary=np.stack(np.broadcast_arrays(1-r,r*(1-s),r*s),axis=-1);weights=w[:,None]*w[None,:]*r;error=0.;norm=0.
 for i,t in enumerate(row['mesh']['elements']):
  p=np.einsum('ijk,kl->ijl',bary,points[t['nodes']]);f=row['field']['elements'][i];q=np.array(f['fluxAtCentroidWPerM2'])+f['isotropicSlopeWPerM3']*(p-np.array(f['centroidM']));target=exact_flux(row['kind'],p);error+=2*areas[i]*np.sum(weights*np.sum((q-target)**2,axis=-1));norm+=2*areas[i]*np.sum(weights*np.sum(target**2,axis=-1))
 return math.sqrt(error),math.sqrt(norm)

def main():
 references=json.loads((ROOT/'docs/dynamic/BOUNDARY_REFINED_TRANSIENT_REFERENCE_20261106.json').read_text());inputs=[{'kind':r['kind'],'time':linear.TIME,'config':r['config']} for r in references['cases']];station=json.loads(json.dumps(references['fixedTime']['config']));station['boundaries']=[{'type':'flux','outwardFluxWPerM2':-20},{'type':'adiabatic'},{'type':'convection','h':4,'ambientK':300},{'type':'adiabatic'}];mesh=linear.node(linear.GEOMETRY)[2];y=linear.local(np.array([n['point'] for n in mesh['nodes']]))[:,1];station['initial']=(300+5+20/15*(linear.H-y)).tolist();inputs.append({'kind':'steady-flux-robin','time':0,'config':station})
 body=json.loads(json.dumps(station));body['boundaries']=[{'type':'adiabatic'} for _ in range(4)];body['source']=100;body['initial']=300;inputs.append({'kind':'uniform-source','time':0,'config':body});tiny=json.loads(json.dumps(body));tiny['source']=1e-100;tiny['boundaries'][2]={'type':'convection','h':15,'ambientK':300};inputs.append({'kind':'tiny-robin-source','time':1,'config':tiny})
 with tempfile.TemporaryDirectory(prefix='mixed-rt0-reference-') as temporary:
  path=Path(temporary)/'cases.json';path.write_text(json.dumps(inputs));actual=linear.node(ACTUAL,str(path))
 rows=[]
 for row in actual:
  m,s,f,c=row['mesh'],row['state'],row['field'],row['config'];p,K,C,rhs,fixed,fixed_value,areas=linear.assemble(m,c);theta=np.array(s['temperatureExcess']);source=c.get('source',0);rhs=rhs+source*C/(c['rho']*c['cp']);rates=(rhs-K@theta)/C;rates[fixed]=0;rate_scale=max(np.max(np.abs(rates)),np.max(np.abs(s['nodalTemperatureRateKPerS'])));rate_error=np.max(np.abs(rates-np.array(s['nodalTemperatureRateKPerS'])));rate_budget=128*np.finfo(float).eps*np.max((np.abs(rhs)+np.abs(K)@np.abs(theta))/C);assert rate_error<=rate_budget,(row['kind'],float(rate_error),float(rate_budget))
  triangles=[t['nodes'] for t in m['elements']];raw=[]
  for ids,area in zip(triangles,areas):
   v=p[ids];basis=np.array([[v[(i+1)%3,1]-v[(i+2)%3,1],v[(i+2)%3,0]-v[(i+1)%3,0]] for i in range(3)])/(2*area);raw.append(-c['k']*(theta[ids]@basis))
  raw=np.array(raw);centres=np.array([np.mean(p[ids],axis=0) for ids in triangles]);bi=[];bj=[];bv=[];weights=[];q0=[];known=[];trace_error=0.
  for j,e in enumerate(m['edges']):
   a,b=p[e['nodes']];delta=b-a;length=np.linalg.norm(delta);normal=np.array([delta[1],-delta[0]])/length;mid=(a+b)/2;ts=e['triangles'];distance=np.dot(mid-centres[ts[0]],normal);bi.append(ts[0]);bj.append(j);bv.append(1)
   if len(ts)==2:distance+=np.dot(centres[ts[1]]-mid,normal);bi.append(ts[1]);bj.append(j);bv.append(-1)
   weights.append(c['k']*c['depth']*length/distance);q0.append(c['depth']*length*np.dot(np.mean(raw[ts],axis=0),normal));qknown=None
   if len(ts)==1:
    z=linear.local(mid);distances=[abs(z[1]),abs(z[0]-linear.W),abs(z[1]-linear.H),abs(z[0])];face=int(np.argmin(distances));assert distances[face]<1e-12*max(linear.W,linear.H)
    bc=c['boundaries'][face]
    if bc['type']=='adiabatic':qknown=0.
    if bc['type']=='flux':qknown=bc['outwardFluxWPerM2']*c['depth']*length
    if bc['type']=='convection':qknown=bc['h']*c['depth']*length*(np.mean(theta[e['nodes']])+(c.get('referenceTemperatureK',300)-bc['ambientK']))
   known.append(qknown)
   power=f['edges'][j]['powerOutOfFirstW']
   for element in ts:
    el=f['elements'][element];q=np.array(el['fluxAtCentroidWPerM2'])+el['isotropicSlopeWPerM3']*(mid-np.array(el['centroidM']));trace_error=max(trace_error,abs(c['depth']*length*np.dot(q,normal)-power))
  incidence=coo_matrix((bv,(bi,bj)),shape=(len(triangles),len(m['edges']))).tocsr();q0=np.array(q0);free=np.array([q is None for q in known]);known_array=np.array([0 if q is None else q for q in known]);base=q0.copy();base[~free]=known_array[~free];B=incidence[:,free];W=diags(np.array(weights)[free]);storage=c['rho']*c['cp']*c['depth']*areas*np.array([np.mean(rates[ids]) for ids in triangles]);sources=source*c['depth']*areas;target=sources-storage;residual=target-incidence@base;closed=not any(e['boundary'] and free[i] for i,e in enumerate(m['edges']));matrix=(B@W@B.T).tocsc();dual=np.zeros(len(triangles))
  if closed:dual[1:]=spsolve(matrix[1:,1:],residual[1:])
  else:dual=spsolve(matrix,residual)
  optimum=base.copy();optimum[free]+=W@B.T@dual;production=np.array([e['powerOutOfFirstW'] for e in f['edges']]);scale=max(np.max(np.abs(base)),np.max(np.abs(sources)),np.max(np.abs(storage)),np.max(np.abs(target)));edge_difference=np.max(np.abs(production-optimum));balance=np.max(np.abs(incidence@production-target));known_difference=np.max(np.abs(production[~free]-known_array[~free])) if np.any(~free) else 0;known_scale=np.max(np.abs(known_array));known_relative=float(known_difference/known_scale) if known_scale else None
  assert known_difference==0 or known_difference<=1e-12*known_scale
  metric={'kind':row['kind'],'subdivisions':m['subdivisions'],'config':c,'timeS':row['time'],'triangles':len(triangles),'physicalHeatScaleW':float(scale),'closedKnownBoundary':closed,'independentRateMaximumDifferenceKPerS':float(rate_error),'independentRateRoundoffBudgetKPerS':float(rate_budget),'independentRateRelativeError':float(rate_error/rate_scale) if rate_scale else None,'independentEdgeMaximumDifferenceW':float(edge_difference),'independentEdgeRelativeError':float(edge_difference/scale) if scale else None,'independentElementMaximumBalanceResidualW':float(balance),'independentElementBalanceRelativeError':float(balance/scale) if scale else None,'knownBoundaryMaximumDifferenceW':float(known_difference),'knownBoundaryRelativeError':known_relative,'normalTraceMaximumPowerDifferenceW':float(trace_error),'referenceEdgePowerOutOfFirstW':optimum.tolist(),'productionDiagnostics':f['diagnostics']}
  if row['kind']!='tiny-robin-source':
   error8,norm8=full_error(row,p,areas,8);error12,norm12=full_error(row,p,areas,12);assert abs(error8-error12)<max(1e-9,error12*1e-11);metric.update(continuousVectorAbsoluteL2=error12,continuousVectorRelativeL2=error12/norm12 if norm12 else None,quadratureAbsoluteRefinementDifference=error8-error12)
  rows.append(metric)
 orders={kind:[math.log2([r for r in rows if r['kind']==kind][i]['continuousVectorRelativeL2']/[r for r in rows if r['kind']==kind][i+1]['continuousVectorRelativeL2']) for i in range(3)] for kind in ['dirichlet-neumann','robin-neumann']};finest=[r for r in rows if r['subdivisions']==8];checks={'knownBoundary':all(r['knownBoundaryRelativeError'] is None or r['knownBoundaryRelativeError']<1e-12 for r in rows),'edgeOptimum':all(r['independentEdgeRelativeError'] is None or r['independentEdgeRelativeError']<1e-9 for r in rows),'localBalance':all(r['independentElementBalanceRelativeError'] is None or r['independentElementBalanceRelativeError']<1.1e-11 for r in rows),'finestVector':all(r['continuousVectorRelativeL2']<.1 for r in finest),'lastVectorOrders':all(v[-1]>.8 for v in orders.values())}
 result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceTreeDirty':True,'criteriaDeclaredAtCommit':'1ff34f1','criteria':CRITERIA,'generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sourceFilesSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['dynamic/dev/boundary-refined-triangle-mesh.mjs','dynamic/dev/triangle-linear-flux-recovery.mjs','dynamic/dev/triangle-linear-transient.mjs']},'independentAssemblyOracleSHA256':hashlib.sha256(ORACLE.read_bytes()).hexdigest(),'rateComparisonScope':'At a nominally steady state, dividing roundoff-level rates by roundoff-level reference rates is not an accuracy test. Check the absolute difference against 128 EPS times actual physical K-theta/rhs magnitudes over capacity, with no fixed rate floor. The initial noise-relative check failure is preserved in the work log and development record.','method':'Independent physical-coordinate K/C/rates, physical-coordinate boundary identification, sparse incidence/weights, direct constrained solve with one dual gauge when all boundary powers are known. Production CG and boundary topology IDs do not generate target edge powers.','rows':rows,'continuousVectorOrders':orders,'checks':checks,'releaseApproved':False,'scope':'Boundary-refined rotated rectangular linear boundary cases. Known boundary heat and local mean storage balance do not prove constitutive or general accuracy. Tiny-source target uses retained temperature excess rather than lost absolute-temperature differences.'}
 (ROOT/'docs/dynamic/BOUNDARY_REFINED_FLUX_REFERENCE_20261106.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n');print(json.dumps({'rows':[{k:v for k,v in r.items() if k not in ['config','referenceEdgePowerOutOfFirstW']} for r in rows],'orders':orders,'checks':checks},indent=2))
 if not all(checks.values()):raise SystemExit('Preserved failed mixed-boundary recovery criteria; do not weaken budgets.')
if __name__=='__main__':main()
