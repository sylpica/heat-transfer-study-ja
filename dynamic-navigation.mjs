// Stable, allowlisted links. No translation or question data is modified.
// Section-to-experiment grounds are recorded in docs/dynamic/LINKAGE_EXPAND_20261107.md.
const sections=Object.freeze({'2.1':['heating','熱伝導の温度分布'],'2.2':['heating','平板の過渡加熱'],'2.3':['radial','円筒の熱抵抗と温度分布'],'4.5':['fin','断熱先端フィン'],'5.2':['cooling','対流冷却と集中熱容量の応答'],'5.3':['heating','平板の非定常熱伝導'],'5.4':['radial','円筒・球の非定常熱伝導'],'5.5':['radial','円筒・球の温度応答'],'5.7':['heating','定常2次元熱伝導の温度分布'],'5.8':['heating','2D熱伝導'],'7.2':['channel','発達した流路の速度と熱の移動'],'7.4':['channel','流路のバルク温度の変化'],'7.5':['channel','平行平板流路の熱伝達'],'10.1':['network','灰色面の動的放射'],'10.3':['network','閉じた面の放射熱交換'],'10.4':['network','灰色体間の放射熱交換']});
export function readerSectionFromHash(hash,sectionIds){const match=/^#reader\/(\d{1,2}\.\d{1,2})$/.exec(hash);return match&&sectionIds.includes(match[1])?match[1]:'';}
export function dynamicLinkForSection(id){const entry=Object.hasOwn(sections,id)?sections[id]:null;if(!entry)return null;const [preset,label]=entry,page=preset==='radial'?'radial.html':preset==='channel'?'channel.html':preset==='network'?'radiation.html':'index.html';return {href:`./dynamic/${page}?preset=${preset}&section=${id}`,label:`動的実験：${label}`,sectionId:id};}
export function sectionContextFromSearch(search,preset){const p=new URLSearchParams(search),id=p.get('section');return p.getAll('section').length===1&&p.getAll('preset').length===1&&p.get('preset')===preset&&Object.hasOwn(sections,id)&&sections[id][0]===preset?id:'';}
export function fingerprintCheck(value){let h=2166136261;for(const ch of value){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
// Question-to-simulation handoffs. A link is offered only while the question's
// revision and content fingerprint match the registered values, so a changed
// problem silently loses its handoff instead of launching stale conditions.
// Only the problem's conditions are transferred, never its answer or explanation.
const questionCases=Object.freeze({
 'supp-deep-fin-base-heat-v1':{revision:'v1',fingerprint:'2ded6059',caseId:'fin-base-v1',label:'この条件のフィンを動的実験で観察する',sectionId:'4.5'},
 'supp-deep-semi-profile-v1':{revision:'v1',fingerprint:'31e3ca72',caseId:'semi-profile-v1',label:'この条件の平板加熱を動的実験で観察する',sectionId:'5.6'},
 'supp-deep-heat-generation-center-v1':{revision:'v1',fingerprint:'d4593ec8',caseId:'gen-center-v1',label:'この条件の発熱平板を動的実験で観察する',sectionId:'2.1'},
 'supp-next-combined-surface-loss-v1':{revision:'v1',fingerprint:'11a4100d',caseId:'combined-loss-v1',label:'この条件の表面放熱を動的実験で観察する',sectionId:'1.3'},
 'supp-deep-rad-netflux-v1':{revision:'v1',fingerprint:'f6d7b1c1',caseId:'rad-netflux-v1',label:'この条件の放射冷却を動的実験で観察する',sectionId:'10.1'},
 'supp-transient-gap-sphere-lumped-length-v1':{revision:'v1',fingerprint:'b1f1b9d6',caseId:'sphere-lumped-v1',page:'radial.html',label:'この条件の球の冷却を動的実験で観察する',sectionId:'5.1'},
 'supp-gray-parallel-flux-v1':{revision:'v1',fingerprint:'ec478eed',caseId:'gray-parallel-v1',page:'radiation.html',label:'この条件の放射交換を動的実験で観察する',sectionId:'10.4'},
 'supp-batch2-blackbody-two-surfaces-v1':{revision:'v1',fingerprint:'69c6af9f',caseId:'blackbody-two-v1',page:'radiation.html',label:'この条件の放射交換を動的実験で観察する',sectionId:'10.3'}});
export function dynamicLinkForQuestion(question,fingerprint){const entry=question&&Object.hasOwn(questionCases,question.id)?questionCases[question.id]:null;if(!entry||question.revision!==entry.revision||typeof fingerprint!=='string'||fingerprintCheck(fingerprint)!==entry.fingerprint)return null;return {href:`./dynamic/${entry.page||'index.html'}?case=${entry.caseId}`,label:entry.label,sectionId:entry.sectionId};}
const launchCases=Object.freeze({
 'fin-base-v1':{preset:'fin',sectionId:'4.5',fields:{width:.1,height:.01,depth:.01,k:200,rho:2700,cp:896,initial:20,'boundary-temperature':80,h:25},description:'断熱先端フィンの問題条件：L=0.10 m、断面0.01×0.01 m（Ac=1.0×10⁻⁴ m²、周長P=0.040 m）、k=200 W/(m·K)、h=25 W/(m²·K)、温度差60 K。設問は定常です。動的な観察では周囲20℃・基部80℃・初期20℃とし、設問にないρ=2700 kg/m³・cp=896 J/(kg·K)を仮定しています。時間軸はこの補足条件によるもので、設問の答えではありません。'},
 'semi-profile-v1':{preset:'heating',sectionId:'5.6',fields:{width:.1,height:.05,depth:.005,k:2,rho:2000,cp:1000,initial:20,'boundary-temperature':80},description:'半無限固体の問題条件：初期温度20 ℃、表面温度80 ℃、熱拡散率α=1.0×10⁻⁶ m²/s。動的な観察では半無限固体を厚さ0.10 mの有限平板で近似しています。表面温度を固定した温度場はαのみで決まるため、物性はαが一致するk=2.0 W/(m·K)、ρ=2000 kg/m³、cp=1000 J/(kg·K)の組を仮定しています。温度の浸透が背面（深さ0.10 m）に達するまでの時間範囲では半無限の解と対応しますが、それ以降は有限厚さの影響が出ます。設問は解析解による温度で、動的な観察は答えではありません。'},
 'gen-center-v1':{preset:'heating',sectionId:'2.1',fields:{width:.02,height:.05,depth:.005,k:20,rho:1000,cp:1000,initial:30,'boundary-temperature':30,source:80000},description:'内部発熱平板の問題条件：両面温度30 ℃、厚さ0.040 m、k=20 W/(m·K)、発熱率8.0×10⁴ W/m³。動的な観察では対称性を使い、左面を表面（30 ℃固定）、右面を中心面（断熱）とする半厚さ0.020 mのモデルに置き換えています。ρとcpは設問にないため仮定値で、到達する定常状態はこの仮定に依存しません。設問は定常の中心温度で、動的な観察は答えではありません。'},
 'combined-loss-v1':{preset:'heating',sectionId:'1.3',fields:{width:.01,height:.5,depth:1,k:200,rho:2700,cp:900,initial:46.85,boundary:'convection-radiation','boundary-temperature':26.85,'radiation-temperature':26.85,h:10,emissivity:.8},description:'一様面の放熱の問題条件：面の温度320 K（46.85 ℃）、流体と十分大きな黒体囲いはともに300 K（26.85 ℃）、h=10 W/(m²·K)、ε=0.8、面の面積0.50 m²。動的な観察では、この面を左面とする薄板（左面の面積0.50 m²）の初期状態として置き、対流と放射の内訳を共通の表面温度で解きます。固体の物性は設問にないため、面がほぼ一様温度に保たれる材質を仮定しています。設問は一様面の瞬時の収支で、動的な観察（固体が冷えていく過程）は答えではありません。'},
 'rad-netflux-v1':{preset:'radiation',sectionId:'10.1',fields:{width:.02,height:.05,depth:.005,k:200,rho:2700,cp:900,initial:126.85,'boundary-temperature':26.85,emissivity:.8},description:'灰色面の放射の問題条件：面の温度400 K（126.85 ℃）、大きな黒体囲い300 K（26.85 ℃）、ε=0.8。動的な観察では、全表面が囲いを見込む薄板の初期状態として置き、単位面積当たりの流束で対応させています。固体の物性は設問にないため仮定値で、冷却の進み方だけに効きます。設問は面の瞬時の正味流束で、動的な観察は答えではありません。'}});
export function thermalLaunchFromSearch(search){
 const p=new URLSearchParams(search);if(![...p.keys()].length)return null;
 if([...p.keys()].some(k=>!['preset','section','case'].includes(k)||p.getAll(k).length!==1))throw Error('受け取った実験条件の形式に対応していません。標準実験を準備しました。');
 if(p.has('case')){const entry=Object.hasOwn(launchCases,p.get('case'))?launchCases[p.get('case')]:null;if(!entry||p.has('preset')||p.has('section'))throw Error('この問題の実験条件には対応していません。標準実験を準備しました。');return {preset:entry.preset,sectionId:entry.sectionId,caseId:p.get('case'),fields:{...entry.fields},description:entry.description};}
 const preset=p.get('preset'),sectionId=p.get('section');if(!['heating','cooling','fin','radiation'].includes(preset)||sectionId&&sections[sectionId]?.[0]!==preset)throw Error('受け取った教材・実験の組み合わせには対応していません。標準実験を準備しました。');
 return {preset,sectionId:sectionId||'',description:'教材に関連する代表実験を開きました。数値はアプリの初期設定で、教材内の例題の条件を複製したものではありません。'};
}
// Case intake for the other lab pages (radial / channel / radiation network).
// Same strictness as the thermal lab: a handoff is accepted only as a single
// case parameter naming a case registered for that page. Section arrivals
// (preset/section parameters) are not case handoffs and return null; the
// section context banner handles them separately. Field keys are the target
// page's form input ids; network surfaces use absolute temperatures [K] and
// feed the page's populate() directly. Only the problem's conditions are
// transferred, never its answer or explanation.
const pageCases=Object.freeze({
 channel:Object.freeze({}),
 radial:Object.freeze({
  'sphere-lumped-v1':{sectionId:'5.1',fields:{analysis:'lumped',geometry:'sphere',radius:.03,k:5,rho:1000,cp:1000,initial:80,boundary:'convection','boundary-temperature':20,h:10,source:0,interval:100},description:'球の集中近似の問題条件：半径R=0.030 m、k=5.0 W/(m·K)、全面の対流h=10 W/(m²·K)。動的な観察では温度のモデルとして集中熱容量近似を選んでいます。画面の診断に表示されるBi=h(V/A)/kが、この条件で集中近似が使えるかの目安です。設問にないρ=1000 kg/m³、cp=1000 J/(kg·K)、初期温度80 ℃、流体温度20 ℃と表示の時間刻みは仮定で、冷却の進み方だけに効き、Biの値と集中近似の成否はこの仮定に依存しません。設問はBiの値で、動的な観察は答えではありません。'}}),
 network:Object.freeze({
  'gray-parallel-v1':{sectionId:'10.4',surfaces:[{temperature:400,emissivity:.8,area:1,capacity:200,power:0},{temperature:300,emissivity:.6,area:1,capacity:200,power:0}],viewFactors:[[0,1],[1,0]],description:'大きな平行灰色面の問題条件：T₁=400 K、T₂=300 K、ε₁=0.80、ε₂=0.60、二面は互いだけを見込みます。動的な観察では単位面積（1 m²）当たりに直した二面で置き、面の温度は時間とともに近づいていきます。設問が扱う瞬時の交換に対応するのは初期状態の正味放射です。熱容量は設問にないため仮定値で、初期の交換量には影響しません。設問は面積当たりの流束で、動的な観察は答えではありません。'},
  'blackbody-two-v1':{sectionId:'10.3',surfaces:[{temperature:400,emissivity:1,area:1,capacity:200,power:0},{temperature:300,emissivity:1,area:1,capacity:200,power:0}],viewFactors:[[.2,.8],[.8,.2]],description:'二つの黒体の問題条件：A₁=1 m²、F₁₂=0.80、T₁=400 K、T₂=300 K、ε₁=ε₂=1。動的な観察では二面だけの閉じた囲いに置くため、設問にないA₂=1 m²を補い、相反則と総和則を満たすF₂₁=0.80、F₁₁=F₂₂=0.20を補足条件として置きました。黒体では面1の正味放射はA₁とF₁₂で決まる部分だけが効くため、この補足に依存しません。熱容量は設問にないため仮定値です。面の温度は時間とともに近づいていき、設問の交換量に対応するのは初期状態の正味放射です。設問は熱移動率で、動的な観察は答えではありません。'}})});
export function caseLaunchFromSearch(page,search){
 const table=page&&Object.hasOwn(pageCases,page)?pageCases[page]:null;if(!table)throw Error('この画面には問題の実験条件の受け口がありません。');
 const p=new URLSearchParams(search);if(!p.has('case'))return null;
 if([...p.keys()].length!==1||p.getAll('case').length!==1)throw Error('受け取った実験条件の形式に対応していません。標準実験を準備しました。');
 const entry=Object.hasOwn(table,p.get('case'))?table[p.get('case')]:null;if(!entry)throw Error('この問題の実験条件には対応していません。標準実験を準備しました。');
 const launch={page,caseId:p.get('case'),sectionId:entry.sectionId,description:entry.description};
 if(entry.fields)launch.fields={...entry.fields};
 if(entry.surfaces){launch.surfaces=entry.surfaces.map(s=>({...s}));launch.viewFactors=entry.viewFactors.map(row=>[...row]);}
 return launch;
}
