import test from 'node:test';import assert from 'node:assert/strict';import {createConvexOutlineDraft,outlineDraftBounds} from '../dynamic/dev/convex-outline-draft.mjs';
const square=()=>[[0,0],[1,0],[1,1],[0,1]],area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2);
test('convex vertex moves are atomic and detached from accepted physics, with independently checked polygon area',()=>{
 const input=square(),before=structuredClone(input),draft=createConvexOutlineDraft(input);draft.move(1,[1.2,-.1]);assert.deepEqual(input,before);assert.equal(draft.selected,1);assert.ok(Math.abs(draft.area-area(draft.outline))<1e-14);const good=draft.outline,goodArea=draft.area;good[0][0]=999;assert.equal(draft.outline[0][0],0);
 for(const point of [[0,1],[.1,.9],[NaN,0],[Infinity,0],[11,0],[0]]){const state=draft.outline;assert.throws(()=>draft.move(1,point));assert.deepEqual(draft.outline,state);assert.equal(draft.area,goodArea);assert.equal(draft.selected,1);}
 assert.throws(()=>draft.move(99,[1,0]));assert.throws(()=>draft.select(-1));
});
test('edge insertion explicitly changes area and vertex count, removal preserves a valid polygon, and limits do not silently repair geometry',()=>{
 const draft=createConvexOutlineDraft(square());draft.insertAfter(0);assert.equal(draft.outline.length,5);assert.deepEqual(draft.outline[1],[.5,-.05]);assert.ok(Math.abs(draft.area-1.025)<1e-14);draft.remove(1);assert.deepEqual(draft.outline,square());draft.remove(0);assert.equal(draft.outline.length,3);const before=draft.outline;assert.throws(()=>draft.remove(0));assert.deepEqual(draft.outline,before);
 const regular=Array.from({length:12},(_,i)=>[Math.cos(2*Math.PI*i/12),Math.sin(2*Math.PI*i/12)]),max=createConvexOutlineDraft(regular);assert.throws(()=>max.insertAfter(0));assert.deepEqual(max.outline,regular);
 for(const p of [square().toReversed(),[[0,0],[1,0],[1,0],[0,1]],[[0,0],[1,1],[0,1],[1,0]],[[0,0],[.5,0],[1,0],[0,1]]])assert.throws(()=>createConvexOutlineDraft(p));
});
test('draft view bounds are explicit and refittable rather than a mutation of physical coordinates',()=>{
 const p=square(),before=structuredClone(p),bounds=outlineDraftBounds(p);assert.deepEqual(bounds,[-.3,-.3,1.3,1.3]);assert.deepEqual(p,before);const draft=createConvexOutlineDraft(p);draft.move(1,[2,0]);assert.deepEqual(bounds,[-.3,-.3,1.3,1.3]);assert.ok(outlineDraftBounds(draft.outline)[2]>2);
});
