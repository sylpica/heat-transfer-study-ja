import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createTransientBrick3d} from '../dynamic/dev/transient-brick-3d.mjs';
import {BRICK_FACES,BRICK_PRESETS,buildBrickInput,sliceField,sliceCell,probeTemperature,cellIndex} from '../dynamic/dev/transient-brick-3d-ui-config.mjs';
import {sliceCellAtPoint,slicePlotArea} from '../dynamic/dev/transient-brick-3d-view.mjs';
const reference=JSON.parse(readFileSync(new URL('../docs/dynamic/TRANSIENT_BRICK_3D_REFERENCE_20261107.json',import.meta.url)));
const raw=(over={})=>({sizeMm:{x:100,y:80,z:60},cells:{nx:4,ny:3,nz:2},k:25,rho:900,cp:1100,initial:300,
 faces:Object.fromEntries(BRICK_FACES.map(f=>[f.key,{type:'insulated',temperature:350,flux:1000,h:25,fluidTemperature:300}])),...over});
function advance(m,target){let guard=0;while(m.time<target-1e-12){m.step(Math.min(m.safeDt,target-m.time),false);if(++guard>2000000)throw Error('進行しませんでした。');}return m.snapshot();}

test('input builder converts mm to m and keeps only the keys each boundary kind allows',()=>{
 const v=raw();v.faces.xMin={type:'temperature',temperature:380,flux:999,h:9,fluidTemperature:9};
 v.faces.xMax={type:'flux',temperature:9,flux:5000,h:9,fluidTemperature:9};
 v.faces.yMin={type:'convection',temperature:9,flux:9,h:50,fluidTemperature:290};
 const input=buildBrickInput(v);
 assert.deepEqual(input.size,{x:0.1,y:0.08,z:0.06});
 assert.deepEqual(input.boundaries.xMin,{type:'temperature',temperature:380});
 assert.deepEqual(input.boundaries.xMax,{type:'flux',flux:5000});
 assert.deepEqual(input.boundaries.yMin,{type:'convection',h:50,temperature:290});
 assert.deepEqual(input.boundaries.yMax,{type:'insulated'});
 // The core accepts the built input unchanged (no unknown-key refusal).
 const m=createTransientBrick3d(input);
 assert.deepEqual(m.config.boundaries,input.boundaries);
});

test('every preset builds a core-accepted input and stays unpublished',()=>{
 for(const p of BRICK_PRESETS){
  if(!p.values)continue;
  const m=createTransientBrick3d(buildBrickInput(p.values));
  assert.equal(m.snapshot().releaseApproved,false,p.id);
  assert.ok(Number.isFinite(m.safeDt)&&m.safeDt>0,p.id);
 }
});

test('core refusal reasons pass through the builder unchanged (cell cap, bad values)',()=>{
 const over=raw({cells:{nx:33,ny:32,nz:32}});
 assert.throws(()=>createTransientBrick3d(buildBrickInput(over)),/直方体の格子は各軸1〜64、合計32768セル以下です。/);
 const badTemp=raw();badTemp.faces.zMax={type:'temperature',temperature:NaN,flux:0,h:0,fluidTemperature:0};
 assert.throws(()=>createTransientBrick3d(buildBrickInput(badTemp)),/境界の絶対温度\[K\]が数値範囲外です。/);
 const badSize=raw({sizeMm:{x:0,y:80,z:60}});
 assert.throws(()=>createTransientBrick3d(buildBrickInput(badSize)),/x方向の長さ\[m\]が数値範囲外です。/);
});

test('slice extraction matches direct core indexing on an asymmetric field, all planes',()=>{
 const cfg={size:{x:0.1,y:0.08,z:0.06},cells:{nx:8,ny:6,nz:5},k:25,rho:900,cp:1100,initial:300,
  boundaries:{xMin:{type:'flux',flux:5000},xMax:{type:'convection',h:50,temperature:290},zMax:{type:'temperature',temperature:360}}};
 const s=advance(createTransientBrick3d(cfg),60);
 assert.ok(s.max>s.min,'field is asymmetric');
 for(const plane of ['xy','xz','yz']){
  const fixedCount=plane==='xy'?s.nz:plane==='xz'?s.ny:s.nx;
  for(let fixed=0;fixed<fixedCount;fixed++){
   const slice=sliceField(s,plane,fixed);
   assert.equal(slice.fixedIndex,fixed);
   for(let r=0;r<slice.nRow;r++)for(let c=0;c<slice.nCol;c++){
    const cell=sliceCell(slice,r,c);
    assert.equal(slice.values[r][c],s.temperature[cellIndex(s.nx,s.ny,cell.i,cell.j,cell.l)],`${plane}@${fixed} (${r},${c})`);
    assert.equal(probeTemperature(s,cell),slice.values[r][c]);
   }
  }
 }
 // Orientation: row 0 of an xy slice is the largest y centre.
 const xy=sliceField(s,'xy',0);
 assert.equal(xy.rowCentres[0],s.centres.y[s.ny-1]);
 assert.equal(xy.colCentres[0],s.centres.x[0]);
 assert.equal(xy.fixedCentre,s.centres.z[0]);
 // Out-of-range slice indices clamp instead of throwing.
 assert.equal(sliceField(s,'xy',99).fixedIndex,s.nz-1);
 assert.equal(sliceField(s,'xy',-3).fixedIndex,0);
});

test('dirichlet-cube preset reaches the independent series reference at screen stepping',()=>{
 const p=BRICK_PRESETS.find(x=>x.id==='dirichlet-cube');
 const m=createTransientBrick3d(buildBrickInput(p.values));
 const s=advance(m,100); // four 25 s frames of dt <= safeDt substeps, as the screen does
 const ref=reference.cases.dirichletCube.grids['8x8x8'];
 const rms=Math.sqrt(s.temperature.reduce((sum,v,i)=>sum+(v-ref[i])**2,0)/s.temperature.length);
 // Measured for the core at dt = safeDt: RMS 0.0289 K (development doc).
 assert.ok(rms<0.05,`rms ${rms}`);
 assert.ok(s.relativeEnergyError<1e-12,'energy balance');
});

test('pointer hit-testing maps plot-area points to slice cells and rejects margins',()=>{
 const s=createTransientBrick3d({size:{x:0.1,y:0.1,z:0.1},cells:{nx:8,ny:8,nz:8},k:10,rho:1000,cp:1000,initial:300}).snapshot();
 const slice=sliceField(s,'xy',4),W=600,H=340,a=slicePlotArea(W,H);
 assert.deepEqual(sliceCellAtPoint(slice,W,H,a.x+1,a.y+1),{row:0,col:0});
 assert.deepEqual(sliceCellAtPoint(slice,W,H,a.x+a.w-1,a.y+a.h-1),{row:slice.nRow-1,col:slice.nCol-1});
 assert.equal(sliceCellAtPoint(slice,W,H,a.x-1,a.y+1),null);
 assert.equal(sliceCellAtPoint(slice,W,H,a.x+1,a.y-1),null);
 const mid=sliceCellAtPoint(slice,W,H,a.x+a.w/2,a.y+a.h/2);
 assert.ok(mid.row>=3&&mid.row<=4&&mid.col>=3&&mid.col<=4,'centre maps to a central cell');
});
