import test from 'node:test';import assert from 'node:assert/strict';import {orientation2D,inCircle2D} from '../dynamic/dev/planar-predicates.mjs';
test('filtered orientation handles exact zero, subnormal determinant and overflowing intermediates without changing the supplied doubles',()=>{
 for(const scale of [Number.MIN_VALUE,1e-150,1,1e150,1e308]){const a=[0,0],b=[scale,0],c=[0,scale],before=structuredClone([a,b,c]);assert.equal(orientation2D(a,b,c).sign,1);assert.equal(orientation2D(a,c,b).sign,-1);assert.deepEqual([a,b,c],before);}
 assert.deepEqual(orientation2D([0,0],[1,1],[2,2]),{sign:0,exactFallback:true});assert.equal(orientation2D([0,0],[Number.MIN_VALUE,0],[0,Number.MIN_VALUE]).exactFallback,true);assert.equal(orientation2D([1e308,1e308],[-1e308,1e308],[0,-1e308]).sign,1);assert.throws(()=>orientation2D([NaN,0],[1,0],[0,1]));
});
test('incircle signs distinguish exact cocircular ties from interior and exterior points through underflow/overflow scales',()=>{
 for(const scale of [2*Number.MIN_VALUE,1e-150,1,1e150]){const a=[0,0],b=[scale,0],c=[scale,scale],d=[0,scale];assert.deepEqual(inCircle2D(a,b,c,d),{sign:0,exactFallback:true});const center=[scale/2,scale/2];assert.equal(inCircle2D(a,b,c,center).sign,1);assert.equal(inCircle2D(a,c,b,center).sign,-1);assert.equal(inCircle2D(a,b,c,[2*scale,2*scale]).sign,-1);}
 assert.equal(inCircle2D([-Number.MAX_VALUE,0],[Number.MAX_VALUE,0],[0,Number.MAX_VALUE],[0,0]).sign,1);assert.throws(()=>inCircle2D([0,0],[1,0],[0,1],[Infinity,0]));
});

test('independent Fraction reference signs match 64 deterministic common-scale and full IEEE mixed-scale point sets',async()=>{
 const {readFileSync}=await import('node:fs'),r=JSON.parse(readFileSync(new URL('../docs/dynamic/TRIANGLE_MESH_REFERENCE_20261106.json',import.meta.url)));assert.equal(r.predicateCases.length,64);for(const c of r.predicateCases){assert.equal(orientation2D(...c.points.slice(0,3)).sign,c.orientationSign);assert.equal(inCircle2D(...c.points).sign,c.incircleSign);}
});
