// Independently authored educational Zuber-type saturated pool-boiling critical heat flux model.

// Not an engineering safety threshold: actual CHF depends strongly on geometry and flow conditions.

export const CHF_GRAVITY=9.80665;

export const CHF_COEFFICIENT=0.131;

export const CHF_DEFAULTS=Object.freeze({"rhoLiquid":958.4,"rhoVapor":0.597,"latent":2257000,"surfaceTension":0.0589,"area":0.01,"appliedFlux":500000});

export const chfFields=Object.freeze([["rhoLiquid","飽和液体密度 ρ_l","kg/m³",1,20000,"対象圧力での飽和液体物性"],["rhoVapor","飽和蒸気密度 ρ_v","kg/m³",0.000001,20000,"正の蒸気密度が必要"],["latent","蒸発潜熱 h_fg","J/kg",10000,10000000,"飽和温度での液体→蒸気の比エンタルピー差"],["surfaceTension","気液表面張力 σ","N/m",0.000001,1,"飽和状態での界面張力"],["area","加熱面積 A","m²",0.000001,1000,"代表的に十分大きな水平上向き加熱面"],["appliedFlux","比較する熱流束 q″","W/m²",0,100000000,"CHFとの大小比較。入力熱流束からCHFを計算するわけではない"]]);

export const chfFieldNames=Object.freeze(chfFields.map(f=>f[0]));

const escapeCHF=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const fmtCHF=v=>Number(v).toLocaleString("ja-JP",{maximumSignificantDigits:7});

function readNumber(raw){
 if(typeof raw!=="number"&&typeof raw!=="string")return NaN;
 const s=String(raw).trim();
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return NaN;
 const n=Number(s);return Number.isFinite(n)?n:NaN;
}

export function zuberHeatFlux(rhoLiquid,rhoVapor,latent,surfaceTension){
 if(![rhoLiquid,rhoVapor,latent,surfaceTension].every(Number.isFinite)||rhoVapor<=0||rhoLiquid<=rhoVapor||latent<=0||surfaceTension<=0)throw new RangeError("飽和物性が不正です。密度はρl>ρv>0が必要です。");
 return 0.131*latent*Math.sqrt(rhoVapor)*Math.pow(surfaceTension*9.80665*(rhoLiquid-rhoVapor),.25);
}

export function calculateCriticalHeatFlux(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {error:"限界熱流束モデルの入力を確認してください。"};
 const v={};
 for(const [key,label,unit,min,max] of chfFields){
  const n=readNumber(raw[key]);
  if(!Number.isFinite(n)||n<min||n>max)return {error:`${label}には${min}〜${max} ${unit}の有限の十進数を入力してください。`};
  v[key]=n;
 }
 if(v.rhoLiquid<=v.rhoVapor)return {error:"飽和液体密度ρlは飽和蒸気密度ρvより大きい必要があります。"};
 let criticalFlux;
 try{criticalFlux=zuberHeatFlux(v.rhoLiquid,v.rhoVapor,v.latent,v.surfaceTension)}catch(e){return {error:e.message};}
 const criticalWatts=criticalFlux*v.area,requestedWatts=v.appliedFlux*v.area;
 const ratio=v.appliedFlux/criticalFlux,remainingFlux=criticalFlux-v.appliedFlux;
 const capillaryLength=Math.sqrt(v.surfaceTension/(9.80665*(v.rhoLiquid-v.rhoVapor)));
 const vaporMassFluxIdeal=criticalFlux/v.latent;
 const kunFactor=criticalFlux/(v.latent*Math.sqrt(v.rhoVapor)*Math.pow(v.surfaceTension*9.80665*(v.rhoLiquid-v.rhoVapor),.25));
 const state=ratio>=1?"above-estimate":ratio>=.8?"near-estimate":"below-estimate";
 if([criticalFlux,criticalWatts,requestedWatts,ratio,remainingFlux,capillaryLength,vaporMassFluxIdeal,kunFactor].some(n=>!Number.isFinite(n)))
  return {error:"計算値が数値範囲外です。"};
 return {values:v,criticalFlux,criticalWatts,requestedWatts,ratio,remainingFlux,capillaryLength,vaporMassFluxIdeal,kunFactor,state,
   warning:ratio>=1?"入力した熱流束はZuberのCHF推定値以上です。核沸騰の熱移動を安定に維持できると解釈しないでください。":ratio>=.8?"CHF推定値に近い条件です。経験相関と実機との差に注意し、運転許容値として用いないでください。":"CHFは経験的な上限推定であり、実機の安全余裕や設計上限を保証しません。"};
}

export function renderCriticalHeatFluxFields(v=CHF_DEFAULTS){
 return chfFields.map(([key,label,unit,min,max,help])=>`<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input name="${key}" type="number" value="${escapeCHF(v[key])}" min="${min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join("");
}

export function renderCriticalHeatFluxSteps(r){
 if(!r||r.error)return "";
 const v=r.values,F=fmtCHF;
 return `<div class="simulation-steps"><p><strong>§9.3 プール沸騰の限界熱流束（CHF）</strong></p>
 <details><summary>1. 飽和物性と仮定</summary><p>飽和液体密度ρ_l=${F(v.rhoLiquid)} kg/m³、飽和蒸気密度ρ_v=${F(v.rhoVapor)} kg/m³、潜熱h_fg=${F(v.latent)} J/kg、界面張力σ=${F(v.surfaceTension)} N/m。g=9.80665 m/s²。液体が飽和した静止プール、十分大きな上向き水平加熱面を理想化します。</p></details>
 <details><summary>2. Zuberの流体力学的限界</summary><p>q″CHF=0.131 h_fg ρ_v^(1/2)[σg(ρ_l−ρ_v)]^(1/4)=${F(r.criticalFlux)} W/m²。この式は気泡・蒸気噴流の不安定化に基づくCHFの推定値であり、核沸騰・膜沸騰の全曲線や遷移温度は求めません。</p>
 <p>毛管長さLc=[σ/{g(ρ_l−ρ_v)}]^(1/2)=${F(r.capillaryLength)} m。面積A=${F(v.area)}m²に対するQCHF=${F(r.criticalWatts)} W。</p></details>
 <details><summary>3. 指定熱流束との比較</summary><p>指定q″=${F(v.appliedFlux)} W/m²（Q=${F(r.requestedWatts)} W）、CHFに対する比q″/q″CHF=${F(r.ratio)}、差q″CHF−q″=${F(r.remainingFlux)} W/m²。${escapeCHF(r.warning)}</p></details>
 <small>この0.131係数を含む形はZuber/Kutateladze型の特定モデルに対する推定です。加熱面の向き・寸法・表面状態、濡れ性、液体の過冷度、外部流動、容器の拘束、低重力、非凝縮気体、混合物等で実際のCHFは異なります。機器運転の安全値として使わないでください。蒸気密度などの圧力依存物性は自動推算しません。</small></div>`;
}

export function renderCriticalHeatFluxDiagram(r){
 if(!r||r.error)return "";
 const f=fmtCHF,v=r.values;
 return `<figure class="simulation-figure"><svg xmlns="http://www.w3.org/2000/svg" role="img" class="sim-physical-diagram" viewBox="0 0 520 230"><title>飽和プール沸騰のCHF模式図</title><desc>${escapeCHF("水平上向き加熱面。蒸気が上方に発生し、推定CHFは"+f(r.criticalFlux)+" W/m²。")}</desc><rect x="105" y="170" width="310" height="28" class="diagram-solid"/><rect x="105" y="40" width="310" height="130" class="diagram-fluid"/><circle cx="160" cy="144" r="14" class="diagram-vapor"/><circle cx="242" cy="112" r="20" class="diagram-vapor"/><circle cx="340" cy="88" r="23" class="diagram-vapor"/><path d="M160 123 L160 67 M151 76 L160 66 L169 76 M340 61 L340 34 M331 43 L340 33 L349 43" class="diagram-arrow"/><text x="116" y="23" class="chart-label">飽和液体と蒸気</text><text x="123" y="218" class="chart-label">上向きの大きな加熱面</text><text x="317" y="25" class="chart-label">q″CHF≈${escapeCHF(f(r.criticalFlux))} W/m²</text></svg><figcaption>独立作成の模式図。泡の個数・サイズ・間隔は実測でも予測値でもありません。</figcaption></figure>`;
}

export function criticalHeatFluxSensitivityGraph(r,previous=null){
 if(!r||r.error)return "";
 const W=560,H=250,l=76,right=18,t=20,bottom=51;
 const maxFlux=r.criticalFlux*1.3;
 const series=(obj)=>Array.from({length:61},(_,i)=>{
  const u=i/60,factor=.5+1.5*u;
  return [u,zuberHeatFlux(obj.values.rhoLiquid,obj.values.rhoVapor,obj.values.latent,obj.values.surfaceTension*factor)];
 });
 const current=series(r),baseline=previous&&!previous.error?series(previous):null;
 const vals=[...current,...(baseline||[])].map(v=>v[1]);
 const lo=0,hi=Math.max(maxFlux,...vals)*1.01;
 const xx=u=>l+u*(W-l-right),yy=v=>t+(hi-v)/hi*(H-t-bottom);
 const path=pts=>pts.map(([x,y],i)=>`${i?"L":"M"}${xx(x).toFixed(2)},${yy(y).toFixed(2)}`).join(" ");
 const markers=[.5,1,2].map(f=>`<text x="${xx((f-.5)/1.5)}" y="${H-31}" text-anchor="middle" class="chart-label">${fmtCHF(f)}</text>`).join("");
 return `<svg role="img" class="sim-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" aria-label="表面張力倍率に対するCHF。横軸は元の表面張力の0.5〜2倍、縦軸はW/m²。"><title>表面張力変化のCHF感度</title><desc>このグラフは他の飽和物性を一定に保った形式的な感度計算です。圧力や温度による物性同時変化を予測しません。</desc>
 <line x1="${l}" y1="${yy(r.criticalFlux)}" x2="${W-right}" y2="${yy(r.criticalFlux)}" class="chart-grid"/><path d="${path(current)}" class="chart-current"/>${baseline?`<path d="${path(baseline)}" class="chart-baseline"/>`:""}
 <text x="${l-8}" y="${H-51}" text-anchor="end" class="chart-label">0</text><text x="${l-8}" y="${t+4}" text-anchor="end" class="chart-label">${fmtCHF(hi)}</text>
 ${markers}<text x="${(l+W-right)/2}" y="${H-9}" text-anchor="middle" class="chart-label">表面張力倍率 σ/σ₀（無次元）</text>
 <text x="14" y="${(t+H-bottom)/2}" text-anchor="middle" transform="rotate(-90 14 ${(t+H-bottom)/2})" class="chart-label">限界熱流束 q″CHF（W/m²）</text></svg>`;
}
