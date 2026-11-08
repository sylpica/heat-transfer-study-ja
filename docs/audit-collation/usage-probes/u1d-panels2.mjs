// U1d 章末問題パネル（目次ボタン経由）・付録・用語リンクの確定検証
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('U1d');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
const failed=[];
page.on('response',r=>{if(r.status()>=400)failed.push(r.status()+' '+r.url());});
await page.goto(DIST+'/index.html#reader/9.4',{waitUntil:'networkidle'});
await page.waitForTimeout(1000);

// 用語リンクの実マークアップ（article 内）
const termEls=await page.evaluate(()=>{
  const art=document.querySelector('article');
  if(!art)return 'no-article';
  const cand=[...art.querySelectorAll('a,button,span')].filter(e=>/term/i.test((e.className||'').toString())||e.hasAttribute('data-term-id')||/glossary/.test(e.getAttribute('href')||''));
  return cand.slice(0,6).map(e=>({tag:e.tagName,cls:(e.className||'').toString().slice(0,50),href:e.getAttribute('href'),text:e.textContent.trim().slice(0,20)}));
});
log.info('本文用語要素: '+JSON.stringify(termEls));

// 第9章グループの章末ボタンをクリック
const clickedCh=await page.evaluate(()=>{
  const sec=document.querySelector('.toc-item[data-section="9.4"]');
  let g=sec; while(g&&!(g.classList&&[...g.querySelectorAll('.toc-item')].some(b=>/章末問題/.test(b.textContent))))g=g.parentElement;
  const grp=sec.closest('details,section,div');
  // 章グループを辿る：data-section 9.x を含む details
  const dets=[...document.querySelectorAll('details')].filter(d=>d.querySelector('[data-section="9.1"],[data-section="9.4"]'));
  const host=dets[0]||grp;
  if(!host)return 'host-not-found';
  const btn=[...host.querySelectorAll('.toc-item')].find(b=>/章末問題/.test(b.textContent));
  if(!btn)return 'btn-not-found';
  btn.click(); return btn.textContent.trim().slice(0,40);
});
log.info('第9章 章末ボタン: '+clickedCh);
await page.waitForTimeout(1300);
const st=await page.evaluate(()=>{
  const main=document.querySelector('main');
  const t=main?main.textContent.replace(/\s+/g,' '):'';
  const i=t.indexOf('章末問題');
  return {hash:location.hash,has91:/問題\s*9\.1|9\.1\s/.test(t),headings:[...document.querySelectorAll('h2,h3')].map(x=>x.textContent.trim().slice(0,36)).slice(0,8),around:i>=0?t.slice(Math.max(0,i-40),i+160):''};
});
log.info('章末問題ビュー: '+JSON.stringify(st));
if(st.has91)log.ok('目次の章末ボタンから第9章の章末問題が表示される');else log.obs('章末問題の表示内容を要確認');
await page.screenshot({path:SHOTS+'u1d-ch9-problems-375.png'});
// パネル内 disclosure の開閉（3段階開示のはず）
const disc=await page.evaluate(()=>{
  const ds=[...document.querySelectorAll('main details')];
  return ds.slice(0,6).map(d=>({sum:d.querySelector('summary')?.textContent.trim().slice(0,36),open:d.open}));
});
log.info('章末問題ビュー details: '+JSON.stringify(disc));
const openOne=await page.evaluate(()=>{
  const d=[...document.querySelectorAll('main details')].find(d=>!d.open);
  if(!d)return 'none-closed';
  d.querySelector('summary').click();return d.open;
});
await page.waitForTimeout(500);
log.info('disclosure 1つ展開: '+openOne);

// 章切替：第2章の章末ボタンをクリック
const clickedCh2=await page.evaluate(()=>{
  const dets=[...document.querySelectorAll('details')].filter(d=>d.querySelector('[data-section="2.1"]'));
  const host=dets[0]; if(!host)return 'no-host';
  const btn=[...host.querySelectorAll('.toc-item')].find(b=>/章末問題/.test(b.textContent));
  if(!btn)return 'no-btn'; btn.click(); return 'clicked';
});
await page.waitForTimeout(1200);
const st2=await page.evaluate(()=>{const t=document.body.textContent.replace(/\s+/g,' ');return {has21:/2\.1\s/.test(t),h:[...document.querySelectorAll('h2,h3')].map(x=>x.textContent.trim().slice(0,36)).slice(0,6)};});
log.info('第2章へ切替後: '+JSON.stringify(st2)+' ('+clickedCh2+')');
if(st2.has21)log.ok('章切替で第2章の章末問題が表示される');else log.obs('章切替の表示を要確認');

// 付録A/B の実表示
for(const L of ['A','B']){
  const r=await page.evaluate((L)=>{
    const b=[...document.querySelectorAll('.toc-item')].find(b=>b.textContent.includes('付録'+L));
    if(!b)return 'no-btn'; b.click(); return 'clicked';
  },L);
  await page.waitForTimeout(1200);
  const s=await page.evaluate((L)=>{const t=document.body.textContent.replace(/\s+/g,' ');const i=t.indexOf('['+L+'.1]');return {found:i>=0,around:i>=0?t.slice(i,i+130):'',h:[...document.querySelectorAll('h2,h3')].map(x=>x.textContent.trim().slice(0,36)).slice(0,5)};},L);
  log.info('付録'+L+': '+r+' '+JSON.stringify(s));
  if(s.found)log.ok('付録'+L+'参考文献が表示される');else log.obs('付録'+L+'の表示を要確認');
}
await page.screenshot({path:SHOTS+'u1d-appendix-375.png'});

// 本文用語リンクのクリック着地（9.4本文へ戻ってから）
await page.evaluate(()=>{location.hash='#reader/9.4';});
await page.waitForTimeout(1100);
const tlClick=await page.evaluate(()=>{
  const art=document.querySelector('article');
  const cand=[...art.querySelectorAll('a,button')].filter(e=>/term/i.test((e.className||'').toString())||/glossary/.test(e.getAttribute('href')||''));
  if(!cand.length)return 'no-term-el';
  const e=cand[0]; const label=e.textContent.trim().slice(0,20); e.click(); return label;
});
await page.waitForTimeout(1200);
const land=await page.evaluate(()=>({hash:location.hash,
  hl:[...document.querySelectorAll('[aria-expanded="true"],.expanded,.highlight,.active-term')].length,
  h2:[...document.querySelectorAll('h2,h3')].map(x=>x.textContent.trim().slice(0,30)).slice(0,5)}));
log.info('用語クリック「'+tlClick+'」→ '+JSON.stringify(land));
if(/#glossary/.test(land.hash))log.ok('本文の用語リンクから用語集へ着地する');else log.obs('用語リンク着地を要確認: '+JSON.stringify(land));
await page.screenshot({path:SHOTS+'u1d-termlink-375.png'});
log.info('失敗リクエスト: '+JSON.stringify(failed));
log.info('errors='+JSON.stringify(errors));
await ctx.close();await browser.close();
console.log('U1d DONE');
