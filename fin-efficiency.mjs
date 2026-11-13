// Original educational model for a straight circular fin with an insulated tip.
// No text, figures, or data copied from a source book.
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = number => Number(number).toLocaleString('ja-JP', {maximumSignificantDigits:7});

export const finFields = [
  ['k', '熱伝導率 k', 'W/(m·K)', 0.01, 1000, 'フィン材を均質・一定物性と仮定'],
  ['h', '側面の対流熱伝達率 h', 'W/(m²·K)', 0.01, 100000, '側面に一様な係数を指定'],
  ['length', 'フィン長さ L', 'm', 0.00001, 2, '根元から断熱先端までの距離'],
  ['radius', '円柱半径 r', 'm', 0.00001, 0.5, '断面一定の円形フィン'],
  ['base', '根元温度 Tb', '℃', -273.149999999, 3000, '根元は指定温度に維持'],
  ['ambient', '流体温度 T∞', '℃', -273.149999999, 3000, '周囲温度は一様で一定']
];
export const finFieldNames = finFields.map(field => field[0]);
export const FIN_DEFAULTS = Object.freeze({k:200, h:40, length:0.1, radius:0.01, base:80, ambient:20});

// Number(string) alone would accept empty strings and hex notation. Reject both.
function parseFinite(raw) {
  if (typeof raw !== 'number' && typeof raw !== 'string') return NaN;
  const value = String(raw).trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

export function calculateFinEfficiency(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values))
    return {error:'フィンの入力項目を確認してください。'};
  const v = {};
  for (const [key, label, unit, min, max] of finFields) {
    const number = parseFinite(values[key]);
    if (!Number.isFinite(number)) return {error:`${label}には有限の数値を入力してください。`};
    if ((key === 'base' || key === 'ambient') ? (number <= -273.15 || number > max) : (number < min || number > max))
      return {error:`${label}は${key === 'base' || key === 'ambient' ? '−273.15 ℃より高く、3000 ℃以下' : `${min}〜${max} ${unit}`}で指定してください。`};
    v[key] = number;
  }
  const crossArea = Math.PI*v.radius**2;       // m²
  const perimeter = 2*Math.PI*v.radius;        // m
  const sideArea = perimeter*v.length;         // m², tip intentionally excluded
  const m = Math.sqrt(v.h*perimeter/(v.k*crossArea)); // 1/m
  const z = m*v.length;
  // The small-z series avoids cancellation in the theoretical limit η → 1.
  const efficiency = z < 1e-3 ? 1-z*z/3+2*z**4/15 : Math.tanh(z)/z;
  const delta = v.base-v.ambient;
  const idealWatts = v.h*sideArea*delta;
  const watts = efficiency*idealWatts;          // signed: + from fin to fluid
  const tipRatio = 2*Math.exp(-z)/(1+Math.exp(-2*z));
  const tipTemperature = v.ambient+delta*tipRatio;
  const baseWatts = v.k*crossArea*m*delta*Math.tanh(z);
  const candidates = [crossArea,perimeter,sideArea,m,z,efficiency,idealWatts,watts,tipRatio,tipTemperature,baseWatts];
  if (candidates.some(number => !Number.isFinite(number)) || efficiency <= 0 || efficiency > 1)
    return {error:'計算できる数値範囲を超えています。入力を見直してください。'};
  return {values:v,crossArea,perimeter,sideArea,m,z,efficiency,delta,idealWatts,watts,tipRatio,tipTemperature,baseWatts};
}

// Stable cosh(m(L-x))/cosh(mL), including large mL where raw cosh overflows.
export function finTemperatureAt(result, x) {
  if (!result || result.error || !Number.isFinite(x) || x < 0 || x > result.values.length)
    throw new RangeError('有効なモデルと、0〜Lの位置を指定してください。');
  const u = x/result.values.length, z = result.z;
  const ratio = (Math.exp(-z*u)+Math.exp(-z*(2-u)))/(1+Math.exp(-2*z));
  return result.values.ambient+result.delta*ratio;
}

export function renderFinFields(values = FIN_DEFAULTS) {
  return finFields.map(([key,label,unit,min,max,help]) =>
    `<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${esc(values[key])}" min="${min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join('');
}

export function renderFinSteps(result) {
  if (!result || result.error) return '';
  const {values:v,crossArea,perimeter,sideArea,m,z,efficiency,idealWatts,watts,tipTemperature} = result;
  return `<div class="simulation-steps"><p><strong>補足説明：フィンの温度分布と熱移動</strong></p>
    <details><summary>1. モデルと境界条件</summary><p>一定断面の直線円柱フィン、軸方向一次元・定常伝導、側面の一様な対流を仮定します。根元は Tb=${fmt(v.base)} ℃、周囲流体は T∞=${fmt(v.ambient)} ℃。先端は断熱、内部発熱・放射・根元の接触抵抗は含みません。</p><p>根元温度差 θb=Tb−T∞=${fmt(result.delta)} K。正の熱移動率はフィンから流体へ向かいます。</p></details>
    <details><summary>2. 断面、無次元長さと効率</summary><p>断面積 Ac=πr²=${fmt(crossArea)} m²、周長 P=2πr=${fmt(perimeter)} m、側面積 As=PL=${fmt(sideArea)} m²。先端面積は含みません。</p><p>m=√(hP/(kAc))=${fmt(m)} m⁻¹、mL=${fmt(z)}（無次元）。</p><p>断熱先端の効率 ηf=tanh(mL)/(mL)=${fmt(efficiency)}。これは側面の実放熱量を「側面全体が根元温度にある場合」の理想放熱量で割ったものです。</p></details>
    <details><summary>3. 放熱量と先端温度を検算</summary><p>理想熱移動率 Q̇ideal=hAs(Tb−T∞)=${fmt(idealWatts)} W。</p><p>実熱移動率 Q̇f=ηf Q̇ideal=${fmt(watts)} W。根元の伝導熱流 −kAc dT/dx|x=0 と等しくなります。</p><p>先端温度 T(L)=${fmt(tipTemperature)} ℃。温度分布は [T(x)−T∞]/(Tb−T∞)=cosh[m(L−x)]/cosh(mL) で与えられます。温度差が0の場合は両側とも一様温度となり、比の式ではなく直接T(x)=T∞です。</p></details>
    <small>独自作成の教育用近似モデル。側面積のみで効率を定義し、先端は断熱です。フィン先端の対流、温度依存物性、二次元の根元熱拡散、自然対流のh予測は扱いません。</small></div>`;
}

export function renderFinDiagram(result) {
  const invalid=!result||result.error;
  const v=invalid?null:result.values;
  const direction=invalid?'未判定':result.watts>0?'フィンから流体への放熱':result.watts<0?'流体からフィンへの吸熱':'正味の熱移動なし';
  const arrows=!invalid && result.watts < 0 ? 'M160 44 L160 70 M154 64 L160 70 L166 64 M255 44 L255 70 M249 64 L255 70 L261 64 M345 44 L345 70 M339 64 L345 70 L351 64' : 'M160 70 L160 44 M154 50 L160 44 L166 50 M255 70 L255 44 M249 50 L255 44 L261 50 M345 70 L345 44 M339 50 L345 44 L351 50';
  const summary=invalid?'入力が無効でフィンの模式図を表示しています。':`根元${fmt(v.base)}℃、先端${fmt(result.tipTemperature)}℃、周囲${fmt(v.ambient)}℃。${direction}。断熱先端の一次元モデル。`;
  return `<figure class="simulation-figure"><svg class="sim-physical-diagram" viewBox="0 0 480 210" role="img" xmlns="http://www.w3.org/2000/svg"><title>円柱フィンの定常温度分布模式図</title><desc>${esc(summary)}</desc>
    <rect x="42" y="35" width="48" height="136" class="diagram-ambient"/><rect x="90" y="79" width="300" height="43" class="diagram-solid"/>
    <line x1="390" y1="73" x2="390" y2="129" class="diagram-boundary"/>
    <path d="${arrows}" class="diagram-arrow"/>
    <text x="12" y="24" class="chart-label">根元</text><text x="366" y="24" class="chart-label">断熱先端</text>
    <text x="101" y="153" class="chart-label">x = 0</text><text x="346" y="153" class="chart-label">x = L</text>
    <text x="42" y="191" class="chart-label">${esc(invalid?'入力を確認':`Tb=${fmt(v.base)} ℃`)}</text><text x="258" y="191" class="chart-label">${esc(invalid?'':`T∞=${fmt(v.ambient)} ℃`)}</text>
    <text x="118" y="19" class="chart-label">${esc(direction)}</text></svg>
    <figcaption>アプリ作成の模式図。円柱の寸法比・内部温度の色分布・流れ場は表していません。矢印は側面との熱交換経路の例です。</figcaption></figure>`;
}

export function finTemperatureGraph(result, comparison=null) {
  if (!result || result.error) return '';
  const other=comparison&&!comparison.error?comparison:null;
  const sample=model=>Array.from({length:51},(_,i)=>[i/50,finTemperatureAt(model,model.values.length*i/50)]);
  const current=sample(result), previous=other?sample(other):[];
  const temperatures=[...current,...previous].map(point=>point[1]);
  let low=Math.min(...temperatures), high=Math.max(...temperatures);
  if(high-low<1e-10){low-=0.5;high+=0.5;}
  const W=560,H=250,left=66,right=20,top=20,bottom=48;
  const X=u=>left+u*(W-left-right),Y=t=>top+(high-t)/(high-low)*(H-top-bottom);
  const path=points=>points.map(([u,t],i)=>`${i?'L':'M'}${X(u).toFixed(3)},${Y(t).toFixed(3)}`).join(' ');
  const ticks=[0,0.5,1].map(f=>{const t=low+(high-low)*f;return `<line x1="${left}" y1="${Y(t)}" x2="${W-right}" y2="${Y(t)}" class="chart-grid"/><text x="${left-9}" y="${Y(t)+4}" text-anchor="end" class="chart-label">${esc(fmt(t))}</text>`;}).join('');
  const description=`フィン軸方向の温度変化。横軸は根元0から先端1までの相対位置x/L、縦軸は温度℃。根元${fmt(result.values.base)}℃、先端${fmt(result.tipTemperature)}℃。${other?'保存条件との比較を表示。':''}`;
  return `<svg class="sim-chart" role="img" viewBox="0 0 ${W} ${H}" aria-label="${esc(description)}" xmlns="http://www.w3.org/2000/svg"><title>フィン内の温度分布</title><desc>${esc(description)}</desc>${ticks}
    <path d="${path(current)}" class="chart-current"/>${other?`<path d="${path(previous)}" class="chart-baseline"/>`:''}
    <circle cx="${X(1)}" cy="${Y(result.tipTemperature)}" r="5" class="chart-current-point"/>
    <text x="${left}" y="${H-29}" class="chart-label">0（根元）</text><text x="${W-right}" y="${H-29}" text-anchor="end" class="chart-label">1（先端）</text>
    <text x="${left+(W-left-right)/2}" y="${H-7}" text-anchor="middle" class="chart-label">相対位置 x/L（無次元）</text>
    <text x="14" y="${top+(H-top-bottom)/2}" transform="rotate(-90 14 ${top+(H-top-bottom)/2})" text-anchor="middle" class="chart-label">温度 T（℃）</text></svg>`;
}