import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-8-5-film-condensation-liquid-film.svg', import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const number=(key)=>{
  const match=svg.match(new RegExp('\\b'+key+'="([^"]+)"'));
  assert.ok(match,'Missing numeric attribute '+key);
  const value=Number(match[1]);
  assert.ok(Number.isFinite(value),'Not finite: '+key);
  return value;
};
const approximately=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} differs from ${b}`);
const p={rhoL:number('data-rho-l'),rhoV:number('data-rho-v'),k:number('data-k-l'),
  mu:number('data-mu-l'),hfg:number('data-h-fg'),g:number('data-g'),
  L:number('data-length'),b:number('data-width'),deltaT:number('data-delta-t'),
  c:number('data-coefficient'),h:number('data-h-average'),Q:number('data-q'),
  mass:number('data-mass-rate'),Re:number('data-re-film'),deltaEnd:number('data-thickness-end-m')};
const coordinates=(id)=>{
  const match=svg.match(new RegExp('<path id="'+id+'"[^>]*d="([^"]+)"'));
  assert.ok(match,'Missing path '+id);
  return [...match[1].matchAll(/[ML]\s+([\d.]+)\s+([\d.]+)/g)].map(x=>[Number(x[1]),Number(x[2])]);
};

test('§8.5 original SVG has accessible descriptions and no external references',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 840 1280"/);
  assert.match(svg,/role="img" aria-labelledby="cond-title cond-desc"/);
  assert.match(svg,/<title id="cond-title">/);
  assert.match(svg,/<desc id="cond-desc">/);
  assert.match(svg,/data-lesson="8\.5"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('average Nusselt film-condensation h, Q, condensate flow and film Re independently agree',()=>{
  assert.deepEqual([p.rhoL,p.rhoV,p.k,p.mu,p.hfg,p.g,p.L,p.b,p.deltaT,p.c],
    [950,0.60,0.68,2.8e-4,2.25e6,9.81,0.02,0.50,10,0.943]);
  const term=p.rhoL*(p.rhoL-p.rhoV)*p.g*p.hfg*p.k**3/(p.mu*p.L*p.deltaT);
  const averageH=p.c*Math.pow(term,0.25);
  const Q=averageH*p.L*p.b*p.deltaT;
  const mass=Q/p.hfg;
  const Re=4*mass/(p.b*p.mu);
  approximately(term,1.117797333503143e17,3e3);
  approximately(p.h,averageH);
  approximately(p.Q,Q);
  approximately(p.mass,mass,1e-10);
  approximately(p.Re,Re);
  assert.ok(p.Re<30);
  for(const expected of ['17.24 kW/(m²·K)','1.724 kW','0.000766 kg/s','Re_f ≈ 21.9']) assert.ok(svg.includes(expected),expected);
});

test('40 segments use independent x^(1/4) laminar-film geometry and normalized thickness',()=>{
  const film=coordinates('film-boundary');
  const profile=coordinates('thickness-profile');
  assert.equal(film.length,41);
  assert.equal(profile.length,41);
  for(let i=0;i<=40;i++){
    const x=i/40;
    approximately(film[i][0],213+85*Math.pow(x,0.25),0.0012);
    approximately(film[i][1],276+278*x,0.0012);
    approximately(profile[i][0],140+569*x,0.0012);
    approximately(profile[i][1],826-136*Math.pow(x,0.25),0.0012);
    if(i>0){
      assert.ok(film[i][0]>film[i-1][0]);
      assert.ok(profile[i][1]<profile[i-1][1]);
    }
  }
  approximately(profile[0][1],826);
  approximately(profile[40][1],690);
  const endThickness=Math.pow(4*p.mu*p.k*p.deltaT*p.L/
    (p.rhoL*(p.rhoL-p.rhoV)*p.g*p.hfg),0.25);
  approximately(p.deltaEnd,endThickness,1e-10);
  // The plotted width is schematic, not the physical 0.053 mm scale.
  assert.match(svg,/膜の描画幅は模式的/);
});

test('local film conduction predicts decreasing flux downstream under constant ΔT',()=>{
  const delta=x=>p.deltaEnd*Math.pow(x,0.25);
  const localFlux=x=>p.k*p.deltaT/delta(x);
  assert.ok(localFlux(.10)>localFlux(.5));
  assert.ok(localFlux(.5)>localFlux(1));
  approximately(delta(1)/delta(.0625),2);
  approximately(localFlux(.0625)/localFlux(1),2);
  // 0.943 is a rounded Nusselt coefficient: it differs very slightly
  // from (4/3)/4^(1/4), so require relative rather than exact agreement.
  const hIntegrated=4*p.k/(3*p.deltaEnd);
  assert.ok(Math.abs(p.h-hIntegrated)/hIntegrated<.0003);
  assert.ok(svg.includes('同じ温度差なら局所流束は低下'));
});

test('method assumptions and limits are visible; no unproved real-fluid validity claim',()=>{
  assert.match(svg,/data-model="ideal-laminar-film"/);
  for(const word of ['壁温 T_w ＜ 飽和温度 T_sat','液膜を横切る伝導が支配的',
    '1/4 乗','Re_f ≲ 30 は目安','非凝縮ガス・波立ち・蒸気せん断は未評価',
    '原著図版の転載・トレースなし']) assert.ok(svg.includes(word),word);
  assert.doesNotMatch(svg,/実在流体の保証/);
});
