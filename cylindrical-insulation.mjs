// Original educational model: radial steady conduction across an insulated long cylinder.
// Fixed inner pipe surface temperature; negligible end losses; constant insulation k and outer h.
// No book text, illustrations, or numeric reference data is reproduced.
export const CYLINDER_DEFAULTS = Object.freeze({radius:0.004,thickness:0.003,length:1,k:0.05,h:5,base:80,ambient:20});

export const cylinderFields = [
  ['radius','内側円筒の半径 r₀','m',0.0001,0.5,'温度を一定に保つ配管・線材の外表面半径'],
  ['thickness','断熱材の厚さ d','m',0,0.5,'d=0は断熱材なし'],
  ['length','対象の円筒長さ ℓ','m',0.01,50,'端面の影響を無視できると仮定'],
  ['k','断熱材の熱伝導率 k','W/(m·K)',0.01,100,'温度に依存しない一定の熱伝導率'],
  ['h','外側の熱伝達率 h','W/(m²·K)',0.1,100000,'外表面全体で一定と仮定'],
  ['base','内側の表面温度 Tb','℃',-273.149999999,1500,'r=r₀で一定の境界温度'],
  ['ambient','周囲流体の温度 T∞','℃',-273.149999999,1500,'円筒の外側の一定温度']
];
export const cylinderFieldNames = cylinderFields.map(row=>row[0]);

function parseDecimal(raw) {
  if (typeof raw!=='number' && typeof raw!=='string') return NaN;
  const s=String(raw).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return NaN;
  const n=Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function esc(v) { return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function fmt(n) { return Number(n).toLocaleString('ja-JP',{maximumSignificantDigits:7}); }

export function calculateCylindricalInsulation(raw) {
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) return {error:'円筒断熱モデルの入力を確認してください。'};
  const v={};
  for (const [key,label,unit,min,max] of cylinderFields) {
    const n=parseDecimal(raw[key]);
    if (!Number.isFinite(n)) return {error:`${label}には有限の十進数を入力してください。`};
    if (key==='base'||key==='ambient') {
      if(n<=-273.15||n>max) return {error:`${label}は−273.15 ℃より高く${max} ℃以下で入力してください。`};
    } else if(n<min||n>max) return {error:`${label}は${min}〜${max} ${unit}で入力してください。`};
    v[key]=n;
  }
  const outerRadius=v.radius+v.thickness;
  const innerArea=2*Math.PI*v.radius*v.length, outerArea=2*Math.PI*outerRadius*v.length;
  // log1p avoids cancellation when d is small relative to r0.
  const radialResistance=Math.log1p(v.thickness/v.radius)/(2*Math.PI*v.k*v.length);
  const convectionResistance=1/(v.h*outerArea);
  const resistance=radialResistance+convectionResistance;
  const delta=v.base-v.ambient;
  const watts=delta/resistance; // Signed: positive means outward from the cylinder.
  const outerTemperature=v.base-watts*radialResistance;
  const outerFlux=watts/outerArea;
  const criticalRadius=v.k/v.h;
  const criticalThickness=Math.max(0,criticalRadius-v.radius);
  const criticalAccessible=criticalRadius>v.radius && criticalThickness<=0.5;
  const noInsulationResistance=1/(v.h*innerArea);
  const noInsulationWatts=delta/noInsulationResistance;
  // Ratio of |Q(d)| to |Q(0)|, independent of delta even if delta=0.
  const relativeMagnitude=noInsulationResistance/resistance;
  const increasingBeforeCritical=v.radius < criticalRadius;
  const nearCritical=Math.abs(outerRadius-criticalRadius)<=1e-12*Math.max(1,outerRadius,criticalRadius);
  const trend=nearCritical?'臨界半径の位置':outerRadius<criticalRadius?'厚さを増やすと絶対熱移動率が増加':'厚さを増やすと絶対熱移動率が減少';
  const check=[outerRadius,innerArea,outerArea,radialResistance,convectionResistance,resistance,watts,outerTemperature,outerFlux,criticalRadius,criticalThickness,noInsulationResistance,noInsulationWatts,relativeMagnitude];
  if(check.some(x=>!Number.isFinite(x))||resistance<=0||relativeMagnitude<=0) return {error:'計算可能な数値範囲を超えました。'};
  return {values:v,outerRadius,innerArea,outerArea,radialResistance,convectionResistance,resistance,
    delta,watts,outerTemperature,outerFlux,criticalRadius,criticalThickness,criticalAccessible,
    noInsulationResistance,noInsulationWatts,relativeMagnitude,increasingBeforeCritical,nearCritical,trend};
}

export function cylinderTemperatureAt(result,r) {
  if (!result||result.error||typeof r!=='number'||!Number.isFinite(r)||r<result.values.radius||r>result.outerRadius)
    throw new RangeError('有効な計算結果と、r₀〜r外の半径を指定してください。');
  // At thickness=0 the single point is exactly the fixed-temperature boundary.
  return result.values.base-result.watts*Math.log1p((r-result.values.radius)/result.values.radius)/(2*Math.PI*result.values.k*result.values.length);
}

export function renderCylinderFields(values=CYLINDER_DEFAULTS) {
  return cylinderFields.map(([key,label,unit,min,max,help])=>
    `<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${esc(values[key])}" min="${min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join('');
}

export function renderCylinderSteps(result) {
  if(!result||result.error) return '';
  const r=result,v=r.values;
  const status=r.criticalRadius<=v.radius?'rcrit≤r₀なので、断熱材の追加に伴い絶対熱移動率は単調に減少します。':r.criticalAccessible?`dcrit=${fmt(r.criticalThickness)} mで絶対熱移動率が最大になります。`:'臨界半径は入力可能な厚さ0.5 mの範囲外です。';
  return `<div class="simulation-steps"><p><strong>補足説明：円筒の放熱と臨界断熱半径</strong></p>
  <details><summary>1. モデルと熱抵抗</summary><p>配管の外表面半径r₀=${fmt(v.radius)} mを温度Tb=${fmt(v.base)} ℃に維持し、長さℓ=${fmt(v.length)} mの円筒に熱伝導率k=${fmt(v.k)} W/(m·K)の断熱材を厚さd=${fmt(v.thickness)} mで巻きます。外側流体はT∞=${fmt(v.ambient)} ℃、熱伝達率h=${fmt(v.h)} W/(m²·K)。円筒の端面損失は含みません。</p><p>外半径r=${fmt(r.outerRadius)} m、外表面積Ao=2πrℓ=${fmt(r.outerArea)} m²。伝導抵抗 Rcond=ln(r/r₀)/(2πkℓ)=${fmt(r.radialResistance)} K/W、対流抵抗 Rconv=1/(hAo)=${fmt(r.convectionResistance)} K/W。合計R=${fmt(r.resistance)} K/W。</p></details>
  <details><summary>2. 温度分布と放熱量</summary><p>外向きを正とすると Q̇=(Tb−T∞)/R=${fmt(r.watts)} W。断熱材外表面はTs=Tb−Q̇Rcond=${fmt(r.outerTemperature)} ℃。外面熱流束は q″=Q̇/Ao=${fmt(r.outerFlux)} W/m²。</p><p>断熱材内部の温度は T(r)=Tb−Q̇ ln(r/r₀)/(2πkℓ)。外側の境界では Q̇=hAo(Ts−T∞) と一致します。</p></details>
  <details><summary>3. なぜ断熱材を足すと放熱が増えることがあるか</summary><p>断熱材を厚くすると伝導抵抗は増えますが、対流を受ける外表面積も増え、対流抵抗が減少します。合成抵抗の極小を与える臨界半径は rcrit=k/h=${fmt(r.criticalRadius)} m。${status}</p><p>断熱材なしの熱移動率はQ̇₀=${fmt(r.noInsulationWatts)} W、現在の絶対熱移動率の比は|Q̇|/|Q̇₀|=${fmt(r.relativeMagnitude)}。現在の外半径における傾向：${r.trend}。</p></details>
  <small>固定した内側の表面温度、軸方向に長い円筒、定常一次元半径方向伝導、一定k・hを仮定します。配管内側の流れ・管壁の抵抗・端面・放射・温度依存物性・実際のhの変化は含みません。臨界半径は一定hモデルの理論上の極値で、保温設計の推奨厚さを意味しません。</small></div>`;
}

export function renderCylinderDiagram(result) {
  const ok=!!result&&!result.error,v=ok?result.values:null;
  const direction=ok?(result.watts>0?'外向きに放熱':result.watts<0?'内向きに吸熱':'正味熱流なし'):'計算不可';
  const arrows=ok&&result.watts<0?'M380 80 L334 80 M342 74 L334 80 L342 86 M100 120 L147 120 M139 114 L147 120 L139 126':'M334 80 L380 80 M372 74 L380 80 L372 86 M147 120 L100 120 M108 114 L100 120 L108 126';
  const title=ok?`内半径${fmt(v.radius)} m、外半径${fmt(result.outerRadius)} m。熱移動率${fmt(result.watts)} W。${direction}。`:'入力条件を確認してください。';
  return `<figure class="simulation-figure"><svg class="sim-physical-diagram" viewBox="0 0 480 210" role="img" xmlns="http://www.w3.org/2000/svg"><title>円筒断熱材の断面模式図</title><desc>${esc(title)}</desc><circle cx="240" cy="100" r="80" class="diagram-ambient"/><circle cx="240" cy="100" r="54" class="diagram-solid"/><circle cx="240" cy="100" r="28" class="diagram-boundary" fill="none"/><path d="${arrows}" class="diagram-arrow"/><text x="214" y="105" class="chart-label">配管</text><text x="194" y="163" class="chart-label">断熱材</text><text x="10" y="24" class="chart-label">${esc(direction)}</text><text x="10" y="192" class="chart-label">${esc(ok?`Tb=${fmt(v.base)} ℃`:'入力を確認')}</text><text x="298" y="192" class="chart-label">${esc(ok?`T∞=${fmt(v.ambient)} ℃`:'')}</text></svg><figcaption>独自作成の断面模式図。円の大きさは実際の半径比を表しません。</figcaption></figure>`;
}

export function cylinderTemperatureGraph(result, comparison=null) {
  if(!result||result.error)return '';
  const another=comparison&&!comparison.error?comparison:null;
  const profile=x=>Array.from({length:61},(_,i)=>[i/60,cylinderTemperatureAt(x,x.values.radius+x.values.thickness*i/60)]);
  const current=profile(result), previous=another?profile(another):[];
  const values=[...current,...previous].map(x=>x[1]);
  let min=Math.min(...values),max=Math.max(...values);
  if(max-min<1e-10){min-=0.5;max+=0.5;}
  const W=560,H=250,left=68,right=20,top=20,bottom=48;
  const X=x=>left+x*(W-left-right),Y=y=>top+(max-y)/(max-min)*(H-top-bottom);
  const path=rows=>rows.map(([x,y],i)=>`${i?'L':'M'}${X(x).toFixed(3)},${Y(y).toFixed(3)}`).join(' ');
  const grid=[0,0.5,1].map(fr=>{const t=min+(max-min)*fr;return `<line class="chart-grid" x1="${left}" x2="${W-right}" y1="${Y(t)}" y2="${Y(t)}"/><text class="chart-label" x="${left-8}" y="${Y(t)+4}" text-anchor="end">${esc(fmt(t))}</text>`;}).join('');
  const description=`円筒断熱材内部の温度分布。横軸0は内面、1は外面。d=0では単一面を示します。内面${fmt(result.values.base)}℃、外面${fmt(result.outerTemperature)}℃。${another?'比較条件の曲線を重ねて表示。':''}`;
  return `<svg class="sim-chart" role="img" viewBox="0 0 ${W} ${H}" aria-label="${esc(description)}" xmlns="http://www.w3.org/2000/svg"><title>円筒壁内の半径方向温度分布</title><desc>${esc(description)}</desc>${grid}<path class="chart-current" d="${path(current)}"/>${another?`<path class="chart-baseline" d="${path(previous)}"/>`:''}<text class="chart-label" x="${left}" y="${H-29}">0（内面）</text><text class="chart-label" x="${W-right}" y="${H-29}" text-anchor="end">1（外面）</text><text class="chart-label" x="${left+(W-left-right)/2}" y="${H-7}" text-anchor="middle">相対位置 (r−r₀)/d（d=0は単一面）</text><text class="chart-label" x="14" y="${top+(H-top-bottom)/2}" transform="rotate(-90 14 ${top+(H-top-bottom)/2})" text-anchor="middle">温度 T（℃）</text></svg>`;
}

export function cylinderThicknessGraph(result,comparison=null) {
  if(!result||result.error)return '';
  const prev=comparison&&!comparison.error?comparison:null;
  const r=result, dcrit=r.criticalThickness;
  const highest=Math.min(0.5,Math.max(0.02,2.5*r.values.thickness,dcrit>0&&dcrit<=0.5?1.6*dcrit:0,prev?prev.values.thickness*2.5:0));
  // Plot |Q|, so the shape also remains readable for inward heat transfer.
  const sample=x=>Array.from({length:73},(_,i)=>{
    const d=highest*i/72,outer=x.values.radius+d;
    const R=Math.log1p(d/x.values.radius)/(2*Math.PI*x.values.k*x.values.length)+1/(x.values.h*2*Math.PI*outer*x.values.length);
    return [d/highest,Math.abs(x.delta)/R];
  });
  const current=sample(r),baseline=prev?sample(prev):[];
  const ymax=Math.max(...current.map(p=>p[1]),...baseline.map(p=>p[1]),1e-12)*1.08;
  const W=560,H=250,left=70,right=18,top=20,bottom=52;
  const X=x=>left+x*(W-left-right),Y=y=>top+(1-y/ymax)*(H-top-bottom);
  const path=rows=>rows.map(([x,y],i)=>`${i?'L':'M'}${X(x).toFixed(3)},${Y(y).toFixed(3)}`).join(' ');
  const mark=r.values.thickness<=highest?`<circle class="chart-current-point" cx="${X(r.values.thickness/highest)}" cy="${Y(Math.abs(r.watts))}" r="5"/>`:'';
  const critical=dcrit>0&&dcrit<=highest?`<line class="chart-grid" x1="${X(dcrit/highest)}" x2="${X(dcrit/highest)}" y1="${top}" y2="${H-bottom}"/><text class="chart-label" x="${X(dcrit/highest)+4}" y="${top+12}">dcrit</text>`:'';
  const desc=`断熱材の厚さdと絶対熱移動率|Q|の関係。横軸は0〜${fmt(highest)}m、縦軸はW。現在の厚さ${fmt(r.values.thickness)}m、絶対熱移動率${fmt(Math.abs(r.watts))}W。${prev?'比較条件の曲線も表示。':''}`;
  const ticks=[0,0.5,1].map(fr=>`<line class="chart-grid" x1="${left}" x2="${W-right}" y1="${Y(fr*ymax)}" y2="${Y(fr*ymax)}"/><text class="chart-label" x="${left-8}" y="${Y(fr*ymax)+4}" text-anchor="end">${esc(fmt(fr*ymax))}</text>`).join('');
  return `<svg class="sim-chart" role="img" viewBox="0 0 ${W} ${H}" aria-label="${esc(desc)}" xmlns="http://www.w3.org/2000/svg"><title>断熱材の厚さと熱移動率の関係</title><desc>${esc(desc)}</desc>${ticks}${critical}<path class="chart-current" d="${path(current)}"/>${prev?`<path class="chart-baseline" d="${path(baseline)}"/>`:''}${mark}<text class="chart-label" x="${left}" y="${H-29}">0</text><text class="chart-label" x="${W-right}" y="${H-29}" text-anchor="end">${esc(fmt(highest))} m</text><text class="chart-label" x="${left+(W-left-right)/2}" y="${H-7}" text-anchor="middle">断熱材の厚さ d（m）</text><text class="chart-label" x="14" y="${top+(H-top-bottom)/2}" transform="rotate(-90 14 ${top+(H-top-bottom)/2})" text-anchor="middle">絶対熱移動率 |Q̇|（W）</text></svg>`;
}