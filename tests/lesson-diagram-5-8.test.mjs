import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const svg=readFileSync(new URL('../assets/lesson-diagrams/section-5-8-product-solution-square-bar.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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
const Th0=A1*Math.exp(-lam1*lam1*0.5),Thbar=Th0*Math.sin(lam1)/lam1;
const pathPts=id=>{
  const m=svg.match(new RegExp('<path id="'+id+'"[^>]*d="([^"]+)"'));
  assert.ok(m,id);
  return [...m[1].matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(z=>[Number(z[1]),Number(z[2])]);
};
test('original SVG with Japanese alt text, offline-safe dependencies, adaptable color contrast',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="product-title product-desc"/);
  assert.match(svg,/<title id="product-title">/);
  assert.match(svg,/<desc id="product-desc">/);
  assert.match(svg,/viewBox="0 0 840 1368"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.match(svg,/data-lesson="5\.8"/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});
test('one-dimensional factors match the section 5.5 values for Bi = 1, Fo = 0.5',()=>{
  assert.ok(Math.abs(scalar('data-center-1d')-Th0)<1e-9);
  assert.ok(Math.abs(scalar('data-mean-1d')-Thbar)<1e-9);
  assert.ok(Math.abs(Th0-0.7729556933327801)<1e-12);
  assert.ok(Math.abs(Thbar-0.6810694470351022)<1e-12);
});
test('center and mean of the product solution are squares of the 1D values',()=>{
  const c=scalar('data-center-product'),m=scalar('data-mean-product');
  assert.ok(Math.abs(c-Th0*Th0)<1e-9);
  assert.ok(Math.abs(m-Thbar*Thbar)<1e-9);
  assert.ok(Math.abs(c-0.5974605038555588)<1e-12);
  assert.ok(Math.abs(m-0.4638555916847)<1e-12);
  assert.ok(Math.abs((20+80*c)-67.7968403084447)<1e-9,'center 67.80 C');
  assert.ok(Math.abs((20+80*m)-57.108447334776)<1e-9,'mean 57.11 C');
  assert.ok(c<Th0&&m<Thbar,'two-direction cooling is faster than one direction');
  assert.ok(m<c,'mean is below center for cooling');
});
test('centerline profiles: product profile is the 1D profile scaled by the other center value',()=>{
  const p1=pathPts('profile-1d'),p2=pathPts('profile-product');
  assert.equal(p1.length,41);assert.equal(p2.length,41);
  for(let i=0;i<41;i++){
    const xi=i/40,co=Math.cos(lam1*xi);
    assert.ok(Math.abs(p1[i][0]-(150+xi*640))<0.02,'x xi='+xi);
    assert.ok(Math.abs(p1[i][1]-(725-Th0*co*200))<0.02,'1d y xi='+xi);
    assert.ok(Math.abs(p2[i][1]-(725-Th0*Th0*co*200))<0.02,'product y xi='+xi);
    assert.ok(Math.abs((725-p2[i][1])-Th0*(725-p1[i][1]))<0.05,'pointwise ratio = Theta0, xi='+xi);
    assert.ok(p2[i][1]>p1[i][1],'product theta is lower everywhere');
  }
});
test('heat-release fraction composes on the remaining fraction, not by doubling',()=>{
  const width=id=>{
    const m=svg.match(new RegExp('<rect id="'+id+'"[^>]*width="([\\d.]+)"'));
    assert.ok(m,id);return Number(m[1]);
  };
  const phi1=1-Thbar,phi=scalar('data-heat-fraction'),naive=scalar('data-naive-sum');
  assert.ok(Math.abs(phi1-0.3189305529648978)<1e-12);
  assert.ok(Math.abs(phi-(1-Thbar*Thbar))<1e-9);
  assert.ok(Math.abs(phi-0.5361444083153001)<1e-12);
  assert.ok(Math.abs(phi-(phi1+phi1*(1-phi1)))<1e-12,'Phi = Phi1 + Phi2(1 - Phi1), eq. (5.72c) form');
  assert.ok(Math.abs(naive-2*phi1)<1e-9);
  assert.ok(Math.abs(naive-0.6378611059297955)<1e-12);
  assert.ok(naive>phi,'naive doubling overcounts the same body');
  assert.ok(Math.abs(width('bar-one-dir')-phi1*480)<0.02);
  assert.ok(Math.abs(width('bar-naive')-naive*480)<0.02);
  assert.ok(Math.abs(width('bar-product')-phi*480)<0.02);
});
