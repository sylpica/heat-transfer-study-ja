import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-6-1-velocity-thermal-boundary-layers.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const n=(name)=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'missing '+name);
  const value=Number(m[1]);
  assert.ok(Number.isFinite(value),name+' must be numeric');
  return value;
};
const approx=(a,b,eps=1e-8)=>{
  assert.ok(Math.abs(a-b)<eps,'expected '+a+' to be '+b);
};
const profile=(id)=>{
  const m=svg.match(new RegExp('<path id="'+id+'"[^>]*d="([^"]+)"\\s*/>'));
  assert.ok(m,'missing '+id);
  return [...m[1].matchAll(/[ML]([0-9.]+) ([0-9.]+)/g)].map(z=>[Number(z[1]),Number(z[2])]);
};

test('original, accessible, responsive and offline-safe SVG',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 820 1240"/);
  assert.match(svg,/role="img" aria-labelledby="title61 desc61"/);
  assert.match(svg,/<title id="title61">/);
  assert.match(svg,/<desc id="desc61">/);
  assert.match(svg,/data-lesson="6\.1"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/style="max-width:100%"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('worked example: Reynolds, Prandtl and average Nusselt numbers independently agree',()=>{
  const U=n('data-uinf'),L=n('data-length'),nu=n('data-nu');
  const alpha=n('data-alpha-fluid'),kf=n('data-k-fluid'),h=n('data-h-avg');
  approx(U,2);approx(L,.5);approx(nu,1.5e-5);
  approx(alpha,2e-5);approx(kf,.025);approx(h,20);
  approx(U*L/nu,66666.66666666667);
  approx(nu/alpha,.75);
  approx(h*L/kf,400);
  for(const str of ['Re_L = U∞ L/ν ≈ 6.67×10^4','Pr = ν/α_f = 0.75','Nu_avg,L = h_avg L/k_f = 400'])
    assert.ok(svg.includes(str),str);
});

test('velocity and thermal schematic boundaries are separate and widen smoothly downstream',()=>{
  const v=profile('velocity-boundary'),t=profile('thermal-boundary');
  assert.equal(v.length,33);assert.equal(t.length,33);
  for(let i=0;i<33;i++){
    const p=i/32,x=174+(718-174)*p;
    approx(v[i][0],x,.011);approx(t[i][0],x,.011);
    approx(v[i][1],379-107*Math.sqrt(p),.011);
    approx(t[i][1],730-94*Math.sqrt(p),.011);
    if(i){assert.ok(v[i][1]<v[i-1][1]);assert.ok(t[i][1]<t[i-1][1]);}
  }
  assert.notEqual(n('data-delta-v-end'),n('data-delta-t-end'));
  assert.match(svg,/data-schematic="true"/);
});

test('wall, outer-flow and units are clear without unjustified transfer correlations',()=>{
  for(const s of ['固定平板：u = 0','主流：U∞ = 2.0 m/s',
    'T_s ≠ T∞','速度境界層 δ_v(x)','温度境界層 δ_T(x)',
    'k_f = 0.025 W/(m·K)','h_avg = 20 W/(m²·K)',
    'このRe値だけで遷移・乱流を断定しない',
    '境界層厚さの比は流況・物性で変わる','厚さの定量予測ではない'])
    assert.ok(svg.includes(s),s);
  assert.doesNotMatch(svg,/\bNu_avg,L = h_avg L\/k_s/);
  assert.doesNotMatch(svg,/\bδ_T\/δ_v\s*=/);
});
