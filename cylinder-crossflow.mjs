// Independently authored educational model: a long, isothermal, smooth circular cylinder
// in steady forced crossflow. All fluid properties are user-supplied at film temperature.
// The Churchill-Bernstein correlation estimates the circumference-averaged Nu only.

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => Number(value).toLocaleString('ja-JP', {maximumSignificantDigits:7});

export const CROSSFLOW_DEFAULTS = Object.freeze({
  density:1.184, velocity:3, viscosity:1.849e-5, cp:1007,
  conductivity:0.0263, diameter:0.05, length:1, surface:80, ambient:25
});

export const crossflowFields = Object.freeze([
  ['density','流体密度 ρ','kg/m³',0.01,2500,'膜温度における流体密度'],
  ['velocity','主流速度 u∞','m/s',0.001,100,'円柱の軸と直角に流れる一様主流'],
  ['viscosity','流体の粘度 μ','Pa·s',1e-7,1,'動粘度νではなく粘度'],
  ['cp','流体比熱容量 cₚ','J/(kg·K)',50,10000,'一定物性を仮定'],
  ['conductivity','流体の熱伝導率 kf','W/(m·K)',0.001,10,'固体の熱伝導率ではない'],
  ['diameter','円柱の外径 D','m',0.001,2,'Re・Nuに用いる代表長さ'],
  ['length','円柱の長さ L','m',0.01,30,'側面のみ、端面は除く'],
  ['surface','表面温度 Ts','℃',-273.149999,2000,'円柱側面で一様に維持'],
  ['ambient','主流温度 T∞','℃',-273.149999,2000,'熱交換後も主流温度が一定の近似']
]);
export const crossflowFieldNames = Object.freeze(crossflowFields.map(field => field[0]));

function parseFiniteDecimal(raw) {
  if (typeof raw !== 'number' && typeof raw !== 'string') return NaN;
  const str=String(raw).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(str)) return NaN;
  const n=Number(str);
  return Number.isFinite(n) ? n : NaN;
}

// Churchill, S. W. & Bernstein, M. (1977), DOI: 10.1115/1.3450685.
// Restriction Re_D * Pr > 0.2; a conservative, explicit range is enforced by caller.
export function churchillBernsteinNu(reynolds, prandtl) {
  if (!Number.isFinite(reynolds) || !Number.isFinite(prandtl) || reynolds <= 0 || prandtl <= 0 || reynolds*prandtl <= 0.2)
    throw new RangeError('Churchill–Bernstein式は ReD·Pr > 0.2 の範囲で指定してください。');
  const primary=0.62*Math.sqrt(reynolds)*Math.cbrt(prandtl);
  const denominator=(1+(0.4/prandtl)**(2/3))**(1/4);
  const correction=(1+(reynolds/282000)**(5/8))**(4/5);
  return 0.3+primary/denominator*correction;
}

export function calculateCylinderCrossflow(raw) {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) return {error:'円柱横流れの入力欄を確認してください。'};
  const v={};
  for (const [key,label,unit,min,max] of crossflowFields) {
    const number=parseFiniteDecimal(raw[key]);
    if (!Number.isFinite(number)) return {error:`${label}には有限の十進数を入力してください。`};
    if (key==='surface' || key==='ambient') {
      if (number <= -273.15 || number > max) return {error:`${label}は絶対零度より高く${max} ℃以下で指定してください。`};
    } else if (number < min || number > max) {
      return {error:`${label}は${min}〜${max} ${unit}で指定してください。`};
    }
    v[key]=number;
  }
  const aspect=v.length/v.diameter;
  if (aspect<10) return {error:'端部の影響を抑える長い円柱の近似です。L/D ≥ 10となる寸法を指定してください。'};
  const nu=v.viscosity/v.density; // m²/s
  const diffusivity=v.conductivity/(v.density*v.cp); // m²/s
  const reynolds=v.density*v.velocity*v.diameter/v.viscosity;
  const prandtl=v.viscosity*v.cp/v.conductivity;
  const peclet=reynolds*prandtl;
  if (!Number.isFinite(reynolds) || !Number.isFinite(prandtl) || !Number.isFinite(peclet))
    return {error:'無次元数の計算範囲を超えています。'};
  if (peclet<=0.2) return {error:'Churchill–Bernstein相関の条件 ReD·Pr > 0.2 を満たしていません。'};
  // These additional conservative teaching-domain bounds are not claimed to be
  // fundamental limits of the Churchill–Bernstein equation.
  if (reynolds>1e7 || prandtl<0.1 || prandtl>1000)
    return {error:'教育用の計算範囲は ReD ≤ 10⁷、0.1 ≤ Pr ≤ 1000です。入力物性・流速を確認してください。'};
  const nusselt=churchillBernsteinNu(reynolds,prandtl);
  const h=nusselt*v.conductivity/v.diameter;
  const lateralArea=Math.PI*v.diameter*v.length;
  const delta=v.surface-v.ambient;
  const heatFlux=h*delta;
  const watts=lateralArea*heatFlux;
  const capacityEquivalent=watts/v.length; // W/m (signed)
  const filmTemperature=(v.surface+v.ambient)/2;
  const values=[aspect,nu,diffusivity,reynolds,prandtl,peclet,nusselt,h,lateralArea,delta,heatFlux,watts,capacityEquivalent,filmTemperature];
  if (values.some(n=>!Number.isFinite(n)) || nusselt<=0 || h<=0)
    return {error:'数値演算の範囲外です。入力を見直してください。'};
  return {values:v,aspect,nu,diffusivity,reynolds,prandtl,peclet,nusselt,h,lateralArea,delta,heatFlux,watts,capacityEquivalent,filmTemperature,
    warning:'相関式は円周平均のhを推定するものです。局所の温度・速度場、後流、自然対流、管群干渉、表面粗さ、端面の損失を予測しません。'};
}

export function renderCrossflowFields(values=CROSSFLOW_DEFAULTS) {
  return crossflowFields.map(([key,label,unit,min,max,help])=>`<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${escapeHtml(values[key])}" min="${min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join('');
}

export function renderCrossflowSteps(result) {
  if (!result || result.error) return '';
  const {values:v,reynolds,prandtl,peclet,nusselt,h,lateralArea,delta,heatFlux,watts,nu,diffusivity,filmTemperature}=result;
  return `<div class="simulation-steps"><p><strong>補足説明：円柱の横流れ強制対流（等温表面）</strong></p>
  <details><summary>1. 基本条件と物性</summary><p>直径D=${fmt(v.diameter)} m、長さL=${fmt(v.length)} mの平滑で長い円柱。主流は円柱軸に直角、速度${fmt(v.velocity)} m/s。表面はTs=${fmt(v.surface)} ℃、主流はT∞=${fmt(v.ambient)} ℃で一様と仮定します。端面や円柱内部の熱伝導は計算しません。</p><p>物性の入力基準は膜温度 (Ts+T∞)/2=${fmt(filmTemperature)} ℃付近です。ν=μ/ρ=${fmt(nu)} m²/s、流体熱拡散率αf=kf/(ρcp)=${fmt(diffusivity)} m²/s。</p></details>
  <details><summary>2. Re・Pr・Nu と熱伝達率</summary><p>ReD=ρu∞D/μ=${fmt(reynolds)}、Pr=μcp/kf=${fmt(prandtl)}、PeD=ReD·Pr=${fmt(peclet)}。いずれも無次元です。</p><p>円周平均NuD=0.3 + [0.62 √ReD Pr^(1/3) / (1+(0.4/Pr)^(2/3))^(1/4)] · [1+(ReD/282000)^(5/8)]^(4/5) = ${fmt(nusselt)}。</p><p>平均h=NuD kf/D=${fmt(h)} W/(m²·K)。この値は円周角度ごとに異なる局所hの予測ではありません。</p></details>
  <details><summary>3. 側面の熱移動率</summary><p>端面を除く側面積 A=πDL=${fmt(lateralArea)} m²、ΔT=Ts−T∞=${fmt(delta)} K。平均熱流束q″=hΔT=${fmt(heatFlux)} W/m²、合計Q̇=hAΔT=${fmt(watts)} W。</p><p>正は円柱から流体への放熱、負は流体から円柱への吸熱です。主流が一定温度の十分大きな領域であると仮定し、流体の下流の温度上昇は計算しません。</p></details>
  <small>適用条件：ReD·Pr&gt;0.2、教育用追加制限 ReD≤10⁷・0.1≤Pr≤1000・L/D≥10。相関式自体に厳密な精度保証はなく、主流の乱れ・浮力・干渉・粗さ・物性変化で実測値は変動します。混合対流の妥当性はここでは判定できません。${result.warning}</small></div>`;
}

export function renderCrossflowDiagram(result) {
  const valid=!!result&&!result.error;
  const flow=valid?`u∞=${fmt(result.values.velocity)} m/s`:'流速は未確定';
  const summary=valid?`円柱の外径${fmt(result.values.diameter)} m、平均熱伝達率${fmt(result.h)} W/(m²·K)、熱移動率${fmt(result.watts)} W`:'有効な入力がありません';
  const arrow=valid&&result.watts<0?'M240 40 L240 62 L235 55 M240 62 L245 55 M240 160 L240 138 L235 145 M240 138 L245 145':'M240 62 L240 40 L235 47 M240 40 L245 47 M240 138 L240 160 L235 153 M240 160 L245 153';
  return `<figure class="simulation-figure"><svg class="sim-physical-diagram" role="img" viewBox="0 0 480 225" xmlns="http://www.w3.org/2000/svg"><title>円柱横流れ強制対流の模式図</title><desc>${escapeHtml(summary)}</desc>
  <path d="M26 91 L161 91 L151 85 M161 91 L151 97 M26 113 L161 113 L151 107 M161 113 L151 119" class="diagram-arrow"/>
  <circle cx="240" cy="100" r="38" class="diagram-solid"/><path d="${arrow}" class="diagram-arrow"/>
  <path d="M319 80 Q355 95 396 75 M319 120 Q355 105 396 125" class="diagram-boundary" fill="none"/>
  <text x="28" y="59" class="chart-label">${escapeHtml(flow)}</text><text x="196" y="203" class="chart-label">円柱（断面）</text><text x="314" y="203" class="chart-label">後流模式</text></svg>
  <figcaption>独自作成の概略図。矢印は主流方向と円柱‐流体間の熱交換方向（吸熱時は逆向き）を示します。流線・後流や局所熱伝達率の実際の分布は描いていません。</figcaption></figure>`;
}

function crossflowCurveGraph(result, samples, chosen, xlabel, ylabel, title, other=null) {
  if (!result || result.error) return '';
  const all=[...samples,...(other||[])],ys=all.map(p=>p[1]);
  let lo=Math.min(...ys),hi=Math.max(...ys);
  if (!Number.isFinite(lo)||!Number.isFinite(hi)) return '';
  if (hi-lo<1e-12){lo-=0.5;hi+=0.5;}
  const W=560,H=255,left=72,right=19,top=20,bottom=49;
  const xmin=samples[0][0],xmax=samples[samples.length-1][0];
  const X=x=>left+(x-xmin)/(xmax-xmin)*(W-left-right);
  const Y=y=>top+(hi-y)/(hi-lo)*(H-top-bottom);
  const curve=points=>points.map(([x,y],i)=>`${i?'L':'M'}${X(x).toFixed(3)},${Y(y).toFixed(3)}`).join(' ');
  const grid=[0,0.5,1].map(f=>{const y=lo+(hi-lo)*f;return `<line class="chart-grid" x1="${left}" x2="${W-right}" y1="${Y(y)}" y2="${Y(y)}"/><text class="chart-label" x="${left-9}" y="${Y(y)+4}" text-anchor="end">${escapeHtml(fmt(y))}</text>`;}).join('');
  const point=Number.isFinite(chosen[0])&&chosen[0]>=xmin&&chosen[0]<=xmax?`<circle class="chart-current-point" cx="${X(chosen[0])}" cy="${Y(chosen[1])}" r="5"/>`:'';
  const desc=`${title}。横軸${xlabel}、縦軸${ylabel}。描画範囲${fmt(xmin)}〜${fmt(xmax)}。現在条件${fmt(chosen[0])}で${fmt(chosen[1])}。${other?'保存条件との比較線あり。':''}`;
  return `<svg class="sim-chart" role="img" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-label="${escapeHtml(desc)}"><title>${escapeHtml(title)}</title><desc>${escapeHtml(desc)}</desc>${grid}
  <path class="chart-current" d="${curve(samples)}"/>${other?`<path class="chart-baseline" d="${curve(other)}"/>`:''}${point}
  <text class="chart-label" x="${left}" y="${H-30}">${escapeHtml(fmt(xmin))}</text><text class="chart-label" x="${W-right}" y="${H-30}" text-anchor="end">${escapeHtml(fmt(xmax))}</text>
  <text class="chart-label" x="${left+(W-left-right)/2}" y="${H-8}" text-anchor="middle">${escapeHtml(xlabel)}</text>
  <text class="chart-label" x="14" y="${top+(H-top-bottom)/2}" transform="rotate(-90 14 ${top+(H-top-bottom)/2})" text-anchor="middle">${escapeHtml(ylabel)}</text></svg>`;
}

// Numerical exploration is clipped to the domain of the empirical correlation.
export function crossflowVelocityGraph(result, comparison=null) {
  if (!result || result.error) return '';
  const v=result.values;
  const velocityMin=Math.max(0.001,v.velocity*0.2,0.2000001*v.viscosity/(v.density*v.diameter*result.prandtl));
  const velocityMax=Math.min(100,v.velocity*3,1e7*v.viscosity/(v.density*v.diameter));
  const xmin=Math.min(velocityMin,v.velocity),xmax=Math.max(velocityMax,v.velocity);
  if (!(xmax>xmin))return '';
  const calc=(speed,base)=>{
    const re=base.values.density*speed*base.values.diameter/base.values.viscosity;
    const pr=base.prandtl;
    if (re*pr<=0.2||re>1e7)return NaN;
    return churchillBernsteinNu(re,pr)*base.values.conductivity/base.values.diameter;
  };
  const points=Array.from({length:61},(_,i)=>{const u=xmin+(xmax-xmin)*i/60;return [u,calc(u,result)]});
  const other=comparison&&!comparison.error?points.map(p=>[p[0],calc(p[0],comparison)]):null;
  // When saved reference falls outside the correlation domain, omit it rather than drawing NaN coordinates.
  const usableOther=other&&other.every(p=>Number.isFinite(p[1]))?other:null;
  return crossflowCurveGraph(result,points,[v.velocity,result.h],'流速 u∞（m/s）','平均h（W/(m²·K)）','流速による円柱の平均熱伝達率',usableOther);
}

export function crossflowDiameterGraph(result, comparison=null) {
  if (!result || result.error) return '';
  const v=result.values;
  const dmin=Math.max(0.001,v.diameter*.5,v.diameter*0.2000001/result.peclet);
  const dmax=Math.min(2,v.length/10,v.diameter*2,v.diameter*1e7/result.reynolds);
  const xmin=Math.min(dmin,v.diameter),xmax=Math.max(dmax,v.diameter);
  if (!(xmax>xmin))return '';
  const rate=(d,base)=>{
    const re=base.values.density*base.values.velocity*d/base.values.viscosity;
    if(re*base.prandtl<=0.2||re>1e7||base.values.length/d<10)return NaN;
    const h=churchillBernsteinNu(re,base.prandtl)*base.values.conductivity/d;
    return h*Math.PI*d*base.values.length*(base.values.surface-base.values.ambient);
  };
  const points=Array.from({length:61},(_,i)=>{const d=xmin+(xmax-xmin)*i/60;return [d,rate(d,result)]});
  const other=comparison&&!comparison.error?points.map(p=>[p[0],rate(p[0],comparison)]):null;
  const usableOther=other&&other.every(p=>Number.isFinite(p[1]))?other:null;
  return crossflowCurveGraph(result,points,[v.diameter,result.watts],'円柱外径 D（m）','熱移動率 Q̇（W）','円柱外径による符号付き熱移動率',usableOther);
}
