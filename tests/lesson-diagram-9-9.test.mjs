import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-9-9-shear-film-stopping-condition.svg', import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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

const p={mu:number('data-mu'),k:number('data-k'),dT:number('data-delta-t'),x:number('data-x'),
  hfg:number('data-h-fg-prime'),rhoF:number('data-rho-f'),rhoG:number('data-rho-g'),
  g:number('data-g'),rhs:number('data-rhs'),d0:number('data-delta-noshear'),
  tauStop:number('data-tau-stop'),tauDown:number('data-tau-down'),dDown:number('data-delta-down')};
const solveDelta=(tau)=>{
  const c=4*tau/(3*(p.rhoF-p.rhoG)*p.g);
  let lo=0,hi=p.d0;
  for(let i=0;i<200;i++){
    const mid=(lo+hi)/2;
    if(mid**4+c*mid**3<p.rhs) lo=mid; else hi=mid;
  }
  return (lo+hi)/2;
};

test('§9.9 original SVG has accessible descriptions and no external references',()=>{
  common('9.9','shear');
});

test('eq. (9.53) film thickness with and without shear independently agrees',()=>{
  assert.deepEqual([p.mu,p.k,p.dT,p.x,p.hfg,p.rhoF,p.rhoG,p.g],
    [2.8e-4,0.68,10,0.10,2.25e6,950,0.6,9.81]);
  const rhs=4*p.mu*p.k*p.dT*p.x/(p.g*p.hfg*p.rhoF*(p.rhoF-p.rhoG));
  approximately(p.rhs,rhs,1e-20);
  approximately(p.d0,Math.pow(rhs,0.25),1e-10);
  approximately(solveDelta(0),p.d0,1e-10);
  approximately(p.dDown,solveDelta(p.tauDown),1e-10);
  assert.ok(p.dDown<p.d0);
  for(const expected of ['7.86×10^(-5) m']) assert.ok(svg.includes(expected),expected);
});

test('stopping shear follows eq. (9.54): proportional to delta, not a fixed threshold',()=>{
  approximately(p.tauStop,-(3/4)*p.g*(p.rhoF-p.rhoG)*p.d0,1e-6);
  const line=coordinates('tau-stop-line');
  assert.equal(line.length,2);
  approximately(line[0][0],170,0.0012); approximately(line[0][1],700,0.0012);
  approximately(line[1][0],640,0.0012);
  approximately(line[1][1],700+126*(0.75*p.g*(p.rhoF-p.rhoG)*2e-4/1.6),0.01);
  const pt=svg.match(/<circle id="tau-stop-point"[^>]*cx="([\d.]+)" cy="([\d.]+)"/);
  assert.ok(pt);
  approximately(Number(pt[1]),170+470*(p.d0/2e-4),0.01);
  approximately(Number(pt[2]),700+126*(-p.tauStop/1.6),0.01);
});

test('the momentary nature of the stop is stated as in the original text',()=>{
  for(const word of ['固定の閾値ではない','その δ における一瞬','δ が育てば流れは再開する'])
    assert.ok(svg.includes(word),word);
  assert.doesNotMatch(svg,/排水が恒常的に停止/);
});
