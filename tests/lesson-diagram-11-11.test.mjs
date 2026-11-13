import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-11-11-multicomponent-chemical-potential.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num=(name)=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'Missing '+name);
  const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
const width=(id)=>{
  const m=svg.match(new RegExp('<rect id="'+id+'" x="[\\d.]+" y="[\\d.]+" width="([\\d.]+)"'));
  assert.ok(m,'Missing '+id);return Number(m[1]);
};
const dmu=g=>num('data-gas-constant')*num('data-temperature-k')*Math.log(g*num('data-x-i'));

test('自作・代替説明・明暗モード・外部参照なし',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="multi-title multi-desc"/);
  assert.match(svg,/<title id="multi-title">/);
  assert.match(svg,/<desc id="multi-desc">/);
  assert.match(svg,/viewBox="0 0 760 1520"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="11\.11"/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)\s*=|@import|url\s*\(/i);
  assert.doesNotMatch(svg,/⁻|⁵|₀|₁/);
});

test('化学ポテンシャル差 R T ln(γx) を独立再計算しバーと照合',()=>{
  const g1=num('data-gamma-1'),g2=num('data-gamma-2'),g3=num('data-gamma-3');
  assert.equal(g1,0.7);assert.equal(g2,1);assert.equal(g3,1.5);
  assert.ok(Math.abs(dmu(g1)-(-6633))<1);
  assert.ok(Math.abs(dmu(g2)-(-5743))<1);
  assert.ok(Math.abs(dmu(g3)-(-4732))<1);
  assert.ok(dmu(g1)<dmu(g2) && dmu(g2)<dmu(g3));
  assert.ok(Math.abs(width('bar-mu-07')-Math.abs(dmu(g1))*0.062)<0.05);
  assert.ok(Math.abs(width('bar-mu-10')-Math.abs(dmu(g2))*0.062)<0.05);
  assert.ok(Math.abs(width('bar-mu-15')-Math.abs(dmu(g3))*0.062)<0.05);
  for(const t of ['-6633 J/mol','-5743 J/mol','-4732 J/mol'])assert.ok(svg.includes(t),t);
  assert.match(svg,/駆動力は −∇μ_i（式\(11\.133\)）/);
});

test('D_12 = Γ Ð_12 (11.141) の換算とバーを独立再計算',()=>{
  const Dms=num('data-ms-diffusivity-m2-s');
  assert.equal(Dms,2.0e-9);
  for(const [id,g,txt] of [['bar-d-g0p5',0.5,'1.0'],['bar-d-g1p0',1,'2.0'],['bar-d-g2p0',2,'4.0']]){
    assert.ok(Math.abs(g*Dms-Number(txt)*1e-9)<1e-18,g);
    assert.ok(Math.abs(width(id)-g*Dms*0.9e11)<0.01,id);
    assert.ok(svg.includes(txt+'×10^(-9) m²/s'),txt);
  }
  assert.match(svg,/濃厚二成分液体：D_12 = Γ Ð_12（式\(11\.141\)）/);
  assert.match(svg,/希薄極限では Γ → 1 で両者は一致する/);
});

test('Duncan-Toorの3現象とMaxwell-Stefanの骨格を表示',()=>{
  assert.match(svg,/Duncan–Toor の実験（1962）/);
  assert.match(svg,/勾配ゼロでも流束が出る/);
  assert.match(svg,/勾配に逆らって高濃度側へ動く/);
  assert.match(svg,/勾配があっても流束はゼロ/);
  assert.match(svg,/Ð_ij = Ð_ji、独立な式は n − 1 本/);
  assert.match(svg,/二成分理想気体では Ð_12 = D_12/);
});
