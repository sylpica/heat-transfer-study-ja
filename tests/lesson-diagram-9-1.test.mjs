import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-9-1-pool-boiling-curve-regimes.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num=name=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'missing data field: '+name);
  const result=Number(m[1]);
  assert.ok(Number.isFinite(result),name+' is not finite');
  return result;
};
const near=(x,y,eps=1e-9)=>assert.ok(Math.abs(x-y)<eps,String(x)+' != '+String(y));
const path=id=>{
  const d=svg.match(new RegExp('<path id="'+id+'" class="[^"]+" d="([^"]+)"\\/>'))?.[1];
  assert.ok(d,'missing SVG path '+id);
  return d;
};
const endpoints=d=>{
  const numbers=[...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));
  assert.ok(numbers.length>=8 && numbers.length%6===2,'unexpected Bezier path');
  return {start:numbers.slice(0,2),end:numbers.slice(-2)};
};

test('boiling diagram is an independent accessible standalone vector asset',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 880 1280"/);
  assert.match(svg,/role="img" aria-labelledby="boiling-title boiling-description"/);
  assert.match(svg,/<title id="boiling-title">/);
  assert.match(svg,/<desc id="boiling-description">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="9\.1"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/原著図版の転載・トレース・逐文翻訳なし/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('worked example independently reconstructs superheat, flux and point effective h',()=>{
  const A=num('data-area-m2'),Q=num('data-q-w'),Tw=num('data-twall-c'),Tsat=num('data-tsat-c');
  const dT=num('data-superheat-k'),q=num('data-flux-wm2'),h=num('data-h-effective');
  assert.deepEqual([A,Q,Tw,Tsat,dT,q,h],[.01,200,120,100,20,20000,1000]);
  near(Tw-Tsat,dT);
  near(Q/A,q);
  near(q/dT,h);
  near(h*A*dT,Q);
  for(const label of ['ΔT_sat = T_w − T_sat = 20 K',
    'q″ = Q/A = 20,000 W/m² = 20 kW/m²',
    'h_eff = q″/ΔT_sat = 1,000 W/(m²·K)'])assert.ok(svg.includes(label),label);
});

test('qualitative curve connects the four regions with extrema in correct order',()=>{
  const ids=['boiling-natural','boiling-nucleate','boiling-transition','boiling-film'];
  const parts=ids.map(id=>endpoints(path(id)));
  assert.deepEqual(parts[0].start,[130,590]);
  assert.deepEqual(parts[0].end,parts[1].start);
  assert.deepEqual(parts[1].end,parts[2].start);
  assert.deepEqual(parts[2].end,parts[3].start);
  assert.deepEqual(parts[1].end,[412,244]);
  assert.deepEqual(parts[2].end,[552,522]);
  assert.deepEqual(parts[3].end,[795,314]);
  assert.ok(parts[0].start[1]>parts[0].end[1],'natural convection: rising flux');
  assert.ok(parts[1].start[1]>parts[1].end[1],'nucleate boiling: rising flux');
  assert.ok(parts[2].start[1]<parts[2].end[1],'transition boiling: declining flux');
  assert.ok(parts[3].start[1]>parts[3].end[1],'film boiling: increasing flux');
  assert.ok(parts.every(({start,end})=>start[0]<end[0]),'superheat axis is increasing');
  assert.match(svg,/<circle id="chf-point" class="chf" cx="412" cy="244" r="7"\/>/);
  assert.match(svg,/<circle id="minimum-point" class="minimum" cx="552" cy="522" r="7"\/>/);
});

test('separate schematic from numeric example and never assert unknown CHF safety',()=>{
  assert.match(svg,/data-chf-known="false"/);
  assert.match(svg,/data-regime-known="false"/);
  assert.match(svg,/data-boiling-curve="schematic-not-to-scale"/);
  for(const caveat of [
    '曲線形状・領域境界は模式的',
    '縦：熱流束 q″（目盛なし）',
    '自然対流','核沸騰','遷移沸騰','膜沸騰',
    'CHFは液体・圧力・面の状態・向きなどで変わる',
    '温度制御と熱流束制御では',
    'CHF値が不明：沸騰領域・安全性は判定できない',
    'h_effはこの一点での比'
  ])assert.ok(svg.includes(caveat),caveat);
  assert.doesNotMatch(svg, /CHF[ ＝=]+\d/);
});

test('regions and worked example are visually isolated in distinct panels',()=>{
  assert.match(svg,/<rect class="panel" x="23" y="123" width="834" height="704" rx="18"\/>/);
  assert.match(svg,/<rect class="panel" x="23" y="845" width="834" height="389" rx="18"\/>/);
  assert.ok(!svg.includes('id="observed-example-point"'),'example is not plotted on unknown regime');
  const names=['boiling-natural','boiling-nucleate','boiling-transition','boiling-film'];
  assert.equal(new Set(names).size,4);
});
