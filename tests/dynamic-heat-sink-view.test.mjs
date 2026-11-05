import test from 'node:test';import assert from 'node:assert/strict';import {heatSinkScene} from '../dynamic/dev/heat-sink-view.mjs';
test('3D shape mapping preserves physical solid volume and repeats the solved one-dimensional field without a new numerical dimension',()=>{
 const common={baseWidth:.08,baseDepth:.06,baseThickness:.005,finLength:.04,finThickness:.002,finCells:4,dx:.01};
 for(const finCount of [0,1,6,16]){
  const mesh={...common,finCount},state={baseTemperature:305,finTemperature:finCount?[304,303,302,301]:[]},before=structuredClone({state,mesh}),scene=heatSinkScene(state,mesh);assert.equal(scene.length,1+finCount*mesh.finCells);
  let volume=0;for(const block of scene){const [a,b,c,d,e,f]=block.bounds;assert.ok(b>a&&d>c&&f>e);volume+=(b-a)*(d-c)*(f-e);assert.ok(a>=-mesh.baseWidth/2&&b<=mesh.baseWidth/2);assert.equal(block.temperature,block.kind==='base'?305:state.finTemperature[block.cell]);if(block.kind==='fin'){assert.ok(c>=0&&d<=mesh.finLength);assert.equal(block.cell>=0&&block.cell<mesh.finCells,true);}}
  const expected=mesh.baseWidth*mesh.baseDepth*mesh.baseThickness+finCount*mesh.finThickness*mesh.baseDepth*mesh.finLength;assert.ok(Math.abs(volume-expected)<1e-17);assert.deepEqual({state,mesh},before);
  for(let j=0;j<mesh.finCells;j++)assert.equal(scene.filter(b=>b.kind==='fin'&&b.cell===j).length,finCount);
 }
});
