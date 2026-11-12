import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const svg=readFileSync(new URL('../assets/lesson-diagrams/section-5-7-steady-2d-square-series.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const scalar=name=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'missing '+name);const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
// stable form of sinh(n pi y)/sinh(n pi) to avoid overflow at large n
const ratio=(n,y)=>Math.exp(n*Math.PI*(y-1))*(1-Math.exp(-2*n*Math.PI*y))/(1-Math.exp(-2*n*Math.PI));
function theta(x,y,nmax=401){
  let s=0;
  for(let n=1;n<=nmax;n+=2)s+=(4/(n*Math.PI))*Math.sin(n*Math.PI*x)*ratio(n,y);
  return s;
}
function partialCenter(terms){
  let s=0,n=1;
  for(let i=0;i<terms;i++){s+=(4/(n*Math.PI))*Math.sin(n*Math.PI/2)*ratio(n,0.5);n+=2;}
  return s;
}
const pathPts=id=>{
  const m=svg.match(new RegExp('<path id="'+id+'"[^>]*d="([^"]+)"'));
  assert.ok(m,id);
  return [...m[1].matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(z=>[Number(z[1]),Number(z[2])]);
};
test('original SVG with Japanese alt text, offline-safe dependencies, adaptable color contrast',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="steady2d-title steady2d-desc"/);
  assert.match(svg,/<title id="steady2d-title">/);
  assert.match(svg,/<desc id="steady2d-desc">/);
  assert.match(svg,/viewBox="0 0 840 1390"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.match(svg,/data-lesson="5\.7"/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});
test('center partial sums match pinned values and converge to 1/4',()=>{
  const S1=partialCenter(1),S2=partialCenter(2),S3=partialCenter(3);
  assert.ok(Math.abs(S1-0.25371641666082453)<1e-9,'n = 1 term');
  assert.ok(Math.abs(S2-0.24990409718984456)<1e-9,'n = 1, 3');
  assert.ok(Math.abs(S3-0.25000295230907341)<1e-9,'n = 1, 3, 5');
  assert.ok(Math.abs(scalar('data-partial-1')-S1)<1e-9);
  assert.ok(Math.abs(scalar('data-partial-2')-S2)<1e-9);
  assert.ok(Math.abs(scalar('data-partial-3')-S3)<1e-9);
  assert.ok(Math.abs(S3-0.25)<3e-6,'converged to symmetry value');
  assert.ok(Math.abs(theta(0.5,0.5)-0.25)<1e-9,'full series center = 1/4');
  assert.equal(scalar('data-center-theta'),0.25);
  assert.equal(scalar('data-center-temperature'),40);
  assert.ok(Math.abs((20+80*S1)-40.29731333286596)<1e-9);
  assert.ok(Math.abs((20+80*S2)-39.992327775187565)<1e-9);
  assert.ok(Math.abs((20+80*S3)-40.00023618472588)<1e-9);
});
test('vertical centerline profile follows the series from cold bottom to hot top',()=>{
  const pts=pathPts('profile-vertical');
  assert.equal(pts.length,41);
  for(let i=0;i<pts.length;i++){
    const pos=i/40,th=theta(0.5,pos);
    assert.ok(Math.abs(pts[i][0]-(150+pos*640))<0.02,'x pos='+pos);
    const tol=(i===0||i===40)?4.0:1.6;
    assert.ok(Math.abs(pts[i][1]-(780-th*200))<tol,'y pos='+pos+' theta='+th);
    if(i>0)assert.ok(pts[i][1]<pts[i-1][1],'theta increases toward hot top');
  }
  assert.ok(Math.abs(theta(0.5,0))<1e-12,'bottom edge theta = 0');
  assert.ok(Math.abs(theta(0.5,1)-1)<0.01,'top edge theta = 1');
  assert.ok(Math.abs(pts[20][1]-730)<1.6,'center point at theta = 0.25');
});
test('horizontal centerline profile is symmetric with maximum 1/4 at center',()=>{
  const pts=pathPts('profile-horizontal');
  assert.equal(pts.length,41);
  for(let i=0;i<pts.length;i++){
    const pos=i/40,th=theta(pos,0.5);
    assert.ok(Math.abs(pts[i][0]-(150+pos*640))<0.02,'x pos='+pos);
    assert.ok(Math.abs(pts[i][1]-(780-th*200))<1.6,'y pos='+pos);
    assert.ok(Math.abs(pts[i][1]-pts[40-i][1])<0.02,'left-right symmetry');
  }
  assert.ok(Math.abs(theta(0,0.5))<1e-12&&Math.abs(theta(1,0.5))<1e-12,'side edges theta = 0');
  assert.ok(Math.abs(pts[20][1]-730)<1.6,'center at theta = 0.25');
  for(let i=0;i<pts.length;i++)assert.ok(pts[i][1]>=pts[20][1]-0.02,'center is the warmest on this line');
});
test('convergence plot points encode the three partial sums on the zoomed axis',()=>{
  const pts=pathPts('center-partials');
  assert.equal(pts.length,3);
  const xs=[240,460,680],Ss=[partialCenter(1),partialCenter(2),partialCenter(3)];
  for(let i=0;i<3;i++){
    assert.ok(Math.abs(pts[i][0]-xs[i])<0.02,'x i='+i);
    assert.ok(Math.abs(pts[i][1]-(1090-(Ss[i]-0.2485)*23076.9230769))<0.2,'y i='+i);
  }
  assert.ok(pts[0][1]<pts[2][1]&&pts[2][1]<pts[1][1]+0.2,'first term overshoots, later sums settle near 1/4 line');
});
