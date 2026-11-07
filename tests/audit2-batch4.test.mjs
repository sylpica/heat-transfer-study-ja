// Regression tests for audit phase B-3 (register batch 4: teaching-material
// omissions). Each test names its finding ID. Content assertions read the
// published JSON directly and pin that the drafted, original-verified material
// is actually incorporated into the lessons (a diagram alone does not count).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeLearningData,validateLearningData,createEmptyState} from '../study-core.mjs';
import {renderTermLinks} from '../term-links.mjs';

const read=async file=>JSON.parse(await readFile(new URL('../'+file,import.meta.url),'utf8'));
const [lessonsData,glossary,questions]=await Promise.all([
  read('data/original-deep-lessons.json'),read('data/glossary.json'),read('data/questions.json')]);
const lesson=id=>lessonsData.lessons.find(l=>l.sectionId===id);
const lessonText=id=>{const l=lesson(id);return l.blocks.map(b=>b.heading+'\n'+b.text).join('\n')+'\n'+l.equations.map(e=>e.label+' '+e.expression+' '+e.meaning).join('\n');};
const hasBlock=(id,heading)=>lesson(id).blocks.some(b=>b.heading===heading);

// [findingId, sectionId, firstBlockHeading] — headings are integrated verbatim.
const ITEMS=[
 ["R1-M01","1.1","エネルギーのスケール感：人間は持続出力で1 kWに届かない"],
 ["R1-M02","1.2","有限な温度差の熱移動は必ずエントロピーを生成する"],
 ["R1-M03","1.3","集中熱容量法と時定数：温度差は指数関数で減る"],
 ["R1-M04","2.1","熱伝導方程式の円筒座標形・球座標形：Laplacian の形が変わる"],
 ["R1-M05","2.2","熱伝導問題の解法8ステップ"],
 ["FC-07/R1-M06","2.3","臨界断熱半径（円筒）：断熱材を巻くと熱損失が増えることがある"],
 ["R1-M07","2.3","放射熱抵抗の線形化：h_rad を T_m 基準で定義する"],
 ["R1-M08","3.1","熱交換器の3つの基本形式：並流・向流、シェル＆チューブ、直交流"],
 ["R1-M09","3.2","温度効率 P と温度比 R：補正係数 F を読むための二つの無次元数（§3.2）"],
 ["R2-4.1-02","4.1","初期条件の例外：境界条件に拘束されず、不要な場合もある"],
 ["R2-4.1-03","4.1","個数規則：各座標につき境界条件は2つ必要"],
 ["R2-4.2-01","4.2","変数分離法の位置づけ：非定常問題の一般解を得る方法"],
 ["R2-4.2-02","4.2","2次元定常の変数分離と例題4.1：正弦波境界の指数減衰"],
 ["R2-4.2-03","4.2","円筒座標への拡張：接線（周）方向伝導とリングの一般解"],
 ["R2-4.2-04","4.2","空間的に一様なT(t)：式（4.2）–（4.4）と集中容量への接続"],
 ["R2-4.3-01","4.3","ΓとΦの概念：無次元温度Θを発熱スケールで組み替える"],
 ["R2-4.3-02","4.3","Π定理の2つの留保と例題4.2・4.3への適用"],
 ["R2-4.3-03","4.3","例題4.4・4.5と『変換し合う次元』の注意"],
 ["R2-4.4-02","4.4","例題4.7の無次元化：8変数から5つのπグループへ"],
 ["R2-4.4-04","4.4","退化ケースT1=T2：次元解析をやり直して得る（4.26）型の扱い"],
 ["R2-4.5-02","4.5","フィン熱抵抗Rt,finの式と例題4.9（抵抗器リード線）"],
 ["R2-4.5-03","4.5","変断面フィン：一般方程式（4.59）と適用条件"],
 ["R2-4.5-05","4.5","無限長フィンの明示式Θ=e^(−mx)と基部熱流量Q0、mLの目安"],
 ["R2-5.1-01","5.1","次元解析による Θ=fn(ξ, Bi, Π4) の導出"],
 ["R2-5.2-01","5.2","周囲温度が直線的に変化する場合の解"],
 ["R2-5.2-02","5.2","接触抵抗を介する2次集中容量系のモデル"],
 ["R2-5.2-03","5.2","電気・機械アナロジー： RC 回路との対応"],
 ["R2-5.3-01","5.3","第1種境界条件の級数解： 固有値 λ̂n=nπ/2"],
 ["R2-5.4-02","5.4","交流加熱による温度振動（例題5.3 型）"],
 ["R2-5.5-02","5.5","円柱・球の一項係数（Table 5.2 の代表値）"],
 ["R2-5.6-01","5.6","半無限固体の第3種境界条件の解（式 (5.53)）"],
 ["R2-5.6-02","5.6","半無限固体の第2種境界条件の解（式 (5.55)）"],
 ["R2-5.6-04","5.6","2つの半無限体の接触温度（式 (5.60)）"],
 ["R2-5.6-05","5.6","調和振動境界の解（式 (5.62)）と例題5.7"],
 ["R2-5.7-01","5.7","伝導形状係数 S の定義"],
 ["R2-5.7-02","5.7","フラックスプロットの作図法"],
 ["R2-5.8-01","5.8","短い円柱の積解： 平板×円柱"],
 ["R2-5.8-02","5.8","1/8無限領域（直方体の角部）の積解"],
 ["R3-M-01","6.5","低 Pr では Péclet 数で整理する"],
 ["R3-M-02","6.9","遷移域は冪乗で近似する"],
 ["R3-M-03","7.2","Graetz 数は3群を1つにまとめる"],
 ["R3-M-05","7.6","管群では最大速度で Re を取る"],
 ["R4-8-006","8.2","膜凝縮と自然対流の支配方程式系（式8.3–8.5）"],
 ["R4-8-007","8.3","全 Ra 用の Churchill–Chu 式（8.13b）：乱流域の受け皿"],
 ["R4-8-008","8.3","Squire–Eckert 古典理論の §8.3 としての位置づけ"],
 ["R4-8-009","8.4","水平円柱の全域式（8.29）と層流式（8.28）"],
 ["R4-8-010","8.4","傾斜板の処方：g cos θ への置き換えと安定・不安定の区別"],
 ["R4-8-011","8.5","Π4 と Ja の定義：膜凝縮の次元解析の体系"],
 ["R4-8-012","8.5","円錐（8.69）と回転円盤（8.70）：有効重力の適用例"],
 ["FC-37","9.2","Rohsenow相関（式9.4）：核沸騰熱流束の実用相関"],
 ["FC-41/R4-9-102","9.3","有限形状の q_max：特性長 L′ と Table 9.3 の形状係数"],
 ["R4-9-103","9.9","膜厚関係式（9.53）：強制対流凝縮の出発点となる式そのもの"],
 ["R4-9-104","9.10","滴状凝縮の機構と定量値：膜状の約10倍、h≈200,000 W/m²K"],
 ["R4-9-105","9.7","過冷却の定量的傾向：q_max・q_min は ΔT_sub とともに直線的に増える"],
 ["R4-9-106-9.4","9.4","鉛直面の代替処方：Leonard–Sun–Dix の λ_d1/√3 置き換え"],
 ["R4-9-106-9.6","9.6","遷移沸騰の不安定性と接触角への異常な感度"],
 ["R4-9-107","9.11","メリット数 M の目安範囲：約10¹⁰〜10¹² kg/s³"],
 ["R5-10-007","10.3","最後の手段は積分式 (10.17a)：定義から直接求める"],
 ["R5-10-010","10.4","三面以上の囲いはラジオシティ節点の連立方程式で解く"],
 ["R5-10-005","10.5","気体放射の工学計算の全体手順（Hottel の枠組み）"],
 ["R5-10-006","10.5","分子は決まった波長帯でだけ吸収・放出する"],
 ["R5-10-008","10.6","太陽定数1361 W/m² と太陽の有効温度5772 K"],
 ["R5-10-009","10.6","天空温度 T_sky：大気を有効温度の黒体放射体とみなす"],
 ["FC-47","11.4","ラウールの法則 (11.45)：液がその成分に富む側の近似"],
 ["R5-11-009","11.3","拡散係数の代表値：気体10⁻⁵級・液体10⁻⁹級・固体は広い範囲"],
 ["R5-11-007","11.10","Chapman–Enskog 式 (11.108)：気体二成分拡散係数の推算"],
 ["R5-11-008","11.9","蒸散冷却：壁温は冷却材のリザーバ温度へ指数関数的に近づく"],
 ["R5-11-010","11.8","逆浸透の濃度分極：膜面に塩が蓄積する機構"],
];
for(const [id,section,heading] of ITEMS){
  test(`batch4 ${id}: lesson ${section} incorporates the omitted material`,()=>{
    assert.ok(lesson(section),`lesson ${section} exists`);
    assert.ok(hasBlock(section,heading),`${id}: block "${heading}" present in lesson ${section}`);
  });
}

test('batch4 R1-M09 split: P-NTU block and eq. (3.24) live in lesson 3.3',()=>{
  assert.ok(hasBlock('3.3','P-NTU法：P を流体ごとに与える一般化されたNTU法（原典では§3.3）'));
  assert.match(lessonText('3.3'),/\(3\.24\)/);
  assert.match(lessonText('3.2'),/\(3\.14\)/);
});

test('batch4 FC-37: Rohsenow content pins (Csf table, accuracy, gravity warning)',()=>{
  const t=lessonText('9.2');
  assert.match(t,/Rohsenow/);
  assert.match(t,/Csf/);
  assert.match(t,/0\.013/); // water-copper Csf (Table 9.2, verified in the original)
  assert.match(t,/100%/);   // typical heat-flux error stated by the book itself
  assert.match(t,/25%/);    // typical ΔT error
  assert.match(t,/g\^\(1\/2\)|√g|重力/);
});

test('batch4 P2 formulas present: (5.53), shape factor, tube banks, three-surface',()=>{
  assert.match(lessonText('5.6'),/erfc/);
  assert.match(lessonText('5.7'),/Q=kSΔT|Q = k S ΔT/);
  assert.match(lessonText('5.7'),/4πR/);
  assert.match(lessonText('7.6'),/Žukauskas|Zukauskas/);
  assert.match(lessonText('10.4'),/ラジオシティ|節点/);
  assert.match(lessonText('2.3'),/r_crit|臨界半径/);
});

test('batch4 R3-I-06: new §6.8 question uses (6.112), totals become 751',()=>{
  assert.equal(questions.length,751);
  const q=questions.find(x=>x.id==='supp-turbulent-local-powerlaw-v1');
  assert.ok(q,'new question exists');
  assert.equal(q.answer,3);
  assert.equal(q.choices.length,4);
  const Re=1e6,Pr=0.71;
  const expected=0.0296*Math.pow(Re,0.8)*Math.pow(Pr,0.6); // (6.112) gases
  const stated=Number(q.choices[q.answer].replace(/[^\d.]/g,''));
  assert.ok(Math.abs(stated-expected)/expected<0.01,`stated ${stated} vs recomputed ${expected}`);
  const liquid=0.032*Math.pow(Re,0.8)*Math.pow(Pr,0.43); // (6.113) distractor
  const statedA=Number(q.choices[0].replace(/[^\d.]/g,''));
  assert.ok(Math.abs(statedA-liquid)/liquid<0.01,'distractor A is the (6.113) value');
  assert.ok((q.reportHistory||[]).some(r=>r.type==='audit2_batch4_authorship'),'authorship recorded');
});

test('batch4 FC-47: glossary gains Raoult and Henry terms (468 -> 470)',()=>{
  // 470 at batch-4 time; B-4 added five source-verified terms (475);
  // the 2026-11-07 expansion added 29 more source-verified terms (504).
  assert.equal(glossary.length,504);
  for(const id of ['raoults-law','henrys-law']){
    const term=glossary.find(g=>g.id===id);
    assert.ok(term,`${id} exists`);
    assert.ok(term.relatedSections.includes('11.4'));
  }
  const bond=glossary.find(g=>g.id==='bond-number');
  assert.match(bond.detail,/L′/,'bond-number detail carries the §9.3 small-Bond context');
});

test('batch4 side-fix: R3-I-10 leftover stock phrase removed from the six Ch.4 questions only',()=>{
  const phrase='黒体と灰色体など、それぞれのモデルの成立条件を確認する';
  const ch4=['supp-batch2-bi-number-v1','supp-batch2-fo-number-v1','supp-batch2-length-double-fo-v1','supp-batch2-bi-scale-h-v1','supp-batch2-fo-scale-t-v1','supp-batch2-similarity-condition-v1'];
  for(const id of ch4){
    const q=questions.find(x=>x.id===id);
    assert.ok(!q.beginnerPitfall.includes(phrase),`${id} pitfall replaced`);
    assert.equal(q.revision,'v2');
    assert.ok(q.reportHistory.some(r=>r.type==='internal_audit_followup'));
  }
  const ch10=['supp-batch2-view-reciprocity-v1','supp-batch2-blackbody-two-surfaces-v1','supp-batch2-reverse-f12-v1','supp-batch2-closed-view-sum-v1','supp-batch2-convex-self-factor-v1','supp-batch2-grey-surface-limit-v1'];
  for(const id of ch10){
    const q=questions.find(x=>x.id===id);
    assert.ok(q.beginnerPitfall.includes(phrase),`${id} is a radiation question: phrase is on-topic and stays`);
    assert.equal(q.revision,'v1');
  }
});

test('batch4 side-fix: Kirchhoff question keeps revision v1 with an audit-trail record',()=>{
  const q=questions.find(x=>x.id==='supp-kirchhoff-spectral-identifiability-v1');
  assert.equal(q.revision,'v1','bumping now would orphan answers given to the current content');
  assert.ok(q.reportHistory.some(r=>r.type==='internal_audit_followup'&&/節目2/.test(r.details||'')),'milestone-2 fix is now on record');
});

test('batch4 side-fix: browser-distribution filter reality is 444 checked questions',()=>{
  const filt=['internal_independent_check','authored_with_internal_check','internal_audit_followup'];
  assert.equal(questions.filter(q=>(q.reportHistory||[]).some(r=>filt.includes(r.type))).length,444);
});

test('batch4 side-fix: normalize heals duplicate bookmark ids and duplicate session answers',()=>{
  const attempt={questionId:'q1',correct:true,at:'2026-10-01T00:00:00.000Z',selected:0,confidence:'high',mode:'practice',questionRevision:'v1'};
  const state=createEmptyState();
  state.bookmarks=[
    {id:'b1',sectionId:'1.1',note:'old',createdAt:'2026-10-01T00:00:00.000Z'},
    {id:'b1',sectionId:'1.1',note:'new',createdAt:'2026-10-02T00:00:00.000Z'},
    {id:'b2',sectionId:'1.2',note:'keep',createdAt:'2026-10-01T00:00:00.000Z'}];
  state.sessions=[{date:'2026-10-01',total:2,correct:2,startedAt:'2026-10-01T00:00:00.000Z',answers:[attempt,{...attempt}]}];
  const out=normalizeLearningData(state);
  assert.equal(out.bookmarks.length,2);
  assert.equal(out.bookmarks.find(b=>b.id==='b1').note,'new','newest duplicate bookmark wins');
  assert.equal(out.sessions[0].answers.length,1,'duplicate rows inside a session snapshot collapse');
  assert.equal(out.sessions[0].total,2,'session totals are stored facts and are not recomputed');
  assert.equal(validateLearningData(out,{stored:true}),'');
});

test('batch4 side-fix: original note renders search highlights through the reader path',async()=>{
  const appSource=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert.match(appSource,/linkedReaderText\(independentNote\.explanation,4\)/,'note body uses the highlight-capable reader renderer');
  assert.match(appSource,/#reader-original-note mark/,'note hits prefer a mark inside the note');
  const html=renderTermLinks('熱伝導の基礎',[ ],{highlights:[[0,3]]});
  assert.match(html,/<mark>熱伝導<\/mark>/,'term-link renderer wraps highlight ranges in <mark>');
});
