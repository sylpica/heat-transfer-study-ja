// R7-W1 変更面：節 11.6〜11.10 を 375px / 1280px（ライト）で開き、
// 𝒢→g 差し戻し後の gm,i / gm,2 / h_{fg} 表示・はみ出し・pageerror を確認する
import {launch,newPage,SHOTS,makeLog,overflow,innerOverflow,openSection,termCounts} from './lib.mjs';
const log=makeLog('R7-W1');
const browser=await launch();
const targets=[
  {id:'11.6',expect:{gm_i:11}},
  {id:'11.7',expect:{gm_i:1,hfg:8}},
  {id:'11.8',expect:{gm_2:8}},
  {id:'11.9',expect:{gm_i:1,hfg:3}},
  {id:'11.10',expect:{hfg:6}},
];
for(const width of [375,1280]){
  const {ctx,page,errors}=await newPage(browser,{width,height:width===375?812:900});
  page.setDefaultTimeout(120000);
  for(const t of targets){
    errors.length=0;
    const st=await openSection(page,t.id);
    const counts=await termCounts(page);
    const ov=await overflow(page);
    const inner=await innerOverflow(page);
    log.info(`§${t.id} @${width}px 見出し=${JSON.stringify(st.h2)} 段落=${st.paras} counts=${JSON.stringify(counts)} docOverflow=${JSON.stringify(ov)}`);
    if(counts.scriptG===0)log.ok(`§${t.id} @${width}px 𝒢(U+1D4A2) の残存 0`);
    else log.fail(`§${t.id} @${width}px 𝒢 が ${counts.scriptG} 件残存`);
    for(const [k,v] of Object.entries(t.expect)){
      if(counts[k]>=v)log.ok(`§${t.id} @${width}px ${k} 表示 ${counts[k]} 件（データ ${v} 件以上）`);
      else log.fail(`§${t.id} @${width}px ${k} 表示 ${counts[k]} 件 < データ ${v} 件`);
    }
    if(!ov.bad)log.ok(`§${t.id} @${width}px 文書横はみ出し 0`);
    else log.fail(`§${t.id} @${width}px 文書横はみ出し ${JSON.stringify(ov)}`);
    if(inner.length===0)log.ok(`§${t.id} @${width}px 記事内部のはみ出し要素 0`);
    else log.obs(`§${t.id} @${width}px 記事内部のはみ出し要素 ${inner.length} 件: ${JSON.stringify(inner.slice(0,4))}`);
    const pe=errors.filter(e=>e.startsWith('pageerror'));
    if(pe.length===0)log.ok(`§${t.id} @${width}px pageerror 0`);
    else log.fail(`§${t.id} @${width}px pageerror: ${JSON.stringify(pe)}`);
    const ce=errors.filter(e=>e.startsWith('console'));
    if(ce.length)log.obs(`§${t.id} @${width}px console: ${JSON.stringify(ce)}`);
  }
  await ctx.close();
}
await browser.close();
console.log('DONE R7-W1');
