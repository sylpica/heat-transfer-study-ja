// Independently authored educational model for isothermal laminar forced convection over a flat plate.
// One exposed face, steady parallel flow, constant fluid properties, zero pressure gradient.
// Formula: Nu_L_avg = 0.664 Re_L^(1/2) Pr^(1/3) (isothermal laminar flat plate).

const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = value => Number(value).toLocaleString('ja-JP', {maximumSignificantDigits:7});

export const FLAT_PLATE_DEFAULTS = Object.freeze({
  density:1.184, velocity:3, viscosity:1.849e-5, cp:1007,
  conductivity:.0263, length:.5, width:.2, surface:80, fluid:25
});
export const flatPlateFields = Object.freeze([
  ['density','流体密度 ρ','kg/m³',.01,2000,'膜温度付近の流体物性を入力'],
  ['velocity','一様な流速 u∞','m/s',.001,30,'平板に平行な流れ'],
  ['viscosity','流体の粘度 μ','Pa·s',1e-6,.1,'動粘度ではなく粘度（動粘度は μ/ρ）'],
  ['cp','流体の比熱容量 cₚ','J/(kg·K)',100,10000,'一定物性として近似'],
  ['conductivity','流体の熱伝導率 kf','W/(m·K)',.001,10,'固体のkではなく流体の値'],
  ['length','流れ方向の平板長さ L','m',.01,10,'先端から下流端までの長さ'],
  ['width','平板の幅 W','m',.01,10,'熱を交換する片面積 A=L×W'],
  ['surface','一定の平板表面温度 Ts','℃',-273.149999,2000,'加熱・冷却の向きを決める'],
  ['fluid','主流温度 T∞','℃',-273.149999,2000,'主流の温度は流れ方向に一定']
]);
export const flatPlateFieldNames = Object.freeze(flatPlateFields.map(f=>f[0]));

function numberFromInput(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return NaN;
  const s=String(value).trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return NaN;
  const n=Number(s);
  return Number.isFinite(n)?n:NaN;
}

export function calculateFlatPlateConvection(raw) {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) return {error:'平板の強制対流モデルの入力を確認してください。'};
  const v={};
  for (const [key,label,unit,min,max] of flatPlateFields) {
    const n=numberFromInput(raw[key]);
    if (!Number.isFinite(n)) return {error:`${label}には有限の十進数を入力してください。`};
    if ((key==='surface'||key==='fluid') ? n<=-273.15||n>max : n<min||n>max)
      return {error:`${label}の範囲を確認してください（${min}〜${max} ${unit}）。`};
    v[key]=n;
  }
  const nu=v.viscosity/v.density;
  const alpha=v.conductivity/(v.density*v.cp);
  const re=v.density*v.velocity*v.length/v.viscosity;
  const pr=v.viscosity*v.cp/v.conductivity;
  // The textbook correlation is valid in the laminar attached boundary-layer regime.
  // Reject out-of-range inputs rather than silently applying a turbulent/transition formula.
  if (re<1000 || re>=500000) return {error:`このモデルは 1000≤ReL<500000 の層流範囲だけに対応します（現在 ReL=${fmt(re)}）。乱流・遷移領域は計算しません。`};
  if (pr<.6 || pr>50) return {error:`このモデルは 0.6≤Pr≤50 に限定しています（現在 Pr=${fmt(pr)}）。流体物性を確認してください。`};
  const nuAverage=.664*Math.sqrt(re)*Math.cbrt(pr);
  const nuLocalEnd=.332*Math.sqrt(re)*Math.cbrt(pr);
  const hAverage=nuAverage*v.conductivity/v.length;
  const hLocalEnd=nuLocalEnd*v.conductivity/v.length;
  const area=v.length*v.width,delta=v.surface-v.fluid;
  const watts=hAverage*area*delta;
  const qAverage=hAverage*delta;
  const delta99=5*v.length/Math.sqrt(re);  // Blasius hydrodynamic boundary-layer estimate.
  const thermalLayerEstimate=delta99/Math.cbrt(pr); // order-of-magnitude estimate only
  if ([nu,alpha,re,pr,nuAverage,hAverage,area,delta,watts,qAverage,delta99,thermalLayerEstimate].some(n=>!Number.isFinite(n)))
    return {error:'計算可能な数値範囲を超えました。'};
  return {values:v,nu,alpha,re,pr,nuAverage,nuLocalEnd,hAverage,hLocalEnd,area,delta,watts,qAverage,delta99,thermalLayerEstimate};
}

// Local correlation is singular at the idealized mathematical leading edge x=0.
export function flatPlateLocalCoefficient(result,x) {
  if (!result||result.error||!Number.isFinite(x)||x<=0||x>result.values.length)
    throw new RangeError('先端x=0を除く、0<x≤Lの位置を指定してください。');
  return .332*result.values.conductivity*Math.sqrt(result.values.density*result.values.velocity/(result.values.viscosity*x))*Math.cbrt(result.pr);
}

export function renderFlatPlateFields(values=FLAT_PLATE_DEFAULTS) {
  return flatPlateFields.map(([key,label,unit,min,max,help])=>
    `<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${escape(values[key])}" min="${min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join('');
}

export function renderFlatPlateSteps(x) {
  if (!x||x.error) return '';
  const v=x.values;
  return `<div class="simulation-steps"><p><strong>補足説明：一定温度の平板上を流れる層流強制対流</strong></p>
  <details><summary>1. 流体物性と適用範囲</summary><p>平板に平行な一様流れを仮定。代表物性は膜温度(Ts+T∞)/2=${fmt((v.surface+v.fluid)/2)} ℃付近で選んだものを入力する必要があります。自動で流体物性を推定する機能ではありません。</p>
  <p>動粘度ν=μ/ρ=${fmt(x.nu)} m²/s、熱拡散率αf=kf/(ρcₚ)=${fmt(x.alpha)} m²/s。圧力勾配・自然対流・表面温度変化・粘性発熱・表面粗さ・乱流を含めません。</p></details>
  <details><summary>2. Re・Pr・Nuと平均熱伝達率</summary><p>ReL=ρu∞L/μ=${fmt(x.re)}、Pr=μcₚ/kf=${fmt(x.pr)}（無次元）。有効な計算範囲は1000≤ReL<500000、0.6≤Pr≤50です。Reの遷移閾値は流入乱れや表面で変動し、絶対的な保証ではありません。</p>
  <p>等温平板の層流平均NūL=0.664√ReL Pr^(1/3)=${fmt(x.nuAverage)}。平均熱伝達率h̄=NūL kf/L=${fmt(x.hAverage)} W/(m²·K)。下流端の局所NuL=0.332√ReL Pr^(1/3)=${fmt(x.nuLocalEnd)}、局所hL=${fmt(x.hLocalEnd)} W/(m²·K)。平均h̄=2hL。</p></details>
  <details><summary>3. 熱移動量と境界層の目安</summary><p>片面の面積A=LW=${fmt(x.area)} m²、温度差ΔT=Ts−T∞=${fmt(x.delta)} K。</p><p>平均熱流束q″=h̄ΔT=${fmt(x.qAverage)} W/m²、片面の熱移動率Q̇=h̄AΔT=${fmt(x.watts)} W。正は平板から流体への放熱、負は流体から平板への加熱です。</p>
  <p>下流端の速度境界層厚さの目安δ99≈5L/√ReL=${fmt(x.delta99)} m。温度境界層の概算δT≈δ99/Pr^(1/3)=${fmt(x.thermalLayerEstimate)} m。この厚さは厳密な熱伝達率の計算には使用せず、流れのイメージ用です。</p></details>
  <small>独立作成の教育用近似。平滑平板・非圧縮・定常・一定物性・先端からの層流発達・圧力勾配なし・一様主流温度・等温表面・片面のみ。先端x=0の局所hは理論上発散するため表示対象から外しています。工学設計では実際の形状・温度依存・浮力・遷移条件を別途確認してください。</small></div>`;
}

export function renderFlatPlateDiagram(x) {
  const good=!!x&&!x.error;
  const v=good?x.values:null;
  const direction=good?(x.watts>0?'表面から流体へ':x.watts<0?'流体から表面へ':'正味熱移動なし'):'入力未判定';
  const arrows=good&&x.watts<0?'M155 70 L155 107 M149 99 L155 107 L161 99 M260 70 L260 107 M254 99 L260 107 L266 99 M360 70 L360 107 M354 99 L360 107 L366 99':'M155 107 L155 70 M149 78 L155 70 L161 78 M260 107 L260 70 M254 78 L260 70 L266 78 M360 107 L360 70 M354 78 L360 70 L366 78';
  const desc=good?`一様流速${fmt(v.velocity)}m/sの流体が左から右へ流れ、平板の表面${fmt(v.surface)}℃と流体${fmt(v.fluid)}℃の間で${direction}の熱交換を行います。`:'入力を確認してください。';
  return `<figure class="simulation-figure"><svg viewBox="0 0 480 210" class="sim-physical-diagram" xmlns="http://www.w3.org/2000/svg" role="img"><title>平板に沿う強制対流の模式図</title><desc>${escape(desc)}</desc>
  <rect x="72" y="109" width="348" height="34" class="diagram-solid"/>
  <path d="M24 51 L445 51 M431 43 L445 51 L431 59" class="diagram-arrow"/>
  <path d="M72 107 Q170 77 420 68" class="diagram-boundary"/>
  <path d="${arrows}" class="diagram-arrow"/>
  <text x="20" y="31" class="chart-label">一様主流 u∞ →</text><text x="82" y="160" class="chart-label">x=0</text><text x="375" y="160" class="chart-label">x=L</text>
  <text x="80" y="189" class="chart-label">${escape(good?`Ts=${fmt(v.surface)}℃`:'表面温度未判定')}</text>
  <text x="264" y="189" class="chart-label">${escape(direction)}</text></svg>
  <figcaption>独自模式図。曲線は境界層の発達イメージであり、厚さや速度場を寸法どおりに描いたものではありません。熱の矢印と流れの矢印を区別しています。</figcaption></figure>`;
}

function flatPlateGraph(points,other,title,description,xLabel,yLabel) {
  const all=[...points,...(other||[])];
  let min=Math.min(...all.map(p=>p[1])),max=Math.max(...all.map(p=>p[1]));
  if (max-min<1e-10){min-=.5;max+=.5;}
  const W=560,H=250,left=70,right=20,top=20,bottom=47;
  const X=u=>left+u*(W-left-right),Y=y=>top+(max-y)/(max-min)*(H-top-bottom);
  const path=p=>p.map(([u,y],i)=>`${i?'L':'M'}${X(u).toFixed(2)},${Y(y).toFixed(2)}`).join(' ');
  const ticks=[0,.5,1].map(f=>{const y=min+(max-min)*f;return `<line x1="${left}" y1="${Y(y)}" x2="${W-right}" y2="${Y(y)}" class="chart-grid"/><text x="${left-9}" y="${Y(y)+4}" text-anchor="end" class="chart-label">${escape(fmt(y))}</text>`;}).join('');
  return `<svg class="sim-chart" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg" aria-label="${escape(description)}"><title>${escape(title)}</title><desc>${escape(description)}</desc>${ticks}<path d="${path(points)}" class="chart-current"/>${other?`<path d="${path(other)}" class="chart-baseline"/>`:''}
  <text x="${left}" y="${H-29}" class="chart-label">0</text><text x="${W-right}" y="${H-29}" text-anchor="end" class="chart-label">1</text><text x="${left+(W-left-right)/2}" y="${H-7}" text-anchor="middle" class="chart-label">${escape(xLabel)}</text><text x="14" y="${top+(H-top-bottom)/2}" transform="rotate(-90 14 ${top+(H-top-bottom)/2})" text-anchor="middle" class="chart-label">${escape(yLabel)}</text></svg>`;
}

// Only positive positions are graphed: h_x diverges in the leading-edge limit.
export function flatPlateLocalGraph(x,previous=null) {
  if(!x||x.error)return '';
  const sample=r=>Array.from({length:75},(_,i)=>{const u=.01+.99*i/74;return [u,flatPlateLocalCoefficient(r,r.values.length*u)];});
  const other=previous&&!previous.error?sample(previous):null;
  return flatPlateGraph(sample(x),other,'平板に沿う局所熱伝達率',`流れ方向の位置x/Lが0.01〜1の局所h(x)。先端x=0の特異値は除外。現在下流端の局所h=${fmt(x.hLocalEnd)} W/(m²·K)。`,'相対位置 x/L（0.01〜1）','局所 h(x) [W/(m²·K)]');
}

// Velocity sensitivity is evaluated only where the laminar correlation remains valid.
export function flatPlateVelocityGraph(x) {
  if(!x||x.error)return '';
  const minU=1000*x.values.viscosity/(x.values.density*x.values.length);
  const maxU=500000*x.values.viscosity/(x.values.density*x.values.length);
  const low=Math.max(.001,minU),high=Math.min(30,maxU*(1-1e-9));
  if (!(high>low))return '';
  const sample=Array.from({length:75},(_,i)=>{const u=low+(high-low)*i/74;const h=x.hAverage*Math.sqrt(u/x.values.velocity);return [i/74,h*x.area*x.delta];});
  return flatPlateGraph(sample,null,'層流範囲の流速と熱移動率',`層流のReLが1000以上500000未満にある流速${fmt(low)}〜${fmt(high)}m/sの予測。横軸の0はこの最小流速、1は最大流速を表す。遷移・乱流域には外挿しません。`,'流速範囲内の相対位置（0=最小、1=最大）','Q̇ [W]');
}