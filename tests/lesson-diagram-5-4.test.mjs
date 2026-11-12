import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const svg=readFileSync(new URL('../assets/lesson-diagrams/section-5-4-response-chart-profile-reading.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const scalar=name=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'missing '+name);const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
function rootBi(Bi){
  let lo=1e-12,hi=Math.PI/2-1e-12,flo=lo*Math.tan(lo)-Bi;
  for(let i=0;i<200;i++){const mid=(lo+hi)/2,fm=mid*Math.tan(mid)-Bi;if((fm>0)===(flo>0)){lo=mid;flo=fm;}else hi=mid;}
  return (lo+hi)/2;
}
const lam1=rootBi(1),A1=4*Math.sin(lam1)/(2*lam1+Math.sin(2*lam1));
const Th0=A1*Math.exp(-lam1*lam1*0.5);
const pathPts=id=>{
  const m=svg.match(new RegExp('<path id="'+id+'"[^>]*d="([^"]+)"'));
  assert.ok(m,id);
  return [...m[1].matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(z=>[Number(z[1]),Number(z[2])]);
};
test('original SVG with Japanese alt text, offline-safe dependencies, adaptable color contrast',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="chart-title chart-desc"/);
  assert.match(svg,/<title id="chart-title">/);
  assert.match(svg,/<desc id="chart-desc">/);
  assert.match(svg,/viewBox="0 0 840 1270"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.match(svg,/data-lesson="5\.4"/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});
test('eigenvalue and coefficient for Bi = 1 agree with data attributes',()=>{
  assert.ok(Math.abs(lam1*Math.tan(lam1)-1)<1e-12);
  assert.ok(Math.abs(lam1-0.8603335890193798)<1e-12);
  assert.ok(Math.abs(scalar('data-lambda-1')-lam1)<1e-9);
  assert.ok(Math.abs(scalar('data-coefficient-a1')-A1)<1e-9);
  assert.ok(Math.abs(A1-1.1191320084054336)<1e-12);
  assert.ok(Math.abs(scalar('data-center-theta')-Th0)<1e-9);
  assert.ok(Math.abs(Th0-0.7729556933327801)<1e-12);
});
test('three center-response curves follow one-term solutions for Bi = 0.05, 1, infinity',()=>{
  const cases=[['theta0-bi-005',rootBi(0.05)],['theta0-bi-1',lam1],['theta0-bi-inf',Math.PI/2]];
  for(const [id,lam] of cases){
    const A=4*Math.sin(lam)/(2*lam+Math.sin(2*lam));
    const pts=pathPts(id);
    assert.equal(pts.length,41,id);
    for(let i=0;i<pts.length;i++){
      const fo=i/40,th=A*Math.exp(-lam*lam*fo);
      assert.ok(Math.abs(pts[i][0]-(150+fo*640))<0.02,id+' x i='+i);
      assert.ok(Math.abs(pts[i][1]-(460-th*230))<0.02,id+' y i='+i);
    }
  }
  const p005=pathPts('theta0-bi-005'),p1=pathPts('theta0-bi-1'),pinf=pathPts('theta0-bi-inf');
  // At Fo = 0 each one-term curve starts at its own A1 (> 1, larger for larger Bi),
  // so the physical ordering "smaller Bi stays warmer" is checked for Fo >= 0.25.
  for(let i=10;i<41;i++)assert.ok(p005[i][1]<p1[i][1]&&p1[i][1]<pinf[i][1],'smaller Bi stays warmer at same Fo, i='+i);
});
test('position profile is center value times cos(lambda1 xi), pinned at xi = 0.5',()=>{
  const pts=pathPts('theta-profile');
  assert.equal(pts.length,41);
  for(let i=0;i<pts.length;i++){
    const xi=i/40,th=Th0*Math.cos(lam1*xi);
    assert.ok(Math.abs(pts[i][0]-(150+xi*640))<0.02,'x xi='+xi);
    assert.ok(Math.abs(pts[i][1]-(830-th*220))<0.02,'y xi='+xi);
  }
  const ratio=scalar('data-position-ratio'),pos=scalar('data-position-theta');
  assert.ok(Math.abs(ratio-Math.cos(lam1/2))<1e-9);
  assert.ok(Math.abs(ratio-0.9088962052702131)<1e-12);
  assert.ok(Math.abs(pos-Th0*ratio)<1e-9);
  assert.ok(Math.abs(pos-0.7025364965121704)<1e-12);
  const surface=Th0*Math.cos(lam1);
  assert.ok(surface<scalar('data-mean-theta')&&scalar('data-mean-theta')<pos&&pos<Th0,'ordering surface < mean < position < center');
});
test('assembly bars and heat fraction use mean, not center',()=>{
  const width=id=>{
    const m=svg.match(new RegExp('<rect id="'+id+'"[^>]*width="([\\d.]+)"'));
    assert.ok(m,id);return Number(m[1]);
  };
  const mean=scalar('data-mean-theta');
  assert.ok(Math.abs(mean-Th0*Math.sin(lam1)/lam1)<1e-9);
  assert.ok(Math.abs(mean-0.6810694470351022)<1e-12);
  assert.ok(Math.abs(width('bar-center')-Th0*500)<0.02);
  assert.ok(Math.abs(width('bar-position')-scalar('data-position-theta')*500)<0.02);
  assert.ok(Math.abs(width('bar-mean')-mean*500)<0.02);
  assert.ok(Math.abs(scalar('data-heat-fraction')-(1-mean))<1e-9);
  assert.ok(Math.abs(scalar('data-heat-fraction')-0.3189305529648978)<1e-12);
  assert.ok(Math.abs((20+80*Th0)-81.83645546662241)<1e-9);
  assert.ok(Math.abs((20+80*mean)-74.48555576280818)<1e-9);
});
