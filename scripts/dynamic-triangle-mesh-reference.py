#!/usr/bin/env python3
"""Exact-rational signs for actual mesh edges and analytic polygon measures.
Only validation: no production triangulation, temperature or time integration.
"""
from fractions import Fraction as F
from datetime import datetime, timezone
from pathlib import Path
import hashlib,json,math,os,subprocess,random
for key in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']:os.environ[key]='1'
import numpy as np
from scipy.spatial import ConvexHull
ROOT=Path(__file__).resolve().parents[1]

def rational(p):return [F.from_float(x) for x in p]
def cross(a,b):return a[0]*b[1]-a[1]*b[0]
def subtract(a,b):return [a[0]-b[0],a[1]-b[1]]
def incircle(a,b,c,d):
 a,b,c=[subtract(p,d) for p in [a,b,c]]
 lift=lambda p:p[0]*p[0]+p[1]*p[1]
 return lift(a)*cross(b,c)-lift(b)*cross(a,c)+lift(c)*cross(a,b)

def main():
 source=r"""
import {createConvexTriangleMesh} from './dynamic/dev/convex-triangle-mesh.mjs';
const c=Math.cos(.37),s=Math.sin(.37),rectangle=[[-.2,-.1],[.2,-.1],[.2,.1],[-.2,.1]].map(([x,y])=>[.53+x*c-y*s,.47+x*s+y*c]);const regular=n=>Array.from({length:n},(_,i)=>[.5+.31*Math.cos(.173+2*Math.PI*i/n),.5+.31*Math.sin(.173+2*Math.PI*i/n)]);
console.log(JSON.stringify([1,2,4,8].map(subdivisions=>({id:'rotated-rectangle',subdivisions,mesh:createConvexTriangleMesh({outline:rectangle,subdivisions})})).concat([3,5,8].map(sides=>({id:'regular-'+sides,subdivisions:4,mesh:createConvexTriangleMesh({outline:regular(sides),subdivisions:4})})))));
"""
 meshes=json.loads(subprocess.run(['node','--input-type=module','-e',source],cwd=ROOT,capture_output=True,text=True,check=True).stdout);results=[]
 for row in meshes:
  m=row['mesh'];p=[rational(v['normalized']) for v in m['nodes']];physical=[rational(v['point']) for v in m['nodes']];area=F(0);local_checked=0;zeros=0;minimum=None
  for t in m['elements']:
   a,b,c=[p[i] for i in t['nodes']];twice=cross(subtract(b,a),subtract(c,a));assert twice>0
   a,b,c=[physical[i] for i in t['nodes']];area+=cross(subtract(b,a),subtract(c,a))/2
  for e in m['edges']:
   if e['boundary']:continue
   a,b=e['nodes'];c,d=e['oppositeNodes'];value=incircle(p[a],p[b],p[c],p[d]);assert value<=0;zeros+=value==0;local_checked+=1
   if minimum is None or value<minimum:minimum=value
  hull=ConvexHull(np.array([v['point'] for v in m['nodes']]))
  analytic=.08 if row['id']=='rotated-rectangle' else int(row['id'].split('-')[1])*.31**2*math.sin(2*math.pi/int(row['id'].split('-')[1]))/2
  assert abs(float(area)-analytic)<1e-13
  assert abs(hull.volume-float(area))<1e-13
  results.append({'id':row['id'],'subdivisions':row['subdivisions'],'outline':m['outline'],'nodeCount':len(p),'triangleCount':len(m['elements']),'boundaryNodeCount':sum(v['boundary'] for v in m['nodes']),'exactRationalPhysicalTriangleArea':float(area),'analyticArea':analytic,'scipyConvexHullArea':float(hull.volume),'localEdgesCheckedWithFraction':local_checked,'exactlyCocircularInternalEdges':zeros,'allLocalDelaunaySignsNonpositive':True,'sourceNumerics':m['numerics']})
 randomizer=random.Random(6149);predicate_cases=[]
 for i in range(64):
  common=randomizer.choice([-100,-10,0,10,100])
  def coordinate():
   exponent=randomizer.choice([-1074,-1022,-600,-200,-1,0,200,600,1023]) if i<32 else common
   return randomizer.choice([-1,1])*math.ldexp(randomizer.uniform(1,2),exponent) if randomizer.random()>.15 else 0.0
  points=[[coordinate(),coordinate()] for j in range(4)];a,b,c,d=map(rational,points);o=cross(subtract(a,c),subtract(b,c));v=incircle(a,b,c,d);predicate_cases.append({'points':points,'orientationSign':(o>0)-(o<0),'incircleSign':(v>0)-(v<0)})
 predicate_driver="import {readFileSync} from 'node:fs';import {orientation2D,inCircle2D} from './dynamic/dev/planar-predicates.mjs';console.log(JSON.stringify(JSON.parse(readFileSync(0)).map(r=>({orientationSign:orientation2D(...r.points.slice(0,3)).sign,incircleSign:inCircle2D(...r.points).sign}))));"
 actual=json.loads(subprocess.run(['node','--input-type=module','-e',predicate_driver],cwd=ROOT,input=json.dumps(predicate_cases),capture_output=True,text=True,check=True).stdout)
 for exact,observed in zip(predicate_cases,actual):assert all(exact[key]==observed[key] for key in ['orientationSign','incircleSign'])
 output={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'recordedClientDate':'2026-11-06 Asia/Tokyo','generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sourceFilesSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in ['dynamic/dev/planar-predicates.mjs','dynamic/dev/convex-triangle-mesh.mjs']},'rows':results,'predicateCases':predicate_cases,'referenceScope':'Fraction checks each final internal-edge incircle and all element orientations on the actual exported normalized doubles; exact physical triangle areas and analytic polygon areas; independent SciPy convex hull area. This does not require identical Delaunay diagonals in cocircular cases or verify FEM coefficients/PDE/time accuracy.','releaseApproved':False}
 (ROOT/'docs/dynamic/TRIANGLE_MESH_REFERENCE_20261106.json').write_text(json.dumps(output,indent=2,allow_nan=False)+'\n')
 print(json.dumps({'results':results},indent=2))
if __name__=='__main__':main()
