// Independent educational two-stream heat-exchanger model: co-current and counter-current.

// Uses no copied textbook text, diagrams, or extracted numeric data.

export const EXCHANGER_DEFAULTS=Object.freeze({"flow":"counter","hotMass":0.2,"hotCp":2000,"coldMass":0.4,"coldCp":1000,"u":100,"area":2,"hotIn":80,"coldIn":20});

export const exchangerFields=[["hotMass","流路Hの質量流量 ṁₕ","kg/s",0.0001,1000,"温側と呼ぶ流路Hの流量"],["hotCp","流路Hの比熱 cₚ,ₕ","J/(kg·K)",10,10000,"温度に依存しないと仮定"],["coldMass","流路Cの質量流量 ṁ𝚌","kg/s",0.0001,1000,"冷側と呼ぶ流路Cの流量"],["coldCp","流路Cの比熱 cₚ,𝚌","J/(kg·K)",10,10000,"温度に依存しないと仮定"],["u","総括熱通過率 U","W/(m²·K)",0.01,100000,"全交換面で一様な値"],["area","伝熱面積 A","m²",0.0001,1000,"総括熱通過率の面積基準と一致させる"],["hotIn","流路Hの入口温度 Tₕ,in","℃",-273.15,3000,"左の流路Hの入口"],["coldIn","流路Cの入口温度 T𝚌,in","℃",-273.15,3000,"右の流路Cの入口"]];

export const exchangerFieldNames=exchangerFields.map(f=>f[0]);

function exchangerNumber(raw){
 if(typeof raw!=="number"&&typeof raw!=="string")return NaN;
 const s=String(raw).trim();
 if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return NaN;
 const n=Number(s);
 return Number.isFinite(n)?n:NaN;
}

export function exchangerEffectiveness(flow,ntu,cr){
 if(!["counter","parallel"].includes(flow)||!Number.isFinite(ntu)||ntu<=0||cr<0||cr>1)return NaN;
 if(flow==="parallel")return -Math.expm1(-ntu*(1+cr))/(1+cr);
 if(cr===1)return ntu/(1+ntu);
 const d=1-cr,t=-Math.expm1(-ntu*d);
 return t/(d+cr*t);
}

export function logMeanDifference(a,b){
 if(a===0&&b===0)return 0;
 if(!Number.isFinite(a)||!Number.isFinite(b)||a*b<=0)return NaN;
 const x=(a-b)/b;
 if(x===0)return b;
 if(Math.abs(x)<1e-4)return b*(1+x/2-x*x/12+x*x*x/24);
 return b*x/Math.log1p(x);
}

export function calculateExchanger(values){
 if(!values||typeof values!=="object"||Array.isArray(values))return {error:"熱交換器の入力項目を確認してください。"};
 if(!["counter","parallel"].includes(values.flow))return {error:"流れの形式は向流または並流を選んでください。"};
 const v={flow:values.flow};
 for(const [key,label,unit,min,max] of exchangerFields){
  const n=exchangerNumber(values[key]);
  if(!Number.isFinite(n))return {error:`${label}には有限の数値を入力してください。`};
  if((key==="hotIn"||key==="coldIn")?n<=-273.15||n>max:n<min||n>max)
   return {error:`${label}の範囲を確認してください（${key==="hotIn"||key==="coldIn"?"−273.15 ℃超〜3000 ℃":`${min}〜${max} ${unit}`}）。`};
  v[key]=n;
 }
 const hotCapacity=v.hotMass*v.hotCp,coldCapacity=v.coldMass*v.coldCp;
 const cMin=Math.min(hotCapacity,coldCapacity),cMax=Math.max(hotCapacity,coldCapacity);
 const cr=cMin/cMax,ua=v.u*v.area,ntu=ua/cMin;
 const effectiveness=exchangerEffectiveness(v.flow,ntu,cr);
 const inletDifference=v.hotIn-v.coldIn,maxWatts=cMin*inletDifference;
 const watts=effectiveness*maxWatts;
 const hotOut=v.hotIn-watts/hotCapacity,coldOut=v.coldIn+watts/coldCapacity;
 const terminal1=v.flow==="counter"?v.hotIn-coldOut:inletDifference;
 const terminal2=v.flow==="counter"?hotOut-v.coldIn:hotOut-coldOut;
 let logMean=logMeanDifference(terminal1,terminal2);
 let lmMethod="terminal";
 if(inletDifference===0) {logMean=0;lmMethod="zero-gradient";}
 else if(!Number.isFinite(logMean)||Math.abs(ua*logMean-watts)>1e-7*Math.max(1,Math.abs(watts))){
  // For very large NTU, floating-point outlet temperatures may round an approach to zero.
  logMean=watts/ua;lmMethod="energy-limit";
 }
 const hotBalance=hotCapacity*(v.hotIn-hotOut),coldBalance=coldCapacity*(coldOut-v.coldIn);
 const entries=[hotCapacity,coldCapacity,cMin,cMax,cr,ua,ntu,effectiveness,maxWatts,watts,hotOut,coldOut,terminal1,terminal2,logMean,hotBalance,coldBalance];
 if(entries.some(x=>!Number.isFinite(x))||effectiveness<0||effectiveness>1+1e-12)
  return {error:"計算できる数値範囲を超えています。条件を見直してください。"};
 return {values:v,hotCapacity,coldCapacity,cMin,cMax,cr,ua,ntu,effectiveness,inletDifference,maxWatts,watts,hotOut,coldOut,terminal1,terminal2,logMean,lmMethod,hotBalance,coldBalance};
}

const exchangerEsc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const exchangerFmt=n=>Number(n).toLocaleString("ja-JP",{maximumSignificantDigits:7});

export function renderExchangerFields(values=EXCHANGER_DEFAULTS){
 return `<label class="sim-field"><span class="sim-field-caption">流動形式</span><span class="input-unit"><select name="flow" required><option value="counter" ${values.flow==="counter"?"selected":""}>向流（対向方向）</option><option value="parallel" ${values.flow==="parallel"?"selected":""}>並流（同一方向）</option></select></span><small>2流路とも単相、流路内混合が一定の理想モデル</small></label>`+
 exchangerFields.map(([key,label,unit,min,max,help])=>`<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${exchangerEsc(values[key])}" min="${key==="hotIn"||key==="coldIn"?-273.1499999:min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join("");
}

export function renderExchangerSteps(result){
 if(!result||result.error)return "";
 const x=result,v=x.values, f=exchangerFmt;
 const near=x.lmMethod==="energy-limit"?"出口温度の丸めで端点差を十分に解像できないため、理論式 Q̇/(UA) から極限のLMTDを示しています。":"端点の温度差を対数平均して求めています。";
 return `<div class="simulation-steps"><p><strong>補足説明：ε–NTUからLMTDまで</strong></p>
 <details><summary>1. 定常熱収支と熱容量流量</summary><p>Cₕ=ṁₕcₚ,ₕ=${f(x.hotCapacity)} W/K、C𝚌=ṁ𝚌cₚ,𝚌=${f(x.coldCapacity)} W/K。Cmin=${f(x.cMin)} W/K、Cr=Cmin/Cmax=${f(x.cr)}（無次元）。</p><p>単相・熱損失なし・一定物性・一様なUを仮定します。流路HからCへの熱移動率を正とし、温度が逆転した場合は負になります。</p></details>
 <details><summary>2. ε–NTU法による出口温度</summary><p>UA=${f(x.ua)} W/K、NTU=UA/Cmin=${f(x.ntu)}（無次元）。${v.flow==="counter"?"向流":"並流"}の有効度 ε=${f(x.effectiveness)}。</p>
 <p>入口温度差 Tₕ,in−T𝚌,in=${f(x.inletDifference)} K、最大移動率 Q̇max=Cmin(Tₕ,in−T𝚌,in)=${f(x.maxWatts)} W、実際の熱移動率 Q̇=ε Q̇max=${f(x.watts)} W。</p>
 <p>Tₕ,out=Tₕ,in−Q̇/Cₕ=${f(x.hotOut)} ℃、T𝚌,out=T𝚌,in+Q̇/C𝚌=${f(x.coldOut)} ℃。</p></details>
 <details><summary>3. 端点差・LMTD・保存則を照合</summary><p>端点の差は ΔT₁=${f(x.terminal1)} K、ΔT₂=${f(x.terminal2)} K。並流では入口差と出口差、向流ではTₕ,in−T𝚌,outとTₕ,out−T𝚌,inです。</p>
 <p>対数平均温度差 ΔTlm=${f(x.logMean)} K。${near}UAΔTlm=${f(x.ua*x.logMean)} W。</p>
 <p>温側の熱収支 Cₕ(Tₕ,in−Tₕ,out)=${f(x.hotBalance)} W、冷側の熱収支 C𝚌(T𝚌,out−T𝚌,in)=${f(x.coldBalance)} W。符号を含めてQ̇と一致するのが定常保存則です。</p></details>
 <small>教育用の理想二流路モデル。相変化、多パス、交差流、混合、外部熱損失、温度依存物性、圧力損失、汚れ抵抗の変化は考慮していません。UAは既知の入力であり、流体力学から推定していません。</small></div>`;
}

export function renderExchangerDiagram(result){
 const valid=result&&!result.error;const f=exchangerFmt, esc=exchangerEsc;
 const v=valid?result.values:null,parallel=v?.flow==="parallel";
 const description=valid?`${parallel?"並流":"向流"}。流路H ${f(v.hotIn)} ℃から ${f(result.hotOut)} ℃、流路C ${f(v.coldIn)} ℃から ${f(result.coldOut)} ℃。正味熱移動率 ${f(result.watts)} W。`:"入力が無効なため、流路の温度・熱流方向は未判定です。";
 const pathC=parallel?"M110 154 L386 154 L375 147 M386 154 L375 161":"M386 154 L110 154 L121 147 M110 154 L121 161";
 const labelHot=valid?`H: ${f(v.hotIn)} → ${f(result.hotOut)} ℃`:"流路H";
 const labelCold=valid?`C: ${f(v.coldIn)} → ${f(result.coldOut)} ℃`:"流路C";
 const heatDirection=valid?(result.watts>0?"H → C":result.watts<0?"C → H":"熱移動なし"):"方向未判定";
 return `<figure class="simulation-figure"><svg class="sim-physical-diagram" role="img" viewBox="0 0 480 210" xmlns="http://www.w3.org/2000/svg"><title>熱交換器の二流路模式図</title><desc>${esc(description)}</desc>
 <rect x="92" y="50" width="302" height="112" rx="10" class="diagram-solid"/><path d="M96 105 L390 105" class="diagram-boundary"/>
 <path d="M110 80 L386 80 L375 73 M386 80 L375 87" class="diagram-arrow"/>
 <path d="${pathC}" class="diagram-arrow"/>
 <text x="19" y="28" class="chart-label">${esc(parallel?"並流":"向流")}</text>
 <text x="106" y="67" class="chart-label">${esc(labelHot)}</text>
 <text x="106" y="141" class="chart-label">${esc(labelCold)}</text>
 <text x="157" y="191" class="chart-label">${esc(`正味熱移動：${heatDirection}`)}</text></svg>
 <figcaption>アプリ作成の模式図。矢印は両流体の移動方向、数値は入口・出口温度を表します。流路内の詳細温度場は示しません。</figcaption></figure>`;
}

export function exchangerEffectivenessGraph(result,comparison=null){
 if(!result||result.error)return "";
 const f=exchangerFmt,esc=exchangerEsc;const other=comparison&&!comparison.error?comparison:null;
 const span=Math.min(12,Math.max(3,result.ntu*1.25,other?Math.min(12,other.ntu*1.25):0));
 const W=560,H=250,left=59,right=17,top=20,bottom=48;
 const X=n=>left+n/span*(W-left-right),Y=n=>top+(1-n)*(H-top-bottom);
 const make=(cr,flow)=>Array.from({length:65},(_,i)=>{const n=Math.max(1e-15,span*i/64);return [n,exchangerEffectiveness(flow,n,cr)];});
 const render=(values,cls)=>`<path d="${values.map(([n,e],i)=>`${i?"L":"M"}${X(n).toFixed(3)},${Y(e).toFixed(3)}`).join(" ")}" class="${cls}"/>`;
 const current=make(result.cr,result.values.flow);
 const opposite=make(result.cr,result.values.flow==="counter"?"parallel":"counter");
 const previous=other?make(other.cr,other.values.flow):[];
 const ticks=[0,.5,1].map(e=>`<line x1="${left}" y1="${Y(e)}" x2="${W-right}" y2="${Y(e)}" class="chart-grid"/><text x="${left-8}" y="${Y(e)+4}" text-anchor="end" class="chart-label">${e}</text>`).join("");
 const marker=result.ntu<=span?`<circle cx="${X(result.ntu)}" cy="${Y(result.effectiveness)}" r="5" class="chart-current-point"/>`:"";
 const description=`有効度εをNTUに対して表示。実線は選択流動${result.values.flow==="counter"?"向流":"並流"}、比較線は反対形式、${other?"点線は保存条件。":""}現在の有効度${f(result.effectiveness)}、容量比${f(result.cr)}、NTU=${f(result.ntu)}。横軸表示上限${f(span)}。`;
 return `<svg class="sim-chart" role="img" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-label="${esc(description)}"><title>熱交換器有効度と伝熱単位数</title><desc>${esc(description)}</desc>${ticks}
 ${render(opposite,"chart-baseline")}${render(current,"chart-current")}${other?render(previous,"chart-baseline"):""}${marker}
 <text x="${left}" y="${H-29}" class="chart-label">0</text><text x="${W-right}" y="${H-29}" text-anchor="end">${f(span)}</text>
 <text x="${left+(W-left-right)/2}" y="${H-7}" text-anchor="middle" class="chart-label">NTU（無次元）</text>
 <text x="14" y="${top+(H-top-bottom)/2}" transform="rotate(-90 14 ${top+(H-top-bottom)/2})" text-anchor="middle" class="chart-label">有効度 ε</text></svg>`;
}
