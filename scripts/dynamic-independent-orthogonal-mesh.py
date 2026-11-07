#!/usr/bin/env python3
"""Fraction checks on actual physical IEEE coordinates, not product predicates.
Verifies geometry only, not P1 coefficients or a time-dependent temperature.
"""
from pathlib import Path
from fractions import Fraction as F
from datetime import datetime,timezone
from collections import defaultdict
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[1]

def point(p):return tuple(F(v) for v in p)
def orient(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def inside(p,outline):
    x,y=p;w=0
    for a,b in zip(outline,outline[1:]+outline[:1]):
        if a[1]<=y<b[1] and orient(a,b,p)>0:w+=1
        elif b[1]<=y<a[1] and orient(a,b,p)<0:w-=1
    return w!=0

def main():
    out=ROOT/'docs/dynamic/ORTHOGONAL_MESH_REFERENCE_20261107_v1.json';assert not out.exists(),'Protect saved result.'
    own=json.loads(subprocess.check_output(['node','scripts/dynamic-orthogonal-mesh-cases.mjs'],cwd=ROOT,text=True));rows=[]
    for entry in own['cases']:
        m=entry['mesh'];p=[point(n['point']) for n in m['nodes']];outline=[point(v) for v in m['outline']];edges=defaultdict(list);areas=[];minimum_circle=0;boundary_length=[F(0) for _ in outline];maximum_area_reconstruction=F(0)
        assert len(set(p))==len(p)
        for t in m['elements']:
            ids=t['nodes'];a,b,c=[p[i] for i in ids];twice=orient(a,b,c);assert twice>0
            area=twice/2;areas.append(area);maximum_area_reconstruction=max(maximum_area_reconstruction,abs(F(t['area'])/area-1));assert inside(tuple((a[k]+b[k]+c[k])/3 for k in range(2)),outline)
            for i in range(3):edges[tuple(sorted([ids[i],ids[(i+1)%3]]))].append((ids[i],ids[(i+1)%3],ids[(i+2)%3]))
        polygon=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(outline,outline[1:]+outline[:1]))/2
        assert sum(areas)==polygon and polygon>0;assert len(p)-len(edges)+len(areas)==1
        registered={tuple(sorted(e['nodes'])):e for e in m['edges']};assert set(edges)==set(registered)
        boundary_count=0;interior_count=0;cocircular=0
        for edge,incident in edges.items():
            r=registered[edge];assert len(incident)==(1 if r['boundary'] else 2)
            a,b,c=[p[i] for i in incident[0]]
            if len(incident)==1:
                boundary_count+=1;face=r['outlineEdge'];u,v=outline[face],outline[(face+1)%len(outline)];assert orient(u,v,a)==orient(u,v,b)==0
                for t in [a,b]:assert all(min(u[k],v[k])<=t[k]<=max(u[k],v[k]) for k in range(2))
                # Axis-aligned length: no rounded sqrt reference.
                boundary_length[face]+=abs(a[0]-b[0])+abs(a[1]-b[1]);dot=sum((a[k]-c[k])*(b[k]-c[k]) for k in range(2));assert dot>=0
            else:
                interior_count+=1;d=p[incident[1][2]];u,v,w=[(a[0]-d[0],a[1]-d[1]),(b[0]-d[0],b[1]-d[1]),(c[0]-d[0],c[1]-d[1])];lift=lambda q:q[0]*q[0]+q[1]*q[1];cross=lambda q,r:q[0]*r[1]-q[1]*r[0];det=lift(u)*cross(v,w)-lift(v)*cross(u,w)+lift(w)*cross(u,v);assert det<=0
                if det==0:cocircular+=1
                minimum_circle=min(minimum_circle,det)
        for i,(a,b) in enumerate(zip(outline,outline[1:]+outline[:1])):assert boundary_length[i]==abs(a[0]-b[0])+abs(a[1]-b[1])
        assert all(v in set(p) for v in outline);assert maximum_area_reconstruction<=F(4096)*F(2)**-52
        rows.append({'id':entry['id'],'nodes':len(p),'elements':len(areas),'boundaryEdges':boundary_count,'interiorEdges':interior_count,'exactlyCocircularInteriorEdges':cocircular,'physicalPolygonAreaAsFraction':str(polygon),'physicalElementSumAreaExactlyEqualsPolygon':True,'allTriangleCentroidsInside':True,'exactPositivePhysicalOrientations':True,'exactBoundaryCoverage':True,'exactBoundaryCotangentsNonnegative':True,'exactInteriorDelaunaySigns':True,'maximumReportedAreaRelativeDifference':float(maximum_area_reconstruction),'eulerDiskCharacteristic':1})
    result={'generatedAtUTC':datetime.now(timezone.utc).isoformat(),'criteriaDeclaredAtCommit':'6649c89','sourceFilesSHA256':own['sourceFilesSHA256'],'independentGeneratorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'method':'Separate Python Fraction on exact binary values of returned physical coordinates. Exact polygon and element areas, winding centroid inclusion, boundary coverage, cotangent dot signs and interior incircle determinant; no product predicates imported.','cases':rows,'caseCount':len(rows),'allChecksPassed':True,'stiffnessVerified':False,'temperaturePDEVerified':False,'temporalStabilityVerified':False,'GUIVerified':False,'generalFreeShapeApproved':False,'releaseApproved':False}
    payload=json.dumps(result,indent=2)+'\n'
    with out.open('x') as f:f.write(payload)
    print(json.dumps({'output':str(out),'caseCount':len(rows),'allChecksPassed':True}))
if __name__=='__main__':main()
