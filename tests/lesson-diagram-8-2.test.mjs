import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-8-2-film-velocity-profile.svg', import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const number=(key)=>{{
  const match=svg.match(new RegExp('\\b'+key+'="([^"]+)"'));
  assert.ok(match,'Missing numeric attribute '+key);
  const value=Number(match[1]);
  assert.ok(Number.isFinite(value),'Not finite: '+key);
  return value;
}};
const approximately=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${{a}} differs from ${{b}}`);
const rel=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol*Math.abs(b),`${{a}} differs from ${{b}}`);
const coordinates=(id)=>{{
  const match=svg.match(new RegExp('<path id="'+id+'"[^>]*d="([^"]+)"'));
  assert.ok(match,'Missing path '+id);
  return [...match[1].matchAll(/[ML]\s+([\d.]+)\s+([\d.]+)/g)].map(x=>[Number(x[1]),Number(x[2])]);
}};
const common=(lesson,prefix)=>{{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 840 1280"/);
  assert.match(svg,new RegExp('aria-labelledby="'+prefix+'-title '+prefix+'-desc"'));
  assert.match(svg,new RegExp('<title id="'+prefix+'-title">'));
  assert.match(svg,new RegExp('<desc id="'+prefix+'-desc">'));
  assert.match(svg,new RegExp('data-lesson="'+lesson.replace('.','\\.')+'"'));
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自模式図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
}};

const p={rhoL:number('data-rho-l'),rhoV:number('data-rho-v'),mu:number('data-mu-l'),
  k:number('data-k-l'),hfg:number('data-h-fg'),g:number('data-g'),
  L:number('data-length'),W:number('data-width'),dT:number('data-delta-t'),
  delta:number('data-delta-end-m'),hLoc:number('data-h-local'),hAvg:number('data-h-average'),
  Q:number('data-q'),Gamma:number('data-gamma-end'),Re:number('data-re-film'),
  uS:number('data-u-surface'),uMean:number('data-u-mean')};

test('§8.2 original SVG has accessible descriptions and no external references',()=>{
  common('8.2','film2');
});

test('film thickness, h, Q, Gamma and Re independently agree and close the balance',()=>{
  assert.deepEqual([p.rhoL,p.rhoV,p.mu,p.k,p.hfg,p.g,p.L,p.W,p.dT],
    [1000,1.0,1.0e-3,0.60,2.0e6,9.81,0.20,0.10,10]);
  const delta=Math.pow(4*p.mu*p.k*p.dT*p.L/(p.rhoL*(p.rhoL-p.rhoV)*p.g*p.hfg),0.25);
  approximately(p.delta,delta,1e-10);
  approximately(p.hLoc,p.k/delta,1e-4);
  approximately(p.hAvg,4/3*p.hLoc,1e-4);
  approximately(p.Q,p.hAvg*p.W*p.L*p.dT,1e-4);
  const Gamma=p.rhoL*(p.rhoL-p.rhoV)*p.g*delta**3/(3*p.mu);
  approximately(p.Gamma,Gamma,1e-9);
  approximately(p.W*p.Gamma*p.hfg,p.Q,1e-3);
  approximately(p.Re,4*Gamma/p.mu,1e-6);
  for(const expected of ['0.1251 mm','6395 W/(m²·K)','1.279 kW','Re_f ≈ 25.6']) assert.ok(svg.includes(expected),expected);
});

test('velocity profile follows u/u_s = 2 eta - eta^2 and film shape follows x^(1/4)',()=>{
  const prof=coordinates('velocity-profile');
  assert.equal(prof.length,21);
  for(let i=0;i<=20;i++){
    const eta=i/20;
    approximately(prof[i][0],170+470*(2*eta-eta**2),0.0012);
    approximately(prof[i][1],826-145*eta,0.0012);
  }
  approximately(p.uS,(p.rhoL-p.rhoV)*p.g*p.delta**2/(2*p.mu),1e-9);
  approximately(p.uMean,p.Gamma/(p.rhoL*p.delta),1e-9);
  approximately(p.uMean,2/3*p.uS,1e-9);
  const film=coordinates('film-boundary');
  assert.equal(film.length,41);
  for(let i=0;i<=40;i++){
    const x=i/40;
    approximately(film[i][0],213+85*Math.pow(x,0.25),0.0012);
    approximately(film[i][1],276+278*x,0.0012);
  }
  assert.match(svg,/膜の描画幅は模式的/);
});

test('model assumptions and limits are visible',()=>{
  assert.match(svg,/data-model="ideal-laminar-film"/);
  for(const word of ['表面でせん断なし','単相流の「全流量一定」とは違う','波・せん断は未評価'])
    assert.ok(svg.includes(word),word);
});
