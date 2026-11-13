// Independently authored educational binary ideal-gas diffusion model: equimolar / stagnant B.

// Concentration and Stefan bulk flow are explicit; no textbook prose, figures or tables copied.

export const BINARY_GAS_R=8.31446261815324;

export const BINARY_DIFFUSION_DEFAULTS=Object.freeze({"regime":"stagnant","diffusivity":0.000025,"pressure":101325,"temperature":298.15,"thickness":0.002,"area":0.01,"yA1":0.3,"yA2":0.05,"molarMassA":0.018});

export const binaryDiffusionFields=Object.freeze([["diffusivity","二成分拡散係数 DAB","m²/s",1e-12,0.01,"混合気体の代表温度・圧力でのDAB"],["pressure","全圧 P","Pa",1000,5000000,"膜内部で一定と仮定"],["temperature","絶対温度 T","K",150,1500,"膜内部で等温"],["thickness","気体膜の厚さ L","m",0.000001,10,"z=0からz=Lまで"],["area","拡散面積 A","m²",0.000001,1000,"流束に掛けると全移動量になる"],["yA1","入口側のAモル分率 yA,1","無次元",0,0.95,"z=0でのAモル分率"],["yA2","出口側のAモル分率 yA,2","無次元",0,0.95,"z=LでのAモル分率"],["molarMassA","成分Aのモル質量 MA","kg/mol",0.001,0.5,"質量換算にのみ用いる"]]);

export const binaryDiffusionFieldNames=Object.freeze(binaryDiffusionFields.map(f=>f[0]));

const binaryEsc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

const binaryFmt=n=>Number(n).toLocaleString("ja-JP",{maximumSignificantDigits:7});

function binaryParse(raw){
 if(typeof raw!=="number"&&typeof raw!=="string")return NaN;
 const s=String(raw).trim();
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return NaN;
 const n=Number(s);return Number.isFinite(n)?n:NaN;
}

export function binaryDiffusionLogGradient(y1,y2){
 if(![y1,y2].every(x=>Number.isFinite(x)&&x>=0&&x<1))throw new RangeError("モル分率は0以上1未満としてください。");
 return Math.log1p(-y2)-Math.log1p(-y1);
}

export function calculateBinaryDiffusion(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return {error:"二成分気体膜モデルの入力を確認してください。"};
 if(raw.regime!=="equimolar"&&raw.regime!=="stagnant")return {error:"拡散形式を「等モル相互拡散」または「B静止」から選んでください。"};
 const v={regime:raw.regime};
 for(const [key,label,unit,min,max] of binaryDiffusionFields){
  const x=binaryParse(raw[key]);
  if(!Number.isFinite(x))return {error:`${label}には有限の十進数を入力してください。`};
  if(x<min||x>max)return {error:`${label}は${min}〜${max} ${unit}の範囲です。`};
  v[key]=x;
 }
 const totalConcentration=v.pressure/(BINARY_GAS_R*v.temperature);
 const concentrationA1=totalConcentration*v.yA1,concentrationA2=totalConcentration*v.yA2;
 const diff=v.yA1-v.yA2,logGradient=binaryDiffusionLogGradient(v.yA1,v.yA2);
 const coefficient=v.diffusivity*totalConcentration/v.thickness;
 const equimolarFlux=coefficient*diff,stagnantFlux=coefficient*logGradient;
 const fluxA=v.regime==="equimolar"?equimolarFlux:stagnantFlux;
 const fluxB=v.regime==="equimolar"?-fluxA:0;
 const bulkFlux=fluxA+fluxB;
 const molarRateA=fluxA*v.area,massFluxA=fluxA*v.molarMassA,massRateA=molarRateA*v.molarMassA;
 const bLogMean=Math.abs(diff)<1e-15?1-v.yA1:diff/logGradient;
 const enhancement=Math.abs(diff)<1e-15?null:logGradient/diff;
 const coefAEquimolar=v.diffusivity/v.thickness; // velocity-form flux coefficient for concentration
 const coefAStagnant=coefAEquimolar/bLogMean;
 const result={values:v,totalConcentration,concentrationA1,concentrationA2,coefficient,
  equimolarFlux,stagnantFlux,fluxA,fluxB,bulkFlux,molarRateA,massFluxA,massRateA,
  bLogMean,enhancement,coefAEquimolar,coefAStagnant,logGradient};
 if(Object.values(result).filter(x=>typeof x==="number").some(x=>!Number.isFinite(x)))return {error:"計算結果が数値範囲外です。"};
 return result;
}

export function binaryDiffusionMoleFractionAt(r,u,regime=r?.values?.regime){
 if(!r||r.error||!Number.isFinite(u)||u<0||u>1||(regime!=="equimolar"&&regime!=="stagnant"))
  throw new RangeError("0≤z/L≤1、かつ有効な拡散形式を指定してください。");
 const y1=r.values.yA1,y2=r.values.yA2;
 if(u===0)return y1;
 if(u===1)return y2;
 if(regime==="equimolar")return y1+(y2-y1)*u;
 return -Math.expm1(Math.log1p(-y1)+u*r.logGradient);
}

export function binaryDiffusionFluxComponentsAt(r,u){
 const y=binaryDiffusionMoleFractionAt(r,u);
 const total=r.bulkFlux;
 return {yA:y,yB:1-y,
  molarFluxA:r.fluxA,molarFluxB:r.fluxB,totalMolarFlux:total,
  diffusiveFluxA:r.fluxA-y*total,diffusiveFluxB:r.fluxB-(1-y)*total,
  convectiveFluxA:y*total,convectiveFluxB:(1-y)*total};
}

export function renderBinaryDiffusionFields(v=BINARY_DIFFUSION_DEFAULTS){
 const select=`<label class="sim-field"><span class="sim-field-caption">拡散形式</span><span class="input-unit"><select name="regime"><option value="equimolar"${v.regime==="equimolar"?" selected":""}>等モル相互拡散（NA=−NB）</option><option value="stagnant"${v.regime==="stagnant"?" selected":""}>B静止の拡散（NB=0）</option></select></span><small>相互拡散と、成分Bに正味移動がない場合を比較</small></label>`;
 return select+binaryDiffusionFields.map(([key,label,unit,min,max,help])=>
 `<label class="sim-field"><span class="sim-field-caption">${label}</span><span class="input-unit"><input type="number" name="${key}" value="${binaryEsc(v[key])}" min="${min}" max="${max}" step="any" inputmode="decimal" required/><i>${unit}</i></span><small>${help}</small></label>`).join("");
}

export function renderBinaryDiffusionSteps(r){
 if(!r||r.error)return "";
 const v=r.values,F=binaryFmt;
 const regime=v.regime==="equimolar"?"等モル相互拡散：NA=−NB、全モル流束0":"B静止の拡散：NB=0、Aの流れに伴う全モル流束NA";
 const eq=v.regime==="equimolar"?"NA=C DAB(yA,1−yA,2)/L":"NA=C DAB/L×ln[(1−yA,2)/(1−yA,1)]";
 return `<div class="simulation-steps"><p><strong>第11章：二成分気体の定常分子拡散</strong></p>
 <details><summary>1. 混合物のモル分率・濃度</summary><p>理想気体の全モル濃度C=P/(RT)=${F(r.totalConcentration)} mol/m³。両端のAモル分率はyA,1=${F(v.yA1)}、yA,2=${F(v.yA2)}。気体膜の厚さL=${F(v.thickness)} mで、Aの移動の正方向はz=0→z=L。</p></details>
 <details><summary>2. Fickの法則と正味成分流束</summary><p>${regime}。局所的には NA=−C DAB dyA/dz+yA(NA+NB) に従います。${eq}。計算値はNA=${F(r.fluxA)} mol/(m²·s)、NB=${F(r.fluxB)} mol/(m²·s)、全モル流束N=${F(r.bulkFlux)} mol/(m²·s)。正負は拡散方向を示し、符号を絶対値には変えません。</p>
 <p>B静止の場合には対流によるAの輸送が加わり、同じ両端組成の等モル相互拡散より|NA|が通常大きくなります。気体Bの対数平均分率yB,lm=${F(r.bLogMean)}。${r.enhancement===null?"両端組成が等しいため、両モデルの流束は0。流束の比は定義しません。":"同じ濃度境界でのB静止/等モルの流束比="+F(r.enhancement)+"。"}</p></details>
 <details><summary>3. 流束から移動速度と質量へ</summary><p>面積A=${F(v.area)} m²でのAモル移動速度 NA A=${F(r.molarRateA)} mol/s。A質量流束=${F(r.massFluxA)} kg/(m²·s)、質量移動速度=${F(r.massRateA)} kg/s。質量への換算にはMA=${F(v.molarMassA)} kg/molを用いています。</p></details>
 <small>一次元・定常、理想気体、等温・等圧、一定DAB・断面積、二成分、化学反応や膜内発生なし。等モル相互拡散・B静止は異なる境界条件です。液体拡散、乱流混合・気液平衡、凝縮、膜内圧力勾配、Stefan–Maxwellの多成分拡散は扱いません。極端に濃いAに対する拡散モデルの数値発散を避けるためyA≤0.95に制限しました。</small></div>`;
}

export function renderBinaryDiffusionDiagram(r){
 if(!r||r.error)return "";
 const v=r.values,F=binaryFmt,forward=r.fluxA>=0;
 const arrowA=forward?"M175 110 L335 110 M325 103 L335 110 L325 117":"M335 110 L175 110 M185 103 L175 110 L185 117";
 const arrowB=v.regime==="stagnant"?"":forward?"M335 155 L175 155 M185 148 L175 155 L185 162":"M175 155 L335 155 M325 148 L335 155 L325 162";
 const desc=`膜の両端Aモル分率${F(v.yA1)}と${F(v.yA2)}。Aの正味移動方向は${forward?"右":"左"}。Bは${v.regime==="stagnant"?"正味静止":"Aと逆向きに等モル移動"}。`;
 return `<figure class="simulation-figure"><svg role="img" class="sim-physical-diagram" viewBox="0 0 520 225" xmlns="http://www.w3.org/2000/svg"><title>二成分気体膜の分子拡散模式図</title><desc>${binaryEsc(desc)}</desc><rect x="172" y="50" width="168" height="140" class="diagram-fluid"/><path d="${arrowA}" class="diagram-arrow"/><path d="${arrowB}" class="diagram-arrow"/><text x="9" y="74" class="chart-label">z=0</text><text x="400" y="74" class="chart-label">z=L</text><text x="190" y="39" class="chart-label">等温・等圧の気体膜</text><text x="196" y="98" class="chart-label">Aの正味流束</text><text x="196" y="183" class="chart-label">${v.regime==="stagnant"?"Bは正味静止":"Bは逆方向に拡散"}</text><text x="8" y="207" class="chart-label">yA,1=${binaryEsc(F(v.yA1))}</text><text x="375" y="207" class="chart-label">yA,2=${binaryEsc(F(v.yA2))}</text></svg><figcaption>独自の概念図。実際の組成分布は濃度グラフに示します。矢印は分子の個々の運動ではなく、正味流束です。</figcaption></figure>`;
}

function binaryDiffusionGraph(r,series,desc,xlabel,ylabel){
 const W=560,H=260,l=78,rr=20,t=18,b=58;
 const all=series.flatMap(s=>s.points.map(p=>p[1]));
 let vMin=Math.min(...all),vMax=Math.max(...all);if(vMax-vMin<1e-12){vMin-=.05;vMax+=.05}
 if(vMin>0)vMin=0;
 const xx=u=>l+u*(W-l-rr),yy=y=>t+(vMax-y)/(vMax-vMin)*(H-t-b);
 const path=pts=>pts.map(([x,y],i)=>`${i?"L":"M"}${xx(x).toFixed(2)},${yy(y).toFixed(2)}`).join(" ");
 const ticks=[0,.5,1].map(f=>{const y=vMin+(vMax-vMin)*f;return `<line x1="${l}" y1="${yy(y)}" x2="${W-rr}" y2="${yy(y)}" class="chart-grid"/><text x="${l-6}" y="${yy(y)+4}" text-anchor="end" class="chart-label">${binaryEsc(binaryFmt(y))}</text>`}).join("");
 return `<svg role="img" class="sim-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" aria-label="${binaryEsc(desc)}"><title>${binaryEsc(desc)}</title><desc>${binaryEsc("実線=選択形式、比較線=もう一方の形式。"+desc)}</desc>${ticks}
 ${series.map((s,i)=>`<path d="${path(s.points)}" class="${i===0?"chart-current":"chart-baseline"}"/>`).join("")}
 <text x="${l}" y="${H-35}" class="chart-label">0</text><text x="${W-rr}" y="${H-35}" text-anchor="end" class="chart-label">1</text><text x="${l+(W-l-rr)/2}" y="${H-11}" text-anchor="middle" class="chart-label">${binaryEsc(xlabel)}</text><text x="15" y="${t+(H-t-b)/2}" text-anchor="middle" transform="rotate(-90 15 ${t+(H-t-b)/2})" class="chart-label">${binaryEsc(ylabel)}</text></svg>`;
}

export function binaryDiffusionProfileGraph(r){
 if(!r||r.error)return "";
 const mode=r.values.regime,other=mode==="equimolar"?"stagnant":"equimolar";
 const samples=m=>Array.from({length:81},(_,i)=>[i/80,binaryDiffusionMoleFractionAt(r,i/80,m)]);
 return binaryDiffusionGraph(r,[{points:samples(mode)},{points:samples(other)}],
 `Aのモル分率分布。選択した${mode==="equimolar"?"等モル相互拡散":"B静止の拡散"}と比較形式を同条件で表示。`,"位置 z/L（無次元）","Aのモル分率 yA");
}

export function binaryDiffusionBoundaryGraph(r){
 if(!r||r.error)return "";
 const v=r.values;
 const flux=(mode,u)=>{
  const f=calculateBinaryDiffusion({...v,regime:mode,yA1:.95*u});
  return f.error?NaN:f.fluxA;
 };
 const selected=v.regime,other=selected==="equimolar"?"stagnant":"equimolar";
 const samples=mode=>Array.from({length:81},(_,i)=>[i/80,flux(mode,i/80)]);
 const main=samples(selected),alt=samples(other);
 return binaryDiffusionGraph(r,[{points:main},{points:alt}],
 `入口モル分率に対する成分A流束。出口yA,2=${binaryFmt(v.yA2)}で固定。横軸の1は入口yA,1=0.95に対応。`,"入口モル分率 yA,1（横軸1は0.95）","成分A流束 NA（mol/(m²·s)）");
}
