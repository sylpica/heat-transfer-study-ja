// W1c 検索ビューの構造診断
import {launch,newPage,DIST,SHOTS,makeLog} from './lib.mjs';
const log=makeLog('W1c');
const browser=await launch();
const {ctx,page,errors}=await newPage(browser,{width:375});
page.setDefaultTimeout(120000);
await page.goto(DIST+'/index.html#search',{waitUntil:'load'});
await page.waitForTimeout(2000);
const struct=await page.evaluate(()=>{
  const els=[...document.querySelectorAll('[id*=search],[class*=search]')].slice(0,20).map(e=>({tag:e.tagName,id:e.id,cls:e.className.slice(0,50),kids:e.children.length}));
  const forms=[...document.querySelectorAll('form')].map(f=>({id:f.id,cls:f.className.slice(0,40)}));
  const btns=[...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.textContent.trim().slice(0,20)).slice(0,15);
  return {els,forms,btns};
});
log.info('検索関連要素: '+JSON.stringify(struct.els));
log.info('フォーム: '+JSON.stringify(struct.forms)+' / ボタン: '+JSON.stringify(struct.btns));
await page.screenshot({path:SHOTS+'w1c-search-before-375.png'});
const inp=page.locator('#search-input, #search input, input[type=search]').first();
log.info('入力欄: '+await inp.count()+' / placeholder='+(await inp.getAttribute('placeholder').catch(()=>null)));
await inp.fill('熱抵抗');
await page.waitForTimeout(800);
await page.screenshot({path:SHOTS+'w1c-search-typed-375.png'});
// ボタンや Enter が必要か試す
const btnSearch=page.locator('button:has-text("検索")').first();
log.info('検索ボタン: '+await btnSearch.count());
if(await btnSearch.count())await btnSearch.click();
else await inp.press('Enter');
await page.waitForTimeout(3000);
const res=await page.evaluate(()=>{
  const body=document.body.textContent.replace(/\s+/g,' ');
  const view=document.querySelector('#search, [id*=search-view], main');
  return {
    熱抵抗と電気:body.includes('熱抵抗と電気回路の類推'),
    件数:(body.match(/(\d+)\s*件/)||[])[0]||'',
    viewHTML:(view?.innerHTML||'').replace(/\s+/g,' ').slice(0,1200),
  };
});
log.info('検索後: '+JSON.stringify({titleHit:res.熱抵抗と電気,count:res.件数}));
log.info('ビューのHTML: '+res.viewHTML);
await page.screenshot({path:SHOTS+'w1c-search-after-375.png'});
log.info('W1c errors: '+JSON.stringify(errors.filter(e=>e.startsWith('pageerror'))));
await ctx.close();
await browser.close();
console.log('W1c DONE');
