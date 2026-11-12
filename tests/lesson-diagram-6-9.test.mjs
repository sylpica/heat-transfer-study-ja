import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-6-9-transition-mixed-average.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan><tspan dy="[^"]*"><\/tspan>/g,'^$1');
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
const rect=(id)=>{
  const m=svg.match(new RegExp('<rect id="'+id+'"[^>]*x="([0-9.]+)"[^>]*width="([0-9.]+)"'));
  assert.ok(m,'missing rect '+id);
  return {x:Number(m[1]),width:Number(m[2])};
};
const rectWidth=(id)=>rect(id).width;

test('original, accessible, responsive and offline-safe SVG',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 820 1160"/);
  assert.match(svg,/role="img" aria-labelledby="title69 desc69"/);
  assert.match(svg,/<title id="title69">/);
  assert.match(svg,/<desc id="desc69">/);
  assert.match(svg,/data-lesson="6\.9"/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/style="max-width:100%"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)=/i);
});

test("worked example: C' is Pr-dependent and the mixed average agrees (FC-18)",()=>{
  const U=n('data-uinf'),L=n('data-length'),W=n('data-width'),nu=n('data-nu');
  const Pr=n('data-pr'),kf=n('data-k-fluid'),dT=n('data-dt'),Rec=n('data-re-c');
  approx(U,15);approx(L,1);approx(W,.2);approx(nu,1.5e-5);
  approx(Pr,.7);approx(kf,.026);approx(dT,40);approx(Rec,500000);
  approx(n('data-x-c'),Rec*nu/U,1e-12);
  approx(n('data-x-c'),0.5,1e-12);
  const ReL=U*L/nu;
  approx(n('data-re-l'),ReL,1e-6);
  // C' mixes the turbulent gas exponent (0.6) and the laminar exponent (1/3):
  // it cannot be factored by a single Pr power.
  const Cp=0.037*Math.pow(Rec,0.8)*Math.pow(Pr,0.6)-0.664*Math.sqrt(Rec)*Math.pow(Pr,1/3);
  approx(n('data-c-prime'),Cp,1e-7);
  approx(Cp,665.633839473116,1e-6);
  const NuTurb=0.037*Math.pow(ReL,0.8)*Math.pow(Pr,0.6);
  approx(n('data-nu-turb-only'),NuTurb,1e-7);
  const NuBar=NuTurb-Cp;
  approx(n('data-nu-avg'),NuBar,1e-7);
  const hBar=NuBar*kf/L;
  approx(n('data-h-avg'),hBar,1e-8);
  approx(n('data-q-total'),hBar*W*L*dT,1e-7);
  // continuity check: at Re_L = Re_c the mixed formula returns the laminar average
  const lamAvg=0.664*Math.sqrt(Rec)*Math.pow(Pr,1/3);
  approx(0.037*Math.pow(Rec,0.8)*Math.pow(Pr,0.6)-Cp,lamAvg,1e-6);
  for(const str of ['C′ = 0.037 Re_c^0.8 Pr^0.6 − 0.664 Re_c^(1/2) Pr^(1/3)','= 1082.52 − 416.89 ≈ 665.63（Re_c = 5×10^5、Pr = 0.7）','h̄_L ≈ 31.70 W/(m²·K)、片面 Q̇ ≈ 253.6 W（ΔT = 40 K）'])
    assert.ok(svg.includes(str),str);
});

test('plate segments and comparison bars are proportional',()=>{
  const lam=rect('seg-lam'),turb=rect('seg-turb');
  const total=lam.width+turb.width;
  approx(lam.width/total,n('data-x-c')/n('data-length'),0.002);
  approx(turb.x,lam.x+lam.width,0.001);
  const scale=n('data-bar-scale');
  approx(rectWidth('bar-mixed'),n('data-nu-avg')*scale,0.6);
  approx(rectWidth('bar-turb'),n('data-nu-turb-only')*scale,0.6);
  assert.ok(rectWidth('bar-mixed')<rectWidth('bar-turb'));
});

test('transition caveats are stated',()=>{
  for(const s of ['Re_c は主流乱れ・粗さ・圧力勾配で変わり、普遍定数ではない',
    'C′ は Re_c と Pr の両方で変わる。',
    '条件が違えば 871 のような別の値になり、固定しない',
    'Re_L ≤ Re_c なら混合式を使わず、層流の平均相関を使う',
    '実際の遷移は有限の幅を持つ'])
    assert.ok(svg.includes(s),s);
});
