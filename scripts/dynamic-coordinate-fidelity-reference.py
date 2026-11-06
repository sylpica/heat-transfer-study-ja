#!/usr/bin/env python3
"""Exact physical area audit for the accepted/rejected coordinate regression battery."""
from pathlib import Path
from fractions import Fraction as F
from datetime import datetime,timezone
import json,subprocess,hashlib,sys
ROOT=Path(__file__).resolve().parents[1]
LABEL=sys.argv[1] if len(sys.argv)>1 else 'after'
assert LABEL in ['before','after']
CODE="""
import {createConvexTriangleMesh} from './dynamic/dev/convex-triangle-mesh.mjs';import {createBoundaryRefinedTriangleMesh} from './dynamic/dev/boundary-refined-triangle-mesh.mjs';
const box=(x,L,H=L)=>[[x,x],[x+L,x],[x+L,x+H],[x,x+H]],cases=[];for(const x of [1e12,1e14,1e15])for(const n of [3,5,10])cases.push({name:`quantized-${x}-${n}`,expected:'rejected',outline:box(x,4),subdivisions:n});for(const [x,L,n] of [[1e9,1,4],[1e15,4,16],[2**53,64,4],[3e15,3,3],[0,1e-12,4]])cases.push({name:`retained-${x}-${L}-${n}`,expected:'accepted',outline:box(x,L),subdivisions:n});cases.push({name:'slender',expected:'accepted',outline:[[0,0],[1,0],[.4,1e-9]],subdivisions:4},{name:'refined-binary-large-translation',expected:'accepted',outline:box(1e15,4,2),subdivisions:4,refined:true});console.log(JSON.stringify(cases.map(({name,expected,refined,...input})=>{try{return {name,expected,input,mesh:(refined?createBoundaryRefinedTriangleMesh:createConvexTriangleMesh)(input)};}catch(e){return {name,expected,input,rejected:true,message:e.message};}})));
"""
data=json.loads(subprocess.check_output(['node','--input-type=module','-e',CODE],cwd=ROOT,text=True))
rows=[]
for row in data:
 m=row.pop('mesh',None)
 if m:
  errors=[]
  for e in m['elements']:
   a,b,c=[[F(x) for x in m['nodes'][i]['point']] for i in e['nodes']]
   area=((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2
   assert area>0
   errors.append(float(abs(area-F(e['area']))/area))
  row.update(rejected=False,nodeCount=len(m['nodes']),triangleCount=len(m['elements']),maximumExactPhysicalAreaRelativeError=max(errors),reportedCoordinateReconstructionNormalizedError=m['numerics']['maximumPhysicalCoordinateReconstructionNormalizedError'],reportedPhysicalElementAreaRelativeError=m['numerics'].get('maximumPhysicalElementAreaRelativeError'))
 rows.append(row)
result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'label':LABEL,'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'sourceTreeDirty':True,'sourceFilesSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['dynamic/dev/convex-triangle-mesh.mjs','dynamic/dev/boundary-refined-triangle-mesh.mjs']},'generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'method':'Exact Fraction physical determinant evaluated on every supplied IEEE node, compared with reported normalized P1 area. No production predicate, cotangent, topology test or approximate determinant generates the area oracle.','rows':rows,'generalAccuracyVerified':False,'releaseApproved':False}
(ROOT/f'docs/dynamic/COORDINATE_FIDELITY_{LABEL.upper()}_20261106.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps([{k:v for k,v in r.items() if k!='input'} for r in rows],ensure_ascii=False,indent=2))
if LABEL=='after':
 assert all(r['rejected']==(r['expected']=='rejected') for r in rows)
 assert all(r['rejected'] or r['maximumExactPhysicalAreaRelativeError']<4096*2**-52 for r in rows)
