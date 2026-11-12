import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-10-5-gas-radiation-beer-hottel.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=(attribute)=>{
  const found=svg.match(new RegExp('\\b'+attribute+'="([^"]+)"'));
  assert.ok(found,'Missing data attribute '+attribute);
  const value=Number(found[1]);
  assert.ok(Number.isFinite(value),attribute+' must be finite');
  return value;
};
const p={
  sigma:num('data-sigma'),
  dBand:num('data-delta-band'),dWin:num('data-delta-window'),
  tauBand:num('data-tau-band'),alphaBand:num('data-alpha-band'),
  tauWin:num('data-tau-window'),alphaWin:num('data-alpha-window'),
  dSphere:num('data-d-sphere'),l0Sphere:num('data-l0-sphere'),
  dCyl:num('data-d-cyl'),l0Cyl:num('data-l0-cyl'),
  gap:num('data-gap'),l0Plates:num('data-l0-plates'),
  pa:num('data-pa'),paL:num('data-pal'),
  eg:num('data-eg'),ag:num('data-ag'),tg:num('data-tg'),tw:num('data-tw'),q:num('data-q')
};
const near=(actual,expected,tolerance=1e-7)=>{
  assert.ok(Math.abs(actual-expected)<=tolerance,actual+' differs from '+expected);
};

test('§10.5 independent SVG is accessible, offline-safe and supports dark mode',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="10\.5"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 840 1264"/);
  assert.match(svg,/role="img" aria-labelledby="title10-5 desc10-5"/);
  assert.match(svg,/<title id="title10-5">/);
  assert.match(svg,/<desc id="desc10-5">/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('Beer law: transmittance and absorptance follow exp(-delta)',()=>{
  near(p.tauBand,Math.exp(-p.dBand),1e-7);
  near(p.alphaBand,1-Math.exp(-p.dBand),1e-7);
  near(p.tauWin,Math.exp(-p.dWin),1e-7);
  near(p.alphaWin,1-Math.exp(-p.dWin),1e-7);
  assert.ok(p.alphaBand>0.86&&p.alphaWin<0.02,'in-band absorption dominates');
  for(const f of [0.25,0.5,0.75]){
    assert.ok(Math.exp(-p.dBand*f)<Math.exp(-p.dBand*(f-0.25)),'monotone decay');
  }
  for(const s of ['0.1353','0.8647','0.9802','0.0198'])assert.ok(svg.includes(s),s);
});

test('mean beam length L0 = 4V/A for sphere, cylinder and plates',()=>{
  near(p.l0Sphere,2*p.dSphere/3,1e-9);
  near(p.l0Cyl,p.dCyl,1e-9);
  near(p.l0Plates,2*p.gap,1e-9);
  for(const s of ['L0 = 4V/A','0.40 m','0.50 m'])assert.ok(svg.includes(s),s);
});

test('Example 10.11 net gas radiation recomputes from chart emissivity/absorptivity',()=>{
  near(p.paL,p.pa*1.01325*(p.l0Cyl*100),1e-6);
  const q=Math.PI*p.dCyl*(p.eg*p.sigma*p.tg**4-p.ag*p.sigma*p.tw**4);
  near(p.q,q,0.5);
  assert.ok(Math.abs(p.q/1000-27.59)<0.01,'about 27.59 kW/m');
  assert.ok(p.eg<p.ag,'absorptivity exceeds emissivity when wall is colder (eq. 10.57 scaling)');
  for(const s of ['8.11 bar·cm','27.59 kW/m','ε_g = 0.085','α_g = 0.12'])assert.ok(svg.includes(s),s);
});
