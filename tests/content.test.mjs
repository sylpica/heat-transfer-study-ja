import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {validateQuestion,searchRanges,searchSnippet,calculateHeatTransfer} from '../study-core.mjs';
import {GUIDE_SECTIONS} from '../guide.mjs';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
let hasLocal=true;try{for(const id of ['7.6','7.7','8.1','8.2','8.3'])await access(new URL(`data/local/sections/${id}-ja.json`,root));}catch{hasLocal=false;}
let hasLegacyDraft=true;try{for(const id of ['1.1','1.2'])await access(new URL(`data/local/sections/${id}-ja.json`,root));}catch{hasLegacyDraft=false;}
test('content audit keeps local-only drafts out of public availability',async()=>{
  const output=execFileSync(process.execPath,[new URL('../scripts/audit-content.mjs',import.meta.url).pathname,'--check'],{encoding:'utf8'});
  const report=JSON.parse(output.trim());
  const manifest=await read('data/content-manifest.json');
  const publicSections=[];
  for(const path of manifest.files){const section=await read(path);if(section.language==='ja')publicSections.push(section.sectionId);}
  assert.deepEqual(report.availableSections,[...new Set(publicSections)]);
  if(hasLegacyDraft){assert.ok(report.localDraftSections>=2);for(const id of ['1.1','1.2'])if(!publicSections.includes(id))assert.ok(!report.availableSections.includes(id));}
});
test('audit does not overwrite a historical inventory when local materials are missing',async()=>{
  const previous=await readFile(new URL('docs/CONTENT_INVENTORY.json',root),'utf8');
  const historical=JSON.parse(previous);
  const current=JSON.parse(execFileSync(process.execPath,[new URL('../scripts/audit-content.mjs',import.meta.url).pathname,'--check'],{encoding:'utf8'}).trim());
  if((historical.draftSectionCount||0)<=current.draftSections&&historical.availableSections.every(id=>current.availableSections.includes(id)))return;
  const result=spawnSync(process.execPath,[new URL('../scripts/audit-content.mjs',import.meta.url).pathname],{encoding:'utf8'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/上書きしません/);
  assert.equal(await readFile(new URL('docs/CONTENT_INVENTORY.json',root),'utf8'),previous);
});
test('private legacy Japanese drafts remain labeled unverified in a local pack',{skip:!hasLegacyDraft},async()=>{
  const manifest=await read('data/local-content-manifest.json');
  for(const id of ['1.1','1.2']){
    const ja=await read(`data/local/sections/${id}-ja.json`),en=await read(`data/local/sections/${id}-en.json`);
    assert.equal(ja.sourceReview,'draft');assert.equal(ja.expertReviewed,false);
    assert.equal(ja.sectionId,id);assert.equal(en.sectionId,id);
    assert.ok(ja.blocks.length>0&&en.blocks.length>0);
    assert.ok(manifest.files.includes(`./data/local/sections/${id}-ja.json`));
    for(const figure of ja.blocks.filter(block=>block.type==='figure'))assert.match(figure.src,/^data\/local\/figures\/[\w.-]+\.(?:png|jpe?g|webp)$/);
  }
});
test('public questions are self-contained and book references remain in the cited section',async()=>{
  const qs=await read('data/questions.json');assert.equal(new Set(qs.map(q=>q.id)).size,qs.length);
  const guideIds=new Set(GUIDE_SECTIONS.map(section=>section.id));
  const sections=(await read('data/book.json')).chapters.flatMap(chapter=>chapter.sections);
  for(const q of qs){
    assert.equal(validateQuestion(q),'',q.id);assert.equal(q.distractors.length,4);assert.ok(q.solutionSteps.length>=3);
    if(q.figure?.kind==='book'){
      assert.equal(q.figure.src,undefined,`公開用の原図を含めない: ${q.id}`);
      assert.equal(q.figure.figureNumber,q.source.figure,q.id);
      assert.equal(q.figure.bookPage,Number(q.source.bookPages),q.id);
      assert.equal(q.figure.pdfPage,Number(q.source.pdfPages),q.id);
      assert.ok(q.figure.caption&&q.figure.alt,q.id);
    }
    if(q.source.type==='supplement')assert.ok(guideIds.has(q.source.guideId),q.id);
    else{
      assert.equal(q.source.type,'book',q.id);
      const section=sections.find(s=>s.id===q.source.section);
      const nextSection=sections.filter(s=>Number(s.pdfStart)>Number(section?.pdfStart)).sort((a,b)=>Number(a.pdfStart)-Number(b.pdfStart))[0];
      assert.ok(section,q.id);assert.equal(Number(q.source.pdfPages)-Number(q.source.bookPages),14,q.id);
      assert.ok(Number(q.source.pdfPages)>=section.pdfStart&&(!nextSection||Number(q.source.pdfPages)<nextSection.pdfStart),q.id);
      assert.equal(q.reviewStatus,'source_checked');assert.equal(q.expertReviewed,false);
    }
  }
  assert.equal(qs.filter(q=>q.source.type==='supplement').length,qs.length-qs.filter(q=>q.source.type==='book').length);
  const boiling=qs.find(q=>q.id==='book-9-1-transition-flux');
  const energy=qs.find(q=>q.id==='book-1-2-closed-energy-rate');
  assert.equal(energy.source.section,'1.2');
  assert.equal(energy.source.bookPages,'6');
  assert.equal(energy.source.pdfPages,'20');
  assert.equal(energy.source.equation,'1.1');
  assert.equal(energy.choices[energy.answer],'+90 W');
  assert.equal(120-30,90,'Heat into the closed system minus work out equals energy accumulation');
  assert.ok(energy.distractors.every((reason,i)=>i===energy.answer||reason.length>20));
  assert.equal(boiling.source.bookPages,'476');assert.equal(boiling.source.pdfPages,'490');
  const beforeInception=qs.find(q=>q.id==='book-9-1-before-inception');
  assert.equal(beforeInception.source.bookPages,'473');assert.equal(beforeInception.source.pdfPages,'487');
  assert.equal(beforeInception.choices[beforeInception.answer],'自然対流が主となる');
  const film=qs.find(q=>q.id==='book-9-1-film-flux');
  assert.equal(film.source.bookPages,'476');assert.equal(film.source.pdfPages,'490');
  assert.equal(film.choices[film.answer],'熱流束は増加する');
  const peakRisk=qs.find(q=>q.id==='book-9-1-peak-flux-risk');
  assert.equal(peakRisk.source.bookPages,'476');assert.equal(peakRisk.source.pdfPages,'490');
  assert.equal(peakRisk.choices[peakRisk.answer],'壁面温度が急激に上昇する');
  const wireFlux=qs.find(q=>q.id==='book-9-1-wire-flux');
  assert.equal(wireFlux.source.bookPages,'472');assert.equal(wireFlux.source.pdfPages,'486');
  assert.equal(wireFlux.figure.figureNumber,'9.1');
  assert.match(wireFlux.prompt,/10\.0 V.*2\.0 A.*2\.0 cm².*有効数字2桁/);
  assert.equal(10*2/(2*1e-4),100000);
  assert.equal(wireFlux.choices[wireFlux.answer],'1.0×10⁵ W/m²');
  const wireTemperature=qs.find(q=>q.id==='book-9-1-wire-temperature');
  assert.equal(wireTemperature.source.bookPages,'472');assert.equal(wireTemperature.source.pdfPages,'486');
  assert.equal(wireTemperature.figure.figureNumber,'9.1');
  const fraction=(4.10/2.00-2.00)/(2.10-2.00);
  assert.ok(Math.abs(fraction-.5)<1e-12);
  assert.equal(Math.round(100+fraction*(200-100)),150);
  assert.equal(wireTemperature.choices[wireTemperature.answer],'150 ℃');
  const bubble=qs.find(q=>q.id==='book-9-2-bubble-radius');
  assert.equal(bubble.source.section,'9.2');assert.equal(bubble.source.bookPages,'478');assert.equal(bubble.source.pdfPages,'492');assert.equal(bubble.source.equation,'9.1');
  const radiusMicrometres=(2*0.060)/(3.0*1000)*1_000_000;
  assert.ok(Math.abs(radiusMicrometres-40)<1e-12);
  assert.equal(bubble.choices[bubble.answer],'4.0×10¹ μm');
  assert.equal(qs.filter(q=>q.source.type==='book').length,8);
  const ledger=await read('docs/SECTION_PROGRESS.json');
  for(const section of ledger.sections){
    const publicIds=qs.filter(q=>q.source.type==='book'&&q.source.section===section.id).map(q=>q.id).sort();
    assert.deepEqual([...(section.questions.publicQuestionIds||[])].sort(),publicIds,`進捗台帳: ${section.id}`);
    assert.ok(section.questions.count>=publicIds.length,`問題数: ${section.id}`);
    assert.ok(section.questions.sourceCheckedCount>=publicIds.length,`出典照合数: ${section.id}`);
  }
  const bundledFiles=(await read('data/content-manifest.json')).files;
  assert.equal(bundledFiles.length,76);
  assert.ok(bundledFiles.every(path=>/^\.\/data\/sections\/\d+-\d+-ja\.json$/.test(path)));
});
test('numeric public answer keys agree with independent simulator calculations and stated rounding',async()=>{
  const qs=await read('data/questions.json'),byId=id=>qs.find(q=>q.id===id);
  const cases=[
    ['supp-flat-numeric','conduction',{k:10,area:2,thickness:.1,hot:40,cold:20},0],
    ['supp-convection-numeric','convection',{h:20,area:2,surface:40,fluid:20},0],
    ['supp-radiation-numeric','radiation',{emissivity:.5,area:1,surface:26.85,surrounding:-73.15},1],
    ['supp-resistance-flow','resistance',{area:1,hot:80,cold:20,hHot:10,hCold:20,k1:.5,k2:.1,L1:.1,L2:.05},1]
  ];
  for(const [id,mode,values,digits] of cases){
    const q=byId(id),result=calculateHeatTransfer(mode,values);
    assert.ok(q&&result&&!result.error,id);
    const printed=Number(q.choices[q.answer].replace(/[^0-9.]/g,''));
    assert.equal(printed,Number(result.watts.toFixed(digits)),id);
    assert.equal(q.choices.filter(choice=>Number(choice.replace(/[^0-9.]/g,''))===printed).length,1,id);
  }
});
test('glossary practice links lead only to available public questions',async()=>{
  const questions=await read('data/questions.json'),ids=new Set(questions.map(q=>q.id));
  const terms=await read('data/glossary.json');
  const guideIds=new Set(GUIDE_SECTIONS.map(section=>section.id));
  for(const term of terms){
    if(term.source.guideId)assert.ok(guideIds.has(term.source.guideId),term.id);
    for(const link of term.relatedQuestions||[]){
      assert.ok(ids.has(link.id),`${term.id}: ${link.id}`);
      assert.ok(typeof link.label==='string'&&link.label.trim(),term.id);
    }
  }
  for(const [id,bookPage,pdfPage] of [['pool-boiling','471','485'],['electrical-resistance','472','486'],['wall-superheat','473','487'],['nucleate-boiling','474','488'],['transition-boiling','476','490'],['film-boiling','476','490'],['peak-heat-flux','476','490']]){
    const term=terms.find(item=>item.id===id);
    assert.ok(term,id);assert.equal(term.source.section,'9.1');assert.equal(term.source.bookPages,bookPage);assert.equal(term.source.pdfPages,pdfPage);
  }
});
test('normalized highlighting retains Unicode text and literal punctuation',()=>{
  assert.deepEqual(searchRanges('😀カ\u3099ラス１０[','ガラス10['),[[2,9]]);
});
test('search excerpts keep whole emoji and Japanese combining characters at both edges',()=>{
  const hasLoneSurrogate=value=>Array.from(value).some(point=>point.length===1&&point.codePointAt(0)>=0xd800&&point.codePointAt(0)<=0xdfff);
  const emoji=searchSnippet('😀'.repeat(50)+'a'+'needle','needle');
  assert.ok(!hasLoneSurrogate(emoji));assert.ok(emoji.includes('needle'));
  assert.ok(!hasLoneSurrogate(searchSnippet('a'.repeat(239)+'😀tail','absent')));
  const accents=searchSnippet('a\u0301'.repeat(50)+'xneedle','needle');
  assert.ok(accents.startsWith('…a\u0301'));assert.ok(accents.includes('needle'));
});
test('reviewed local sections retain original page locations, both languages, and figure descriptions',{skip:!hasLocal},async()=>{
  const expected={'7.64':387,'7.65':390,'7.66':391,'7.67':391,'7.68':391,'7.69':393,'7.70':393,'7.71':393,'7.72':393,'7.73a':395,'7.73h':395,'7.74':396};
  for(const sid of ['7.6','7.7']) {
    const ja=await read(`data/local/sections/${sid}-ja.json`),en=await read(`data/local/sections/${sid}-en.json`);
    assert.deepEqual(ja.blocks.map(b=>b.id),en.blocks.map(b=>b.id));assert.equal(ja.expertReviewed,false);
    for(const b of ja.blocks){assert.equal(b.pdfPage,b.bookPage+14,b.id);if(b.type==='figure'){assert.equal(typeof b.alt,'string');assert.ok(b.description);await access(new URL(b.src,root));}if(expected[b.number])assert.equal(b.bookPage,expected[b.number],b.number);}
    for(const b of en.blocks)if(b.alt)assert.equal(typeof b.alt,'string',b.id);
    if(sid==='7.6'){assert.equal(ja.blocks.filter(b=>b.type==='figure').length,8);assert.ok(ja.blocks.find(b=>b.number==='7.74').expression.includes('C(P−D)/P'));}
    else {const lists=ja.blocks.filter(b=>b.type==='list');assert.equal(lists.flatMap(b=>b.items).length,11);assert.equal(lists.at(-1).bookPage,399);}
  }
});
test('18 reviewed Japanese questions have complete rationale and valid source pages',{skip:!hasLocal},async()=>{
  const qs=[...await read('data/local/questions/7.6-ja.json'),...await read('data/local/questions/7.7-ja.json')];assert.equal(qs.length,18);
  for(const q of qs){assert.equal(validateQuestion(q),'',q.id);assert.equal(q.reviewStatus,'source_checked');assert.equal(q.expertReviewed,false);assert.ok(q.solutionSteps.length>=3);assert.equal(q.distractors.length,4);}
  const get=id=>qs.find(q=>q.id===id);
  assert.equal(get('ch7-6-strouhal').source.bookPages,'387');assert.equal(get('ch7-6-tube-max-speed').source.bookPages,'393');assert.equal(get('ch7-6-peclet-velocity').source.bookPages,'396');assert.equal(get('ch7-7-primary-source').source.bookPages,'399');
});
test('chapter 8 opening retains both languages, eight equations, dimensional annotations, and the original figure',{skip:!hasLocal},async()=>{
  for(const sid of ['8.1','8.2']){
    const ja=await read(`data/local/sections/${sid}-ja.json`),en=await read(`data/local/sections/${sid}-en.json`);
    assert.deepEqual(ja.blocks.map(b=>b.id),en.blocks.map(b=>b.id));assert.equal(ja.expertReviewed,false);
    assert.ok(ja.blocks.every(b=>b.pdfPage===b.bookPage+14&&b.pdfPage>=427&&b.pdfPage<=430));
    if(sid==='8.1'){assert.ok(ja.blocks.some(b=>b.type==='quote'&&b.attribution));assert.ok(ja.blocks.some(b=>b.text.includes('滴状凝縮')));}
    else{
      const formulas=ja.blocks.filter(b=>b.type==='formula');assert.deepEqual(formulas.map(b=>b.number),['8.1','8.2','8.3','8.4','8.5','8.6a','8.6b','6.40']);
      assert.match(formulas.find(b=>b.number==='8.2').expression,/\+ g/);assert.match(formulas.find(b=>b.number==='8.5').expression,/ρ_g\/ρ_f/);
      assert.equal(ja.blocks.filter(b=>b.type==='footnote').length,1);assert.equal(ja.blocks.find(b=>b.type==='table').rows.length,3);
      const fig=ja.blocks.find(b=>b.type==='figure');assert.equal(fig.pdfPage,428);assert.equal(fig.figureNumber,'8.1');assert.ok(fig.alt.includes('最大'));await access(new URL(fig.src,root));
    }
    const qs=await read(`data/local/questions/${sid}-ja.json`);assert.equal(qs.length,sid==='8.1'?2:6);
    for(const q of qs){assert.equal(validateQuestion(q),'',q.id);assert.equal(q.source.section,sid);assert.equal(q.reviewStatus,'source_checked');assert.ok(q.solutionSteps.length>=3);if(q.figure)await access(new URL(q.figure.src,root));}
  }
});
test('vertical natural convection retains source caveats, mean-value overbars, all figures and ten question rationales',{skip:!hasLocal},async()=>{
  const ja=await read('data/local/sections/8.3-ja.json'),en=await read('data/local/sections/8.3-en.json');assert.equal(ja.blocks.length,116);assert.deepEqual(ja.blocks.map(b=>b.id),en.blocks.map(b=>b.id));
  const formula=n=>ja.blocks.find(b=>b.type==='formula'&&b.number===n);
  for(const n of ['8.7','8.8','8.9','8.10','8.11','8.12','8.13a','8.13b','8.14','8.15','8.16','8.17','8.18','8.19','8.20','8.21','8.22','8.23','8.24','8.25','8.26','8.27','6.47'])assert.ok(formula(n),n);
  assert.match(formula('8.13b').expression,/8\/27.*²/);assert.match(formula('8.27').expression,/N̅u̅/);assert.match(formula('8.25').text,/W\/m²/);
  assert.equal(ja.blocks.filter(b=>b.type==='footnote').length,4);assert.ok(ja.blocks.filter(b=>b.type==='sourceNote').length>=2);assert.ok(ja.blocks.some(b=>b.type==='sourceNote'&&b.text.includes('0.04357')));
  for(const b of ja.blocks){assert.equal(b.pdfPage,b.bookPage+14);if(b.type==='figure'){await access(new URL(b.src,root));assert.ok(b.alt&&b.caption);}}
  assert.deepEqual(ja.blocks.filter(b=>b.type==='figure').map(b=>b.figureNumber),['8.2','8.3','8.4','8.5']);
  const qs=await read('data/local/questions/8.3-ja.json');assert.equal(qs.length,10);
  for(const q of qs){assert.equal(validateQuestion(q),'',q.id);assert.equal(q.source.section,'8.3');assert.equal(q.expertReviewed,false);assert.ok(q.beginnerPitfall);assert.ok(q.solutionSteps.length>=3);if(q.figure)await access(new URL(q.figure.src,root));}
  assert.equal(qs.find(q=>q.id==='ch8-3-mean-h-calculation').answer,3);
});

test('independent application questions have unique answer keys and independently recomputed physical values',async()=>{
  const questions=await read('data/questions.json');
  const added=questions.filter(q=>q.id.startsWith('supp-audit-'));
  assert.equal(added.length,12);
  assert.equal(new Set(added.map(q=>q.id)).size,12);
  for(const field of ['熱伝導','対流','熱放射','熱抵抗'])
    assert.equal(added.filter(q=>q.field===field).length,3,field);
  const correct=Object.fromEntries(added.map(q=>[q.id.replace('supp-audit-',''),q.choices[q.answer]]));
  for(const q of added){
    assert.equal(q.source.type,'supplement',q.id);
    assert.equal(q.expertReviewed,false,q.id);
    assert.equal(q.reviewStatus.includes('専門家校閲なし'),true,q.id);
    assert.equal(q.distractors.filter(reason=>reason.startsWith('正解。')).length,1,q.id);
    assert.equal(q.distractors[q.answer].startsWith('正解。'),true,q.id);
    assert.ok(q.hints.length>=2&&q.solutionSteps.length>=3,q.id);
  }
  const equal=(key,value,expected)=>{
    assert.ok(Math.abs(value-expected)<=1e-10*Math.max(1,Math.abs(expected)),key);
    assert.equal(typeof correct[key],'string',key);
  };
  // Independent calculations: no app simulator output is used for these answer checks.
  equal('conduction-compensation',(2*3)/(2*4)/(3/4),1);
  equal('conduction-reversed-sign',10*1*(20-50)/1,-300);
  equal('conduction-inverse-k',60*.2/(.5*30),.8);
  equal('convection-negative-direction',25*2*(0-20),-1000);
  equal('convection-inverse-h',400/(1.6*(35-25)),25);
  equal('convection-compensating-inputs',(2*15)*(10/2)/(15*10),1);
  equal('radiation-equal-temperatures',300**4-300**4,0);
  equal('radiation-emissivity-scale',.90/.30,3);
  const radiationRatio=(400**4-300**4)/(300**4-200**4);
  equal('radiation-same-delta-different-level',radiationRatio,17.5/6.5);
  assert.ok(radiationRatio>1);
  equal('resistance-layer-temp-drop',80*.5,40);
  equal('resistance-overall-u',1/(.25*2),2);
  equal('resistance-one-layer-doubled',(.1+.2+.5+.1)/(.1+.4+.5+.1),9/11);
  assert.match(added.find(q=>q.id==='supp-audit-resistance-one-layer-doubled').prompt,/第1固体層（0\.20 K\/W）/);
  for(const [key,label] of Object.entries({
    'conduction-compensation':'変わらない',
    'conduction-reversed-sign':'−300 W',
    'conduction-inverse-k':'0.80 W/(m·K)',
    'convection-negative-direction':'−1,000 W',
    'convection-inverse-h':'25 W/(m²·K)',
    'convection-compensating-inputs':'変わらない',
    'radiation-equal-temperatures':'正味の熱移動率は0 Wになる',
    'radiation-emissivity-scale':'3倍',
    'radiation-same-delta-different-level':'Aのほうが大きい',
    'resistance-layer-temp-drop':'40 K',
    'resistance-overall-u':'2.0 W/(m²·K)',
    'resistance-one-layer-doubled':'9/11倍'
  }))assert.equal(correct[key],label,key);
});

test('conceptual answers do not stand out solely by option length',async()=>{
  const byId=new Map((await read('data/questions.json')).map(question=>[question.id,question]));
  for(const id of ['supp-audit-radiation-equal-temperatures','supp-chapter-ch9-chf','supp-chapter-ch10-concept']){
    const lengths=byId.get(id).choices.map(choice=>Array.from(choice).length);
    assert.ok(Math.max(...lengths)-Math.min(...lengths)<=4,`${id}: ${lengths}`);
  }
});


test('four new original lessons have twelve consistent questions with independently derived physical answers',async()=>{
  const qs=await read('data/questions.json');
  const added=qs.filter(q=>q.id.startsWith('supp-expanded-'));
  assert.ok(qs.length>=265);
  assert.equal(added.length,12);
  const lessonIds=['learn-dimensionless-transient','learn-lumped-cooling','learn-convection-dimensionless','learn-heat-exchanger'];
  for(const guideId of lessonIds){
    assert.ok(GUIDE_SECTIONS.some(g=>g.id===guideId),guideId);
    assert.equal(added.filter(q=>q.source.guideId===guideId).length,3,guideId);
  }
  const get=suffix=>added.find(q=>q.id==='supp-expanded-'+suffix);
  const verified={
    'bi-calc':{label:'0.040',calculation:40*(.002/.10)/20,expected:.040},
    'fo-calc':{label:'1.0',calculation:1e-5*40/(.020**2),expected:1},
    'alpha-calc':{label:'5.0×10⁻⁶ m²/s',calculation:10/(1000*2000),expected:5e-6},
    'tau-calc':{label:'2,000 s',calculation:1000*.001*4000/(20*.10),expected:2000},
    'lumped-temp':{label:'34.7 ℃',calculation:20+(60-20)*Math.exp(-1),expected:34.7151776469},
    'lumped-double-time':{label:'6.8 K',calculation:50*Math.exp(-2),expected:6.7667641618},
    're-calc':{label:'10,000',calculation:1000*.2*.05/.001,expected:10000},
    'pr-calc':{label:'8.0',calculation:.001*4000/.5,expected:8},
    'nu-calc':{label:'10.0',calculation:100*.05/.5,expected:10},
    'hx-energy':{label:'8,000 W',calculation:.20*2000*(80-60),expected:8000},
    'hx-lmtd-equal':{label:'40 K',calculation:(80-40+60-20)/2,expected:40},
    'hx-area':{label:'2.0 m²',calculation:8000/(100*40),expected:2}
  };
  for(const [suffix,v] of Object.entries(verified)){
    const q=get(suffix);
    assert.ok(q,suffix);
    assert.equal(validateQuestion(q),'',suffix);
    assert.equal(q.choices[q.answer],v.label,suffix);
    assert.ok(Math.abs(v.calculation-v.expected)<=.0001*Math.max(1,Math.abs(v.expected)),suffix);
    assert.equal(q.distractors.filter(reason=>reason.startsWith('正解。')).length,1,suffix);
    assert.ok(q.distractors[q.answer].startsWith('正解。'),suffix);
    assert.ok(q.hints.length>=2&&q.solutionSteps.length>=3,suffix);
    assert.equal(q.expertReviewed,false,suffix);
    assert.match(q.reviewStatus,/専門家校閲なし/,suffix);
    assert.equal(q.source.type,'supplement',suffix);
  }
  const glossary=await read('data/glossary.json');
  const ids=new Set(glossary.map(x=>x.id));
  assert.equal(ids.size,glossary.length);
  for(const id of ['thermal-diffusivity','biot-number','fourier-number','lumped-capacitance','thermal-time-constant','reynolds-number','prandtl-number','nusselt-number','heat-exchanger-balance','log-mean-temperature-difference'])assert.ok(ids.has(id),id);
  const studied=new Set(qs.map(q=>q.id));
  for(const term of glossary.filter(t=>t.source?.guideId?.startsWith('learn-'))){
    assert.ok(lessonIds.includes(term.source.guideId),term.id);
    for(const link of term.relatedQuestions||[])assert.ok(studied.has(link.id),link.id);
  }
});
