// Stage 6 (integration): §8.5 reconstruction — independently written lesson
// reinforcement and nine new questions, created from the full-read digest of
// the original §8.5 because the Codex enrichment was never saved to GitHub.
// The oracles below are recomputed from the governing formulas; they do not
// call a production solver and do not imply external expert approval.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url)));
const questions=await read('data/questions.json');
const deep=await read('data/original-deep-lessons.json');
const ids=[
 'supp-condensation-derivation-profile-v1',
 'supp-condensation-film-thickness-v1',
 'supp-condensation-corrected-latent-v1',
 'supp-condensation-cylinder-mean-v1',
 'supp-condensation-inclined-plate-v1',
 'supp-condensation-wavy-regime-v1',
 'supp-condensation-reynolds-definition-v1',
 'supp-condensation-tube-bank-v1',
 'supp-condensation-gamma-shape-v1'
];
const byId=id=>questions.find(q=>q.id===id);
// Parse choices such as '0.13 mm', '2.51×10⁶ J/kg', '1.2×10³'.
const num=s=>{
 const m=s.replace(/,/g,'').match(/[\d.]+/);
 let v=Number(m[0]);
 const sup={'¹':1,'²':2,'³':3,'⁴':4,'⁵':5,'⁶':6};
 const e=s.match(/×10([¹²³⁴⁵⁶])/);
 if(e)v*=10**sup[e[1]];
 return v;
};
const onlyChoiceNear=(q,oracle,tol)=>{
 const hits=q.choices.map((c,i)=>Math.abs(num(c)-oracle)<=tol*Math.abs(oracle)?i:-1).filter(i=>i>=0);
 assert.deepEqual(hits,[q.answer],q.id);
};

test('stage6 §8.5 lesson adds derivation, shape selection and transition blocks',()=>{
 const lesson=deep.lessons.find(l=>l.sectionId==='8.5');
 const headings=lesson.blocks.map(b=>b.heading);
 for(const h of ['Nusselt解析の導出の骨格','形状別の使い分け：有効重力の考え方','液膜レイノルズ数と波状・乱流への遷移'])
  assert.ok(headings.includes(h),h);
 const expressions=lesson.equations.map(e=>e.expression).join(' ');
 assert.match(expressions,/δ\(x\)/);
 assert.match(expressions,/Re_c = Γ \/ μ_l/);
 assert.match(expressions,/0\.728/);
 assert.match(expressions,/0\.828/);
 // The corrected latent heat h_fg' must appear consistently (FC-32 note kept).
 assert.ok(lesson.equations.filter(e=>e.expression.includes('h_fg′')||e.meaning.includes('h_fg′')).length>=3);
});

test('stage6 nine questions are section-linked, fully explained and unpublished-expert-free',()=>{
 const items=ids.map(byId);
 assert.ok(items.every(Boolean));
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 assert.deepEqual(items.map(q=>q.questionKind),
  ['conceptual','numerical','numerical','numerical','numerical','applied','numerical','numerical','conceptual']);
 for(const q of items){
  assert.equal(q.source.type,'supplement',q.id);
  assert.equal(q.source.chapterId,'ch8',q.id);
  assert.equal(q.source.focusSectionId,'8.5',q.id);
  assert.equal(q.source.guideId,'chapter8-buoyancy',q.id);
  assert.equal(q.choices.length,4,q.id);
  assert.equal(new Set(q.choices).size,4,q.id);
  assert.equal(q.distractors.length,4,q.id);
  assert.equal(q.distractors.filter(s=>s.startsWith('正解。')).length,1,q.id);
  assert.ok(q.distractors[q.answer].startsWith('正解。'),q.id);
  assert.equal(q.expertReviewed,false,q.id);
  assert.match(q.reviewStatus,/外部専門家校閲前/,q.id);
  assert.ok(q.solutionSteps.length>=3&&q.hints.length>=2,q.id);
  assert.ok(q.beginnerPitfall,q.id);
 }
});

test('stage6 film thickness oracle matches the Nusselt delta(x) fourth root',()=>{
 // delta = [4 mu k dT x / (rho (rho-rhov) g hfg)]^(1/4), properties as printed.
 const delta=(4*1e-3*.60*10*.20/(1000*(1000-1)*9.81*2e6))**.25;
 assert.ok(Math.abs(delta-1.2509621988430298e-4)<1e-12);
 onlyChoiceNear(byId('supp-condensation-film-thickness-v1'),delta*1000,.04); // mm
});

test('stage6 corrected latent heat oracle follows the (8.61) practical form',()=>{
 const hfgp=2.40e6*(1+(0.683-0.228/4.0)*.080);
 assert.ok(Math.abs(hfgp-2520192)<0.01);
 onlyChoiceNear(byId('supp-condensation-corrected-latent-v1'),hfgp,.005);
});

test('stage6 horizontal cylinder oracle uses 0.728 with diameter as length',()=>{
 const base=(950*(950-.60)*9.81*2.25e6*.68**3/(2.8e-4*.050*10))**.25;
 const hbar=.728*base;
 assert.ok(Math.abs(hbar-10586.13)<.5);
 onlyChoiceNear(byId('supp-condensation-cylinder-mean-v1'),hbar,.05);
});

test('stage6 inclined plate oracle is the (cos theta)^(1/4) scaling',()=>{
 const h=12000*(Math.cos(Math.PI/3))**.25;
 assert.ok(Math.abs(h-10090.76)<.5);
 onlyChoiceNear(byId('supp-condensation-inclined-plate-v1'),h,.02);
});

test('stage6 Reynolds definition conversion is exactly a factor of four',()=>{
 onlyChoiceNear(byId('supp-condensation-reynolds-definition-v1'),4*300,1e-9);
});

test('stage6 tube bank oracle uses the measured exponent a = 1/6',()=>{
 const h=8000*16**(-1/6);
 assert.ok(Math.abs(h-5039.68)<.5);
 onlyChoiceNear(byId('supp-condensation-tube-bank-v1'),h,.02);
});
