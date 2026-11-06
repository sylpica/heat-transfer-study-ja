#!/usr/bin/env python3
"""Independent constrained edge optimum on custom convex mixed-boundary meshes."""
import os
for name in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']:os.environ[name]='1'
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,math,subprocess,tempfile,importlib.util
import numpy as np
from scipy.sparse import coo_matrix,diags
from scipy.sparse.linalg import spsolve
ROOT=Path(__file__).resolve().parents[1]
ORACLE=ROOT/'scripts/dynamic-custom-linear-reference.py';spec=importlib.util.spec_from_file_location('independent_linear_reference',ORACLE);linear=importlib.util.module_from_spec(spec);spec.loader.exec_module(linear)
ACTUAL=r"""
import {readFileSync} from 'node:fs';import {createTriangleLinearTransient} from './dynamic/dev/triangle-linear-transient.mjs';import {triangleLinearField} from './dynamic/dev/triangle-linear-field.mjs';import {createTriangleLinearFluxRecovery} from './dynamic/dev/triangle-linear-flux-recovery.mjs';const rows=JSON.parse(readFileSync(process.argv[1])).map(row=>{const m=createTriangleLinearTransient(row.config);while(m.time<row.time)m.step(Math.min(m.safeDt,row.time-m.time),false);const state=triangleLinearField(m.mesh,m.snapshot(),row.config.k),field=createTriangleLinearFluxRecovery({...row.config,mesh:m.mesh}).recover(state);return {...row,mesh:m.mesh,state,field};});console.log(JSON.stringify(rows));
"""
CRITERIA={'knownBoundaryRelativeError':1e-12,'edgeOptimumRelativeError':1e-9,'elementBalanceRelativeError':1.1e-11,'normalTraceRelativePowerError':1e-9}

def main():
 references=json.loads((ROOT/'docs/dynamic/TRIANGLE_CUSTOM_LINEAR_REFERENCE_20261106.json').read_text());inputs=[{'kind':r['shape'],'time':20,'config':r['config']} for r in references['rows'] if r['dt'] in [None,.03125]];closed=json.loads(json.dumps(next(r['config'] for r in references['rows'] if r['shape']=='pentagon' and r['config']['subdivisions']==4)));closed['boundaries']=[{'type':'flux','outwardFluxWPerM2':-40},{'type':'convection','h':6,'ambientK':290},{'type':'adiabatic'},{'type':'convection','h':8,'ambientK':300},{'type':'adiabatic'}];inputs.append({'kind':'closed-pentagon','time':20,'config':closed})
 with tempfile.TemporaryDirectory(prefix='mixed-rt0-reference-') as temporary:
  path=Path(temporary)/'cases.json';path.write_text(json.dumps(inputs));actual=linear.node(ACTUAL,str(path))
 rows=[]
 for row in actual:
  m,s,f,c=row['mesh'],row['state'],row['field'],row['config'];K,C,src,robin,ambient,flux,fixed,_=linear.assemble(m,c);p=np.array([n['point'] for n in m['nodes']]);areas=np.array([np.linalg.det(np.array([p[e['nodes'][1]]-p[e['nodes'][0]],p[e['nodes'][2]]-p[e['nodes'][0]]]))/2 for e in m['elements']]);theta=np.array(s['temperatureExcess']);source=c.get('source',0);rates=(src+ambient-flux-K@theta-robin*theta)/C;rates[fixed]=0;rate_scale=max(np.max(np.abs(rates)),np.max(np.abs(s['nodalTemperatureRateKPerS'])));rate_error=np.max(np.abs(rates-np.array(s['nodalTemperatureRateKPerS'])));rate_budget=128*np.finfo(float).eps*np.max((np.abs(src)+np.abs(K)@np.abs(theta)+np.abs(robin*theta)+np.abs(ambient)+np.abs(flux))/C);assert rate_error<=rate_budget,(row['kind'],float(rate_error),float(rate_budget))
  triangles=[t['nodes'] for t in m['elements']];raw=[]
  for ids,area in zip(triangles,areas):
   v=p[ids];basis=np.array([[v[(i+1)%3,1]-v[(i+2)%3,1],v[(i+2)%3,0]-v[(i+1)%3,0]] for i in range(3)])/(2*area);raw.append(-c['k']*(theta[ids]@basis))
  raw=np.array(raw);centres=np.array([np.mean(p[ids],axis=0) for ids in triangles]);bi=[];bj=[];bv=[];weights=[];q0=[];known=[];trace_error=0.
  for j,e in enumerate(m['edges']):
   a,b=p[e['nodes']];delta=b-a;length=np.linalg.norm(delta);normal=np.array([delta[1],-delta[0]])/length;mid=(a+b)/2;ts=e['triangles'];distance=np.dot(mid-centres[ts[0]],normal);bi.append(ts[0]);bj.append(j);bv.append(1)
   if len(ts)==2:distance+=np.dot(centres[ts[1]]-mid,normal);bi.append(ts[1]);bj.append(j);bv.append(-1)
   weights.append(c['k']*c['depth']*length/distance);q0.append(c['depth']*length*np.dot(np.mean(raw[ts],axis=0),normal));qknown=None
   if len(ts)==1:
    corners=np.array(c['outline']);distances=[]
    for face_index,x in enumerate(corners):
     v=corners[(face_index+1)%len(corners)]-x;along=np.dot(mid-x,v)/np.dot(v,v);distances.append(abs(v[0]*(mid[1]-x[1])-v[1]*(mid[0]-x[0]))/np.linalg.norm(v) if -1e-12<=along<=1+1e-12 else math.inf)
    face=int(np.argmin(distances));assert distances[face]<1e-12
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
  rows.append(metric)
 checks={'knownBoundary':all(r['knownBoundaryRelativeError'] is None or r['knownBoundaryRelativeError']<1e-12 for r in rows),'edgeOptimum':all(r['independentEdgeRelativeError'] is None or r['independentEdgeRelativeError']<1e-9 for r in rows),'localBalance':all(r['independentElementBalanceRelativeError'] is None or r['independentElementBalanceRelativeError']<1.1e-11 for r in rows),'normalTraces':all(r['normalTraceMaximumPowerDifferenceW']<1e-9*r['physicalHeatScaleW'] for r in rows)}
 result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceTreeDirty':True,'criteriaDeclaredAtCommit':'08bd569','criteria':CRITERIA,'generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sourceFilesSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['dynamic/dev/convex-triangle-mesh.mjs','dynamic/dev/triangle-linear-flux-recovery.mjs','dynamic/dev/triangle-linear-transient.mjs']},'independentAssemblyOracleSHA256':hashlib.sha256(ORACLE.read_bytes()).hexdigest(),'rateComparisonScope':'At a nominally steady state, dividing roundoff-level rates by roundoff-level reference rates is not an accuracy test. Check the absolute difference against 128 EPS times actual physical K-theta/rhs magnitudes over capacity, with no fixed rate floor. The initial noise-relative check failure is preserved in the work log and development record.','method':'Independent physical-coordinate K/C/rates, physical-coordinate boundary identification, sparse incidence/weights, direct constrained solve with one dual gauge when all boundary powers are known. Production CG and boundary topology IDs do not generate target edge powers.','rows':rows,'checks':checks,'releaseApproved':False,'scope':'Custom convex mixed-boundary positive-graph cases; no general continuous-field reference. Known boundary heat and local mean storage balance do not prove constitutive or general accuracy.'}
 (ROOT/'docs/dynamic/TRIANGLE_CUSTOM_FLUX_REFERENCE_20261106.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n');print(json.dumps({'rows':[{k:v for k,v in r.items() if k not in ['config','referenceEdgePowerOutOfFirstW']} for r in rows],'checks':checks},indent=2))
 if not all(checks.values()):raise SystemExit('Preserved failed mixed-boundary recovery criteria; do not weaken budgets.')
if __name__=='__main__':main()
