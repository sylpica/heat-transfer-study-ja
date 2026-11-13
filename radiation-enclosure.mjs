// Independent educational model: two opaque diffuse-gray isothermal surfaces form an enclosure.
// Surface 1 is convex and sees only surface 2 (F12=1), with A2>=A1.
// No textbook prose, illustrations or numeric tables were copied.
export const RADIATION_SIGMA = 5.670374419e-8; // W/(m²·K⁴), SI exact value
export const RADIATION_ENCLOSURE_DEFAULTS = Object.freeze({
  area1: 1, area2: 4, epsilon1: 0.8, epsilon2: 0.6, temp1: 200, temp2: 25
});
export const radiationEnclosureFields = [
  ['area1', '内側の面積 A₁', 'm²', 0.0001, 1000, '面1が面2を完全に見込む閉鎖系'],
  ['area2', '外側の面積 A₂', 'm²', 0.0001, 1000, 'A₂ ≥ A₁。内側を包む面の面積'],
  ['epsilon1', '内側の放射率 ε₁', '無次元', 0.01, 1, '波長に依存しない拡散灰色面'],
  ['epsilon2', '外側の放射率 ε₂', '無次元', 0.01, 1, '反射を含む拡散灰色面'],
  ['temp1', '内側の温度 T₁', '℃', -273.149999999, 3000, '計算では必ず絶対温度 K に換算'],
  ['temp2', '外側の温度 T₂', '℃', -273.149999999, 3000, '両面とも温度は一定']
];
export const radiationEnclosureFieldNames = radiationEnclosureFields.map(row => row[0]);

function parseDecimal(raw) {
  if (typeof raw !== 'number' && typeof raw !== 'string') return NaN;
  const value = String(raw).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
}
function format(value) {
  return Number(value).toLocaleString('ja-JP', {maximumSignificantDigits: 7});
}

// Numerically more stable than (t1**4 - t2**4) for temperatures close to one another.
export function radiationFourthDifference(t1, t2) {
  return (t1-t2)*(t1+t2)*(t1*t1+t2*t2);
}

export function calculateRadiationEnclosure(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {error:'二面間の放射熱交換の入力項目を確認してください。'};
  }
  const v = {};
  for (const [key, label, unit, min, max] of radiationEnclosureFields) {
    const n = parseDecimal(raw[key]);
    if (!Number.isFinite(n)) return {error:`${label}には有限の十進数を指定してください。`};
    if (key === 'temp1' || key === 'temp2') {
      if (n <= -273.15 || n > 3000) return {error:`${label}は−273.15 ℃より高く、3000 ℃以下で指定してください。`};
    } else if (n < min || n > max) {
      return {error:`${label}は${min}〜${max} ${unit}の範囲で指定してください。`};
    }
    v[key] = n;
  }
  if (v.area1 > v.area2) return {error:'完全な二面閉鎖系では外側の面積A₂を内側の面積A₁以上にしてください。'};

  const t1K = v.temp1+273.15, t2K = v.temp2+273.15;
  const f12 = 1, f21 = v.area1/v.area2, f11 = 0, f22 = 1-f21;
  const rSurface1 = (1-v.epsilon1)/(v.epsilon1*v.area1);
  const rSpace = 1/v.area1;
  const rSurface2 = (1-v.epsilon2)/(v.epsilon2*v.area2);
  const rTotal = rSurface1+rSpace+rSurface2;
  const effectiveEmissivity = 1/(v.area1*rTotal);
  const black1 = RADIATION_SIGMA*t1K**4;
  const black2 = RADIATION_SIGMA*t2K**4;
  const watts = RADIATION_SIGMA*radiationFourthDifference(t1K,t2K)/rTotal;
  const flux1 = watts/v.area1, flux2 = -watts/v.area2;
  const radiosity1 = black1-watts*rSurface1;
  const radiosity2 = black2+watts*rSurface2;
  const irradiation1 = radiosity2; // F12 = 1
  const irradiation2 = f21*radiosity1+f22*radiosity2;
  const netFrom1 = v.area1*(radiosity1-irradiation1);
  const netFrom2 = v.area2*(radiosity2-irradiation2);
  const blackUpperBound = RADIATION_SIGMA*v.area1*radiationFourthDifference(t1K,t2K);
  if ([t1K,t2K,f21,f22,rSurface1,rSpace,rSurface2,rTotal,effectiveEmissivity,
       black1,black2,watts,flux1,flux2,radiosity1,radiosity2,
       irradiation1,irradiation2,netFrom1,netFrom2,blackUpperBound]
      .some(n => !Number.isFinite(n)) || effectiveEmissivity <= 0 || effectiveEmissivity > 1+1e-12) {
    return {error:'計算可能な数値範囲を超えました。温度、面積、放射率を見直してください。'};
  }
  return {values:v,t1K,t2K,f11,f12,f21,f22,rSurface1,rSpace,rSurface2,rTotal,
    effectiveEmissivity,black1,black2,watts,flux1,flux2,radiosity1,radiosity2,
    irradiation1,irradiation2,netFrom1,netFrom2,blackUpperBound};
}

export function renderRadiationEnclosureFields(values=RADIATION_ENCLOSURE_DEFAULTS) {
  return radiationEnclosureFields.map(([key,label,unit,min,max,help]) =>
    `<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${escapeHtml(values[key])}" min="${min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join('');
}

export function renderRadiationEnclosureSteps(result) {
  if (!result || result.error) return '';
  const x=result,v=x.values;
  return `<div class="simulation-steps"><p><strong>補足説明：二つの拡散灰色面の放射熱交換</strong></p>
    <details><summary>1. 形態係数を面積の関係から求める</summary><p>面1は凸形で自分自身を見ず、視界のすべてが面2に届く二面閉鎖系を仮定します。形態係数はF₁₁=0、F₁₂=1、F₂₁=A₁/A₂=${format(x.f21)}、F₂₂=1−F₂₁=${format(x.f22)}。</p><p>相反則 A₁F₁₂=A₂F₂₁、総和則Fᵢ₁+Fᵢ₂=1が成立します。別々の有限平板や開放空間へ、そのまま当てはめることはできません。</p></details>
    <details><summary>2. 放射抵抗と絶対温度</summary><p>温度をKに換算：T₁=${format(x.t1K)} K、T₂=${format(x.t2K)} K。ステファン＝ボルツマン定数σ=5.670374419×10⁻⁸ W/(m²·K⁴)。</p>
    <p>表面抵抗R₁=(1−ε₁)/(A₁ε₁)=${format(x.rSurface1)} m⁻²、空間抵抗R₁₂=1/(A₁F₁₂)=${format(x.rSpace)} m⁻²、表面抵抗R₂=(1−ε₂)/(A₂ε₂)=${format(x.rSurface2)} m⁻²。</p>
    <p>合計R=${format(x.rTotal)} m⁻²、実効放射率εeff=1/(A₁R)=${format(x.effectiveEmissivity)}（無次元）。</p></details>
    <details><summary>3. 熱移動・ラジオシティ・収支を検算</summary><p>Q̇=σ(T₁⁴−T₂⁴)/R=${format(x.watts)} W。正の場合は面1から面2への熱移動です。面1の正味熱流束は${format(x.flux1)} W/m²、面2の外向き正味熱流束は${format(x.flux2)} W/m²。</p>
    <p>黒体の放射発散度Eb₁=${format(x.black1)} W/m²、Eb₂=${format(x.black2)} W/m²。面から出る放射量（ラジオシティ）はJ₁=${format(x.radiosity1)} W/m²、J₂=${format(x.radiosity2)} W/m²。</p><p>照射量G₁=J₂=${format(x.irradiation1)} W/m²、G₂=F₂₁J₁+F₂₂J₂=${format(x.irradiation2)} W/m²。収支A₁(J₁−G₁)=${format(x.netFrom1)} W、A₂(J₂−G₂)=${format(x.netFrom2)} Wは符号が反対です。</p></details>
    <small>独自作成の教育用モデル。透明・非参加の媒質、拡散・灰色・不透明・等温の二面で、内部発熱、対流、伝導、多面反射以外の影響を無視。小さな物体と大きな壁、同心の十分長い円筒・同心球などを理想化したF₁₂=1のモデルであり、実寸の曲率や端効果は直接解きません。</small></div>`;
}

export function renderRadiationEnclosureDiagram(result) {
  const valid=!!result&&!result.error;
  const direction=!valid?'温度差未判定':result.watts>0?'面1 → 面2':result.watts<0?'面2 → 面1':'正味熱移動なし';
  const arrow=valid&&result.watts<0?'M330 96 L273 96 M282 90 L273 96 L282 102':'M273 96 L330 96 M321 90 L330 96 L321 102';
  const summary=!valid?'入力を確認してください。':`内側A1=${format(result.values.area1)}m²、外側A2=${format(result.values.area2)}m²、内側${format(result.values.temp1)}℃、外側${format(result.values.temp2)}℃、正味${format(result.watts)}W、${direction}。`;
  return `<figure class="simulation-figure"><svg class="sim-physical-diagram" viewBox="0 0 480 206" role="img" xmlns="http://www.w3.org/2000/svg"><title>二面閉鎖系の放射熱交換模式図</title><desc>${escapeHtml(summary)}</desc>
    <rect x="65" y="30" width="352" height="142" rx="18" class="diagram-ambient"/>
    <rect x="143" y="65" width="128" height="64" rx="10" class="diagram-solid"/>
    <path d="${arrow}" class="diagram-arrow"/><text x="166" y="87" class="chart-label">面1・内側</text><text x="166" y="107" class="chart-label">F₁₂=1</text>
    <text x="325" y="53" class="chart-label">面2・外側</text><text x="291" y="127" class="chart-label">${escapeHtml(direction)}</text>
    <text x="73" y="194" class="chart-label">相反則：A₁ F₁₂ = A₂ F₂₁</text></svg><figcaption>二面だけで構成される理想閉鎖系の独自模式図。形の縮尺や反射光線の軌跡、実寸の視野角を表しません。矢印は正味熱流の方向です。</figcaption></figure>`;
}

// Comparison chart: radiative heat flow as inner-surface temperature varies.
export function radiationEnclosureHeatGraph(result, comparison=null) {
  if (!result || result.error) return '';
  const other=comparison&&!comparison.error?comparison:null;
  const curr=result.values;
  const all=[curr.temp1,curr.temp2,...(other?[other.values.temp1,other.values.temp2]:[])];
  const margin=Math.max(20,(Math.max(...all)-Math.min(...all))*.12);
  const low=Math.max(-273.149999,Math.min(...all)-margin),high=Math.min(3000,Math.max(...all)+margin);
  const points=model=>Array.from({length:81},(_,i)=>{
    const temp=low+(high-low)*i/80;
    const r=calculateRadiationEnclosure({...model.values,temp1:temp});
    return [temp,r.error?NaN:r.watts];
  });
  const current=points(result),baseline=other?points(other):[];
  const finite=[...current,...baseline].map(p=>p[1]).filter(Number.isFinite);
  if(finite.length!==current.length+baseline.length)return '';
  let min=Math.min(0,...finite),max=Math.max(0,...finite);
  if(max-min<1e-10){min-=.5;max+=.5;}
  const W=560,H=250,left=72,right=22,top=20,bottom=45;
  const X=t=>left+(t-low)/(high-low)*(W-left-right);
  const Y=q=>top+(max-q)/(max-min)*(H-top-bottom);
  const path=ps=>ps.map(([t,q],i)=>`${i?'L':'M'}${X(t).toFixed(2)},${Y(q).toFixed(2)}`).join(' ');
  const grid=[0,.5,1].map(f=>{const q=min+(max-min)*f;return `<line x1="${left}" y1="${Y(q)}" x2="${W-right}" y2="${Y(q)}" class="chart-grid"/><text x="${left-8}" y="${Y(q)+4}" text-anchor="end" class="chart-label">${escapeHtml(format(q))}</text>`;}).join('');
  const desc=`内側温度を変更したときの放射熱移動率。横軸は内側温度℃、縦軸は面1から面2への正味熱移動率W。基準条件の外側温度は${format(curr.temp2)}℃、現在の正味放射は${format(result.watts)}W。${other?'比較条件を破線で示します。':''}`;
  return `<svg class="sim-chart" role="img" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-label="${escapeHtml(desc)}"><title>二面間の放射熱移動率と内側温度</title><desc>${escapeHtml(desc)}</desc>${grid}
    <path d="${path(current)}" class="chart-current"/>${other?`<path d="${path(baseline)}" class="chart-baseline"/>`:''}
    <circle cx="${X(curr.temp1)}" cy="${Y(result.watts)}" r="5" class="chart-current-point"/>
    <text x="${left}" y="${H-27}" class="chart-label">${escapeHtml(format(low))} ℃</text><text x="${W-right}" y="${H-27}" text-anchor="end" class="chart-label">${escapeHtml(format(high))} ℃</text>
    <text x="${left+(W-left-right)/2}" y="${H-7}" text-anchor="middle" class="chart-label">内側温度 T₁（℃）</text><text x="17" y="${top+(H-top-bottom)/2}" transform="rotate(-90 17 ${top+(H-top-bottom)/2})" text-anchor="middle" class="chart-label">放射熱移動率 Q̇（W）</text></svg>`;
}