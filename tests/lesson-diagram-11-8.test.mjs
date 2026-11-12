import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-11-8-blowing-factor-reverse-osmosis.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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
const width=(id)=>{
  const m=svg.match(new RegExp('<rect id="'+id+'" x="[\\d.]+" y="[\\d.]+" width="([\\d.]+)"'));
  assert.ok(m,'Missing '+id);return Number(m[1]);
};
const bf=b=>b===0?1:Math.log(1+b)/b;
const X=b=>120+(b+0.9)*(560/3.9), Y=f=>880-110*f;

test('自作・代替説明・明暗モード・外部参照なし',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="film-title film-desc"/);
  assert.match(svg,/<title id="film-title">/);
  assert.match(svg,/<desc id="film-desc">/);
  assert.match(svg,/viewBox="0 0 760 1520"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="11\.8"/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)\s*=|@import|url\s*\(/i);
  assert.doesNotMatch(svg,/⁻|⁵|₀|₁/);
});

test('吹き出し因子の代表値を独立再計算',()=>{
  assert.ok(Math.abs(bf(-0.217)-1.127)<0.001);
  assert.ok(Math.abs(bf(0.2)-0.912)<0.001);
  assert.ok(Math.abs(bf(1)-0.693)<0.001);
  assert.ok(Math.abs(bf(2)-0.549)<0.001);
  assert.ok(bf(0.5833333)<1 && bf(-0.5)>1,'吹き出しで下がり吸い込みで上がる');
  assert.ok(Math.abs(bf(0.2)-1)<0.1 && Math.abs(bf(-0.2)-1)<0.12,'|Bm|≲0.2では1の約10%以内（本書の表現）');
  for(const t of ['−0.217 → 1.127','0.2 → 0.912','1 → 0.693','2 → 0.549'])assert.ok(svg.includes(t),t);
});

test('吹き出し因子曲線が40点一致しマーカーが曲線上にある',()=>{
  const p=curve('blowing-curve-11-8');
  assert.equal(p.length,40);
  for(let i=0;i<40;i++){
    const b=-0.9+0.1*i;
    assert.ok(Math.abs(p[i][0]-X(b))<0.0011,'i='+i);
    assert.ok(Math.abs(p[i][1]-Y(bf(b)))<0.06,'i='+i);
  }
  for(const [id,b] of [['marker-bm-m0p217',-0.217],['marker-bm-0p2',0.2],['marker-bm-1p0',1],['marker-bm-2p0',2]]){
    const m=svg.match(new RegExp('<circle id="'+id+'" cx="([\\d.]+)" cy="([\\d.]+)"'));
    assert.ok(m,id);
    assert.ok(Math.abs(Number(m[1])-X(b))<0.01,id);
    assert.ok(Math.abs(Number(m[2])-Y(bf(b)))<0.01,id);
  }
});

test('例題11.15：濃度分極と膜面塩分率を独立再計算',()=>{
  const gm=num('data-gm-star'),rho=num('data-density-kg-m3'),sb=num('data-salt-bulk');
  assert.equal(gm,0.04);assert.equal(rho,998);assert.equal(sb,0.035);
  const cp=Lmh=>Math.exp((rho*Lmh*1e-3/3600)/gm)-1;
  const cp1=cp(num('data-flux-1-l-m2h')),cp2=cp(num('data-flux-2-l-m2h'));
  assert.ok(Math.abs(cp1-0.109)<0.001,'本書10.9%');
  assert.ok(Math.abs(cp2-0.275)<0.001,'本書27.5%');
  assert.ok(Math.abs(sb*(1+cp1)-0.0388)<5e-4);
  assert.ok(Math.abs(sb*(1+cp2)-0.0446)<5e-4);
  assert.ok(Math.abs(width('bar-cp-15')-cp1*1600)<0.05);
  assert.ok(Math.abs(width('bar-cp-35')-cp2*1600)<0.05);
  assert.equal(num('data-bm-ro'),-0.217);
  for(const t of ['CP 約10.9%','CP 約27.5%','3.88% / 4.46%','B_m,H2O = −0.217'])assert.ok(svg.includes(t),t);
});

test('膜モデルの一般形と適用範囲を表示',()=>{
  assert.match(svg,/n_2,s = g_m\* ln\(1 \+ B_m,2\)（式\(11\.82\)）/);
  assert.match(svg,/塩は通れない（n_salt = 0）/);
  assert.match(svg,/クエット・停滞膜モデル/);
});
