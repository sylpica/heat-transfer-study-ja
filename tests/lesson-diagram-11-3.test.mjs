import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const svg=readFileSync(new URL('../assets/lesson-diagrams/section-11-3-fick-molar-diffusion-comparison.svg',import.meta.url),'utf8').replace(/<tspan class="sbb"[^>]*>([^<]*)<\/tspan>/g,'_{$1}').replace(/<tspan class="sbp"[^>]*>([^<]*)<\/tspan>/g,'_($1)').replace(/<tspan class="sb"[^>]*>([^<]*)<\/tspan>/g,'_$1').replace(/<tspan class="spc"[^>]*>([^<]*)<\/tspan>/g,'^{$1}').replace(/<tspan class="sp"[^>]*>([^<]*)<\/tspan>/g,'^($1)').replace(/<tspan class="spb"[^>]*>([^<]*)<\/tspan>/g,'^$1').replace(/<tspan dy="[^"]*">([^<]*)<\/tspan>/g,'$1');
const num=(name)=>{
  const m=svg.match(new RegExp('\\b'+name+'="([^"]+)"'));
  assert.ok(m,'Missing '+name);
  const n=Number(m[1]);assert.ok(Number.isFinite(n));return n;
};
const values=()=>{
  const P=num('data-pressure-pa'),T=num('data-temperature-k'),R=num('data-gas-constant');
  const D=num('data-diffusivity-m2-s'),L=num('data-length-m');
  const y1=num('data-y-a-left'),y2=num('data-y-a-right');
  return {P,T,R,D,L,y1,y2,c:P/(R*T)};
};
const curve=(id)=>{
  const m=svg.match(new RegExp('<polyline id="'+id+'" points="([^"]+)"'));
  assert.ok(m,'Missing '+id);
  return m[1].split(/\s+/).map(pair=>pair.split(',').map(Number));
};

test('自作・代替説明・明暗モード・外部参照なし',()=>{
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg,/role="img" aria-labelledby="fick-title fick-desc"/);
  assert.match(svg,/<title id="fick-title">/);
  assert.match(svg,/<desc id="fick-desc">/);
  assert.match(svg,/viewBox="0 0 760 1500"/);
  assert.match(svg,/@media\(prefers-color-scheme:dark\)/);
  assert.match(svg,/data-origin="original-app-diagram"/);
  assert.match(svg,/data-lesson="11\.3"/);
  assert.match(svg,/アプリ作成の独自図/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|use)\b|\b(?:href|xlink:href|src)\s*=|@import|url\s*\(/i);
  assert.doesNotMatch(svg,/⁻|⁵|₀|₁/);
});

test('等モルとB停滞の全モル流束・比率を独立再計算',()=>{
  const {P,T,R,D,L,y1,y2,c}=values();
  assert.equal(P,101325);assert.equal(T,300);assert.equal(R,8.3144626);
  assert.equal(D,2e-5);assert.equal(L,0.01);assert.equal(y1,0.2);assert.equal(y2,0.05);
  assert.ok(Math.abs(c-40.6219880)<1e-7);
  const K=c*D/L,NE=K*(y1-y2),NS=K*Math.log((1-y2)/(1-y1));
  assert.ok(Math.abs(NE-0.0121865964)<1e-9);
  assert.ok(Math.abs(NS-0.0139617982)<1e-9);
  assert.ok(Math.abs((NS/NE-1)*100-14.56683795)<1e-7);
  assert.ok(NS>NE&&NE>0);
  for(const v of ['0.01219 mol/(m²·s)','0.01396 mol/(m²·s)','約14.6%','40.62 mol/m³','0.08124 mol/(m²·s)'])assert.ok(svg.includes(v),v);
});

test('二つの濃度プロファイルを個別の支配式と21点照合',()=>{
  const {y1,y2}=values();
  const eq=curve('equimolar-profile'),st=curve('stagnant-b-profile');
  assert.equal(eq.length,21);assert.equal(st.length,21);
  const ratio=(1-y2)/(1-y1);
  for(let i=0;i<=20;i++){
    const s=i/20,x=120+232*s;
    const yEq=y1+(y2-y1)*s,ySt=1-(1-y1)*Math.pow(ratio,s);
    const graph=(y,top)=>top+115*(y1-y)/(y1-y2);
    for(const [p,y,top] of [[eq[i],yEq,472],[st[i],ySt,828]]){
      assert.ok(Math.abs(p[0]-x)<0.0011);
      assert.ok(Math.abs(p[1]-graph(y,top))<0.0011);
    }
    if(i){assert.ok(eq[i][1]>eq[i-1][1]);assert.ok(st[i][1]>st[i-1][1]);}
  }
});

test('A・Bの正負および全流束と相対拡散流束の区別',()=>{
  assert.match(svg,/等モル相互拡散：N_A \+ N_B = 0/);
  assert.match(svg,/N_B = −N_A/);
  assert.match(svg,/成分Bが停滞：N_B = 0/);
  assert.match(svg,/J_A = −cD_AB dy_A\/dx/);
  assert.match(svg,/N_A = J_A \+ y_A\(N_A\+N_B\)/);
  assert.match(svg,/Bの全流束：左向き/);
  assert.match(svg,/Bの全流束：ゼロ/);
});

test('B停滞時の相対A拡散流束はゼロでなく位置変化する',()=>{
  const {c,D,L,y1,y2}=values(),NA=c*D/L*Math.log((1-y2)/(1-y1));
  const Jleft=NA*(1-y1),Jright=NA*(1-y2);
  assert.ok(Jleft>0&&Jright>Jleft);
  assert.ok(Math.abs(Jleft-0.01116944)<1e-7);
  assert.ok(Math.abs(Jright-0.01326371)<1e-7);
  assert.ok(svg.includes('J_A は位置で変化'));
});
