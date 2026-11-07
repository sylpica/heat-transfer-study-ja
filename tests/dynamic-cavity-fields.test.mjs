import test from 'node:test';import assert from 'node:assert/strict';
import {createMacVelocityField,traceFrozenStreamline} from '../dynamic/dev/cavity-fields.mjs';
const mesh={nx:16,ny:24,width:2,height:3};
function sampled(fn,m=mesh){return {u:Array.from({length:(m.nx+1)*m.ny},(_,k)=>fn((k%(m.nx+1))/m.nx*m.width,(Math.floor(k/(m.nx+1))+.5)/m.ny*m.height)[0]),v:Array.from({length:m.nx*(m.ny+1)},(_,k)=>fn((k%m.nx+.5)/m.nx*m.width,Math.floor(k/m.nx)/m.ny*m.height)[1])};}
test('staggered interpolation reproduces a linear vector field in the interior on a rectangular grid',()=>{
 const analytic=(x,y)=>[.3+2*x-3*y,-.2+4*x+5*y],state=sampled(analytic),field=createMacVelocityField(mesh,state);
 for(const [x,y]of [[.2,.3],[.777,1.233],[1.75,2.7]]){const actual=field.at(x,y),expected=analytic(x,y);for(let k=0;k<2;k++)assert.ok(Math.abs(actual[k]-expected[k])<1e-13);}
 const before=field.at(.777,1.233);state.u.fill(NaN);state.v.fill(0);assert.deepEqual(field.at(.777,1.233),before);
});
test('wall interpolation uses the actual tangential value and preserves closed normal walls',()=>{
 const state=sampled(()=>[0,0]),field=createMacVelocityField(mesh,state,{lidVelocity:2});
 assert.deepEqual(field.at(1,3),[2,0]);assert.deepEqual(field.at(1,3-mesh.height/mesh.ny/4),[1,0]);
 for(const y of [.1,1,2.99])assert.deepEqual(field.at(0,y),[0,0]);assert.deepEqual(field.at(2,2.99),[0,0]);
 assert.throws(()=>field.at(0,3),/一意/);assert.throws(()=>field.at(2,3),/一意/);
 assert.throws(()=>field.at(-1,1));assert.throws(()=>field.at(NaN,1));assert.throws(()=>createMacVelocityField(mesh,{...state,v:[NaN]}));
});
test('instantaneous streamlines follow an analytic circle with arclength refinement, not fake particle time',()=>{
 const m={nx:32,ny:32,width:1,height:1},state=sampled((x,y)=>[-(y-.5),x-.5],m),field=createMacVelocityField(m,state),radius=.2,seed=[.7,.5],errors=[];
 for(const stepLength of [.04,.02,.01]){
  const line=traceFrozenStreamline(field,seed,{stepLength,maxLength:1.1,maxPoints:1000});
  const last=line.points.at(-1);errors.push(Math.abs(Math.hypot(last[0]-.5,last[1]-.5)-radius));
  assert.ok(line.length<=1.1+1e-12);assert.equal(line.stopped,'length-limit');assert.match(line.interpretation,/not a particle path/);
  assert.ok(line.points.every(([x,y])=>x>=0&&x<=1&&y>=0&&y<=1));
 }
 assert.ok(errors[0]/errors[1]>15);assert.ok(errors[1]/errors[2]>15);
 const forward=traceFrozenStreamline(field,seed,{stepLength:.01,maxLength:.1}),back=traceFrozenStreamline(field,seed,{direction:-1,stepLength:.01,maxLength:.1});assert.ok(forward.points[1][1]>.5);assert.ok(back.points[1][1]<.5);
});
test('streamlines stop at stagnation, before exiting the domain, on a closed line, or at a bounded point count',()=>{
 const zero=createMacVelocityField(mesh,sampled(()=>[0,0])),stationary=traceFrozenStreamline(zero,[1,1]);assert.equal(stationary.stopped,'stagnation');assert.equal(stationary.points.length,1);
 const straight=createMacVelocityField(mesh,sampled(()=>[1,0])),out=traceFrozenStreamline(straight,[1,1],{stepLength:.03});assert.equal(out.stopped,'boundary');assert.ok(out.points.every(([x,y])=>x>=0&&x<=2&&y>=0&&y<=3));
 const bounded=traceFrozenStreamline(straight,[1,1],{maxPoints:3});assert.equal(bounded.stopped,'point-limit');assert.equal(bounded.points.length,3);
 const m={nx:32,ny:32,width:1,height:1},rotation=createMacVelocityField(m,sampled((x,y)=>[-(y-.5),x-.5],m)),closed=traceFrozenStreamline(rotation,[.7,.5]);assert.equal(closed.stopped,'closed');assert.ok(closed.length>1.2&&closed.length<1.3);
 assert.throws(()=>traceFrozenStreamline(straight,[1,1],{stepLength:NaN}));assert.throws(()=>traceFrozenStreamline(straight,[1,1],{maxPoints:5001}));assert.throws(()=>traceFrozenStreamline(straight,[-1,1]));
});
