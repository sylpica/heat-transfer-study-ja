import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-2-3-series-parallel-thermal-resistance.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const n=(k)=>{const match=svg.match(new RegExp('\\b'+k+'="([^"]+)"'));assert.ok(match,'missing '+k);const v=Number(match[1]);assert.ok(Number.isFinite(v),'nonfinite '+k);return v;};
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} differs from ${b}`);
const p={Th:n('data-hot-c'),Tc:n('data-cold-c'),dT:n('data-delta-t-k'),R1:n('data-r1-k-per-w'),R2:n('data-r2-k-per-w'),Rs:n('data-series-r'),Qs:n('data-series-q'),D1:n('data-series-drop-1'),D2:n('data-series-drop-2'),Tmid:n('data-series-mid-c'),Rp:n('data-parallel-r'),Q1:n('data-parallel-q1'),Q2:n('data-parallel-q2'),Qtotal:n('data-parallel-qtotal'),Ws:n('data-series-heat-bar-width'),Wp:n('data-parallel-heat-bar-width')};
const rect=id=>{const match=svg.match(new RegExp('<rect id="'+id+'"[^>]*\\/>'));assert.ok(match,'missing rect '+id);const value=(key)=>Number(match[0].match(new RegExp('\\b'+key+'="([^"]+)"'))?.[1]);return {x:value('x'),y:value('y'),w:value('width'),h:value('height')};};

test('standalone SVG, accessibility and offline dark/light presentation',()=>{
 assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(svg,/viewBox="0 0 860 1280"/);
 assert.match(svg,/role="img" aria-labelledby="res-title res-desc"/);
 assert.match(svg,/<title id="res-title">/);assert.match(svg,/<desc id="res-desc">/);
 assert.match(svg,/data-origin="original-app-diagram"/);assert.match(svg,/data-lesson="2\.3"/);
 assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
 assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
 assert.match(svg,/原著図版の転載・トレース・逐語訳なし/);
});

test('series resistance matches shared heat rate, unequal drops and midpoint',()=>{
 assert.deepEqual([p.Th,p.Tc,p.dT,p.R1,p.R2],[80,20,60,.10,.20]);
 near(p.dT,p.Th-p.Tc);near(p.Rs,p.R1+p.R2);
 near(p.Qs,p.dT/p.Rs);near(p.Qs,200);
 near(p.D1,p.Qs*p.R1);near(p.D2,p.Qs*p.R2);
 near(p.D1+p.D2,p.dT);near(p.Tmid,p.Th-p.D1);near(p.Tmid,p.Tc+p.D2);
 for(const s of ['R_total = 0.10 + 0.20 = 0.30 K/W','ΔT1 = 20 K','ΔT2 = 40 K','Q = 60/0.30 = 200 W'])assert.ok(svg.includes(s),s);
});

test('parallel resistance has equal temperature difference across each branch',()=>{
 near(p.Rp,1/(1/p.R1+1/p.R2),1e-10);
 near(p.Q1,p.dT/p.R1);near(p.Q2,p.dT/p.R2);
 near(p.Qtotal,p.Q1+p.Q2);near(p.Qtotal,p.dT/p.Rp,1e-8);
 near(p.Qtotal,900);assert.ok(p.Rp<p.R1&&p.Rp<p.R2);
 assert.ok(p.Q1>p.Q2);
 for(const s of ['R_eq = 1/(1/R1 + 1/R2) ≈ 0.06667 K/W','Q1 = 600 W','Q2 = 300 W','Q_total = 600 + 300 = 900 W'])assert.ok(svg.includes(s),s);
});

test('circuits have distinct branch topology and the thermal-flow bars are proportional',()=>{
 const sr1=rect('series-resistor-1'),sr2=rect('series-resistor-2');
 const pr1=rect('parallel-resistor-1'),pr2=rect('parallel-resistor-2');
 assert.equal(sr1.y,sr2.y);assert.notEqual(pr1.y,pr2.y);
 assert.ok(sr1.x<sr2.x);assert.equal(pr1.x,pr2.x);
 assert.match(svg,/id="series-mid-node" class="point" cx="422" cy="296"/);
 assert.match(svg,/id="parallel-hot-node" class="node" cx="113" cy="730"/);
 assert.match(svg,/id="parallel-cold-node" class="node" cx="753" cy="730"/);
 const bs=rect('series-heat-bar'),bp=rect('parallel-heat-bar');
 near(bs.w,p.Ws);near(bp.w,p.Wp);
 near(bp.w/bs.w,p.Qtotal/p.Qs);
 assert.equal(bs.x,bp.x);
 assert.ok(bs.y<bp.y);
});

test('model caveats and units do not confuse total with area-specific resistance',()=>{
 for(const s of ['線形・定常・節点等温の近似','実際の二次元熱橋は別途解析','K/W','両端温度差60 K','各抵抗に同じQが流れる','各枝のΔTが共通'])assert.ok(svg.includes(s),s);
 assert.ok(svg.includes('面積当たり熱抵抗'));
 assert.ok(p.Qtotal>p.Qs);
});
