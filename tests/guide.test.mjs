import test from 'node:test';
import assert from 'node:assert/strict';
import {GUIDE_SECTIONS,searchGuide} from '../guide.mjs';
import {calculateHeatTransfer,STEFAN_BOLTZMANN_VALUE} from '../study-core.mjs';

test('the in-app guide covers every screen and all five implemented models, including Japanese partial search',()=>{
  const ids=new Set(GUIDE_SECTIONS.map(section=>section.id));
  for(const id of ['start','reader','quiz','progress','review','plan','notes','search','data','offline','accessibility','simulator','lab','sim-conduction','sim-convection','sim-radiation','sim-resistance','sim-transient','faq'])assert.ok(ids.has(id),id);
  assert.equal(ids.size,GUIDE_SECTIONS.length);
  assert.ok(searchGuide('放射率').some(section=>section.id==='sim-radiation'));
  assert.ok(searchGuide('復元').some(section=>section.id==='data'));
  assert.equal(searchGuide('見つからない語句xyz').length,0);
  for(const id of ['learn-dimensionless-transient','learn-lumped-cooling']){
    const html=GUIDE_SECTIONS.find(section=>section.id===id).html;
    assert.match(html,/#guide\/sim-transient/);
    assert.doesNotMatch(html,/非定常温度の計算機能はありません|この指数式は既存の定常シミュレーターには未実装/);
  }
  assert.match(GUIDE_SECTIONS.find(section=>section.id==='simulator').html,/非定常モデルでは横軸が経過時間、縦軸が物体温度/);
});

test('the four guide examples agree with independently calculated hand values',()=>{
  const conduction=calculateHeatTransfer('conduction',{k:15,area:.5,thickness:.08,hot:80,cold:20});
  assert.equal(conduction.watts,5625);
  assert.equal(calculateHeatTransfer('conduction',{k:15,area:.5,thickness:.16,hot:80,cold:20}).watts,2812.5);
  const convection=calculateHeatTransfer('convection',{h:25,area:1,surface:80,fluid:20});
  assert.equal(convection.watts,1500);
  const radiation=calculateHeatTransfer('radiation',{emissivity:1,area:1,surface:26.85,surrounding:-73.15});
  assert.ok(Math.abs(radiation.watts-STEFAN_BOLTZMANN_VALUE*6.5e9)<1e-6);
  assert.ok(Math.abs(radiation.watts-368.574337235)<1e-5);
  const resistance=calculateHeatTransfer('resistance',{area:1,hot:80,cold:20,hHot:10,hCold:20,k1:.5,k2:.1,L1:.1,L2:.05});
  assert.ok(Math.abs(resistance.totalResistance-.85)<1e-12);
  assert.ok(Math.abs(resistance.watts-70.5882352941)<1e-9);
  assert.ok(Math.abs(resistance.overallU-1/.85)<1e-12);
  assert.ok(Math.abs(resistance.temperatures.at(-1)-20)<1e-10);
});


test('advanced self-authored lessons are searchable and explicit about approximations and limitations',()=>{
  assert.equal(GUIDE_SECTIONS.length,49);
  const keys={
    'learn-dimensionless-transient':['Bi','Fo','0.1','L𝚌'],
    'learn-lumped-cooling':['ρVc','2000 s','Bi','exp'],
    'learn-convection-dimensionless':['Re','Pr','Nu','kᶠ'],
    'learn-heat-exchanger':['ṁ','ΔTₗₘ','8000 W','向流']
  };
  for(const [id,tokens] of Object.entries(keys)){
    const part=GUIDE_SECTIONS.find(guide=>guide.id===id);
    assert.ok(part,id);
    assert.ok(part.html.length>500,id);
    for(const token of tokens)assert.ok(part.html.includes(token),id+': '+token);
  }
  assert.ok(searchGuide('フーリエ数').some(s=>s.id==='learn-dimensionless-transient'));
  assert.ok(searchGuide('対数平均温度差').some(s=>s.id==='learn-heat-exchanger'));
});
