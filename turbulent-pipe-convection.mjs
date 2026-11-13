// Independently authored educational model for developed single-phase turbulent flow in a smooth circular tube.
// Gnielinski Nu correlation and smooth-wall Darcy friction factor; no copied textbook content.
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = n => Number(n).toLocaleString('ja-JP', {maximumSignificantDigits:7});

export const PIPE_DEFAULTS = Object.freeze({density:996,velocity:1.2,viscosity:0.000797,cp:4180,conductivity:0.613,diameter:0.025,length:3,inlet:25,wall:60});
export const PIPE_RE_MIN = 10000;
export const PIPE_RE_MAX = 5e6;
export const PIPE_PR_MIN = 0.5;
export const PIPE_PR_MAX = 2000;
export const PIPE_MIN_LENGTH_DIAMETERS = 30;
export const pipeFields = Object.freeze([
 ['density','流体の密度 ρ','kg/m³',0.01,3000,'流路内の代表温度での物性値'],
 ['velocity','断面平均流速 u','m/s',0.001,50,'管内での断面平均速度'],
 ['viscosity','流体の粘度 μ','Pa·s',1e-6,0.2,'動粘度ではなく粘度'],
 ['cp','流体の比熱容量 cₚ','J/(kg·K)',100,10000,'温度で変化しないものとする'],
 ['conductivity','流体の熱伝導率 kf','W/(m·K)',0.001,10,'管材ではなく流体の熱伝導率'],
 ['diameter','管の内径 D','m',0.001,1,'滑らかな円管の内径'],
 ['length','加熱・冷却する管長 L','m',0.01,100,'入口助走部の影響は含めない'],
 ['inlet','流体入口温度 Tin','℃',-273.149999,2000,'管入口の混合平均温度'],
 ['wall','一定の内壁温度 Tw','℃',-273.149999,2000,'管内壁の温度は流れ方向に一定']
]);
export const pipeFieldNames = Object.freeze(pipeFields.map(f => f[0]));
function parseDecimal(raw) {
 if (typeof raw !== 'number' && typeof raw !== 'string') return NaN;
 const s=String(raw).trim();
 if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return NaN;
 const n=Number(s); return Number.isFinite(n)?n:NaN;
}

// Only call with valid Re and Pr. The friction factor is Darcy, not Fanning.
export function gnielinskiPipe(re,pr) {
 if (!Number.isFinite(re)||!Number.isFinite(pr)||re<PIPE_RE_MIN||re>PIPE_RE_MAX||pr<PIPE_PR_MIN||pr>PIPE_PR_MAX)
  return {error:'Gnielinski式の教育用範囲は 10,000≤Re≤5×10⁶、0.5≤Pr≤2,000 です。'};
 const f=1/(0.79*Math.log(re)-1.64)**2;
 const numerator=(f/8)*(re-1000)*pr;
 const denominator=1+12.7*Math.sqrt(f/8)*(Math.pow(pr,2/3)-1);
 const nu=numerator/denominator;
 if (![f,nu].every(Number.isFinite)||nu<=0||f<=0||denominator<=0) return {error:'相関式の数値計算に失敗しました。'};
 return {darcy:f,nu};
}
export function calculatePipeConvection(raw) {
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {error:'円管内対流の入力項目を確認してください。'};
 const v={};
 for (const [key,label,unit,min,max] of pipeFields) {
  const n=parseDecimal(raw[key]);
  if (!Number.isFinite(n)) return {error:`${label}には有限の十進数を入力してください。`};
  if ((key==='inlet'||key==='wall') ? (n<=-273.15||n>max):(n<min||n>max))
   return {error:`${label}は${key==='inlet'||key==='wall'?'−273.15 ℃超〜2000 ℃':`${min}〜${max} ${unit}`}で指定してください。`};
  v[key]=n;
 }
 const lengthRatio=v.length/v.diameter;
 if (lengthRatio<PIPE_MIN_LENGTH_DIAMETERS) return {error:`このモデルはL/D≥${PIPE_MIN_LENGTH_DIAMETERS}を要求します。入口助走部が無視できるか別途確認してください。`};
 const re=v.density*v.velocity*v.diameter/v.viscosity;
 const pr=v.viscosity*v.cp/v.conductivity;
 const friction=gnielinskiPipe(re,pr);
 if (friction.error) return {error:friction.error};
 const sectionArea=Math.PI*v.diameter*v.diameter/4;
 const heatArea=Math.PI*v.diameter*v.length;
 const massFlow=v.density*v.velocity*sectionArea;
 const capacityRate=massFlow*v.cp;
 const h=friction.nu*v.conductivity/v.diameter;
 const ntu=h*heatArea/capacityRate;
 const inletDifference=v.wall-v.inlet;
 // Stable even if NTU approaches 0. Positive heat is from the wall into the flowing fluid.
 const heatingFraction=-Math.expm1(-ntu);
 const watts=capacityRate*inletDifference*heatingFraction;
 const outlet=v.inlet+inletDifference*heatingFraction;
 const lmtd=inletDifference*heatingFraction/ntu;
 // Darcy-Weisbach friction-only loss, not total system pressure drop.
 const pressureDrop=friction.darcy*lengthRatio*v.density*v.velocity*v.velocity/2;
 const volumetricFlow=v.velocity*sectionArea;
 const hydraulicWatts=pressureDrop*volumetricFlow;
 const thetaOutlet=inletDifference*Math.exp(-ntu);
 if ([re,pr,lengthRatio,sectionArea,heatArea,massFlow,capacityRate,h,ntu,watts,outlet,lmtd,pressureDrop,hydraulicWatts,thetaOutlet].some(n=>!Number.isFinite(n)))
  return {error:'計算できる数値範囲を超えました。'};
 return {values:v,re,pr,nu:friction.nu,darcy:friction.darcy,lengthRatio,sectionArea,heatArea,massFlow,capacityRate,h,ntu,heatingFraction,inletDifference,watts,outlet,lmtd,thetaOutlet,pressureDrop,volumetricFlow,hydraulicWatts};
}

// Local bulk-mixed temperature in the tube at distance x. The wall stays at Tw.
export function pipeBulkTemperatureAt(result,x) {
 if (!result||result.error||!Number.isFinite(x)||x<0||x>result.values.length) throw new RangeError('0≤x≤Lの管内位置を指定してください。');
 return result.values.wall-result.inletDifference*Math.exp(-result.ntu*x/result.values.length);
}
export function renderPipeFields(values=PIPE_DEFAULTS) {
 return pipeFields.map(([key,label,unit,min,max,help])=>`<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${escapeHtml(values[key])}" min="${min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join('');
}
export function renderPipeSteps(r) {
 if (!r||r.error) return '';
 const v=r.values;
 return `<div class="simulation-steps"><p><strong>滑らかな円管内の発達乱流：計算と制限</strong></p>
 <details><summary>1. 管内流動と適用性</summary><p>流体は定常・非圧縮・単相、内径D=${fmt(v.diameter)} mの滑らかな円管をu=${fmt(v.velocity)} m/sで流れます。入口以降の対流を十分発達した乱流で近似し、L/D=${fmt(r.lengthRatio)}を確認します。これは入口助走部を厳密に解くモデルではありません。</p>
 <p>Re=ρuD/μ=${fmt(r.re)}、Pr=μcₚ/kf=${fmt(r.pr)}（無次元）。使用域はRe=10,000〜5×10⁶、Pr=0.5〜2,000、L/D≥30で、範囲外は計算を拒否します。物性が温度で大きく変わる場合、壁面粘度の補正が必要です。</p></details>
 <details><summary>2. 相関式と単位</summary><p>Darcy摩擦係数f=(0.79 ln Re−1.64)⁻²=${fmt(r.darcy)}。Gnielinski式Nu=[(f/8)(Re−1000)Pr]/[1+12.7√(f/8)(Pr^(2/3)−1)]=${fmt(r.nu)}。h=Nu kf/D=${fmt(r.h)} W/(m²·K)。Fanning摩擦係数はDarcyの4分の1で、両者を混同してはいけません。</p>
 <p>濡れ面積As=πDL=${fmt(r.heatArea)} m²、断面積Ac=πD²/4=${fmt(r.sectionArea)} m²、質量流量ṁ=ρuAc=${fmt(r.massFlow)} kg/s、熱容量流量ṁcₚ=${fmt(r.capacityRate)} W/K。</p></details>
 <details><summary>3. 入口温度から出口・熱移動率へ</summary><p>壁温Tw=${fmt(v.wall)} ℃を一定、流体入口Tin=${fmt(v.inlet)} ℃とし、流れに沿う完全混合平均温度をT(x)=Tw−(Tw−Tin) exp[−hπDx/(ṁcₚ)]とします。NTU=hAs/(ṁcₚ)=${fmt(r.ntu)}、出口Tout=${fmt(r.outlet)} ℃。</p>
 <p>壁から流体への熱移動率Q̇=ṁcₚ(Tout−Tin)=${fmt(r.watts)} W（負は壁へ向かう冷却）。壁温との差の対数平均ΔTlm=${fmt(r.lmtd)} K、hAsΔTlm=${fmt(r.h*r.heatArea*r.lmtd)} Wで検算できます。</p></details>
 <details><summary>4. 圧力損失と動力</summary><p>滑らかな直管のDarcy摩擦圧力損失Δpf=f(L/D)(ρu²/2)=${fmt(r.pressureDrop)} Pa。体積流量V̇=uAc=${fmt(r.volumetricFlow)} m³/s。流体に与える理想水力動力はΔpfV̇=${fmt(r.hydraulicWatts)} W（ポンプ実消費電力ではありません）。</p></details>
 <small>独立作成の教育モデル。伝熱面積は管内面であり、壁の伝導抵抗、外側の放熱、放射、物性温度依存、入口助走部、曲がり、継手、粗さ、二相流、ポンプ効率は扱いません。L/Dの下限は教育用の保守的判定で、全条件で完全発達を保証するものではありません。</small></div>`;
}
export function renderPipeDiagram(r) {
 const valid=!!r&&!r.error, v=valid?r.values:null;
 const direction=valid?(r.watts>0?'管壁から流体を加熱':r.watts<0?'流体から管壁へ放熱':'正味の熱移動なし'):'未判定';
 const desc=valid?`管入口${fmt(v.inlet)}℃、出口${fmt(r.outlet)}℃、壁温${fmt(v.wall)}℃、${direction}。`:'入力が無効なため模式図のみ表示。';
 const arrow=valid&&r.watts<0?'M200 98 L200 55 L194 61 M200 55 L206 61 M305 98 L305 55 L299 61 M305 55 L311 61':'M200 55 L200 98 L194 92 M200 98 L206 92 M305 55 L305 98 L299 92 M305 98 L311 92';
 return `<figure class="simulation-figure"><svg class="sim-physical-diagram" role="img" viewBox="0 0 500 215" xmlns="http://www.w3.org/2000/svg"><title>滑らかな円管内の乱流と壁面熱交換</title><desc>${escapeHtml(desc)}</desc>
 <rect x="55" y="55" width="390" height="105" class="diagram-solid"/><rect x="55" y="86" width="390" height="48" class="diagram-ambient"/><path d="M82 109 L410 109 L400 101 M410 109 L400 117" class="diagram-arrow"/><path d="${arrow}" class="diagram-arrow"/>
 <text x="62" y="35" class="chart-label">${escapeHtml(valid?`一定壁温 Tw=${fmt(v.wall)} ℃`:'管壁')}</text><text x="58" y="183" class="chart-label">${escapeHtml(valid?`入口 ${fmt(v.inlet)} ℃`:'流体入口')}</text><text x="325" y="183" class="chart-label">${escapeHtml(valid?`出口 ${fmt(r.outlet)} ℃`:'流体出口')}</text><text x="185" y="203" class="chart-label">${escapeHtml(direction)}</text></svg>
 <figcaption>独自模式図。横方向は流れの向き。熱流矢印は壁と流体間の方向を示し、流れ場の渦や混合の分布は再現していません。</figcaption></figure>`;
}
function pipeGraph(data,other,title,xlabel,desc) {
 const W=560,H=250,left=70,right=22,top=20,bottom=48;
 const temperatures=[...data,...(other||[])].map(([,y])=>y);
 let min=Math.min(...temperatures),max=Math.max(...temperatures);
 if (max-min<1e-9){min-=0.5;max+=0.5;}
 const X=x=>left+x*(W-left-right),Y=t=>top+(max-t)/(max-min)*(H-top-bottom);
 const path=arr=>arr.map(([x,y],i)=>`${i?'L':'M'}${X(x).toFixed(3)},${Y(y).toFixed(3)}`).join(' ');
 const grid=[0,.5,1].map(fr=>{const y=min+(max-min)*fr;return `<line x1="${left}" y1="${Y(y)}" x2="${W-right}" y2="${Y(y)}" class="chart-grid"/><text x="${left-9}" y="${Y(y)+4}" text-anchor="end" class="chart-label">${escapeHtml(fmt(y))}</text>`;}).join('');
 return `<svg class="sim-chart" role="img" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-label="${escapeHtml(desc)}"><title>${escapeHtml(title)}</title><desc>${escapeHtml(desc)}</desc>${grid}
 <path class="chart-current" d="${path(data)}"/>${other?`<path class="chart-baseline" d="${path(other)}"/>`:''}
 <text x="${left}" y="${H-29}" class="chart-label">0</text><text x="${W-right}" y="${H-29}" text-anchor="end" class="chart-label">1</text><text x="${left+(W-left-right)/2}" y="${H-7}" text-anchor="middle" class="chart-label">${escapeHtml(xlabel)}</text>
 <text x="14" y="${top+(H-top-bottom)/2}" transform="rotate(-90 14 ${top+(H-top-bottom)/2})" text-anchor="middle" class="chart-label">${escapeHtml(title)}</text></svg>`;
}
export function pipeBulkGraph(r,comparison=null) {
 if(!r||r.error) return '';
 const current=Array.from({length:65},(_,i)=>[i/64,pipeBulkTemperatureAt(r,r.values.length*i/64)]);
 const other=comparison&&!comparison.error?Array.from({length:65},(_,i)=>[i/64,pipeBulkTemperatureAt(comparison,comparison.values.length*i/64)]):null;
 return pipeGraph(current,other,'流体混合平均温度 T（℃）','流れ方向位置 x/L（無次元）',`滑らかな管内、入口${fmt(r.values.inlet)}℃、出口${fmt(r.outlet)}℃。実線は現在条件。${other?'比較条件を重ねて表示。':''}`);
}
export function pipeVelocityGraph(r,comparison=null) {
 if(!r||r.error)return '';
 const base=r.values;
 const min=Math.max(base.velocity*.4,PIPE_RE_MIN*base.viscosity/(base.density*base.diameter));
 const max=Math.min(base.velocity*2.4,PIPE_RE_MAX*base.viscosity/(base.density*base.diameter));
 const velocity=(u)=>calculatePipeConvection({...base,velocity:u});
 const current=Array.from({length:65},(_,i)=>{
  const u=min+(max-min)*i/64;
  const x=velocity(u);return [i/64,x.error?NaN:x.h];
 });
 // Local tolerance at the precise Reynolds boundaries can lead to a floating point overflow of 1 ulp.
 const clipped=current.filter(([,h])=>Number.isFinite(h));
 if(clipped.length<2)return '';
 // Map back to the 0..1 plotting coordinates, without assuming the first point is at x=0.
 const other=comparison&&!comparison.error?Array.from({length:65},(_,i)=>{
   const u=min+(max-min)*i/64;const x=calculatePipeConvection({...comparison.values,velocity:u});return [i/64,x.error?NaN:x.h];
  }).filter(([,h])=>Number.isFinite(h)):null;
 return pipeGraph(clipped,other?.length>1?other:null,'平均熱伝達率 h（W/(m²·K)）',`流速 u（左${fmt(min)}、右${fmt(max)} m/s）`,`有効なGnielinskiの範囲内における流速感度。横軸0は${fmt(min)}m/s、1は${fmt(max)}m/s。実線は現在の流体と管。${other?.length>1?'比較条件も同じ流速範囲で再計算。':''}`);
}