// Educational Rohsenow saturated nucleate pool-boiling model with separately estimated Zuber CHF.

// Csf and n are fluid/surface-specific measured constants. Do not use as an equipment safety limit.

export const NUCLEATE_DEFAULTS=Object.freeze({"rhoLiquid":958.4,"rhoVapor":0.597,"viscosity":0.000282,"conductivity":0.679,"cp":4216,"latent":2257000,"surfaceTension":0.0589,"csf":0.013,"n":1,"superheat":10,"area":0.01});

export const nucleateFields=Object.freeze([["rhoLiquid","飽和液体密度 ρ_l","kg/m³",1,20000,"対象の飽和圧力に対応する液体物性"],["rhoVapor","飽和蒸気密度 ρ_v","kg/m³",0.000001,20000,"ρ_l > ρ_v > 0 が必要"],["viscosity","液体粘度 μ_l","Pa·s",1e-7,10,"飽和液体の粘性係数"],["conductivity","液体熱伝導率 k_l","W/(m·K)",0.001,100,"液体側の熱伝導率"],["cp","液体定圧比熱 c_{p,l}","J/(kg·K)",100,20000,"飽和液体の代表物性"],["latent","蒸発潜熱 h_fg","J/kg",10000,10000000,"飽和状態での相変化潜熱"],["surfaceTension","界面張力 σ","N/m",0.000001,1,"液体と蒸気の界面張力"],["csf","流体・表面経験係数 Csf","無次元",0.001,0.1,"既知の流体×表面×仕上げの実測情報で指定。例の0.013を万能値とみなさない"],["n","Rohsenow指数 n","無次元",0.5,2,"水で1、その他の流体で1.7を使う例もあるが実験系で照合"],["superheat","壁面過熱度 ΔTe","K",0.1,100,"T_w−T_sat。十分発達した核沸騰領域のみ"],["area","伝熱面積 A","m²",0.000001,1000,"外部流れのない大きな上向きの加熱面"]]);

export const nucleateFieldNames=Object.freeze(nucleateFields.map(f=>f[0]));

const escapeNucleate=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

const fmtNucleate=n=>Number(n).toLocaleString("ja-JP",{maximumSignificantDigits:7});

function parseNucleate(raw){
 if(typeof raw!=="number"&&typeof raw!=="string")return NaN;
 const s=String(raw).trim();if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return NaN;
 const x=Number(s);return Number.isFinite(x)?x:NaN;
}

export function rohsenowHeatFlux(v,superheat=v?.superheat){
 if(!v||![v.rhoLiquid,v.rhoVapor,v.viscosity,v.conductivity,v.cp,v.latent,v.surfaceTension,v.csf,v.n,superheat].every(Number.isFinite)||
  v.rhoLiquid<=v.rhoVapor||v.rhoVapor<=0||v.viscosity<=0||v.conductivity<=0||v.cp<=0||
  v.latent<=0||v.surfaceTension<=0||v.csf<=0||v.n<=0||superheat<=0)
  throw new RangeError("Rohsenow式の物性・表面経験定数・過熱度が無効です。");
 const pr=v.viscosity*v.cp/v.conductivity;
 const pref=v.viscosity*v.latent*Math.sqrt(9.80665*(v.rhoLiquid-v.rhoVapor)/v.surfaceTension);
 return pref*Math.pow(v.cp*superheat/(v.csf*v.latent*Math.pow(pr,v.n)),3);
}

export function nucleateZuberLimit(v){
 if(!v||![v.rhoLiquid,v.rhoVapor,v.latent,v.surfaceTension].every(Number.isFinite)||
 v.rhoLiquid<=v.rhoVapor||v.rhoVapor<=0||v.latent<=0||v.surfaceTension<=0)
 throw new RangeError("CHF計算に必要な飽和物性が無効です。");
 return .131*v.latent*Math.sqrt(v.rhoVapor)*Math.pow(v.surfaceTension*9.80665*(v.rhoLiquid-v.rhoVapor),.25);
}

export function calculateNucleateBoiling(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {error:"核沸騰モデルの入力を確認してください。"};
 const v={};
 for(const [key,label,unit,min,max] of nucleateFields){
  const x=parseNucleate(raw[key]);
  if(!Number.isFinite(x)||x<min||x>max)return {error:`${label}は${min}〜${max} ${unit}の有限の十進数で指定してください。`};
  v[key]=x;
 }
 if(!(v.rhoLiquid>v.rhoVapor))return {error:"飽和液体密度は蒸気密度より大きくしてください。"};
 const pr=v.viscosity*v.cp/v.conductivity;
 if(pr<.1||pr>1000)return {error:`この教育用モデルで許容する液体Prは0.1〜1000です。現在Pr=${pr.toPrecision(4)}。`};
 const criticalFlux=nucleateZuberLimit(v),flux=rohsenowHeatFlux(v),chfRatio=flux/criticalFlux;
 const pref=v.viscosity*v.latent*Math.sqrt(9.80665*(v.rhoLiquid-v.rhoVapor)/v.surfaceTension);
 const formalCrossing=v.csf*v.latent*Math.pow(pr,v.n)/v.cp*Math.cbrt(criticalFlux/pref);
 if(!Number.isFinite(flux)||!Number.isFinite(criticalFlux)||!Number.isFinite(formalCrossing)||formalCrossing<=0)return {error:"計算可能な数値範囲外です。"};
 if(chfRatio>=1)return {error:`Rohsenow推算q″=${fmtNucleate(flux)} W/m²がZuber CHF推算値=${fmtNucleate(criticalFlux)} W/m²以上です。核沸騰式をその領域に外挿できません。壁面過熱度を下げてください。`};
 const watts=flux*v.area,h=flux/v.superheat,idealVaporMassRate=watts/v.latent;
 const lowSuperheatWarning=v.superheat<1?"壁面過熱度が1 K未満です。この領域では気泡の核生成（沸騰開始点）に達していない可能性があり、実際は核沸騰ではなく自然対流が支配的な場合があります。Rohsenow式は十分に発達した核沸騰の経験相関なので、この計算値を核沸騰の結果として扱わないでください。1 Kは表示上の目安であり、沸騰開始点そのものではありません。":null;
 const formalWarning=chfRatio>=.8?"CHF推定値の80%以上です。モデル誤差を考慮し、安全な核沸騰の持続を保証しません。":(lowSuperheatWarning||"核沸騰開始点はこの式からは分かりません。実験・表面状態に対するCsfとnの選定が重要です。");
 const values=[flux,criticalFlux,formalCrossing,chfRatio,watts,h,idealVaporMassRate,pr];
 if(values.some(x=>!Number.isFinite(x)))return {error:"計算結果が数値範囲を超えました。"};
 return {values:v,pr,flux,watts,h,criticalFlux,chfRatio,formalCrossing,idealVaporMassRate,
  warning:formalWarning};
}

export function renderNucleateFields(v=NUCLEATE_DEFAULTS){
 return nucleateFields.map(([key,label,unit,min,max,help])=>`<label class="sim-field">${label}<span class="input-unit"><input type="number" name="${key}" value="${escapeNucleate(v[key])}" min="${min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join("");
}

export function renderNucleateSteps(r){
 if(!r||r.error)return "";
 const v=r.values,F=fmtNucleate;
 return `<div class="simulation-steps"><p><strong>§9.2 核沸騰（プール沸騰）</strong></p>
 <details><summary>1. 壁面過熱と飽和物性</summary><p>過熱度ΔTe=T_w−T_sat=${F(v.superheat)} K。液体粘度μ_l=${F(v.viscosity)} Pa·s、液体比熱c_{p,l}=${F(v.cp)} J/(kg·K)、液体熱伝導率k_l=${F(v.conductivity)} W/(m·K)。Pr_l=μ_l c_{p,l}/k_l=${F(r.pr)}。流体/表面/仕上げを表す経験係数Csf=${F(v.csf)}、指数n=${F(v.n)}。</p></details>
 <details><summary>2. Rohsenowの核沸騰相関式</summary><p>q″=μ_l h_fg [g(ρ_l−ρ_v)/σ]^(1/2) [c_{p,l} ΔTe/(Csf h_fg Pr_l^n)]³=${F(r.flux)} W/m²。平均の見かけ熱伝達率 h=q″/ΔTe=${F(r.h)} W/(m²·K)。面積A=${F(v.area)}m²でQ=${F(r.watts)}W。</p>
 <p>仮に全熱量が潜熱に使われれば蒸気発生量ṁ≈Q/h_fg=${F(r.idealVaporMassRate)}kg/s。ただしこれは理想化した熱収支であり、実際の蒸発量を保証しません。</p></details>
 <details><summary>3. §9.3のCHFとの比較（適用域のチェック）</summary><p>Zuber式によるCHF推算q″CHF=${F(r.criticalFlux)} W/m²、q″/q″CHF=${F(r.chfRatio)}。両相関の形式上の交差点過熱度ΔTe*=${F(r.formalCrossing)} K。この交差点は観測された核沸騰終点でも実機の安全上限でもありません。</p><p>${escapeNucleate(r.warning)}</p></details>
 <small>一定圧力における静止した飽和液体の大面積プール沸騰・十分に発達した核沸騰の教育用経験相関。Csfやnは流体・加熱面・仕上げと測定条件に依存します。沸騰開始条件、過冷却流体、流動沸騰、管内の二相流、表面汚れ、非凝縮性気体、膜沸騰・遷移沸騰を推定しません。CHFの予測値との一致で実験的な信頼性を証明できません。</small></div>`;
}

export function renderNucleateDiagram(r){
 if(!r||r.error)return "";
 const v=r.values;
 return `<figure class="simulation-figure"><svg xmlns="http://www.w3.org/2000/svg" role="img" class="sim-physical-diagram" viewBox="0 0 520 240"><title>飽和プールの核沸騰模式図</title><desc>${escapeNucleate("飽和液体中に上向き加熱面から気泡が発生する概念図。壁面過熱度"+fmtNucleate(v.superheat)+" K、熱流束"+fmtNucleate(r.flux)+" W/m²。")}</desc>
 <rect x="85" y="45" width="350" height="136" class="diagram-fluid"/><rect x="85" y="181" width="350" height="24" class="diagram-solid"/>
 <circle cx="125" cy="170" r="7" class="diagram-vapor"/><circle cx="182" cy="150" r="13" class="diagram-vapor"/><circle cx="274" cy="129" r="18" class="diagram-vapor"/><circle cx="363" cy="163" r="10" class="diagram-vapor"/>
 <path d="M183 125 L183 83 M176 90 L183 83 L190 90 M274 103 L274 60 M267 67 L274 60 L281 67" class="diagram-arrow"/>
 <text x="105" y="27" class="chart-label">飽和液体・気泡生成</text><text x="110" y="225" class="chart-label">加熱壁面 ΔTe=${escapeNucleate(fmtNucleate(v.superheat))}K</text></svg>
 <figcaption>独自の模式図。泡の数、気泡半径、離脱頻度、沸騰開始温度を計算するものではありません。</figcaption></figure>`;
}

export function nucleateHeatFluxGraph(r,previous=null){
 if(!r||r.error)return "";
 const maxX=Math.min(80,Math.max(1.3*r.values.superheat,1.05*r.formalCrossing));
 const W=560,H=252,l=81,rr=20,t=19,b=58;
 const reference=Math.max(r.criticalFlux,previous&&!previous.error?previous.criticalFlux:0);
 const yMax=1.13*reference;
 const X=u=>l+u/maxX*(W-l-rr),Y=q=>t+(yMax-q)/yMax*(H-t-b);
 const curves=[];
 for(const o of [r,previous].filter(x=>x&&!x.error)){
  const values=Array.from({length:101},(_,i)=>{
   const d=Math.max(.0001,maxX*i/100);
   const q=rohsenowHeatFlux(o.values,d);
   return q<=o.criticalFlux && Number.isFinite(q)?[d,q]:null;
  });
  let part=[],list=[];
  for(const row of values){
   if(!row){if(part.length)list.push(part);part=[];}
   else part.push(row);
  }
  if(part.length)list.push(part);
  curves.push(list);
 }
 const path=arr=>arr.map(([x,y],i)=>`${i?"L":"M"}${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(" ");
 const segments=curves.map((set,i)=>set.map(points=>`<path d="${path(points)}" class="${i===0?"chart-current":"chart-baseline"}"/>`).join("")).join("");
 return `<svg xmlns="http://www.w3.org/2000/svg" role="img" class="sim-chart" viewBox="0 0 ${W} ${H}" aria-label="過熱度に対するRohsenow核沸騰熱流束。CHF推定値を超える曲線は描かない。"><title>過熱度と核沸騰熱流束</title>
 <desc>横軸はT_w−T_sat（K）、縦軸はW/m²。線はRohsenowの経験的な核沸騰曲線。横線はZuber CHF推算値。式は実際の沸騰開始点やCHF温度を保証しない。</desc>
 <line x1="${l}" y1="${Y(r.criticalFlux)}" x2="${W-rr}" y2="${Y(r.criticalFlux)}" class="chart-grid"/>${segments}
 <circle class="chart-current-point" cx="${X(r.values.superheat)}" cy="${Y(r.flux)}" r="4"/>
 <text x="${l}" y="${H-36}" class="chart-label">0</text><text x="${W-rr}" y="${H-36}" class="chart-label" text-anchor="end">${fmtNucleate(maxX)}</text>
 <text x="${(l+W-rr)/2}" y="${H-11}" class="chart-label" text-anchor="middle">壁面過熱度 ΔTe（K）</text>
 <text x="17" y="${(t+H-b)/2}" transform="rotate(-90 17 ${(t+H-b)/2})" class="chart-label" text-anchor="middle">熱流束 q″（W/m²）</text>
 <text x="${l+4}" y="${Y(r.criticalFlux)-6}" class="chart-label">Zuber CHF（推定上限）</text></svg>`;
}

export function nucleateSurfaceSensitivityGraph(r){
 if(!r||r.error)return "";
 const W=560,H=252,l=80,rr=18,t=18,b=55;
 const samples=Array.from({length:101},(_,i)=>{
  const factor=.5+1.5*i/100;
  const q=rohsenowHeatFlux({...r.values,csf:r.values.csf*factor});
  return q<=r.criticalFlux?[factor,q]:null;
 });
 const yMax=r.criticalFlux*1.05,XX=v=>l+(v-.5)/1.5*(W-l-rr),YY=q=>t+(yMax-q)/yMax*(H-t-b);
 const segments=[];let seg=[];
 for(const point of samples){
  if(point)seg.push(point);
  else if(seg.length){segments.push(seg);seg=[];}
 }
 if(seg.length)segments.push(seg);
 const paths=segments.map(arr=>`<path class="chart-current" d="${arr.map(([x,y],i)=>`${i?"L":"M"}${XX(x).toFixed(2)},${YY(y).toFixed(2)}`).join(" ")}"/>`).join("");
 return `<svg class="sim-chart" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" aria-label="Csfの変化と核沸騰熱流束。CHFを超える領域は描画しない。"><title>表面経験係数に対する核沸騰熱流束の感度</title><desc>表面・流体の経験係数Csfを0.5〜2倍した形式的な感度であり、表面加工そのものを予測しません。</desc>
 ${paths}<circle class="chart-current-point" cx="${XX(1)}" cy="${YY(r.flux)}" r="4"/>
 <text x="${l}" y="${H-33}" class="chart-label">0.5</text><text x="${W-rr}" y="${H-33}" text-anchor="end" class="chart-label">2.0</text>
 <text x="${(l+W-rr)/2}" y="${H-11}" text-anchor="middle" class="chart-label">経験係数倍率 Csf/Csf,0（無次元）</text>
 <text x="15" y="${(t+H-b)/2}" text-anchor="middle" transform="rotate(-90 15 ${(t+H-b)/2})" class="chart-label">核沸騰熱流束（W/m²）</text></svg>`;
}
