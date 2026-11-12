import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchTerms,renderTermLinks,renderTermSheet,renderTermLearningLinks} from '../term-links.mjs';
const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url)));
const [terms,book,questions]=await Promise.all(['data/glossary.json','data/book.json','data/questions.json'].map(read));
const byId=new Map(terms.map(t=>[t.id,t]));
const recovered=['heat-conduction','transient-conduction','boundary-condition','initial-condition',
 'characteristic-length','complementary-error-function','thermal-penetration','fin',
 'insulated-fin-tip','fin-tip-convection','hyperbolic-tangent','stefan-boltzmann',
 'fick-law','molar-fraction','schmidt-number','sherwood-number'];
test('all 16 concepts from PR14 plus diffusivity have complete original explanations and valid learning targets',()=>{
 const sections=new Set(book.chapters.flatMap(c=>c.sections.map(s=>s.id)));
 const qIds=new Set(questions.map(q=>q.id));
 assert.equal(terms.length,byId.size);
 for(const id of [...recovered,'mass-diffusivity']){
  const t=byId.get(id);assert.ok(t,id);
  assert.ok(t.en&&t.category&&t.brief.length>=15&&t.beginner.length>=35&&t.detail.length>=100,id);
  assert.notEqual(t.beginner,t.detail);assert.ok(t.formula&&t.unit&&t.example,id);
  assert.ok(t.related.length>=2&&t.relatedSections.length>=1&&t.relatedQuestions.length>=1,id);
  assert.ok(t.relatedSections.every(id=>sections.has(id)),id);
  assert.ok(t.relatedQuestions.every(link=>qIds.has(link.id)),id);
  assert.ok(t.related.every(label=>terms.some(other=>[other.ja,other.en,...other.aliases].includes(label))),id);
  assert.equal(t.source.type,'supplement');assert.equal(t.reviewStatus,'needs_review');
 }
});
test('short scientific aliases are recognized at Latin word boundaries and unpublished terms stay unlinked',()=>{
 assert.deepEqual(matchTerms('Sc=500、Sh=100、erfc(0.5)',terms,8).map(x=>x.id),
  ['schmidt-number','sherwood-number','complementary-error-function']);
 assert.deepEqual(matchTerms('Score Shannon erfcx Nu_x Re_f ScAB W J K',terms,8),[]);
 assert.deepEqual(matchTerms('秘密用語',[{id:'private',ja:'秘密用語',availableInApp:false}],8),[]);
 assert.deepEqual(matchTerms('熱伝導率と非定常熱伝導',terms,8).map(x=>x.id),['thermal-conductivity','transient-conduction']);
});
test('prepared term matching retains original offsets after length-changing case folds',()=>{
 const text='İ: HEAT CONDUCTION、Sc=500、熱伝導率';
 const hits=matchTerms(text,terms,8);
 assert.deepEqual(hits.map(h=>h.id),['heat-conduction','schmidt-number','thermal-conductivity']);
 for(const hit of hits)assert.equal(text.slice(hit.start,hit.end),hit.label);
 assert.deepEqual(matchTerms('熱伝導率・熱伝導・熱伝導率',terms,2).map(h=>h.label),['熱伝導率','熱伝導']);
});
test('radioactivity wording cannot accidentally open the thermal radiosity definition',()=>{
 assert.equal(matchTerms('放射能をBqで測る',terms,8).length,0);
 assert.deepEqual(matchTerms('放射能（熱放射）と射度',terms,8).map(x=>x.id),['radiosity','radiosity']);
 const t=byId.get('radiosity');
 assert.match(t.detail,/壊変率\[Bq\]/);assert.equal(t.unit,'W/m²');
 assert.match(t.detail,/J−G/);assert.match(t.example,/760 W\/m²/);
});
test('heat capacity and diffusivity examples preserve dimensions and different reference quantities',()=>{
 assert.equal(2*500,1000);assert.equal(1000*10,10000);
 const alpha=2/(2e6),massD=2e-5,L=.01;
 assert.equal(alpha,1e-6);assert.ok(Math.abs(L**2/alpha-100)<1e-12);assert.equal(L**2/massD,5);
 assert.match(byId.get('heat-capacity').unit,/J\/K/);
 assert.match(byId.get('specific-heat').unit,/J\/\(kg·K\)/);
 assert.match(byId.get('thermal-diffusivity').example,/100 s/);
 assert.match(byId.get('mass-diffusivity').example,/5.0 s/);
});
test('fin and special-function examples satisfy limiting boundary conditions and separate effectiveness',()=>{
 const eta=Math.tanh(1),tip=20+60/Math.cosh(1);
 assert.ok(Math.abs(eta-.7615941559557649)<1e-12);
 assert.ok(Math.abs(tip-58.883256419833)<1e-10);
 assert.equal(.8*.01/.0002,40);
 assert.ok(tip>20&&tip<80,'adiabatic tip is not a specified ambient temperature');
 assert.match(byId.get('insulated-fin-tip').example,/58.88/);
 assert.match(byId.get('fin-effectiveness').example,/=40/);
 const erfcHalf=1-.5204998778130465;
 assert.ok(Math.abs((20+60*erfcHalf)-48.77000733121721)<1e-10);
 assert.equal(Math.sqrt(1e-6*100),.01);
 assert.match(byId.get('thermal-penetration').detail,/厳密に切れる伝播前線はなく/);
});
test('mass transfer and radiation examples agree with their different flux definitions',()=>{
 assert.equal(2/(2+3),.4);
 assert.ok(Math.abs(1e-6/2e-9-500)<1e-10);assert.ok(Math.abs(2e-5*.01/2e-9-100)<1e-10);
 assert.ok(Math.abs((-2e-9*(-100))-2e-7)<1e-20);
 assert.ok(Math.abs(5.670374419e-8*300**4-459.300327939)<1e-8);
 assert.equal(.6*1000+.4*400,760);
 assert.match(byId.get('fick-law').detail,/モル平均速度/);
 assert.match(byId.get('sherwood-number').detail,/圧力差基準/);
 assert.match(byId.get('stefan-boltzmann').detail,/温度差の4乗へ置き換えない/);
});
test('panel examples and study links are escaped and expose the same learning targets',()=>{
 const t=byId.get('heat-capacity'),html=renderTermSheet(t,terms);
 assert.match(html,/はじめての説明/);assert.match(html,/独立作成の例/);
 assert.match(html,/data-section="5.2"/);assert.match(html,/#guide\/sim-transient/);
 const hostile={...t,example:'<script>secret()</script>',relatedSections:['"><img src=x>'],relatedSimulators:['"><script>','radiation']};
 const markup=renderTermSheet(hostile,terms);
 assert.doesNotMatch(markup,/<script>|<img /);assert.match(markup,/&lt;script&gt;/);
 assert.doesNotMatch(renderTermLearningLinks(hostile),/sim-.*script/);
});

test('search highlighting can cross terminology boundaries without removing vocabulary access; math notation is converted',()=>{
 // Until 2026-11-12 this test pinned "raw math stays raw" on the reader
 // path. The live-site inspection overruled that design: raw "_"/"^" in
 // prose was the defect, so Nu_x now renders with a real subscript while
 // highlighting, term access and escaping behave as before.
 const text='熱伝導率一定の式 Nu_x=1 <入力>';
 const html=renderTermLinks(text,terms,{highlights:[[0,6],[5,7]]});
 assert.match(html,/data-term-id="thermal-conductivity"[^>]*><mark>熱伝導率<\/mark>/);
 assert.match(html,/<mark>一定の<\/mark>/);
 assert.match(html,/Nu<sub>x<\/sub>=1/);assert.match(html,/&lt;入力&gt;/);
 const plain=html.replace(/<[^>]+>/g,'').replaceAll('&lt;','<').replaceAll('&gt;','>');
 assert.equal(plain,'熱伝導率一定の式 Nux=1 <入力>');
 const invalid=renderTermLinks(text,terms,{highlights:[null,[0,999],[-1,2],[2,1],['0',2]]});
 assert.doesNotMatch(invalid,/<mark>/);
});
