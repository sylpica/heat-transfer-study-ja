import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const svg=readFileSync(new URL('../assets/lesson-diagrams/section-5-3-transient-slab-cooling.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
const scalar=name=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'missing '+name);const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
const Bi=scalar('data-biot'), k=scalar('data-k'),h=scalar('data-h'),L=scalar('data-half-thickness'),alpha=scalar('data-alpha');
function roots(n){const r=[];for(let j=0;j<n;j++){
  let a=j*Math.PI+1e-10,b=(j+.5)*Math.PI-1e-10;
  for(let i=0;i<90;i++){const mid=(a+b)/2;if(mid*Math.tan(mid)>Bi)b=mid;else a=mid;}
  r.push((a+b)/2);
}return r;}
const u=roots(15),c=u.map(v=>4*Math.sin(v)/(2*v+Math.sin(2*v)));
const theta=(xi,Fo)=>u.reduce((acc,mu,i)=>acc+c[i]*Math.exp(-mu*mu*Fo)*Math.cos(mu*xi),0);
const derivative=(xi,Fo)=>u.reduce((acc,mu,i)=>acc-c[i]*Math.exp(-mu*mu*Fo)*mu*Math.sin(mu*xi),0);
const path=fo=>{const key=fo===0.25?'theta-fo-025':'theta-fo-1';const m=svg.match(new RegExp('<path id="'+key+'"[^>]*d="([^"]+)"/>'));assert.ok(m,key);return [...m[1].matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(z=>[Number(z[1]),Number(z[2])]);};
test('original SVG with Japanese alt text, offline-safe dependencies, adaptable color contrast',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="slab-title slab-desc"/);
  assert.match(svg,/<title id="slab-title">/);
  assert.match(svg,/<desc id="slab-desc">/);
  assert.match(svg,/viewBox="0 0 820 1230"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.match(svg,/data-lesson="5\.3"/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
  assert.doesNotMatch(svg,/Tᵢ|□/);
});
test('section 5.3 worked example and Fourier number convention',()=>{
  assert.equal(Bi,0.2);assert.equal(h,50);assert.equal(k,5);assert.equal(L,0.02);assert.equal(alpha,1e-6);
  assert.equal(h*L/k,Bi);
  assert.ok(Math.abs(alpha*100/(L*L)-scalar('data-fourier-1'))<1e-12);
  assert.ok(Math.abs(alpha*400/(L*L)-scalar('data-fourier-2'))<1e-12);
  assert.match(svg,/全厚 2L = 0\.040 m/);
});
test('two 41-point profiles exactly agree with independently evaluated eigenfunction expansion',()=>{
  for(const fo of [0.25,1]){
    const pts=path(fo);assert.equal(pts.length,41);
    for(let i=0;i<pts.length;i++){
      const xi=-1+i/20;
      assert.ok(Math.abs(pts[i][0]-(155+(xi+1)*275))<0.011,'x='+xi);
      assert.ok(Math.abs(pts[i][1]-(610+(1-theta(xi,fo))*1100))<0.012,'y='+xi);
      assert.ok(Math.abs(pts[i][1]-pts[40-i][1])<0.011,'symmetry');
      assert.ok(pts[20][1]<=pts[i][1]+0.011,'center should be warmer');
    }
  }
});
test('positive cooling rate, valid Robin convection boundary, thermal center lags surface',()=>{
  for(const fo of [0.25,1]){
    const center=theta(0,fo),surface=theta(1,fo);
    assert.ok(0<surface && surface<center && center<1);
    assert.ok(Math.abs(derivative(0,fo))<1e-11,'center symmetry');
    assert.ok(Math.abs(-derivative(1,fo)-Bi*surface)<1e-9,'right surface Robin BC');
  }
  assert.ok(theta(0,1)<theta(0,.25));
  assert.ok(theta(1,1)<theta(1,.25));
  assert.ok(Math.abs(theta(0,.25)-0.9809771109)<1e-9);
  assert.ok(Math.abs(theta(1,.25)-0.8960947734)<1e-9);
});
