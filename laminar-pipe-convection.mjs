// Independently authored educational model: single-phase laminar flow in a smooth circular tube.
// Hydrodynamically developed inlet, thermally developing, constant inner wall temperature.
// Mean Hausen correlation; no copied textbook prose, figures, or tabulated results.
const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n).toLocaleString('ja-JP',{maximumSignificantDigits:7});
export const LAMINAR_PIPE_DEFAULTS = Object.freeze({
 density:998, velocity:0.04, viscosity:0.001, cp:4180, conductivity:0.6,
 diameter:0.02, length:1, inlet:20, wall:60
});
export const LAMINAR_PIPE_RE_MIN = 50;
export const LAMINAR_PIPE_RE_MAX = 2300;
export const LAMINAR_PIPE_PR_MIN = 0.6;
export const LAMINAR_PIPE_PR_MAX = 2000;
export const LAMINAR_PIPE_PE_MIN = 50;
export const laminarPipeFields = Object.freeze([
 ['density','流体密度 ρ','kg/m³',0.01,3000,'代表混合温度における物性'],
 ['velocity','断面平均流速 u','m/s',0.0001,10,'入口前に速度分布が十分発達しているものとする'],
 ['viscosity','粘度 μ','Pa·s',0.000001,0.2,'動粘度ではなく粘度'],
 ['cp','比熱容量 cₚ','J/(kg·K)',100,10000,'定物性・単相の流体'],
 ['conductivity','流体熱伝導率 kf','W/(m·K)',0.001,10,'管材ではなく流体の値'],
 ['diameter','管内径 D','m',0.001,1,'円形・滑らかな流路'],
 ['length','加熱・冷却区間長 L','m',0.01,100,'入口から一定壁温度が始まる区間'],
 ['inlet','入口混合平均温度 Tin','℃',-273.149999,2000,'断面で混合平均した入口温度'],
 ['wall','一定の内壁温度 Tw','℃',-273.149999,2000,'管軸方向で壁温一定']
]);
export const laminarPipeFieldNames = Object.freeze(laminarPipeFields.map(x=>x[0]));
function parseNumber(raw) {
 if (typeof raw !== 'number' && typeof raw !== 'string') return NaN;
 const str=String(raw).trim();
 if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(str)) return NaN;
 const n=Number(str);return Number.isFinite(n)?n:NaN;
}
// x is the uniformly heated / cooled segment length. Inlet velocity is already parabolic.
export function hausenLaminarNu(re,pr,diameter,length) {
 if (![re,pr,diameter,length].every(Number.isFinite)||re<=0||pr<=0||diameter<=0||length<=0) return NaN;
 const gz=re*pr*diameter/length;
 return 3.66 + 0.0668*gz/(1+0.04*Math.pow(gz,2/3));
}
// d[x * Nu_mean(x)]/dx: local Nusselt, for x>0, with a singular entrance limit.
export function laminarPipeLocalNu(re,pr,diameter,x) {
 if(![re,pr,diameter,x].every(Number.isFinite)||re<=0||pr<=0||diameter<=0||x<=0) return NaN;
 const gz=re*pr*diameter/x, b=.04*Math.pow(gz,2/3);
 return 3.66+(.0668*gz)*(2*b/3)/(1+b)**2;
}
export function calculateLaminarPipe(raw) {
 if (!raw || typeof raw!=='object' || Array.isArray(raw)) return {error:'円管内層流モデルの入力を確認してください。'};
 const v={};
 for(const [key,label,unit,min,max] of laminarPipeFields){
  const n=parseNumber(raw[key]);
  if(!Number.isFinite(n))return {error:`${label}には有限の十進数を入力してください。`};
  if((key==='inlet'||key==='wall')?(n<=-273.15||n>max):(n<min||n>max))
   return {error:`${label}は${key==='inlet'||key==='wall'?'−273.15 ℃より高く2000 ℃以下':`${min}〜${max} ${unit}`}で指定してください。`};
  v[key]=n;
 }
 const re=v.density*v.velocity*v.diameter/v.viscosity;
 const pr=v.viscosity*v.cp/v.conductivity,pe=re*pr;
 if(!Number.isFinite(re)||!Number.isFinite(pr)||!Number.isFinite(pe))return {error:'Re、Pr、Peを計算できません。'};
 if(re<LAMINAR_PIPE_RE_MIN||re>=LAMINAR_PIPE_RE_MAX)return {error:`本モデルは${LAMINAR_PIPE_RE_MIN}≤Re<${LAMINAR_PIPE_RE_MAX}の層流に限定します。`};
 if(pr<LAMINAR_PIPE_PR_MIN||pr>LAMINAR_PIPE_PR_MAX)return {error:`本モデルの教育用Pr範囲は${LAMINAR_PIPE_PR_MIN}〜${LAMINAR_PIPE_PR_MAX}です。`};
 if(pe<LAMINAR_PIPE_PE_MIN)return {error:`軸方向熱伝導を無視するためPe≥${LAMINAR_PIPE_PE_MIN}を要求します。`};
 const nu=hausenLaminarNu(re,pr,v.diameter,v.length),fullyDevelopedNu=3.66;
 const sectionArea=Math.PI*v.diameter**2/4,heatArea=Math.PI*v.diameter*v.length;
 const massFlow=v.density*v.velocity*sectionArea,capacityRate=massFlow*v.cp;
 const h=nu*v.conductivity/v.diameter,ua=h*heatArea,ntu=ua/capacityRate;
 const fraction=-Math.expm1(-ntu),outlet=v.inlet+(v.wall-v.inlet)*fraction;
 const watts=capacityRate*(outlet-v.inlet);
 const idealWatts=capacityRate*(v.wall-v.inlet), surfaceDifference=v.wall-v.inlet;
 const deltaIn=v.wall-v.inlet,deltaOut=v.wall-outlet;
 const lmtd=deltaIn===0?0:surfaceDifference*fraction/ntu;
 const darcy=64/re,pressureDrop=darcy*v.length/v.diameter*(v.density*v.velocity*v.velocity/2);
 const volumeFlow=v.velocity*sectionArea,hydraulicPower=pressureDrop*volumeFlow;
 const thermalEntryEstimate=.05*re*pr*v.diameter;
 const hydraulicEntryEstimate=.05*re*v.diameter;
 const gz=re*pr*v.diameter/v.length;
 const checks=[nu,sectionArea,heatArea,massFlow,capacityRate,h,ua,ntu,fraction,outlet,watts,lmtd,darcy,pressureDrop,volumeFlow,hydraulicPower,gz,thermalEntryEstimate,hydraulicEntryEstimate];
 if(checks.some(x=>!Number.isFinite(x))||ntu<=0||h<=0||fraction<0||fraction>1)return {error:'計算可能な数値範囲を超えています。'};
 return {values:v,re,pr,pe,gz,nu,fullyDevelopedNu,sectionArea,heatArea,massFlow,capacityRate,h,ua,ntu,fraction,outlet,watts,idealWatts,deltaIn,deltaOut,lmtd,darcy,pressureDrop,volumeFlow,hydraulicPower,thermalEntryEstimate,hydraulicEntryEstimate};
}
export function laminarPipeTemperatureAt(result,position) {
 if(!result||result.error||!Number.isFinite(position)||position<0||position>result.values.length)throw new RangeError('0≤x≤Lの位置を指定してください。');
 if(position===0)return result.values.inlet;
 const v=result.values,nu=hausenLaminarNu(result.re,result.pr,v.diameter,position);
 const ua=nu*v.conductivity/v.diameter*Math.PI*v.diameter*position;
 const n=ua/result.capacityRate;
 return v.inlet+(v.wall-v.inlet)*(-Math.expm1(-n));
}
export function renderLaminarPipeFields(values=LAMINAR_PIPE_DEFAULTS){
 return laminarPipeFields.map(([key,label,unit,min,max,help])=>`<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${escapeHtml(values[key])}" min="${min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join('');
}
export function renderLaminarPipeSteps(r){
 if(!r||r.error)return '';
 const v=r.values;
 return `<div class="simulation-steps"><p><strong>円管内層流：温度助走域の平均熱伝達</strong></p>
 <details><summary>1. 層流・入口速度分布と適用条件</summary><p>Re=ρuD/μ=${fmt(r.re)}、Pr=μcp/kf=${fmt(r.pr)}、Pe=RePr=${fmt(r.pe)}（いずれも無次元）。入口の速度分布はすでに十分発達した放物線形と仮定します。温度場は加熱開始から発達します。</p><p>入口で速度分布が一様な「速度助走域との同時発達」は計算しません。自然対流との混在、物性の温度依存、圧縮性、管粗さや放射も無視します。</p></details>
 <details><summary>2. Hausen相関式・Nuからhを算出</summary><p>Gz=RePrD/L=${fmt(r.gz)}。平均Nu=3.66+0.0668Gz/[1+0.04Gz^(2/3)]=${fmt(r.nu)}。完全発達時の一定壁温度Nu=3.66が極限です。h平均=Nu kf/D=${fmt(r.h)} W/(m²·K)。平均値は加熱区間全体に対する値で、局所値とは異なります。</p><p>温度助走長の目安 Lth≈0.05RePrD=${fmt(r.thermalEntryEstimate)} m。速度助走長の目安 Lh≈0.05ReD=${fmt(r.hydraulicEntryEstimate)} m。速度助走長は入口前に必要な長さの目安であり、本モデル内では速度分布を解きません。</p></details>
 <details><summary>3. 出口温度とエネルギー保存則</summary><p>質量流量ṁ=ρuπD²/4=${fmt(r.massFlow)} kg/s、熱容量流量ṁcp=${fmt(r.capacityRate)} W/K、熱交換面積πDL=${fmt(r.heatArea)} m²。</p><p>NTU=h平均πDL/(ṁcp)=${fmt(r.ntu)}。Tout=Tw+(Tin−Tw)exp(−NTU)=${fmt(r.outlet)} ℃。流体が受け取る熱量 Q̇=ṁcp(Tout−Tin)=${fmt(r.watts)} W。正は壁から流体への加熱、負は流体から壁への放熱です。</p><p>LMTD=${fmt(r.lmtd)} K、h平均A×LMTD=${fmt(r.ua*r.lmtd)} W。局所平均値を加熱開始から位置xまで再計算した分布も表示します。</p></details>
 <details><summary>4. 管摩擦による圧力損失の目安</summary><p>十分発達した円管層流のDarcy摩擦係数 f=64/Re=${fmt(r.darcy)}。Δp=f(L/D)ρu²/2=${fmt(r.pressureDrop)} Pa。理想的な水力動力 Δp×体積流量=${fmt(r.hydraulicPower)} W。</p><p>入口・出口の局所損失、配管の曲がり、ポンプ効率は含みません。ここに示す水力動力を実際の消費電力とはみなしません。</p></details>
 <small>独自作成の定物性・定常・単相・平滑円管モデル。温度を十分大きく変化させる場合は物性と自然対流を別途検討してください。相関の採用と設計適用は専門家による確認が必要です。</small></div>`;
}
export function renderLaminarPipeDiagram(r){
 const ok=!!r&&!r.error,v=ok?r.values:null;
 const dir=ok?(r.watts>0?'壁 → 流体':r.watts<0?'流体 → 壁':'正味の熱移動なし'):'方向未判定';
 const info=ok?`入口${fmt(v.inlet)}℃、出口${fmt(r.outlet)}℃、壁面${fmt(v.wall)}℃、${dir}。`:'入力を確認してください。';
 const arrows=ok&&r.watts<0?'M192 95 L192 65 L186 71 M192 65 L198 71 M300 95 L300 65 L294 71 M300 65 L306 71':'M192 65 L192 95 L186 89 M192 95 L198 89 M300 65 L300 95 L294 89 M300 95 L306 89';
 return `<figure class="simulation-figure"><svg class="sim-physical-diagram" role="img" viewBox="0 0 480 210" xmlns="http://www.w3.org/2000/svg"><title>層流円管の加熱・冷却模式図</title><desc>${escapeHtml(info)}</desc><rect x="64" y="60" width="350" height="85" class="diagram-solid"/><rect x="64" y="89" width="350" height="28" class="diagram-ambient"/><path d="M85 103 L395 103 L386 96 M395 103 L386 110" class="diagram-arrow"/><path d="${arrows}" class="diagram-arrow"/><text x="61" y="38" class="chart-label">一定の内壁温度 Tw</text><text x="63" y="172" class="chart-label">入口 Tin</text><text x="346" y="172" class="chart-label">出口 Tout</text><text x="115" y="193" class="chart-label">${escapeHtml(dir)}</text></svg><figcaption>独自作成の模式図。矢印は流れと熱の向きを表し、境界層や壁厚の実寸は示しません。</figcaption></figure>`;
}
function svgLineChart(title,xLabel,yLabel,points,comparison=null){
 const all=[...points,...(comparison||[])];if(!points.length)return '';
 const nums=all.map(p=>p[1]);let lo=Math.min(...nums),hi=Math.max(...nums);
 if(hi-lo<1e-9){lo-=.5;hi+=.5;}
 const W=560,H=250,l=67,r=16,t=18,b=52;
 const X=x=>l+x*(W-l-r),Y=y=>t+(hi-y)/(hi-lo)*(H-t-b);
 const path=arr=>arr.map(([x,y],i)=>`${i?'L':'M'}${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(' ');
 const ticks=[0,.5,1].map(fr=>{const y=lo+fr*(hi-lo);return `<line x1="${l}" y1="${Y(y)}" x2="${W-r}" y2="${Y(y)}" class="chart-grid"/><text x="${l-8}" y="${Y(y)+4}" text-anchor="end" class="chart-label">${escapeHtml(fmt(y))}</text>`;}).join('');
 return `<svg class="sim-chart" role="img" viewBox="0 0 ${W} ${H}" aria-label="${escapeHtml(title+'。'+xLabel+'。'+yLabel)}" xmlns="http://www.w3.org/2000/svg"><title>${escapeHtml(title)}</title>${ticks}<path d="${path(points)}" class="chart-current"/>${comparison?`<path d="${path(comparison)}" class="chart-baseline"/>`:''}<text x="${l}" y="${H-32}" class="chart-label">0</text><text x="${W-r}" y="${H-32}" text-anchor="end" class="chart-label">1</text><text x="${l+(W-l-r)/2}" y="${H-9}" text-anchor="middle" class="chart-label">${escapeHtml(xLabel)}</text><text x="14" y="${t+(H-t-b)/2}" transform="rotate(-90 14 ${t+(H-t-b)/2})" text-anchor="middle" class="chart-label">${escapeHtml(yLabel)}</text></svg>`;
}
export function laminarPipeBulkGraph(r,baseline=null){
 if(!r||r.error)return '';
 const values=x=>Array.from({length:61},(_,i)=>[i/60,laminarPipeTemperatureAt(x,x.values.length*i/60)]);
 const other=baseline&&!baseline.error?values(baseline):null;
 return svgLineChart('管内の混合平均温度の軸方向変化','相対位置 x/L（無次元）','混合平均温度 T（℃）',values(r),other);
}
export function laminarPipeNusseltGraph(r,baseline=null){
 if(!r||r.error)return '';
 const points=x=>Array.from({length:61},(_,i)=>{const frac=.01+.99*i/60;return [frac,hausenLaminarNu(x.re,x.pr,x.values.diameter,x.values.length*frac)];});
 const other=baseline&&!baseline.error?points(baseline):null;
 return svgLineChart('加熱開始から位置xまでの平均ヌセルト数','相対位置 x/L（無次元）','平均Nu（無次元）',points(r),other);
}