import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-6-2-blasius-similarity-friction.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const n=(name)=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'missing '+name);
  const value=Number(m[1]);
  assert.ok(Number.isFinite(value),name+' must be numeric');
  return value;
};
const approx=(a,b,eps=1e-8)=>{
  assert.ok(Math.abs(a-b)<eps,'expected '+a+' to be '+b);
};
const profile=(id)=>{
  const m=svg.match(new RegExp('<path id="'+id+'"[^>]*d="([^"]+)"\\s*/>'));
  assert.ok(m,'missing '+id);
  return [...m[1].matchAll(/[ML]([0-9.]+) ([0-9.]+)/g)].map(z=>[Number(z[1]),Number(z[2])]);
};
// Independent Blasius solve: f''' + (1/2) f f'' = 0, f(0)=f'(0)=0, f''(0) given.
const blasiusFp=(etaTarget,fpp0)=>{
  const h=0.01;let f=0,fp=0,fpp=fpp0;
  for(let eta=0;eta<etaTarget-1e-12;eta+=h){
    const step=Math.min(h,etaTarget-eta);
    const r=(F,FP,FPP)=>[FP,FPP,-0.5*F*FPP];
    const k1=r(f,fp,fpp);
    const k2=r(f+step/2*k1[0],fp+step/2*k1[1],fpp+step/2*k1[2]);
    const k3=r(f+step/2*k2[0],fp+step/2*k2[1],fpp+step/2*k2[2]);
    const k4=r(f+step*k3[0],fp+step*k3[1],fpp+step*k3[2]);
    f+=step/6*(k1[0]+2*k2[0]+2*k3[0]+k4[0]);
    fp+=step/6*(k1[1]+2*k2[1]+2*k3[1]+k4[1]);
    fpp+=step/6*(k1[2]+2*k2[2]+2*k3[2]+k4[2]);
  }
  return fp;
};

test('original, accessible, responsive and offline-safe SVG',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 820 1180"/);
  assert.match(svg,/role="img" aria-labelledby="title62 desc62"/);
  assert.match(svg,/<title id="title62">/);
  assert.match(svg,/<desc id="desc62">/);
  assert.match(svg,/data-lesson="6\.2"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/style="max-width:100%"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('worked example: delta99, local/average friction, wall shear and drag agree',()=>{
  const U=n('data-uinf'),L=n('data-length'),W=n('data-width'),nu=n('data-nu'),rho=n('data-rho');
  approx(U,2);approx(L,.5);approx(W,.2);approx(nu,1.5e-5);approx(rho,1.2);
  const ReL=U*L/nu;
  approx(ReL,66666.66666666667,1e-6);
  approx(n('data-re-l'),ReL,1e-4);
  approx(n('data-delta99-l'),5*L/Math.sqrt(ReL),1e-11);
  approx(n('data-cf-local-l'),0.664/Math.sqrt(ReL),1e-11);
  approx(n('data-tau-w-l'),(rho*U*U/2)*(0.664/Math.sqrt(ReL)),1e-11);
  approx(n('data-cf-avg'),1.328/Math.sqrt(ReL),1e-11);
  approx(n('data-cf-avg'),2*n('data-cf-local-l'),1e-11);
  approx(n('data-drag'),(rho*U*U/2)*W*L*(1.328/Math.sqrt(ReL)),1e-10);
  for(const str of ['C_f,L = 0.664/√Re_L ≈ 0.002572','τ_w(L) ≈ 0.00617 Pa','D_f ≈ 1.23×10^(-3) N'])
    assert.ok(svg.includes(str),str);
});

test('profile points match an independent Blasius solution',()=>{
  const U=n('data-uinf'),L=n('data-length'),nu=n('data-nu'),fpp0=n('data-fpp0');
  approx(fpp0,0.332057,1e-12);
  const sq=Math.sqrt(nu*L/U);
  const pts=profile('blasius-profile');
  assert.equal(pts.length,25);
  for(let i=0;i<pts.length;i++){
    const uOverU=(pts[i][0]-150)/520;
    const y=(470-pts[i][1])/290*0.012;
    const eta=y/sq;
    approx(eta,i*0.25,0.02);
    approx(uOverU,blasiusFp(eta,fpp0),0.01);
    if(i)assert.ok(pts[i][0]>pts[i-1][0]);
  }
  // u/U reaches about 0.99 at the delta99 height
  const eta99=n('data-delta99-l')/sq;
  approx(blasiusFp(eta99,fpp0),0.99,0.005);
});

test('delta growth curve follows 5*sqrt(nu*x/U)',()=>{
  const U=n('data-uinf'),nu=n('data-nu');
  const pts=profile('delta-growth');
  assert.equal(pts.length,21);
  for(let i=0;i<pts.length;i++){
    const x=0.5*i/20;
    approx(pts[i][0],150+(x/0.5)*520,0.011);
    const d=x===0?0:5*Math.sqrt(nu*x/U);
    approx(pts[i][1],740-(d/0.012)*150,0.6);
  }
  assert.ok(svg.includes('圧力抵抗・両面・前縁形状の抵抗は含まない'));
});
