#!/usr/bin/env python3
"""Independent element-gradient assembly, not production cotangent formulas."""
from pathlib import Path
from datetime import datetime, timezone
import json,hashlib,subprocess,os
for key in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']:os.environ[key]='1'
import numpy as np
ROOT=Path(__file__).resolve().parents[1]

def main():
 driver=r"""
import {readFileSync} from 'node:fs';import {createConvexTriangleMesh} from './dynamic/dev/convex-triangle-mesh.mjs';import {assembleTriangleDiffusion} from './dynamic/dev/triangle-stiffness.mjs';const rows=JSON.parse(readFileSync('docs/dynamic/TRIANGLE_MESH_REFERENCE_20261106.json')).rows.filter(r=>r.id==='rotated-rectangle'||r.id==='regular-5');rows.push({id:'exact-square',outline:[[0,0],[1,0],[1,1],[0,1]],subdivisions:4});console.log(JSON.stringify(rows.map(r=>({id:r.id,outline:r.outline,subdivisions:r.subdivisions,operator:assembleTriangleDiffusion({mesh:createConvexTriangleMesh({outline:r.outline,subdivisions:r.subdivisions}),k:15,depth:.03,rho:1000,cp:1000})}))));
"""
 rows=json.loads(subprocess.run(['node','--input-type=module','-e',driver],cwd=ROOT,capture_output=True,text=True,check=True).stdout);results=[]
 for row in rows:
  op=row['operator'];m=op['mesh'];n=len(m['nodes']);K=np.zeros((n,n));C=np.zeros(n);coordinates=np.array([v['point'] for v in m['nodes']]);areas=[]
  for element in m['elements']:
   ids=element['nodes'];p=coordinates[ids];twice=(p[1,0]-p[0,0])*(p[2,1]-p[0,1])-(p[1,1]-p[0,1])*(p[2,0]-p[0,0]);assert twice>0
   area=twice/2;areas.append(area)
   gradients=np.array([[p[(i+1)%3,1]-p[(i+2)%3,1],p[(i+2)%3,0]-p[(i+1)%3,0]] for i in range(3)])/twice
   local=15*.03*area*gradients@gradients.T
   for i,a in enumerate(ids):
    C[a]+=1e6*.03*area/3
    for j,b in enumerate(ids):K[a,b]+=local[i,j]
  actual=np.array(op['fullMatrixWPerK']);unknown=op['unknownNodeIds'];U=K[np.ix_(unknown,unknown)];eigen=np.linalg.eigvalsh(U)
  difference=float(np.max(np.abs(actual-K)));capacity_diff=float(np.max(np.abs(np.array(op['lumpedCapacityJPerK'])-C)));assert difference<2e-12;assert capacity_diff<2e-10;assert eigen[0]>0
  theta=7*coordinates[:,0]-3*coordinates[:,1];dirichlet_energy=float(theta@K@theta);exact_energy=15*.03*sum(areas)*(7**2+3**2);assert abs(dirichlet_energy-exact_energy)<2e-11
  unknown_residual=float(np.max(np.abs((K@theta)[unknown])));assert unknown_residual<1e-12
  results.append({'id':row['id'],'outline':row['outline'],'subdivisions':row['subdivisions'],'nodeCount':n,'unknownCount':len(unknown),'maxCoefficientDifferenceWPerK':difference,'maxLumpedCapacityDifferenceJPerK':capacity_diff,'minimumUnknownEigenvalueWPerK':float(eigen[0]),'maximumUnknownEigenvalueWPerK':float(eigen[-1]),'unknownCondition2':float(eigen[-1]/eigen[0]),'affineUnknownResidualW':unknown_residual,'affineDirichletQuadraticFormWK':dirichlet_energy,'analyticAffineDirichletQuadraticFormWK':exact_energy,'totalPhysicalElementAreaM2':sum(areas),'productionDiagnostics':op['diagnostics'],'referenceFullMatrixWPerK':K.tolist(),'referenceLumpedCapacityJPerK':C.tolist(),'unknownNodeIds':unknown})
 result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'recordedClientDate':'2026-11-06 Asia/Tokyo','generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sourceFilesSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['dynamic/dev/dyadic-quotient.mjs','dynamic/dev/planar-predicates.mjs','dynamic/dev/triangle-stiffness.mjs']},'rows':results,'referenceScope':'Independent physical-coordinate element gradients K_e=k D A grad(N_i).grad(N_j), lumped integrals, symmetric eigenvalues and affine harmonic/quadratic-form identities. The WK quadratic form is not stored thermal energy in J. These finite operators do not validate temporal integration or a general mesh guarantee.','releaseApproved':False}
 (ROOT/'docs/dynamic/TRIANGLE_STIFFNESS_REFERENCE_20261106.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
 print(json.dumps({'rows':[{k:v for k,v in r.items() if k not in ['referenceFullMatrixWPerK','referenceLumpedCapacityJPerK','outline','unknownNodeIds']} for r in results]},indent=2))
if __name__=='__main__':main()
