// Original, standalone half-space transient conduction simulator.
// Boundary x=0 is instantaneously fixed at Ts, and x>0 starts at Ti.
// Its exact physics is evaluated using a numerical erfc quadrature, not copied source content.
export const SEMI_INFINITE_DEFAULTS = Object.freeze({
  k: 15, density: 7800, cp: 500, initial: 20, surface: 100,
  time: 60, depth: 0.01, area: 0.2, availableDepth: 0.1
});
export const semiInfiniteFields = [
  ['k','固体の熱伝導率 k','W/(m·K)',0.01,500,'一定・均質な物性と仮定'],
  ['density','固体の密度 ρ','kg/m³',100,25000,'相変化・密度変化を無視'],
  ['cp','固体の比熱容量 cₚ','J/(kg·K)',50,10000,'一定の比熱容量'],
  ['initial','固体の初期温度 Ti','℃',-273.15,3000,'深さ方向に一様な初期温度'],
  ['surface','維持する表面温度 Ts','℃',-273.15,3000,'t>0に表面が瞬時にこの温度になる'],
  ['time','経過時間 t','s',0.001,1e8,'t=0の表面熱流束は発散するため扱わない'],
  ['depth','温度を知りたい深さ x','m',0,20,'加熱・冷却面から内側へ測る'],
  ['area','対象とする表面積 A','m²',0.0001,1000,'周囲の端面熱流・二次元効果は無視'],
  ['availableDepth','実物の奥行き D','m',0.0001,20,'半無限体近似の判定目安にのみ使用']
];
export const semiInfiniteFieldNames=semiInfiniteFields.map(row=>row[0]);

function decimal(raw){
  if(typeof raw!=='string'&&typeof raw!=='number')return NaN;
  const s=String(raw).trim();
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return NaN;
  const n=Number(s);return Number.isFinite(n)?n:NaN;
}
const escapeHtml = raw=>String(raw??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = n=>Number(n).toLocaleString('ja-JP',{maximumSignificantDigits:7});

// Gauss–Legendre quadrature on [0,1] with 32 points; supports erfc to ~double precision
// in the temperature-relevant range. For z>=3.5 the far Gaussian tail is integrated separately to avoid cancellation.
function gaussLegendre32(){
  const n=32,nodes=Array(n),weights=Array(n);
  for(let i=0;i<n/2;i++){
    let z=Math.cos(Math.PI*(i+0.75)/(n+0.5));
    let derivative=0;
    for(let j=0;j<24;j++){
      let p0=1,p1=z;
      for(let k=2;k<=n;k++){
        const p=((2*k-1)*z*p1-(k-1)*p0)/k;
        p0=p1;p1=p;
      }
      derivative=n*(z*p1-p0)/(z*z-1);
      const next=z-p1/derivative;
      if(Math.abs(next-z)<2e-16){z=next;break;}
      z=next;
    }
    // Recalculate derivative at the refined root for symmetric weights.
    let p0=1,p1=z;
    for(let k=2;k<=n;k++){
      const p=((2*k-1)*z*p1-(k-1)*p0)/k;
      p0=p1;p1=p;
    }
    derivative=n*(z*p1-p0)/(z*z-1);
    const w=1/((1-z*z)*derivative*derivative);
    nodes[i]=(1-z)/2;nodes[n-1-i]=(1+z)/2;
    weights[i]=w;weights[n-1-i]=w;
  }
  return {nodes,weights};
}
const QUAD=gaussLegendre32();
export function semiInfiniteErfc(z){
  if(!Number.isFinite(z)||z<0)throw new RangeError('erfcの引数は非負の有限数です。');
  if(z===0)return 1;
  if(z>=27)return 0; // erfc(27) < 6×10^-319, physically irrelevant here
  if(z>=3.5){
    // Evaluate the Gaussian tail directly: 2 exp(-z²)/sqrt(pi) *
    // integral_0^infinity exp(-2 z u - u²) du.
    // At z>=3.5, truncation at u=4 has absolute error <10^-23.
    let tail=0;
    for(let i=0;i<32;i++){
      const u=4*QUAD.nodes[i];
      tail+=QUAD.weights[i]*Math.exp(-2*z*u-u*u);
    }
    return (8/Math.sqrt(Math.PI))*Math.exp(-z*z)*tail;
  }
  let sum=0;
  for(let i=0;i<32;i++){
    const u=z*QUAD.nodes[i];
    sum+=QUAD.weights[i]*Math.exp(-u*u);
  }
  return Math.max(0,Math.min(1,1-2*z*sum/Math.sqrt(Math.PI)));
}
const PENETRATION_Z = (()=>{
  let lo=0,hi=4;
  for(let i=0;i<55;i++){
    const mid=(lo+hi)/2;
    if(semiInfiniteErfc(mid)>0.01)lo=mid;else hi=mid;
  }
  return (lo+hi)/2;
})();

export function calculateSemiInfinite(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {error:'半無限体の入力項目を確認してください。'};
  const v={};
  for(const [key,label,unit,min,max] of semiInfiniteFields){
    const n=decimal(raw[key]);
    if(!Number.isFinite(n))return {error:`${label}には有限の十進数を指定してください。`};
    if(key==='initial'||key==='surface'){
      if(n<=-273.15||n>max)return {error:`${label}は−273.15 ℃を超え3000 ℃以下で指定してください。`};
    }else if(n<min||n>max)return {error:`${label}は${min}〜${max} ${unit}で指定してください。`};
    v[key]=n;
  }
  const alpha=v.k/(v.density*v.cp);
  const diffusionLength=Math.sqrt(alpha*v.time);
  const eta=v.depth/(2*diffusionLength);
  const changeFraction=semiInfiniteErfc(eta);
  const delta=v.surface-v.initial;
  const temperature=v.initial+delta*changeFraction;
  const surfaceFluxIn=v.k*delta/(Math.sqrt(Math.PI)*diffusionLength);
  const surfacePowerIn=surfaceFluxIn*v.area;
  const accumulatedJPerArea=2*v.k*delta*Math.sqrt(v.time/(Math.PI*alpha));
  const accumulatedJ=accumulatedJPerArea*v.area;
  const penetration99=2*PENETRATION_Z*diffusionLength;
  const backsideChangeFraction=semiInfiniteErfc(v.availableDepth/(2*diffusionLength));
  const approxValid=backsideChangeFraction<=.01;
  if([alpha,diffusionLength,eta,temperature,surfaceFluxIn,surfacePowerIn,accumulatedJPerArea,accumulatedJ,penetration99,backsideChangeFraction].some(n=>!Number.isFinite(n)))
    return {error:'計算可能な数値範囲を超えています。入力条件を見直してください。'};
  return {values:v,alpha,diffusionLength,eta,changeFraction,temperature,delta,
    surfaceFluxIn,surfacePowerIn,accumulatedJPerArea,accumulatedJ,
    penetration99,backsideChangeFraction,approxValid,
    validityNote:approxValid?'裏面の温度変化は表面温度差の1%以下という目安を満たします。':'指定奥行きでは裏面の温度変化が1%を超えます。半無限体近似の妥当性を再検討してください。'};
}
export function semiInfiniteTemperatureAt(result,depth,time=result?.values?.time){
  if(!result||result.error||!Number.isFinite(depth)||depth<0||!Number.isFinite(time)||time<0)
    throw new RangeError('有効なモデルと非負の深さ・時間を指定してください。');
  const v=result.values;
  // At t=0 there is a jump at x=0; use the limit t=0+ at the surface.
  if(time===0)return depth===0?v.surface:v.initial;
  return v.initial+result.delta*semiInfiniteErfc(depth/(2*Math.sqrt(result.alpha*time)));
}
export function semiInfiniteInwardFluxAt(result,depth,time=result?.values?.time){
  if(!result||result.error||!Number.isFinite(depth)||depth<0||!Number.isFinite(time)||time<=0)
    throw new RangeError('有限の熱流束には正の時間と非負の深さが必要です。');
  return result.values.k*result.delta/(Math.sqrt(Math.PI*result.alpha*time))*
    Math.exp(-(depth*depth)/(4*result.alpha*time));
}
export function renderSemiInfiniteFields(values=SEMI_INFINITE_DEFAULTS){
  return semiInfiniteFields.map(([key,label,unit,min,max,help])=>
    `<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${escapeHtml(values[key])}" min="${key==='initial'||key==='surface'?-273.1499999:min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join('');
}
export function renderSemiInfiniteSteps(r){
  if(!r||r.error)return '';
  const v=r.values;
  return `<div class="simulation-steps"><p><strong>補足説明：半無限体の表面温度を瞬時に変更</strong></p>
  <details><summary>1. 初期条件・境界条件</summary><p>固体はx≥0を占め、時刻0より前は一様なTi=${fmt(v.initial)} ℃。時刻t&gt;0にx=0の表面をTs=${fmt(v.surface)} ℃に固定。十分深い領域はTiのままと仮定します。観測深さx=${fmt(v.depth)} m、経過時間t=${fmt(v.time)} s。</p><p>表面への外部対流係数hは入力しません。表面温度が指定されているという境界条件です。有限厚さの裏面境界はこの解析解には含みません。</p></details>
  <details><summary>2. 熱拡散率・相似変数・温度分布</summary><p>α=k/(ρcₚ)=${fmt(r.alpha)} m²/s。熱拡散長√(αt)=${fmt(r.diffusionLength)} m。η=x/(2√(αt))=${fmt(r.eta)}。erfc(η)=${fmt(r.changeFraction)}。</p><p>T(x,t)=Ti+(Ts−Ti)erfc(η)=${fmt(r.temperature)} ℃。相補誤差関数erfc(z)=2/√π ∫[z,∞] exp(−u²)du。数値実装では32点Gauss–Legendre積分を用いています。</p></details>
  <details><summary>3. 熱流束と蓄積エネルギー</summary><p>内部向きの表面熱流束q″=k(Ts−Ti)/√(παt)=${fmt(r.surfaceFluxIn)} W/m²、対象面積A=${fmt(v.area)} m²での熱移動率Q̇=${fmt(r.surfacePowerIn)} W。</p><p>開始からの累積熱量E/A=2k(Ts−Ti)√[t/(πα)]=${fmt(r.accumulatedJPerArea)} J/m²。全体ではE=${fmt(r.accumulatedJ)} J。正は内部へ加熱、負は内部から冷却です。t=0の瞬間熱流束は理論上発散するため、t&gt;0で評価します。</p></details>
  <details><summary>4. 半無限体近似を点検</summary><p>温度変化が表面差の1%となる深さδ₉₉=${fmt(r.penetration99)} m。入力された実物の奥行きD=${fmt(v.availableDepth)} mの位置では、温度変化割合は${fmt(100*r.backsideChangeFraction)}%。${r.validityNote}</p><p>1%判定は独自の表示上の目安であり、端面・裏面境界や多次元効果の厳密な適用判定ではありません。</p></details>
  <small>独自作成の教育用一次元・定物性モデル。表面温度一定、内部発熱・潜熱・放射・接触抵抗なし。現実の表面温度変化が有限速度の場合、対流境界条件や有限体モデルを使用してください。</small></div>`;
}
export function renderSemiInfiniteDiagram(r){
  const valid=!!r&&!r.error,v=valid?r.values:null;
  const inward=!valid||r.surfacePowerIn>=0;
  const arrows=inward?'M95 110 L174 110 M165 102 L174 110 L165 118':'M174 110 L95 110 M104 102 L95 110 L104 118';
  const direction=!valid?'判定前':r.surfacePowerIn>0?'表面から固体内へ':r.surfacePowerIn<0?'固体内から表面へ':'熱移動なし';
  const desc=valid?`表面${fmt(v.surface)}℃、初期${fmt(v.initial)}℃、深さ${fmt(v.depth)}mで${fmt(r.temperature)}℃。${direction}。`:'入力を確認してください。';
  return `<figure class="simulation-figure"><svg class="sim-physical-diagram" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 210"><title>半無限体の表面温度変更の模式図</title><desc>${escapeHtml(desc)}</desc>
  <rect x="176" y="38" width="281" height="128" class="diagram-solid"/><line x1="176" y1="35" x2="176" y2="169" class="diagram-boundary"/>
  <path d="${arrows}" class="diagram-arrow"/>
  <text x="18" y="30" class="chart-label">表面 x=0</text><text x="267" y="30" class="chart-label">固体内部 x&gt;0</text>
  <text x="14" y="157" class="chart-label">${escapeHtml(valid?`Ts=${fmt(v.surface)}℃`:'温度未設定')}</text>
  <text x="267" y="92" class="chart-label">${escapeHtml(valid?`Ti=${fmt(v.initial)}℃`:'初期温度')}</text>
  <text x="191" y="189" class="chart-label">${escapeHtml(direction)}</text></svg>
  <figcaption>模式図の固体は図の右側に無限に続くと近似します。矢印は正味の熱流方向であり、奥行きや温度勾配を実寸で示していません。</figcaption></figure>`;
}
function lineChart(title,description,xLabel,yLabel,series,comparison,axisMax){
  const W=560,H=250,left=68,right=18,top=20,bottom=50;
  const all=[...series,...(comparison??[])].map(x=>x[1]);
  let min=Math.min(...all),max=Math.max(...all);
  if(max-min<1e-9){min-=.5;max+=.5;}
  const px=x=>left+(x/axisMax)*(W-left-right),py=y=>top+(max-y)/(max-min)*(H-top-bottom);
  const path=arr=>arr.map(([x,y],i)=>`${i?'L':'M'}${px(x).toFixed(3)},${py(y).toFixed(3)}`).join(' ');
  const grid=[0,.5,1].map(q=>{const t=min+(max-min)*q;return `<line class="chart-grid" x1="${left}" y1="${py(t)}" x2="${W-right}" y2="${py(t)}"/><text class="chart-label" x="${left-8}" y="${py(t)+4}" text-anchor="end">${escapeHtml(fmt(t))}</text>`;}).join('');
  return `<svg class="sim-chart" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" aria-label="${escapeHtml(description)}"><title>${escapeHtml(title)}</title><desc>${escapeHtml(description)}</desc>${grid}
  <path d="${path(series)}" class="chart-current"/>${comparison?`<path d="${path(comparison)}" class="chart-baseline"/>`:''}
  <text class="chart-label" x="${left}" y="${H-29}">0</text><text class="chart-label" x="${W-right}" y="${H-29}" text-anchor="end">${escapeHtml(fmt(axisMax))}</text>
  <text class="chart-label" x="${(left+W-right)/2}" y="${H-7}" text-anchor="middle">${escapeHtml(xLabel)}</text>
  <text class="chart-label" x="14" y="${(top+H-bottom)/2}" transform="rotate(-90 14 ${(top+H-bottom)/2})" text-anchor="middle">${escapeHtml(yLabel)}</text></svg>`;
}
export function semiInfiniteProfileGraph(r,previous=null){
  if(!r||r.error)return '';
  const p=previous&&!previous.error?previous:null;
  const maxDepth=Math.max(r.penetration99*1.3,r.values.depth*1.05,p?p.penetration99*1.3:0,p?p.values.depth*1.05:0);
  const sample=val=>Array.from({length:81},(_,i)=>{const x=maxDepth*i/80;return [x,semiInfiniteTemperatureAt(val,x)];});
  return lineChart('半無限固体の深さ方向の温度分布',`表面から深さ${fmt(maxDepth)}mまでの温度分布。現在の観測温度${fmt(r.temperature)}℃。${p?'比較条件も表示。':''}`,'深さ x（m）','温度 T（℃）',sample(r),p?sample(p):null,maxDepth);
}
export function semiInfiniteHistoryGraph(r){
  if(!r||r.error)return '';
  const horizon=2*r.values.time;
  const samples=Array.from({length:81},(_,i)=>{const t=horizon*i/80;return [t,semiInfiniteTemperatureAt(r,r.values.depth,t)];});
  return lineChart('指定深さの温度履歴',`深さ${fmt(r.values.depth)}mにおける時刻0〜${fmt(horizon)}sの温度変化。時刻0は初期条件、表面x=0のみ0+の境界値。`,'経過時間 t（s）','温度 T（℃）',samples,null,horizon);
}