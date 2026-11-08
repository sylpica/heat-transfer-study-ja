// U1 読む：目次→節本文、前後移動、章末問題パネル、付録パネル、用語リンク着地
import {launch,newPage,overflow,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U1');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
await page.goto(DIST+'/index.html#reader',{waitUntil:'networkidle'});
await page.waitForTimeout(900);

// 目次：節ボタンの数
const toc=await page.evaluate(()=>{
  const secs=[...document.querySelectorAll('.toc-item[data-section]')];
  const chBtns=[...document.querySelectorAll('button')].filter(b=>/章末問題・参考文献/.test(b.textContent));
  const apx=[...document.querySelectorAll('button')].filter(b=>/付録/.test(b.textContent)).map(b=>b.textContent.trim().slice(0,40));
  return {sections:secs.length,chapters:chBtns.length,appendix:apx};
});
log.info('目次：節ボタン='+toc.sections+' 章末ボタン='+toc.chapters+' 付録='+JSON.stringify(toc.appendix));
if(toc.sections===76)log.ok('目次に76節すべて表示');else log.fail('節ボタン数が76でない: '+toc.sections);

// 節 5.3 を目次から開く
await page.evaluate(()=>{const b=document.querySelector('.toc-item[data-section="5.3"]');if(b)b.click();});
await page.waitForTimeout(1200);
let h=await page.evaluate(()=>({url:location.hash,h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim().slice(0,30)),bodyLen:document.querySelector('article')?.textContent.length||0}));
log.info('5.3遷移後: '+JSON.stringify(h));
if(/5\.3/.test(h.h2.join()))log.ok('目次から5.3節本文へ到達');else log.fail('5.3節に到達できず');
await page.screenshot({path:SHOTS+'u1-section53-375.png'});

// 前後移動ボタンの探索と実行
const navBtns=await page.evaluate(()=>[...document.querySelectorAll('article button, article a, .reader-nav button, .reader-nav a')].map(e=>e.textContent.trim().slice(0,30)).filter(t=>/前|次|節/.test(t)));
log.info('前後移動候補: '+JSON.stringify(navBtns));
const nextClicked=await page.evaluate(()=>{
  const cands=[...document.querySelectorAll('a,button')].filter(e=>/次の節/.test(e.textContent));
  if(cands.length){cands[0].click();return cands[0].textContent.trim().slice(0,30);}
  return null;
});
if(nextClicked){await page.waitForTimeout(900);
  const now=await page.evaluate(()=>location.hash+' | '+([...document.querySelectorAll('h2')].map(x=>x.textContent.trim().slice(0,24)).join('/')));
  log.info('次の節クリック後: '+now);
  if(/5\.4/.test(now))log.ok('前後移動（次）で5.4へ');else log.obs('次へ移動先が想定と異なる: '+now);
}else log.obs('「次の節」ボタンが見つからない');

// 別の節（9.4 沸騰・凝縮あたり）も開く
await page.evaluate(()=>{location.hash='#reader/9.4';});
await page.waitForTimeout(1100);
h=await page.evaluate(()=>({hash:location.hash,h2:[...document.querySelectorAll('h2')].map(x=>x.textContent.trim().slice(0,30))}));
log.info('9.4直接遷移: '+JSON.stringify(h));
if(/9\.4/.test(h.h2.join()))log.ok('ハッシュ直指定で9.4節へ到達');else log.fail('9.4へ到達できず: '+JSON.stringify(h));

// 章末問題パネル（記事末）：開閉
const panelInfo=await page.evaluate(()=>{
  const heads=[...document.querySelectorAll('h2,h3,button,summary')].filter(e=>/章末問題/.test(e.textContent)).map(e=>e.tagName+':'+e.textContent.trim().slice(0,40));
  return heads.slice(0,10);
});
log.info('記事内 章末問題 要素: '+JSON.stringify(panelInfo));
// 目次側の章末ボタンで第9章パネルを開く
await page.evaluate(()=>{window.scrollTo(0,0);});
const chBtn=await page.evaluate(()=>{
  const bs=[...document.querySelectorAll('button')].filter(b=>/章末問題・参考文献/.test(b.textContent));
  return bs.length;
});
log.info('目次章末ボタン総数='+chBtn);
// 記事末パネルの disclosure を操作
const panelAct=await page.evaluate(()=>{
  const det=[...document.querySelectorAll('details')].filter(d=>/章末問題|参考文献/.test(d.textContent.slice(0,200)));
  if(!det.length)return 'no-details';
  const d=det[0]; const wasOpen=d.open;
  d.querySelector('summary')?.click();
  return {count:det.length,wasOpen,nowOpen:d.open,text:d.textContent.slice(0,120).replace(/\s+/g,' ')};
});
log.info('章末問題details: '+JSON.stringify(panelAct));
await page.waitForTimeout(600);
const probVisible=await page.evaluate(()=>{
  const det=[...document.querySelectorAll('details')].filter(d=>/章末問題/.test(d.textContent.slice(0,200)));
  if(!det.length)return null;
  const t=det[0].textContent; return {len:t.length,hasProblem:/9\.\d+/.test(t)};
});
log.info('パネル展開後テキスト: '+JSON.stringify(probVisible));
if(probVisible&&probVisible.hasProblem)log.ok('章末問題パネルを開くと問題文が表示される');else log.obs('章末問題パネルの内容を確認できず: '+JSON.stringify(panelAct));

// 付録A/Bパネル：目次ボタンから
const apxClicked=await page.evaluate(()=>{
  const bs=[...document.querySelectorAll('button')].filter(b=>/付録A/.test(b.textContent));
  if(bs.length){bs[0].click();return bs[0].textContent.trim().slice(0,50);}
  return null;
});
log.info('付録Aボタン: '+apxClicked);
if(apxClicked){await page.waitForTimeout(900);
  const t=await page.evaluate(()=>{const m=document.querySelector('main');return m?m.textContent.slice(0,300).replace(/\s+/g,' '):'';});
  log.info('付録A表示先頭: '+t.slice(0,200));
  await page.screenshot({path:SHOTS+'u1-appendixA-375.png'});
}else log.obs('付録Aボタンが目次に見つからない（記録と相違の可能性）');

// 用語リンク着地：節本文の用語リンクをクリック
await page.evaluate(()=>{location.hash='#reader/1.1';});
await page.waitForTimeout(1000);
const termLinks=await page.evaluate(()=>[...document.querySelectorAll('article a[href*="term"], article .term-link, article a')].filter(a=>/#glossary|term/.test(a.getAttribute('href')||'')).slice(0,5).map(a=>({text:a.textContent.trim().slice(0,20),href:a.getAttribute('href')})));
log.info('本文内用語リンク候補: '+JSON.stringify(termLinks));
const clicked=await page.evaluate(()=>{
  const a=[...document.querySelectorAll('article a')].find(a=>/glossary/.test(a.getAttribute('href')||''));
  if(a){const label=a.textContent.trim();a.click();return label;}
  return null;
});
if(clicked){await page.waitForTimeout(1100);
  const st=await page.evaluate(()=>({hash:location.hash,
    expanded:[...document.querySelectorAll('.glossary-item.expanded,.term-row.expanded,[aria-expanded="true"]')].length,
    scrollY:window.scrollY}));
  log.info('用語リンク「'+clicked+'」クリック後: '+JSON.stringify(st));
  if(/#glossary/.test(st.hash))log.ok('本文の用語リンクから用語集へ着地');else log.fail('用語リンクで用語集へ着地せず: '+st.hash);
  await page.screenshot({path:SHOTS+'u1-termlink-landing-375.png'});
}else log.obs('本文内に用語リンクが見つからない');

const ov=await overflow(page);
log.info('375px 横はみ出し: '+JSON.stringify(ov));
log.info('errors='+JSON.stringify(errors));
await ctx.close();
await browser.close();
console.log('U1 DONE');
