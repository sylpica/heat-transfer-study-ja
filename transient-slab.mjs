// Independent educational transient plane-wall model; no textbook prose or figures copied.

export const SLAB_DEFAULTS={"k":2,"h":80,"thickness":0.08,"faceArea":0.1,"density":2000,"cp":900,"initial":80,"ambient":20,"time":400};

export const SLAB_MIN_FO=0.0001;
export const SLAB_MAX_BI=100;
export const SLAB_TERMS=128;

export const slabFields=[["k","熱伝導率 k","W/(m·K)",0.05,500,"温度依存を無視した固体の物性"],["h","両面の対流熱伝達率 h","W/(m²·K)",0.1,2000,"両表面に同じ熱伝達率"],["thickness","板の全厚さ d","m",0.001,1,"計算に使う半厚さ L=d/2"],["faceArea","片面の面積 A","m²",0.001,100,"放熱する2面は各A"],["density","密度 ρ","kg/m³",100,20000,"均質な固体"],["cp","比熱容量 cₚ","J/(kg·K)",100,6000,"一定の比熱容量"],["initial","初期温度 Ti","℃",-273.15,1500,"内部も表面も初期は一様"],["ambient","周囲流体の温度 T∞","℃",-273.15,1500,"両面で一定"],["time","経過時間 t","s",0,10000000,"初期直後の級数精度に注意"]];

export const slabFieldNames=slabFields.map(f=>f[0]);

function slabParse(raw){
 if(typeof raw!=="number"&&typeof raw!=="string")return NaN;
 const s=String(raw).trim();if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return NaN;
 const n=Number(s);return Number.isFinite(n)?n:NaN;
}

export function slabEigenModes(bi,count=SLAB_TERMS){
 const modes=[];
 for(let n=0;n<count;n++){
  let l=n*Math.PI,r=(n+.5)*Math.PI;
  for(let k=0;k<60;k++){
   const m=(l+r)/2,g=(n%2?-1:1)*(m*Math.sin(m)-bi*Math.cos(m));
   if(g>0)r=m;else l=m;
  }
  const mu=(l+r)/2,coeff=4*Math.sin(mu)/(2*mu+Math.sin(2*mu));
  modes.push({mu,coeff,avgCoeff:coeff*Math.sin(mu)/mu});
 }
 return modes;
}

function slabSeries(modes,fo,position){
 if(fo===0)return 1;
 let sum=0;
 for(const m of modes)sum+=(position===null?m.avgCoeff:m.coeff*Math.cos(m.mu*position))*Math.exp(-m.mu*m.mu*fo);
 return sum;
}

export function calculateSlabTransient(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {error:"平板の入力項目を確認してください。"};
 const v={};
 for(const [key,label,unit,min,max] of slabFields){
  const n=slabParse(raw[key]);
  if(!Number.isFinite(n))return {error:`${label}に有限の数値を入力してください。`};
  if((key==="initial"||key==="ambient")?(n<=-273.15||n>max):(n<min||n>max))
    return {error:`${label}は${key==="initial"||key==="ambient"?"−273.15 ℃より高く1500 ℃以下":`${min}〜${max} ${unit}`}で入力してください。`};
  v[key]=n;
 }
 const L=v.thickness/2,alpha=v.k/(v.density*v.cp),bi=v.h*L/v.k,fo=alpha*v.time/(L*L);
 if(!Number.isFinite(bi)||!Number.isFinite(fo)||bi<=0||fo<0)return {error:"Bi・Foの計算に失敗しました。"};
 if(bi>SLAB_MAX_BI)return {error:`級数の教育用適用範囲は Bi≤${SLAB_MAX_BI} です。`};
 if(fo>0&&fo<SLAB_MIN_FO)return {error:`開始直後は級数の精度を保てないため、t=0 または Fo≥${SLAB_MIN_FO} としてください（現在 Fo=${fo.toExponential(3)}）。`};
 const modes=slabEigenModes(bi),delta=v.initial-v.ambient;
 const centerRatio=slabSeries(modes,fo,0),surfaceRatio=slabSeries(modes,fo,1),averageRatio=slabSeries(modes,fo,null);
 const centerTemperature=v.ambient+delta*centerRatio,surfaceTemperature=v.ambient+delta*surfaceRatio;
 const averageTemperature=v.ambient+delta*averageRatio,lumpedTemperature=v.ambient+delta*Math.exp(-bi*fo);
 const surfaceHeatFlux=v.h*(surfaceTemperature-v.ambient),watts=2*v.faceArea*surfaceHeatFlux;
 const transferredJ=v.density*v.cp*v.thickness*v.faceArea*(v.initial-averageTemperature);
 if([alpha,bi,fo,centerTemperature,surfaceTemperature,averageTemperature,lumpedTemperature,surfaceHeatFlux,watts,transferredJ].some(n=>!Number.isFinite(n)))
  return {error:"計算可能な数値範囲を超えました。"};
 return {values:v,halfThickness:L,alpha,bi,fo,modes,centerRatio,surfaceRatio,averageRatio,centerTemperature,surfaceTemperature,averageTemperature,lumpedTemperature,surfaceHeatFlux,watts,transferredJ};
}

export function slabDimensionlessAt(r,x,fo=r?.fo){
 if(!r||r.error||!Number.isFinite(x)||x<0||x>1||!Number.isFinite(fo)||fo<0||(fo>0&&fo<SLAB_MIN_FO))
  throw new RangeError("位置は0〜1、時間はt=0またはFo≥1e-4を指定してください。");
 return slabSeries(r.modes,fo,x);
}

export function slabTemperatureAt(r,x,fo=r?.fo){
 return r.values.ambient+(r.values.initial-r.values.ambient)*slabDimensionlessAt(r,x,fo);
}

export function renderSlabFields(v=SLAB_DEFAULTS){
 return slabFields.map(([key,label,unit,min,max,help])=>`<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${slabEsc(v[key])}" min="${key==="initial"||key==="ambient"?-273.149999:min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join("");
}

export function renderSlabSteps(r){
 if(!r||r.error)return "";
 const v=r.values,f=slabFmt;
 return `<div class="simulation-steps"><p><strong>補足説明：両面対流のある平板の非定常熱伝導</strong></p>
 <details><summary>1. 現象・形状・境界条件</summary><p>最初は平板全体が${f(v.initial)}℃、両面の流体が${f(v.ambient)}℃。全厚さd=${f(v.thickness)}m、中心から表面までL=d/2=${f(r.halfThickness)}m。中心で対称条件∂T/∂x=0、両面で対流境界 −k∂T/∂x=h(Ts−T∞) を課します。</p></details>
 <details><summary>2. 固有値から温度分布を求める</summary><p>熱拡散率α=k/(ρcₚ)=${f(r.alpha)}m²/s、Bi=hL/k=${f(r.bi)}、Fo=αt/L²=${f(r.fo)}。いずれもLは半厚さです。固有値μₙはμₙtanμₙ=Bi、係数Cₙ=4sinμₙ/(2μₙ+sin2μₙ)。無次元温度θ=(T−T∞)/(Ti−T∞)=Σ Cₙcos(μₙx/L)exp(−μₙ²Fo)。級数を${r.modes.length}項で打ち切り、Fo>0ではFo≥${SLAB_MIN_FO}に制限します。${r.bi<.1?"Bi<0.1なので集中熱容量法との比較に適しています。":"Bi≥0.1では内部温度差を無視しないでください。"}</p></details>
 <details><summary>3. 温度と瞬間熱流・累積熱量を検算</summary><p>中心温度${f(r.centerTemperature)}℃、表面温度${f(r.surfaceTemperature)}℃、板厚平均${f(r.averageTemperature)}℃。集中熱容量近似は${f(r.lumpedTemperature)}℃です。</p><p>両面合計の外向き熱移動率Q̇=2hA(Ts−T∞)=${f(r.watts)}W、片面の熱流束q″=${f(r.surfaceHeatFlux)}W/m²。初期からの累積熱移動量E=ρcₚdA(Ti−Tavg)=${f(r.transferredJ)}J。放熱を正、吸熱を負とします。</p></details>
 <small>独立作成の教育用モデル。側面からの熱移動を無視できる広い平板、一定物性・一様な初期温度・両面同一の対流・一定の周囲温度を仮定。発熱・放射・相変化は含みません。近似解の内部的な数値確認だけでは専門家校閲を代替できません。</small></div>`;
}

export function renderSlabDiagram(r){
 const valid=!!r&&!r.error,v=valid?r.values:null,dir=valid?(r.watts>0?"両側へ放熱":r.watts<0?"両側から吸熱":"移動なし"):"入力未確定";
 const arrows=valid&&r.watts<0?'M140 92 L190 92 L182 85 M190 92 L182 99 M340 92 L290 92 L298 85 M290 92 L298 99':'M190 92 L140 92 L148 85 M140 92 L148 99 M290 92 L340 92 L332 85 M340 92 L332 99';
 const desc=valid?`中心${slabFmt(r.centerTemperature)}℃、表面${slabFmt(r.surfaceTemperature)}℃、流体${slabFmt(v.ambient)}℃、${dir}。`:"無効な入力です。";
 return `<figure class="simulation-figure"><svg class="sim-physical-diagram" role="img" viewBox="0 0 480 210" xmlns="http://www.w3.org/2000/svg"><title>両面冷却・加熱する平板の模式図</title><desc>${slabEsc(desc)}</desc><rect x="190" y="45" width="100" height="120" class="diagram-solid"/><line x1="240" y1="41" x2="240" y2="169" class="diagram-boundary"/><path class="diagram-arrow" d="${arrows}"/><text x="209" y="29" class="chart-label">固体</text><text x="6" y="28" class="chart-label">流体</text><text x="365" y="28" class="chart-label">流体</text><text x="16" y="185" class="chart-label">${slabEsc(valid?`T∞=${slabFmt(v.ambient)}℃`:"温度未設定")}</text><text x="211" y="185" class="chart-label">中心</text><text x="311" y="185" class="chart-label">${slabEsc(dir)}</text></svg><figcaption>独自模式図。中心に対称面があり、左右両面は同じ条件です。色は厳密な温度分布ではありません。</figcaption></figure>`;
}

function slabGraphSVG(r,samples,description,xlabel,other=null){
 const W=560,H=250,left=68,right=20,top=20,bottom=48;
 const rows=[...samples,...(other||[])],temps=rows.map(p=>p[1]);
 let min=Math.min(...temps),max=Math.max(...temps);
 if(max-min<1e-10){min-=.5;max+=.5;}
 const X=x=>left+x*(W-left-right),Y=t=>top+(max-t)/(max-min)*(H-top-bottom);
 const path=data=>data.map(([x,t],i)=>`${i?"L":"M"}${X(x).toFixed(3)},${Y(t).toFixed(3)}`).join(" ");
 const ticks=[0,.5,1].map(f=>{const t=min+(max-min)*f;return `<line x1="${left}" y1="${Y(t)}" x2="${W-right}" y2="${Y(t)}" class="chart-grid"/><text x="${left-7}" y="${Y(t)+3}" text-anchor="end" class="chart-label">${slabEsc(slabFmt(t))}</text>`}).join("");
 return `<svg class="sim-chart" role="img" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-label="${slabEsc(description)}"><title>${slabEsc(description)}</title>${ticks}<path d="${path(samples)}" class="chart-current"/>${other?`<path d="${path(other)}" class="chart-baseline"/>`:""}<text x="${left}" y="${H-29}" class="chart-label">0</text><text x="${W-right}" y="${H-29}" text-anchor="end" class="chart-label">1</text><text x="${left+(W-left-right)/2}" y="${H-7}" text-anchor="middle" class="chart-label">${slabEsc(xlabel)}</text><text x="14" y="${top+(H-top-bottom)/2}" transform="rotate(-90 14 ${top+(H-top-bottom)/2})" text-anchor="middle" class="chart-label">温度 T（℃）</text></svg>`;
}

export function slabProfileGraph(r,previous=null){
 if(!r||r.error)return "";
 const sample=x=>Array.from({length:65},(_,i)=>[i/64,slabTemperatureAt(x,i/64)]);
 const other=previous&&!previous.error?sample(previous):null;
 return slabGraphSVG(r,sample(r),`厚さ方向の温度分布。中心${slabFmt(r.centerTemperature)}℃、表面${slabFmt(r.surfaceTemperature)}℃。相対位置x/Lの0は中心、1は表面。`,"相対位置 x/L（中心から表面）",other);
}

export function slabHistoryGraph(r){
 if(!r||r.error)return "";
 const horizon=Math.min(8,Math.max(.4,r.fo*1.2));
 const fractions=[0,...Array.from({length:64},(_,i)=>Math.max(SLAB_MIN_FO,horizon*(i+1)/64))];
 const center=fractions.map(fo=>[fo/horizon,slabTemperatureAt(r,0,fo)]);
 const surface=fractions.map(fo=>[fo/horizon,slabTemperatureAt(r,1,fo)]);
 const warning=r.fo>horizon?" 選択Foはグラフの上限8を超えるため、表示範囲外。":"";
 return slabGraphSVG(r,center,`中心と表面の温度履歴。実線は中心、比較線は表面。横軸の1はFo=${slabFmt(horizon)}。${warning}`,"表示範囲内のFo（横軸1が"+slabFmt(horizon)+"）",surface);
}

const slabEsc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const slabFmt=n=>Number(n).toLocaleString("ja-JP",{maximumSignificantDigits:7});
