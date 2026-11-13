// Independent educational model: free convection next to an isothermal vertical flat plate.
// Churchill-Chu wide-range vertical-plate correlation. No book prose, diagrams or tables copied.
export const NATURAL_GRAVITY = 9.80665; // m/s^2
export const NATURAL_DEFAULTS = Object.freeze({
  density:1.184, viscosity:1.849e-5, cp:1007, conductivity:.0263,
  beta:.00319, height:.5, width:.4, faces:1, surface:60, ambient:20
});
export const naturalFields = Object.freeze([
  ['density','流体の密度 ρ','kg/m³',.01,20000,'一定の代表密度、膜温度における値を入力'],
  ['viscosity','流体の粘度 μ','Pa·s',1e-7,100,'動粘度νとは別物'],
  ['cp','流体の比熱容量 cₚ','J/(kg·K)',10,20000,'膜温度付近の一定値'],
  ['conductivity','流体の熱伝導率 kf','W/(m·K)',.001,500,'固体の熱伝導率と区別する'],
  ['beta','流体の体積膨張係数 β','1/K',1e-7,.5,'理想気体ならおおむね1/Tfilm（K）'],
  ['height','鉛直方向の平板高さ L','m',.01,20,'鉛直長さを代表長さにする'],
  ['width','平板の幅 W','m',.01,20,'対流面積はL×W×面数'],
  ['faces','両側の露出面数','面',1,2,'1または2面。同じ流体に露出し、相互干渉なし'],
  ['surface','平板の一様表面温度 Ts','℃',-273.149999,1000,'等温面を仮定'],
  ['ambient','静止した周囲流体の温度 T∞','℃',-273.149999,1000,'遠方の流体温度']
]);
export const naturalFieldNames = Object.freeze(naturalFields.map(f=>f[0]));
const escape = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n=>Number(n).toLocaleString('ja-JP',{maximumSignificantDigits:7});
function decimal(input){
  if(typeof input!=='string'&&typeof input!=='number')return NaN;
  const str=String(input).trim();
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(str))return NaN;
  const number=Number(str);
  return Number.isFinite(number)?number:NaN;
}

// Wide-range isothermal vertical surface correlation for 0.1 <= Ra <= 1e12.
// This correlation predicts the height-AVERAGED Nu, not a local Nu(x).
export function churchillChuVertical(rayleigh,prandtl){
  if(!Number.isFinite(rayleigh)||!Number.isFinite(prandtl)||rayleigh<.1||rayleigh>1e12||prandtl<.1||prandtl>1000)
    return NaN;
  return (0.825+0.387*Math.pow(rayleigh,1/6)/Math.pow(1+Math.pow(0.492/prandtl,9/16),8/27))**2;
}

export function calculateNaturalConvection(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return {error:'自然対流の入力値を確認してください。'};
  const v={};
  for(const [key,label,unit,min,max] of naturalFields){
    const number=decimal(input[key]);
    if(!Number.isFinite(number))return {error:`${label}は有限の十進数で入力してください。`};
    if((key==='surface'||key==='ambient') ? (number<=-273.15||number>max) : (number<min||number>max))
      return {error:`${label}は${key==='surface'||key==='ambient'?'−273.15 ℃より高く、1000 ℃以下':`${min}〜${max} ${unit}`}で指定してください。`};
    if(key==='faces'&&!Number.isInteger(number))return {error:'露出面数は1または2の整数で指定してください。'};
    v[key]=number;
  }
  const nu=v.viscosity/v.density;
  const alpha=v.conductivity/(v.density*v.cp);
  const pr=v.viscosity*v.cp/v.conductivity;
  const delta=v.surface-v.ambient;
  const area=v.faces*v.height*v.width;
  const filmKelvin=(v.surface+v.ambient)/2+273.15;
  const gr=NATURAL_GRAVITY*v.beta*Math.abs(delta)*v.height**3/(nu*nu);
  const ra=gr*pr;
  const hasGradient=delta!==0;
  if(pr<.1||pr>1000)return {error:`この教育用モデルは0.1≤Pr≤1000を扱います。現在のPr=${fmt(pr)}。`};
  if(hasGradient&&(ra<.1||ra>1e12))return {error:`Churchill–Chu相関式の採用範囲は0.1≤Ra≤10¹²です。現在のRa=${fmt(ra)}。`};
  const nusselt=hasGradient?churchillChuVertical(ra,pr):null;
  const h=hasGradient?nusselt*v.conductivity/v.height:null;
  const watts=hasGradient?h*area*delta:0;
  const heatFlux=hasGradient?h*delta:0;
  if([nu,alpha,pr,area,filmKelvin,gr,ra,watts,heatFlux].some(n=>!Number.isFinite(n))||
    (hasGradient&&(!Number.isFinite(nusselt)||!Number.isFinite(h))))
    return {error:'計算結果が有限値の範囲外です。入力を確認してください。'};
  return {values:v,kinematicViscosity:nu,thermalDiffusivity:alpha,prandtl:pr,grashof:gr,rayleigh:ra,
    nusselt,h,delta,area,filmKelvin,heatFlux,watts,hasGradient,
    regime:!hasGradient?'温度差ゼロ（浮力駆動の相関は未適用）':ra<1e9?'主として層流側の目安':'遷移〜乱流の可能性を含む範囲'};
}
export function renderNaturalFields(values=NATURAL_DEFAULTS){
  return naturalFields.map(([key,label,unit,min,max,note])=>`<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${escape(values[key])}" min="${key==='surface'||key==='ambient'?-273.149999:min}" max="${max}" step="${key==='faces'?1:'any'}" inputmode="decimal" required/><i>${unit}</i></span><small>${note}</small></label>`).join('');
}
export function renderNaturalSteps(result){
  if(!result||result.error)return '';
  const r=result,v=r.values;
  const correlation=r.hasGradient?
    `<p>NūL=[0.825+0.387Ra^(1/6)/{1+(0.492/Pr)^(9/16)}^(8/27)]²=${fmt(r.nusselt)}。平均h=NūL·kf/L=${fmt(r.h)} W/(m²·K)。局所h(x)や流動速度分布ではありません。</p>`:
    `<p>Ts=T∞のため浮力を駆動する温度差がありません。放熱量は0 Wですが、Ra=0は採用した経験相関の範囲外です。そのため平均Nuとhは数値表示せず「未適用」とします。</p>`;
  return `<div class="simulation-steps"><p><strong>補足説明：鉛直等温平板の自然対流</strong></p>
    <details><summary>1. 現象と物性</summary><p>流れを外力で与えない、静止流体中の等温鉛直平板です。平板Ts=${fmt(v.surface)} ℃、流体T∞=${fmt(v.ambient)} ℃、温度差ΔT=${fmt(r.delta)} K、膜温度目安Tfilm=${fmt(r.filmKelvin)} K。βとkf、μ、ρ、cₚは膜温度に対応した流体値を指定してください。理想気体ではβ≈1/Tfilmですが、液体へ機械的に代入しないでください。</p></details>
    <details><summary>2. 無次元数と相関式の適用範囲</summary><p>ν=μ/ρ=${fmt(r.kinematicViscosity)} m²/s、αf=kf/(ρcₚ)=${fmt(r.thermalDiffusivity)} m²/s。Pr=ν/αf=${fmt(r.prandtl)}。GrL=gβ|ΔT|L³/ν²=${fmt(r.grashof)}、RaL=GrL Pr=${fmt(r.rayleigh)}。重力加速度g=${NATURAL_GRAVITY} m/s²です。</p>${correlation}<p>適用は0.1≤RaL≤10¹²、教育用のPr範囲0.1〜1000。現在の目安：${r.regime}。浮力による上昇・下降流は温度差の符号によって反転します。実物の遷移限界は条件次第で異なります。</p></details>
    <details><summary>3. 表面熱量と符号</summary><p>露出面積A=${fmt(v.faces)}×${fmt(v.height)}×${fmt(v.width)}=${fmt(r.area)} m²。平均熱流束q″=hΔT=${fmt(r.heatFlux)} W/m²、符号付き熱移動率Q̇=hAΔT=${fmt(r.watts)} W。正は平板から流体への放熱、負は流体から平板への吸熱です。強制対流との混合・放射・熱物性の温度変化は含みません。</p></details>
    <small>独自作成の教育用相関モデル。有限板の端部影響、密閉空間、周囲からの強制流、相変化、流動の厳密場、熱放射を無視。経験相関の計算値であり精密設計の保証ではありません。</small></div>`;
}
export function renderNaturalDiagram(result){
  const okay=result&&!result.error,r=okay?result:null;
  const direction=okay?(r.watts>0?'暖かい壁の上昇流':r.watts<0?'冷たい壁の下降流':'温度差ゼロ'):'入力待ち';
  const upwards=okay&&r.watts>=0;
  const path=upwards?'M327 161 L327 50 M320 59 L327 50 L334 59':'M327 50 L327 161 M320 152 L327 161 L334 152';
  const arrowMarkup=okay&&!r.hasGradient?'':`<path d="${path}" class="diagram-arrow"/>`;
  const desc=okay?`鉛直平板、Ts=${fmt(r.values.surface)} ℃、T∞=${fmt(r.values.ambient)} ℃、${direction}、放熱率${fmt(r.watts)} W。`:'鉛直平板の模式図。入力は無効。';
  return `<figure class="simulation-figure"><svg class="sim-physical-diagram" viewBox="0 0 480 210" role="img" xmlns="http://www.w3.org/2000/svg"><title>等温鉛直平板の自然対流模式図</title><desc>${escape(desc)}</desc>
    <rect x="203" y="38" width="44" height="140" class="diagram-solid"/>${arrowMarkup}
    <text x="164" y="25" class="chart-label">鉛直平板</text><text x="302" y="25" class="chart-label">流体</text><text x="266" y="196" class="chart-label">${escape(direction)}</text>
    <text x="90" y="193" class="chart-label">${escape(okay?`Ts=${fmt(r.values.surface)} ℃`:'温度未設定')}</text></svg>
    <figcaption>浮力による流れ方向の独自模式図です。速度場・境界層厚さ・壁面温度場を厳密に描画したものではありません。</figcaption></figure>`;
}
// Draw only physically valid pieces. No polyline may bridge excluded Rayleigh-number ranges.
function naturalLineData(points,xKey,yKey){
  let current=[],paths=[];
  const flush=()=>{if(current.length>1)paths.push(current);current=[];};
  for(const p of points){
    if(p&&Number.isFinite(p[xKey])&&Number.isFinite(p[yKey]))current.push(p);
    else flush();
  }
  flush();return paths;
}
function naturalChart(points,xf,yf,xCaption,yCaption,description,baseline=null){
  const all=points.filter(Boolean).concat((baseline||[]).filter(Boolean));
  if(all.length<2)return `<p>相関式の適用範囲内で描画可能な条件がありません。${escape(description)}</p>`;
  let minX=Math.min(...all.map(p=>p[xf])),maxX=Math.max(...all.map(p=>p[xf]));
  let minY=Math.min(...all.map(p=>p[yf])),maxY=Math.max(...all.map(p=>p[yf]));
  if(Math.abs(maxX-minX)<1e-10){minX-=1;maxX+=1;}
  if(Math.abs(maxY-minY)<1e-10){minY-=1;maxY+=1;}
  const W=560,H=250,left=78,right=18,top=20,bottom=51;
  const X=v=>left+(v-minX)/(maxX-minX)*(W-left-right),Y=v=>top+(maxY-v)/(maxY-minY)*(H-top-bottom);
  const curves=(arr,css)=>naturalLineData(arr,xf,yf).map(segment=>`<path class="${css}" d="${segment.map((p,i)=>`${i?'L':'M'}${X(p[xf]).toFixed(3)},${Y(p[yf]).toFixed(3)}`).join(' ')}"/>`).join('');
  const tick=[0,.5,1].map(fr=>{const y=minY+(maxY-minY)*fr;return `<line class="chart-grid" x1="${left}" y1="${Y(y)}" x2="${W-right}" y2="${Y(y)}"/><text class="chart-label" x="${left-7}" y="${Y(y)+4}" text-anchor="end">${escape(fmt(y))}</text>`;}).join('');
  return `<svg class="sim-chart" role="img" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-label="${escape(description)}"><title>${escape(description)}</title><desc>${escape(description)}。相関の適用外条件は連結せず省略しています。</desc>${tick}
    ${curves(points,'chart-current')}${baseline?curves(baseline,'chart-baseline'):''}
    <text class="chart-label" x="${left}" y="${H-31}">${escape(fmt(minX))}</text><text class="chart-label" x="${W-right}" y="${H-31}" text-anchor="end">${escape(fmt(maxX))}</text>
    <text class="chart-label" x="${left+(W-left-right)/2}" y="${H-7}" text-anchor="middle">${escape(xCaption)}</text>
    <text class="chart-label" x="14" y="${top+(H-top-bottom)/2}" transform="rotate(-90 14 ${top+(H-top-bottom)/2})" text-anchor="middle">${escape(yCaption)}</text></svg>`;
}
export function naturalTemperatureGraph(result,comparison=null){
  if(!result||result.error)return '';
  const span=Math.min(500,Math.max(20,Math.abs(result.delta)*1.4));
  const xMin=-span,xMax=span;
  const sample=r=>Array.from({length:97},(_,i)=>{
    const diff=xMin+(xMax-xMin)*i/96;
    const s=r.values.ambient+diff;
    const p=calculateNaturalConvection({...r.values,surface:s});
    return p.error?null:{difference:diff,watts:p.watts};
  });
  const other=comparison&&!comparison.error?comparison:null;
  return naturalChart(sample(result),'difference','watts','壁面と流体の温度差 Ts−T∞ (K)','熱移動率 Q̇ (W)',
    '温度差と自然対流熱移動率。負は流体から壁への吸熱。',other?sample(other):null);
}
export function naturalHeightGraph(result,comparison=null){
  if(!result||result.error)return '';
  const h0=result.values.height;
  const minHeight=Math.max(.01,h0*.3),maxHeight=Math.min(20,h0*1.8);
  const sample=r=>Array.from({length:81},(_,i)=>{
    const height=minHeight+(maxHeight-minHeight)*i/80;
    const p=calculateNaturalConvection({...r.values,height});
    return p.error||!p.hasGradient?null:{height,coefficient:p.h};
  });
  const other=comparison&&!comparison.error?comparison:null;
  return naturalChart(sample(result),'height','coefficient','鉛直高さ L (m)','平均熱伝達率 h (W/(m²·K))',
    '鉛直平板高さと平均熱伝達率。物性・温度差は一定。',other?sample(other):null);
}