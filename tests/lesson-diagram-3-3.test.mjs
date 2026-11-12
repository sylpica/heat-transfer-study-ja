import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../assets/lesson-diagrams/section-3-3-ntu-isothermal-heat-exchanger.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const extractNumeric = (name) => {
  const result = svg.match(new RegExp(`\\b${name}="([^"]+)"`));
  assert.ok(result,`Missing parameter ${name}`);
  const value=Number(result[1]);
  assert.ok(Number.isFinite(value));
  return value;
};

test('self-contained SVG, accessible labels, dark/light, and non-reproduction notice', () => {
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="hx-title hx-desc"/);
  assert.match(svg,/<title id="hx-title">/);
  assert.match(svg,/<desc id="hx-desc">/);
  assert.match(svg,/data-lesson="3\.3"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/viewBox="0 0 760 1220"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('effectiveness, outlet and heat transfer rate follow original example',()=>{
  const hot=extractNumeric('data-hot-c');
  const inlet=extractNumeric('data-cold-in-c');
  const UA=extractNumeric('data-ua-w-per-k');
  const C=extractNumeric('data-cmin-w-per-k');
  const ntu=extractNumeric('data-ntu');
  assert.equal(UA/C,ntu);
  const effectiveness=-Math.expm1(-ntu);
  const qmax=C*(hot-inlet);
  const q=effectiveness*qmax;
  const outlet=inlet+q/C;
  assert.ok(effectiveness>=0 && effectiveness<=1);
  assert.ok(outlet>inlet && outlet<hot);
  assert.ok(Math.abs(effectiveness-0.6321205588285577)<1e-13);
  assert.ok(Math.abs(q-7585.446705942692)<1e-8);
  assert.ok(Math.abs(q-extractNumeric('data-heat-w'))<1e-6);
  assert.ok(Math.abs(outlet-extractNumeric('data-cold-out-c'))<1e-6);
  for(const label of ['0.6321','7,585.4 W','45.28 ℃','20 ℃','60 ℃','Uは面積方向に一定'])
    assert.ok(svg.includes(label),`Missing visible value: ${label}`);
});

test('21 plotted points match a rising exponential temperature profile',()=>{
  const m=svg.match(/<path id="cold-temperature-profile" class="cold-line" d="([^"]+)"\/>/);
  assert.ok(m,'temperature curve is missing');
  const coords=[...m[1].matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(([,x,y])=>[Number(x),Number(y)]);
  assert.equal(coords.length,21);
  for(let i=0;i<coords.length;i++){
    const s=i/20;
    const expectedX=202+448*s;
    const temp=60-40*Math.exp(-s);
    const expectedY=590+5*(60-temp);
    assert.ok(Math.abs(coords[i][0]-expectedX)<0.011);
    assert.ok(Math.abs(coords[i][1]-expectedY)<0.011);
    if(i) assert.ok(coords[i][1]<coords[i-1][1],`temperature failed monotonicity at ${i}`);
  }
});

test('SVG arrows do not reverse heat-transfer direction',()=>{
  assert.match(svg,/d="M270 265 V314/);
  assert.match(svg,/d="M640 347 H699/);
  assert.match(svg,/熱を渡す側と受け取る側/);
  assert.match(svg,/高温側：60 ℃（相変化・等温）/);
});
