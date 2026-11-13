import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-9-11-heat-pipe-capillary-budget.svg', import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
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

const p={Q:number('data-q-load'),hfg:number('data-h-fg'),mdot:number('data-mass-rate'),
  sigma:number('data-sigma'),rEff:number('data-r-eff'),dpCap:number('data-dp-cap'),
  dpL:number('data-dp-liquid'),dpV:number('data-dp-vapor'),dpG:number('data-dp-gravity'),
  margin:number('data-dp-margin'),aL:number('data-a-liquid'),aV:number('data-a-vapor'),
  qCap:number('data-q-cap-candidate'),qEnt:number('data-q-ent-candidate'),
  qEvap:number('data-q-evap-candidate'),M:number('data-merit')};

test('§9.11 original SVG has accessible descriptions and no external references',()=>{
  common('9.11','pipe');
});

test('capillary pressure budget independently closes',()=>{
  assert.deepEqual([p.Q,p.hfg,p.sigma,p.rEff,p.dpL,p.dpV],[200,1.0e6,0.040,20e-6,1500,500]);
  approximately(p.mdot,p.Q/p.hfg,1e-12);
  approximately(p.dpCap,2*p.sigma/p.rEff,1e-6);
  approximately(p.dpG,800*10*0.10,1e-6);
  approximately(p.dpL+p.dpV+p.dpG+p.margin,p.dpCap,1e-6);
  approximately(p.margin,1200,1e-6);
  for(const expected of ['4000 = 必要 2800 ＋ 余裕 1200','0.20 g/s']) assert.ok(svg.includes(expected),expected);
});

test('stacked pressure bar segments are proportional and contiguous',()=>{
  const m=svg.match(/<g id="pressure-stack">([\s\S]*?)<\/g>/);
  assert.ok(m);
  const segs=[...m[1].matchAll(/<rect class="seg\w" x="([\d.]+)" y="760" width="([\d.]+)" height="34"\/>/g)];
  assert.equal(segs.length,4);
  const parts=[p.dpL,p.dpV,p.dpG,p.margin];
  let cursor=150;
  for(let i=0;i<4;i++){
    approximately(Number(segs[i][1]),cursor,0.15);
    approximately(Number(segs[i][2]),parts[i]*0.11,0.15);
    cursor+=parts[i]*0.11;
  }
  approximately(cursor,150+p.dpCap*0.11,0.2);
});

test('transport-limit candidates are evaluated separately and independently agree',()=>{
  const aV=8*2.00e-5*1.00/(Math.PI*Math.pow(0.00400,4)*2.00*1.00e6);
  approximately(p.aV,aV,1e-9);
  approximately(p.qCap,(4000-800)/(p.aL+p.aV),1e-4);
  const A=Math.PI*0.00400**2;
  approximately(p.qEnt,A*1.00e6*Math.sqrt(0.500*0.0400*2.00/0.00100),1e-2);
  approximately(p.qEvap,1.00e5*5.00e-4,1e-9);
  assert.ok(p.qCap<p.qEvap&&p.qEvap<p.qEnt);
  approximately(p.M,1.00e6*0.0400/1.25e-6,1);
  for(const word of ['別々に評価する','だけでは選定できない']) assert.ok(svg.includes(word),word);
});
