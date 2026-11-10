import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const all=JSON.parse(await readFile(new URL('../data/questions.json',import.meta.url)));
const lesson=JSON.parse(await readFile(new URL('../data/original-deep-lessons.json',import.meta.url))).lessons.find(l=>l.sectionId==='9.9');
const get=id=>all.find(q=>q.id===`supp-${id}-v1`);
const close=(x,y,tol=1e-10)=>assert.ok(Math.abs(x-y)<=tol*Math.max(1,Math.abs(y)),`${x} != ${y}`);
const number=text=>{
 const m=text.match(/[+−-]?\d+(?:\.\d+)?(?:×10[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+)?/u);
 assert.ok(m,text);
 const [base,exp]=m[0].replace('−','-').split('×10');
 const digits={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+'};
 return Number(base)*(exp?10**Number([...exp].map(c=>digits[c]).join('')):1);
};
const numeric=[
 ['tube-boiling-mass-flux','4.0×10² kg/(m²·s)',()=>.020/5e-5],
 ['tube-boiling-latent-quality','0.250',()=>.2+5000/(.050*2e6)],
 ['tube-boiling-subcooled-budget','0.0250',()=>(3000-.020*100e3)/(.020*2e6)],
 ['tube-boiling-slip-void','0.847',()=>1/(1+9*.01*2)],
 ['tube-boiling-pressure-property-derivative','0.0590 m⁻¹',()=>(100-(-20)-.20*10)/2000],
 ['forced-condensation-outlet-quality','0.600',()=>.8-16000/(.040*2e6)],
 ['forced-condensation-complete-then-subcool','全て液体で75.0 ℃',()=>100-(32000-.020*.75*2e6)/(.020*4000)],
 ['forced-condensation-coolant-balance','35.0 ℃',()=>20+6000/(.10*4000)],
 ['forced-condensation-film-shear-flow','3.83×10⁻³ kg/(m·s)',()=>1000*(1000*10*(1e-4)**3/3+.10*(1e-4)**2/2)/.001],
 ['dropwise-area-average','8.8×10³ W/(m²·K)',()=>.3*20000+.7*4000],
 ['dropwise-total-resistance-gain','1.43倍',()=>(1/(5000*.010)+.005+.025)/(1/(20000*.010)+.005+.025)],
 ['dropwise-coating-resistance','1.33×10³ W',()=>20/(50e-6/(.20*.020)+1/(20000*.020))],
 ['dropwise-h-uncertainty','11 %',()=>100*Math.hypot(.10,.050),.02],
 ['heat-pipe-latent-circulation','1.0×10⁻⁴ kg/s',()=>150/1.5e6],
 ['heat-pipe-contact-angle-pressure','2.0×10³ Pa',()=>2*.030*.50/(15e-6)],
 ['heat-pipe-gravity-assisted-margin','2.6×10³ Pa',()=>3000-(2000+800*10*(-.20))],
 ['heat-pipe-effective-resistance','0.20 K/W',()=>(60-40)/100]
];
for(const [id,correct,oracle,tolerance=.005] of numeric){
 test(`flow/phase: independent calculation and unique rounded answer for ${id}`,()=>{
  const q=get(id);assert.ok(q,id);assert.equal(q.choices[q.answer],correct);
  const value=oracle();
  const matches=q.choices.flatMap((text,i)=>Math.abs(number(text)-value)<=Math.abs(value)*tolerance?[i]:[]);
  assert.deepEqual(matches,[q.answer]);
 });
}
const concepts=[
 ['tube-boiling-equilibrium-quality','平衡では過冷却液側を表し、実際の蒸気質量割合は負にならない',/壁近傍に非平衡の泡/],
 ['tube-boiling-energy-not-limit','局所の流動と壁面熱流束を調べ、管に合う限界評価を別に行う',/ドライアウト/],
 ['forced-condensation-total-mass','蒸気流量は減るが液体流量が増え、両相の合計は保存される',/ṁ_in=ṁ_out/],
 ['forced-condensation-opposing-shear','重力と逆向きのせん断を運動量収支へ入れ、排液と適用範囲を見直す',/固定膜厚/],
 ['dropwise-distribution-not-mean','滴の個数・分布・被覆率・離脱の違いも調べて比較する',/分布/],
 ['dropwise-contact-angle-evidence','接触角の履歴差・排液・被覆熱抵抗等も含めて調べる',/被覆/],
 ['dropwise-film-model-limit','液滴の分布と面の条件に適合するモデル・測定を別に探す',/普遍的な一定倍率とはしない/],
 ['heat-pipe-other-limits','毛管条件とは別に、音速・同伴・沸騰等の限界も確認する',/全体の許容熱負荷の証明としない/],
 ['heat-pipe-pore-tradeoff','半分になる',/Q̇_maxはrに比例/],
 ['heat-pipe-startup-state','融解・起動時の熱収支と作動流体の状態を別に評価する',/凍結状態の起動過程を解いていない/]
];
for(const [id,correct,condition] of concepts){
 test(`flow/phase: ${id} distinguishes its definitions and applicable model`,()=>{
  const q=get(id);assert.ok(q);assert.equal(q.choices[q.answer],correct);assert.match(q.explanation,condition);
 });
}
test('all 27 independent flow/phase additions have four keyed reasons, section coverage and no expert approval',()=>{
 const ids=[...numeric,...concepts].map(([id])=>`supp-${id}-v1`);
 assert.equal(ids.length,27);assert.equal(new Set(ids).size,27);
 // Four additions moved to v2 in the 2026-11-09 overall fix part 2 (distractor rationale rewrites).
 const revisedV2=new Set(['supp-tube-boiling-subcooled-budget-v1','supp-forced-condensation-coolant-balance-v1','supp-dropwise-total-resistance-gain-v1','supp-heat-pipe-gravity-assisted-margin-v1']);
 for(const id of ids){
  const q=all.find(q=>q.id===id);assert.equal(q.revision,revisedV2.has(id)?'v2':'v1');assert.equal(q.expertReviewed,false);
  assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);
  assert.equal(q.distractors.length,4);assert.equal(q.distractors.filter(r=>r.startsWith('正解。')).length,1);
  assert.ok(q.distractors[q.answer].startsWith('正解。'));
  assert.ok(q.hints.length>=2&&q.solutionSteps.length>=3);
  assert.match(q.reviewStatus,/外部専門家校閲前/);
 }
 for(const section of ['9.8','9.9','9.10','9.11']){
  const qs=all.filter(q=>q.source?.focusSectionId===section||q.source?.sectionNoteId===section);
  assert.equal(qs.length,({'9.8':16,'9.9':12,'9.10':14,'9.11':16}[section]||8),section);assert.equal(new Set(qs.map(q=>q.questionKind)).size,3,section);
 }
 assert.equal(new Set(all.map(q=>q.prompt.normalize('NFKC').replace(/\s/g,''))).size,all.length);
});
test('external condensation velocity independently satisfies wall/shear boundaries and integral mass flux',()=>{
 const rho=1000,mu=.001,g=10,delta=.0001,tau=.1;
 const u=y=>rho*g*(delta*y-y*y/2)/mu+tau*y/mu;
 const uprime=y=>rho*g*(delta-y)/mu+tau/mu;
 close(u(0),0);close(mu*uprime(delta),tau);
 // Simpson integration of the quadratic independently checks the closed form.
 const gamma=rho*delta/6*(u(0)+4*u(delta/2)+u(delta));
 close(gamma,.003833333333333333);
 const opposed=rho*(rho*g*delta**3/3-tau*delta**2/2)/mu;
 close(opposed,.0028333333333333335);assert.ok(opposed<gamma);
 assert.match(lesson.blocks.map(b=>b.text).join(' '),/u\(0\)=0/);
 assert.match(lesson.blocks.map(b=>b.text).join(' '),/水平円筒外面の相関/);
});
test('capillary pore tradeoff follows loss scaling rather than capillary pressure alone',()=>{
 const limit=r=>3*r;
 close(limit(.5)/limit(1),.5);
 const r=.5,Q=limit(r),a=3,b=1;
 close(a/r,b*Q/r**2);
});
test('phase glossary defines mass, volume, heat and capillary quantities separately with live practice links',async()=>{
 const terms=JSON.parse(await readFile(new URL('../data/glossary.json',import.meta.url)));
 for(const id of ['mass-flux','vapor-quality','void-fraction','film-condensation','dropwise-condensation','heat-pipe','capillary-pressure']){
  const t=terms.find(t=>t.id===id);assert.ok(t,id);
  assert.ok(t.beginner.length>=35&&t.detail.length>=100&&t.example&&t.formula&&t.unit,id);
  assert.ok(t.relatedSections.length&&t.relatedQuestions.length,id);
  assert.ok(t.relatedQuestions.every(link=>all.some(q=>q.id===link.id)),id);
  assert.ok(t.related.every(label=>terms.some(other=>[other.ja,other.en,...other.aliases].includes(label))),id);
  assert.equal(t.reviewStatus,'needs_review');assert.equal(t.source.type,'supplement');
 }
 assert.match(terms.find(t=>t.id==='vapor-quality').detail,/保有質量と流量/);
 assert.match(terms.find(t=>t.id==='void-fraction').detail,/速度比/);
 assert.match(terms.find(t=>t.id==='heat-pipe').detail,/凍結起動/);
});
