import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-9-8-kandlikar-two-branches.svg', import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
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

const p={G:number('data-g-mass'),D:number('data-diameter'),mu:number('data-mu-l'),
  k:number('data-k-l'),cp:number('data-cp-l'),rhoL:number('data-rho-l'),rhoV:number('data-rho-v'),
  hfg:number('data-h-fg'),x:number('data-quality'),qw:number('data-q-wall'),
  fD:number('data-friction'),F:number('data-fluid-factor'),Re:number('data-re-lo'),
  Pr:number('data-pr'),NuLo:number('data-nu-lo'),hLo:number('data-h-lo'),
  Co:number('data-co'),Boi:number('data-boi'),Rn:number('data-r-nbd'),
  Rc:number('data-r-cbd'),hFb:number('data-h-fb'),dTw:number('data-delta-t-wall')};

test('§9.8 original SVG has accessible descriptions and no external references',()=>{
  common('9.8','flow');
});

test('Gnielinski h_lo and Kandlikar branches independently agree; larger branch wins',()=>{
  assert.deepEqual([p.G,p.D,p.mu,p.k,p.cp,p.rhoL,p.rhoV,p.hfg,p.x,p.qw,p.fD,p.F],
    [500,0.0200,2.00e-4,0.200,4000,800,4.00,1.0e6,0.250,4.00e4,0.0210,1.00]);
  approximately(p.Re,p.G*p.D/p.mu,1e-6);
  approximately(p.Pr,p.mu*p.cp/p.k,1e-9);
  const NuLo=(p.fD/8)*(p.Re-1000)*p.Pr/(1+12.7*Math.sqrt(p.fD/8)*(Math.pow(p.Pr,2/3)-1));
  approximately(p.NuLo,NuLo,1e-3);
  approximately(p.hLo,p.NuLo*p.k/p.D,1e-2);
  const Co=Math.pow((1-p.x)/p.x,0.8)*Math.sqrt(p.rhoV/p.rhoL);
  approximately(p.Co,Co,1e-9);
  approximately(p.Boi,p.qw/(p.G*p.hfg),1e-12);
  const Rn=Math.pow(1-p.x,0.8)*(0.6683*Math.pow(p.Co,-0.2)+1058*Math.pow(p.Boi,0.7)*p.F);
  const Rc=Math.pow(1-p.x,0.8)*(1.136*Math.pow(p.Co,-0.9)+667.2*Math.pow(p.Boi,0.7)*p.F);
  approximately(p.Rn,Rn,1e-6);
  approximately(p.Rc,Rc,1e-6);
  assert.ok(p.Rc>p.Rn);
  approximately(p.hFb,p.hLo*Math.max(Rn,Rc),1e-2);
  approximately(p.dTw,p.qw/p.hFb,1e-4);
  for(const expected of ['1.334×10^4 W/(m²·K)','壁温 ≈ 103.0 ℃']) assert.ok(svg.includes(expected),expected);
});

test('regime strip has five equal segments spanning the pipe',()=>{
  const m=svg.match(/<g id="regime-segments">([\s\S]*?)<\/g>/);
  assert.ok(m);
  const segs=[...m[1].matchAll(/<rect class="seg\d" x="([\d.]+)" y="330" width="126" height="90"\/>/g)];
  assert.equal(segs.length,5);
  for(let i=0;i<5;i++) approximately(Number(segs[i][1]),90+128*i,0.01);
  for(const word of ['過冷核沸騰','飽和核沸騰','スラグ流','環状流','ドライアウト'])
    assert.ok(svg.includes(word),word);
});

test('applicability limits are visible; result is not a CHF claim',()=>{
  for(const word of ['0 ＜ x ≦ 0.8','乾き前','限界熱流束や安全性の評価ではない','和・平均・最小値ではない'])
    assert.ok(svg.includes(word),word);
});
