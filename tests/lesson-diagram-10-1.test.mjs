import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-10-1-radiosity-irradiation-balance.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=key=>{
  const m=svg.match(new RegExp('\\b'+key+'="([^"]+)"'));
  assert.ok(m,`Missing ${key}`);
  const v=Number(m[1]);assert.ok(Number.isFinite(v));return v;
};
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const p={sigma:num('data-sigma'),Ts:num('data-ts-k'),Te:num('data-tenclosure-k'),eps:num('data-emissivity'),A:num('data-area-m2'),F:num('data-view-factor'),Eb:num('data-eb'),G:num('data-irradiation'),E:num('data-self-emission'),R:num('data-reflected'),J:num('data-radiosity'),q:num('data-net-flux'),Q:num('data-net-heat'),scale:num('data-bar-scale')};
const bar=id=>{
  const tag=svg.match(new RegExp('<rect id="'+id+'"[^>]*\\/>'))?.[0];
  assert.ok(tag,`Missing bar ${id}`);
  const read=key=>{
    const match=tag.match(new RegExp('\\b'+key+'="([^"]+)"'));
    assert.ok(match,`Missing ${id}.${key}`);return Number(match[1]);
  };
  return {x:read('x'),y:read('y'),width:read('width'),height:read('height')};
};

test('accessible, dark-aware SVG without scripts, external references or copied source art',()=>{
 assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(svg,/viewBox="0 0 860 1320"/);
 assert.match(svg,/role="img" aria-labelledby="rad-title rad-desc"/);
 assert.match(svg,/<title id="rad-title">/);
 assert.match(svg,/<desc id="rad-desc">/);
 assert.match(svg,/data-lesson="10\.1"/);
 assert.match(svg,/data-origin="original-app-diagram"/);
 assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
 assert.match(svg,/アプリ独自図解/);
 assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('independently recomputed Stefan-Boltzmann, emission, reflection, radiosity and net exchange',()=>{
 assert.deepEqual([p.sigma,p.Ts,p.Te,p.eps,p.A,p.F],[5.670374419e-8,400,300,.8,.5,1]);
 near(p.Eb,p.sigma*p.Ts**4);near(p.G,p.sigma*p.Te**4);
 near(p.E,p.eps*p.Eb);near(p.R,(1-p.eps)*p.G);
 near(p.J,p.E+p.R);near(p.q,p.J-p.G);
 near(p.q,p.eps*p.sigma*(p.Ts**4-p.Te**4));
 near(p.Q,p.A*p.q);
 near(p.Eb,1451.615851264);near(p.G,459.300327939);
 near(p.E,1161.2926810112);near(p.R,91.8600655878);
 near(p.J,1253.152746599);near(p.q,793.85241866);near(p.Q,396.92620933);
 assert.ok(p.J>p.q&&p.J<p.Eb&&p.q>0);
});

test('four radiometric bars and J sub-bars use the same absolute linear scale',()=>{
 const eb=bar('bar-eb'),g=bar('bar-g'),em=bar('bar-emission'),ref=bar('bar-reflection'),net=bar('bar-net');
 near(eb.x,234);near(g.x,234);near(em.x,234);near(net.x,234);
 near(eb.width,400,.001);
 near(eb.width,p.Eb*p.scale,.001);
 near(g.width,p.G*p.scale,.001);
 near(em.width,p.E*p.scale,.001);
 near(ref.width,p.R*p.scale,.001);
 near(net.width,p.q*p.scale,.001);
 near(ref.x,em.x+em.width,.001);
 near(em.width+ref.width,p.J*p.scale,.001);
 near(eb.height,35);near(g.height,35);near(em.height,35);near(ref.height,35);near(net.height,35);
 assert.ok(eb.width>em.width+ref.width&&em.width+ref.width>net.width&&net.width>g.width);
});

test('displayed rounding is correct and distinguishes G, J and the net flux',()=>{
 for(const label of [
 '黒体 Eb','入射 G','射度 J','正味 J−G',
 '1451.616','459.300','1253.153','+793.852',
 'G = σ×300⁴ = 459.300 W/m²',
 'J = εσ×400⁴ + (1−ε)G = 1253.153 W/m²',
 'q″ = J−G = εσ(400⁴−300⁴) = +793.852 W/m²',
 'Q = A q″ = +396.926 W（外向き放熱）',
 '射度Jの棒：茶＝自己放出 εEb ／ 紫＝反射 (1−ε)G'
 ])assert.ok(svg.includes(label),label);
 assert.equal((svg.match(/class="panel"/g)||[]).length,3);
});

test('restricted geometry, Kelvin-only temperatures, and limiting cases prevent misapplication',()=>{
 assert.match(svg,/data-geometry="gray-patch-in-large-black-enclosure"/);
 for(const label of [
 '大きな黒体囲い','300 K','400 K','形態係数 F = 1',
 '非参加性媒体','不透明・拡散・灰色',
 '温度はK。有限灰色面同士・参加性ガスへ無条件に流用しない。'
 ])assert.ok(svg.includes(label),label);
 near(p.eps*p.sigma*(p.Ts**4-p.Ts**4),0);
 assert.ok(p.eps*p.sigma*(p.Te**4-p.Ts**4)<0);
 near((p.E+p.R)-p.G,p.q);
});
