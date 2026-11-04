import test from 'node:test';import assert from 'node:assert/strict';
import {crossSection,temperatureContours} from '../dynamic/field-analysis.mjs';
const mesh=(nx=4,ny=3)=>({nx,ny,width:2,height:1,mask:Array(nx*ny).fill(1)}),near=(a,b,t=1e-12)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('isotherms of an independent affine temperature plane lie on the exact physical lines',()=>{
 const m=mesh(),values=m.mask.map((_,n)=>300+2*(n%m.nx+.5)/m.nx*m.width+3*(Math.floor(n/m.nx)+.5)/m.ny*m.height),lines=temperatureContours(m,values,[302,303,304]);assert.ok(lines.length>0);
 for(const line of lines)for(const [x,y]of[line.from,line.to]){near(300+2*x+3*y,line.level);assert.ok(x>=.25&&x<=1.75&&y>=1/6&&y<=5/6);}
});
test('contours never bridge a void, duplicate a shared edge, or invent lines in uniform and one-dimensional fields',()=>{
 const m=mesh(2,2),values=[0,1,1,0];assert.equal(temperatureContours({...m,mask:[1,1,0,1]},values,[.5]).length,0);assert.deepEqual(temperatureContours(m,[300,300,300,300],[300]),[]);assert.deepEqual(temperatureContours(mesh(4,1),[1,2,3,4],[2]),[]);
 const lines=temperatureContours(m,[0,-1,-1,0],[0]),unique=new Set(lines.map(l=>[l.from.join(','),l.to.join(',')].sort().join(';')));assert.equal(lines.length,unique.size);assert.equal(lines.length,1);
});
test('cross sections report real cell-centre coordinates and gaps on either axis including the final row',()=>{
 const m=mesh(),values=m.mask.map((_,n)=>300+n),x=crossSection(m,values,{axis:'x',fraction:1}),y=crossSection(m,values,{axis:'y',fraction:0});near(x.at,5/6);assert.equal(x.length,2);assert.deepEqual(x.points.map(p=>p.temperature),[308,309,310,311]);assert.deepEqual(x.points.map(p=>p.position),[.25,.75,1.25,1.75]);near(y.at,.25);assert.deepEqual(y.points.map(p=>p.temperature),[300,304,308]);
 const hole=crossSection({...m,mask:m.mask.map((v,n)=>n===5?0:v)},values);assert.equal(hole.points[1].temperature,null);
});
test('field inspection rejects mismatched shapes, invalid positions and nonfinite active data',()=>{
 for(const f of [()=>crossSection(mesh(),[300]),()=>crossSection(mesh(),Array(12).fill(300),{axis:'z'}),()=>crossSection(mesh(),Array(12).fill(300),{fraction:1.1}),()=>temperatureContours(mesh(),Array(12).fill(NaN),[300]),()=>temperatureContours(mesh(),Array(12).fill(300),[Infinity])])assert.throws(f);
});
