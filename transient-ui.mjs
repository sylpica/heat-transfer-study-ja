// Original educational rendering for a uniform-temperature (lumped capacitance) solid.
// All user strings are escaped before they enter markup; no book text or private assets.
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>Number(n).toLocaleString('ja-JP',{maximumSignificantDigits:7});

export const transientFields=[
  ['h','対流熱伝達率 h','W/(m²·K)',.000001,'流れと形状に依存する係数'],
  ['area','対流する表面積 A','m²',.000001,'流体に接する表面積'],
  ['volume','物体の体積 V','m³',.000001,'内部温度がほぼ均一な物体'],
  ['density','密度 ρ','kg/m³',.000001,'固体の密度'],
  ['cp','比熱容量 cₚ','J/(kg·K)',.000001,'物体の蓄熱特性'],
  ['k','固体の熱伝導率 k','W/(m·K)',.000001,'Biの計算に使用'],
  ['initial','初期温度 T₀','℃',null,'t=0の物体温度'],
  ['ambient','周囲流体温度 T∞','℃',null,'時間によらず一定と仮定'],
  ['time','経過時間 t','秒',0,'時間は秒で指定']
];
export const transientFieldNames=transientFields.map(x=>x[0]);
export function renderTransientFields(values){
  return transientFields.map(([key,label,unit,min,help])=>`<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${esc(values[key])}" min="${min??''}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join('');
}
export function renderTransientSteps(x){
  const v=x.values;
  return `<div class="simulation-steps"><p><strong>補足説明：保存則から結果まで</strong></p>
    <details><summary>1. 成立条件とエネルギー保存</summary>
      <p>温度が物体内部で均一なとき、ρVcₚ dT/dt = −hA(T−T∞) と近似できます。初期条件は T(0)=T₀。固体の蓄熱量の減少が周囲への対流放熱量に等しい関係です。</p>
      <p>特性長さ Lc=V/A=${fmt(x.characteristicLength)} m、Bi=hLc/k=${fmt(x.biot)}。<strong>${esc(x.applicability)}</strong></p></details>
    <details><summary>2. 時定数・温度に代入する</summary>
      <p>蓄熱容量ρVcₚ=${fmt(v.density)} kg/m³ × ${fmt(v.volume)} m³ × ${fmt(v.cp)} J/(kg·K)=${fmt(x.capacity)} J/K。</p>
      <p>対流コンダクタンス hA=${fmt(v.h)} W/(m²·K) × ${fmt(v.area)} m²=${fmt(x.conductance)} W/K。</p>
      <p>τ=(ρVcₚ)/(hA)=${fmt(x.tau)} s。exp(−t/τ)=${fmt(x.fraction)}（無次元）。</p>
      <p>T(t)=${fmt(v.ambient)} ℃ + (${fmt(v.initial)} − ${fmt(v.ambient)}) K × ${fmt(x.fraction)}=${fmt(x.temperature)} ℃。</p></details>
    <details><summary>3. 瞬間の放熱と累積熱量を検算</summary>
      <p>熱移動率 Q̇=hA(T−T∞)=${fmt(x.watts)} W（正は外向き放熱、負は吸熱）。</p>
      <p>物体から出た累積熱量 E=ρVcₚ(T₀−T)=${fmt(x.energyJ)} J。WはJ/s、Jは累積量であり同じ単位ではありません。</p>
      <p>t=τでは周囲との初期温度差の1/e≈36.8%が残ります。これは物体自体の摂氏温度の36.8%という意味ではありません。</p></details>
    <small>独立作成の補足モデル。固体内部の温度分布、放射、相変化、物性や周囲温度の時間変化は含みません。</small></div>`;
}
export function transientGraph(x,other){
  const limit=1e12;
  const span=Math.max(1,Math.min(limit,x.values.time*1.5),Math.min(limit,x.tau*3),
    other?Math.min(limit,other.values.time*1.5):0,other?Math.min(limit,other.tau*3):0);
  const series=v=>Array.from({length:41},(_,i)=>{const t=span*i/40;return [t,v.values.ambient+(v.values.initial-v.values.ambient)*Math.exp(-t/v.tau)];});
  const a=series(x),b=other?series(other):[];
  const values=[...a.map(z=>z[1]),...b.map(z=>z[1])];
  let low=Math.min(...values),high=Math.max(...values);
  if(low===high){low-=.5;high+=.5;}
  const W=560,H=250,left=66,right=20,top=18,bottom=48,plotW=W-left-right,plotH=H-top-bottom;
  const X=t=>left+t/span*plotW,Y=t=>top+(high-t)/(high-low)*plotH;
  const path=v=>v.map(([t,T],i)=>`${i?'L':'M'}${X(t)},${Y(T)}`).join(' ');
  const ticks=[0,.5,1].map(f=>{const T=low+(high-low)*f;return `<line x1="${left}" y1="${Y(T)}" x2="${W-right}" y2="${Y(T)}" class="chart-grid"/><text x="${left-8}" y="${Y(T)+4}" text-anchor="end" class="chart-label">${T.toPrecision(3)}</text>`;}).join('');
  const marker=x.values.time<=span?`<circle cx="${X(x.values.time)}" cy="${Y(x.temperature)}" r="5" class="chart-current-point"/>`:'';
  return `<svg class="sim-chart" role="img" viewBox="0 0 ${W} ${H}" aria-label="温度履歴。現在${x.values.time.toPrecision(3)}秒で${x.temperature.toPrecision(4)}℃。横軸は秒、縦軸は摂氏温度。"><title>時間に対する物体温度</title>${ticks}
    <path d="${path(a)}" class="chart-current"/>${other?`<path d="${path(b)}" class="chart-baseline"/>`:''}${marker}
    <text class="chart-label" x="${left}" y="${H-29}">0</text><text class="chart-label" x="${W-right}" y="${H-29}" text-anchor="end">${span.toPrecision(3)}</text>
    <text class="chart-label" x="${left+plotW/2}" y="${H-7}" text-anchor="middle">経過時間 t（秒）</text>
    <text class="chart-label" x="14" y="${top+plotH/2}" transform="rotate(-90 14 ${top+plotH/2})" text-anchor="middle">物体温度 T（℃）</text></svg>`;
}
