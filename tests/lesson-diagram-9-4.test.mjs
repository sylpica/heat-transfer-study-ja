import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg = readFileSync(new URL('../assets/lesson-diagrams/section-9-4-film-boiling-vapor-layer-resistance.svg', import.meta.url), 'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const numeric = (key) => {
  const found=svg.match(new RegExp('\\b'+key+'="([^"]+)"'));
  assert.ok(found,'missing numeric attribute '+key);
  const number=Number(found[1]);
  assert.ok(Number.isFinite(number),'non-finite '+key);
  return number;
};
const near=(actual,expected,epsilon=1e-7)=>assert.ok(Math.abs(actual-expected)<=epsilon,`${actual} differs from ${expected}`);
const p={
  k:numeric('data-k-gas'),Tw:numeric('data-t-wall'),Tsat:numeric('data-t-saturation'),
  A:numeric('data-area'),d1:numeric('data-thickness-1'),d2:numeric('data-thickness-2'),
  q1:numeric('data-heat-flux-1'),q2:numeric('data-heat-flux-2'),
  Q1:numeric('data-heat-rate-1'),Q2:numeric('data-heat-rate-2'),
  R1:numeric('data-resistance-area-1'),R2:numeric('data-resistance-area-2'),
};

test('independent self-contained accessible original SVG with dark color scheme',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 860 1490"/);
  assert.match(svg,/role="img" aria-labelledby="film-title film-description"/);
  assert.match(svg,/<title id="film-title">/);
  assert.match(svg,/<desc id="film-description">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="9\.4"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/原著図版の転載・トレースなし/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('fixed vapor film conduction: dimensional quantities match the existing lesson',()=>{
  assert.deepEqual([p.k,p.Tw,p.Tsat,p.A,p.d1,p.d2],[.03,180,100,.1,.00025,.0005]);
  const DT=p.Tw-p.Tsat;
  near(DT,80);
  near(p.R1,p.d1/p.k);near(p.R2,p.d2/p.k);
  near(p.q1,p.k*DT/p.d1);near(p.q2,p.k*DT/p.d2);
  near(p.q1,9600);near(p.q2,4800);
  near(p.Q1,p.q1*p.A);near(p.Q2,p.q2*p.A);
  near(p.Q1,960);near(p.Q2,480);
  near(p.R2/p.R1,2);near(p.q2/p.q1,.5);
});

test('41 plotted inverse-proportional points are computed exactly within roundoff',()=>{
  assert.equal(numeric('data-point-count'),41);
  const d=svg.match(/<path id="film-flux-curve" class="curve" d="([^"]+)"\/>/)?.[1];
  assert.ok(d,'curve missing');
  const pts=[...d.matchAll(/[ML]([0-9.]+) ([0-9.]+)/g)].map(x=>[Number(x[1]),Number(x[2])]);
  assert.equal(pts.length,41);
  pts.forEach(([x,y],i)=>{
    const fraction=i/40;
    const thick=p.d1*(1+fraction);
    const flux=p.k*(p.Tw-p.Tsat)/thick;
    near(x,170+575*fraction,.0006);
    near(y,1118-208*flux/p.q1,.0006);
    if(i){assert.ok(x>pts[i-1][0],'thickness monotonic');assert.ok(y>pts[i-1][1],'heat flux declines');}
  });
  assert.match(svg,/<circle id="thin-point" class="mark" cx="170" cy="910" r="7"\/>/);
  assert.match(svg,/<circle id="thick-point" class="mark" cx="745" cy="1014" r="7"\/>/);
});

test('physical model exclusions and misleading safety extrapolation are explicitly blocked',()=>{
  assert.match(svg,/data-model="fixed-stagnant-one-dimensional-conduction-only"/);
  for(const needed of [
    '固定厚さの蒸気層','蒸気膜厚 0.25 mm','蒸気膜厚 0.50 mm（2倍）',
    'q″ = 9,600 W/m²','q″ = 4,800 W/m²','Q = 960 W','Q = 480 W',
    '実際の膜沸騰の相関曲線ではない','蒸気流、蒸発、放射、膜の形状変化、界面連成は除外',
    '安全限界や総伝熱量を保証しない','全抵抗 K/W ではない',
  ])assert.ok(svg.includes(needed),'missing '+needed);
  assert.doesNotMatch(svg,/安全率は|CHF\s*[=:＝]\s*[0-9]/);
});

test('geometry separates panels and uses positive dimensions',()=>{
  const panels=[...svg.matchAll(/<rect class="panel" x="22" y="([0-9]+)" width="816" height="([0-9]+)" rx="17"\/>/g)].map(m=>({y:+m[1],h:+m[2]}));
  assert.deepEqual(panels,[{y:115,h:332},{y:463,h:299},{y:778,h:610}]);
  assert.ok(panels[0].y+panels[0].h<panels[1].y);
  assert.ok(panels[1].y+panels[1].h<panels[2].y);
  assert.match(svg,/<rect id="vapor-film" class="vapor" x="210" y="211" width="170" height="135"\/>/);
  assert.ok(p.k>0&&p.d1>0&&p.A>0&&p.Tw>p.Tsat);
});
