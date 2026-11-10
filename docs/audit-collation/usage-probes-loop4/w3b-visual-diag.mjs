// W3b 目視の取り直し：式(5.3)・式(10.1)/(10.2) の要素スクリーンショット／図1.3 と図1.4 の DOM 構造比較／ノート内の新タイトル全文確認と旧タイトル不在確認
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('W3b');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);

// --- 式(5.3)：Π4 ≡ ζ を含む最小要素 ---
await page.goto(DIST+'/index.html#reader/5.2',{waitUntil:'load'});
await page.waitForTimeout(2400);
const eq53El=page.locator('#reader-article *').filter({hasText:/Π4 ≡ ζ/}).last();
log.info('式(5.3) 要素 count: '+await eq53El.count());
if(await eq53El.count()){
  await eq53El.scrollIntoViewIfNeeded().catch(()=>{});
  await page.waitForTimeout(500);
  await eq53El.screenshot({path:SHOTS+'w3b-eq53-block-375.png'}).catch(e=>log.info('shot: '+e.message));
}

// --- §10.1：ℱ を含む最小要素（式(10.2) 周辺）と F1–2 を含む要素 ---
await page.goto(DIST+'/index.html#reader/10.1',{waitUntil:'load'});
await page.waitForTimeout(2400);
const fEl=page.locator('#reader-article *').filter({hasText:/ℱ1/}).last();
log.info('ℱ 要素 count: '+await fEl.count());
if(await fEl.count()){
  await fEl.scrollIntoViewIfNeeded().catch(()=>{});
  await page.waitForTimeout(500);
  await fEl.screenshot({path:SHOTS+'w3b-eq102-block-375.png'}).catch(e=>log.info('shot: '+e.message));
}
const eqTexts=await page.evaluate(()=>{
  const art=document.querySelector('#reader-article');
  const blocks=[...art.querySelectorAll('p,div,li')].filter(e=>/F1|ℱ1|q1/.test(e.textContent)&&e.textContent.length<320).map(e=>e.textContent.replace(/\s+/g,' ').trim().slice(0,180));
  return blocks.slice(0,6);
});
log.info('§10.1 の式ブロック候補: '+JSON.stringify(eqTexts));

// --- 図1.3 と図1.4 の構造比較 ---
await page.goto(DIST+'/index.html#reader/1.3',{waitUntil:'load'});
await page.waitForTimeout(2400);
const figs=await page.evaluate(()=>{
  const out={};
  for(const fig of document.querySelectorAll('#reader-article figure')){
    const cap=fig.querySelector('figcaption')?.textContent.replace(/\s+/g,' ').trim().slice(0,30)||'';
    const key=(cap.match(/図\s*1\.\d+/)||['?'])[0];
    out[key]={children:[...fig.children].map(c=>c.tagName+'.'+(c.className.baseVal!==undefined?'svg':c.className).toString().slice(0,30)),
      svgCount:fig.querySelectorAll('svg').length,imgCount:fig.querySelectorAll('img').length,
      ariaLabel:fig.getAttribute('aria-label'),role:fig.getAttribute('role'),
      textLen:fig.textContent.length};
  }
  return out;
});
log.info('§1.3 の figure 構造: '+JSON.stringify(figs,null,1));

// --- ノート内の新タイトル全文確認＋旧タイトル不在 ---
for(const [id,newT,oldT] of [['11.6','低率における対流物質移動','低速の対流物質移動'],['11.7','低率における熱・物質同時移動','低速における熱・物質同時移動'],['11.9','高率の物質移動における熱伝達','高速の物質移動における熱伝達']]){
  await page.goto(DIST+'/index.html#reader/'+id,{waitUntil:'load'});
  await page.waitForTimeout(2400);
  const chk=await page.evaluate(([n,o])=>{
    const note=document.querySelector('#reader-original-note');
    const nt=note?note.textContent.replace(/\s+/g,' '):'';
    const body=document.querySelector('#reader-article')?.textContent.replace(/\s+/g,' ')||'';
    return {noteHasNew:nt.includes(n),noteHasOld:nt.includes(o),articleHasOld:body.includes(o),
      noteHead:(note?.querySelector('h3,h4,strong')?.textContent||'').trim().slice(0,60)};
  },[newT,oldT]);
  log.info('§'+id+' ノート検査: '+JSON.stringify(chk));
  if(chk.noteHasNew&&!chk.noteHasOld&&!chk.articleHasOld)log.ok('§'+id+' ノートに新タイトルがあり旧タイトルは残っていない');
  else log.obs('§'+id+' ノート検査の詳細: '+JSON.stringify(chk));
}
log.info('W3b errors: '+JSON.stringify(errors.filter(e=>e.startsWith('pageerror'))));
await ctx.close();
await browser.close();
console.log('W3b DONE');
