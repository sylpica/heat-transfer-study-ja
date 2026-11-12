import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-8-3-vertical-plate-boundary-layer.svg', import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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

const p={beta:number('data-beta'),dT:number('data-dt'),L:number('data-length'),
  W:number('data-width'),nu:number('data-nu'),alpha:number('data-alpha'),k:number('data-k'),
  Pr:number('data-pr'),Ra:number('data-ra'),Nu:number('data-nu-avg'),h:number('data-h'),
  Q:number('data-q'),deltaTop:number('data-delta-top-m'),deltaRatio:number('data-delta-ratio')};

test('§8.3 original SVG has accessible descriptions and no external references',()=>{
  common('8.3','nc');
});

test('Churchill-Chu laminar correlation independently agrees',()=>{
  assert.deepEqual([p.dT,p.L,p.W,p.nu,p.alpha,p.k],[20,0.50,0.20,1.6e-5,2.2e-5,0.0267]);
  rel(p.beta,1/303.15);
  rel(p.Pr,p.nu/p.alpha);
  rel(p.Ra,9.81*p.beta*p.dT*p.L**3/(p.nu*p.alpha));
  const Nu=0.68+0.670*Math.pow(p.Ra,0.25)/Math.pow(1+Math.pow(0.492/p.Pr,9/16),4/9);
  rel(p.Nu,Nu,1e-9);
  rel(p.h,p.Nu*p.k/p.L,1e-9);
  rel(p.Q,p.h*(p.L*p.W)*p.dT,1e-9);
  assert.ok(p.Ra>1e4&&p.Ra<1e9);
  for(const expected of ['平均 Nu_L ≈ 64.17','3.427 W/(m²·K)','+6.85 W']) assert.ok(svg.includes(expected),expected);
});

test('boundary-layer shape follows x^(1/4); Squire-Eckert profiles have the stated forms',()=>{
  const layer=coordinates('layer-boundary');
  assert.equal(layer.length,41);
  for(let i=0;i<=40;i++){
    const x=i/40;
    approximately(layer[i][0],213+150*Math.pow(x,0.25),0.0012);
    approximately(layer[i][1],554-278*x,0.0012);
  }
  const Gr=p.Ra/p.Pr;
  const ratio=3.936*Math.pow((0.952+p.Pr)/p.Pr**2,0.25)*Math.pow(Gr,-0.25);
  rel(p.deltaRatio,ratio,1e-9);
  approximately(p.deltaTop,ratio*p.L,1e-9);
  const temp=coordinates('temperature-profile');
  const vel=coordinates('velocity-profile');
  assert.equal(temp.length,21); assert.equal(vel.length,21);
  for(let i=0;i<=20;i++){
    const eta=i/20;
    approximately(temp[i][1],826-136*(1-eta)**2,0.0012);
    approximately(vel[i][1],826-136*(27/4)*eta*(1-eta)**2,0.0012);
  }
  // velocity maximum at eta = 1/3 (sample i closest: eta=0.35 vs 0.30 -> check derivative sign change)
  assert.ok(vel[7][1]<vel[6][1]&&vel[7][1]<vel[8][1]);
  assert.match(svg,/境界層の描画幅は模式的/);
});

test('applicability range is visible; radiation excluded',()=>{
  for(const word of ['10^4 ≲ Ra_L ≲ 10^9','放射は含まない','膜温度 T_f=(T_w+T_∞)/2'])
    assert.ok(svg.includes(word),word);
});
