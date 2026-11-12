import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const svg=readFileSync(new URL('../assets/lesson-diagrams/section-5-5-one-term-eigenvalue-series.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const scalar=name=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'missing '+name);const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
function rootBi(Bi,j){
  let lo=j*Math.PI+1e-12,hi=(j+0.5)*Math.PI-1e-12,flo=lo*Math.tan(lo)-Bi;
  for(let i=0;i<200;i++){const mid=(lo+hi)/2,fm=mid*Math.tan(mid)-Bi;if((fm>0)===(flo>0)){lo=mid;flo=fm;}else hi=mid;}
  return (lo+hi)/2;
}
const roots=Array.from({length:15},(_,j)=>rootBi(1,j));
const A=r=>4*Math.sin(r)/(2*r+Math.sin(2*r));
const lam1=roots[0],lam2=roots[1],A1=A(lam1);
const Th0=A1*Math.exp(-lam1*lam1*0.5);
const seriesCenter=fo=>roots.reduce((s,r)=>s+A(r)*Math.exp(-r*r*fo),0);
const pathPts=id=>{
  const m=svg.match(new RegExp('<path id="'+id+'"[^>]*d="([^"]+)"'));
  assert.ok(m,id);
  return [...m[1].matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(z=>[Number(z[1]),Number(z[2])]);
};
test('original SVG with Japanese alt text, offline-safe dependencies, adaptable color contrast',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="oneterm-title oneterm-desc"/);
  assert.match(svg,/<title id="oneterm-title">/);
  assert.match(svg,/<desc id="oneterm-desc">/);
  assert.match(svg,/viewBox="0 0 840 1370"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.match(svg,/data-lesson="5\.5"/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});
test('first two roots of lambda tan lambda = Bi and A1 match book-table values',()=>{
  assert.ok(Math.abs(lam1*Math.tan(lam1)-1)<1e-12);
  assert.ok(Math.abs(lam2*Math.tan(lam2)-1)<1e-9);
  assert.ok(Math.abs(lam1-0.8603335890193798)<1e-12);
  assert.ok(Math.abs(lam2-3.4256184594817283)<1e-9);
  assert.ok(Math.abs(scalar('data-lambda-1')-lam1)<1e-9);
  assert.ok(Math.abs(scalar('data-lambda-2')-lam2)<1e-9);
  assert.ok(Math.abs(A1-1.1191320084054336)<1e-12,'A1 for Bi = 1.00 row');
  assert.ok(A1>1,'one-term extrapolation to t = 0 exceeds 1');
  assert.ok(Math.abs(scalar('data-coefficient-a1')-A1)<1e-9);
});
test('eigenvalue curves are lambda tan lambda on both branches with shared mapping',()=>{
  const seg=(id,lo,hi)=>{
    const pts=pathPts(id);
    assert.equal(pts.length,41,id);
    for(let i=0;i<pts.length;i++){
      const lam=lo+(hi-lo)*i/40,v=lam*Math.tan(lam);
      assert.ok(Math.abs(pts[i][0]-(120+lam*138.7755102))<0.02,id+' x i='+i);
      assert.ok(Math.abs(pts[i][1]-(420-v*48))<0.03,id+' y i='+i);
    }
  };
  seg('eigen-curve-1',0.02,1.30);
  seg('eigen-curve-2',3.30,3.95);
});
test('full series starts at 1 and converges to one-term; one-term pinned at Fo = 0.5',()=>{
  const ps=pathPts('series-full'),po=pathPts('series-one-term');
  assert.equal(ps.length,41);assert.equal(po.length,41);
  for(let i=0;i<ps.length;i++){
    const fo=i/40;
    assert.ok(Math.abs(ps[i][0]-(150+fo*640))<0.02,'series x');
    assert.ok(Math.abs(ps[i][1]-(770-seriesCenter(fo)*165.2))<0.03,'series y fo='+fo);
    assert.ok(Math.abs(po[i][1]-(770-A1*Math.exp(-lam1*lam1*fo)*165.2))<0.03,'one-term y fo='+fo);
  }
  assert.ok(Math.abs(seriesCenter(0)-1)<6e-4,'15-term partial sum at Fo = 0 (truncation level)');
  const longSum=Array.from({length:200},(_,j)=>rootBi(1,j)).reduce((s,r)=>s+A(r),0);
  assert.ok(Math.abs(longSum-1)<3e-6,'full expansion of the uniform initial condition sums to 1');
  assert.ok(Math.abs(seriesCenter(1)-A1*Math.exp(-lam1*lam1))<1e-5,'Fo = 1: series and one-term agree');
  assert.ok(Math.abs(seriesCenter(0.05)-0.9997509551)<1e-6,'short time needs higher terms');
  assert.ok(A1*Math.exp(-lam1*lam1*0.05)>1.07,'one-term overshoots at Fo = 0.05');
  assert.ok(Math.abs(scalar('data-center-theta')-Th0)<1e-9);
  assert.ok(Math.abs(Th0-0.7729556933327801)<1e-12);
});
test('position profile and mean at Fo = 0.5 follow one-term formulas',()=>{
  const pts=pathPts('theta-profile');
  assert.equal(pts.length,41);
  for(let i=0;i<pts.length;i++){
    const xi=i/40,th=Th0*Math.cos(lam1*xi);
    assert.ok(Math.abs(pts[i][0]-(150+xi*640))<0.02,'x xi='+xi);
    assert.ok(Math.abs(pts[i][1]-(1100-th*195))<0.02,'y xi='+xi);
  }
  const pos=scalar('data-position-theta'),mean=scalar('data-mean-theta');
  assert.ok(Math.abs(pos-Th0*Math.cos(lam1/2))<1e-9);
  assert.ok(Math.abs(pos-0.7025364965121704)<1e-12);
  assert.ok(Math.abs(mean-Th0*Math.sin(lam1)/lam1)<1e-9);
  assert.ok(Math.abs(mean-0.6810694470351022)<1e-12);
  assert.ok(Math.abs((20+80*pos)-76.20291972097363)<1e-9);
  assert.ok(Math.abs((20+80*mean)-74.48555576280818)<1e-9);
});
