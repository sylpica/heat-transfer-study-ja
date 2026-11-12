import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-11-5-stationary-medium-log-profile.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=(name)=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'Missing '+name);
  const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
const curve=(id)=>{
  const m=svg.match(new RegExp('<polyline id="'+id+'" points="([^"]+)"'));
  assert.ok(m,'Missing '+id);
  return m[1].split(/\s+/).map(pair=>pair.split(',').map(Number));
};

test('自作・代替説明・明暗モード・外部参照なし',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="film-title film-desc"/);
  assert.match(svg,/<title id="film-title">/);
  assert.match(svg,/<desc id="film-desc">/);
  assert.match(svg,/viewBox="0 0 760 1440"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="11\.5"/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)\s*=|@import|url\s*\(/i);
  assert.doesNotMatch(svg,/⁻|⁵|₀|₁/);
});

test('駆動力と対数形流束を独立再計算',()=>{
  const m0=num('data-m2-left'),mL=num('data-m2-right');
  assert.equal(m0,0.4);assert.equal(mL,0.05);
  const Bm=(m0-mL)/(1-m0);
  assert.ok(Math.abs(Bm-0.5833333)<1e-6);
  assert.ok(Math.abs(Math.log(1+Bm)-0.45953)<5e-5);
  const ratio=Math.log(1+Bm)/(m0-mL);
  assert.ok(Math.abs(ratio-1.31295)<1e-4);
  assert.ok(svg.includes('B_m,2 = (0.40 − 0.05)/(1 − 0.40) = 0.5833'));
  assert.ok(svg.includes('0.4595 × (ρD_12/L)'));
  assert.ok(svg.includes('対数形は約31%大きい'));
});

test('濃厚分布(11.61)と希薄直線が21点ずつ一致',()=>{
  const m0=num('data-m2-left'),mL=num('data-m2-right'),Bm=(m0-mL)/(1-m0);
  const dense=curve('dense-profile-11-5'),dilute=curve('dilute-profile-11-5');
  assert.equal(dense.length,21);assert.equal(dilute.length,21);
  const X=s=>120+560*s,Y=m=>850-600*m;
  for(let i=0;i<=20;i++){
    const s=i/20;
    const md=1-(1-m0)*Math.pow(1+Bm,s),ml=m0+(mL-m0)*s;
    assert.ok(Math.abs(dense[i][0]-X(s))<0.0011);
    assert.ok(Math.abs(dense[i][1]-Y(md))<0.0011);
    assert.ok(Math.abs(dilute[i][0]-X(s))<0.0011);
    assert.ok(Math.abs(dilute[i][1]-Y(ml))<0.0011);
    if(i){
      assert.ok(dense[i][1]>dense[i-1][1]);
      if(s<1)assert.ok(md>ml,'内部では濃厚分布が直線より上');
    }
  }
  assert.ok(Math.abs(dense[20][1]-Y(mL))<0.0011);
});

test('Stefan管と(11.54)(11.60)(11.62)への言及',()=>{
  assert.match(svg,/Stefan 管/);
  assert.match(svg,/式\(11\.64\)/);
  assert.match(svg,/v = \(D_12\/L\) ln\(1 \+ B_m,2\)（式\(11\.60\)）/);
  assert.match(svg,/m_2 = 0\.5 で 2 j_2（式\(11\.54\)）/);
  assert.match(svg,/モル形（式\(11\.62\)）がより広く正確/);
});
