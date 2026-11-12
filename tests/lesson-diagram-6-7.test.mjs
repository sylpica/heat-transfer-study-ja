import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-6-7-turbulent-wall-units-log-law.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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
const X=(yp)=>140+(Math.log10(yp)+1)*140;
const Y=(up)=>560-up*19;

test('original, accessible, responsive and offline-safe SVG',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 820 1180"/);
  assert.match(svg,/role="img" aria-labelledby="title67 desc67"/);
  assert.match(svg,/<title id="title67">/);
  assert.match(svg,/<desc id="desc67">/);
  assert.match(svg,/data-lesson="6\.7"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/style="max-width:100%"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test('worked example: friction velocity and wall units agree',()=>{
  const tau=n('data-tau-w'),rho=n('data-rho'),nu=n('data-nu');
  approx(tau,.12);approx(rho,1.2);approx(nu,1.5e-5);
  const ut=Math.sqrt(tau/rho);
  approx(n('data-u-tau'),ut,1e-11);
  const y1p=n('data-y1')*ut/nu;
  approx(n('data-y1plus'),y1p,1e-8);
  approx(y1p,2.10818510678,1e-8);
  // viscous sublayer: u+ = y+
  approx(n('data-u1'),y1p*ut,1e-9);
  const y2p=n('data-y2')*ut/nu;
  approx(n('data-y2plus'),y2p,1e-7);
  approx(y2p,105.409255339,1e-7);
  const u2p=Math.log(y2p)/n('data-kappa')+n('data-b');
  approx(n('data-u2'),u2p*ut,1e-8);
  for(const str of ['u_τ = √(0.12/1.2) ≈ 0.316 m/s（主流速度ではない）','y⁺ ≈ 2.11、粘性近似で ū ≈ 0.667 m/s','y⁺ ≈ 105、対数則で ū ≈ 5.17 m/s'])
    assert.ok(svg.includes(str),str);
});

test('viscous line is u+ = y+ and log curve follows the log law on the log axis',()=>{
  const kappa=n('data-kappa'),B=n('data-b');
  const v=profile('viscous-line');
  const ypList=[0.1,0.5,1,2,3,4,5,6,7];
  assert.equal(v.length,ypList.length);
  for(let i=0;i<v.length;i++){
    approx(v[i][0],X(ypList[i]),0.011);
    approx(v[i][1],Y(ypList[i]),0.011);
  }
  const lg=profile('log-law');
  assert.equal(lg.length,25);
  for(let i=0;i<lg.length;i++){
    const yp=30*Math.pow(10,i/24);
    approx(lg[i][0],X(yp),0.011);
    approx(lg[i][1],Y(Math.log(yp)/kappa+B),0.75);
    if(i)assert.ok(lg[i][1]<lg[i-1][1]);
  }
});

test('wall physics caveats are stated',()=>{
  for(const s of ['粘性底層 u⁺ ≈ y⁺（y⁺ ≲ 7、原書 6.96）',
    '対数則 u⁺ ≈ (1/κ) ln y⁺ + B（y⁺ ≳ 30）',
    '無滑り壁で乱流せん断は 0 へ向かい、τ_w は分子粘性の勾配から決まる',
    '渦粘性 ν_t は流れに依存するモデル量で、物性 ν とは別',
    '二つの式を同じ点へ無条件に使わない'])
    assert.ok(svg.includes(s),s);
});
