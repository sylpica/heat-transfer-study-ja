import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-5-6-semi-infinite-error-function.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const num=name=>{
  const result=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(result,'Missing '+name);
  const v=Number(result[1]);assert.ok(Number.isFinite(v),'Nonfinite '+name);return v;
};
const close=(got,expected,tol=1e-8)=>assert.ok(Math.abs(got-expected)<=tol,`${got} differs from ${expected}`);
const p={Ti:num('data-initial-c'),Ts:num('data-surface-c'),k:num('data-k'),a:num('data-alpha'),
  x:num('data-depth-m'),t:num('data-eval-time-s'),eta:num('data-eta'),
  T:num('data-temperature'),q:num('data-flux'),E:num('data-energy-per-area'),
  penetration:num('data-penetration-length')};

// Standalone reference for erf: numerical quadrature of exp(-u*u), unrelated to SVG drawing.
const erfQuad=z=>{
  const n=6000, h=z/n;
  let sum=1+Math.exp(-z*z);
  for(let i=1;i<n;i++)sum+=(i%2?4:2)*Math.exp(-((i*h)**2));
  return 2/Math.sqrt(Math.PI)*sum*h/3;
};
const T=(x,t)=>p.Ti+(p.Ts-p.Ti)*(1-erfQuad(x/(2*Math.sqrt(p.a*t))));

const getProfile=id=>{
  const match=svg.match(new RegExp('<path id="'+id+'" class="profile [^"]+" data-seconds="([0-9]+)" data-points="61" d="([^"]+)"\\/>'));
  assert.ok(match,'profile missing: '+id);
  return {seconds:Number(match[1]),pts:[...match[2].matchAll(/[ML]([0-9.]+),([0-9.]+)/g)].map(a=>[Number(a[1]),Number(a[2])])};
};

test('Japanese standalone original SVG includes title, description, responsive dark mode, and no external dependencies',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 840 1280"/);
  assert.match(svg,/role="img" aria-labelledby="semi-title semi-desc"/);
  assert.match(svg,/<title id="semi-title">/);
  assert.match(svg,/<desc id="semi-desc">/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="5\.6"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('temperature, penetration length, heat flux and total energy independently agree',()=>{
  assert.deepEqual([p.Ti,p.Ts,p.k,p.a,p.x,p.t,p.eta],[20,80,2,1e-6,.01,100,.5]);
  close(p.penetration,Math.sqrt(p.a*p.t));
  close(p.eta,p.x/(2*p.penetration));
  close(p.T,T(p.x,p.t),1e-7);
  close(p.T,48.77000733121721,1e-7);
  close(p.q,p.k*(p.Ts-p.Ti)/Math.sqrt(Math.PI*p.a*p.t),1e-7);
  close(p.q,6770.275002573076,1e-7);
  close(p.E,2*p.k*(p.Ts-p.Ti)*Math.sqrt(p.t/(Math.PI*p.a)),1e-6);
  close(p.E,1354055.000514615,1e-6);
  close(p.E,2*p.q*p.t,1e-6);
  assert.ok(p.q>0&&p.E>0,'positive heat flow in +x for surface heating');
});

test('all 183 plotted coordinates match an independent error-function approximation',()=>{
  assert.equal(num('data-profile-points'),61);
  const profiles=[['profile-t25',25],['profile-t100',100],['profile-t400',400]].map(([id,time])=>{
    const item=getProfile(id);assert.equal(item.seconds,time);assert.equal(item.pts.length,61);return item;
  });
  const py=temp=>562+(80-temp)/60*220;
  for(const {seconds,pts} of profiles){
    pts.forEach(([x,y],i)=>{
      const depth=.001*i;
      close(x,154+(740-154)*depth/.06,.00006);
      close(y,py(T(depth,seconds)),.00015);
      if(i)assert.ok(y>=pts[i-1][1],'temperature decreases deeper in the solid');
    });
    close(pts[0][1],562,.0001);
  }
  for(let i=1;i<61;i++){
    assert.ok(profiles[0].pts[i][1]>=profiles[1].pts[i][1],'larger time penetrates deeper');
    assert.ok(profiles[1].pts[i][1]>=profiles[2].pts[i][1],'larger time penetrates deeper');
  }
});

test('100 second, 10 mm highlighted marker has exact coordinates and units',()=>{
  const dot=svg.match(/<circle id="reference-temperature-point" class="mark" cx="([0-9.]+)" cy="([0-9.]+)" r="7"\/>/);
  assert.ok(dot);
  close(Number(dot[1]),154+(740-154)/6,.0004);
  close(Number(dot[2]),562+(80-p.T)/60*220,.0004);
  const p100=getProfile('profile-t100');
  close(p100.pts[10][0],Number(dot[1]),.0004);
  close(p100.pts[10][1],Number(dot[2]),.0004);
  assert.ok(svg.includes('100秒・深さ10 mmの温度 ≈ 48.77℃'));
});

test('specific boundary conditions, transient flux and integrated heat are not confused',()=>{
  for(const note of [
    '表面を80℃に保持','x≥0、初期は全域20℃',
    '内部への +x が正','2q_x″(100 s)×100 s','+1.354 MJ/m²',
    't→0+の流束発散は理想化による。実測の無限大ではない。',
    '有限板・有限h・放射・相変化への流用不可'
  ])assert.ok(svg.includes(note),note);
  const qAt=t=>p.k*(p.Ts-p.Ti)/Math.sqrt(Math.PI*p.a*t);
  const EAt=t=>2*p.k*(p.Ts-p.Ti)*Math.sqrt(t/(Math.PI*p.a));
  close(qAt(25)/qAt(100),2);
  close(EAt(100)/EAt(25),2);
  assert.ok(Number.isFinite(qAt(1e-6))&&EAt(1e-6)>0);
});
