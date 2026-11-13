import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const svg=readFileSync(new URL('../assets/lesson-diagrams/section-4-2-uniform-generation-plane-wall.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const numeric=name=>{
  const found=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(found,'missing '+name);
  return Number(found[1]);
};
test('独立図・アクセシビリティ・可搬性の契約',()=>{
  assert.match(svg,/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/data-lesson="4\.2"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/role="img" aria-labelledby="lesson42-title lesson42-desc"/);
  assert.match(svg,/<title id="lesson42-title">/);
  assert.match(svg,/<desc id="lesson42-desc">/);
  assert.match(svg,/@media \(prefers-color-scheme:dark\)/);
  assert.match(svg,/viewBox="0 0 680 1090"/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject)\b|(?:href|xlink:href)=/i);
});
test('熱源・温度・熱流束・総発熱の数値を独立再計算',()=>{
  const q=numeric('data-qvol'),k=numeric('data-k'),L=numeric('data-half-thickness'),A=numeric('data-area'),Ts=numeric('data-surface-temperature');
  assert.equal(q,20000);assert.equal(k,10);assert.equal(L,0.05);assert.equal(A,1);assert.equal(Ts,20);
  const Tmax=Ts+q*L**2/(2*k),qxL=q*L,qxMinusL=-q*L,qGenerated=q*(2*L*A);
  assert.ok(Math.abs(Tmax-22.5)<1e-10);
  assert.equal(qxMinusL,-1000);assert.equal(qxL,1000);
  assert.equal(qGenerated,2000);assert.equal((Math.abs(qxL)+Math.abs(qxMinusL))*A,qGenerated);
  for(const visible of ['22.5 ℃','20 ℃','−1,000','+1,000','2,000 W','1,000 W/m²','W/m³'])assert.ok(svg.includes(visible),visible);
});
test('描画の二次ベジエ曲線が対称放物線に一致',()=>{
  assert.match(svg,/<path d="M145 781 Q340 511 535 781" class="heat"\/>/);
  for(const t of [0,0.125,0.25,0.5,0.75,0.875,1]){
    const x=(1-t)**2*145+2*(1-t)*t*340+t**2*535;
    const y=(1-t)**2*781+2*(1-t)*t*511+t**2*781;
    const u=(x-340)/195;
    assert.ok(Math.abs(y-(781-135*(1-u*u)))<1e-9,'curve mismatch at '+t);
  }
});
