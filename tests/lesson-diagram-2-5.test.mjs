import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-2-5-composite-wall-summary.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=(attribute)=>{
  const found=svg.match(new RegExp('\\b'+attribute+'="([^"]+)"'));
  assert.ok(found,'Missing data attribute '+attribute);
  const value=Number(found[1]);
  assert.ok(Number.isFinite(value),attribute+' must be finite');
  return value;
};
const near=(actual,expected,tolerance=1e-7)=>{
  assert.ok(Math.abs(actual-expected)<=tolerance,actual+' differs from '+expected);
};

test('§2.5 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="2\.5"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1126"/);
  assert.match(svg,/role="img" aria-labelledby="title2-5 desc2-5"/);
  assert.match(svg,/<title id="title2-5">/);
  assert.match(svg,/<desc id="desc2-5">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('series resistances, rate and interface temperatures recompute',()=>{
  const Rs=[num('data-r1'),num('data-r2'),num('data-r3'),num('data-r4'),num('data-r5')];
  const Rt=Rs.reduce((a,b)=>a+b,0);
  near(Rt,num('data-rtot'),1e-12);
  const q=(num('data-thot')-num('data-tcold'))/Rt;
  near(q,num('data-q'),1e-9);
  const interfaces=[num('data-t-a'),num('data-t-b'),num('data-t-c'),num('data-t-d')];
  let T=num('data-thot');
  for(let i=0;i<5;i++){
    T-=q*Rs[i];
    if(i<4)near(T,interfaces[i],1e-9);
  }
  near(T,num('data-tcold'),1e-9);
  near(num('data-t-b')-num('data-t-c'),q*num('data-r3'),1e-9);
});

test('temperature-drop bar segments are proportional and continuous',()=>{
  const g=svg.match(/<g id="drop-bar">([\s\S]*?)<\/g>/);
  assert.ok(g,'drop bar group is missing');
  const segs=[...g[1].matchAll(/<rect[^>]*x="([\d.]+)"[^>]*width="([\d.]+)"/g)].map(([,x,w])=>[Number(x),Number(w)]);
  assert.equal(segs.length,5);
  const Rs=[num('data-r1'),num('data-r2'),num('data-r3'),num('data-r4'),num('data-r5')];
  const dT=num('data-thot')-num('data-tcold');
  let cursor=segs[0][0];
  for(let i=0;i<5;i++){
    near(segs[i][0],cursor,0.25);
    near(segs[i][1],520*(num('data-q')*Rs[i])/dT,0.25);
    cursor+=segs[i][1];
  }
  near(cursor-segs[0][0],520,0.5);
});

test('chapter attainments and summary figures are shown',()=>{
  for(const s of ['142.86 W','0.280 K/W','25.71','11.43','10.00','7.14','総括熱伝達係数 U'])
    assert.ok(svg.includes(s),s);
});
