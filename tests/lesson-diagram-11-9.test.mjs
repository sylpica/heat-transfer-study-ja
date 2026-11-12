import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-11-9-high-rate-heat-coefficient.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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
const hr=x=>Math.abs(x)<1e-12?1:x/(Math.exp(x)-1);
const X=x=>120+(x+2)*112, Y=f=>880-140*f;

test('自作・代替説明・明暗モード・外部参照なし',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="high-title high-desc"/);
  assert.match(svg,/<title id="high-title">/);
  assert.match(svg,/<desc id="high-desc">/);
  assert.match(svg,/viewBox="0 0 760 1520"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="11\.9"/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)\s*=|@import|url\s*\(/i);
  assert.doesNotMatch(svg,/⁻|⁵|₀|₁/);
});

test('式(11.88)の補正比の代表値と符号の向きを独立再計算',()=>{
  assert.ok(Math.abs(hr(-1)-1.582)<0.001);
  assert.ok(Math.abs(hr(0.5)-0.771)<0.001);
  assert.ok(Math.abs(hr(1)-0.582)<0.001);
  assert.ok(Math.abs(hr(2)-0.313)<0.001);
  assert.ok(hr(1)<1 && hr(-1)>1,'吹き出しで下がり吸い込みで上がる');
  assert.ok(Math.abs(hr(0.2)-1)<0.1,'|X|≲0.2では約10%以内');
  for(const t of ['−1 → 1.582','0.5 → 0.771','1 → 0.582','2 → 0.313'])assert.ok(svg.includes(t),t);
});

test('h/h*曲線が51点一致しマーカーが曲線上にある',()=>{
  const p=curve('hratio-curve-11-9');
  assert.equal(p.length,51);
  for(let i=0;i<=50;i++){
    const x=-2+0.1*i;
    assert.ok(Math.abs(p[i][0]-X(x))<0.0011,'i='+i);
    assert.ok(Math.abs(p[i][1]-Y(hr(x)))<0.06,'i='+i);
  }
  for(const [id,x] of [['marker-x-m1p0',-1],['marker-x-0p5',0.5],['marker-x-1p0',1],['marker-x-2p0',2]]){
    const m=svg.match(new RegExp('<circle id="'+id+'" cx="([\\d.]+)" cy="([\\d.]+)"'));
    assert.ok(m,id);
    assert.ok(Math.abs(Number(m[1])-X(x))<0.01,id);
    assert.ok(Math.abs(Number(m[2])-Y(hr(x)))<0.01,id);
  }
});

test('蒸散冷却の壁温(11.98)：仮想例の指数接近を独立再計算',()=>{
  const Te=num('data-t-external-k'),Tr=num('data-t-reservoir-k');
  assert.equal(Te,1200);assert.equal(Tr,300);
  for(const [id,x,txt] of [['bar-ts-x0p5',0.5,'845.9'],['bar-ts-x1p0',1,'631.1'],['bar-ts-x2p0',2,'421.8'],['bar-ts-x3p0',3,'344.8']]){
    const Ts=Tr+(Te-Tr)*Math.exp(-x);
    assert.ok(Math.abs(Ts.toFixed(1)-Number(txt))<1e-9,x);
    assert.ok(Math.abs(width(id)-(Ts-Tr)*0.75)<0.01,id);
    assert.ok(svg.includes('T_s = '+txt+' K'),txt);
  }
  assert.match(svg,/式\(11\.98\)/);
  assert.match(svg,/仮想例/);
});

test('蒸散・発汗冷却と h* の定義を表示',()=>{
  assert.match(svg,/q_s = q_u（式\(11\.93\)）/);
  assert.match(svg,/発汗冷却：q_s = q_u \+ h_fg n_i,s/);
  assert.match(svg,/h\* は質量移動ゼロの極限/);
  assert.match(svg,/高い物質移動率での熱伝達/);
});
