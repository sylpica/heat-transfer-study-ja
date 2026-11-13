// Independent, educational Nusselt laminar film-condensation solution for an isothermal vertical plate.
// No copyrighted text, figures, datasets or reference book materials were reproduced.
export const FILM_GRAVITY=9.80665; // m/s^2
export const FILM_RE_MAX=30; // conservative smooth and wave-free film Reynolds number
export const FILM_JA_MAX=0.1; // educational small-film-sensible-heat condition
export const CONDENSATION_DEFAULTS=Object.freeze({"rhoLiquid":958,"rhoVapor":0.6,"viscosity":0.000282,"conductivity":0.68,"latent":2260000,"cpLiquid":4200,"height":0.1,"width":0.4,"saturation":100,"wall":98});
export const condensationFields=Object.freeze([["rhoLiquid","凝縮液密度 ρ_l","kg/m³",10,20000,"液膜の密度。蒸気密度より大きい値"],["rhoVapor","蒸気密度 ρ_v","kg/m³",0,10000,"静止した飽和蒸気の密度"],["viscosity","凝縮液の粘度 μ_l","Pa·s",0.000001,10,"動粘度でなく粘度（一定値）"],["conductivity","凝縮液の熱伝導率 k_l","W/(m·K)",0.001,200,"凝縮液の一定物性"],["latent","凝縮潜熱 h_fg","J/kg",10000,10000000,"潜熱。顕熱は無視する近似"],["cpLiquid","凝縮液の比熱 c_{p,l}","J/(kg·K)",100,20000,"液膜顕熱の影響をJaで確認する"],["height","鉛直平板の高さ L","m",0.005,10,"凝縮液が上端から重力で流下"],["width","凝縮面の幅 W","m",0.005,20,"片面の放熱面積A=L×W"],["saturation","蒸気の飽和温度 T_sat","℃",-273.149999,1000,"蒸気は純物質・飽和・静止"],["wall","一定の壁面温度 T_w","℃",-273.149999,1000,"必ずT_satより低く指定"]]);
export const condensationFieldNames=Object.freeze(condensationFields.map(f=>f[0]));
const escapeCondensation=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const fmtCondensation=n=>Number(n).toLocaleString("ja-JP",{maximumSignificantDigits:7});

function parseCondensationNumber(raw){
 if(typeof raw!=="number"&&typeof raw!=="string")return NaN;
 const s=String(raw).trim();
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return NaN;
 const x=Number(s);return Number.isFinite(x)?x:NaN;
}

export function nusseltFilmCoefficient(rhoLiquid,rhoVapor,mu,k,h_fg,L,deltaT){
 if([rhoLiquid,rhoVapor,mu,k,h_fg,L,deltaT].some(x=>!Number.isFinite(x))||
   rhoLiquid<=rhoVapor||rhoVapor<0||mu<=0||k<=0||h_fg<=0||L<=0||deltaT<=0)
  throw new RangeError("Nusselt凝縮式の物性と温度差が不正です。");
 const h= (2*Math.SQRT2/3)*Math.pow(9.80665*rhoLiquid*(rhoLiquid-rhoVapor)*h_fg*k**3/(mu*L*deltaT),.25);
 if(!Number.isFinite(h)||h<=0)throw new RangeError("熱伝達係数が数値上の範囲を超えました。");
 return h;
}

export function calculateFilmCondensation(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {error:"膜状凝縮モデルの入力を確認してください。"};
 const v={};
 for(const [key,label,unit,min,max] of condensationFields){
  const n=parseCondensationNumber(raw[key]);
  if(!Number.isFinite(n))return {error:`${label}には有限の十進数を入力してください。`};
  if((key==="saturation"||key==="wall")?(n<=-273.15||n>max):(n<min||n>max))
   return {error:`${label}を有効な範囲で指定してください（${key==="saturation"||key==="wall"?"絶対零度より上":min+"〜"+max+" "+unit}）。`};
  v[key]=n;
 }
 if(!(v.rhoLiquid>v.rhoVapor))return {error:"凝縮液の密度は蒸気密度より大きくしてください。"};
 const deltaT=v.saturation-v.wall;
 if(deltaT<.01)return {error:"凝縮にはTsat−Tw≥0.01 Kの正の温度差が必要です。温度逆転・ゼロ差では本モデルを使用できません。"};
 const jakob=v.cpLiquid*deltaT/v.latent;
 if(jakob>.1)return {error:`液膜内の顕熱を無視できない条件です（Ja=${jakob.toPrecision(4)}＞0.1）。補正式や別モデルが必要です。`};
 let h;
 try{h=nusseltFilmCoefficient(v.rhoLiquid,v.rhoVapor,v.viscosity,v.conductivity,v.latent,v.height,deltaT)}
 catch(e){return {error:e.message};}
 const area=v.height*v.width,watts=h*area*deltaT,heatFlux=h*deltaT;
 const massFlow=watts/v.latent,massFluxPerWidth=massFlow/v.width;
 const filmRe=4*massFluxPerWidth/v.viscosity;
 if(!Number.isFinite(filmRe)||filmRe>30)return {error:`平滑な層流液膜の適用域外です。出口膜Re=${filmRe.toPrecision(4)}＞30。波立ち・乱流を含む別の相関式を使用してください。`};
 const filmThickness=Math.pow(4*v.viscosity*v.conductivity*deltaT*v.height/
       (v.rhoLiquid*(v.rhoLiquid-v.rhoVapor)*9.80665*v.latent),.25);
 const endLocalH=v.conductivity/filmThickness;
 const meanNu=h*v.height/v.conductivity;
 const massFlowPerHour=massFlow*3600;
 const values=[deltaT,jakob,h,area,watts,heatFlux,massFlow,filmRe,filmThickness,endLocalH,meanNu,massFlowPerHour];
 if(values.some(x=>!Number.isFinite(x)||x<0))return {error:"計算結果が数値範囲を超えました。"};
 return {values:v,deltaT,jakob,h,area,watts,heatFlux,massFlow,massFluxPerWidth,filmRe,
  filmThickness,endLocalH,meanNu,massFlowPerHour};
}

export function filmThicknessAt(result,x){
 if(!result||result.error||!Number.isFinite(x)||x<0||x>result.values.height)
  throw new RangeError("xは平板上端からの距離で、0≤x≤Lの範囲に指定してください。");
 if(x===0)return 0;
 return result.filmThickness*Math.pow(x/result.values.height,.25);
}

export function filmLocalCoefficient(result,x){
 const thickness=filmThicknessAt(result,x);
 if(thickness===0)throw new RangeError("上端x=0で局所hは理想化された発散を示します。x>0を指定してください。");
 return result.values.conductivity/thickness;
}

export function filmCumulativeMassFlow(result,x){
 if(!result||result.error||!Number.isFinite(x)||x<0||x>result.values.height)
  throw new RangeError("xは0≤x≤Lの範囲です。");
 return result.massFlow*Math.pow(x/result.values.height,.75);
}

export function renderCondensationFields(values=CONDENSATION_DEFAULTS){
 return condensationFields.map(([key,label,unit,min,max,help])=>
 `<label class="sim-field">${label}<span class="input-unit"><input type="number" name="${key}" value="${escapeCondensation(values[key])}" min="${key==="wall"||key==="saturation"?-273.149999:min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join("");
}

export function renderCondensationSteps(r){
 if(!r||r.error)return "";
 const v=r.values,F=fmtCondensation;
 return `<div class="simulation-steps"><p><strong>膜状凝縮：鉛直等温平板、平滑な層流液膜</strong></p>
 <details><summary>1. 現象と温度差</summary><p>静止・純粋な飽和蒸気T_sat=${F(v.saturation)}℃が、より冷たい等温壁T_w=${F(v.wall)}℃で凝縮します。ΔT=T_sat−T_w=${F(r.deltaT)} K。膜は上端から重力で流下し、下流で厚くなります。</p></details>
 <details><summary>2. Nusselt理論の熱伝達率</summary><p>平均h=(2√2/3)[gρ_l(ρ_l−ρ_v)h_fg k_l³/(μ_l L ΔT)]^(1/4)=${F(r.h)} W/(m²·K)。平均Nu=hL/k_l=${F(r.meanNu)}。局所液膜厚さ δ(x)=[4 μ_l k_l ΔT x/{gρ_l(ρ_l−ρ_v)h_fg}]^(1/4)。局所h(x)=k_l/δ(x)、上端x=0は数学的特異点なので有限値は表示しません。</p></details>
 <details><summary>3. 凝縮量と液膜の流動を確認</summary><p>面積A=LW=${F(r.area)} m²、熱流束q″=hΔT=${F(r.heatFlux)} W/m²、熱移動率Q̇=hAΔT=${F(r.watts)} W。凝縮質量流量ṁ≈Q̇/h_fg=${F(r.massFlow)} kg/s（${F(r.massFlowPerHour)} kg/h）。膜出口のRe_f=4ṁ/(Wμ_l)=${F(r.filmRe)}。膜出口厚さδ(L)=${F(r.filmThickness*1000)} mm。</p>
 <p>液膜のJakob数Ja=c_{p,l}ΔT/h_fg=${F(r.jakob)}。液膜に貯留される顕熱の影響は近似的に無視しています。Re_f≤30、Ja≤0.1のみ計算を許可します。</p></details>
 <small>適用条件：平滑な重力流下の波立たない薄い液膜、静止・純粋な飽和蒸気、等温の垂直平板、一定物性、熱は液膜内をほぼ伝導する。蒸気流によるせん断、非凝縮性ガス、波立ち、滴状凝縮、サブクール顕熱の精密計算、端部効果、液膜崩壊、自然対流との連成は含めません。物性は代表膜温度で別途評価してください。研究・機器設計への適用精度を保証しません。</small></div>`;
}

export function renderCondensationDiagram(r){
 if(!r||r.error)return "";
 const v=r.values,F=fmtCondensation,desc=`壁温${F(v.wall)}℃、飽和蒸気${F(v.saturation)}℃、液膜は下方ほど厚くなり、出口厚さ${F(r.filmThickness*1000)}mm。`;
 return `<figure class="simulation-figure"><svg class="sim-physical-diagram" role="img" viewBox="0 0 520 270" xmlns="http://www.w3.org/2000/svg"><title>鉛直等温平板の膜状凝縮</title><desc>${escapeCondensation(desc)}</desc>
 <rect x="95" y="40" width="50" height="180" class="diagram-solid"/><path d="M145 40 Q153 116 174 220 L145 220 Z" class="diagram-fluid"/>
 <path d="M182 70 L182 187 M174 178 L182 188 L190 178" class="diagram-arrow"/>
 <path d="M251 90 L155 90 M165 84 L155 90 L165 96" class="diagram-arrow"/>
 <text x="40" y="24" class="chart-label">等温壁</text><text x="196" y="24" class="chart-label">静止した飽和蒸気</text>
 <text x="20" y="249" class="chart-label">T<tspan dy="0.25em" font-size="0.72em">w</tspan><tspan dy="-0.18em">=${escapeCondensation(F(v.wall))} ℃</tspan></text>
 <text x="254" y="248" class="chart-label">T<tspan dy="0.25em" font-size="0.72em">sat</tspan><tspan dy="-0.18em">=${escapeCondensation(F(v.saturation))} ℃</tspan></text>
 <text x="200" y="132" class="chart-label">凝縮液膜</text><text x="203" y="166" class="chart-label">流下方向</text>
 <text x="325" y="205" class="chart-label">膜出口Re=${escapeCondensation(F(r.filmRe))}</text>
 </svg><figcaption>オリジナル模式図。横方向の厚さは実寸ではありません。実際は上端から下端へδ(x)∝x<sup>1/4</sup>で増大します。</figcaption></figure>`;
}

function condensationGraph(r,kind="thickness",compare=null){
 if(!r||r.error)return "";
 if(kind!=="thickness"&&kind!=="localH")return "";
 const other=compare&&!compare.error?compare:null;
 const W=560,H=252,L=70,R=20,T=20,B=54;
 const xs=Array.from({length:65},(_,i)=>kind==="localH"?.01+.99*i/64:i/64);
 const ys=(item)=>xs.map(u=>[u,kind==="thickness"?1000*filmThicknessAt(item,u*item.values.height):filmLocalCoefficient(item,u*item.values.height)]);
 const data=ys(r),extra=other?ys(other):null;
 const all=[...data,...(extra||[])].map(p=>p[1]);
 let yMin=Math.min(...all),yMax=Math.max(...all);
 if(yMax-yMin<1e-12){yMin-=.5;yMax+=.5}
 if(yMin>0)yMin=0;
 const xScale=u=>L+u*(W-L-R),yScale=y=>T+(yMax-y)/(yMax-yMin)*(H-T-B);
 const path=pts=>pts.map(([u,y],i)=>`${i?"L":"M"}${xScale(u).toFixed(2)},${yScale(y).toFixed(2)}`).join(" ");
 const ticks=[0,.5,1].map(f=>{const val=yMin+(yMax-yMin)*f;return `<line x1="${L}" y1="${yScale(val)}" x2="${W-R}" y2="${yScale(val)}" class="chart-grid"/><text x="${L-8}" y="${yScale(val)+4}" text-anchor="end" class="chart-label">${escapeCondensation(fmtCondensation(val))}</text>`}).join("");
 const label=kind==="thickness"?"凝縮液膜厚さ δ（mm）":"局所熱伝達率 hx（W/(m²·K)）";
 const desc=kind==="thickness"?"液膜厚さは上端0から下流へ増大":"局所熱伝達率は上端付近で大きく下流で減少。x/L=0の発散点は表示しない";
 return `<svg class="sim-chart" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg" aria-label="${escapeCondensation(label+"のグラフ。"+desc)}"><title>${escapeCondensation(label)}</title><desc>${escapeCondensation(desc)}</desc>${ticks}
 <path d="${path(data)}" class="chart-current"/>${extra?`<path d="${path(extra)}" class="chart-baseline"/>`:""}
 <text x="${L}" y="${H-29}" class="chart-label">0</text><text x="${W-R}" y="${H-29}" class="chart-label" text-anchor="end">1</text>
 <text x="${L+(W-R-L)/2}" y="${H-6}" text-anchor="middle" class="chart-label">鉛直位置 x/L（無次元）</text>
 <text x="15" y="${T+(H-T-B)/2}" transform="rotate(-90 15 ${T+(H-T-B)/2})" text-anchor="middle" class="chart-label">${escapeCondensation(label)}</text></svg>`;
}

export function condensationThicknessGraph(r,previous=null){return condensationGraph(r,"thickness",previous)}

export function condensationLocalGraph(r,previous=null){return condensationGraph(r,"localH",previous)}
