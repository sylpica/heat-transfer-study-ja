#!/usr/bin/env python3
"""Independent exact-rational geometry and physical-coordinate P1 operator."""
import os
for name in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']:os.environ[name]='1'
from pathlib import Path
from fractions import Fraction as F
from datetime import datetime,timezone
import json,math,hashlib,subprocess,platform
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
ACTUAL=r"""
import {createBoundaryRefinedTriangleMesh} from './dynamic/dev/boundary-refined-triangle-mesh.mjs';import {assembleTriangleDiffusion} from './dynamic/dev/triangle-stiffness.mjs';const c=Math.cos(.37),s=Math.sin(.37),shapes={rectangle:[[0,0],[2,0],[2,1],[0,1]],rotated:[[-.2,-.1],[.2,-.1],[.2,.1],[-.2,.1]].map(([x,y])=>[.53+c*x-s*y,.47+s*x+c*y]),triangle:[[0,0],[1,0],[.5,Math.sqrt(3)/2]],pentagon:Array.from({length:5},(_,i)=>[.5+.4*Math.cos(.173+2*Math.PI*i/5),.5+.4*Math.sin(.173+2*Math.PI*i/5)]),quadrilateral:[[.1,.2],[1.7,.3],[1.5,1.4],[0,1.1]],octagon:Array.from({length:8},(_,i)=>[.5+.4*Math.cos(.173+2*Math.PI*i/8),.5+.4*Math.sin(.173+2*Math.PI*i/8)])};console.log(JSON.stringify(Object.entries(shapes).flatMap(([name,outline])=>[1,2,4,8].map(subdivisions=>{const mesh=createBoundaryRefinedTriangleMesh({outline,subdivisions}),op=assembleTriangleDiffusion({mesh,k:15,depth:.03,rho:1000,cp:1000});return {name,outline,subdivisions,mesh,operator:{matrix:op.fullMatrixWPerK,capacity:op.lumpedCapacityJPerK,conductance:op.edges.map(e=>e.conductanceWPerK)}}}))));
"""
EPS=np.finfo(float).eps
CRITERIA={'areaRelativeBudget':4096*EPS,'boundaryLengthRelativeBudget':4096*EPS,'normalMomentRelativeBudget':4096*EPS,'matrixRelativeRoundoffBudget':512*EPS,'capacityRelativeRoundoffBudget':512*EPS,'affineEnergyRelativeBudget':4096*EPS}
def cross(a,b):return a[0]*b[1]-a[1]*b[0]
def sub(a,b):return [a[i]-b[i] for i in [0,1]]
def orientation(a,b,c):return cross(sub(b,a),sub(c,a))
def incircle(a,b,c,d):
 a,b,c=sub(a,d),sub(b,d),sub(c,d);return (a[0]**2+a[1]**2)*cross(b,c)-(b[0]**2+b[1]**2)*cross(a,c)+(c[0]**2+c[1]**2)*cross(a,b)
def polygon_area(points):return sum(cross(p,points[(i+1)%len(points)]) for i,p in enumerate(points))/2

def main():
 actual=json.loads(subprocess.run(['node','--input-type=module','-e',ACTUAL],cwd=ROOT,capture_output=True,text=True,check=True).stdout);rows=[]
 for row in actual:
  m=row['mesh'];p=np.array([n['point'] for n in m['nodes']]);q=[[F(x) for x in n['normalized']] for n in m['nodes']];physical=[[F(x) for x in n['point']] for n in m['nodes']];N=len(p);matrix=np.zeros((N,N));capacity=np.zeros(N);edge_map={};area_fraction=F(0)
  for i,t in enumerate(m['elements']):
   ids=t['nodes'];v=p[ids];twice=orientation(*[physical[j] for j in ids]);assert twice>0;area_fraction+=twice/2;area=float(twice)/2;assert orientation(*[q[j] for j in ids])>0;basis=np.array([[v[(j+1)%3,1]-v[(j+2)%3,1],v[(j+2)%3,0]-v[(j+1)%3,0]] for j in range(3)])/(2*area);local=15*.03*area*basis@basis.T
   for a,j in enumerate(ids):
    capacity[j]+=1e6*.03*area/3
    for b,k in enumerate(ids):matrix[j,k]+=local[a,b]
    key=tuple(sorted((j,ids[(a+1)%3])));edge_map.setdefault(key,[]).append((j,ids[(a+1)%3],ids[(a+2)%3]))
  assert len(edge_map)==len(m['edges']);assert N-len(edge_map)+len(m['elements'])==1;assert len(set(tuple(v) for v in p))==N
  source_points=[[F(x) for x in a] for a in row['outline']];expected_area=float(polygon_area(source_points));assert expected_area>0;actual_area=float(area_fraction);area_relative=abs(actual_area/expected_area-1);assert area_relative<=CRITERIA['areaRelativeBudget']
  normals=np.zeros(2);moments=np.zeros((2,2));lengths=np.zeros(len(row['outline']));internal_checked=boundary_checked=0;line_residual=0.
  for e in m['edges']:
   key=tuple(sorted(e['nodes']));adj=edge_map[key];assert len(adj)==(1 if e['boundary'] else 2)
   if len(adj)==2:
    a,b,c=adj[0];d=adj[1][2];assert incircle(q[a],q[b],q[c],q[d])<=0;internal_checked+=1
   else:
    a,b,c=adj[0];u=sub(q[c],q[a]);v=sub(q[c],q[b]);assert u[0]*v[0]+u[1]*v[1]>=0;boundary_checked+=1;delta=p[b]-p[a];normal_integral=np.array([delta[1],-delta[0]]);normals+=normal_integral;mid=(p[a]+p[b])/2;moments+=np.outer(mid,normal_integral);face=e['outlineEdge'];lengths[face]+=np.linalg.norm(delta)
    for j in [a,b]:
     start=np.array(row['outline'][face]);end=np.array(row['outline'][(face+1)%len(row['outline'])]);edge=end-start;line_residual=max(line_residual,abs(edge[0]*(p[j,1]-start[1])-edge[1]*(p[j,0]-start[0]))/np.linalg.norm(edge))
  source=np.array(row['outline']);expected_lengths=np.array([np.linalg.norm(source[(i+1)%len(source)]-x) for i,x in enumerate(source)]);length_relative=float(np.max(np.abs(lengths/expected_lengths-1)));moment_relative=float(np.max(np.abs(moments-expected_area*np.eye(2)))/expected_area);normal_relative=float(np.max(np.abs(normals))/sum(expected_lengths));assert length_relative<CRITERIA['boundaryLengthRelativeBudget'];assert moment_relative<CRITERIA['normalMomentRelativeBudget'];assert normal_relative<CRITERIA['normalMomentRelativeBudget']
  production=np.array(row['operator']['matrix']);prod_capacity=np.array(row['operator']['capacity']);scale=float(np.max(np.abs(matrix)));matrix_relative=float(np.max(np.abs(matrix-production))/scale);capacity_relative=float(np.max(np.abs(capacity-prod_capacity))/np.max(np.abs(capacity)));assert matrix_relative<CRITERIA['matrixRelativeRoundoffBudget'];assert capacity_relative<CRITERIA['capacityRelativeRoundoffBudget'];offdiag=matrix.copy();np.fill_diagonal(offdiag,0);max_positive=float(np.max(offdiag));assert max_positive<=CRITERIA['matrixRelativeRoundoffBudget']*scale;assert min(row['operator']['conductance'])>=0
  affine=7*p[:,0]-3*p[:,1];energy=sum(g*(affine[e['nodes'][0]]-affine[e['nodes'][1]])**2 for g,e in zip(row['operator']['conductance'],m['edges']));expected_energy=15*.03*58*expected_area;energy_relative=abs(energy/expected_energy-1);assert energy_relative<CRITERIA['affineEnergyRelativeBudget'];eigen=np.linalg.eigvalsh((matrix+matrix.T)/2);assert eigen[1]>0;assert abs(eigen[0])<CRITERIA['matrixRelativeRoundoffBudget']*scale
  rows.append({'name':row['name'],'outline':row['outline'],'subdivisions':row['subdivisions'],'nodeCount':N,'triangleCount':len(m['elements']),'edgeCount':len(m['edges']),'refinement':m['numerics']['boundaryRefinement'],'exactRationalInternalDelaunayEdges':internal_checked,'exactRationalNonnegativeBoundaryDotEdges':boundary_checked,'sourcePolygonArea':expected_area,'exactRationalPhysicalTriangleArea':actual_area,'areaRelativeError':area_relative,'boundaryLengthRelativeError':length_relative,'boundaryNormalRelativeResidual':normal_relative,'boundaryMomentRelativeError':moment_relative,'maximumPhysicalBoundaryLineResidualM':line_residual,'independentMatrixRelativeDifference':matrix_relative,'independentCapacityRelativeDifference':capacity_relative,'independentPhysicalOffDiagonalMaximumWPerK':max_positive,'minimumProductionConductanceWPerK':min(row['operator']['conductance']),'affineQuadraticFormWK':energy,'affineEnergyRelativeError':energy_relative,'independentFullNeumannSmallestEigenvalueWPerK':float(eigen[0]),'independentFullNeumannSecondEigenvalueWPerK':float(eigen[1]),'maximumConstantModeResidualWPerK':float(np.max(np.abs(production@np.ones(N))))})
 result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceTreeDirty':True,'generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'productionSHA256':hashlib.sha256((ROOT/'dynamic/dev/boundary-refined-triangle-mesh.mjs').read_bytes()).hexdigest(),'criteriaDeclaredAtCommit':'f5b9afb','criteria':CRITERIA,'environment':{'python':platform.python_version(),'numpy':np.__version__,'BLASThreads':1},'method':'Fraction arithmetic on all rounded normalized coordinates checks every internal incircle and boundary dot. Fraction physical triangle/polygon areas, independent boundary normals/moments, and physical-coordinate element-gradient full P1 K/C. Production predicates/cotangent/operator do not generate target matrix/area values.','rows':rows,'geometryAndOperatorOnly':True,'temperaturePDEImplemented':False,'generalTerminationProved':False,'releaseApproved':False}
 (ROOT/'docs/dynamic/BOUNDARY_REFINED_MESH_REFERENCE_20261106.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n');print(json.dumps({'cases':len(rows),'maxAreaRelative':max(r['areaRelativeError'] for r in rows),'maxMatrixRelative':max(r['independentMatrixRelativeDifference'] for r in rows),'maxCapacityRelative':max(r['independentCapacityRelativeDifference'] for r in rows),'maxBoundaryMomentRelative':max(r['boundaryMomentRelativeError'] for r in rows),'maxPhysicalLineResidualM':max(r['maximumPhysicalBoundaryLineResidualM'] for r in rows),'maxAffineRelative':max(r['affineEnergyRelativeError'] for r in rows),'allExactSignsPassed':True,'releaseApproved':False},indent=2))
if __name__=='__main__':main()
